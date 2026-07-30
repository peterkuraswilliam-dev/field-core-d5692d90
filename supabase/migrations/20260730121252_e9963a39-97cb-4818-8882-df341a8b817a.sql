-- 1. Fix mutable search_path on the last remaining function
ALTER FUNCTION public.can_manage_workspace_role(text, text) SET search_path = public;

-- 2. Revoke blanket EXECUTE on every function in the public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- 3. Grant back only what the app needs

-- Invited person must be able to preview the invitation before signing in
GRANT EXECUTE ON FUNCTION public.preview_workspace_invitation(text) TO anon, authenticated;

-- RPCs the signed-in app calls directly
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_workspace_member(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_workspace_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_workspace_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_workspace_member_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_workspace_member_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_project_members(uuid, uuid[]) TO authenticated;

-- Helper predicates referenced by RLS policies (evaluated as the calling role)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace_role(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_project_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_update_task(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.photo_path_project(text) TO authenticated;