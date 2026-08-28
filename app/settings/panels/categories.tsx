"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProductGroups } from "../actions";

export function CategoriesPanel() {
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getProductGroups().then((g) => { setGroups(g); setLoading(false); }); }, []);
  if (loading) return <div className="settings-loading">Đang tải...</div>;
  return (
    <div className="settings-section">
      <p className="settings-hint" style={{ marginBottom: 12 }}>Quản lý nhóm hàng để phân loại và thống kê theo chủng loại. Thêm/sửa nhóm được thực hiện ngay trên trang Danh sách hàng hóa.</p>
      <div className="settings-categories">
        {groups.map((g) => <div key={g.id} className="settings-category-chip">{g.name}</div>)}
        {!groups.length && <p className="settings-empty">Chưa có nhóm hàng nào.</p>}
      </div>
      <div className="settings-form-actions" style={{ marginTop: 16 }}><Link href="/products" className="settings-btn-primary">Mở Danh sách hàng hóa</Link></div>
    </div>
  );
}