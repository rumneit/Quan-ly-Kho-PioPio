import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

type Line = { product_id: string; quantity: number; return_price?: number };

export async function GET() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.from("purchase_return_vouchers").select("*, suppliers(id,name,code), profiles(full_name)").order("created_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Không thể tải phiếu trả hàng nhập." }, { status: 400 });
  const list = (data || []).map((row) => ({
    id: row.id,
    code: row.code,
    purchaseCode: "",
    status: row.status,
    supplier: (row.suppliers as { name?: string } | null)?.name || "",
    branch: row.branch || "",
    handler: row.handler || "",
    note: row.note || "",
    totalQty: Number(row.total_qty || 0),
    itemCount: Number(row.item_count || 0),
    subtotal: Number(row.subtotal || 0),
    discount: Number(row.discount || 0),
    payable: Number(row.payable || 0),
    paid: Number(row.paid || 0),
    refund_type: row.refund_type || "debt",
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
  const purchaseId = String(body.purchase_id || "").trim() || null;
  const refundType = body.refund_type === "cash" ? "cash" : "debt";
  const note = String(body.note || "").trim();
  const lines = (Array.isArray(body.lines) ? body.lines : []) as Line[];
  const validLines = lines.filter((line) => Number(line.quantity) > 0);
  if (!validLines.length) return NextResponse.json({ error: "Vui lòng nhập số lượng hàng trả." }, { status: 400 });

  const productIds = validLines.map((line) => line.product_id);
  const { data: products, error: productError } = await supabase.from("products").select("id,stock_quantity,cost").in("id", productIds);
  if (productError || !products) return NextResponse.json({ error: "Không thể tải hàng hóa." }, { status: 400 });
  const byId = new Map(products.map((product) => [product.id, product]));

  let subtotal = 0, discount = 0, totalQty = 0;
  const lineRows = validLines.map((line) => {
    const qty = Math.max(0, Math.trunc(Number(line.quantity) || 0));
    const cost = Math.max(0, Number(byId.get(line.product_id)?.cost || 0));
    const returnPrice = Math.max(0, Number(line.return_price ?? cost));
    const value = Math.round(qty * returnPrice * 100) / 100;
    subtotal += value;
    totalQty += qty;
    return { product_id: line.product_id, quantity: qty, cost, return_price: returnPrice, value };
  });
  const payable = Math.max(0, subtotal - discount);
  const paid = status === "completed" ? payable : 0;

  const { data: voucher, error: insertError } = await supabase
    .from("purchase_return_vouchers")
    .insert({ store_id: profile.store_id, code: `THN${String(Date.now()).slice(-9)}`, status, purchase_id: purchaseId, supplier_id: supplierId, branch: "Chi nhánh trung tâm", handler: profile.full_name, note: note || null, total_qty: totalQty, item_count: lineRows.length, subtotal, discount, payable, paid, refund_type: refundType, created_by: profile.id })
    .select("id")
    .single();
  if (insertError || !voucher) return NextResponse.json({ error: "Không thể lưu phiếu trả hàng nhập." }, { status: 400 });

  const { error: linesError } = await supabase.from("purchase_return_lines").insert(lineRows.map((line) => ({ voucher_id: voucher.id, ...line })));
  if (linesError) return NextResponse.json({ error: "Không thể lưu chi tiết phiếu." }, { status: 400 });

  if (status === "completed") {
    for (const line of lineRows) {
      const current = Number(byId.get(line.product_id)?.stock_quantity || 0);
      const next = Math.max(0, current - line.quantity);
      await supabase.from("products").update({ stock_quantity: next }).eq("id", line.product_id);
      await supabase.from("inventory_movements").insert({ store_id: profile.store_id, product_id: line.product_id, type: "purchase_return", quantity: -line.quantity, note: `Phiếu trả hàng nhập ${voucher.id}`, created_by: profile.id });
    }
  }
  return NextResponse.json({ voucher: { id: voucher.id, code: `THN${voucher.id}`, status, payable, paid, refund_type: refundType } }, { status: 201 });
}
