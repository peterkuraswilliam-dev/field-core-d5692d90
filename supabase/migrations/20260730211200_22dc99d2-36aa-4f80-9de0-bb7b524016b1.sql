CREATE TABLE public.project_progress_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 1 AND 2000),
  issues text CHECK (issues IS NULL OR length(issues) <= 2000),
  work_date date NOT NULL DEFAULT current_date,
  created_by uuid NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  lock_logged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_progress_update_photos (
  update_id uuid NOT NULL REFERENCES public.project_progress_updates(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES public.project_photos(id) ON DELETE RESTRICT,
  PRIMARY KEY (update_id, photo_id)
);

CREATE TABLE public.project_progress_update_tasks (
  update_id uuid NOT NULL REFERENCES public.project_progress_updates(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.project_tasks(id) ON DELETE RESTRICT,
  PRIMARY KEY (update_id, task_id)
);

CREATE TABLE public.project_progress_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id uuid NOT NULL REFERENCES public.project_progress_updates(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (length(trim(note)) BETWEEN 1 AND 2000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX progress_updates_project_date_idx
  ON public.project_progress_updates(project_id, work_date DESC, created_at DESC);

CREATE INDEX progress_updates_workspace_created_idx
  ON public.project_progress_updates(workspace_id, created_at DESC);

CREATE INDEX progress_corrections_update_idx
  ON public.project_progress_corrections(update_id, created_at);

GRANT SELECT ON
  public.project_progress_updates,
  public.project_progress_update_photos,
  public.project_progress_update_tasks,
  public.project_progress_corrections
TO authenticated;

GRANT ALL ON
  public.project_progress_updates,
  public.project_progress_update_photos,
  public.project_progress_update_tasks,
  public.project_progress_corrections
TO service_role;

ALTER TABLE public.project_progress_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_progress_update_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_progress_update_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_progress_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View accessible progress updates"
  ON public.project_progress_updates
  FOR SELECT
  TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "View accessible progress photos"
  ON public.project_progress_update_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_progress_updates u
      WHERE u.id = update_id
        AND public.can_view_project(u.project_id, auth.uid())
    )
  );

CREATE POLICY "View accessible progress tasks"
  ON public.project_progress_update_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_progress_updates u
      WHERE u.id = update_id
        AND public.can_view_project(u.project_id, auth.uid())
    )
  );

CREATE POLICY "View accessible progress corrections"
  ON public.project_progress_corrections
  FOR SELECT
  TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.can_submit_progress_update(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspace_members wm
      ON wm.workspace_id = p.workspace_id
     AND wm.user_id = _user_id
     AND wm.status = 'active'
    WHERE p.id = _project_id
      AND wm.role IN ('owner','admin','project_manager','field_worker','contractor')
      AND (
        wm.role IN ('owner','admin')
        OR public.is_assigned_to_project(p.id, _user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.submit_progress_update(
  _project_id uuid,
  _summary text,
  _issues text DEFAULT NULL,
  _work_date date DEFAULT current_date,
  _photo_ids uuid[] DEFAULT '{}'::uuid[],
  _task_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_workspace uuid;
  v_update uuid;
  v_photo uuid;
  v_task uuid;
  v_task_title text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF length(trim(coalesce(_summary, ''))) = 0 THEN
    RAISE EXCEPTION 'Progress summary is required';
  END IF;

  IF length(_summary) > 2000 OR length(coalesce(_issues, '')) > 2000 THEN
    RAISE EXCEPTION 'Progress text is too long';
  END IF;

  IF _work_date > current_date + 1 THEN
    RAISE EXCEPTION 'Work date cannot be in the future';
  END IF;

  SELECT workspace_id INTO v_workspace FROM public.projects WHERE id = _project_id;

  IF v_workspace IS NULL OR NOT public.can_submit_progress_update(_project_id, v_actor) THEN
    RAISE EXCEPTION 'You cannot submit an update for this project';
  END IF;

  INSERT INTO public.project_progress_updates (
    workspace_id, project_id, summary, issues, work_date, created_by
  ) VALUES (
    v_workspace,
    _project_id,
    trim(_summary),
    nullif(trim(coalesce(_issues, '')), ''),
    _work_date,
    v_actor
  ) RETURNING id INTO v_update;

  FOREACH v_photo IN ARRAY coalesce(_photo_ids, '{}'::uuid[])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.project_photos
      WHERE id = v_photo AND project_id = _project_id AND workspace_id = v_workspace
    ) THEN
      RAISE EXCEPTION 'A linked photo does not belong to this project';
    END IF;

    INSERT INTO public.project_progress_update_photos (update_id, photo_id)
    VALUES (v_update, v_photo)
    ON CONFLICT DO NOTHING;
  END LOOP;

  FOREACH v_task IN ARRAY coalesce(_task_ids, '{}'::uuid[])
  LOOP
    v_task_title := NULL;

    SELECT title INTO v_task_title
    FROM public.project_tasks
    WHERE id = v_task AND project_id = _project_id AND workspace_id = v_workspace
    FOR UPDATE;

    IF v_task_title IS NULL THEN
      RAISE EXCEPTION 'A selected task does not belong to this project';
    END IF;

    IF NOT public.can_update_task(v_task, v_actor) THEN
      RAISE EXCEPTION 'You cannot complete one of the selected tasks';
    END IF;

    UPDATE public.project_tasks
    SET status = 'completed', completed_by = v_actor, completed_at = now()
    WHERE id = v_task;

    INSERT INTO public.project_progress_update_tasks (update_id, task_id)
    VALUES (v_update, v_task)
    ON CONFLICT DO NOTHING;

    PERFORM public.log_project_activity_internal(
      v_workspace, _project_id, v_actor, 'progress.task_completed',
      jsonb_build_object('update_id', v_update, 'task_id', v_task, 'title', v_task_title)
    );
  END LOOP;

  PERFORM public.log_project_activity_internal(
    v_workspace, _project_id, v_actor, 'progress.submitted',
    jsonb_build_object(
      'update_id', v_update,
      'work_date', _work_date,
      'photo_count', cardinality(coalesce(_photo_ids, '{}'::uuid[])),
      'task_count', cardinality(coalesce(_task_ids, '{}'::uuid[]))
    )
  );

  IF cardinality(coalesce(_photo_ids, '{}'::uuid[])) > 0 THEN
    PERFORM public.log_project_activity_internal(
      v_workspace, _project_id, v_actor, 'progress.photos_linked',
      jsonb_build_object('update_id', v_update, 'count', cardinality(_photo_ids))
    );
  END IF;

  RETURN v_update;
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_progress_update(
  _update_id uuid,
  _summary text,
  _issues text DEFAULT NULL,
  _work_date date DEFAULT current_date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_update public.project_progress_updates%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_update
  FROM public.project_progress_updates
  WHERE id = _update_id
  FOR UPDATE;

  IF v_update.id IS NULL THEN
    RAISE EXCEPTION 'Progress update not found';
  END IF;

  IF now() >= v_update.locked_at THEN
    RAISE EXCEPTION 'This progress update is locked';
  END IF;

  IF v_update.created_by <> v_actor
     AND NOT public.can_manage_project(v_update.project_id, v_actor) THEN
    RAISE EXCEPTION 'You cannot edit this progress update';
  END IF;

  IF length(trim(coalesce(_summary, ''))) = 0 THEN
    RAISE EXCEPTION 'Progress summary is required';
  END IF;

  IF length(_summary) > 2000 OR length(coalesce(_issues, '')) > 2000 THEN
    RAISE EXCEPTION 'Progress text is too long';
  END IF;

  IF _work_date > current_date + 1 THEN
    RAISE EXCEPTION 'Work date cannot be in the future';
  END IF;

  UPDATE public.project_progress_updates
  SET summary = trim(_summary),
      issues = nullif(trim(coalesce(_issues, '')), ''),
      work_date = _work_date,
      updated_at = now()
  WHERE id = _update_id;

  PERFORM public.log_project_activity_internal(
    v_update.workspace_id, v_update.project_id, v_actor, 'progress.edited',
    jsonb_build_object('update_id', _update_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_progress_correction(_update_id uuid, _note text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_update public.project_progress_updates%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_update FROM public.project_progress_updates WHERE id = _update_id;

  IF v_update.id IS NULL THEN
    RAISE EXCEPTION 'Progress update not found';
  END IF;

  IF NOT public.can_manage_project(v_update.project_id, v_actor) THEN
    RAISE EXCEPTION 'Only an authorised project manager can add corrections';
  END IF;

  IF length(trim(coalesce(_note, ''))) = 0 THEN
    RAISE EXCEPTION 'Correction note is required';
  END IF;

  IF length(_note) > 2000 THEN
    RAISE EXCEPTION 'Correction note is too long';
  END IF;

  INSERT INTO public.project_progress_corrections (
    update_id, workspace_id, project_id, note, created_by
  ) VALUES (
    _update_id, v_update.workspace_id, v_update.project_id, trim(_note), v_actor
  ) RETURNING id INTO v_id;

  PERFORM public.log_project_activity_internal(
    v_update.workspace_id, v_update.project_id, v_actor, 'progress.correction_added',
    jsonb_build_object('update_id', _update_id, 'correction_id', v_id)
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_progress_update_locks(_project_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.project_progress_updates%ROWTYPE;
  v_count integer := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  FOR v_row IN
    SELECT *
    FROM public.project_progress_updates
    WHERE locked_at <= now()
      AND lock_logged_at IS NULL
      AND (_project_id IS NULL OR project_id = _project_id)
      AND public.can_view_project(project_id, v_actor)
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.project_progress_updates
    SET lock_logged_at = now()
    WHERE id = v_row.id;

    PERFORM public.log_project_activity_internal(
      v_row.workspace_id, v_row.project_id, NULL, 'progress.locked',
      jsonb_build_object('update_id', v_row.id, 'locked_at', v_row.locked_at)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.can_submit_progress_update(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_progress_update(uuid, text, text, date, uuid[], uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.edit_progress_update(uuid, text, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_progress_correction(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_progress_update_locks(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_submit_progress_update(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_progress_update(uuid, text, text, date, uuid[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_progress_update(uuid, text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_progress_correction(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_progress_update_locks(uuid) TO authenticated;