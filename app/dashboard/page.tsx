import { requireProfile } from "@/lib/auth";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile("manager");
  const [productsResult, ordersResult, customersResult] = await Promise.all([
    supabase.from("products").select("id,name,sku,price,stock_quantity,active").order("created_at", { ascending: false }).limit(50),
    supabase.from("orders").select("id,order_number,customer_id,status,subtotal,discount,total,created_at,customers(name),order_items(quantity,line_total,products(id,name,sku))").order("created_at", { ascending: false }).limit(1000),
    supabase.from("customers").select("id,name,total_spent").order("total_spent", { ascending: false }).limit(100),
  ]);
  return <DashboardClient profile={profile} products={productsResult.data || []} customers={customersResult.data || []} orders={(ordersResult.data || []) as never} />;
}
