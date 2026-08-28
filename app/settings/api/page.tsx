"use client";

import { startTransition, useEffect, useState } from "react";
import { getApiTokens, createApiToken, revokeApiToken, type ApiToken } from "../actions";

export default function ApiConnectionsPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState("read");
  const [newToken, setNewToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => { getApiTokens().then((t) => { setTokens(t); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMessage(""); setNewToken("");
    startTransition(async () => {
      const res = await createApiToken(name, scopes);
      if (res.ok) { setMessage("Đã tạo token. Sao chép ngay — chỉ hiển thị một lần."); setNewToken(res.token || ""); setName(""); load(); }
      else setMessage(res.error || "Không thể tạo token.");
      setSaving(false);
    });
  };
  const revoke = (id: string) => {
    setSaving(true); setMessage("");
    startTransition(async () => { try { await revokeApiToken(id); setMessage("Đã thu hồi token."); load(); } catch (e: unknown) { setMessage("Lỗi: " + (e instanceof Error ? e.message : "")); } setSaving(false); });
  };

  if (loading) return <div className="settings-loading">Đang tải...</div>;
  return (
    <div className="settings-section">
      {message && <div className="settings-toast">{message}</div>}
      {newToken && <div className="settings-token-box"><strong>Token mới:</strong> <code>{newToken}</code><p>Token chỉ hiển thị một lần. Hãy sao chép và lưu nơi an toàn.</p></div>}
      <article className="settings-form-card">
        <h3>Tạo token mới</h3>
        <form className="settings-form" onSubmit={create}>
          <div className="settings-form-row"><label>Tên token</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Ứng dụng mobile" required /></div>
          <div className="settings-form-row">
            <label>Phạm vi</label>
            <select value={scopes} onChange={(e) => setScopes(e.target.value)}>
              <option value="read">Chỉ đọc</option>
              <option value="read_write">Đọc & ghi</option>
            </select>
          </div>
          <div className="settings-form-actions"><button type="submit" className="settings-btn-primary" disabled={saving}>{saving ? "Đang tạo..." : "Tạo token"}</button></div>
        </form>
      </article>
      <table className="settings-table">
        <thead><tr><th>Tên</th><th>Phạm vi</th><th>Tiền tố</th><th>Ngày tạo</th><th>Lần cuối dùng</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.scopes === "read_write" ? "Đọc & ghi" : "Chỉ đọc"}</td>
              <td><code>{t.tokenPrefix}…</code></td>
              <td>{new Date(t.createdAt).toLocaleDateString("vi-VN")}</td>
              <td>{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString("vi-VN") : "—"}</td>
              <td>{t.active ? "Hoạt động" : "Ngừng"}</td>
              <td><button className="settings-btn-danger" onClick={() => revoke(t.id)} disabled={saving}>Thu hồi</button></td>
            </tr>
          ))}
          {!tokens.length && <tr><td colSpan={7} className="settings-empty">Chưa có token nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}