import { requireProfile } from "@/lib/auth";
import SalesClient from "./sales-client";

export const dynamic = "force-dynamic";

type CustomerLite = { id: string; name: string; phone: string | null };

async function loadCustomers(supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"]): Promise<CustomerLite[]> {
  // Tải toàn bộ khách hàng theo trang 1000 dòng — tránh bị giới hạn max-rows của Supabase
  const pageSize = 1000;
  const all: CustomerLite[] = [];
  let from = 0;
  while (from < 20000) {
    const { data, error } = await supabase.from("customers").select("id,name,phone").order("name").range(from, from + pageSize - 1);
    if (error) { console.error("[sales:loadCustomers]", error); break; }
    const rows = (data || []) as CustomerLite[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export default async function SalesPage() {
  const { supabase, profile } = await requireProfile();
  const [productsResult, ordersResult, groupsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,sku,price,stock_quantity,active,base_unit,units")
      .eq("active", true)
      .order("name"),
    supabase.from("orders").select("id,order_number,status,total,created_at,customers(name)").in("status", ["draft", "pending"]).order("created_at", { ascending: false }).limit(20),
    supabase.from("customer_groups").select("id,name").order("name"),
  ]);
  const customers = await loadCustomers(supabase);

  const pendingOrders = (ordersResult.data || []).map((o: Record<string, unknown>) => {
    const cust = o.customers as { name?: string } | { name?: string }[] | null;
    const customer = Array.isArray(cust) ? cust[0] : cust;
    return { id: String(o.id), order_number: Number(o.order_number), status: String(o.status), total: Number(o.total), created_at: String(o.created_at), customers: customer || null };
  });
  return <SalesClient profile={profile} products={productsResult.data || []} customers={customers} pendingOrders={pendingOrders} customerGroups={groupsResult.data || []} />;
}
