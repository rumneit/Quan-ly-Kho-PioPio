import { requireProfile } from "@/lib/auth";
import EndOfDayReportClient from "./report-client";

export const dynamic = "force-dynamic";

export default async function EndOfDayReportPage() {
  const { supabase, profile } = await requireProfile("manager");
  const [ordersResult, vouchersResult] = await Promise.all([
    supabase.from("orders").select("id,order_number,status,subtotal,discount,total,created_at,created_by,customers(name,phone),order_items(quantity)").order("created_at", { ascending: false }).limit(500),
    supabase.from("cash_vouchers").select("id,voucher_number,type,kind,amount,status,occurred_at,partner_name,note").order("occurred_at", { ascending: false }).limit(500),
  ]);
  return <EndOfDayReportClient profile={profile} orders={(ordersResult.data || []) as never} vouchers={(vouchersResult.data || []) as never} />;
}
