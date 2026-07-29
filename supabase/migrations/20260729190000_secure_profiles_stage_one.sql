-- Stage 1 profile authorization. The profiles table is the source of truth for
-- account status and the role shown by the application.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_stage_one_roles;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_stage_one_roles CHECK (role IN ('admin', 'user'));

-- Authenticated clients do not need to create or delete profiles. Creation is
-- handled by the auth.users trigger below.
REVOKE INSERT, DELETE ON public.profiles FROM authenticated;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Browser-originated updates may only change display fields.
  IF auth.uid() IS NOT NULL THEN
    NEW.id := OLD.id;
    NEW.email := OLD.email;
    NEW.role := OLD.role;
    NEW.is_active := OLD.is_active;
    NEW.created_at := OLD.created_at;
  END IF;

  -- The primary administrator assignment is enforced in trusted database code.
  IF lower(COALESCE(NEW.email, '')) = 'peterkuraswilliam@gmail.com' THEN
    NEW.role := 'admin';
  ELSIF NEW.role = 'admin' AND OLD.role <> 'admin' THEN
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_security_fields ON public.profiles;
CREATE TRIGGER protect_profile_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, email, avatar_url, role, is_active
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    CASE
      WHEN lower(COALESCE(NEW.email, '')) = 'peterkuraswilliam@gmail.com'
        THEN 'admin'::public.app_role
      ELSE 'user'::public.app_role
    END,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    email = EXCLUDED.email,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    role = CASE
      WHEN lower(COALESCE(EXCLUDED.email, '')) = 'peterkuraswilliam@gmail.com'
        THEN 'admin'::public.app_role
      ELSE profiles.role
    END;
  RETURN NEW;
END;
$$;

-- Keep trusted email ownership and the primary-admin assignment in sync when
-- Supabase Auth changes a user's email or provider metadata.
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,
    full_name = COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      full_name
    ),
    avatar_url = COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      avatar_url
    ),
    role = CASE
      WHEN lower(COALESCE(NEW.email, '')) = 'peterkuraswilliam@gmail.com'
        THEN 'admin'::public.app_role
      WHEN lower(COALESCE(OLD.email, '')) = 'peterkuraswilliam@gmail.com'
        THEN 'user'::public.app_role
      ELSE role
    END
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_from_auth_user ON auth.users;
CREATE TRIGGER sync_profile_from_auth_user
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_auth_user();

-- Safe backfill, including the required existing administrator account.
UPDATE public.profiles p
SET
  email = u.email,
  role = CASE
    WHEN lower(COALESCE(u.email, '')) = 'peterkuraswilliam@gmail.com'
      THEN 'admin'::public.app_role
    ELSE COALESCE(p.role, 'user'::public.app_role)
  END,
  is_active = COALESCE(p.is_active, true)
FROM auth.users u
WHERE p.id = u.id;

REVOKE EXECUTE ON FUNCTION public.protect_profile_security_fields()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_from_auth_user()
  FROM PUBLIC, anon, authenticated;

