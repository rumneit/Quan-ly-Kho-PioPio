import { requireProfile } from "@/lib/auth";
import FinancialReportClient from "./financial-report-client";

export const dynamic = "force-dynamic";

export default async function FinancialReportPage() {
  const { supabase, profile } = await requireProfile("manager");
  const [orders, vouchers, branches] = await Promise.all([
    supabase
      .from("orders")
      .select("id,status,subtotal,discount,total,created_at,branch_id,order_items(quantity,products(cost))")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("cash_vouchers")
      .select("id,type,kind,amount,affects_profit,status,occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(2000),
    supabase.from("store_branches").select("id,name,is_default").order("created_at"),
  ]);

  return <FinancialReportClient profile={profile} orders={(orders.data || []) as never} vouchers={(vouchers.data || []) as never} branches={(branches.data || []) as never} truncated={orders.data?.length === 2000 || vouchers.data?.length === 2000} />;
}
