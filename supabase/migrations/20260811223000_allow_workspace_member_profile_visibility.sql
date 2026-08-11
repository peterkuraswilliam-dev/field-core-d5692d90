-- Team and project assignment screens need names and emails for people in the
-- same workspace. Keep the RLS decision in a SECURITY DEFINER helper to avoid
-- recursive workspace_members policy evaluation.
CREATE OR REPLACE FUNCTION public.can_view_workspace_profile(
  _profile_user_id uuid,
  _viewer_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members viewer
    JOIN public.workspace_members profile_member
      ON profile_member.workspace_id = viewer.workspace_id
    WHERE viewer.user_id = _viewer_user_id
      AND viewer.status = 'active'
      AND profile_member.user_id = _profile_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_workspace_profile(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_view_workspace_profile(uuid, uuid) TO authenticated;

CREATE POLICY "Workspace members view teammate profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.can_view_workspace_profile(id, auth.uid()));
