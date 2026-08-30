"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/settings/store-info", label: "Thông tin cửa hàng" },
  { href: "/settings/store", label: "Cửa hàng & Hàng hóa" },
  { href: "/settings/currency", label: "Quản lý tiền tệ" },
  { href: "/settings/branches", label: "Quản lý chi nhánh" },
  { href: "/settings/users", label: "Quản lý người dùng" },
  { href: "/settings/user-permissions", label: "Phân quyền nhóm hàng" },
  { href: "/settings/security", label: "Bảo mật" },
  { href: "/settings/api", label: "Kết nối API" },
  { href: "/settings/print-templates", label: "Mẫu in" },
  { href: "/settings/product-info", label: "Thông tin hàng hóa" },
  { href: "/settings/book-closing", label: "Khóa sổ" },
  { href: "/settings/audit-log", label: "Lịch sử thao tác" },
  { href: "/settings/devices", label: "Thiết bị" },
  { href: "/settings/data", label: "Xóa dữ liệu" },
];

export default function SettingsSidebar({ header }: { header?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <aside className="settings-sidebar">
      {header}
      <nav>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (pathname === "/settings" && item.href === "/settings/store-info");
          return <Link key={item.href} href={item.href} className={active ? "active" : ""}>{item.label}</Link>;
        })}
      </nav>
    </aside>
  );
}