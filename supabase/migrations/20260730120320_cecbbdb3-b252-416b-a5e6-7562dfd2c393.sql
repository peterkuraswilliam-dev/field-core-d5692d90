-- helper: extract project id (2nd path segment) and check access
CREATE OR REPLACE FUNCTION public.photo_path_project(_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v uuid;
BEGIN
  BEGIN
    v := (string_to_array(_name, '/'))[2]::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN v;
END; $$;

CREATE POLICY "Project photos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-photos'
    AND public.can_view_project(public.photo_path_project(name), auth.uid())
  );

CREATE POLICY "Project photos insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-photos'
    AND owner = auth.uid()
    AND public.can_view_project(public.photo_path_project(name), auth.uid())
    AND public.workspace_role_of(
          (SELECT p.workspace_id FROM public.projects p WHERE p.id = public.photo_path_project(name)),
          auth.uid()
        ) = ANY (ARRAY['owner','admin','project_manager','field_worker','contractor'])
  );

CREATE POLICY "Project photos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-photos'
    AND (owner = auth.uid() OR public.can_manage_project(public.photo_path_project(name), auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'project-photos'
    AND (owner = auth.uid() OR public.can_manage_project(public.photo_path_project(name), auth.uid()))
  );

CREATE POLICY "Project photos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-photos'
    AND (owner = auth.uid() OR public.can_manage_project(public.photo_path_project(name), auth.uid()))
  );