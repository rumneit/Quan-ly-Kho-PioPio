import { requireProfile } from "@/lib/auth";
import ReportDashboard, { type ReportMode } from "./report-dashboard";

export const dynamic = "force-dynamic";

export default async function ReportPage({ mode }: { mode: ReportMode }) {
  const { supabase, profile } = await requireProfile("manager");
  const [orders, products, customers, suppliers, purchases, purchaseReturns, categories, brands, customerGroups, sellers] = await Promise.all([
    supabase.from("orders").select("id,order_number,status,subtotal,discount,total,channel,created_at,created_by,customer_id,customers(name,phone),order_items(quantity,line_total,unit_price,products(id,sku,name,cost,category_id,brand_id))").order("created_at", { ascending: false }).limit(1000),
    supabase.from("products").select("id,sku,name,price,cost,stock_quantity,active,category_id,brand_id").order("name"),
    supabase.from("customers").select("id,customer_number,name,phone,total_spent,created_at,group_id").order("name"),
    supabase.from("suppliers").select("id,code,name,created_at").order("name"),
    supabase.from("purchase_vouchers").select("id,code,status,supplier_id,subtotal,payable,paid,created_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("purchase_return_vouchers").select("id,code,status,supplier_id,payable,created_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("product_categories").select("id,name").order("name"),
    supabase.from("product_brands").select("id,name").order("name"),
    supabase.from("customer_groups").select("id,name").order("name"),
    supabase.from("profiles").select("id,full_name").eq("active", true).order("full_name"),
  ]);
  return (
    <ReportDashboard
      mode={mode}
      profile={profile}
      orders={(orders.data || []) as never}
      products={(products.data || []) as never}
      customers={(customers.data || []) as never}
      suppliers={(suppliers.data || []) as never}
      purchases={(purchases.data || []) as never}
      purchaseReturns={(purchaseReturns.data || []) as never}
      categories={(categories.data || []) as never}
      brands={(brands.data || []) as never}
      customerGroups={(customerGroups.data || []) as never}
      sellers={(sellers.data || []) as never}
    />
  );
}