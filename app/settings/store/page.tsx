"use client";

import { startTransition, useEffect, useState } from "react";
import { getStoreSettingsExtended, updateStoreSettingsExtended, type StoreSettingsExtended } from "../actions";

export default function StoreSettingsPage() {
  const [settings, setSettings] = useState<StoreSettingsExtended | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { getStoreSettingsExtended().then((s) => { setSettings(s); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const update = (patch: Partial<StoreSettingsExtended>) => {
    setSaving(true); setMessage("");
    startTransition(async () => {
      try {
        const next = await updateStoreSettingsExtended(patch);
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
        <h3>Mã vạch hàng hóa</h3>
        <label className="settings-toggle"><input type="checkbox" checked={settings.barcodeManagement} onChange={(e) => update({ barcodeManagement: e.target.checked })} /><span /></label>
        <p className="settings-hint">Quản lý hàng hóa bằng mã vạch chuẩn hoặc mã vạch do cửa hàng tạo ra.</p>
      </article>

      <article className="settings-form-card">
        <h3>Tự động gợi ý thông tin hàng hóa</h3>
        <label className="settings-toggle"><input type="checkbox" checked={settings.autoSuggestProductInfo} onChange={(e) => update({ autoSuggestProductInfo: e.target.checked })} /><span /></label>
        <p className="settings-hint">Tự động gợi ý tên, mã, mô tả, hình ảnh hàng hóa khi tạo hàng hóa.</p>
      </article>

      <article className="settings-form-card">
        <h3>Phân quyền người dùng theo nhóm hàng</h3>
        <label className="settings-toggle"><input type="checkbox" checked={settings.productGroupPermissionsEnabled} onChange={(e) => update({ productGroupPermissionsEnabled: e.target.checked })} /><span /></label>
        <p className="settings-hint">Cho phép phân quyền nhân viên chỉ quản lý các nhóm hàng cụ thể.</p>
      </article>

      <article className="settings-form-card">
        <h3>Cho phép thay đổi thời gian giao dịch</h3>
        <label className="settings-toggle"><input type="checkbox" checked={settings.allowChangeTransactionTime || settings.allowChangeTransactionDate} onChange={(e) => update({ allowChangeTransactionTime: e.target.checked, allowChangeTransactionDate: e.target.checked })} /><span /></label>
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

      <article className="settings-form-card">
        <h3>Tích điểm khách hàng</h3>
        <label className="settings-toggle"><input type="checkbox" checked={settings.rewardPointsEnabled} onChange={(e) => update({ rewardPointsEnabled: e.target.checked })} /><span /></label>
        {settings.rewardPointsEnabled && (
          <div className="settings-form-row" style={{ marginTop: 8 }}>
            <label>Tỷ lệ tích điểm</label>
            <input type="number" min="1000" value={settings.rewardPointRate} onChange={(e) => update({ rewardPointRate: Number(e.target.value) })} placeholder="10000" />
          </div>
        )}
        <p className="settings-hint">Khách hàng được tích điểm khi mua hàng. Tỷ lệ: 1 điểm / {settings.rewardPointRate.toLocaleString("vi-VN")}₫.</p>
      </article>

      <article className="settings-form-card">
        <h3>Thuế & Kế toán</h3>
        <div className="settings-form-row" style={{ marginTop: 8 }}>
          <label>Thuế suất mặc định (%)</label>
          <input type="number" min="0" max="100" step="0.5" value={settings.defaultTaxRate} onChange={(e) => update({ defaultTaxRate: Number(e.target.value) })} />
        </div>
        <p className="settings-hint">Áp dụng VAT cho hóa đơn bán hàng.</p>
      </article>

      <article className="settings-form-card">
        <h3>Gửi SMS / Zalo</h3>
        <div className="settings-toggle-group">
          <label className="settings-toggle"><input type="checkbox" checked={settings.enableSms} onChange={(e) => update({ enableSms: e.target.checked })} /><span /></label><span className="settings-toggle-label">SMS</span>
          <label className="settings-toggle"><input type="checkbox" checked={settings.enableZalo} onChange={(e) => update({ enableZalo: e.target.checked })} /><span /></label><span className="settings-toggle-label">Zalo</span>
        </div>
        <p className="settings-hint">Gửi thông báo cho khách hàng qua SMS hoặc Zalo.</p>
      </article>

      <article className="settings-form-card">
        <h3>Giao hàng & Thanh toán</h3>
        <label className="settings-toggle"><input type="checkbox" checked={settings.enableDelivery} onChange={(e) => update({ enableDelivery: e.target.checked })} /><span /></label><span style={{ marginLeft: 8 }}>Giao hàng</span>
        <label className="settings-toggle" style={{ marginTop: 8 }}><input type="checkbox" checked={settings.enablePaymentGateway} onChange={(e) => update({ enablePaymentGateway: e.target.checked })} /><span /></label><span style={{ marginLeft: 8 }}>Cổng thanh toán</span>
      </article>
    </div>
  );
}