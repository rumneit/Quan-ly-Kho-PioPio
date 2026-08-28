"use client";

import { startTransition, useEffect, useState } from "react";
import { getStoreUsers, getProductGroups, getUserProductGroupPermissions, setUserProductGroupPermissions, type StoreUser } from "../actions";

export default function UserPermissionsPage() {
  const [users, setUsers] = useState<StoreUser[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [permissions, setPermissions] = useState<{ userId: string; categoryId: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([getStoreUsers(), getProductGroups(), getUserProductGroupPermissions()]).then(([u, g, p]) => {
      setUsers(u); setGroups(g); setPermissions(p);
      if (u.length) { const uid = u[0].id; setSelectedUser(uid); setSelectedGroups(p.filter((x) => x.userId === uid).map((x) => x.categoryId)); }
      setLoading(false);
    });
  }, []);

  const selectUser = (id: string) => {
    setSelectedUser(id);
    setSelectedGroups(permissions.filter((x) => x.userId === id).map((x) => x.categoryId));
  };
  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const save = () => {
    if (!selectedUser) return;
    setSaving(true); setMessage("");
    startTransition(async () => {
      try { await setUserProductGroupPermissions(selectedUser, selectedGroups); setMessage("Đã lưu."); } catch (e: unknown) { setMessage("Lỗi: " + (e instanceof Error ? e.message : "")); }
      setSaving(false);
    });
  };

  if (loading) return <div className="settings-loading">Đang tải...</div>;
  return (
    <div className="settings-section">
      {message && <div className="settings-toast">{message}</div>}
      <div className="settings-form-row">
        <label>Chọn nhân viên</label>
        <select value={selectedUser} onChange={(e) => selectUser(e.target.value)}>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>)}
        </select>
      </div>
      <div className="settings-permission-grid">
        {groups.map((g) => (
          <label key={g.id} className={`settings-check ${selectedGroups.includes(g.id) ? "active" : ""}`} onClick={() => toggleGroup(g.id)}>
            <input type="checkbox" checked={selectedGroups.includes(g.id)} readOnly />{g.name}
          </label>
        ))}
        {!groups.length && <p className="settings-hint">Chưa có nhóm hàng nào.</p>}
      </div>
      <div className="settings-form-actions">
        <button onClick={save} className="settings-btn-primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu phân quyền"}</button>
      </div>
    </div>
  );
}
