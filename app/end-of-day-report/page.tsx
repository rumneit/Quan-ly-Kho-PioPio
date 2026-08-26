import { requireProfile } from "@/lib/auth";
import EndOfDayReportClient from "./report-client";

export const dynamic = "force-dynamic";

export default async function EndOfDayReportPage() {
  const { supabase, profile } = await requireProfile("manager");
  const result = await supabase.from("orders").select("id,order_number,status,subtotal,discount,total,created_at,created_by,customers(name,phone)").order("created_at", { ascending: false }).limit(500);
  return <EndOfDayReportClient profile={profile} orders={(result.data || []) as never} />;
}
