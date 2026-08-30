import { requireProfile } from "@/lib/auth";
import SuppliersClient from "./suppliers-client";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const { supabase, profile } = await requireProfile();
  const result = await supabase.from("suppliers").select("id,name,code,phone,email,address,area,ward,group_name,company,tax_code,identity,note,active,created_at,created_by,profiles(full_name)").order("created_at", { ascending: false });
  const products = await supabase.from("products").select("id,name,sku,price,cost,stock_quantity,base_unit").eq("active", true).order("name");
  const voucherResult = await supabase.from("purchase_vouchers").select("supplier_id,payable,paid,status");
  const debtMap = new Map<string, number>();
  const totalMap = new Map<string, number>();
  for (const voucher of (voucherResult.data as Array<{ supplier_id: string | null; payable: number | string | null; paid: number | string | null; status: string }> || [])) {
    const sid = voucher.supplier_id;
    if (!sid) continue;
    if (voucher.status === "cancelled") continue;
    const payable = Number(voucher.payable || 0);
    const paid = Number(voucher.paid || 0);
    debtMap.set(sid, (debtMap.get(sid) || 0) + Math.max(0, payable - paid));
    totalMap.set(sid, (totalMap.get(sid) || 0) + payable);
  }
  const enriched = (result.data || []).map((row) => ({
    id: row.id,
    code: (row as { code?: string | null }).code || "",
    name: (row as { name?: string }).name || "",
    phone: (row as { phone?: string | null }).phone || "",
    email: (row as { email?: string | null }).email || "",
    address: (row as { address?: string | null }).address || "",
    area: (row as { area?: string | null }).area || "",
    ward: (row as { ward?: string | null }).ward || "",
    group: (row as { group_name?: string | null }).group_name || "",
    company: (row as { company?: string | null }).company || "",
    taxCode: (row as { tax_code?: string | null }).tax_code || "",
    identity: (row as { identity?: string | null }).identity || "",
    note: (row as { note?: string | null }).note || "",
    active: (row as { active?: boolean }).active !== false,
    creator: ((row as { profiles?: { full_name?: string } | null }).profiles?.full_name) || "",
    createdAt: (row as { created_at?: string }).created_at || new Date().toISOString(),
    debt: debtMap.get(row.id) || 0,
    totalPurchase: totalMap.get(row.id) || 0,
  }));
  return <SuppliersClient profile={profile} initialSuppliers={enriched} initialProducts={products.data || []} />;
}
