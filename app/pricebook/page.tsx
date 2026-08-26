import { requireProfile } from "@/lib/auth";
import PriceBookClient from "./pricebook-client";

export const dynamic = "force-dynamic";

export default async function PriceBookPage() {
  const { supabase, profile } = await requireProfile("manager");
  const extended = await supabase.from("products").select("id,name,sku,price,cost,stock_quantity,active,category_id,product_categories(name)").eq("active", true).order("name");
  const fallback = extended.error ? await supabase.from("products").select("id,name,sku,price,cost,stock_quantity,active").eq("active", true).order("name") : null;
  const source = extended.error ? fallback?.data || [] : extended.data || [];
  const products = source.map((row) => {
    const item = row as typeof row & { product_categories?: { name?: string } | null };
    return { ...item, category_name: item.product_categories?.name || null };
  });
  const categories = await supabase.from("product_categories").select("id,name").order("name");
  return <PriceBookClient profile={profile} initialProducts={products} categories={categories.data || []} />;
}
