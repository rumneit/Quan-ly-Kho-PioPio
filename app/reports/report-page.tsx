import { requireProfile } from "@/lib/auth";
import ReportDashboard, { type ReportMode } from "./report-dashboard";

export default async function ReportPage({ mode }: { mode: ReportMode }) {
  const { supabase, profile } = await requireProfile("manager");
  const [orders, products, customers, suppliers] = await Promise.all([
    supabase.from("orders").select("id,order_number,status,subtotal,discount,total,created_at,customer_id,customers(name,phone),order_items(quantity,line_total,unit_price,products(id,sku,name,cost))").order("created_at", { ascending: false }).limit(1000),
    supabase.from("products").select("id,sku,name,price,cost,stock_quantity,active").order("name"),
    supabase.from("customers").select("id,name,phone,total_spent,created_at").order("name"),
    supabase.from("suppliers").select("id,name,created_at").order("name"),
  ]);
  return <ReportDashboard mode={mode} profile={profile} orders={(orders.data || []) as never} products={products.data || []} customers={customers.data || []} suppliers={suppliers.data || []} />;
}
