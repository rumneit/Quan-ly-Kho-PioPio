import Link from "next/link";
import { Bell, Settings, ShoppingCart } from "lucide-react";
import type { Profile } from "@/lib/auth";

export type ManagementSection =
  | "dashboard" | "products" | "pricebook" | "stocktakes" | "internal-use" | "damage-items"
  | "suppliers" | "purchase-orders" | "purchase-returns"
  | "orders" | "invoices" | "returns" | "delivery-partners" | "waybills"
  | "customers" | "cashflow" | "end-of-day-report"
  | "sale-report" | "order-report" | "product-report" | "customer-report" | "supplier-report" | "sale-channel-report" | "financial-report";

export default function ManagementHeader({ profile, active }: { profile: Profile; active: ManagementSection }) {
  const initials = profile.full_name.split(" ").map((item) => item[0]).slice(-2).join("");
  const orderActive = ["orders", "invoices", "returns", "delivery-partners", "waybills"].includes(active);
  const reportActive = ["end-of-day-report", "sale-report", "order-report", "product-report", "customer-report", "supplier-report", "sale-channel-report", "financial-report"].includes(active);
  return <>
    <header className="kv-header">
      <Link className="kv-brand" href="/dashboard"><span className="kv-brand-symbol"><i /><i /></span><strong>PioPio</strong></Link>
      <div className="kv-header-actions"><button className="kv-round" aria-label="Thông báo"><Bell size={20} /></button><button className="kv-round" aria-label="Cài đặt"><Settings size={20} /></button><button className="kv-avatar">{initials}</button></div>
    </header>
    <nav className="kv-horizontal-nav" aria-label="Menu quản lý"><div className="kv-horizontal-items">
      <Link className={`kv-top-item ${active === "dashboard" ? "active" : ""}`} href="/dashboard">Tổng quan</Link>
      <div className="kv-nav-dropdown"><button className={`kv-top-item ${["products", "pricebook", "stocktakes", "internal-use", "damage-items"].includes(active) ? "active" : ""}`} aria-haspopup="true">Hàng hóa</button><div className="kv-submenu"><section><h3>Hàng hóa</h3><Link className={active === "products" ? "active" : ""} href="/products">Danh sách hàng hóa</Link><Link className={active === "pricebook" ? "active" : ""} href="/pricebook">Thiết lập giá</Link></section><section><h3>Kho hàng</h3><Link className={active === "stocktakes" ? "active" : ""} href="/stocktakes">Kiểm kho</Link><Link className={active === "internal-use" ? "active" : ""} href="/internal-use">Xuất dùng nội bộ</Link><Link className={active === "damage-items" ? "active" : ""} href="/damage-items">Xuất hủy</Link></section></div></div>
      <div className="kv-nav-dropdown"><button className={`kv-top-item ${["suppliers", "purchase-orders", "purchase-returns"].includes(active) ? "active" : ""}`} aria-haspopup="true">Mua hàng</button><div className="kv-submenu"><section><h3>Nhà cung cấp</h3><Link className={active === "suppliers" ? "active" : ""} href="/suppliers">Nhà cung cấp</Link></section><section><h3>Mua hàng</h3><Link className={active === "purchase-orders" ? "active" : ""} href="/purchase-orders">Nhập hàng</Link><Link className={active === "purchase-returns" ? "active" : ""} href="/purchase-returns">Trả hàng nhập</Link></section></div></div>
      <div className="kv-nav-dropdown"><button className={`kv-top-item ${orderActive ? "active" : ""}`} aria-haspopup="true">Đơn hàng</button><div className="kv-submenu order-submenu"><section><Link className={active === "orders" ? "active" : ""} href="/orders">Đặt hàng</Link><Link className={active === "invoices" ? "active" : ""} href="/invoices">Hóa đơn</Link><Link className={active === "returns" ? "active" : ""} href="/returns">Trả hàng</Link><Link className={active === "delivery-partners" ? "active" : ""} href="/delivery-partners">Đối tác giao hàng</Link><Link className={active === "waybills" ? "active" : ""} href="/waybills">Vận đơn</Link></section></div></div>
      <div className="kv-nav-dropdown"><button className={`kv-top-item ${active === "customers" ? "active" : ""}`} aria-haspopup="true">Khách hàng</button><div className="kv-submenu customer-submenu"><section><h3>Khách hàng</h3><Link className={active === "customers" ? "active" : ""} href="/customers">Khách hàng</Link></section></div></div>
      <Link className={`kv-top-item ${active === "cashflow" ? "active" : ""}`} href="/cashflow">Sổ quỹ</Link>
      <div className="kv-nav-dropdown"><button className={`kv-top-item ${reportActive ? "active" : ""}`} aria-haspopup="true">Báo cáo</button><div className="kv-submenu report-submenu"><section><h3>Báo cáo</h3><Link className={active === "end-of-day-report" ? "active" : ""} href="/end-of-day-report">Cuối ngày</Link><Link className={active === "sale-report" ? "active" : ""} href="/sale-report">Bán hàng</Link><Link className={active === "order-report" ? "active" : ""} href="/order-report">Đặt hàng</Link><Link className={active === "product-report" ? "active" : ""} href="/product-report">Hàng hóa</Link><Link className={active === "customer-report" ? "active" : ""} href="/customer-report">Khách hàng</Link><Link className={active === "supplier-report" ? "active" : ""} href="/supplier-report">Nhà cung cấp</Link><Link className={active === "sale-channel-report" ? "active" : ""} href="/sale-channel-report">Kênh bán hàng</Link><Link className={active === "financial-report" ? "active" : ""} href="/financial-report">Tài chính</Link></section></div></div>
      <span className="kv-top-item">Bán online</span>
    </div><Link className="kv-sale-link" href="/sales"><ShoppingCart size={20} />Bán hàng</Link></nav>
  </>;
}
