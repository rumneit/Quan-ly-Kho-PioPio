"use client";

import { startTransition, useState } from "react";
import { deleteStoreTransactions, deleteAllStoreData } from "../actions";

export default function DataDangerPage() {
  const [mode, setMode] = useState<"transactions" | "all" | null>(null);
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const close = () => { setMode(null); setConfirmCheck(false); setPassword(""); };

  const run = () => {
    if (!confirmCheck) { setMessage({ type: "err", text: "Bạn phải tích vào ô xác nhận." }); return; }
    if (!password) { setMessage({ type: "err", text: "Vui lòng nhập mật khẩu." }); return; }
    setSaving(true); setMessage(null);
    startTransition(async () => {
      const res = mode === "all" ? await deleteAllStoreData(password) : await deleteStoreTransactions(password);
      if (res.ok) { setMessage({ type: "ok", text: "Đã xóa dữ liệu thành công." }); close(); }
      else { setMessage({ type: "err", text: res.error || "Không thể xóa dữ liệu." }); }
      setSaving(false);
    });
  };

  return (
    <div className="settings-section settings-danger">
      <div className="settings-danger-warning"><strong>⚠ Khu vực nguy hiểm</strong><p>Các thao tác dưới đây sẽ xóa dữ liệu thật của cửa hàng. Không thể hoàn tác. Hãy sao lưu trước khi thực hiện.</p></div>
      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <article>
        <h3>Xóa giao dịch và thu chi</h3>
        <p>Chỉ xóa dữ liệu Giao dịch, Thu chi. Giữ lại Hàng hóa, Đối tác. Các báo cáo phân tích sẽ được tính toán lại.</p>
        <button className="settings-btn-primary" onClick={() => { setMode("transactions"); setMessage(null); }} disabled={saving}>Xóa giao dịch và thu chi</button>
      </article>

      <article>
        <h3>Xóa toàn bộ dữ liệu</h3>
        <p>Xóa toàn bộ Giao dịch, Thu chi, Hàng hóa, Đối tác và các dữ liệu khác ngoại trừ Người dùng, Chi nhánh, Cài đặt.</p>
        <button className="settings-btn-danger" onClick={() => { setMode("all"); setMessage(null); }} disabled={saving}>Xóa toàn bộ dữ liệu</button>
      </article>

      {mode && (
        <div className="modal-backdrop" onClick={close}>
          <section className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{mode === "all" ? "Xóa toàn bộ dữ liệu" : "Xóa giao dịch và thu chi"}</h3>
            <p className="settings-hint" style={{ marginBottom: 12 }}>
              {mode === "all"
                ? "Thao tác này sẽ xóa vĩnh viễn toàn bộ dữ liệu của cửa hàng (trừ Người dùng, Chi nhánh, Cài đặt)."
                : "Thao tác này sẽ xóa vĩnh viễn các giao dịch và phiếu thu chi. Hàng hóa và đối tác được giữ lại."}
            </p>
            <label className="settings-check" style={{ marginBottom: 12 }}><input type="checkbox" checked={confirmCheck} onChange={(e) => setConfirmCheck(e.target.checked)} />Tôi đã đọc kỹ và hiểu rõ tác động của việc xóa dữ liệu.</label>
            <div className="settings-form">
              <div className="settings-form-row"><label>Mật khẩu</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu để xác nhận" /></div>
            </div>
            <div className="settings-form-actions">
              <button className="settings-btn-primary" onClick={run} disabled={saving}>{saving ? "Đang xóa..." : "Xác nhận xóa"}</button>
              <button onClick={close} disabled={saving}>Hủy</button>
            </div>
          </section>
        </div>
      )}

      <p className="settings-danger-note">Lưu ý: Các thao tác xóa yêu cầu nhập mật khẩu và tích xác nhận. Toàn bộ thao tác xóa đều được ghi vào Lịch sử thao tác.</p>
    </div>
  );
}