import Link from "next/link";
import { Bell, Settings, ShoppingCart } from "lucide-react";
import type { Profile } from "@/lib/auth";

const ITEMS = ["Mua hàng", "Đơn hàng", "Khách hàng", "Nhân viên", "Sổ quỹ", "Báo cáo", "Bán online", "Thuế & Kế toán"];

export default function ManagementHeader({ profile, active }: { profile: Profile; active: "dashboard" | "products" | "pricebook" }) {
  const initials = profile.full_name.split(" ").map((item) => item[0]).slice(-2).join("");
  return <>
    <header className="kv-header"><Link className="kv-brand" href="/dashboard"><span className="kv-brand-symbol"><i /><i /></span><strong>PioPio</strong></Link><div className="kv-header-actions"><button className="kv-round" aria-label="Thông báo"><Bell size={20} /></button><button className="kv-round" aria-label="Cài đặt"><Settings size={20} /></button><button className="kv-avatar">{initials}</button></div></header>
    <nav className="kv-horizontal-nav" aria-label="Menu quản lý"><div className="kv-horizontal-items"><Link className={`kv-top-item ${active === "dashboard" ? "active" : ""}`} href="/dashboard">Tổng quan</Link><div className="kv-nav-dropdown"><button className={`kv-top-item ${active === "products" || active === "pricebook" ? "active" : ""}`} aria-haspopup="true">Hàng hóa</button><div className="kv-submenu"><section><h3>Hàng hóa</h3><Link className={active === "products" ? "active" : ""} href="/products">Danh sách hàng hóa</Link><Link className={active === "pricebook" ? "active" : ""} href="/pricebook">Thiết lập giá</Link></section><section><h3>Kho hàng</h3><span>Kiểm kho</span><span>Xuất dùng nội bộ</span><span>Xuất hủy</span></section></div></div>{ITEMS.map((item) => <span className="kv-top-item" key={item}>{item}</span>)}</div><Link className="kv-sale-link" href="/sales"><ShoppingCart size={20} />Bán hàng</Link></nav>
  </>;
}
