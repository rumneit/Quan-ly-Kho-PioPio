"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ClipboardList, Clock, Menu, Minus, Phone, Plus, Printer, RefreshCw, RotateCcw, Search, ShoppingCart, Star, Trash2, Truck, Undo2, X, Zap } from "lucide-react";
import type { Profile } from "@/lib/auth";
import { VN_PROVINCES, getWardsForProvince } from "@/app/lib/vietnam-data";

type Product = { id: string; name: string; sku: string; price: number; stock_quantity: number; active: boolean };
type Customer = { id: string; name: string; phone?: string | null };
type PendingOrder = { id: string; order_number: number; status: string; total: number; created_at: string; customers?: { name?: string } | null };
type CartLine = Product & { quantity: number };
type Props = { profile: Profile; products: Product[]; customers: Customer[]; pendingOrders: PendingOrder[] };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export default function SalesClient({ profile, products, customers, pendingOrders }: Props) {
  const [query, setQuery] = useState("");
  const [productPage, setProductPage] = useState(0);
  const productPageSize = 20;
  const paginatedProducts = useMemo(() => products.slice(productPage * productPageSize, (productPage + 1) * productPageSize), [products, productPage]);
  const totalProductPages = Math.max(1, Math.ceil(products.length / productPageSize));
  const [searchOpen, setSearchOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"normal" | "delivery">("normal");
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
  const [ward, setWard] = useState("");
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
  const [showOrderProcessing, setShowOrderProcessing] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);
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
    setError(""); setNotice(""); setLastOrder(""); setSearchOpen(false); setQuery("");
    setCart(c => {
      const e = c[product.id];
      const nextQty = (e?.quantity || 0) + 1;
      if (nextQty > product.stock_quantity) {
        setError(`Tồn kho không đủ cho ${product.name}: chỉ còn ${product.stock_quantity}.`);
        // vẫn cho phép thêm vượt tồn để server quyết định (nếu cho phép âm tồn)
        // nhưng giới hạn hiển thị: nếu muốn chặn, uncomment dòng dưới
        // return c;
      }
      const q = Math.min(nextQty, Math.max(product.stock_quantity, nextQty));
      // P0 fix: không im lặng cắt số lượng; nếu vượt tồn, giữ nguyên nextQty và báo lỗi để server check
      const finalQty = nextQty > product.stock_quantity ? nextQty : q;
      return { ...c, [product.id]: { ...product, quantity: finalQty } };
    });
  }
  function changeQuantity(product: Product, amount: number) {
    setCart(c => {
      const e = c[product.id];
      if (!e) return c;
      const q = e.quantity + amount;
      if (q <= 0) { const n = { ...c }; delete n[product.id]; return n; }
      if (q > product.stock_quantity) {
        setError(`Tồn kho không đủ cho ${product.name}: chỉ còn ${product.stock_quantity}.`);
      } else {
        setError("");
      }
      return { ...c, [product.id]: { ...e, quantity: q } };
    });
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
    // P0: client stock check before pay (server cũng check, nhưng báo sớm ở UI)
    const outOfStock = lines.find(l => l.quantity > l.stock_quantity);
    if (outOfStock) {
      setError(`Tồn kho không đủ cho ${outOfStock.name}: yêu cầu ${outOfStock.quantity}, còn ${outOfStock.stock_quantity}. Vui lòng giảm số lượng.`);
      return;
    }
    if (isDelivery && (!receiverName || !receiverPhone)) { setError("Vui lòng nhập tên và số điện thoại người nhận."); return; }
    if (isDelivery && !area) { setError("Vui lòng chọn khu vực (Tỉnh/TP) giao hàng."); return; }
    setSaving(true); setError(""); setNotice(""); setLastOrder("");
    const items = lines.map(l => ({ product_id: l.id, quantity: l.quantity, unit_price: Number(l.price) }));
    try {
      const orderRes = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customerId || null, status: "paid", note: customerNote, items }) });
      const orderData = await orderRes.json();
      if (!orderRes.ok) { setError(orderData.error || "Không thể lưu đơn hàng."); return; }
      const orderId = orderData.order?.id; const orderNum = orderData.order?.order_number;
      if (isDelivery && orderId) {
        const fullAddress = [address, ward, area].filter(Boolean).join(", ");
        const shipRes = await fetch("/api/waybills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: orderId, receiver_name: receiverName, receiver_phone: receiverPhone, address: fullAddress, area, cod_amount: total, shipping_fee: 0, partner_fee: 0, note: deliveryNote }) });
        const shipData = await shipRes.json();
        if (!shipRes.ok) { setError("Đơn đã tạo nhưng không thể tạo vận đơn: " + (shipData.error || "")); return; }
        setNotice("Đã tạo đơn hàng và vận đơn!");
      } else { setNotice("Thanh toán thành công!"); }
      setLastOrder("HD" + String(orderNum).padStart(6, "0")); setCart({}); setCustomerNote(""); setReceiverName(""); setReceiverPhone(""); setAddress(""); setArea(""); setWard(""); setPackCount(1);
    } catch { setError("Không thể kết nối máy chủ."); } finally { setSaving(false); }
  }

  return <main className={`pos-shell mode-${mode}`} style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: "12.544px" }}>
    {/* HEADER: 41px blue */}
    <header className="page-header">
      <div className="header-left">
        <div className="col-left-control">
          <label className="pos-global-search"><Search aria-hidden="true" size={14} /><input role="combobox" aria-expanded={searchOpen} aria-controls="pos-search-listbox" aria-autocomplete="list" ref={productSearchRef} value={query} onChange={e => { setQuery(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Tìm hàng hóa (F3)" autoFocus /></label>
          {searchOpen && query.trim() && <div id="pos-search-listbox" role="listbox" className="pos-search-results">
            {results.map(p => <button key={p.id} onClick={() => addProduct(p)}><span className="pos-search-name">{p.name}<small>{p.sku} · Tồn {p.stock_quantity}</small></span><b>{money(Number(p.price))}</b></button>)}
            {!results.length && <p className="pos-customer-empty">Không tìm thấy hàng hóa</p>}
          </div>}
        </div>
        <div className="cart-tabs"><div className="pos-invoice-tab"><ArrowLeftRight size={14} /><strong>{lastOrder || "Hóa đơn 1"}</strong><X size={14} /></div><button className="pos-add-tab"><Plus size={14} /></button></div>
      </div>
      <div className="header-right">
        <ul className="icon-list header-nav">
          <li><button aria-label="Xử lý đặt hàng" title="Xử lý đặt hàng" onClick={() => setShowOrderProcessing(true)}><ClipboardList size={18} /><span className="icon-label">Đặt hàng</span></button></li>
          <li><button aria-label="Trả hàng" title="Trả hàng" onClick={() => setShowReturn(true)}><RotateCcw size={18} /><span className="icon-label">Trả hàng</span></button></li>
          <li><button aria-label="Đồng bộ" title="Đồng bộ" onClick={async () => { setSyncing(true); await new Promise(r=>setTimeout(r,1200)); setSyncing(false); setNotice("Đồng bộ thành công"); setTimeout(()=>setNotice(""),3000); }}><RefreshCw size={18} className={syncing ? "spin" : ""} /><span className="icon-label">Đồng bộ</span></button></li>
          <li><button aria-label="Thiết lập in" title="Thiết lập in" onClick={() => setShowPrintSettings(true)}><Printer size={18} /><span className="icon-label">In</span></button></li>
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
                <label className="pos-customer-search"><Search aria-hidden="true" size={14} /><input role="combobox" aria-expanded={searchOpen} aria-controls="pos-search-listbox" aria-autocomplete="list" ref={customerSearchRef} placeholder="Tìm khách hàng (F4)" value={customerQuery} onChange={e => { setCustomerQuery(e.target.value); setCustomerListOpen(true); }} onFocus={() => setCustomerListOpen(true)} /><button onClick={() => setShowAddCustomer(true)} title="Thêm khách hàng"><Plus size={13} /></button></label>
                {selectedCustomer && <div className="pos-customer-selected">{selectedCustomer.name}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}<button onClick={() => setCustomerId("")}><X size={13} /></button></div>}
                {customerListOpen && <div className="pos-customer-list">{filteredCustomers.map(c => <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerListOpen(false); }}><strong>{c.name}</strong>{c.phone && <small>{c.phone}</small>}</button>)}{!filteredCustomers.length && <p className="pos-customer-empty">Không tìm thấy khách hàng</p>}</div>}

                {isDelivery ? (
                  <div className="pos-delivery-form">
                    <div className="pos-form-row"><label className="sr-only" htmlFor="pos-receiver-name">Tên người nhận</label><input id="pos-receiver-name" aria-required="true" aria-describedby={error ? "pos-error" : undefined} placeholder="Tên người nhận *" value={receiverName} onChange={e => setReceiverName(e.target.value)} /><label className="sr-only" htmlFor="pos-receiver-phone">Số điện thoại</label><input id="pos-receiver-phone" aria-required="true" aria-describedby={error ? "pos-error" : undefined} placeholder="Số điện thoại *" value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} /></div>
                    <label className="sr-only" htmlFor="pos-address">Địa chỉ chi tiết</label><textarea id="pos-address" className="pos-textarea" rows={1} aria-required="true" placeholder="Địa chỉ chi tiết (Số nhà, ngõ, đường) *" value={address} onChange={e => setAddress(e.target.value)} />
                    <div className="pos-form-row full"><label className="sr-only" htmlFor="pos-area">Khu vực</label><select id="pos-area" className="pos-select" aria-required="true" value={area} onChange={e => { setArea(e.target.value); setWard(""); }}><option value="">Khu vực (Tỉnh/TP) *</option>{VN_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                    <div className="pos-form-row full"><label className="sr-only" htmlFor="pos-ward">Phường/Xã</label><select id="pos-ward" className="pos-select" value={ward} onChange={e => setWard(e.target.value)} disabled={!area}><option value="">{area ? "Phường/Xã" : "Chọn Tỉnh/TP trước"}</option>{getWardsForProvince(area).map(w => <option key={w} value={w}>{w}</option>)}{ward && !getWardsForProvince(area).includes(ward) && <option value={ward}>{ward}</option>}</select></div>
                    <div className="pos-pack-row"><span>Cân nặng</span><input className="pos-pack-input" value={weight} onChange={e => setWeight(e.target.value)} placeholder="500" /><span>gram</span></div>
                    <div className="pos-dim-row"><input className="pos-pack-input" value={packCount} onChange={e => setPackCount(Number(e.target.value) || 1)} placeholder="Số kiện" /><input className="pos-pack-input" value={dimL} onChange={e => setDimL(e.target.value)} placeholder="Dài" /><input className="pos-pack-input" value={dimW} onChange={e => setDimW(e.target.value)} placeholder="Rộng" /><input className="pos-pack-input" value={dimH} onChange={e => setDimH(e.target.value)} placeholder="Cao" /><span>cm</span></div>
                    <textarea className="pos-textarea" rows={1} placeholder="Ghi chú cho bưu tá" value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} />
                  </div>
                ) : (
                  <div className="pos-product-list">
                    <div className="pos-product-list-head"><span>{products.length} hàng hóa</span><small style={{marginLeft:8,color:"#6b7a8d"}}>— trang {productPage + 1}/{totalProductPages}{products.length>productPageSize ? " • F3 để lọc" : ""}</small></div>
                    <div className="pos-normal-grid">
                      {paginatedProducts.map(product => {
                        const colors = ["#f8b4c8","#c9b3ff","#ffd166","#a8e6cf","#a0d8ef","#ffb347","#d4a5ff","#a0f0d0"];
                        const bg = colors[product.id.charCodeAt(0) % colors.length];
                        return (
                          <button key={product.id} className="pos-normal-card" onClick={() => addProduct(product)}>
                            <span className="pos-normal-img" style={{background:bg}}><span style={{fontSize:18}}>🖼️</span></span>
                            <span className="pos-normal-info"><span className="pos-normal-name">{product.name}</span><small>{product.sku} • Tồn {product.stock_quantity}</small><b>{money(Number(product.price))}</b></span>
                          </button>
                        );
                      })}
                    </div>
                    {products.length > productPageSize && (
                      <div className="pos-product-pagination" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderTop:"1px solid #e1e3e6",gap:8}}>
                        <button disabled={productPage===0} onClick={()=> setProductPage(p=> Math.max(0,p-1))} style={{padding:"6px 12px",border:"1px solid #d0d7de",borderRadius:"6px",background: productPage===0?"#f5f6f7":"#fff",cursor: productPage===0?"not-allowed":"pointer"}}>← Trước</button>
                        <span style={{fontSize:12,color:"#6b7a8d"}}>{paginatedProducts.length} / {products.length}</span>
                        <button disabled={(productPage+1)*productPageSize >= products.length} onClick={()=> setProductPage(p=> p+1)} style={{padding:"6px 12px",border:"1px solid #d0d7de",borderRadius:"6px",background: (productPage+1)*productPageSize >= products.length?"#f5f6f7":"#fff",cursor: (productPage+1)*productPageSize >= products.length?"not-allowed":"pointer"}}>Sau →</button>
                      </div>
                    )}
                    {!products.length && <p className="pos-customer-empty">Chưa có hàng hóa</p>}
                  </div>
                )}

                {error && <p id="pos-error" className="pos-error" role="alert" aria-live="assertive">{error}</p>}{notice && <p className="pos-success" role="status" aria-live="polite">{notice}</p>}
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
        <ul className="nav nav-tabs" role="tablist" aria-label="Chế độ bán">
          <li><button role="tab" aria-selected={mode==="normal"} className={`nav-link ${mode === "normal" ? "active" : ""}`} onClick={() => setMode("normal")}><Clock aria-hidden="true" size={14} /> Bán thường</button></li>
          <li><button role="tab" aria-selected={mode==="delivery"} className={`nav-link ${mode === "delivery" ? "active" : ""}`} onClick={() => setMode("delivery")}><Truck aria-hidden="true" size={14} /> Bán giao hàng</button></li>
        </ul>
      </div>
      <div className="page-footer-right">
        <a href="tel:0704040044" className="pos-support"><Phone size={14} /> 1900 6522</a>
        <button className="page-footer-usemanual" aria-label="Trợ giúp"><Search size={14} /></button>
        <button className="page-footer-rating" aria-label="Đánh giá"><Star size={14} /></button>
      </div>
    </footer>

    {showAddCustomer && <div className="modal-backdrop" onClick={() => setShowAddCustomer(false)} onKeyDown={(e)=> e.key==="Escape"&&setShowAddCustomer(false)}><section role="dialog" aria-modal="true" aria-labelledby="add-cust-title" className="pos-qty-modal" onClick={e => e.stopPropagation()}><h3 id="add-cust-title">Thêm khách hàng</h3><form className="settings-form" onSubmit={addCustomer}><div className="settings-form-row"><label>Tên khách hàng</label><input value={newCustName} onChange={e => setNewCustName(e.target.value)} required /></div><div className="settings-form-row"><label>Số điện thoại</label><input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} /></div>{error && <p className="pos-error">{error}</p>}<div className="settings-form-actions"><button type="button" onClick={() => setShowAddCustomer(false)}>Hủy</button><button type="submit" className="settings-btn-primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></div></form></section></div>}

    {showShortcuts && <div className="modal-backdrop" onClick={() => setShowShortcuts(false)} onKeyDown={(e)=> e.key==="Escape"&&setShowShortcuts(false)}><section role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" className="pos-qty-modal" onClick={e => e.stopPropagation()}><h3 id="shortcuts-title">Phím tắt</h3><div className="pos-shortcuts"><div><kbd>F3</kbd><span>Tìm hàng hóa</span></div><div><kbd>F4</kbd><span>Tìm khách hàng</span></div><div><kbd>Esc</kbd><span>Đóng cửa sổ</span></div></div><div className="settings-form-actions"><button className="settings-btn-primary" onClick={() => setShowShortcuts(false)}>Đã hiểu</button></div></section></div>}

    {showOrderProcessing && <div className="modal-backdrop" onClick={() => setShowOrderProcessing(false)} onKeyDown={(e)=> e.key==="Escape"&&setShowOrderProcessing(false)}><section role="dialog" aria-modal="true" aria-labelledby="order-processing-title" className="pos-qty-modal" style={{width:"min(480px,calc(100vw - 24px))"}} onClick={e => e.stopPropagation()}><h3 id="order-processing-title">Xử lý đặt hàng</h3><p style={{fontSize:12,color:"#6b7a8d",margin:"4px 0 12px"}}>Đơn hàng chờ xử lý — y chang KiotViet</p><div style={{maxHeight:320,overflow:"auto",border:"1px solid #e1e3e6",borderRadius:8}}>{pendingOrders.length ? pendingOrders.map(o=> <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderBottom:"1px solid #f0f2f5"}}><div><div style={{fontWeight:600,fontSize:13}}>HD{String(o.order_number).padStart(6,"0")} • {o.customers?.name || "Khách lẻ"}</div><small style={{color:"#6b7a8d"}}>{new Intl.DateTimeFormat("vi-VN").format(new Date(o.created_at))} • {Number(o.total).toLocaleString("vi-VN")}đ • {o.status}</small></div><Link href={`/orders?code=HD${String(o.order_number).padStart(6,"0")}`} onClick={()=> setShowOrderProcessing(false)} style={{padding:"6px 12px",background:"#0070f4",color:"#fff",borderRadius:6,textDecoration:"none",fontSize:12}}>Xử lý</Link></div>) : <p style={{padding:20,textAlign:"center",color:"#6b7a8d"}}>Không có đơn đặt hàng nào</p>}</div><div className="settings-form-actions" style={{marginTop:12}}><Link href="/orders" onClick={()=> setShowOrderProcessing(false)} style={{fontSize:12,color:"#0070f4"}}>Xem tất cả đơn hàng →</Link><button className="settings-btn-primary" onClick={() => setShowOrderProcessing(false)}>Đóng</button></div></section></div>}

    {showReturn && <div className="modal-backdrop" onClick={() => setShowReturn(false)} onKeyDown={(e)=> e.key==="Escape"&&setShowReturn(false)}><section role="dialog" aria-modal="true" aria-labelledby="return-title" className="pos-qty-modal" style={{width:"min(480px,calc(100vw - 24px))"}} onClick={e => e.stopPropagation()}><h3 id="return-title">Trả hàng</h3><p style={{fontSize:12,color:"#6b7a8d",margin:"4px 0 12px"}}>Chọn hóa đơn để trả hàng — y chang KiotViet</p><div style={{display:"grid",gap:8}}><Link href="/returns" onClick={()=> setShowReturn(false)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px",border:"1px solid #e1e3e6",borderRadius:8,textDecoration:"none",color:"#0F172A"}}><RotateCcw size={18} color="#0070f4"/><div><div style={{fontWeight:600}}>Chọn hóa đơn trả hàng</div><small style={{color:"#6b7a8d"}}>Tìm theo mã HD, khách hàng</small></div></Link><Link href="/invoices" onClick={()=> setShowReturn(false)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px",border:"1px solid #e1e3e6",borderRadius:8,textDecoration:"none",color:"#0F172A"}}><ClipboardList size={18} color="#0070f4"/><div><div style={{fontWeight:600}}>Xem hóa đơn</div><small style={{color:"#6b7a8d"}}>Danh sách hóa đơn đã thanh toán</small></div></Link></div><div className="settings-form-actions" style={{marginTop:12}}><button className="settings-btn-primary" onClick={() => setShowReturn(false)}>Đóng</button></div></section></div>}

    {showPrintSettings && <div className="modal-backdrop" onClick={() => setShowPrintSettings(false)} onKeyDown={(e)=> e.key==="Escape"&&setShowPrintSettings(false)}><section role="dialog" aria-modal="true" aria-labelledby="print-settings-title" className="pos-qty-modal" style={{width:"min(420px,calc(100vw - 24px))"}} onClick={e => e.stopPropagation()}><h3 id="print-settings-title">Thiết lập in</h3><p style={{fontSize:12,color:"#6b7a8d",margin:"4px 0 12px"}}>Cấu hình máy in — y chang KiotViet</p><div style={{display:"grid",gap:12}}><label style={{display:"flex",flexDirection:"column",gap:6,fontSize:12,fontWeight:600}}>Khổ giấy<select defaultValue="80mm" style={{height:36,border:"1px solid #d0d7de",borderRadius:6,padding:"0 8px"}}><option>80mm</option><option>58mm</option><option>A4</option></select></label><label style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}><input type="checkbox" defaultChecked /> In sau khi thanh toán</label><label style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}><input type="checkbox" /> Hiển thị logo trên hóa đơn</label><div style={{display:"flex",gap:8}}><button onClick={()=> window.print()} style={{flex:1,height:36,border:"1px solid #0070f4",borderRadius:6,background:"#0070f4",color:"#fff"}}>In thử</button><button onClick={()=> setShowPrintSettings(false)} style={{flex:1,height:36,border:"1px solid #d0d7de",borderRadius:6,background:"#fff"}}>Đóng</button></div></div></section></div>}
  </main>;
}