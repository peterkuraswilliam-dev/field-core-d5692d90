-- Ensure project managers can finish creating a project without temporarily
-- broadening project visibility. The creator becomes a project member in the
-- same transaction as the project insert.
CREATE OR REPLACE FUNCTION public.assign_project_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, workspace_id, user_id, assigned_by)
  VALUES (NEW.id, NEW.workspace_id, NEW.created_by, NEW.created_by)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_project_creator() FROM public;

DROP TRIGGER IF EXISTS project_assign_creator_after_insert ON public.projects;
CREATE TRIGGER project_assign_creator_after_insert
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.assign_project_creator();

-- Active members can already see fellow members. This additional policy lets
-- an authenticated user read only their own suspended or removed membership,
-- so the application can route them to the blocked screen instead of onboarding.
CREATE POLICY "Users view own membership status"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());
