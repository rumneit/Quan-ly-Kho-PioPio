import { requireProfile } from "@/lib/auth";
import InternalUseClient from "./internal-use-client";

export const dynamic = "force-dynamic";

export default async function InternalUsePage() {
  const { supabase, profile } = await requireProfile("manager");
  const result = await supabase.from("products").select("id,name,sku,price,cost,stock_quantity,base_unit").eq("active", true).order("name");
  return <InternalUseClient profile={profile} initialProducts={result.data || []} />;
}
