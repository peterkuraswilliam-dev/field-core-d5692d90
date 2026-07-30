CREATE TYPE public.photo_category AS ENUM ('before','during','after','issue','materials','receipt','other');

CREATE TABLE public.project_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  category public.photo_category NOT NULL DEFAULT 'other',
  caption text,
  uploaded_by uuid NOT NULL,
  taken_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_photos_project ON public.project_photos(project_id, created_at DESC);
CREATE INDEX idx_project_photos_workspace ON public.project_photos(workspace_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_photos TO authenticated;
GRANT ALL ON public.project_photos TO service_role;

ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View photos in accessible projects" ON public.project_photos
  FOR SELECT TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "Members upload photos" ON public.project_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_view_project(project_id, auth.uid())
    AND uploaded_by = auth.uid()
    AND public.workspace_role_of(workspace_id, auth.uid()) = ANY (ARRAY['owner','admin','project_manager','field_worker','contractor'])
  );

CREATE POLICY "Uploader or manager edits photos" ON public.project_photos
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.can_manage_project(project_id, auth.uid()))
  WITH CHECK (uploaded_by = auth.uid() OR public.can_manage_project(project_id, auth.uid()));

CREATE POLICY "Uploader or manager deletes photos" ON public.project_photos
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.can_manage_project(project_id, auth.uid()));

-- keep workspace_id server-side truthful
CREATE OR REPLACE FUNCTION public.project_photo_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ws uuid;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.projects WHERE id = NEW.project_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;
  NEW.workspace_id := v_ws;
  IF TG_OP = 'UPDATE' THEN
    NEW.uploaded_by := OLD.uploaded_by;
    NEW.storage_path := OLD.storage_path;
    NEW.project_id := OLD.project_id;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_project_photo_before_write
BEFORE INSERT OR UPDATE ON public.project_photos
FOR EACH ROW EXECUTE FUNCTION public.project_photo_before_write();

CREATE OR REPLACE FUNCTION public.log_photo_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_project_activity_internal(
      NEW.workspace_id, NEW.project_id, auth.uid(), 'photo.uploaded',
      jsonb_build_object('photo_id', NEW.id, 'category', NEW.category::text, 'count', 1));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.caption IS DISTINCT FROM OLD.caption THEN
      PERFORM public.log_project_activity_internal(
        NEW.workspace_id, NEW.project_id, auth.uid(), 'photo.caption_updated',
        jsonb_build_object('photo_id', NEW.id, 'category', NEW.category::text));
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.log_project_activity_internal(
      OLD.workspace_id, OLD.project_id, auth.uid(), 'photo.deleted',
      jsonb_build_object('photo_id', OLD.id, 'category', OLD.category::text));
    RETURN OLD;
  END IF;
END; $$;

CREATE TRIGGER trg_log_photo_events
AFTER INSERT OR UPDATE OR DELETE ON public.project_photos
FOR EACH ROW EXECUTE FUNCTION public.log_photo_events();

REVOKE EXECUTE ON FUNCTION public.project_photo_before_write() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_photo_events() FROM public, anon, authenticated;