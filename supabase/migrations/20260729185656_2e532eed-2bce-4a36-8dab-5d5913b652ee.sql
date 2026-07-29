
-- Workspace role enum
CREATE TYPE public.workspace_role AS ENUM ('owner','admin','project_manager','contractor','viewer');
CREATE TYPE public.membership_status AS ENUM ('active','suspended','removed');

-- ============ workspaces ============
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_email text,
  phone text,
  business_type text,
  country text NOT NULL DEFAULT 'United Kingdom',
  timezone text NOT NULL DEFAULT 'Europe/London',
  logo_url text,
  onboarding_completed boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- ============ workspace_members ============
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'viewer',
  status public.membership_status NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX workspace_members_user_idx ON public.workspace_members(user_id);
CREATE INDEX workspace_members_ws_idx ON public.workspace_members(workspace_id);

-- ============ Security definer helpers (avoid RLS recursion) ============
CREATE OR REPLACE FUNCTION public.is_active_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND role = 'owner'
      AND status = 'active'
  );
$$;

-- ============ RLS: workspaces ============
CREATE POLICY "Members view their workspaces"
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_active_workspace_member(id, auth.uid()));

CREATE POLICY "Owner updates workspace"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (public.is_workspace_owner(id, auth.uid()))
  WITH CHECK (public.is_workspace_owner(id, auth.uid()));

-- No INSERT/DELETE policies -> blocked from client. Use RPC below.

-- ============ RLS: workspace_members ============
CREATE POLICY "Members view fellow members"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_active_workspace_member(workspace_id, auth.uid()));

-- No INSERT/UPDATE/DELETE policies from client. Owner mutations go through RPCs (future stage).

-- ============ Prevent tampering: block self-role/status escalation via trigger ============
CREATE OR REPLACE FUNCTION public.protect_workspace_member_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Never allow demoting/removing the owner
  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' THEN
    IF NEW.role <> 'owner' OR NEW.status <> 'active' THEN
      RAISE EXCEPTION 'The workspace owner cannot be demoted or deactivated';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    RAISE EXCEPTION 'The workspace owner cannot be removed';
  END IF;

  -- When a signed-in user is editing their own membership, they cannot change role or status
  IF auth.uid() IS NOT NULL AND TG_OP = 'UPDATE' AND OLD.user_id = auth.uid() THEN
    IF NEW.role <> OLD.role OR NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'You cannot change your own workspace role or status';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_protect_workspace_member_fields
BEFORE UPDATE OR DELETE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.protect_workspace_member_fields();

-- ============ Updated-at triggers ============
CREATE TRIGGER trg_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_workspace_members_updated_at
BEFORE UPDATE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RPC: create workspace + owner atomically ============
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  _name text,
  _business_email text,
  _phone text,
  _business_type text,
  _country text,
  _timezone text,
  _logo_url text,
  _owner_full_name text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_workspace uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _name IS NULL OR length(trim(_name)) < 2 THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  INSERT INTO public.workspaces (
    name, business_email, phone, business_type,
    country, timezone, logo_url, created_by
  ) VALUES (
    trim(_name),
    NULLIF(trim(_business_email), ''),
    NULLIF(trim(_phone), ''),
    NULLIF(trim(_business_type), ''),
    COALESCE(NULLIF(trim(_country), ''), 'United Kingdom'),
    COALESCE(NULLIF(trim(_timezone), ''), 'Europe/London'),
    NULLIF(trim(_logo_url), ''),
    v_user
  ) RETURNING id INTO v_workspace;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (v_workspace, v_user, 'owner', 'active');

  -- Update profile full name if provided and profile exists
  IF _owner_full_name IS NOT NULL AND length(trim(_owner_full_name)) > 0 THEN
    UPDATE public.profiles
    SET full_name = trim(_owner_full_name)
    WHERE id = v_user;
  END IF;

  RETURN v_workspace;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_workspace_with_owner(text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text,text,text,text,text,text,text,text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.protect_workspace_member_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_workspace_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_workspace_member(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) TO authenticated;
