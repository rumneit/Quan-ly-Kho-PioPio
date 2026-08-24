"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type { Profile } from "@/lib/auth";

type Product = { id: string; name: string; sku: string; price: number; stock_quantity: number; active: boolean };
type Props = { profile: Profile; products: Product[]; metrics: { revenue: number; orders: number; customers: number; lowStock: number } };
type MenuGroup = { title: string; badge?: string; sections: Array<{ label?: string; items: string[] }> };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

const menuGroups: MenuGroup[] = [
  { title: "Hàng hóa", sections: [{ label: "Hàng hóa", items: ["Danh sách hàng hóa", "Thiết lập giá"] }, { label: "Kho hàng", items: ["Kiểm kho", "Xuất dùng nội bộ", "Xuất hủy"] }] },
  { title: "Mua hàng", sections: [{ label: "Nhà cung cấp", items: ["Nhà cung cấp", "Hóa đơn đầu vào|Mới"] }, { label: "Mua hàng", items: ["Nhập hàng", "Trả hàng nhập"] }, { label: "Mua dịch vụ", items: ["Mua dịch vụ|Mới"] }] },
  { title: "Đơn hàng", sections: [{ items: ["Đặt hàng", "Hóa đơn", "Trả hàng", "Đối tác giao hàng", "Vận đơn"] }] },
  { title: "Khách hàng", sections: [{ label: "Khách hàng", items: ["Khách hàng"] }, { label: "Kênh tiếp cận", items: ["Cửa hàng online trên Zalo|Mới"] }] },
  { title: "Nhân viên", sections: [{ items: ["Danh sách nhân viên", "Lịch làm việc", "Bảng chấm công", "Bảng lương", "Bảng hoa hồng", "Thiết lập nhân viên"] }] },
  { title: "Sổ quỹ", sections: [{ items: ["Sổ quỹ"] }] },
  { title: "Báo cáo", sections: [{ label: "Báo cáo", items: ["Cuối ngày", "Bán hàng", "Đặt hàng", "Hàng hóa", "Khách hàng", "Nhà cung cấp", "Nhân viên", "Kênh bán hàng", "Tài chính"] }] },
  { title: "Bán online", sections: [{ items: ["Bán online", "Website bán hàng"] }] },
  { title: "Thuế & Kế toán", badge: "Mới", sections: [{ items: ["Thuế & Kế toán", "Hóa đơn điện tử"] }] },
];
const horizontalItems = ["Tổng quan", "Hàng hóa", "Mua hàng", "Đơn hàng", "Khách hàng", "Nhân viên", "Sổ quỹ", "Báo cáo", "Bán online", "Thuế & Kế toán"];

export default function DashboardClient({ profile, products: initialProducts, metrics }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"product" | "staff" | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const filteredProducts = useMemo(() => products.filter(product => `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const initials = profile.full_name.split(" ").map(part => part[0]).slice(-2).join("");

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

  return <div className="kv-shell">
    <header className="kv-header">
      <button className={`kv-menu-button ${menuOpen ? "active" : ""}`} aria-label="Mở menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><i /><i /><i /></button>
      <Link className="kv-brand" href="/dashboard"><span className="kv-brand-symbol"><i /><i /></span><strong>PioPio</strong></Link>
      <div className="kv-header-actions"><button className="kv-round" aria-label="Thông báo">♢<i /></button><button className="kv-round" aria-label="Cài đặt">⚙</button><button className="kv-avatar" aria-label={profile.full_name}>{initials}</button></div>
    </header>

    <nav className="kv-horizontal-nav" aria-label="Menu quản lý"><div>{horizontalItems.map(item => <button key={item} className={item === "Tổng quan" ? "active" : ""} onClick={() => item !== "Tổng quan" && setMenuOpen(true)}>{item}</button>)}</div><Link href="/sales"><span>▣</span>Bán hàng</Link></nav>

    <div className={`kv-drawer ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen}>
      <button className="kv-drawer-backdrop" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />
      <aside><div className="kv-drawer-head"><strong>Tổng quan</strong><button onClick={() => setMenuOpen(false)}>←</button></div><nav className="kv-menu-list">{menuGroups.map(group => <section key={group.title}><h3>{group.title}{group.badge && <em>{group.badge}</em>}</h3>{group.sections.map((section,index) => <div key={`${group.title}-${index}`}>{section.label && <p>{section.label}</p>}{section.items.map(rawItem => { const [item,badge] = rawItem.split("|"); return <button key={rawItem} onClick={() => { if (item === "Danh sách nhân viên") { setMenuOpen(false); setModal("staff"); } }}>{item}{badge && <em>{badge}</em>}</button>; })}</div>)}</section>)}</nav><div className="kv-drawer-actions"><Link href="/sales">▣ Bán hàng</Link></div></aside>
    </div>

    <main className="kv-main">
      {message && <div className="kv-toast-message">✓ {message}</div>}
      <div className="kv-dashboard-grid">
        <div className="kv-main-column">
          <section className="kv-card kv-today-card kv-enter"><h2>Kết quả bán hàng hôm nay</h2><div className="kv-today-stats"><article><span className="kv-stat-icon blue">$</span><div><small>Doanh thu</small><strong>{money(metrics.revenue)}</strong><p>{metrics.orders} hóa đơn</p></div></article><article><span className="kv-stat-icon orange">↩</span><div><small>Trả hàng</small><strong>0</strong></div></article></div></section>
          <section className="kv-card kv-chart-card kv-enter delay-1"><div className="kv-card-title"><h2>Doanh thu thuần <b>{money(metrics.revenue)}</b></h2><select aria-label="Khoảng thời gian"><option>Tháng này</option><option>Tuần này</option><option>Hôm nay</option></select></div><div className="kv-tabs"><button className="active">Theo ngày</button><button>Theo giờ</button><button>Theo thứ</button></div><div className="kv-chart"><div className="kv-y-axis"><span>10tr</span><span>7,5tr</span><span>5tr</span><span>2,5tr</span><span>0</span></div><div className="kv-bars">{[14,26,18,38,24,52,31,46,28,62,35,49].map((height,index) => <i key={index} style={{ height: metrics.revenue ? `${height}%` : "2px" }}><span>{index + 1}</span></i>)}</div>{!metrics.revenue && <div className="kv-no-chart">Chưa có dữ liệu doanh thu trong tháng này</div>}</div></section>
          <div className="kv-rank-grid"><section className="kv-card kv-rank-card kv-enter delay-2"><div className="kv-card-title"><h2>Top 10 hàng bán chạy</h2><select aria-label="Tiêu chí xếp hạng"><option>Theo doanh thu thuần</option></select></div>{products.length ? <div className="kv-top-products">{products.slice(0,5).map((product,index) => <div key={product.id}><b>{index + 1}</b><span>{product.name}<small>{product.sku}</small></span><strong>{money(Number(product.price))}</strong></div>)}</div> : <div className="kv-empty"><span>▤</span><p>Chưa có dữ liệu</p><button onClick={() => setModal("product")}>Thêm hàng hóa</button></div>}</section><section className="kv-card kv-rank-card kv-enter delay-3"><div className="kv-card-title"><h2>Top 10 khách mua nhiều nhất</h2><select aria-label="Khoảng thời gian khách hàng"><option>Tháng này</option></select></div><div className="kv-empty"><span>♙</span><p>Chưa có dữ liệu</p></div></section></div>
          <section className="kv-card kv-products-card"><div className="kv-card-title"><div><h2>Hàng hóa trong kho</h2><p>{products.length} mặt hàng · {metrics.lowStock} sắp hết</p></div><label className="kv-search">⌕<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm hàng hóa..." /></label></div><div className="kv-table-wrap"><table><thead><tr><th>Hàng hóa</th><th>Mã hàng</th><th>Giá bán</th><th>Tồn kho</th><th>Trạng thái</th></tr></thead><tbody>{filteredProducts.map(product => <tr key={product.id}><td><span className="kv-product-name"><i>{product.name.slice(0,2).toUpperCase()}</i><b>{product.name}</b></span></td><td>{product.sku}</td><td>{money(Number(product.price))}</td><td>{product.stock_quantity}</td><td><span className={product.stock_quantity <= 5 ? "kv-low" : "kv-good"}>{product.stock_quantity <= 5 ? "Sắp hết hàng" : "Đang kinh doanh"}</span></td></tr>)}{!filteredProducts.length && <tr><td colSpan={5} className="kv-table-empty">Chưa có hàng hóa. Hãy thêm sản phẩm đầu tiên.</td></tr>}</tbody></table></div></section>
        </div>
        <aside className="kv-side-column">
          <section className="kv-card kv-security kv-enter delay-1"><span>▧</span><div><strong>Dữ liệu đang được bảo vệ</strong><small>Đăng nhập và phân quyền đang hoạt động</small></div></section>
          <section className="kv-card kv-activity kv-enter delay-2"><div className="kv-card-title"><h2>Hoạt động gần đây</h2></div><div className="kv-activity-list">{products.slice(0,6).map((product,index) => <article key={product.id}><span>{index % 2 ? "⇩" : "▱"}</span><p><b>{profile.username}</b> vừa thêm hàng hóa <strong>{product.name}</strong><small>{index ? `${index + 1} ngày trước` : "gần đây"}</small></p></article>)}{!products.length && <div className="kv-empty activity-empty"><span>◷</span><p>Chưa có hoạt động gần đây</p><button onClick={() => setModal("product")}>Thêm hàng hóa</button></div>}</div></section>
          <section className="kv-card kv-employee"><div className="kv-empty"><span>♙</span><p>Chưa có dữ liệu hiệu suất nhân viên</p><small>Thêm nhân viên để xem doanh thu và đánh giá hiệu quả làm việc</small><button onClick={() => setModal("staff")}>Thêm nhân viên</button></div></section>
        </aside>
      </div>
    </main>
    <button className="kv-help">☏ <span>Hỗ trợ</span></button>
    {modal && <div className="modal open"><button className="modal-backdrop" aria-label="Đóng" onClick={() => setModal(null)} /><form className="modal-card" onSubmit={modal === "product" ? addProduct : addStaff}><div className="modal-head"><div><h3>{modal === "product" ? "Thêm hàng hóa" : "Tạo tài khoản nhân viên"}</h3><p>{modal === "product" ? "Hàng hóa được lưu vào cơ sở dữ liệu" : "Cấp quyền Quản lý hoặc Bán hàng"}</p></div><button type="button" className="close-btn" onClick={() => setModal(null)}>×</button></div>{modal === "product" ? <div className="form-grid"><label className="full">Tên hàng hóa<input name="name" required /></label><label>Mã hàng<input name="sku" required /></label><label>Giá bán<input name="price" type="number" min="0" required /></label><label>Tồn kho<input name="stock" type="number" min="0" defaultValue="0" /></label></div> : <div className="form-grid"><label className="full">Tên nhân viên<input name="fullName" required /></label><label>Tên đăng nhập<input name="username" required minLength={3} /></label><label>Mật khẩu<input name="password" type="password" required minLength={8} /></label><label>Vai trò<select name="role"><option value="sales">Bán hàng</option><option value="manager">Quản lý</option></select></label></div>}{message && <p className="form-error">{message}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Hủy</button><button className="button primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></div></form></div>}
  </div>;
}
