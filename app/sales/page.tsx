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

type EditOrder = { id: string; code: string; customer_id: string | null; note: string | null; discount_percent: number; vat_percent: number; vat_amount: number; ship_fee: number; items: Array<{ product_id: string; quantity: number; unit_price: number }> };

export default async function SalesPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const { supabase, profile } = await requireProfile();
  const resolved = searchParams ? await searchParams : {};
  const editId = (resolved as Record<string, string>).edit || "";
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

  let editOrder: EditOrder | null = null;
  if (editId) {
    const isCode = /^HD\d+$/i.test(editId);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(editId);
    if (isCode || isUuid) {
      const base = supabase.from("orders").select("id,order_number,customer_id,note,discount_percent,vat_percent,vat_amount,ship_fee,order_items(product_id,quantity,unit_price)").eq("status", "paid");
      const query = isCode ? base.eq("order_number", Number(editId.slice(2))) : base.eq("id", editId);
      const { data } = await query.maybeSingle();
      if (data) {
        const items = (Array.isArray(data.order_items) ? data.order_items : []) as Array<{ product_id: string; quantity: number; unit_price: number }>;
        editOrder = { id: data.id, code: "HD" + String(Number(data.order_number)).padStart(6, "0"), customer_id: data.customer_id || null, note: data.note || null, discount_percent: Number(data.discount_percent || 0), vat_percent: Number(data.vat_percent || 0), vat_amount: Number(data.vat_amount || 0), ship_fee: Number(data.ship_fee || 0), items };
      }
    }
  }

  const pendingOrders = (ordersResult.data || []).map((o: Record<string, unknown>) => {
    const cust = o.customers as { name?: string } | { name?: string }[] | null;
    const customer = Array.isArray(cust) ? cust[0] : cust;
    return { id: String(o.id), order_number: Number(o.order_number), status: String(o.status), total: Number(o.total), created_at: String(o.created_at), customers: customer || null };
  });
  return <SalesClient profile={profile} products={productsResult.data || []} customers={customers} pendingOrders={pendingOrders} customerGroups={groupsResult.data || []} editOrder={editOrder} />;
}
