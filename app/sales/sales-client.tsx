"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ClipboardList, Clock, Menu, Minus, Phone, Plus, Printer, RefreshCw, Search, ShoppingCart, Star, Trash2, Truck, Undo2, X, Zap } from "lucide-react";
import type { Profile } from "@/lib/auth";
import { VN_PROVINCES, VN_WARDS } from "@/app/lib/vietnam-data";

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
  const [customerNote, setCustomerNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastOrder, setLastOrder] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [packCount, setPackCount] = useState(1);
  const [weight, setWeight] = useState("500");
  const [dimL, setDimL] = useState("10");
  const [dimW, setDimW] = useState("10");
  const [dimH, setDimH] = useState("10");
  const [deliveryNote, setDeliveryNote] = useState("");
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
    setCart(c => { const e = c[product.id]; const q = Math.min((e?.quantity || 0) + 1, product.stock_quantity); return { ...c, [product.id]: { ...product, quantity: q } }; });
  }
  function changeQuantity(product: Product, amount: number) {
    setCart(c => { const e = c[product.id]; if (!e) return c; const q = e.quantity + amount; if (q <= 0) { const n = { ...c }; delete n[product.id]; return n; } return { ...c, [product.id]: { ...e, quantity: Math.min(q, product.stock_quantity) } }; });
  }
  function removeLine(id: string) { setCart(c => { const n = { ...c }; delete n[id]; return n; }); }

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const res = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCustName, phone: newCustPhone }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Không thể thêm khách hàng."); return; }
      setCustomerId(data.customer.id); setCustomerQuery(newCustName); setShowAddCustomer(false); setNewCustName(""); setNewCustPhone("");
    } catch { setError("Không thể kết nối máy chủ."); } finally { setSaving(false); }
  }

  async function pay() {
    if (!lines.length || saving) return;
    if (isDelivery && (!receiverName || !receiverPhone)) { setError("Vui lòng nhập tên và số điện thoại người nhận."); return; }
    setSaving(true); setError(""); setNotice(""); setLastOrder("");
    const items = lines.map(l => ({ product_id: l.id, quantity: l.quantity, unit_price: Number(l.price) }));
    try {
      const orderRes = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customerId || null, status: "paid", note: customerNote, items }) });
      const orderData = await orderRes.json();
      if (!orderRes.ok) { setError(orderData.error || "Không thể lưu đơn hàng."); return; }
      const orderId = orderData.order?.id; const orderNum = orderData.order?.order_number;
      if (isDelivery && orderId) {
        const shipRes = await fetch("/api/waybills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: orderId, receiver_name: receiverName, receiver_phone: receiverPhone, address, area, cod_amount: total, shipping_fee: 0, partner_fee: 0, note: "" }) });
        const shipData = await shipRes.json();
        if (!shipRes.ok) { setError("Đơn đã tạo nhưng không thể tạo vận đơn: " + (shipData.error || "")); return; }
        setNotice("Đã tạo đơn hàng và vận đơn!");
      } else { setNotice("Thanh toán thành công!"); }
      setLastOrder("HD" + String(orderNum).padStart(6, "0")); setCart({}); setCustomerNote(""); setReceiverName(""); setReceiverPhone(""); setAddress(""); setArea(""); setPackCount(1);
    } catch { setError("Không thể kết nối máy chủ."); } finally { setSaving(false); }
  }

  return <main className={`pos-shell mode-${mode}`} style={{ fontFamily: "Roboto, Arial, sans-serif", fontSize: "12.544px" }}>
    {/* HEADER: 41px blue */}
    <header className="page-header">
      <div className="header-left">
        <div className="col-left-control">
          <label className="pos-global-search"><Search size={14} /><input ref={productSearchRef} value={query} onChange={e => { setQuery(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Tìm hàng hóa (F3)" autoFocus /></label>
          {searchOpen && query.trim() && <div className="pos-search-results">
            {results.map(p => <button key={p.id} onClick={() => addProduct(p)}><span className="pos-search-name">{p.name}<small>{p.sku} · Tồn {p.stock_quantity}</small></span><b>{money(Number(p.price))}</b></button>)}
            {!results.length && <p className="pos-customer-empty">Không tìm thấy hàng hóa</p>}
          </div>}
        </div>
        <div className="cart-tabs"><div className="pos-invoice-tab"><ArrowLeftRight size={14} /><strong>{lastOrder || "Hóa đơn 1"}</strong><X size={14} /></div><button className="pos-add-tab"><Plus size={14} /></button></div>
      </div>
      <div className="header-right">
        <ul className="icon-list header-nav">
          <li><button aria-label="Đơn hàng"><ClipboardList size={14} /></button></li>
          <li><button aria-label="Hoàn tác"><Undo2 size={14} /></button></li>
          <li><button aria-label="Đồng bộ"><RefreshCw size={14} /></button></li>
          <li><button aria-label="In"><Printer size={14} /></button></li>
        </ul>
        <div className="pos-user-menu-wrap"><button className="pos-user" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><Menu size={14} /><span>{profile.username}</span></button>
          {menuOpen && <div className="pos-user-menu"><Link href="/end-of-day-report">Xem báo cáo cuối ngày</Link><Link href="/orders">Xử lý đặt hàng</Link><Link href="/returns">Chọn hóa đơn trả hàng</Link><Link href="/cashflow">Lập phiếu thu</Link><button onClick={() => { setMenuOpen(false); setShowShortcuts(true); }}>Phím tắt</button><Link href="/dashboard">Quản lý</Link><form action="/auth/signout" method="post"><button>Đăng xuất</button></form></div>}
        </div>
      </div>
    </header>

    {/* CONTENT: cart left (841) + panel right (421) */}
    <div className="page-content">
      <div className="col-left">
        <div className="cart-container">
          <div className="pos-cart-list">
            <div className="pos-cart-head"><span>{lines.length} hàng hóa</span><button onClick={() => setCart({})} disabled={!lines.length}><Trash2 size={13} /> Xóa chọn tất cả</button></div>
            {lines.length ? lines.map(line => <article key={line.id}><div className="pos-cart-info"><strong>{line.name}</strong><small>{line.sku} · Tồn {line.stock_quantity}</small></div><div className="pos-cart-right"><b>{money(Number(line.price) * line.quantity)}</b><div className="pos-quantity"><button onClick={() => changeQuantity(line, -1)}><Minus size={12} /></button><span>{line.quantity}</span><button onClick={() => changeQuantity(line, 1)}><Plus size={12} /></button></div><button className="pos-line-remove" onClick={() => removeLine(line.id)}><X size={12} /></button></div></article>) : <div className="pos-empty-cart"><ShoppingCart size={40} /><strong>Hóa đơn chưa có hàng hóa</strong><p>{isDelivery ? "Điền thông tin giao hàng bên phải." : "Bấm vào sản phẩm bên phải để thêm vào đơn."}</p></div>}
          </div>
        </div>
        <div className="cart-footer">
          <p><span>Tổng tiền hàng</span><b>{money(total)}</b></p>
          <p><span>Giảm giá</span><b>0</b></p>
          <p className="strong"><span>Khách cần trả</span><b>{money(total)}</b></p>
        </div>
      </div>
      <div className="col-right">
        <div className="delivery-component">
          <div className="form-delivery is-step-one">
            <div className="transport-content">
              <div className="col-right-header">
                <div className="pos-staff-row"><span>{profile.full_name}</span><b>⌄</b><time>{new Intl.DateTimeFormat("vi-VN").format(new Date())}</time></div>
              </div>
              <div className="col-wrap">
                <label className="pos-customer-search"><Search size={14} /><input ref={customerSearchRef} placeholder="Tìm khách hàng (F4)" value={customerQuery} onChange={e => { setCustomerQuery(e.target.value); setCustomerListOpen(true); }} onFocus={() => setCustomerListOpen(true)} /><button onClick={() => setShowAddCustomer(true)} title="Thêm khách hàng"><Plus size={13} /></button></label>
                {selectedCustomer && <div className="pos-customer-selected">{selectedCustomer.name}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}<button onClick={() => setCustomerId("")}><X size={13} /></button></div>}
                {customerListOpen && <div className="pos-customer-list">{filteredCustomers.map(c => <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerListOpen(false); }}><strong>{c.name}</strong>{c.phone && <small>{c.phone}</small>}</button>)}{!filteredCustomers.length && <p className="pos-customer-empty">Không tìm thấy khách hàng</p>}</div>}

                {isDelivery ? (
                  <div className="pos-delivery-form">
                    <div className="pos-form-row"><input placeholder="Tên người nhận" value={receiverName} onChange={e => setReceiverName(e.target.value)} /><input placeholder="Số điện thoại" value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} /></div>
                    <textarea className="pos-textarea" placeholder="Địa chỉ chi tiết (Số nhà, ngõ, đường)" value={address} onChange={e => setAddress(e.target.value)} />
                    <div className="pos-form-row full"><select className="pos-select" value={area} onChange={e => setArea(e.target.value)}><option value="">Khu vực (Tỉnh/TP)</option>{VN_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                    <div className="pos-form-row full"><select className="pos-select" value={address} onChange={e => setAddress(e.target.value)} disabled={!area}><option value="">Phường/Xã</option>{(VN_WARDS[area] || []).map(w => <option key={w} value={w}>{w}</option>)}</select></div>
                    <div className="pos-pack-row"><span>Cân nặng</span><input className="pos-pack-input" value={weight} onChange={e => setWeight(e.target.value)} placeholder="500" /><span>gram</span></div>
                    <div className="pos-dim-row"><input className="pos-pack-input" value={packCount} onChange={e => setPackCount(Number(e.target.value) || 1)} placeholder="Số kiện" /><input className="pos-pack-input" value={dimL} onChange={e => setDimL(e.target.value)} placeholder="Dài" /><input className="pos-pack-input" value={dimW} onChange={e => setDimW(e.target.value)} placeholder="Rộng" /><input className="pos-pack-input" value={dimH} onChange={e => setDimH(e.target.value)} placeholder="Cao" /><span>cm</span></div>
                    <textarea className="pos-textarea" placeholder="Ghi chú cho bưu tá" value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} />
                  </div>
                ) : (
                  <div className="pos-product-list">
                    <div className="pos-product-list-head"><span>{products.length} hàng hóa</span></div>
                    {products.slice(0, 40).map(product => (
                      <button key={product.id} className="pos-product-row" onClick={() => addProduct(product)}>
                        <span className="pos-product-name">{product.name}<small>{product.sku} · Tồn {product.stock_quantity}</small></span>
                        <b>{money(Number(product.price))}</b>
                      </button>
                    ))}
                    {!products.length && <p className="pos-customer-empty">Chưa có hàng hóa</p>}
                  </div>
                )}

                {error && <p className="pos-error">{error}</p>}{notice && <p className="pos-success">{notice}</p>}
              </div>
            </div>
            <div className="cart-actions">
              {isDelivery ? <button className="btn btn-primary btn-xl btn-pay saveTransactionDelivery" onClick={pay} disabled={saving}>THANH TOÁN + VẬN ĐƠN</button>
              : <><button className="btn btn-outline-primary btn-xl btn-select-ship-partner" onClick={() => setMode("delivery")}>GIAO HÀNG</button><button className="btn btn-primary btn-xl btn-pay saveTransactionDelivery" onClick={pay} disabled={saving}>THANH TOÁN</button></>}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* FOOTER: 45px white */}
    <footer className="page-footer">
      <div className="kv-tab tabs-pos">
        <ul className="nav nav-tabs">
          <li><a className={`nav-link ${mode === "quick" ? "active" : ""}`} onClick={() => setMode("quick")}><Zap size={14} /> Bán nhanh</a></li>
          <li><a className={`nav-link ${mode === "normal" ? "active" : ""}`} onClick={() => setMode("normal")}><Clock size={14} /> Bán thường</a></li>
          <li><a className={`nav-link ${mode === "delivery" ? "active" : ""}`} onClick={() => setMode("delivery")}><Truck size={14} /> Bán giao hàng</a></li>
        </ul>
      </div>
      <div className="page-footer-right">
        <a href="tel:0704040044" className="pos-support"><Phone size={14} /> 1900 6522</a>
        <button className="page-footer-usemanual" aria-label="Trợ giúp"><Search size={14} /></button>
        <button className="page-footer-rating" aria-label="Đánh giá"><Star size={14} /></button>
      </div>
    </footer>

    {showAddCustomer && <div className="modal-backdrop" onClick={() => setShowAddCustomer(false)}><section className="pos-qty-modal" onClick={e => e.stopPropagation()}><h3>Thêm khách hàng</h3><form className="settings-form" onSubmit={addCustomer}><div className="settings-form-row"><label>Tên khách hàng</label><input value={newCustName} onChange={e => setNewCustName(e.target.value)} required /></div><div className="settings-form-row"><label>Số điện thoại</label><input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} /></div>{error && <p className="pos-error">{error}</p>}<div className="settings-form-actions"><button type="button" onClick={() => setShowAddCustomer(false)}>Hủy</button><button type="submit" className="settings-btn-primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></div></form></section></div>}

    {showShortcuts && <div className="modal-backdrop" onClick={() => setShowShortcuts(false)}><section className="pos-qty-modal" onClick={e => e.stopPropagation()}><h3>Phím tắt</h3><div className="pos-shortcuts"><div><kbd>F3</kbd><span>Tìm hàng hóa</span></div><div><kbd>F4</kbd><span>Tìm khách hàng</span></div><div><kbd>Esc</kbd><span>Đóng cửa sổ</span></div></div><div className="settings-form-actions"><button className="settings-btn-primary" onClick={() => setShowShortcuts(false)}>Đã hiểu</button></div></section></div>}
  </main>;
}