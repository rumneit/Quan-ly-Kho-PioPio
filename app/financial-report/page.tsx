import { requireProfile } from "@/lib/auth";
import FinancialReportClient from "./financial-report-client";

export const dynamic = "force-dynamic";

export default async function FinancialReportPage() {
  const { supabase, profile } = await requireProfile("manager");
  const { data } = await supabase
    .from("orders")
    .select("id,status,subtotal,discount,total,created_at,order_items(quantity,products(cost))")
    .order("created_at", { ascending: false })
    .limit(2000);

  return <FinancialReportClient profile={profile} orders={(data || []) as never} />;
}
