import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayVnKey } from "@/lib/vn-time";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const admin = createAdminClient();
  const todayKey = getTodayVnKey();
  const startOfMonthISO = `${todayKey.slice(0, 7)}-01T00:00:00+07:00`;
  const [products, customers, orders] = await Promise.all([
    admin.from("products").select("id", { count: "exact", head: true }).eq("active", true),
    admin.from("customers").select("id", { count: "exact", head: true }),
    admin.from("orders").select("total", { count: "exact" }).eq("status", "paid").gte("created_at", startOfMonthISO),
  ]);
  const revenue = (orders.data || []).reduce((sum, o) => sum + Number(o.total || 0), 0);
  const stats = {
    products: products.count || 0,
    customers: customers.count || 0,
    orders: orders.count || 0,
    revenue,
  };
  return <LoginForm stats={stats} />;
}
