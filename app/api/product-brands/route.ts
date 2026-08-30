import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-utils";

export async function GET() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.from("product_brands").select("id,name,description").order("name");
  if (error) return NextResponse.json({ error: "Không thể tải thương hiệu. Cần áp dụng migration 004_product_catalog.sql." }, { status: 400 });
  return NextResponse.json({ brands: data || [] });
}

export async function POST(request: Request) {
  const { supabase, profile } = await requireProfile("manager");
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu thương hiệu không hợp lệ." }, { status: 400 });
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Tên thương hiệu là bắt buộc." }, { status: 400 });
  const { data, error } = await supabase.from("product_brands").insert({ store_id: profile.store_id, name, description: body.description || null }).select("id,name,description").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Thương hiệu đã tồn tại." : "Không thể tạo thương hiệu." }, { status: 400 });
  return NextResponse.json({ brand: data }, { status: 201 });
}
