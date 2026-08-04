-- Allow the workspace invitation functions to resolve pgcrypto's digest()
-- and gen_random_bytes() functions, which Supabase installs in extensions.
-- Keep public first so existing references retain their current resolution.
ALTER FUNCTION public.invite_workspace_member(uuid, text, text, text)
  SET search_path = public, extensions;

ALTER FUNCTION public.resend_workspace_invitation(uuid)
  SET search_path = public, extensions;

ALTER FUNCTION public.preview_workspace_invitation(text)
  SET search_path = public, extensions;

ALTER FUNCTION public.accept_workspace_invitation(text)
  SET search_path = public, extensions;
