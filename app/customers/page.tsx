import { requireProfile } from "@/lib/auth";
import CustomersClient from "./customers-client";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { supabase, profile } = await requireProfile("manager");
  const [customers, orders] = await Promise.all([
    supabase.from("customers").select("id,name,phone,email,total_spent,created_at,created_by").order("created_at", { ascending: false }),
    supabase.from("orders").select("customer_id,total,status,created_at").order("created_at", { ascending: false }),
  ]);
  return <CustomersClient profile={profile} initialCustomers={customers.data || []} orders={orders.data || []} />;
}
