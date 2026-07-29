import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "user";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AuthAccess =
  | { status: "anonymous" }
  | { status: "inactive"; user: User; profile: Profile }
  | { status: "profile-error"; user: User; message: string }
  | { status: "authenticated"; user: User; profile: Profile };

export async function getAuthAccess(): Promise<AuthAccess> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { status: "anonymous" };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, is_active, created_at, updated_at")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      status: "profile-error",
      user: userData.user,
      message: error?.message ?? "Your secure profile could not be loaded.",
    };
  }

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  if (rolesError) {
    return {
      status: "profile-error",
      user: userData.user,
      message: rolesError.message,
    };
  }

  const role: AppRole = roles?.some(({ role }) => role === "admin") ? "admin" : "user";
  const profile = { ...data, role } as Profile;
  if (!profile.is_active) return { status: "inactive", user: userData.user, profile };
  return { status: "authenticated", user: userData.user, profile };
}

export function authErrorMessage(error: { message: string } | null): string {
  if (!error) return "";
  if (/invalid login credentials/i.test(error.message)) return "Invalid email or password.";
  if (/already registered|already been registered|user already exists/i.test(error.message)) {
    return "That email is already registered.";
  }
  if (/fetch|network|connection/i.test(error.message)) {
    return "Network error. Check your connection and try again.";
  }
  return error.message;
}
