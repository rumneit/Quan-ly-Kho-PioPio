import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

export async function POST(request: Request) {
  const { supabase, profile } = await requireProfile("manager");
  const body = await request.json();
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  if (!name) return NextResponse.json({ error: "Tên khách hàng là bắt buộc." }, { status: 400 });
  const { data, error } = await supabase.from("customers").insert({ store_id: profile.store_id, name, phone: phone || null, email: email || null, created_by: profile.id }).select("id,name,phone,email,total_spent,created_at").single();
  if (error) return NextResponse.json({ error: "Không thể thêm khách hàng." }, { status: 400 });
  return NextResponse.json({ customer: data }, { status: 201 });
}
