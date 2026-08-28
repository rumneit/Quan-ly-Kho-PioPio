"use client";

import { startTransition, useEffect, useState } from "react";
import { getPrintTemplates, savePrintTemplate, type PrintTemplate } from "../actions";

const TYPE_LABELS: Record<string, string> = { invoice: "Hóa đơn", order: "Đơn hàng", return: "Trả hàng", purchase: "Nhập hàng", stocktake: "Kiểm kho" };
const PAPER_OPTIONS = ["A4", "A5", "80mm", "K80"];

export default function PrintTemplatesPage() {
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [editing, setEditing] = useState<Partial<PrintTemplate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => { getPrintTemplates().then((t) => { setTemplates(t); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const save = () => {
    if (!editing || !editing.type || !editing.name) return;
    setSaving(true); setMessage("");
    startTransition(async () => {
      try { await savePrintTemplate(editing as PrintTemplate); setMessage("Đã lưu."); setEditing(null); load(); } catch (e: unknown) { setMessage("Lỗi: " + (e instanceof Error ? e.message : "")); }
      setSaving(false);
    });
  };

  if (loading) return <div className="settings-loading">Đang tải...</div>;
  return (
    <div className="settings-section">
      {message && <div className="settings-toast">{message}</div>}
      <div className="settings-form-actions" style={{ marginBottom: 16 }}>
        <button className="settings-btn-primary" onClick={() => setEditing({ type: "invoice", name: "", paperSize: "A4", copies: 1, showLogo: true, showStoreInfo: true, showTax: true, footerNote: "", active: true })}>Tạo mẫu mới</button>
      </div>
      <table className="settings-table">
        <thead><tr><th>Loại</th><th>Tên mẫu</th><th>Khổ giấy</th><th>Bản sao</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id}>
              <td>{TYPE_LABELS[t.type] || t.type}</td>
              <td>{t.name}</td>
              <td>{t.paperSize}</td>
              <td>{t.copies}</td>
              <td>{t.active ? "Đang dùng" : "Tạm ẩn"}</td>
              <td><button className="settings-btn-sm" onClick={() => setEditing(t)}>Sửa</button></td>
            </tr>
          ))}
          {!templates.length && <tr><td colSpan={6} className="settings-empty">Chưa có mẫu in nào. Bấm "Tạo mẫu mới" để thêm.</td></tr>}
        </tbody>
      </table>
      {editing && <div className="modal-backdrop" onClick={() => setEditing(null)}><section className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{editing.id ? "Chỉnh sửa mẫu in" : "Tạo mẫu in mới"}</h3>
        <div className="settings-form">
          <div className="settings-form-row"><label>Loại</label><select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>{Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="settings-form-row"><label>Tên mẫu</label><input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
          <div className="settings-form-row"><label>Khổ giấy</label><select value={editing.paperSize} onChange={(e) => setEditing({ ...editing, paperSize: e.target.value })}>{PAPER_OPTIONS.map((o) => <option key={o}>{o}</option>)}</select></div>
          <div className="settings-form-row"><label>Số bản sao</label><input type="number" min="1" max="9" value={editing.copies} onChange={(e) => setEditing({ ...editing, copies: Number(e.target.value) })} /></div>
          <label className="settings-check"><input type="checkbox" checked={editing.showLogo} onChange={(e) => setEditing({ ...editing, showLogo: e.target.checked })} />Hiển thị logo</label>
          <label className="settings-check"><input type="checkbox" checked={editing.showStoreInfo} onChange={(e) => setEditing({ ...editing, showStoreInfo: e.target.checked })} />Hiển thị thông tin cửa hàng</label>
          <label className="settings-check"><input type="checkbox" checked={editing.showTax} onChange={(e) => setEditing({ ...editing, showTax: e.target.checked })} />Hiển thị thuế</label>
          <div className="settings-form-row"><label>Ghi chú cuối trang</label><input value={editing.footerNote || ""} onChange={(e) => setEditing({ ...editing, footerNote: e.target.value })} placeholder="Tùy chọn" /></div>
          <label className="settings-check"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />Kích hoạt</label>
          <div className="settings-form-actions"><button className="settings-btn-primary" onClick={save} disabled={saving}>Lưu</button><button onClick={() => setEditing(null)}>Hủy</button></div>
        </div>
      </section></div>}
    </div>
  );
}
