import { requireProfile } from "@/lib/auth";
import OrderListClient, {
  type DeliveryPartner,
  type Mode,
  type SourceOrder,
  type SourceReturn,
  type SourceShipment,
} from "./order-list-client";

const orderSelect = "id,order_number,customer_id,branch_id,status,subtotal,discount,total,note,channel,payment_method,created_at,updated_at,customers(id,customer_number,name,phone),creator:profiles!orders_created_by_fkey(full_name),store_branches(name),order_items(id,product_id,quantity,unit_price,line_total,products(sku,name)),shipments(id,shipment_number,status,partner_id,area,cod_amount,collected_cod,shipping_fee,partner_fee,delivery_at,delivery_partners(name)),sales_returns(id,return_number)";
const legacyOrderSelect = "id,order_number,customer_id,branch_id,status,subtotal,discount,total,created_at,updated_at,customers(id,name,phone),creator:profiles!orders_created_by_fkey(full_name),store_branches(name),order_items(id,product_id,quantity,unit_price,line_total,products(sku,name))";
const returnSelect = "id,return_number,order_id,status,subtotal,refund_amount,note,created_at,updated_at,creator:profiles!sales_returns_created_by_fkey(full_name),orders(id,order_number,customer_id,created_at,customers(id,customer_number,name,phone),creator:profiles!orders_created_by_fkey(full_name),shipments(status)),sales_return_items(id,product_id,quantity,unit_price,line_total,products(sku,name))";
const partnerSelect = "id,partner_number,name,phone,active,shipments(status,cod_amount,collected_cod,shipping_fee,partner_fee)";
const shipmentSelect = "id,shipment_number,order_id,partner_id,status,receiver_name,receiver_phone,address,area,service,cod_amount,collected_cod,shipping_fee,partner_fee,note,created_at,delivery_at,completed_at,updated_at,delivery_partners(id,name),orders(id,order_number,customer_id,total,customers(id,customer_number,name,phone)),creator:profiles!shipments_created_by_fkey(full_name),shipment_status_history(id,status,note,created_at)";

export default async function OrderPage({ mode, searchParams }: { mode: Mode; searchParams?: Promise<Record<string, string>> | Record<string, string> }) {
  const { supabase, profile } = await requireProfile();
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : {};
  const page = Math.max(1, Number((resolvedParams as Record<string, string>).page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number((resolvedParams as Record<string, string>).pageSize) || 15));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  // Chỉ fetch đúng bảng mà mode hiện tại cần — giảm 6 query song song còn 2-3
  const primary = mode === "orders" || mode === "invoices"
    ? supabase.from("orders").select(orderSelect, { count: "exact" }).order("created_at", { ascending: false }).range(from, to)
    : mode === "returns"
      ? supabase.from("sales_returns").select(returnSelect, { count: "exact" }).order("created_at", { ascending: false }).range(from, to)
      : mode === "delivery-partners"
        ? supabase.from("delivery_partners").select(partnerSelect, { count: "exact" }).order("name").range(from, to)
        : supabase.from("shipments").select(shipmentSelect, { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  const needsOrders = mode === "orders" || mode === "invoices" || mode === "waybills" || mode === "returns";
  const needsPickers = mode !== "delivery-partners";
  const [products, customers, secondaryOrders, primaryResult] = await Promise.all([
    needsPickers ? supabase.from("products").select("id,sku,name,price,stock_quantity").eq("active", true).order("name") : Promise.resolve({ data: [], error: null }),
    needsPickers ? supabase.from("customers").select("id,name,phone").order("name") : Promise.resolve({ data: [], error: null }),
    needsOrders && mode !== "orders" && mode !== "invoices"
      ? supabase.from("orders").select(orderSelect, { count: "exact" }).order("created_at", { ascending: false }).range(from, to)
      : null,
    primary,
  ]);
  const orders = mode === "orders" || mode === "invoices" ? primaryResult : secondaryOrders;
  const returns = mode === "returns" ? primaryResult : null;
  const partners = mode === "delivery-partners" ? primaryResult : null;
  const shipments = mode === "waybills" ? primaryResult : null;

  let orderData: unknown = orders?.data ?? [];
  if (orders?.error) {
    const legacyOrders = await supabase.from("orders").select(legacyOrderSelect).order("created_at", { ascending: false }).range(from, to);
    orderData = legacyOrders.data;
  }

  const migrationUnavailable = Boolean(orders?.error || returns?.error || partners?.error || shipments?.error);
  return (
    <OrderListClient
      mode={mode}
      profile={profile}
      products={products.data || []}
      customers={customers.data || []}
      initialOrders={(orderData || []) as unknown as SourceOrder[]}
      initialReturns={((returns?.data) || []) as unknown as SourceReturn[]}
      initialPartners={((partners?.data) || []) as unknown as DeliveryPartner[]}
      initialShipments={((shipments?.data) || []) as unknown as SourceShipment[]}
      dataWarning={migrationUnavailable ? "Một số dữ liệu bán hàng và giao vận chưa sẵn sàng. Vui lòng áp dụng migration 007." : ""}
      serverPage={page}
      serverPageSize={pageSize}
      serverTotal={mode === "orders" || mode === "invoices" ? orders?.count || 0 : mode === "returns" ? returns?.count || 0 : mode === "delivery-partners" ? partners?.count || 0 : shipments?.count || 0}
    />
  );
}
