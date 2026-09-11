import { requireProfile } from "@/lib/auth";
import SalesClient from "./sales-client";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const { supabase, profile } = await requireProfile();
  const [productsResult, customersResult, ordersResult, groupsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,sku,price,stock_quantity,active")
      .eq("active", true)
      .order("name"),
    supabase.from("customers").select("id,name,phone").order("name").limit(200),
    supabase.from("orders").select("id,order_number,status,total,created_at,customers(name)").in("status", ["draft", "pending"]).order("created_at", { ascending: false }).limit(20),
    supabase.from("customer_groups").select("id,name").order("name"),
  ]);

  const pendingOrders = (ordersResult.data || []).map((o: Record<string, unknown>) => {
    const cust = o.customers as { name?: string } | { name?: string }[] | null;
    const customer = Array.isArray(cust) ? cust[0] : cust;
    return { id: String(o.id), order_number: Number(o.order_number), status: String(o.status), total: Number(o.total), created_at: String(o.created_at), customers: customer || null };
  });
  return <SalesClient profile={profile} products={productsResult.data || []} customers={customersResult.data || []} pendingOrders={pendingOrders} customerGroups={groupsResult.data || []} />;
}
