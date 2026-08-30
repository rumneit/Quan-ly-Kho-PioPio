import { requireProfile } from "@/lib/auth";
import EndOfDayReportClient from "./report-client";

export const dynamic = "force-dynamic";

export default async function EndOfDayReportPage() {
  const { supabase, profile } = await requireProfile("manager");
  const [ordersResult, vouchersResult, branchesResult, sellersResult] = await Promise.all([
    supabase.from("orders").select("id,order_number,status,subtotal,discount,total,created_at,created_by,branch_id,payment_method,channel,customers(name,phone),order_items(quantity)").order("created_at", { ascending: false }).limit(500),
    supabase.from("cash_vouchers").select("id,voucher_number,type,kind,amount,status,occurred_at,partner_name,note").order("occurred_at", { ascending: false }).limit(500),
    supabase.from("store_branches").select("id,name,is_default").order("created_at"),
    supabase.from("profiles").select("id,full_name").eq("active", true).order("full_name"),
  ]);
  return <EndOfDayReportClient profile={profile} orders={(ordersResult.data || []) as never} vouchers={(vouchersResult.data || []) as never} branches={(branchesResult.data || []) as never} sellers={(sellersResult.data || []) as never} truncated={ordersResult.data?.length === 500 || vouchersResult.data?.length === 500} />;
}
