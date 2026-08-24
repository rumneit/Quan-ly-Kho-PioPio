import { requireProfile } from "@/lib/auth";
import SalesClient from "./sales-client";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const { supabase, profile } = await requireProfile();
  const { data: products } = await supabase
    .from("products")
    .select("id,name,sku,price,stock_quantity,active")
    .eq("active", true)
    .gt("stock_quantity", 0)
    .order("name");

  return <SalesClient profile={profile} products={products || []} />;
}
