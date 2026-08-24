"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setError(result.error); return; }
    router.push("/login?setup=success");
  }
  return <main className="auth-page"><section className="auth-panel"><div className="auth-brand"><span className="brand-mark">P</span>PioPio</div><div className="auth-form-wrap"><p className="auth-kicker">THIẾT LẬP LẦN ĐẦU</p><h1>Tạo tài khoản Quản lý</h1><p className="auth-intro">Thông tin được gửi thẳng từ máy của bạn tới Supabase và không xuất hiện trong cuộc trò chuyện.</p><form className="auth-form" onSubmit={submit}><label>Tên người quản lý<input name="fullName" required placeholder="Ví dụ: Nguyễn Văn Nam" /></label><label>Tên đăng nhập<input name="username" required minLength={3} autoComplete="username" placeholder="Ví dụ: quanly" /></label><label>Mật khẩu<input name="password" type="password" required minLength={10} autoComplete="new-password" placeholder="Ít nhất 10 ký tự, gồm chữ và số" /></label>{error && <p className="auth-error">{error}</p>}<button className="auth-submit" disabled={saving}>{saving ? "Đang tạo tài khoản..." : "Tạo tài khoản Quản lý"}</button></form><p className="auth-note">Trang thiết lập này chỉ hoạt động trên môi trường phát triển cục bộ và tự khóa sau khi tài khoản đầu tiên được tạo.</p></div></section><section className="auth-visual"><div className="visual-content"><h2>Khởi tạo cửa hàng PioPio an toàn.</h2><p>Tài khoản đầu tiên có quyền quản lý sản phẩm, tồn kho, báo cáo và cấp tài khoản cho nhân viên bán hàng.</p><div className="preview-card"><div className="preview-head"><strong>Quyền Quản lý</strong><span className="live-badge">● Bảo vệ bằng RLS</span></div><div className="role-chips"><span className="role-chip"><b>Sản phẩm</b> · toàn quyền</span><span className="role-chip"><b>Nhân viên</b> · cấp tài khoản</span><span className="role-chip"><b>Báo cáo</b> · được xem</span></div></div></div></section></main>;
}
