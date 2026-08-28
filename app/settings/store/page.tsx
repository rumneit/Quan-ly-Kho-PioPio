"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { getStoreSettings, updateStoreSettings } from "../actions";

export default function StoreSettingsPage() {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getStoreSettings>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { getStoreSettings().then((s) => { setSettings(s); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const update = (patch: Parameters<typeof updateStoreSettings>[0]) => {
    setSaving(true); setMessage("");
    startTransition(async () => {
      try {
        const next = await updateStoreSettings(patch);
        setSettings(next);
        setMessage("Đã lưu.");
      } catch (e: unknown) { setMessage("Lỗi: " + (e instanceof Error ? e.message : "Không thể lưu.")); }
      setSaving(false);
    });
  };

  if (loading) return <div className="settings-loading">Đang tải...</div>;
  if (!settings) return <div className="settings-loading">Không thể tải thiết lập.</div>;

  return (
    <div className="settings-section">
      {message && <div className="settings-toast">{message}</div>}

      <article className="settings-form-card">
        <h3>Phương pháp tính giá vốn</h3>
        <div className="settings-radio-group">
          <label className={`settings-radio ${settings.costMethod === "fixed" ? "active" : ""}`} onClick={() => update({ costMethod: "fixed" })}>
            <input type="radio" name="cost" checked={settings.costMethod === "fixed"} readOnly />Giá vốn cố định
          </label>
          <label className={`settings-radio ${settings.costMethod === "average" ? "active" : ""}`} onClick={() => update({ costMethod: "average" })}>
            <input type="radio" name="cost" checked={settings.costMethod === "average"} readOnly />Giá vốn trung bình
          </label>
        </div>
        <p className="settings-hint">{settings.costMethod === "fixed" ? "Giá vốn được xác định theo giá nhập đầu tiên hoặc do người dùng tự nhập." : "Giá vốn được tính theo phương pháp trung bình dựa trên giao dịch nhập hàng và trả hàng nhập."}</p>
      </article>

      <article className="settings-form-card">
        <h3>Quản lý tồn kho theo Lô, hạn sử dụng</h3>
        <label className="settings-toggle"><input type="checkbox" checked={settings.trackLotExpiry} onChange={(e) => update({ trackLotExpiry: e.target.checked })} /><span /></label>
        <p className="settings-hint">Theo dõi các hàng hóa như thực phẩm hoặc thuốc theo Lô, hạn sử dụng trong mọi giao dịch.</p>
      </article>

      <article className="settings-form-card">
        <h3>Sản xuất hàng hóa</h3>
        <label className="settings-toggle"><input type="checkbox" checked={settings.manufacturingEnabled} onChange={(e) => update({ manufacturingEnabled: e.target.checked })} /><span /></label>
        <p className="settings-hint">Cho phép thiết lập nguyên liệu thành phần và ghi nhận hàng hóa thành phẩm.</p>
      </article>

      <article className="settings-form-card">
        <h3>Cho phép thay đổi thời gian giao dịch</h3>
        <label className="settings-toggle"><input type="checkbox" checked={settings.allowChangeTransactionTime} onChange={(e) => update({ allowChangeTransactionTime: e.target.checked })} /><span /></label>
      </article>

      <article className="settings-form-card">
        <h3>Cho phép giao dịch khi hết tồn kho</h3>
        <label className="settings-toggle"><input type="checkbox" checked={settings.allowNegativeStock} onChange={(e) => update({ allowNegativeStock: e.target.checked })} /><span /></label>
      </article>

      <article className="settings-form-card">
        <h3>Thời gian hoạt động</h3>
        <div className="settings-radio-group">
          {[
            { value: 0, label: "Sắp mở" },
            { value: 1, label: "< 1 năm" },
            { value: 2, label: "1 - 5 năm" },
            { value: 3, label: "Nhiều hơn 5 năm" },
          ].map((opt) => (
            <label key={opt.value} className={`settings-radio ${settings.workingTimeBand === opt.value ? "active" : ""}`} onClick={() => update({ workingTimeBand: opt.value })}>
              <input type="radio" name="workingTime" checked={settings.workingTimeBand === opt.value} readOnly />{opt.label}
            </label>
          ))}
        </div>
      </article>

      <article className="settings-form-card">
        <h3>Tiền tệ</h3>
        <select className="settings-select" value={settings.currency} onChange={(e) => update({ currency: e.target.value })}>
          <option value="VND">VND (₫)</option>
          <option value="USD">USD ($)</option>
        </select>
      </article>
    </div>
  );
}
