import { requireProfile } from "@/lib/auth";
import OrderListClient from "./order-list-client";

export default async function OrderPage({ mode }: { mode: "orders" | "invoices" | "returns" | "delivery-partners" | "waybills" }) {
  const { supabase, profile } = await requireProfile("manager");
  const [products, customers, orders] = await Promise.all([
    supabase.from("products").select("id,sku,name,price,stock_quantity").eq("active", true).order("name"),
    supabase.from("customers").select("id,name,phone").order("name"),
    supabase.from("orders").select("id,order_number,status,subtotal,discount,total,created_at,updated_at,customers(name,phone)").order("created_at", { ascending: false }),
  ]);
  return <OrderListClient mode={mode} profile={profile} products={products.data || []} customers={customers.data || []} initialOrders={(orders.data || []) as never} />;
}
