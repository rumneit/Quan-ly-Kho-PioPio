import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-utils";

type Line = { product_id: string; actual: number };

export async function GET() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase
    .from("stocktake_vouchers")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: "Không thể tải phiếu kiểm kho." }, { status: 400 });
  const list = (data || []).map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status,
    note: row.note || "",
    total_actual: Number(row.total_actual || 0),
    total_adjustment: Number(row.total_adjustment || 0),
    adjustment_value: Number(row.adjustment_value || 0),
    increase_qty: Number(row.increase_qty || 0),
    decrease_qty: Number(row.decrease_qty || 0),
    actual_count: Number(row.actual_count || 0),
    balanced_at: row.balanced_at,
    creator: (row.profiles as { full_name?: string } | null)?.full_name || "",
    created_at: row.created_at,
  }));
  return NextResponse.json({ vouchers: list, truncated: (data || []).length === 500 });
}

export async function POST(request: Request) {
  const { supabase, profile } = await requireProfile("manager");
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu phiếu kiểm kho không hợp lệ." }, { status: 400 });
  const status = body.status === "balanced" ? "balanced" : "draft";
  const note = String(body.note || "").trim();
  const lines = (Array.isArray(body.lines) ? body.lines : []) as Line[];
  if (!lines.length) return NextResponse.json({ error: "Chưa có hàng hóa nào được kiểm." }, { status: 400 });

  const productIds = lines.map((line) => line.product_id);
  const { data: products, error: productError } = await supabase.from("products").select("id,stock_quantity").in("id", productIds);
  if (productError || !products) return NextResponse.json({ error: "Không thể tải hàng hóa." }, { status: 400 });
  const stockById = new Map(products.map((product) => [product.id, Number(product.stock_quantity || 0)]));

  let totalActual = 0, totalAdjustment = 0, adjustmentValue = 0, increaseQty = 0, decreaseQty = 0;
  const lineRows = lines.map((line) => {
    const actual = Math.max(0, Math.trunc(Number(line.actual) || 0));
    const stock = stockById.get(line.product_id) || 0;
    const diff = actual - stock;
    totalActual += actual;
    totalAdjustment += diff;
    if (diff > 0) increaseQty += diff; else decreaseQty += Math.abs(diff);
    return { product_id: line.product_id, stock_quantity: stock, actual, diff };
  });
  const { data: voucher, error: insertError } = await supabase
    .from("stocktake_vouchers")
    .insert({
      store_id: profile.store_id,
      code: `KK${String(Date.now()).slice(-9)}`,
      status,
      note: note || null,
      total_actual: totalActual,
      total_adjustment: totalAdjustment,
      adjustment_value: adjustmentValue,
      increase_qty: increaseQty,
      decrease_qty: decreaseQty,
      actual_count: lineRows.length,
      balanced_at: status === "balanced" ? new Date().toISOString() : null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (insertError || !voucher) return NextResponse.json({ error: "Không thể lưu phiếu kiểm kho." }, { status: 400 });

  const { error: linesError } = await supabase.from("stocktake_lines").insert(lineRows.map((line) => ({ voucher_id: voucher.id, ...line })));
  if (linesError) return NextResponse.json({ error: "Không thể lưu chi tiết phiếu kiểm kho." }, { status: 400 });

  if (status === "balanced") {
    for (const line of lineRows) {
      await supabase.from("products").update({ stock_quantity: line.actual }).eq("id", line.product_id);
      await supabase.from("inventory_movements").insert({ store_id: profile.store_id, product_id: line.product_id, type: "adjustment", quantity: line.diff, note: `Phiếu kiểm kho ${voucher.id}`, created_by: profile.id });
    }
  }
  return NextResponse.json({ voucher: { id: voucher.id, status } }, { status: 201 });
}
