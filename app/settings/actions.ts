import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreInfo = { id: string; name: string; createdAt: string };

export async function getStoreInfo(): Promise<StoreInfo> {
  const { requireProfile } = await import("@/lib/auth");
  const { profile } = await requireProfile("manager");
  const admin = createAdminClient();
  const { data } = await admin.from("stores").select("id,name,created_at").eq("id", profile.store_id).single();
  return { id: data?.id || profile.store_id, name: data?.name || "Cửa hàng", createdAt: data?.created_at || "" };
}

export type StoreBranch = { id: string; name: string; address: string | null; phone: string | null; isDefault: boolean; active: boolean };

export async function getStoreBranches(): Promise<StoreBranch[]> {
  const { requireProfile } = await import("@/lib/auth");
  const { profile } = await requireProfile("manager");
  const admin = createAdminClient();
  const { data } = await admin.from("store_branches").select("id,name,address,phone,is_default,active").eq("store_id", profile.store_id).order("is_default", { ascending: false }).order("created_at");
  return (data || []).map((b) => ({
    id: b.id, name: b.name, address: b.address, phone: b.phone, isDefault: b.is_default, active: b.active,
  }));
}

export type StoreUser = { id: string; username: string; fullName: string; role: string; active: boolean };

export async function getStoreUsers(): Promise<StoreUser[]> {
  const { requireProfile } = await import("@/lib/auth");
  const { profile } = await requireProfile("manager");
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id,username,full_name,role,active").eq("store_id", profile.store_id).order("full_name");
  return (data || []).map((u) => ({
    id: u.id, username: u.username, fullName: u.full_name, role: u.role, active: u.active,
  }));
}