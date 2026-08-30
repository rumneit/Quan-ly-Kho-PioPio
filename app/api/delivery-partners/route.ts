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
    return NextResponse.json({ error: "Dữ liệu đối tác không hợp lệ." }, { status: 400 });
  }
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim() || null;
  if (!name || name.length > 120 || (phone?.length || 0) > 30 || (body.active != null && typeof body.active !== "boolean")) return NextResponse.json({ error: "Dữ liệu đối tác không hợp lệ." }, { status: 400 });
  const { data, error } = await supabase.from("delivery_partners").insert({ store_id: profile.store_id, name, phone, active: body.active !== false, created_by: profile.id }).select().single();
  if (error) { console.error("[api:delivery-partners:POST]", error); return NextResponse.json({ error: error.code === "23505" ? "Tên đối tác đã tồn tại." : "Không thể tạo đối tác giao hàng." }, { status: 400 }); }
  return NextResponse.json({ partner: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase } = await requireProfile("manager");
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dữ liệu đối tác không hợp lệ." }, { status: 400 });
  }
  const id = String(body.id || "");
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim() || null;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !name || name.length > 120 || (phone?.length || 0) > 30 || (body.active != null && typeof body.active !== "boolean")) return NextResponse.json({ error: "Dữ liệu đối tác không hợp lệ." }, { status: 400 });
  const { data, error } = await supabase.from("delivery_partners").update({ name, phone, active: body.active !== false, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) { console.error("[api:delivery-partners:PATCH]", error); return NextResponse.json({ error: "Không thể cập nhật đối tác giao hàng." }, { status: 400 }); }
  return NextResponse.json({ partner: data });
}
