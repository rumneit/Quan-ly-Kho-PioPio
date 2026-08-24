"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Profile } from "@/lib/auth";

type Product = { id: string; name: string; sku: string; price: number; stock_quantity: number; active: boolean };
type CartLine = Product & { quantity: number };
type Props = { profile: Profile; products: Product[] };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export default function SalesClient({ profile, products }: Props) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"quick" | "normal" | "delivery">("normal");
  const filtered = useMemo(() => products.filter(product => `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const lines = Object.values(cart);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);

  function addProduct(product: Product) {
    setNotice("");
    setCart(current => { const existing = current[product.id]; const quantity = Math.min((existing?.quantity || 0) + 1, product.stock_quantity); return { ...current, [product.id]: { ...product, quantity } }; });
  }
  function changeQuantity(product: Product, amount: number) {
    setCart(current => { const existing = current[product.id]; if (!existing) return current; const quantity = existing.quantity + amount; if (quantity <= 0) { const next = { ...current }; delete next[product.id]; return next; } return { ...current, [product.id]: { ...existing, quantity: Math.min(quantity, product.stock_quantity) } }; });
  }

  return <main className="pos-shell">
    <header className="pos-topbar">
      <label className="pos-global-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm hàng hóa (F3)" autoFocus /></label>
      <div className="pos-invoice-tab"><span>⇄</span><strong>Hóa đơn 1</strong><b>×</b></div><button className="pos-add-tab" aria-label="Thêm hóa đơn">＋</button>
      <div className="pos-tools"><button aria-label="Đơn hàng">▣</button><button aria-label="Hoàn tác">↶</button><button aria-label="Đồng bộ">↻</button><button aria-label="In">▤</button><span>{profile.username}</span><button>☰</button></div>
    </header>
    <div className="pos-workspace">
      <section className="pos-left">
        <div className="pos-catalog-head"><span>{filtered.length} hàng hóa</span><div><button className="active">▦</button><button>☷</button></div></div>
        <div className="pos-catalog-grid">{filtered.map(product => <button key={product.id} className="pos-catalog-item" onClick={() => addProduct(product)}><i>{product.name.slice(0,2).toUpperCase()}</i><strong>{product.name}</strong><small>{product.sku} · Tồn {product.stock_quantity}</small><b>{money(Number(product.price))}</b><em>＋</em></button>)}{!filtered.length && <div className="pos-blank"><span>⌕</span><strong>Không tìm thấy hàng hóa</strong><p>Thử tìm theo tên hoặc mã hàng khác.</p></div>}</div>
        <div className="pos-order-summary"><label>✎ <input placeholder="Ghi chú đơn hàng" /></label><div><p><span>Tổng tiền hàng</span><b>{money(total)}</b></p><p><span>Giảm giá</span><b>0</b></p><p className="strong"><span>Khách cần trả</span><b>{money(total)}</b></p></div></div>
      </section>
      <aside className="pos-checkout-panel">
        <div className="pos-staff-row"><span>{profile.full_name}</span><b>⌄</b><time>{new Intl.DateTimeFormat("vi-VN").format(new Date())}</time></div>
        <label className="pos-customer-search">⌕ <input placeholder="Tìm khách hàng (F4)" /><button>＋</button></label>
        <div className="pos-cart-list">{lines.length ? lines.map(line => <article key={line.id}><div><strong>{line.name}</strong><small>{line.sku}</small></div><div className="pos-quantity"><button onClick={() => changeQuantity(line,-1)}>−</button><span>{line.quantity}</span><button onClick={() => changeQuantity(line,1)}>＋</button></div><b>{money(Number(line.price)*line.quantity)}</b></article>) : <div className="pos-empty-cart"><span>▣</span><strong>Hóa đơn chưa có hàng hóa</strong><p>Tìm kiếm hoặc chọn hàng hóa bên trái để bắt đầu.</p></div>}</div>
        <div className="pos-payment"><div className="pos-cod"><strong>Thu hộ tiền (COD)</strong><button aria-label="Bật thu hộ"><i /></button><b>{money(total)}</b></div><div className="pos-payment-total"><span>Khách cần trả</span><strong>{money(total)}</strong></div>{notice && <p>{notice}</p>}<div className="pos-payment-actions"><button className="delivery" disabled={!lines.length}>GIAO HÀNG</button><button className="pay" disabled={!lines.length} onClick={() => setNotice("Luồng thanh toán thật sẽ được nối với đơn hàng và tồn kho ở bước tiếp theo.")}>THANH TOÁN</button></div></div>
      </aside>
    </div>
    <footer className="pos-footer"><div><button className={mode === "quick" ? "active" : ""} onClick={() => setMode("quick")}>ϟ Bán nhanh</button><button className={mode === "normal" ? "active" : ""} onClick={() => setMode("normal")}>◷ Bán thường</button><button className={mode === "delivery" ? "active" : ""} onClick={() => setMode("delivery")}>▣ Bán giao hàng</button></div><div><Link href="/dashboard">⌂ Quản lý</Link><span>☏ Hỗ trợ</span><form action="/auth/signout" method="post"><button>Đăng xuất</button></form></div></footer>
  </main>;
}
