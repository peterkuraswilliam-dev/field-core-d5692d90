CREATE OR REPLACE FUNCTION public.photo_path_project(_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  BEGIN
    v := (string_to_array(_name, '/'))[2]::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN v;
END; $$;

REVOKE EXECUTE ON FUNCTION public.photo_path_project(text) FROM public, anon;