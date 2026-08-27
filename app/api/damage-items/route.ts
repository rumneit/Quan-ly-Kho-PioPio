import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

type Line = { product_id: string; quantity: number };

export async function GET() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase
    .from("damage_vouchers")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: "Không thể tải phiếu xuất hủy." }, { status: 400 });
  const list = (data || []).map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status,
    note: row.note || "",
    total_value: Number(row.total_value || 0),
    creator: (row.profiles as { full_name?: string } | null)?.full_name || "",
    created_at: row.created_at,
  }));
  return NextResponse.json({ vouchers: list });
}

export async function POST(request: Request) {
  const { supabase, profile } = await requireProfile("manager");
  const body = await request.json() as Record<string, unknown>;
  const status = body.status === "completed" ? "completed" : "draft";
  const note = String(body.note || "").trim();
  const lines = (Array.isArray(body.lines) ? body.lines : []) as Line[];
  const validLines = lines.filter((line) => Number(line.quantity) > 0);
  if (!validLines.length) return NextResponse.json({ error: "Vui lòng nhập số lượng hủy." }, { status: 400 });

  const productIds = validLines.map((line) => line.product_id);
  const { data: products, error: productError } = await supabase.from("products").select("id,cost,price,stock_quantity").in("id", productIds);
  if (productError || !products) return NextResponse.json({ error: "Không thể tải hàng hóa." }, { status: 400 });
  const byId = new Map(products.map((product) => [product.id, product]));

  let totalValue = 0;
  const lineRows = validLines.map((line) => {
    const product = byId.get(line.product_id);
    const cost = Number(product?.cost ?? product?.price ?? 0);
    const value = Math.round(Math.trunc(Number(line.quantity)) * cost * 100) / 100;
    totalValue += value;
    return { product_id: line.product_id, quantity: Math.trunc(Number(line.quantity)), cost, value };
  });

  const { data: voucher, error: insertError } = await supabase
    .from("damage_vouchers")
    .insert({
      store_id: profile.store_id,
      code: `XH${String(Date.now()).slice(-9)}`,
      status,
      note: note || null,
      total_value: totalValue,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (insertError || !voucher) return NextResponse.json({ error: "Không thể lưu phiếu xuất hủy." }, { status: 400 });

  const { error: linesError } = await supabase.from("damage_lines").insert(lineRows.map((line) => ({ voucher_id: voucher.id, ...line })));
  if (linesError) return NextResponse.json({ error: "Không thể lưu chi tiết phiếu." }, { status: 400 });

  if (status === "completed") {
    for (const line of lineRows) {
      const current = Number(byId.get(line.product_id)?.stock_quantity || 0);
      const next = Math.max(0, current - line.quantity);
      await supabase.from("products").update({ stock_quantity: next }).eq("id", line.product_id);
      await supabase.from("inventory_movements").insert({ store_id: profile.store_id, product_id: line.product_id, type: "damage", quantity: -line.quantity, note: `Phiếu xuất hủy ${voucher.id}`, created_by: profile.id });
    }
  }
  return NextResponse.json({ voucher: { id: voucher.id, status, total_value: totalValue } }, { status: 201 });
}
