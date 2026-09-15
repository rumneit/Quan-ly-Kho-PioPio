import { requireProfile } from "@/lib/auth";
import InvoiceTemplateClient from "./invoice-template-client";

export const dynamic = "force-dynamic";

export default async function InvoiceTemplatePage() {
  const { supabase, profile } = await requireProfile();
  const [productsRes, ordersRes, customersRes] = await Promise.all([
    supabase.from("products").select("sku,name,base_unit,price,tax_percent").eq("active", true).order("sku"),
    supabase.from("orders").select("id,order_number,created_at,total,discount,vat_percent,vat_amount,ship_fee,customers(name,phone,address),order_items(quantity,unit_price,products(sku,name,base_unit,tax_percent))").eq("status", "paid").order("created_at", { ascending: false }).limit(200),
    supabase.from("customers").select("name,phone,tax_code,orders(status,shipments(status,cod_amount,collected_cod))").eq("active", true).order("name"),
  ]);
  const products = (productsRes.data || []).map((p) => ({ sku: String(p.sku || ""), name: String(p.name || ""), dvt: String(p.base_unit || "Cái"), price: Number(p.price || 0), tax: Number(p.tax_percent || 0) }));
  const orders = ((ordersRes.data || []) as Array<Record<string, unknown>>).map((o) => {
    const items = Array.isArray(o.order_items) ? (o.order_items as Array<Record<string, unknown>>) : [];
    const cust = (o.customers || null) as { name?: string; phone?: string; address?: string } | null;
    return {
      code: `HD${String(Number(o.order_number)).padStart(6, "0")}`,
      createdAt: String(o.created_at || ""),
      total: Number(o.total || 0),
      discount: Number(o.discount || 0),
      vatPercent: Number(o.vat_percent || 0),
      vatAmount: Number(o.vat_amount || 0),
      shipFee: Number(o.ship_fee || 0),
      customer: cust?.name || "Khách lẻ",
      phone: cust?.phone || "",
      address: cust?.address || "",
      items: items.map((it) => {
        const pr = (it.products || null) as { sku?: string; name?: string; base_unit?: string; tax_percent?: number } | null;
        return { sku: pr?.sku || "", name: pr?.name || "", dvt: pr?.base_unit || "Cái", tax: Number(pr?.tax_percent || 0), qty: Number(it.quantity || 0), price: Number(it.unit_price || 0) };
      }).filter((it) => it.sku),
    };
  }).filter((o) => o.items.length);
  const customers = (customersRes.data || [] as Array<Record<string, unknown>>).map((c) => {
    const custOrders = Array.isArray(c.orders) ? (c.orders as Array<Record<string, unknown>>) : [];
    const debt = custOrders
      .filter((o) => o.status !== "draft" && o.status !== "cancelled")
      .flatMap((o) => (Array.isArray(o.shipments) ? (o.shipments as Array<Record<string, unknown>>) : []))
      .filter((s) => s.status !== "cancelled")
      .reduce((sum, s) => sum + Math.max(0, Number(s.cod_amount || 0) - Number(s.collected_cod || 0)), 0);
    return { name: String(c.name || ""), phone: String(c.phone || ""), taxCode: String(c.tax_code || ""), debt };
  });
  return <InvoiceTemplateClient profile={profile} products={products} orders={orders} customers={customers} />;
}
