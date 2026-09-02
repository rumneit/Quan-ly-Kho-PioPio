import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-utils";

export async function GET() {
  const auth = await requireApiProfile(); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase } = auth;
  const { data, error } = await supabase.from("suppliers").select("id,name,code,phone,email,address,area,ward,group_name,company,tax_code,identity,note,active,created_at,created_by,profiles(full_name)").order("created_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Không thể tải nhà cung cấp." }, { status: 400 });
  const { data: vouchers } = await supabase.from("purchase_vouchers").select("supplier_id,payable,paid,status");
  const debtMap = new Map<string, number>();
  const totalMap = new Map<string, number>();
  for (const voucher of (vouchers as Array<{ supplier_id: string | null; payable: number | string | null; paid: number | string | null; status: string }> || [])) {
    const sid = voucher.supplier_id;
    if (!sid) continue;
    if (voucher.status === "cancelled") continue;
    const payable = Number(voucher.payable || 0);
    const paid = Number(voucher.paid || 0);
    debtMap.set(sid, (debtMap.get(sid) || 0) + Math.max(0, payable - paid));
    totalMap.set(sid, (totalMap.get(sid) || 0) + payable);
  }
  const list = (data || []).map((row) => ({
    id: row.id,
    code: row.code || "",
    name: row.name,
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || "",
    area: row.area || "",
    ward: row.ward || "",
    group: row.group_name || "",
    company: row.company || "",
    taxCode: row.tax_code || "",
    identity: row.identity || "",
    note: row.note || "",
    active: row.active !== false,
    creator: (row.profiles as { full_name?: string } | null)?.full_name || "",
    createdAt: row.created_at,
    debt: debtMap.get(row.id) || 0,
    totalPurchase: totalMap.get(row.id) || 0,
  }));
  return NextResponse.json({ suppliers: list, truncated: (data || []).length === 500 });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase, profile } = auth;
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu nhà cung cấp không hợp lệ." }, { status: 400 });
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Tên nhà cung cấp là bắt buộc." }, { status: 400 });
  const payload: Record<string, unknown> = {
    store_id: profile.store_id,
    name,
    code: String(body.code || "").trim() || null,
    phone: String(body.phone || "").trim() || null,
    email: String(body.email || "").trim() || null,
    address: String(body.address || "").trim() || null,
    area: String(body.area || "").trim() || null,
    ward: String(body.ward || "").trim() || null,
    group_name: String(body.group || "").trim() || null,
    company: String(body.company || "").trim() || null,
    tax_code: String(body.taxCode || "").trim() || null,
    identity: String(body.identity || "").trim() || null,
    note: String(body.note || "").trim() || null,
    active: body.active === false ? false : true,
    created_by: profile.id,
  };
  const { data, error } = await supabase.from("suppliers").insert(payload).select("id,name,code,phone,email,address,area,ward,group_name,company,tax_code,identity,note,active").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Mã hoặc tên nhà cung cấp đã tồn tại." : "Không thể tạo nhà cung cấp." }, { status: 400 });
  return NextResponse.json({ supplier: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase, profile } = auth;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Thiếu mã nhà cung cấp." }, { status: 400 });
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  const payload: Record<string, unknown> = {};
  for (const [key, target] of [["name", "name"], ["code", "code"], ["phone", "phone"], ["email", "email"], ["address", "address"], ["area", "area"], ["ward", "ward"], ["group", "group_name"], ["company", "company"], ["taxCode", "tax_code"], ["identity", "identity"], ["note", "note"]] as const) {
    if (key in body) payload[target] = String(body[key] || "").trim() || null;
  }
  if ("active" in body) payload.active = body.active === true;
  if (payload.name === null) return NextResponse.json({ error: "Tên nhà cung cấp là bắt buộc." }, { status: 400 });
  const { data, error } = await supabase.from("suppliers").update(payload).eq("id", id).eq("store_id", profile.store_id).select("id,name,code,phone,email,address,area,ward,group_name,company,tax_code,identity,note,active").single();
  if (error) return NextResponse.json({ error: "Không thể cập nhật nhà cung cấp." }, { status: 400 });
  return NextResponse.json({ supplier: data });
}

export async function DELETE(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase, profile } = auth;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Thiếu mã nhà cung cấp." }, { status: 400 });
  const { error } = await supabase.from("suppliers").delete().eq("id", id).eq("store_id", profile.store_id);
  if (error) return NextResponse.json({ error: "Không thể xóa nhà cung cấp." }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
