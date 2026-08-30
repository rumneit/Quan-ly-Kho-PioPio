import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

export async function POST(request: Request) {
  const { supabase, profile } = await requireProfile("manager");
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dữ liệu nhóm không hợp lệ." }, { status: 400 });
  }
  const name = String(body.name || "").trim();
  if (!name || name.length > 120) return NextResponse.json({ error: "Tên nhóm phải có từ 1 đến 120 ký tự." }, { status: 400 });
  const result = await supabase.from("customer_groups").insert({ store_id: profile.store_id, name, created_by: profile.id }).select("id,name").single();
  if (result.error) { console.error("[api:customer-groups:POST]", result.error); return NextResponse.json({ error: result.error.code === "23505" ? "Nhóm khách hàng đã tồn tại." : "Không thể tạo nhóm khách hàng." }, { status: 400 }); }
  return NextResponse.json({ group: result.data }, { status: 201 });
}
