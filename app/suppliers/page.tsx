import { requireProfile } from "@/lib/auth";
import SuppliersClient from "./suppliers-client";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const { supabase, profile } = await requireProfile("manager");
  const result = await supabase.from("suppliers").select("id,name,created_at").order("created_at", { ascending: false });
  return <SuppliersClient profile={profile} initialSuppliers={result.data || []} />;
}
