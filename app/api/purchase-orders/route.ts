import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

type Line = { product_id: string; quantity: number; cost?: number; discount?: number };

export async function GET() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.from("purchase_vouchers").select("*, suppliers(id,name,code), profiles(full_name)").order("created_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Không thể tải phiếu nhập hàng." }, { status: 400 });
  const list = (data || []).map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status,
    supplierCode: (row.suppliers as { code?: string } | null)?.code || "",
    supplier: (row.suppliers as { name?: string } | null)?.name || "",
    branch: row.branch || "",
    handler: row.handler || "",
    invoice: row.invoice_number || "",
    note: row.note || "",
    totalQty: Number(row.total_qty || 0),
    itemCount: Number(row.item_count || 0),
    subtotal: Number(row.subtotal || 0),
    discount: Number(row.discount || 0),
    payable: Number(row.payable || 0),
    paid: Number(row.paid || 0),
    creator: (row.profiles as { full_name?: string } | null)?.full_name || "",
    createdAt: row.created_at,
  }));
  return NextResponse.json({ vouchers: list });
}

export async function POST(request: Request) {
  const { supabase, profile } = await requireProfile("manager");
  const body = await request.json() as Record<string, unknown>;
  const status = body.status === "completed" ? "completed" : "draft";
  const supplierId = String(body.supplier_id || "").trim() || null;
  const invoiceNumber = String(body.invoice_number || "").trim();
  const note = String(body.note || "").trim();
  const lines = (Array.isArray(body.lines) ? body.lines : []) as Line[];
  const validLines = lines.filter((line) => Number(line.quantity) > 0);
  if (!validLines.length) return NextResponse.json({ error: "Vui lòng nhập số lượng hàng nhập." }, { status: 400 });

  const productIds = validLines.map((line) => line.product_id);
  const { data: products, error: productError } = await supabase.from("products").select("id,stock_quantity,cost").in("id", productIds);
  if (productError || !products) return NextResponse.json({ error: "Không thể tải hàng hóa." }, { status: 400 });
  const byId = new Map(products.map((product) => [product.id, product]));

  let subtotal = 0, discount = 0, totalQty = 0;
  const lineRows = validLines.map((line) => {
    const qty = Math.max(0, Math.trunc(Number(line.quantity) || 0));
    const cost = Math.max(0, Number(line.cost) ?? Number(byId.get(line.product_id)?.cost || 0));
    const lineDiscount = Math.max(0, Number(line.discount || 0));
    const value = Math.round(qty * cost * 100) / 100;
    subtotal += value;
    discount += lineDiscount;
    totalQty += qty;
    return { product_id: line.product_id, quantity: qty, cost, discount: lineDiscount, value };
  });
  const payable = Math.max(0, subtotal - discount);
  const paid = status === "completed" ? payable : 0;

  const { data: voucher, error: insertError } = await supabase
    .from("purchase_vouchers")
    .insert({ store_id: profile.store_id, code: `PN${String(Date.now()).slice(-9)}`, status, supplier_id: supplierId, branch: "Chi nhánh trung tâm", handler: profile.full_name, invoice_number: invoiceNumber || null, note: note || null, total_qty: totalQty, item_count: lineRows.length, subtotal, discount, payable, paid, created_by: profile.id })
    .select("id")
    .single();
  if (insertError || !voucher) return NextResponse.json({ error: "Không thể lưu phiếu nhập hàng." }, { status: 400 });

  const { error: linesError } = await supabase.from("purchase_lines").insert(lineRows.map((line) => ({ voucher_id: voucher.id, ...line })));
  if (linesError) return NextResponse.json({ error: "Không thể lưu chi tiết phiếu." }, { status: 400 });

  if (status === "completed") {
    for (const line of lineRows) {
      const current = Number(byId.get(line.product_id)?.stock_quantity || 0);
      await supabase.from("products").update({ stock_quantity: current + line.quantity, cost: line.cost }).eq("id", line.product_id);
      await supabase.from("inventory_movements").insert({ store_id: profile.store_id, product_id: line.product_id, type: "purchase", quantity: line.quantity, note: `Phiếu nhập ${voucher.id}`, created_by: profile.id });
    }
  }
  return NextResponse.json({ voucher: { id: voucher.id, code: `PN${voucher.id}`, status, payable, paid } }, { status: 201 });
}
