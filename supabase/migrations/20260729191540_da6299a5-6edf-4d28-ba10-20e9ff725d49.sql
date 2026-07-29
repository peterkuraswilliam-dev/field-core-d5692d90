
-- Status enum
CREATE TYPE public.project_status AS ENUM (
  'enquiry','quote_required','quote_sent','approved','scheduled',
  'in_progress','waiting','completed','cancelled'
);

-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  customer_name text,
  customer_email text,
  customer_phone text,
  job_address text,
  description text,
  status public.project_status NOT NULL DEFAULT 'enquiry',
  start_date date,
  expected_completion_date date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_workspace_idx ON public.projects(workspace_id);
CREATE INDEX projects_status_idx ON public.projects(workspace_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

-- Project members
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX project_members_project_idx ON public.project_members(project_id);
CREATE INDEX project_members_user_idx ON public.project_members(user_id, workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;

-- Trigger: keep workspace_id consistent with project
CREATE OR REPLACE FUNCTION public.project_member_set_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ws uuid;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.projects WHERE id = NEW.project_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;
  NEW.workspace_id := v_ws;

  -- Assignee must be an active workspace member
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_ws AND user_id = NEW.user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Assignee is not an active workspace member';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER project_member_before_insert
BEFORE INSERT ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.project_member_set_workspace();

-- updated_at trigger on projects
CREATE TRIGGER projects_set_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Access helpers (SECURITY DEFINER to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.has_workspace_project_access(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
      AND status = 'active'
      AND role IN ('owner','admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_create_project(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
      AND status = 'active'
      AND role IN ('owner','admin','project_manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.workspace_members wm
      ON wm.workspace_id = p.workspace_id
     AND wm.user_id = _user_id
     AND wm.status = 'active'
    WHERE p.id = _project_id
      AND (
        wm.role IN ('owner','admin')
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = _project_id AND pm.user_id = _user_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.workspace_members wm
      ON wm.workspace_id = p.workspace_id
     AND wm.user_id = _user_id
     AND wm.status = 'active'
    WHERE p.id = _project_id
      AND (
        wm.role IN ('owner','admin')
        OR (
          wm.role = 'project_manager' AND EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = _project_id AND pm.user_id = _user_id
          )
        )
      )
  );
$$;

-- RLS: projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view accessible projects"
  ON public.projects FOR SELECT TO authenticated
  USING (
    is_active_workspace_member(workspace_id, auth.uid())
    AND (
      has_workspace_project_access(workspace_id, auth.uid())
      OR is_assigned_to_project(id, auth.uid())
    )
  );

CREATE POLICY "Authorised members create projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    can_create_project(workspace_id, auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Managers update their projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (can_manage_project(id, auth.uid()))
  WITH CHECK (can_manage_project(id, auth.uid()));

CREATE POLICY "Owners and admins delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (has_workspace_project_access(workspace_id, auth.uid()));

-- RLS: project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View team of accessible project"
  ON public.project_members FOR SELECT TO authenticated
  USING (can_view_project(project_id, auth.uid()));

CREATE POLICY "Managers assign team"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    can_manage_project(project_id, auth.uid())
    AND assigned_by = auth.uid()
  );

CREATE POLICY "Managers remove team"
  ON public.project_members FOR DELETE TO authenticated
  USING (can_manage_project(project_id, auth.uid()));

-- Bulk assignment RPC
CREATE OR REPLACE FUNCTION public.set_project_members(_project_id uuid, _user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_ws uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_manage_project(_project_id, v_actor) THEN
    RAISE EXCEPTION 'Not authorised to manage this project';
  END IF;
  SELECT workspace_id INTO v_ws FROM public.projects WHERE id = _project_id;

  -- Validate all provided users are active workspace members
  IF _user_ids IS NOT NULL AND array_length(_user_ids, 1) IS NOT NULL THEN
    IF (
      SELECT count(*) FROM unnest(_user_ids) u(uid)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = v_ws AND wm.user_id = u.uid AND wm.status = 'active'
      )
    ) > 0 THEN
      RAISE EXCEPTION 'One or more assignees are not active workspace members';
    END IF;
  END IF;

  DELETE FROM public.project_members
   WHERE project_id = _project_id
     AND (_user_ids IS NULL OR NOT (user_id = ANY(_user_ids)));

  IF _user_ids IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, workspace_id, user_id, assigned_by)
    SELECT _project_id, v_ws, u.uid, v_actor
      FROM unnest(_user_ids) u(uid)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_members(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.set_project_members(uuid, uuid[]) TO authenticated;
