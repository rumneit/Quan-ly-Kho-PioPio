import { requireProfile } from "@/lib/auth";
import SalesReportClient from "./sales-report-client";

export const dynamic = "force-dynamic";

export default async function SaleReportPage() {
  const { supabase, profile } = await requireProfile("manager");
  const { data } = await supabase
    .from("orders")
    .select("id,status,subtotal,discount,total,created_at,order_items(quantity,line_total,products(cost))")
    .order("created_at", { ascending: false })
    .limit(1000);

  return <SalesReportClient profile={profile} orders={(data || []) as never} />;
}
