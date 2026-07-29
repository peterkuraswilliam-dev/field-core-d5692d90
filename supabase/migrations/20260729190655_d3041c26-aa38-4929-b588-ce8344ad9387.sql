
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add field_worker to workspace_role enum
ALTER TYPE public.workspace_role ADD VALUE IF NOT EXISTS 'field_worker';

-- Invitation status enum
DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================
-- workspace_invitations
-- =====================
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.workspace_role NOT NULL,
  message text,
  token_hash text NOT NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  accepted_by uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitations_token_hash_key
  ON public.workspace_invitations(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitations_pending_unique
  ON public.workspace_invitations(workspace_id, lower(email))
  WHERE status = 'pending';

GRANT SELECT ON public.workspace_invitations TO authenticated;
GRANT ALL ON public.workspace_invitations TO service_role;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER workspace_invitations_updated_at
  BEFORE UPDATE ON public.workspace_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- workspace_audit_log
-- =====================
CREATE TABLE IF NOT EXISTS public.workspace_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  target_user_id uuid,
  target_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workspace_audit_log_ws_idx
  ON public.workspace_audit_log(workspace_id, created_at DESC);

GRANT SELECT ON public.workspace_audit_log TO authenticated;
GRANT ALL ON public.workspace_audit_log TO service_role;
ALTER TABLE public.workspace_audit_log ENABLE ROW LEVEL SECURITY;

-- =====================
-- Helper: workspace role of user
-- =====================
CREATE OR REPLACE FUNCTION public.workspace_role_of(_workspace_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.workspace_members
  WHERE workspace_id = _workspace_id
    AND user_id = _user_id
    AND status = 'active'
  LIMIT 1;
$$;

-- Actor can manage target role?
CREATE OR REPLACE FUNCTION public.can_manage_workspace_role(_actor text, _target text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _actor = 'owner' THEN _target <> 'owner'
    WHEN _actor = 'admin' THEN _target IN ('project_manager','field_worker','contractor','viewer')
    ELSE false
  END;
$$;

-- =====================
-- RLS policies
-- =====================
DROP POLICY IF EXISTS "Owner/admin view invitations" ON public.workspace_invitations;
CREATE POLICY "Owner/admin view invitations"
  ON public.workspace_invitations FOR SELECT
  TO authenticated
  USING (
    public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
  );

DROP POLICY IF EXISTS "Owner/admin view audit log" ON public.workspace_audit_log;
CREATE POLICY "Owner/admin view audit log"
  ON public.workspace_audit_log FOR SELECT
  TO authenticated
  USING (
    public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
  );

-- =====================
-- Invite member
-- =====================
CREATE OR REPLACE FUNCTION public.invite_workspace_member(
  _workspace_id uuid,
  _email text,
  _role text,
  _message text
) RETURNS TABLE(invitation_id uuid, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_token text;
  v_hash text;
  v_email text := lower(trim(_email));
  v_role public.workspace_role;
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Invalid email'; END IF;
  IF _role = 'owner' THEN RAISE EXCEPTION 'Cannot invite as owner'; END IF;

  v_actor_role := public.workspace_role_of(_workspace_id, v_actor);
  IF v_actor_role IS NULL THEN RAISE EXCEPTION 'Not a member of this workspace'; END IF;
  IF NOT public.can_manage_workspace_role(v_actor_role, _role) THEN
    RAISE EXCEPTION 'You cannot invite members with role %', _role;
  END IF;

  v_role := _role::public.workspace_role;

  -- If already an active/suspended member of this workspace, block
  IF EXISTS (
    SELECT 1 FROM public.workspace_members wm
    JOIN public.profiles p ON p.id = wm.user_id
    WHERE wm.workspace_id = _workspace_id AND lower(p.email) = v_email AND wm.status IN ('active','suspended')
  ) THEN
    RAISE EXCEPTION 'This person is already a member of the workspace';
  END IF;

  -- Cancel any prior pending invite for this email/workspace
  UPDATE public.workspace_invitations
     SET status = 'cancelled', updated_at = now()
   WHERE workspace_id = _workspace_id AND lower(email) = v_email AND status = 'pending';

  v_token := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.workspace_invitations (workspace_id, email, role, message, token_hash, invited_by)
  VALUES (_workspace_id, v_email, v_role, NULLIF(trim(_message),''), v_hash, v_actor)
  RETURNING id INTO v_id;

  INSERT INTO public.workspace_audit_log (workspace_id, actor_user_id, action, target_email, metadata)
  VALUES (_workspace_id, v_actor, 'member.invited', v_email, jsonb_build_object('role', _role));

  invitation_id := v_id;
  token := v_token;
  RETURN NEXT;
END;
$$;

-- Resend (rotate token)
CREATE OR REPLACE FUNCTION public.resend_workspace_invitation(_invitation_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_inv public.workspace_invitations%ROWTYPE;
  v_actor_role text;
  v_token text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_inv FROM public.workspace_invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  v_actor_role := public.workspace_role_of(v_inv.workspace_id, v_actor);
  IF v_actor_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT public.can_manage_workspace_role(v_actor_role, v_inv.role::text) THEN
    RAISE EXCEPTION 'Not authorised for this role';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  UPDATE public.workspace_invitations
     SET token_hash = encode(digest(v_token,'sha256'),'hex'),
         status = 'pending',
         expires_at = now() + interval '14 days',
         updated_at = now()
   WHERE id = _invitation_id;

  INSERT INTO public.workspace_audit_log (workspace_id, actor_user_id, action, target_email, metadata)
  VALUES (v_inv.workspace_id, v_actor, 'invitation.resent', v_inv.email, jsonb_build_object('invitation_id', _invitation_id));

  RETURN v_token;
END;
$$;

-- Cancel
CREATE OR REPLACE FUNCTION public.cancel_workspace_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_inv public.workspace_invitations%ROWTYPE;
  v_actor_role text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_inv FROM public.workspace_invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  v_actor_role := public.workspace_role_of(v_inv.workspace_id, v_actor);
  IF v_actor_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;

  UPDATE public.workspace_invitations SET status = 'cancelled', updated_at = now()
   WHERE id = _invitation_id AND status = 'pending';

  INSERT INTO public.workspace_audit_log (workspace_id, actor_user_id, action, target_email, metadata)
  VALUES (v_inv.workspace_id, v_actor, 'invitation.cancelled', v_inv.email, jsonb_build_object('invitation_id', _invitation_id));
END;
$$;

-- Preview invitation (by token) — for accept page
CREATE OR REPLACE FUNCTION public.preview_workspace_invitation(_token text)
RETURNS TABLE(invitation_id uuid, workspace_id uuid, workspace_name text, email text, role text, status text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hash text := encode(digest(_token,'sha256'),'hex');
BEGIN
  RETURN QUERY
  SELECT i.id, i.workspace_id, w.name, i.email, i.role::text,
    (CASE WHEN i.status = 'pending' AND i.expires_at < now() THEN 'expired' ELSE i.status::text END),
    i.expires_at
  FROM public.workspace_invitations i
  JOIN public.workspaces w ON w.id = i.workspace_id
  WHERE i.token_hash = v_hash;
END;
$$;

-- Accept
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_inv public.workspace_invitations%ROWTYPE;
  v_hash text := encode(digest(_token,'sha256'),'hex');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user;

  SELECT * INTO v_inv FROM public.workspace_invitations WHERE token_hash = v_hash;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation is no longer valid'; END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE public.workspace_invitations SET status = 'expired', updated_at = now() WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;
  IF lower(v_inv.email) <> v_email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (v_inv.workspace_id, v_user, v_inv.role, 'active')
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET status = 'active', role = EXCLUDED.role, updated_at = now();

  UPDATE public.workspace_invitations
     SET status = 'accepted', accepted_by = v_user, accepted_at = now(), updated_at = now()
   WHERE id = v_inv.id;

  INSERT INTO public.workspace_audit_log (workspace_id, actor_user_id, action, target_user_id, target_email, metadata)
  VALUES (v_inv.workspace_id, v_user, 'invitation.accepted', v_user, v_email, jsonb_build_object('invitation_id', v_inv.id, 'role', v_inv.role::text));

  RETURN v_inv.workspace_id;
END;
$$;

-- Ensure workspace_members unique on (workspace_id, user_id) exists for upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_members_workspace_user_unique'
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT workspace_members_workspace_user_unique UNIQUE (workspace_id, user_id);
  END IF;
END $$;

-- Change role
CREATE OR REPLACE FUNCTION public.update_workspace_member_role(_member_id uuid, _new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_member public.workspace_members%ROWTYPE;
  v_actor_role text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _new_role = 'owner' THEN RAISE EXCEPTION 'Cannot assign owner role'; END IF;

  SELECT * INTO v_member FROM public.workspace_members WHERE id = _member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF v_member.user_id = v_actor THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  IF v_member.role = 'owner' THEN RAISE EXCEPTION 'Owner cannot be demoted'; END IF;

  v_actor_role := public.workspace_role_of(v_member.workspace_id, v_actor);
  IF NOT public.can_manage_workspace_role(v_actor_role, v_member.role::text) THEN
    RAISE EXCEPTION 'You cannot manage this member';
  END IF;
  IF NOT public.can_manage_workspace_role(v_actor_role, _new_role) THEN
    RAISE EXCEPTION 'You cannot assign role %', _new_role;
  END IF;

  UPDATE public.workspace_members SET role = _new_role::public.workspace_role, updated_at = now()
   WHERE id = _member_id;

  INSERT INTO public.workspace_audit_log (workspace_id, actor_user_id, action, target_user_id, metadata)
  VALUES (v_member.workspace_id, v_actor, 'member.role_changed', v_member.user_id,
          jsonb_build_object('from', v_member.role::text, 'to', _new_role));
END;
$$;

-- Set status (suspend/reactivate/remove)
CREATE OR REPLACE FUNCTION public.set_workspace_member_status(_member_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_member public.workspace_members%ROWTYPE;
  v_actor_role text;
  v_action text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _status NOT IN ('active','suspended','removed') THEN RAISE EXCEPTION 'Invalid status'; END IF;

  SELECT * INTO v_member FROM public.workspace_members WHERE id = _member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF v_member.user_id = v_actor THEN RAISE EXCEPTION 'You cannot change your own status'; END IF;
  IF v_member.role = 'owner' THEN RAISE EXCEPTION 'Owner status cannot be changed'; END IF;

  v_actor_role := public.workspace_role_of(v_member.workspace_id, v_actor);
  IF NOT public.can_manage_workspace_role(v_actor_role, v_member.role::text) THEN
    RAISE EXCEPTION 'You cannot manage this member';
  END IF;

  UPDATE public.workspace_members SET status = _status::public.membership_status, updated_at = now()
   WHERE id = _member_id;

  v_action := CASE _status
    WHEN 'active' THEN 'member.reactivated'
    WHEN 'suspended' THEN 'member.suspended'
    WHEN 'removed' THEN 'member.removed'
  END;

  INSERT INTO public.workspace_audit_log (workspace_id, actor_user_id, action, target_user_id, metadata)
  VALUES (v_member.workspace_id, v_actor, v_action, v_member.user_id, jsonb_build_object('role', v_member.role::text));
END;
$$;

-- Grants for RPCs
GRANT EXECUTE ON FUNCTION public.invite_workspace_member(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_workspace_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_workspace_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_workspace_invitation(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_workspace_member_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_workspace_member_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace_role(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) FROM PUBLIC;
