import { requireProfile } from "@/lib/auth";
import ProductClient from "./product-client";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { supabase, profile } = await requireProfile("manager");
  // Thử select đầy đủ (kể cả cột 003_product_extra) - nếu chưa migrate thì fallback tự động
  const fullSelect = "id,name,sku,price,cost,stock_quantity,active,created_at,category_id,supplier_id,product_type,direct_sale,linked_sale_channel,expected_out_of_stock_at,description,note,brand,location,min_stock,max_stock,product_categories(name),suppliers(name)";
  const extendedSelect = "id,name,sku,price,cost,stock_quantity,active,created_at,category_id,supplier_id,product_type,direct_sale,linked_sale_channel,expected_out_of_stock_at,product_categories(name),suppliers(name)";
  let extended = await supabase.from("products").select(fullSelect).order("created_at", { ascending: false });
  if (extended.error && String(extended.error.code) === "42703") {
    extended = await supabase.from("products").select(extendedSelect).order("created_at", { ascending: false }) as typeof extended;
  }
  const fallback = extended.error ? await supabase.from("products").select("id,name,sku,price,cost,stock_quantity,active,created_at").order("created_at", { ascending: false }) : null;
  const source = extended.error ? fallback?.data || [] : extended.data || [];
  const products = source.map((row) => {
    const item = row as typeof row & { product_categories?: { name?: string } | null; suppliers?: { name?: string } | null };
    return { ...item, category_name: item.product_categories?.name || null, supplier_name: item.suppliers?.name || null };
  });
  const [categoryResult, supplierResult] = await Promise.all([
    supabase.from("product_categories").select("id,name").order("name"),
    supabase.from("suppliers").select("id,name").order("name"),
  ]);
  return <ProductClient profile={profile} initialProducts={products} initialCategories={categoryResult.data || []} initialSuppliers={supplierResult.data || []} />;
}
