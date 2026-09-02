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
  if (requiredRole === "manager" && profile.role !== "manager") redirect("/sales");
  if (requiredRole === "sales" && profile.role !== "sales") redirect("/dashboard");
  return { supabase, user, profile: profile as Profile };
}

export async function requireApiProfile(requiredRole?: AppRole) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("id,username,full_name,role,active,store_id").eq("id", user.id).single();
  if (!profile?.active) return { error: "Tài khoản đã bị vô hiệu hóa" as const, status: 403 as const };
  if (requiredRole === "manager" && profile.role !== "manager") return { error: "Forbidden" as const, status: 403 as const };
  if (requiredRole === "sales" && profile.role !== "sales") return { error: "Forbidden" as const, status: 403 as const };
  return { supabase, user, profile: profile as Profile };
}
