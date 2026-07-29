
REVOKE ALL ON FUNCTION public.has_workspace_project_access(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.can_create_project(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.is_assigned_to_project(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.can_view_project(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.can_manage_project(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.project_member_set_workspace() FROM public;
GRANT EXECUTE ON FUNCTION public.has_workspace_project_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) TO authenticated;
