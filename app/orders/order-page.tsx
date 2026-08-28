import { requireProfile } from "@/lib/auth";
import OrderListClient, {
  type DeliveryPartner,
  type Mode,
  type SourceOrder,
  type SourceReturn,
  type SourceShipment,
} from "./order-list-client";

const orderSelect = "id,order_number,customer_id,status,subtotal,discount,total,note,channel,payment_method,created_at,updated_at,customers(id,customer_number,name,phone),creator:profiles!orders_created_by_fkey(full_name),order_items(id,product_id,quantity,unit_price,line_total,products(sku,name)),shipments(id,shipment_number,status,partner_id,area,cod_amount,collected_cod,shipping_fee,partner_fee,delivery_at,delivery_partners(name)),sales_returns(id,return_number)";
const legacyOrderSelect = "id,order_number,customer_id,status,subtotal,discount,total,created_at,updated_at,customers(id,name,phone),creator:profiles!orders_created_by_fkey(full_name),order_items(id,product_id,quantity,unit_price,line_total,products(sku,name))";
const returnSelect = "id,return_number,order_id,status,subtotal,refund_amount,note,created_at,updated_at,creator:profiles!sales_returns_created_by_fkey(full_name),orders(id,order_number,customer_id,created_at,customers(id,customer_number,name,phone),creator:profiles!orders_created_by_fkey(full_name),shipments(status)),sales_return_items(id,product_id,quantity,unit_price,line_total,products(sku,name))";
const partnerSelect = "id,partner_number,name,phone,active,shipments(status,cod_amount,collected_cod,shipping_fee,partner_fee)";
const shipmentSelect = "id,shipment_number,order_id,partner_id,status,receiver_name,receiver_phone,address,area,service,cod_amount,collected_cod,shipping_fee,partner_fee,note,created_at,delivery_at,completed_at,updated_at,delivery_partners(id,name),orders(id,order_number,customer_id,total,customers(id,customer_number,name,phone)),creator:profiles!shipments_created_by_fkey(full_name),shipment_status_history(id,status,note,created_at)";

export default async function OrderPage({ mode }: { mode: Mode }) {
  const { supabase, profile } = await requireProfile("manager");
  const [products, customers, orders, returns, partners, shipments] = await Promise.all([
    supabase.from("products").select("id,sku,name,price,stock_quantity").eq("active", true).order("name"),
    supabase.from("customers").select("id,name,phone").order("name"),
    supabase.from("orders").select(orderSelect).order("created_at", { ascending: false }),
    supabase.from("sales_returns").select(returnSelect).order("created_at", { ascending: false }),
    supabase.from("delivery_partners").select(partnerSelect).order("name"),
    supabase.from("shipments").select(shipmentSelect).order("created_at", { ascending: false }),
  ]);

  let orderData: unknown = orders.data;
  if (orders.error) {
    const legacyOrders = await supabase.from("orders").select(legacyOrderSelect).order("created_at", { ascending: false });
    orderData = legacyOrders.data;
  }

  const migrationUnavailable = Boolean(orders.error || returns.error || partners.error || shipments.error);
  return (
    <OrderListClient
      mode={mode}
      profile={profile}
      products={products.data || []}
      customers={customers.data || []}
      initialOrders={(orderData || []) as unknown as SourceOrder[]}
      initialReturns={(returns.data || []) as unknown as SourceReturn[]}
      initialPartners={(partners.data || []) as unknown as DeliveryPartner[]}
      initialShipments={(shipments.data || []) as unknown as SourceShipment[]}
      dataWarning={migrationUnavailable ? "Một số dữ liệu bán hàng và giao vận chưa sẵn sàng. Vui lòng áp dụng migration 007." : ""}
    />
  );
}
