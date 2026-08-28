"use client";

import { startTransition, useState } from "react";
import { changePassword } from "../actions";

export default function SecurityPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { setMessage({ type: "err", text: "Mật khẩu xác nhận không khớp." }); return; }
    setLoading(true); setMessage(null);
    startTransition(async () => {
      const res = await changePassword(current, next);
      if (res.ok) { setMessage({ type: "ok", text: "Đã đổi mật khẩu thành công." }); setCurrent(""); setNext(""); setConfirm(""); }
      else { setMessage({ type: "err", text: res.error || "Không thể đổi mật khẩu." }); }
      setLoading(false);
    });
  };

  return (
    <div className="settings-section">
      <article className="settings-form-card">
        <h3>Đổi mật khẩu</h3>
        <form className="settings-form" onSubmit={submit}>
          <div className="settings-form-row">
            <label>Mật khẩu hiện tại</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Nhập mật khẩu hiện tại" required />
          </div>
          <div className="settings-form-row">
            <label>Mật khẩu mới</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Ít nhất 10 ký tự, gồm chữ và số" required />
          </div>
          <div className="settings-form-row">
            <label>Xác nhận mật khẩu mới</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Nhập lại mật khẩu mới" required />
          </div>
          {message && <p className={`settings-message ${message.type}`}>{message.text}</p>}
          <div className="settings-form-actions">
            <button type="submit" className="settings-btn-primary" disabled={loading || !current || !next || !confirm}>{loading ? "Đang lưu..." : "Đổi mật khẩu"}</button>
          </div>
        </form>
      </article>
    </div>
  );
}
