import { requireProfile } from "@/lib/auth";
import SalesClient from "./sales-client";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const { supabase, profile } = await requireProfile();
  const [productsResult, customersResult] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,sku,price,stock_quantity,active")
      .eq("active", true)
      .gt("stock_quantity", 0)
      .order("name"),
    supabase.from("customers").select("id,name,phone").order("name").limit(200),
  ]);

  return <SalesClient profile={profile} products={productsResult.data || []} customers={customersResult.data || []} />;
}
