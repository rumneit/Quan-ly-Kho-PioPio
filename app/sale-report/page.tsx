import { requireProfile } from "@/lib/auth";
import SalesReportClient from "./sales-report-client";

export const dynamic = "force-dynamic";

export default async function SaleReportPage() {
  const { supabase, profile } = await requireProfile("manager");
  const [ordersRes, branchesRes, sellersRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id,status,subtotal,discount,total,created_at,branch_id,channel,payment_method,created_by,order_items(quantity,line_total,products(cost))")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("store_branches").select("id,name,is_default").order("created_at"),
    supabase.from("profiles").select("id,full_name").eq("active", true).order("full_name"),
  ]);

  return <SalesReportClient profile={profile} orders={(ordersRes.data || []) as never} branches={(branchesRes.data || []) as never} sellers={(sellersRes.data || []) as never} truncated={ordersRes.data?.length === 1000} />;
}
