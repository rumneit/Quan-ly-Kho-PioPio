"use client";

import { startTransition, useEffect, useState } from "react";
import { getExchangeRates, upsertExchangeRate, deleteExchangeRate, type ExchangeRate } from "../actions";

export default function CurrencyPage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [currency, setCurrency] = useState("");
  const [rate, setRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => { getExchangeRates().then((r) => { setRates(r); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMessage("");
    startTransition(async () => {
      const res = await upsertExchangeRate(currency, Number(rate));
      if (res.ok) { setMessage("Đã lưu tỷ giá."); setCurrency(""); setRate(""); load(); } else setMessage(res.error || "Không thể lưu.");
      setSaving(false);
    });
  };
  const remove = (id: string) => {
    setSaving(true); setMessage("");
    startTransition(async () => { try { await deleteExchangeRate(id); setMessage("Đã xóa tỷ giá."); load(); } catch (err: unknown) { setMessage("Lỗi: " + (err instanceof Error ? err.message : "")); } setSaving(false); });
  };

  if (loading) return <div className="settings-loading">Đang tải...</div>;
  return (
    <div className="settings-section">
      {message && <div className="settings-toast">{message}</div>}
      <article className="settings-form-card">
        <h3>Quản lý tiền tệ</h3>
        <p className="settings-hint">Tỷ giá quy đổi so với VND. Ví dụ: 1 USD = 24.000 VND → nhập 24000.</p>
        <form className="settings-form" onSubmit={save}>
          <div className="settings-form-row"><label>Mã tiền tệ</label><input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="VD: USD" maxLength={8} required /></div>
          <div className="settings-form-row"><label>Tỷ giá (so với VND)</label><input type="number" min="0.0001" step="any" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="VD: 24000" required /></div>
          <div className="settings-form-actions"><button type="submit" className="settings-btn-primary" disabled={saving}>{saving ? "Đang lưu..." : "Thêm / Cập nhật"}</button></div>
        </form>
      </article>
      <table className="settings-table">
        <thead><tr><th>Tiền tệ</th><th>Tỷ giá (so với VND)</th><th></th></tr></thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.id}>
              <td><strong>{r.currency}</strong></td>
              <td>1 {r.currency} = {Number(r.rate).toLocaleString("vi-VN")} ₫</td>
              <td>{r.currency !== "VND" && <button className="settings-btn-danger" onClick={() => remove(r.id)} disabled={saving}>Xóa</button>}</td>
            </tr>
          ))}
          {!rates.length && <tr><td colSpan={3} className="settings-empty">Chưa có tỷ giá.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}