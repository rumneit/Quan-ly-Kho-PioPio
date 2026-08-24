import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "manager" | "sales";
export type Profile = {
  id: string;
  username: string;
  full_name: string;
  role: AppRole;
  active: boolean;
  store_id: string;
};

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@auth.khopiopio.app`;
}

export async function requireProfile(requiredRole?: AppRole) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id,username,full_name,role,active,store_id").eq("id", user.id).single();
  if (!profile?.active) redirect("/login?error=inactive");
  if (requiredRole && profile.role !== requiredRole) redirect("/dashboard");
  return { supabase, user, profile: profile as Profile };
}
