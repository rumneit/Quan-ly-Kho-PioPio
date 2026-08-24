"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Profile } from "@/lib/auth";

type Product = { id: string; name: string; sku: string; price: number; stock_quantity: number; active: boolean };
type CartLine = Product & { quantity: number };
type Props = { profile: Profile; products: Product[] };

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function SalesClient({ profile, products }: Props) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => products.filter(product => `${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const lines = Object.values(cart);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);

  function addProduct(product: Product) {
    setNotice("");
    setCart(current => {
      const existing = current[product.id];
      const quantity = Math.min((existing?.quantity || 0) + 1, product.stock_quantity);
      return { ...current, [product.id]: { ...product, quantity } };
    });
  }

  function changeQuantity(product: Product, amount: number) {
    setCart(current => {
      const existing = current[product.id];
      if (!existing) return current;
      const quantity = existing.quantity + amount;
      if (quantity <= 0) {
        const next = { ...current };
        delete next[product.id];
        return next;
      }
      return { ...current, [product.id]: { ...existing, quantity: Math.min(quantity, product.stock_quantity) } };
    });
  }

  return <main className="sales-app">
    <header className="sales-header">
      <div className="sales-brand"><span className="brand-mark">P</span><div><strong>PioPio</strong><small>Khu vực Bán hàng</small></div></div>
      <label className="sales-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên hoặc mã sản phẩm..." autoFocus /></label>
      <div className="sales-user"><span className={`role-badge ${profile.role}`}>{profile.role === "manager" ? "Quản lý" : "Bán hàng"}</span><strong>{profile.full_name}</strong>{profile.role === "manager" && <Link href="/dashboard">Quản lý</Link>}<form action="/auth/signout" method="post"><button>Đăng xuất</button></form></div>
    </header>
    <div className="sales-layout">
      <section className="sales-catalog">
        <div className="sales-section-head"><div><p className="eyebrow">DANH MỤC SẢN PHẨM</p><h1>Chọn hàng để tạo đơn</h1></div><span>{filtered.length} sản phẩm</span></div>
        <div className="sales-products">{filtered.map(product => <button className="sales-product" key={product.id} onClick={() => addProduct(product)}><span className="sales-product-image">{product.name.slice(0, 2).toUpperCase()}</span><strong>{product.name}</strong><small>{product.sku} · Còn {product.stock_quantity}</small><b>{money(product.price)}</b><i>＋</i></button>)}{!filtered.length && <div className="sales-empty">Không tìm thấy sản phẩm phù hợp.</div>}</div>
      </section>
      <aside className="sales-cart">
        <div className="sales-cart-head"><div><p className="eyebrow">ĐƠN HÀNG MỚI</p><h2>Giỏ hàng</h2></div><span>{itemCount} món</span></div>
        <div className="sales-cart-lines">{lines.length ? lines.map(line => <article className="sales-cart-line" key={line.id}><div><strong>{line.name}</strong><small>{money(Number(line.price))}</small></div><div className="quantity"><button aria-label={`Giảm ${line.name}`} onClick={() => changeQuantity(line, -1)}>−</button><span>{line.quantity}</span><button aria-label={`Tăng ${line.name}`} onClick={() => changeQuantity(line, 1)}>＋</button></div><b>{money(Number(line.price) * line.quantity)}</b></article>) : <div className="sales-empty-cart"><span>▣</span><strong>Chưa có sản phẩm</strong><p>Chọn sản phẩm bên trái để thêm vào đơn.</p></div>}</div>
        <div className="sales-summary"><div><span>Tạm tính</span><strong>{money(total)}</strong></div><div><span>Giảm giá</span><span>0 ₫</span></div><div className="sales-total"><span>Khách cần trả</span><strong>{money(total)}</strong></div>{notice && <p className="sales-notice">{notice}</p>}<button className="sales-checkout" disabled={!lines.length} onClick={() => setNotice("Màn hình Bán hàng đã sẵn sàng. Chức năng lưu hóa đơn sẽ được làm ở bước tiếp theo.")}>{lines.length ? "Thanh toán" : "Chọn sản phẩm để thanh toán"}</button></div>
      </aside>
    </div>
  </main>;
}
