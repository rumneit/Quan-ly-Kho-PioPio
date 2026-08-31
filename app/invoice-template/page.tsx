import { requireProfile } from "@/lib/auth";
import InvoiceTemplateClient from "./invoice-template-client";

export const dynamic = "force-dynamic";

export default async function InvoiceTemplatePage() {
  const { supabase, profile } = await requireProfile();
  const [productsRes, ordersRes, customersRes] = await Promise.all([
    supabase.from("products").select("sku,name,base_unit,price,tax_percent").eq("active", true).order("sku"),
    supabase.from("orders").select("id,order_number,created_at,total,customers(name,phone,address),order_items(quantity,unit_price,products(sku,name,base_unit,tax_percent))").eq("status", "paid").order("created_at", { ascending: false }).limit(200),
    supabase.from("customers").select("name,phone,tax_code").eq("active", true).order("name"),
  ]);
  const products = (productsRes.data || []).map((p) => ({ sku: String(p.sku || ""), name: String(p.name || ""), dvt: String(p.base_unit || "Cái"), price: Number(p.price || 0), tax: Number(p.tax_percent || 0) }));
  const orders = ((ordersRes.data || []) as Array<Record<string, unknown>>).map((o) => {
    const items = Array.isArray(o.order_items) ? (o.order_items as Array<Record<string, unknown>>) : [];
    const cust = (o.customers || null) as { name?: string; phone?: string; address?: string } | null;
    return {
      code: `HD${String(Number(o.order_number)).padStart(6, "0")}`,
      createdAt: String(o.created_at || ""),
      total: Number(o.total || 0),
      customer: cust?.name || "Khách lẻ",
      phone: cust?.phone || "",
      address: cust?.address || "",
      items: items.map((it) => {
        const pr = (it.products || null) as { sku?: string; name?: string; base_unit?: string; tax_percent?: number } | null;
        return { sku: pr?.sku || "", name: pr?.name || "", dvt: pr?.base_unit || "Cái", tax: Number(pr?.tax_percent || 0), qty: Number(it.quantity || 0), price: Number(it.unit_price || 0) };
      }).filter((it) => it.sku),
    };
  }).filter((o) => o.items.length);
  const customers = (customersRes.data || []).map((c) => ({ name: String(c.name || ""), phone: String(c.phone || ""), taxCode: String(c.tax_code || "") }));
  return <InvoiceTemplateClient profile={profile} products={products} orders={orders} customers={customers} />;
}
