import { requireProfile } from "@/lib/auth";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile("manager");
  const [productsResult, ordersResult, customersResult, branchesResult] = await Promise.all([
    supabase.from("products").select("id,name,sku,price,cost,stock_quantity,active,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("orders").select("id,order_number,customer_id,status,subtotal,discount,total,created_at,branch_id,created_by,customers(name),creator:profiles!orders_created_by_fkey(full_name),order_items(quantity,line_total,products(id,name,sku,cost))").order("created_at", { ascending: false }).limit(1000),
    supabase.from("customers").select("id,name,total_spent").order("total_spent", { ascending: false }).limit(100),
    supabase.from("store_branches").select("id,name,is_default,active").order("created_at", { ascending: true }),
  ]);
  return <DashboardClient profile={profile} products={productsResult.data || []} customers={customersResult.data || []} orders={(ordersResult.data || []) as never} branches={branchesResult.data || []} />;
}
