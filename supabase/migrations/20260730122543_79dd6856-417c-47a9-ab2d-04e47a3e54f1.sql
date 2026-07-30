CREATE OR REPLACE FUNCTION public.photo_path_workspace(_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE v uuid;
BEGIN
  BEGIN
    v := (string_to_array(_name, '/'))[1]::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN v;
END; $$;

REVOKE ALL ON FUNCTION public.photo_path_workspace(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.photo_path_workspace(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.photo_path_project(text) TO authenticated;

DROP POLICY IF EXISTS "Project photos insert" ON storage.objects;
CREATE POLICY "Project photos insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-photos'
  AND owner = auth.uid()
  AND public.can_view_project(public.photo_path_project(name), auth.uid())
  AND public.workspace_role_of(public.photo_path_workspace(name), auth.uid())
      = ANY (ARRAY['owner','admin','project_manager','field_worker','contractor'])
);