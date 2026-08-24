import { requireProfile } from "@/lib/auth";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [productsResult, ordersResult, customersResult] = await Promise.all([
    supabase.from("products").select("id,name,sku,price,stock_quantity,active").order("created_at", { ascending: false }).limit(50),
    supabase.from("orders").select("id,total,status,created_at").gte("created_at", today.toISOString()),
    supabase.from("customers").select("id", { count: "exact", head: true }),
  ]);
  const orders = ordersResult.data || [];
  const revenue = orders.filter(order => order.status === "paid").reduce((sum, order) => sum + Number(order.total), 0);
  return <DashboardClient profile={profile} products={productsResult.data || []} metrics={{ revenue, orders: orders.length, customers: customersResult.count || 0, lowStock: (productsResult.data || []).filter(product => product.stock_quantity <= 5).length }} />;
}
