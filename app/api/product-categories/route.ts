import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-utils";

export async function POST(request: Request) {
  const { supabase, profile } = await requireProfile("manager");
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu nhóm hàng không hợp lệ." }, { status: 400 });
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Tên nhóm hàng là bắt buộc." }, { status: 400 });
  const { data, error } = await supabase.from("product_categories").insert({ store_id: profile.store_id, name, parent_id: body.parentId || null, description: body.description || null }).select("id,name,parent_id").single();
  if (error) return NextResponse.json({ error: error.code === "42P01" ? "Cần áp dụng migration 002_product_filters.sql trước khi tạo nhóm." : "Không thể tạo nhóm hàng." }, { status: 400 });
  return NextResponse.json({ category: data }, { status: 201 });
}

