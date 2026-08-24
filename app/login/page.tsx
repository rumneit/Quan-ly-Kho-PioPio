"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function authEmail(username: string) {
  return `${username.trim().toLowerCase()}@auth.khopiopio.app`;
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "");
    const password = String(form.get("password") || "");
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: authEmail(username), password });
    if (signInError) {
      setError("Tên đăng nhập hoặc mật khẩu không đúng.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand"><span className="brand-mark">P</span>PioPio</div>
        <div className="auth-form-wrap">
          <p className="auth-kicker">QUẢN LÝ CỬA HÀNG</p>
          <h1>Đăng nhập PioPio</h1>
          <p className="auth-intro">Truy cập hệ thống bán hàng, quản lý kho và theo dõi hoạt động cửa hàng của bạn.</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>Tên đăng nhập<input name="username" autoComplete="username" required placeholder="Nhập tên đăng nhập" /></label>
            <label><span className="password-row"><span>Mật khẩu</span><button type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? "Ẩn" : "Hiện"}</button></span><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Nhập mật khẩu" /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" disabled={loading}>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</button>
          </form>
          <p className="auth-note">Tài khoản nhân viên do Quản lý cửa hàng cấp. Nếu quên mật khẩu, hãy liên hệ người quản lý để được đặt lại.</p>
        </div>
      </section>
      <section className="auth-visual">
        <div className="visual-content">
          <h2>Vận hành cửa hàng đơn giản, kiểm soát dữ liệu chặt chẽ.</h2>
          <p>Một nơi duy nhất để bán hàng, theo dõi tồn kho và quản lý hiệu suất nhân viên theo đúng quyền được cấp.</p>
          <div className="preview-card"><div className="preview-head"><strong>Tổng quan hôm nay</strong><span className="live-badge">● Đang hoạt động</span></div><div className="preview-metrics"><div className="preview-metric"><span>DOANH THU</span><strong>18,6 triệu</strong></div><div className="preview-metric"><span>ĐƠN HÀNG</span><strong>42</strong></div><div className="preview-metric"><span>TỒN KHO</span><strong>1.248</strong></div></div><div className="role-chips"><span className="role-chip"><b>Quản lý</b> · toàn quyền</span><span className="role-chip"><b>Bán hàng</b> · POS & đơn hàng</span></div></div>
        </div>
      </section>
    </main>
  );
}
