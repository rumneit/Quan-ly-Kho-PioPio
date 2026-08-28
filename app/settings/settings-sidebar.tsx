"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_GROUPS: Array<{ title: string; items: Array<{ href: string; label: string }> }> = [
  {
    title: "Quản lý",
    items: [
      { href: "/settings/store-info", label: "Thông tin cửa hàng" },
      { href: "/settings/store", label: "Cửa hàng & Hàng hóa" },
      { href: "/settings/branches", label: "Quản lý chi nhánh" },
      { href: "/settings/users", label: "Quản lý người dùng" },
      { href: "/settings/user-permissions", label: "Phân quyền nhóm hàng" },
      { href: "/settings/security", label: "Bảo mật" },
      { href: "/settings/print-templates", label: "Mẫu in" },
    ],
  },
  {
    title: "Hàng hóa",
    items: [
      { href: "/settings/product-info", label: "Thông tin hàng hóa" },
    ],
  },
  {
    title: "Dữ liệu & Vận hành",
    items: [
      { href: "/settings/book-closing", label: "Khóa sổ" },
      { href: "/settings/audit-log", label: "Lịch sử thao tác" },
      { href: "/settings/devices", label: "Thiết bị" },
      { href: "/settings/data", label: "Xóa dữ liệu" },
    ],
  },
];

export default function SettingsSidebar({ header }: { header?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <aside className="settings-sidebar">
      {header}
      <nav>
        {NAV_GROUPS.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            <ul>
              {group.items.map((item) => {
                const active = pathname === item.href || (pathname === "/settings" && item.href === "/settings/store-info");
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={active ? "active" : ""}>{item.label}</Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  );
}