"use client";

import { useEffect, useState } from "react";
import { getAuditLog, type AuditEntry } from "../actions";

const ACTION_LABELS: Record<string, string> = {
  "settings.update": "Cập nhật thiết lập",
  "settings.password_change": "Đổi mật khẩu",
  "settings.permissions.update": "Cập nhật phân quyền",
  "settings.book_lock": "Khóa sổ",
  "settings.book_unlock": "Mở khóa sổ",
  "settings.print_template.save": "Lưu mẫu in",
  "settings.device.unpair": "Hủy ghép thiết bị",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getAuditLog().then((l) => { setLogs(l); setLoading(false); }).catch(() => setLoading(false)); }, []);

  if (loading) return <div className="settings-loading">Đang tải...</div>;
  return (
    <div className="settings-section">
      <table className="settings-table">
        <thead><tr><th>Thời gian</th><th>Người thao tác</th><th>Hành động</th><th>Đối tượng</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{new Date(l.createdAt).toLocaleString("vi-VN")}</td>
              <td>{l.actor || "—"}</td>
              <td>{ACTION_LABELS[l.action] || l.action}</td>
              <td>{l.entity}</td>
            </tr>
          ))}
          {!logs.length && <tr><td colSpan={4} className="settings-empty">Chưa có thao tác nào được ghi lại.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
