import { requireProfile } from "@/lib/auth";
import DamageItemsClient from "./damage-items-client";

export const dynamic = "force-dynamic";

export default async function DamageItemsPage() {
  const { supabase, profile } = await requireProfile("manager");
  const result = await supabase.from("products").select("id,name,sku,price,cost,stock_quantity").eq("active", true).order("name");
  return <DamageItemsClient profile={profile} initialProducts={result.data || []} />;
}
