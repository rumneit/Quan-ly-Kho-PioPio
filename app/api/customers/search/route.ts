import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireApiProfile(); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase, profile } = auth;
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ customers: [] });
  const safe = q.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", "\\,");
  const result = await supabase.from("customers").select("id,name,phone").eq("store_id", profile.store_id).or(`name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`).order("name").limit(20);
  if (result.error) { console.error("[api:customers:search:GET]", result.error); return NextResponse.json({ error: "Không thể tìm khách hàng." }, { status: 400 }); }
  return NextResponse.json({ customers: result.data || [] });
}
