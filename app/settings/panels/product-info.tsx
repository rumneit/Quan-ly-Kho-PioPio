"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProductStats } from "../actions";

export function ProductInfoPanel() {
  const [stats, setStats] = useState<{ categories: number; brands: number; products: number; groups: number } | null>(null);
  useEffect(() => { getProductStats().then(setStats).catch(() => setStats({ categories: 0, brands: 0, products: 0, groups: 0 })); }, []);
  const items = [
    { label: "Mã vạch hàng hóa", value: "Hỗ trợ mã vạch chuẩn & mã vạch tự tạo", href: "/products" },
    { label: "Tự động gợi ý thông tin hàng hóa", value: "Gợi ý tên, mã, mô tả, hình ảnh khi tạo", href: "/products" },
    { label: "Đơn vị tính", value: "Quản lý theo đơn vị (chiếc, lốc, thùng)", href: "/products" },
    { label: "Thuộc tính", value: "Theo đặc điểm (màu sắc, kích cỡ, chất liệu)", href: "/products" },
    { label: "Nhóm hàng", value: stats ? `${stats.categories} nhóm hàng` : "—", href: "/products" },
    { label: "Thương hiệu", value: stats ? `${stats.brands} thương hiệu` : "—", href: "/products" },
    { label: "Sản phẩm", value: stats ? `${stats.products} sản phẩm` : "—", href: "/products" },
    { label: "Phương pháp tính giá vốn", value: "Giá vốn cố định / Giá vốn trung bình", href: "/settings/store" },
    { label: "Phân quyền theo nhóm hàng", value: "Phân quyền chi tiết từng nhân viên", href: "/settings/user-permissions" },
  ];
  return (
    <div className="settings-section">
      <div className="settings-info-grid settings-info-grid-compact">
        {items.map((s) => (
          <article key={s.label}>
            <h4>{s.label}</h4>
            <p>{s.value}</p>
            {s.href && <Link href={s.href}>Mở trang liên quan</Link>}
          </article>
        ))}
      </div>
    </div>
  );
}