import { supabase } from "@/integrations/supabase/client";

export async function isCurrentUserAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .eq("role", "admin")
    .eq("is_active", true)
    .maybeSingle();
  if (error) return false;
  return !!data;
}
