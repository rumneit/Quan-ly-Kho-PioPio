import { requireProfile } from "@/lib/auth";
import CashFlowClient from "./cashflow-client";

export const dynamic = "force-dynamic";

export default async function CashFlowPage() {
  const { supabase, profile } = await requireProfile("manager");
  const result = await supabase.from("orders").select("id,order_number,total,status,created_at,customers(name,phone)").order("created_at", { ascending: false });
  return <CashFlowClient profile={profile} orders={(result.data || []) as never} />;
}
