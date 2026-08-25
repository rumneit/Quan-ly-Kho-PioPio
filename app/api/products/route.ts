import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

export async function GET() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Không thể tải sản phẩm." }, { status: 400 });
  return NextResponse.json({ products: data });
}

export async function POST(request: Request) {
  const { supabase, profile } = await requireProfile("manager");
  const body = await request.json();
  const name = String(body.name || "").trim();
  const sku = String(body.sku || "").trim().toUpperCase();
  const price = Number(body.price);
  const stock = Number(body.stock || 0);
  if (!name || !sku || !Number.isFinite(price) || price < 0 || stock < 0) return NextResponse.json({ error: "Dữ liệu sản phẩm không hợp lệ." }, { status: 400 });
  const { data, error } = await supabase.from("products").insert({ store_id: profile.store_id, name, sku, price, stock_quantity: stock, created_by: profile.id }).select().single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Mã hàng đã tồn tại." : "Không thể thêm sản phẩm." }, { status: 400 });
  return NextResponse.json({ product: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase } = await requireProfile("manager");
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  if (!ids.length || typeof body.active !== "boolean") return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  const { error } = await supabase.from("products").update({ active: body.active }).in("id", ids);
  if (error) return NextResponse.json({ error: "Không thể cập nhật hàng hóa." }, { status: 400 });
  return NextResponse.json({ updated: ids.length });
}
