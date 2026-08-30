import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToEmail } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-utils";

const usernamePattern = /^[a-z0-9._-]{3,32}$/;

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const admin = createAdminClient();
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
  if ((count || 0) > 0) return NextResponse.json({ error: "Cửa hàng đã có tài khoản Quản lý." }, { status: 409 });
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu thiết lập không hợp lệ." }, { status: 400 });
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const fullName = String(body.fullName || "").trim();
  if (!usernamePattern.test(username)) return NextResponse.json({ error: "Tên đăng nhập phải có 3–32 ký tự hợp lệ." }, { status: 400 });
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return NextResponse.json({ error: "Mật khẩu cần ít nhất 10 ký tự, gồm chữ và số." }, { status: 400 });
  if (!fullName) return NextResponse.json({ error: "Vui lòng nhập tên người quản lý." }, { status: 400 });
  const { data: store, error: storeError } = await admin.from("stores").insert({ name: "Kho PioPio" }).select().single();
  if (storeError) return NextResponse.json({ error: "Không thể tạo cửa hàng." }, { status: 400 });
  const { data: authData, error: authError } = await admin.auth.admin.createUser({ email: usernameToEmail(username), password, email_confirm: true, user_metadata: { username, full_name: fullName } });
  if (authError || !authData.user) {
    await admin.from("stores").delete().eq("id", store.id);
    return NextResponse.json({ error: "Không thể tạo tài khoản Quản lý." }, { status: 400 });
  }
  const { error: profileError } = await admin.from("profiles").insert({ id: authData.user.id, store_id: store.id, username, full_name: fullName, role: "manager", active: true });
  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    await admin.from("stores").delete().eq("id", store.id);
    return NextResponse.json({ error: "Không thể gán quyền Quản lý." }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
