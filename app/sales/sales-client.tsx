"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ClipboardList, Clock, LayoutDashboard, Menu, Minus, Phone, Plus, Printer, RefreshCw, Search, ShoppingCart, Trash2, Truck, Undo2, X, Zap } from "lucide-react";
import type { Profile } from "@/lib/auth";

type Product = { id: string; name: string; sku: string; price: number; stock_quantity: number; active: boolean };
type Customer = { id: string; name: string; phone?: string | null };
type CartLine = Product & { quantity: number };
type Props = { profile: Profile; products: Product[]; customers: Customer[] };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export default function SalesClient({ profile, products, customers }: Props) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [packCount, setPackCount] = useState(1);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F3") { e.preventDefault(); productSearchRef.current?.focus(); setSearchOpen(true); }
      else if (e.key === "F4") { e.preventDefault(); customerSearchRef.current?.focus(); setCustomerListOpen(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => query.trim() ? products.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [], [products, query]);
  const filteredCustomers = useMemo(() => customers.filter(c => `${c.name} ${c.phone || ""}`.toLowerCase().includes(customerQuery.toLowerCase())).slice(0, 20), [customers, customerQuery]);
  const lines = Object.values(cart);
  const total = lines.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);
  const selectedCustomer = customers.find(c => c.id === customerId);
  const isDelivery = mode === "delivery";

  function addProduct(product: Product) {
    setError(""); setLastOrder(""); setSearchOpen(false); setQuery("");
    setCart(current => {
      const existing = current[product.id];
      const quantity = Math.min((existing?.quantity || 0) + 1, product.stock_quantity);
      return { ...current, [product.id]: { ...product, quantity } };
    });
  }
  function changeQuantity(product: Product, amount: number) {
    setError("");
    setCart(current => {
      const existing = current[product.id];
      if (!existing) return current;
      const quantity = existing.quantity + amount;
      if (quantity <= 0) { const next = { ...current }; delete next[product.id]; return next; }
      return { ...current, [product.id]: { ...existing, quantity: Math.min(quantity, product.stock_quantity) } };
    });
  }
  function removeLine(id: string) { setCart(current => { const next = { ...current }; delete next[id]; return next; }); }

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

  async function doOrder(status: "paid") {
    if (!lines.length || saving) return;
    if (isDelivery && (!receiverName || !receiverPhone)) { setError("Vui lòng nhập tên và số điện thoại người nhận."); return; }
    setSaving(true); setError(""); setNotice(""); setLastOrder("");
    const items = lines.map(line => ({ product_id: line.id, quantity: line.quantity, unit_price: Number(line.price) }));
    try {
      const orderRes = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customerId || null, status, note, items }) });
      const orderData = await orderRes.json();
      if (!orderRes.ok) { setError(orderData.error || "Không thể lưu đơn hàng."); return; }
      const orderId = orderData.order?.id;
      const orderNum = orderData.order?.order_number;
      if (isDelivery && orderId) {
        const shipRes = await fetch("/api/waybills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: orderId, receiver_name: receiverName, receiver_phone: receiverPhone, address, area, cod_amount: total, shipping_fee: 0, partner_fee: 0, note: "" }) });
        const shipData = await shipRes.json();
        if (!shipRes.ok) { setError("Đơn đã tạo nhưng không thể tạo vận đơn: " + (shipData.error || "")); return; }
        setNotice(`Đã tạo đơn hàng và vận đơn!`);
      } else {
        setNotice("Thanh toán thành công!");
      }
      setLastOrder("HD" + String(orderNum).padStart(6, "0"));
      setCart({}); setNote(""); setReceiverName(""); setReceiverPhone(""); setAddress(""); setArea(""); setPackCount(1);
    } catch { setError("Không thể kết nối máy chủ."); }
    finally { setSaving(false); }
  }

  return <main className="pos-shell">
    <header className="pos-topbar">
      <div className="pos-search-wrap">
        <label className="pos-global-search"><Search size={16} /><input ref={productSearchRef} value={query} onChange={event => { setQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Tìm hàng hóa (F3)" autoFocus /></label>
        {searchOpen && query.trim() && <div className="pos-search-results">
          {results.map(product => <button key={product.id} onClick={() => addProduct(product)}><span className="pos-search-name">{product.name}<small>{product.sku} · Tồn {product.stock_quantity}</small></span><b>{money(Number(product.price))}</b></button>)}
          {!results.length && <p className="pos-customer-empty">Không tìm thấy hàng hóa</p>}
        </div>}
      </div>
      <div className="pos-invoice-tab"><ArrowLeftRight size={15} /><strong>{lastOrder || "Hóa đơn 1"}</strong><b>×</b></div><button className="pos-add-tab" aria-label="Thêm hóa đơn"><Plus size={16} /></button>
      <div className="pos-tools">
        <button aria-label="Đơn hàng"><ClipboardList size={16} /></button><button aria-label="Hoàn tác"><Undo2 size={16} /></button><button aria-label="Đồng bộ"><RefreshCw size={16} /></button><button aria-label="In"><Printer size={16} /></button>
        <div className="pos-user-menu-wrap"><button className="pos-user" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{profile.username}</button>
          {menuOpen && <div className="pos-user-menu"><Link href="/end-of-day-report">Xem báo cáo cuối ngày</Link><Link href="/orders">Xử lý đặt hàng</Link><Link href="/returns">Chọn hóa đơn trả hàng</Link><Link href="/cashflow">Lập phiếu thu</Link><button onClick={() => { setMenuOpen(false); setShowShortcuts(true); }}>Phím tắt</button><Link href="/dashboard">Quản lý</Link><form action="/auth/signout" method="post"><button>Đăng xuất</button></form></div>}
        </div>
      </div>
    </header>
    <div className="pos-workspace">
      <section className="pos-cart-panel">
        <div className="pos-cart-head"><span>{lines.length} hàng hóa</span><button onClick={() => setCart({})} disabled={!lines.length}><Trash2 size={14} />Xóa chọn tất cả</button></div>
        <div className="pos-cart-list">{lines.length ? lines.map(line => <article key={line.id}><div className="pos-cart-info"><strong>{line.name}</strong><small>{line.sku} · Tồn {line.stock_quantity}</small></div><div className="pos-cart-right"><b>{money(Number(line.price) * line.quantity)}</b><div className="pos-quantity"><button onClick={() => changeQuantity(line, -1)}><Minus size={14} /></button><span>{line.quantity}</span><button onClick={() => changeQuantity(line, 1)}><Plus size={14} /></button></div><button className="pos-line-remove" onClick={() => removeLine(line.id)} aria-label="Xóa"><X size={14} /></button></div></article>) : <div className="pos-empty-cart"><ShoppingCart size={40} /><strong>Hóa đơn chưa có hàng hóa</strong><p>Nhập tên hàng vào ô tìm kiếm phía trên để thêm vào đơn.</p></div>}</div>
      </section>
      <aside className="pos-checkout-panel">
        <div className="pos-staff-row"><span>{profile.full_name}</span><b>⌄</b><time>{new Intl.DateTimeFormat("vi-VN").format(new Date())}</time></div>
        <label className="pos-customer-search"><Search size={16} /> <input ref={customerSearchRef} placeholder="Tìm khách hàng (F4)" value={customerQuery} onChange={event => { setCustomerQuery(event.target.value); setCustomerListOpen(true); }} onFocus={() => setCustomerListOpen(true)} /><button onClick={() => setShowAddCustomer(true)} title="Thêm khách hàng"><Plus size={15} /></button></label>
        {selectedCustomer && <div className="pos-customer-selected">{selectedCustomer.name}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}<button onClick={() => setCustomerId("")}><X size={14} /></button></div>}
        {customerListOpen && <div className="pos-customer-list">{filteredCustomers.map(c => <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerListOpen(false); }}><strong>{c.name}</strong>{c.phone && <small>{c.phone}</small>}</button>)}{!filteredCustomers.length && <p className="pos-customer-empty">Không tìm thấy khách hàng</p>}</div>}
        {isDelivery && <div className="pos-delivery-fields"><input placeholder="Người nhận *" value={receiverName} onChange={e => setReceiverName(e.target.value)} /><input placeholder="Số điện thoại *" value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} /><input placeholder="Địa chỉ" value={address} onChange={e => setAddress(e.target.value)} /><input placeholder="Khu vực" value={area} onChange={e => setArea(e.target.value)} /><div className="pos-pack-row"><span>Số kiện</span><button onClick={() => setPackCount(Math.max(1, packCount - 1))}><Minus size={14} /></button><b>{packCount}</b><button onClick={() => setPackCount(packCount + 1)}><Plus size={14} /></button></div></div>}
        <div className="pos-totals"><p><span>Tổng tiền hàng</span><b>{money(total)}</b></p><p><span>Giảm giá</span><b>0</b></p><p className="strong"><span>Khách cần trả</span><b>{money(total)}</b></p></div>
        <div className="pos-payment"><div className="pos-cod"><strong>Thu hộ tiền (COD)</strong><b>{money(total)}</b></div>{error && <p className="pos-error" role="alert">{error}</p>}{notice && <p className="pos-success">{notice}</p>}<div className="pos-payment-actions">
          {isDelivery
            ? <button className="pay" disabled={!lines.length || saving} onClick={() => doOrder("paid")}>{saving ? "ĐANG LƯU..." : "THANH TOÁN + VẬN ĐƠN"}</button>
            : <button className="pay" disabled={!lines.length || saving} onClick={() => doOrder("paid")}>{saving ? "ĐANG LƯU..." : "THANH TOÁN"}</button>}
        </div></div>
      </aside>
    </div>
    <footer className="pos-footer"><div><button className={mode === "quick" ? "active" : ""} onClick={() => setMode("quick")}><Zap size={15} /> Bán nhanh</button><button className={mode === "normal" ? "active" : ""} onClick={() => setMode("normal")}><Clock size={15} /> Bán thường</button><button className={mode === "delivery" ? "active" : ""} onClick={() => setMode("delivery")}><Truck size={15} /> Bán giao hàng</button></div><div><Link href="/dashboard"><LayoutDashboard size={15} /> Quản lý</Link><a href="tel:0704040044" className="pos-support"><Phone size={15} /> Hỗ trợ</a></div></footer>

    {showAddCustomer && <div className="modal-backdrop" onClick={() => setShowAddCustomer(false)}><section className="pos-qty-modal" onClick={e => e.stopPropagation()}><h3>Thêm khách hàng</h3><form className="settings-form" onSubmit={addCustomer}><div className="settings-form-row"><label>Tên khách hàng</label><input value={newCustName} onChange={e => setNewCustName(e.target.value)} required /></div><div className="settings-form-row"><label>Số điện thoại</label><input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} /></div>{error && <p className="pos-error">{error}</p>}<div className="settings-form-actions"><button type="button" onClick={() => setShowAddCustomer(false)}>Hủy</button><button type="submit" className="settings-btn-primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></div></form></section></div>}

    {showShortcuts && <div className="modal-backdrop" onClick={() => setShowShortcuts(false)}><section className="pos-qty-modal" onClick={e => e.stopPropagation()}><h3>Phím tắt</h3><div className="pos-shortcuts"><div><kbd>F3</kbd><span>Tìm hàng hóa</span></div><div><kbd>F4</kbd><span>Tìm khách hàng</span></div><div><kbd>Esc</kbd><span>Đóng cửa sổ</span></div></div><div className="settings-form-actions"><button className="settings-btn-primary" onClick={() => setShowShortcuts(false)}>Đã hiểu</button></div></section></div>}
  </main>;
}