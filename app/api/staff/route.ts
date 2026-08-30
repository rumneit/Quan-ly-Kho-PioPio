import { NextResponse } from "next/server";
import { requireProfile, usernameToEmail } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBody } from "@/lib/api-utils";

const usernamePattern = /^[a-z0-9._-]{3,32}$/;

export async function POST(request: Request) {
  const { profile } = await requireProfile("manager");
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu nhân viên không hợp lệ." }, { status: 400 });
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  const fullName = String(body.fullName || "").trim();
  const role = body.role === "manager" ? "manager" : "sales";
  if (!usernamePattern.test(username)) return NextResponse.json({ error: "Tên đăng nhập phải có 3–32 ký tự: chữ thường, số, dấu chấm, gạch ngang hoặc gạch dưới." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Mật khẩu phải có ít nhất 8 ký tự." }, { status: 400 });
  if (!fullName) return NextResponse.json({ error: "Vui lòng nhập tên nhân viên." }, { status: 400 });
  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({ email: usernameToEmail(username), password, email_confirm: true, user_metadata: { username, full_name: fullName } });
  if (authError || !authData.user) return NextResponse.json({ error: authError?.message?.includes("registered") ? "Tên đăng nhập đã tồn tại." : "Không thể tạo tài khoản." }, { status: 400 });
  const { error: profileError } = await admin.from("profiles").insert({ id: authData.user.id, store_id: profile.store_id, username, full_name: fullName, role, active: true });
  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: "Không thể gán quyền cho tài khoản." }, { status: 400 });
  }
  return NextResponse.json({ user: { id: authData.user.id, username, full_name: fullName, role } }, { status: 201 });
}
