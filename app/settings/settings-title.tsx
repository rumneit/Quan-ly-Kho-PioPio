"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/settings", label: "Cài đặt" },
  { href: "/settings/store-info", label: "Thông tin cửa hàng" },
  { href: "/settings/branches", label: "Quản lý chi nhánh" },
  { href: "/settings/users", label: "Quản lý người dùng" },
  { href: "/settings/product-info", label: "Thông tin hàng hóa" },
  { href: "/settings/data", label: "Xóa dữ liệu" },
];

export default function SettingsTitle() {
  const pathname = usePathname();
  const match = NAV_ITEMS.find((item) => item.href === pathname) || NAV_ITEMS[0];
  return (
    <div className="settings-main-header">
      <h1>{match.label}</h1>
      <p className="settings-breadcrumb"><Link href="/settings">Cài đặt</Link> &nbsp;›&nbsp; {match.label}</p>
    </div>
  );
}