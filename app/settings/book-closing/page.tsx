"use client";

import { startTransition, useEffect, useState } from "react";
import { getBookPeriods, lockBookPeriod, unlockBookPeriod, type BookPeriod } from "../actions";

export default function BookClosingPage() {
  const [periods, setPeriods] = useState<BookPeriod[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => { getBookPeriods().then((p) => { setPeriods(p); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const lock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !end || end < start) { setMessage("Khoảng thời gian không hợp lệ."); return; }
    setSaving(true); setMessage("");
    startTransition(async () => {
      try { await lockBookPeriod(start, end, note); setMessage("Đã khóa sổ."); setStart(""); setEnd(""); setNote(""); load(); } catch (err: unknown) { setMessage("Lỗi: " + (err instanceof Error ? err.message : "")); }
      setSaving(false);
    });
  };
  const unlock = (id: string) => {
    setSaving(true); setMessage("");
    startTransition(async () => {
      try { await unlockBookPeriod(id); setMessage("Đã mở khóa."); load(); } catch (err: unknown) { setMessage("Lỗi: " + (err instanceof Error ? err.message : "")); }
      setSaving(false);
    });
  };

  if (loading) return <div className="settings-loading">Đang tải...</div>;
  return (
    <div className="settings-section">
      {message && <div className="settings-toast">{message}</div>}
      <article className="settings-form-card">
        <h3>Khóa sổ</h3>
        <p className="settings-hint">Khóa sổ một khoảng thời gian để ngăn giao dịch chỉnh sửa trong quá khứ.</p>
        <form className="settings-form" onSubmit={lock}>
          <div className="settings-form-row">
            <label>Từ ngày</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div className="settings-form-row">
            <label>Đến ngày</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
          <div className="settings-form-row">
            <label>Ghi chú</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (tùy chọn)" />
          </div>
          <div className="settings-form-actions">
            <button type="submit" className="settings-btn-primary" disabled={saving}>{saving ? "Đang lưu..." : "Khóa sổ"}</button>
          </div>
        </form>
      </article>
      <article className="settings-form-card">
        <h3>Kỳ đã khóa ({periods.length})</h3>
        <table className="settings-table">
          <thead><tr><th>Kỳ</th><th>Ghi chú</th><th>Người khóa</th><th></th></tr></thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id}>
                <td>{p.periodStart.split("-").reverse().join("/")} – {p.periodEnd.split("-").reverse().join("/")}</td>
                <td>{p.note || "—"}</td>
                <td>{p.lockedBy || "—"}</td>
                <td><button className="settings-btn-danger" onClick={() => unlock(p.id)} disabled={saving}>Mở khóa</button></td>
              </tr>
            ))}
            {!periods.length && <tr><td colSpan={4} className="settings-empty">Chưa có kỳ nào được khóa.</td></tr>}
          </tbody>
        </table>
      </article>
    </div>
  );
}
