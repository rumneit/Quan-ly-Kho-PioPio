"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Profile } from "@/lib/auth";

type Product = { id: string; name: string; sku: string; price: number; stock_quantity: number; active: boolean };
type Customer = { id: string; name: string; phone?: string | null };
type CartLine = Product & { quantity: number };
type Props = { profile: Profile; products: Product[]; customers: Customer[] };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export default function SalesClient({ profile, products, customers }: Props) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"quick" | "normal" | "delivery">("normal");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerListOpen, setCustomerListOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastOrder, setLastOrder] = useState("");
  // delivery fields
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [packCount, setPackCount] = useState(1);
  // quantity modal
  const [qtyTarget, setQtyTarget] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  // add customer modal
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  // account menu
  const [menuOpen, setMenuOpen] = useState(false);

  const filtered = useMemo(() => products.filter(product => `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const filteredCustomers = useMemo(() => customers.filter(c => `${c.name} ${c.phone || ""}`.toLowerCase().includes(customerQuery.toLowerCase())).slice(0, 20), [customers, customerQuery]);
  const lines = Object.values(cart);
  const total = lines.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);
  const selectedCustomer = customers.find(c => c.id === customerId);
  const isDelivery = mode === "delivery";

  function openQty(product: Product) { setQty(1); setQtyTarget(product); setError(""); }
  function confirmQty() {
    if (!qtyTarget) return;
    const product = qtyTarget;
    setCart(current => { const existing = current[product.id]; const quantity = Math.min((existing?.quantity || 0) + qty, product.stock_quantity); return { ...current, [product.id]: { ...product, quantity } }; });
    setQtyTarget(null);
  }
  function changeQuantity(product: Product, amount: number) {
    setError("");
    setCart(current => { const existing = current[product.id]; if (!existing) return current; const quantity = existing.quantity + amount; if (quantity <= 0) { const next = { ...current }; delete next[product.id]; return next; } return { ...current, [product.id]: { ...existing, quantity: Math.min(quantity, product.stock_quantity) } }; });
  }

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const res = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCustName, phone: newCustPhone }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Không thể thêm khách hàng."); return; }
      setCustomerId(data.customer.id); setCustomerQuery(newCustName); setShowAddCustomer(false); setNewCustName(""); setNewCustPhone("");
    } catch { setError("Không thể kết nối máy chủ."); }
    finally { setSaving(false); }
  }

  async function doOrder(status: "paid" | "draft") {
    if (!lines.length || saving) return;
    setSaving(true); setError(""); setNotice(""); setLastOrder("");
    const items = lines.map(line => ({ product_id: line.id, quantity: line.quantity, unit_price: Number(line.price) }));
    try {
      const orderRes = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customerId || null, status, note, items }) });
      const orderData = await orderRes.json();
      if (!orderRes.ok) { setError(orderData.error || "Không thể lưu đơn hàng."); return; }
      const orderId = orderData.order?.id;
      const orderNum = orderData.order?.order_number;

      if (isDelivery && orderId) {
        const shipRes = await fetch("/api/waybills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          order_id: orderId, receiver_name: receiverName, receiver_phone: receiverPhone, address, area,
          cod_amount: status === "draft" ? total : 0, shipping_fee: 0, partner_fee: 0, note: "",
        })});
        const shipData = await shipRes.json();
        if (!shipRes.ok) { setError("Đơn hàng đã tạo nhưng không thể tạo vận đơn: " + (shipData.error || "")); return; }
        setNotice(`Đã tạo đơn hàng và vận đơn! HD${String(orderNum).padStart(6, "0")}`);
      } else {
        setNotice(status === "paid" ? "Thanh toán thành công!" : "Đã tạo đơn hàng tạm.");
      }
      setLastOrder(status === "draft" ? "DH" + String(orderNum).padStart(6, "0") : "HD" + String(orderNum).padStart(6, "0"));
      setCart({}); setNote(""); setReceiverName(""); setReceiverPhone(""); setAddress(""); setArea(""); setPackCount(1);
    } catch { setError("Không thể kết nối máy chủ."); }
    finally { setSaving(false); }
  }

  return <main className="pos-shell">
    <header className="pos-topbar">
      <label className="pos-global-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm hàng hóa (F3)" autoFocus /></label>
      <div className="pos-invoice-tab"><span>⇄</span><strong>{lastOrder || "Hóa đơn 1"}</strong><b>×</b></div><button className="pos-add-tab">＋</button>
      <div className="pos-tools"><button aria-label="Đơn hàng">▣</button><button aria-label="Hoàn tác">↶</button><button aria-label="Đồng bộ">↻</button><button aria-label="In">▤</button>
        <div className="pos-user-menu-wrap"><button className="pos-user" aria-label="Tài khoản" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{profile.username}</button>
          {menuOpen && <div className="pos-user-menu"><Link href="/end-of-day-report">Xem báo cáo cuối ngày</Link><Link href="/orders">Xử lý đặt hàng</Link><Link href="/cashflow">Lập phiếu thu</Link><Link href="/dashboard">Quản lý</Link><form action="/auth/signout" method="post"><button>Đăng xuất</button></form></div>}
        </div>
      </div>
    </header>
    <div className="pos-workspace">
      <section className="pos-left">
        <div className="pos-catalog-head"><span>{filtered.length} hàng hóa</span><div><button className="active">▦</button><button>☷</button></div></div>
        <div className="pos-catalog-grid">{filtered.map(product => <button key={product.id} className="pos-catalog-item" onClick={() => openQty(product)}><i>{product.name.slice(0,2).toUpperCase()}</i><strong>{product.name}</strong><small>{product.sku} · Tồn {product.stock_quantity}</small><b>{money(Number(product.price))}</b><em>＋</em></button>)}{!filtered.length && <div className="pos-blank"><span>⌕</span><strong>Không tìm thấy hàng hóa</strong><p>Thử tìm theo tên hoặc mã hàng khác.</p></div>}</div>
        <div className="pos-order-summary"><label>✎ <input placeholder="Ghi chú đơn hàng" value={note} onChange={event => setNote(event.target.value)} /></label><div><p><span>Tổng tiền hàng</span><b>{money(total)}</b></p><p><span>Giảm giá</span><b>0</b></p><p className="strong"><span>Khách cần trả</span><b>{money(total)}</b></p></div></div>
      </section>
      <aside className="pos-checkout-panel">
        <div className="pos-staff-row"><span>{profile.full_name}</span><b>⌄</b><time>{new Intl.DateTimeFormat("vi-VN").format(new Date())}</time></div>
        <label className="pos-customer-search">⌕ <input placeholder="Tìm khách hàng (F4)" value={customerQuery} onChange={event => { setCustomerQuery(event.target.value); setCustomerListOpen(true); }} onFocus={() => setCustomerListOpen(true)} /><button onClick={() => setShowAddCustomer(true)} title="Thêm khách hàng">＋</button></label>
        {selectedCustomer && <div className="pos-customer-selected">{selectedCustomer.name}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}<button onClick={() => { setCustomerId(""); }}>×</button></div>}
        {customerListOpen && <div className="pos-customer-list">{filteredCustomers.map(c => <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerListOpen(false); }}><strong>{c.name}</strong>{c.phone && <small>{c.phone}</small>}</button>)}{!filteredCustomers.length && <p className="pos-customer-empty">Không tìm thấy khách hàng</p>}</div>}
        {isDelivery && <div className="pos-delivery-fields"><input placeholder="Người nhận *" value={receiverName} onChange={e => setReceiverName(e.target.value)} /><input placeholder="Số điện thoại *" value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} /><input placeholder="Địa chỉ" value={address} onChange={e => setAddress(e.target.value)} /><input placeholder="Khu vực" value={area} onChange={e => setArea(e.target.value)} /><div className="pos-pack-row"><span>Số kiện</span><button onClick={() => setPackCount(Math.max(1, packCount - 1))}>−</button><b>{packCount}</b><button onClick={() => setPackCount(packCount + 1)}>＋</button></div></div>}
        <div className="pos-cart-list">{lines.length ? lines.map(line => <article key={line.id}><div><strong>{line.name}</strong><small>{line.sku}</small></div><div className="pos-quantity"><button onClick={() => changeQuantity(line,-1)}>−</button><span>{line.quantity}</span><button onClick={() => changeQuantity(line,1)}>＋</button></div><b>{money(Number(line.price)*line.quantity)}</b></article>) : <div className="pos-empty-cart"><span>▣</span><strong>Hóa đơn chưa có hàng hóa</strong><p>Tìm kiếm hoặc chọn hàng hóa bên trái để bắt đầu.</p></div>}</div>
        <div className="pos-payment"><div className="pos-cod"><strong>Thu hộ tiền (COD)</strong><button aria-label="Bật thu hộ"><i /></button><b>{money(total)}</b></div><div className="pos-payment-total"><span>Khách cần trả</span><strong>{money(total)}</strong></div>{error && <p className="pos-error" role="alert">{error}</p>}{notice && <p className="pos-success">{notice}</p>}<div className="pos-payment-actions">
          {isDelivery ? <><button className="delivery" disabled={!lines.length || saving || !receiverName || !receiverPhone} onClick={() => doOrder("paid")}>{saving ? "ĐANG TẠO..." : "ĐẶT HÀNG + VẬN ĐƠN"}</button><button className="pay" disabled={!lines.length || saving} onClick={() => doOrder("paid")}>{saving ? "ĐANG LƯU..." : "THANH TOÁN + VẬN ĐƠN"}</button></>
          : <><button className="delivery" disabled>GIAO HÀNG</button><button className="pay" disabled={!lines.length || saving} onClick={() => doOrder("paid")}>{saving ? "ĐANG LƯU..." : "THANH TOÁN"}</button></>}
        </div></div>
      </aside>
    </div>
    <footer className="pos-footer"><div><button className={mode === "quick" ? "active" : ""} onClick={() => setMode("quick")}>ϟ Bán nhanh</button><button className={mode === "normal" ? "active" : ""} onClick={() => setMode("normal")}>◷ Bán thường</button><button className={mode === "delivery" ? "active" : ""} onClick={() => setMode("delivery")}>▣ Bán giao hàng</button></div><div><Link href="/dashboard">⌂ Quản lý</Link><span>☏ Hỗ trợ</span></div></footer>

    {qtyTarget && <div className="modal-backdrop" onClick={() => setQtyTarget(null)}><section className="pos-qty-modal" onClick={e => e.stopPropagation()}><h3>{qtyTarget.name}</h3><p className="pos-qty-price">{money(Number(qtyTarget.price))} · Tồn {qtyTarget.stock_quantity}</p><div className="pos-qty-control"><button onClick={() => setQty(Math.max(1, qty - 1))}>−</button><span>{qty}</span><button onClick={() => setQty(Math.min(qtyTarget.stock_quantity, qty + 1))}>＋</button></div><div className="settings-form-actions"><button onClick={() => setQtyTarget(null)}>Hủy</button><button className="settings-btn-primary" onClick={confirmQty} disabled={qty < 1}>Thêm vào đơn</button></div></section></div>}

    {showAddCustomer && <div className="modal-backdrop" onClick={() => setShowAddCustomer(false)}><section className="pos-qty-modal" onClick={e => e.stopPropagation()}><h3>Thêm khách hàng</h3><form className="settings-form" onSubmit={addCustomer}><div className="settings-form-row"><label>Tên khách hàng</label><input value={newCustName} onChange={e => setNewCustName(e.target.value)} required /></div><div className="settings-form-row"><label>Số điện thoại</label><input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} /></div>{error && <p className="pos-error">{error}</p>}<div className="settings-form-actions"><button type="button" onClick={() => setShowAddCustomer(false)}>Hủy</button><button type="submit" className="settings-btn-primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></div></form></section></div>}
  </main>;
}