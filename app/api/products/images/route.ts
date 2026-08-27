import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const { profile } = await requireProfile("manager");
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Chưa chọn ảnh." }, { status: 400 });
  if (!ALLOWED.has(file.type) || file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "Ảnh phải là JPG, PNG, WEBP hoặc GIF và không quá 2 MB." }, { status: 400 });
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${profile.store_id}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: "Không thể tải ảnh. Cần áp dụng migration 004_product_catalog.sql." }, { status: 400 });
  const { data } = admin.storage.from("product-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path }, { status: 201 });
}
