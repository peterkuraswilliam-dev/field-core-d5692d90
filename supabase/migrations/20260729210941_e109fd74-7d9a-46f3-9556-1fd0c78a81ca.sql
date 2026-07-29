
-- =========================================================
-- Stage 3B: Tasks, Notes, Activity
-- =========================================================

CREATE TYPE public.task_status AS ENUM ('todo','in_progress','blocked','completed');
CREATE TYPE public.task_priority AS ENUM ('low','normal','high','urgent');

-- ---------- project_tasks ----------
CREATE TABLE public.project_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'normal',
  due_date date,
  assigned_to uuid,
  created_by uuid NOT NULL,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_tasks_project_idx ON public.project_tasks(project_id);
CREATE INDEX project_tasks_workspace_idx ON public.project_tasks(workspace_id);
CREATE INDEX project_tasks_assignee_idx ON public.project_tasks(assigned_to);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
GRANT ALL ON public.project_tasks TO service_role;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- ---------- project_notes ----------
CREATE TABLE public.project_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) > 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_notes_project_idx ON public.project_notes(project_id);
CREATE INDEX project_notes_workspace_idx ON public.project_notes(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_notes TO authenticated;
GRANT ALL ON public.project_notes TO service_role;
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

-- ---------- project_activity ----------
CREATE TABLE public.project_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_activity_project_idx ON public.project_activity(project_id, created_at DESC);
CREATE INDEX project_activity_workspace_idx ON public.project_activity(workspace_id, created_at DESC);

-- SELECT only for authenticated; writes go through SECURITY DEFINER helpers
GRANT SELECT ON public.project_activity TO authenticated;
GRANT ALL ON public.project_activity TO service_role;
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- Helper: can update task (manager, or the assignee themselves)
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_update_task(_task_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_tasks t
    WHERE t.id = _task_id
      AND (
        public.can_manage_project(t.project_id, _user_id)
        OR (
          t.assigned_to = _user_id
          AND public.is_assigned_to_project(t.project_id, _user_id)
          AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = t.workspace_id
              AND wm.user_id = _user_id
              AND wm.status = 'active'
              AND wm.role IN ('field_worker','contractor','project_manager','admin','owner')
          )
        )
      )
  );
$$;

-- =========================================================
-- BEFORE triggers: populate workspace_id + validate assignee + completion sync
-- =========================================================
CREATE OR REPLACE FUNCTION public.project_task_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.projects WHERE id = NEW.project_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;
  NEW.workspace_id := v_ws;

  IF NEW.assigned_to IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = v_ws AND wm.user_id = NEW.assigned_to AND wm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Assignee is not an active workspace member';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = NEW.project_id AND pm.user_id = NEW.assigned_to
    ) THEN
      RAISE EXCEPTION 'Assignee is not assigned to this project';
    END IF;
  END IF;

  IF NEW.status = 'completed' THEN
    IF NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
    IF NEW.completed_by IS NULL THEN NEW.completed_by := auth.uid(); END IF;
  ELSE
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER project_tasks_before_ins BEFORE INSERT ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.project_task_before_write();
CREATE TRIGGER project_tasks_before_upd BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.project_task_before_write();

-- Assignee-only update guard: only status may change when not a manager
CREATE OR REPLACE FUNCTION public.project_task_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_manage_project(NEW.project_id, auth.uid()) THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'You can only update the status of tasks assigned to you';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_tasks_guard BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.project_task_guard_update();

CREATE TRIGGER project_tasks_updated_at BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notes: set workspace_id, freeze author fields on update
CREATE OR REPLACE FUNCTION public.project_note_before_ins()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.projects WHERE id = NEW.project_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;
  NEW.workspace_id := v_ws;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_notes_before_ins BEFORE INSERT ON public.project_notes
  FOR EACH ROW EXECUTE FUNCTION public.project_note_before_ins();

CREATE OR REPLACE FUNCTION public.project_note_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.workspace_id := OLD.workspace_id;
    NEW.project_id := OLD.project_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_notes_guard BEFORE UPDATE ON public.project_notes
  FOR EACH ROW EXECUTE FUNCTION public.project_note_guard();

CREATE TRIGGER project_notes_updated_at BEFORE UPDATE ON public.project_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RLS Policies
-- =========================================================

-- project_tasks
CREATE POLICY "View tasks in accessible projects" ON public.project_tasks
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "Managers create tasks" ON public.project_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_project(project_id, auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Managers or assignee update tasks" ON public.project_tasks
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_project(project_id, auth.uid())
    OR (
      assigned_to = auth.uid()
      AND public.is_assigned_to_project(project_id, auth.uid())
      AND public.workspace_role_of(workspace_id, auth.uid())
        IN ('owner','admin','project_manager','field_worker','contractor')
    )
  )
  WITH CHECK (
    public.can_manage_project(project_id, auth.uid())
    OR (
      assigned_to = auth.uid()
      AND public.is_assigned_to_project(project_id, auth.uid())
      AND public.workspace_role_of(workspace_id, auth.uid())
        IN ('owner','admin','project_manager','field_worker','contractor')
    )
  );

CREATE POLICY "Managers delete tasks" ON public.project_tasks
  FOR DELETE TO authenticated
  USING (public.can_manage_project(project_id, auth.uid()));

-- project_notes
CREATE POLICY "View notes in accessible projects" ON public.project_notes
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "Members add notes" ON public.project_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_view_project(project_id, auth.uid())
    AND created_by = auth.uid()
    AND public.workspace_role_of(workspace_id, auth.uid())
      IN ('owner','admin','project_manager','field_worker','contractor')
  );

CREATE POLICY "Authors or managers edit notes" ON public.project_notes
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.can_manage_project(project_id, auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.can_manage_project(project_id, auth.uid()));

CREATE POLICY "Authors or managers delete notes" ON public.project_notes
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.can_manage_project(project_id, auth.uid()));

-- project_activity: read-only for authenticated
CREATE POLICY "View activity in accessible projects" ON public.project_activity
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

-- =========================================================
-- Activity logging
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_project_activity_internal(
  _workspace_id uuid, _project_id uuid, _actor uuid, _action text, _metadata jsonb
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.project_activity (workspace_id, project_id, actor_user_id, action, metadata)
  VALUES (_workspace_id, _project_id, _actor, _action, COALESCE(_metadata, '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.log_project_activity_internal(uuid,uuid,uuid,text,jsonb) FROM PUBLIC;

-- Project events
CREATE OR REPLACE FUNCTION public.log_project_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_project_activity_internal(
      NEW.workspace_id, NEW.id, auth.uid(), 'project.created',
      jsonb_build_object('name', NEW.name, 'status', NEW.status::text));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status <> OLD.status THEN
      PERFORM public.log_project_activity_internal(
        NEW.workspace_id, NEW.id, auth.uid(), 'project.status_changed',
        jsonb_build_object('from', OLD.status::text, 'to', NEW.status::text));
    END IF;
    IF NEW.name IS DISTINCT FROM OLD.name
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
       OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
       OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
       OR NEW.job_address IS DISTINCT FROM OLD.job_address
       OR NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.expected_completion_date IS DISTINCT FROM OLD.expected_completion_date THEN
      PERFORM public.log_project_activity_internal(
        NEW.workspace_id, NEW.id, auth.uid(), 'project.updated', '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER projects_activity_log AFTER INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_project_events();

-- Project member events
CREATE OR REPLACE FUNCTION public.log_project_member_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_project_activity_internal(
      NEW.workspace_id, NEW.project_id, auth.uid(), 'member.assigned',
      jsonb_build_object('user_id', NEW.user_id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_project_activity_internal(
      OLD.workspace_id, OLD.project_id, auth.uid(), 'member.removed',
      jsonb_build_object('user_id', OLD.user_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER project_members_activity_log AFTER INSERT OR DELETE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.log_project_member_events();

-- Task events
CREATE OR REPLACE FUNCTION public.log_task_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_project_activity_internal(
      NEW.workspace_id, NEW.project_id, auth.uid(), 'task.created',
      jsonb_build_object('task_id', NEW.id, 'title', NEW.title, 'assigned_to', NEW.assigned_to));
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM public.log_project_activity_internal(
        NEW.workspace_id, NEW.project_id, auth.uid(), 'task.assigned',
        jsonb_build_object('task_id', NEW.id, 'title', NEW.title, 'assigned_to', NEW.assigned_to));
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      PERFORM public.log_project_activity_internal(
        NEW.workspace_id, NEW.project_id, auth.uid(), 'task.assigned',
        jsonb_build_object('task_id', NEW.id, 'title', NEW.title,
                           'assigned_to', NEW.assigned_to, 'previous', OLD.assigned_to));
    END IF;
    IF NEW.status <> OLD.status THEN
      PERFORM public.log_project_activity_internal(
        NEW.workspace_id, NEW.project_id, auth.uid(),
        CASE WHEN NEW.status = 'completed' THEN 'task.completed' ELSE 'task.status_changed' END,
        jsonb_build_object('task_id', NEW.id, 'title', NEW.title,
                           'from', OLD.status::text, 'to', NEW.status::text));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER project_tasks_activity_log AFTER INSERT OR UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_events();

-- Note events
CREATE OR REPLACE FUNCTION public.log_note_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_project_activity_internal(
      NEW.workspace_id, NEW.project_id, auth.uid(), 'note.added',
      jsonb_build_object('note_id', NEW.id));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.log_project_activity_internal(
      NEW.workspace_id, NEW.project_id, auth.uid(), 'note.edited',
      jsonb_build_object('note_id', NEW.id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_project_activity_internal(
      OLD.workspace_id, OLD.project_id, auth.uid(), 'note.deleted',
      jsonb_build_object('note_id', OLD.id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER project_notes_activity_log AFTER INSERT OR UPDATE OR DELETE ON public.project_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_note_events();
