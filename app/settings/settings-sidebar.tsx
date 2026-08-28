"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_GROUPS: Array<{ title: string; items: Array<{ href: string; label: string }> }> = [
  {
    title: "Quản lý",
    items: [
      { href: "/settings/store-info", label: "Thông tin cửa hàng" },
      { href: "/settings/branches", label: "Quản lý chi nhánh" },
      { href: "/settings/users", label: "Quản lý người dùng" },
    ],
  },
  {
    title: "Hàng hóa",
    items: [
      { href: "/settings/product-info", label: "Thông tin hàng hóa" },
    ],
  },
  {
    title: "Dữ liệu",
    items: [
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