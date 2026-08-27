import { requireProfile } from "@/lib/auth";
import StockTakesClient from "./stocktakes-client";

export const dynamic = "force-dynamic";

export default async function StockTakesPage() {
  const { supabase, profile } = await requireProfile("manager");
  const result = await supabase.from("products").select("id,name,sku,price,cost,stock_quantity,base_unit").eq("active", true).order("name");
  return <StockTakesClient profile={profile} initialProducts={result.data || []} />;
}
