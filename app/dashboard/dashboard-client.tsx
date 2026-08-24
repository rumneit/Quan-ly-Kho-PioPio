"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/auth";

type Product = { id: string; name: string; sku: string; price: number; stock_quantity: number; active: boolean };
type Props = { profile: Profile; products: Product[]; metrics: { revenue: number; orders: number; customers: number; lowStock: number } };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function DashboardClient({ profile, products: initialProducts, metrics }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"product" | "staff" | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const filteredProducts = useMemo(() => products.filter(product => `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase())), [products, query]);

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(result.error); return; }
    setProducts(current => [result.product, ...current]); setModal(null); setMessage("Đã thêm sản phẩm thành công.");
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(result.error); return; }
    setModal(null); setMessage(`Đã tạo tài khoản ${result.user.username}.`);
  }

  return <div className="secure-app">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">P</span><div><strong>PioPio</strong><small>Khu vực Quản lý</small></div></div><nav className="main-nav"><p className="nav-label">VẬN HÀNH</p><button className="nav-item active"><span>⌂</span>Tổng quan</button><Link className="nav-item nav-link" href="/sales"><span>▣</span>Sang Bán hàng</Link><button className="nav-item"><span>▤</span>Đơn hàng</button><button className="nav-item"><span>◇</span>Sản phẩm</button><button className="nav-item"><span>▧</span>Kho hàng</button><button className="nav-item"><span>♙</span>Khách hàng</button>{profile.role === "manager" && <><p className="nav-label">QUẢN TRỊ</p><button className="nav-item" onClick={() => setModal("staff")}><span>♧</span>Nhân viên</button><button className="nav-item"><span>↗</span>Báo cáo</button><button className="nav-item"><span>⚙</span>Thiết lập</button></>}</nav></aside>
    <div className="app-shell"><header className="topbar"><div className="topbar-left"><div><h1>Tổng quan</h1><p>Dữ liệu cửa hàng được bảo vệ theo quyền truy cập</p></div></div><div className="top-actions"><span className={`role-badge ${profile.role}`}>{profile.role === "manager" ? "Quản lý" : "Bán hàng"}</span><div className="profile"><span>{profile.full_name.split(" ").map(part => part[0]).slice(-2).join("")}</span><div><strong>{profile.full_name}</strong><small>@{profile.username}</small></div></div><form action="/auth/signout" method="post"><button className="button secondary">Đăng xuất</button></form></div></header>
      <main className="content"><section className="welcome-row"><div><p className="eyebrow">TỔNG QUAN KINH DOANH</p><h2>Xin chào, {profile.full_name}</h2></div><div className="hero-actions">{profile.role === "manager" && <button className="button secondary" onClick={() => setModal("product")}>＋ Thêm sản phẩm</button>}<Link className="button primary button-link" href="/sales">▣ Mở Bán hàng</Link></div></section>
        {message && <div className="inline-message">{message}</div>}
        <section className="metrics"><article className="metric-card blue"><div className="metric-icon">₫</div><div className="metric-head"><span>Doanh thu hôm nay</span></div><strong>{money(metrics.revenue)}</strong><small>Dữ liệu đơn đã thanh toán</small></article><article className="metric-card violet"><div className="metric-icon">▤</div><div className="metric-head"><span>Đơn hàng hôm nay</span></div><strong>{metrics.orders}</strong><small>Tất cả trạng thái đơn</small></article><article className="metric-card green"><div className="metric-icon">♙</div><div className="metric-head"><span>Khách hàng</span></div><strong>{metrics.customers}</strong><small>Khách hàng trong cửa hàng</small></article><article className="metric-card orange"><div className="metric-icon">⚠</div><div className="metric-head"><span>Sắp hết hàng</span></div><strong>{metrics.lowStock}</strong><small>Tồn kho từ 5 trở xuống</small></article></section>
        <section className="panel products-panel"><div className="panel-head products-head"><div><h3>Danh sách sản phẩm</h3><p>Dữ liệu được tải trực tiếp từ Supabase</p></div><label className="search-box"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên hoặc mã hàng..." /></label></div><div className="table-scroll"><table><thead><tr><th>SẢN PHẨM</th><th>MÃ HÀNG</th><th>GIÁ BÁN</th><th>TỒN KHO</th><th>TRẠNG THÁI</th></tr></thead><tbody>{filteredProducts.map(product => <tr key={product.id}><td><div className="product"><span className="product-thumb sky">{product.name.slice(0,2).toUpperCase()}</span><strong>{product.name}</strong></div></td><td>{product.sku}</td><td><strong>{money(product.price)}</strong></td><td>{product.stock_quantity}</td><td><span className={`status ${product.stock_quantity <= 5 ? "low" : "good"}`}>{product.stock_quantity <= 5 ? "Sắp hết hàng" : product.active ? "Đang kinh doanh" : "Ngừng kinh doanh"}</span></td></tr>)}{!filteredProducts.length && <tr><td colSpan={5} className="empty-table">Chưa có sản phẩm phù hợp.</td></tr>}</tbody></table></div></section>
      </main></div>
    {modal && <div className="modal open"><button className="modal-backdrop" aria-label="Đóng" onClick={() => setModal(null)} /><form className="modal-card" onSubmit={modal === "product" ? addProduct : addStaff}><div className="modal-head"><div><h3>{modal === "product" ? "Thêm sản phẩm" : "Tạo tài khoản nhân viên"}</h3><p>{modal === "product" ? "Sản phẩm được lưu vào cơ sở dữ liệu" : "Cấp quyền Quản lý hoặc Bán hàng"}</p></div><button type="button" className="close-btn" onClick={() => setModal(null)}>×</button></div>{modal === "product" ? <div className="form-grid"><label className="full">Tên sản phẩm<input name="name" required /></label><label>Mã hàng<input name="sku" required /></label><label>Giá bán<input name="price" type="number" min="0" required /></label><label>Tồn kho<input name="stock" type="number" min="0" defaultValue="0" /></label></div> : <div className="form-grid"><label className="full">Tên nhân viên<input name="fullName" required /></label><label>Tên đăng nhập<input name="username" required minLength={3} /></label><label>Mật khẩu<input name="password" type="password" required minLength={8} /></label><label>Vai trò<select name="role"><option value="sales">Bán hàng</option><option value="manager">Quản lý</option></select></label></div>}{message && <p className="form-error">{message}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Hủy</button><button className="button primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></div></form></div>}
  </div>;
}
