"use client";

import { startTransition, useEffect, useState } from "react";
import { getDevices, unpairDevice, type Device } from "../actions";

const KIND_LABELS: Record<string, string> = { scanner: "Máy quét", printer: "Máy in", scale: "Cân điện tử", pos: "Máy POS", other: "Khác" };

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = () => { getDevices().then((d) => { setDevices(d); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const unpair = (id: string) => {
    setMessage("");
    startTransition(async () => {
      try { await unpairDevice(id); setMessage("Đã hủy ghép thiết bị."); load(); } catch (e: unknown) { setMessage("Lỗi: " + (e instanceof Error ? e.message : "")); }
    });
  };

  if (loading) return <div className="settings-loading">Đang tải...</div>;
  return (
    <div className="settings-section">
      {message && <div className="settings-toast">{message}</div>}
      <table className="settings-table">
        <thead><tr><th>Tên thiết bị</th><th>Loại</th><th>Mã thiết bị</th><th>Lần cuối hoạt động</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.id}>
              <td>{d.name}</td>
              <td>{KIND_LABELS[d.kind] || d.kind}</td>
              <td>{d.identifier}</td>
              <td>{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString("vi-VN") : "—"}</td>
              <td>{d.active ? "Đang kết nối" : "Mất kết nối"}</td>
              <td><button className="settings-btn-danger" onClick={() => unpair(d.id)}>Hủy ghép</button></td>
            </tr>
          ))}
          {!devices.length && <tr><td colSpan={6} className="settings-empty">Chưa có thiết bị nào được ghép với cửa hàng.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
