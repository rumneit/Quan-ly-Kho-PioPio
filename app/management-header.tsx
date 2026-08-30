"use client";
import Link from "next/link";
import { Bell, Settings, ShoppingCart, LogOut, User, Building2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/auth";

export type ManagementSection =
  | "dashboard" | "products" | "pricebook" | "stocktakes" | "internal-use" | "damage-items"
  | "suppliers" | "purchase-orders" | "purchase-returns"
  | "orders" | "invoices" | "returns" | "delivery-partners" | "waybills"
  | "customers" | "cashflow" | "end-of-day-report"
  | "sale-report" | "order-report" | "product-report" | "customer-report" | "supplier-report" | "sale-channel-report" | "financial-report"
  | "settings" | "settings-store" | "settings-branches" | "settings-users" | "settings-product-info" | "settings-data";

export default function ManagementHeader({ profile, active }: { profile: Profile; active: ManagementSection }) {
  const initials = profile.full_name.split(" ").map((item) => item[0]).slice(-2).join("").toUpperCase() || "QL";
  const orderActive = ["orders", "invoices", "returns", "delivery-partners", "waybills"].includes(active);
  const reportActive = ["end-of-day-report", "sale-report", "order-report", "product-report", "customer-report", "supplier-report", "sale-channel-report", "financial-report"].includes(active);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { setNotifOpen(false); setUserOpen(false); } }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onKey); };
  }, []);

  return <>
    <header className="kv-header">
      <Link className="kv-brand" href="/dashboard"><span className="kv-brand-symbol"><i /><i /></span><strong>PioPio</strong></Link>
      <div className="kv-header-actions">
        <div ref={notifRef} style={{position:"relative"}}>
          <button className="kv-round" aria-label="Thông báo" aria-haspopup="true" aria-expanded={notifOpen} onClick={()=> setNotifOpen(v=>!v)}><Bell size={20} /></button>
          {notifOpen && <div role="dialog" aria-label="Thông báo" style={{position:"absolute", right:0, top:"42px", width:"320px", background:"#fff", border:"1px solid #e1e3e6", borderRadius:"8px", boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:80, overflow:"hidden"}}>
            <div style={{padding:"14px 16px", borderBottom:"1px solid #eef2f4", display:"flex", justifyContent:"space-between", alignItems:"center"}}><strong style={{fontSize:"13px"}}>Thông báo</strong><Link href="/dashboard" onClick={()=>setNotifOpen(false)} style={{fontSize:"11px", color:"#0070f4", textDecoration:"none"}}>Xem tổng quan</Link></div>
            <div style={{padding:"16px", fontSize:"12px", color:"#525d6a", lineHeight:"1.6"}}>
              <p style={{margin:"0 0 8px"}}>• Hệ thống đang hoạt động bình thường.</p>
              <p style={{margin:"0 0 8px"}}>• Kiểm tra <Link href="/products" style={{color:"#0070f4"}}>tồn kho</Link> và <Link href="/invoices" style={{color:"#0070f4"}}>hóa đơn</Link> mới từ dashboard.</p>
              <p style={{margin:0, color:"#8895a3", fontSize:"11px"}}>Múi giờ: Asia/Ho_Chi_Minh (VN)</p>
            </div>
          </div>}
        </div>
        <Link className="kv-round" aria-label="Cài đặt" href="/settings"><Settings size={20} /></Link>
        <div ref={userRef} style={{position:"relative"}}>
          <button className="kv-avatar" aria-label="Tài khoản" aria-haspopup="true" aria-expanded={userOpen} onClick={()=> setUserOpen(v=>!v)}>{initials}</button>
          {userOpen && <div role="menu" style={{position:"absolute", right:0, top:"42px", width:"260px", background:"#fff", border:"1px solid #e1e3e6", borderRadius:"8px", boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:80, overflow:"hidden"}}>
            <div style={{padding:"16px", borderBottom:"1px solid #eef2f4"}}>
              <div style={{fontWeight:600, fontSize:"13px"}}>{profile.full_name}</div>
              <div style={{fontSize:"11px", color:"#667085"}}>@{profile.username} • {profile.role==="manager" ? "Quản lý":"Bán hàng"}</div>
            </div>
            <div style={{padding:"8px"}}>
              <Link href="/settings" role="menuitem" onClick={()=>setUserOpen(false)} style={{display:"flex", alignItems:"center", gap:"8px", padding:"10px", borderRadius:"6px", textDecoration:"none", color:"#344054", fontSize:"12px"}}><User size={16}/> Hồ sơ & Cài đặt</Link>
              <Link href="/settings-branches" role="menuitem" onClick={()=>setUserOpen(false)} style={{display:"flex", alignItems:"center", gap:"8px", padding:"10px", borderRadius:"6px", textDecoration:"none", color:"#344054", fontSize:"12px"}}><Building2 size={16}/> Chi nhánh</Link>
              <form action="/auth/signout" method="post" style={{margin:0}}>
                <button role="menuitem" style={{display:"flex", alignItems:"center", gap:"8px", width:"100%", padding:"10px", border:0, background:"transparent", color:"#c53434", fontSize:"12px", textAlign:"left", cursor:"pointer"}}><LogOut size={16}/> Đăng xuất</button>
              </form>
            </div>
          </div>}
        </div>
      </div>
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
