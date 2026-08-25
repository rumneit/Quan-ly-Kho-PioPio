"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import type { Profile } from "@/lib/auth";

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  active: boolean;
};

type NewProduct = { name: string; sku: string; price: string; stock: string };
type ColumnKey = "image" | "sku" | "name" | "price" | "cost" | "stock" | "reserved" | "created" | "forecast";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const pageSize = 10;
const navItems = ["Mua hàng", "Đơn hàng", "Khách hàng", "Nhân viên", "Sổ quỹ", "Báo cáo", "Bán online", "Thuế & Kế toán"];
const columns: Array<{ key: ColumnKey; label: string }> = [
  { key: "image", label: "Hình ảnh" }, { key: "sku", label: "Mã hàng" }, { key: "name", label: "Tên hàng" },
  { key: "price", label: "Giá bán" }, { key: "cost", label: "Giá vốn" }, { key: "stock", label: "Tồn kho" },
  { key: "reserved", label: "Khách đặt" }, { key: "created", label: "Thời gian tạo" }, { key: "forecast", label: "Dự kiến hết hàng" },
];

export default function ProductClient({ profile, initialProducts }: { profile: Profile; initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tất cả");
  const [stockFilter, setStockFilter] = useState("Tất cả");
  const [direct, setDirect] = useState("Tất cả");
  const [channel, setChannel] = useState("Tất cả");
  const [page, setPage] = useState(1);
  const [showColumns, setShowColumns] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [newProduct, setNewProduct] = useState<NewProduct>({ name: "", sku: "", price: "", stock: "0" });
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({
    image: true, sku: true, name: true, price: true, cost: true, stock: true, reserved: true, created: true, forecast: true,
  });
  const importInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => products.filter((product) => {
    const matchesText = `${product.name} ${product.sku}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = status === "Tất cả" || status === (product.active ? "Đang kinh doanh" : "Ngừng kinh doanh");
    const matchesStock = stockFilter === "Tất cả" || (stockFilter === "Còn hàng" && product.stock_quantity > 0) ||
      (stockFilter === "Hết hàng" && product.stock_quantity === 0) || (stockFilter === "Sắp hết" && product.stock_quantity > 0 && product.stock_quantity <= 5);
    return matchesText && matchesStatus && matchesStock;
  }), [products, query, status, stockFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const initials = profile.full_name.split(" ").map((item) => item[0]).slice(-2).join("");

  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newProduct.name.trim()) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProduct.name.trim(), sku: newProduct.sku.trim() || `HH-${Date.now().toString().slice(-6)}`,
          price: Number(newProduct.price || 0), stock_quantity: Number(newProduct.stock || 0), active: true,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể lưu hàng hóa.");
      setProducts((current) => [result.product, ...current]);
      setNewProduct({ name: "", sku: "", price: "", stock: "0" });
      setShowCreate(false);
      setPage(1);
      setNotice("Đã tạo hàng hóa mới.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể lưu hàng hóa.");
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const lines = ["Mã hàng,Tên hàng,Giá bán,Tồn kho,Trạng thái", ...filtered.map((p) =>
      [p.sku, p.name, p.price, p.stock_quantity, p.active ? "Đang kinh doanh" : "Ngừng kinh doanh"].map((cell) => `\"${String(cell).replaceAll("\"", "\"\"")}\"`).join(","))];
    const url = URL.createObjectURL(new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "hang-hoa.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`Đã xuất ${filtered.length} hàng hóa.`);
  }

  async function selectImportFile() {
    const file = importInput.current?.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { setNotice("Tệp CSV chưa có dữ liệu hàng hóa."); return; }
    const readRow = (line: string) => Array.from(line.matchAll(/(?:^|,)(\"(?:\"\"|[^\"])*\"|[^,]*)/g)).map((item) => item[1].replace(/^\"|\"$/g, "").replaceAll("\"\"", "\""));
    const headers = readRow(lines[0]);
    const col = (name: string, fallback: number) => Math.max(headers.indexOf(name), fallback);
    const nameIndex = col("Tên hàng", 1), skuIndex = col("Mã hàng", 0), priceIndex = col("Giá bán", 2), stockIndex = col("Tồn kho", 3);
    const toNumber = (value: string) => Number(value.replaceAll(".", "").replaceAll(",", ".")) || 0;
    setSaving(true);
    const added: Product[] = [];
    let failed = 0;
    for (const line of lines.slice(1)) {
      const cells = readRow(line);
      const name = cells[nameIndex]?.trim();
      if (!name) continue;
      const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, sku: cells[skuIndex]?.trim() || `HH-${Date.now().toString().slice(-6)}`, price: toNumber(cells[priceIndex] || "0"), stock: toNumber(cells[stockIndex] || "0") }) });
      const result = await response.json();
      if (response.ok) added.push(result.product); else failed += 1;
    }
    setSaving(false);
    setShowImport(false);
    if (added.length) setProducts((current) => [...added, ...current]);
    setPage(1);
    setNotice(`Đã import ${added.length} hàng hóa${failed ? `; ${failed} dòng không hợp lệ hoặc trùng mã.` : "."}`);
  }

  const chips = (value: string, setValue: (value: string) => void) => (
    <div className="chips">{["Tất cả", "Có", "Không"].map((item) => <button key={item} type="button" className={value === item ? "chosen" : ""} onClick={() => changeFilter(setValue, item)}>{item}</button>)}</div>
  );

  return <div className="kv-shell product-page">
    <header className="kv-header">
      <Link className="kv-brand" href="/dashboard"><span className="kv-brand-symbol"><i /><i /></span><strong>PioPio</strong></Link>
      <div className="kv-header-actions"><button className="kv-round" aria-label="Thông báo">🔔</button><button className="kv-round" aria-label="Cài đặt">⚙</button><button className="kv-avatar">{initials}</button></div>
    </header>
    <nav className="kv-horizontal-nav"><div className="kv-horizontal-items"><Link className="kv-top-item" href="/dashboard">Tổng quan</Link><Link className="kv-top-item active" href="/products">Hàng hóa</Link>{navItems.map((item) => <span className="kv-top-item" key={item}>{item}</span>)}</div><Link className="kv-sale-link" href="/sales">🛒 Bán hàng</Link></nav>

    <main className="product-workspace">
      <aside className="product-filters">
        <h1>Hàng hóa</h1>
        <section><h3>Nhóm hàng <button type="button" className="link-button">Tạo mới</button></h3><button className="filter-select" type="button">Chọn nhóm hàng</button></section>
        <section><h3>Tồn kho</h3><label className="filter-label">Tiêu chí tồn<select value={stockFilter} onChange={(e) => changeFilter(setStockFilter, e.target.value)}><option>Tất cả</option><option>Còn hàng</option><option>Sắp hết</option><option>Hết hàng</option></select></label></section>
        <section><h3>Dự kiến hết hàng</h3><label className="filter-choice">◉ <span>Toàn thời gian</span>›</label><label className="filter-choice">◯ <span>Tùy chỉnh</span>📅</label></section>
        <section><h3>Thời gian tạo</h3><label className="filter-choice">◉ <span>Toàn thời gian</span>›</label><label className="filter-choice">◯ <span>Tùy chỉnh</span>📅</label></section>
        <section><h3>Nhà cung cấp</h3><button className="filter-select" type="button">Chọn nhà cung cấp</button></section>
        <section><h3>Vị trí</h3><button className="filter-select" type="button">Chọn vị trí</button></section>
        <section><h3>Loại hàng</h3><button className="filter-select" type="button">Chọn loại hàng</button></section>
        <section><h3>Bán trực tiếp</h3>{chips(direct, setDirect)}</section>
        <section><h3>Liên kết kênh bán</h3>{chips(channel, setChannel)}</section>
        <section><h3>Trạng thái hàng hóa</h3><select value={status} onChange={(e) => changeFilter(setStatus, e.target.value)}><option>Tất cả</option><option>Đang kinh doanh</option><option>Ngừng kinh doanh</option></select></section>
      </aside>

      <section className="product-content">
        {notice && <div className="product-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
        <div className="product-search product-toolbar2">
          <label>⌕<input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Theo mã, tên hàng" /></label>
          <button className="primary" type="button" onClick={() => setShowCreate(true)}>＋ Tạo mới</button>
          <button type="button" onClick={() => setShowImport(true)}>⇥ Import file</button><button type="button" onClick={exportCsv}>⇧ Xuất file</button>
          <div className="column-control"><button type="button" aria-label="Chọn cột" onClick={() => setShowColumns((open) => !open)}>☷</button>{showColumns && <div className="columns-popover">{columns.map((column) => <label key={column.key}><input type="checkbox" checked={visible[column.key]} onChange={() => setVisible((current) => ({ ...current, [column.key]: !current[column.key] }))} />{column.label}</label>)}</div>}</div>
          <button type="button" aria-label="Cài đặt bảng">⚙</button>
        </div>
        <div className="product-table"><table><thead><tr><th>□</th><th>☆</th>{visible.image && <th>Hình ảnh</th>}{visible.sku && <th>Mã hàng</th>}{visible.name && <th>Tên hàng</th>}{visible.price && <th>Giá bán</th>}{visible.cost && <th>Giá vốn</th>}{visible.stock && <th>Tồn kho</th>}{visible.reserved && <th>Khách đặt</th>}{visible.created && <th>Thời gian tạo</th>}{visible.forecast && <th>Dự kiến hết hàng</th>}</tr></thead><tbody>
          {rows.map((product) => <tr key={product.id}><td>□</td><td>☆</td>{visible.image && <td><i className="product-thumb">▦</i></td>}{visible.sku && <td>{product.sku}</td>}{visible.name && <td><b>{product.name}</b><small className={product.active ? "status-live" : "status-off"}>{product.active ? "Đang kinh doanh" : "Ngừng kinh doanh"}</small></td>}{visible.price && <td>{money(Number(product.price))}</td>}{visible.cost && <td>0</td>}{visible.stock && <td>{product.stock_quantity}</td>}{visible.reserved && <td>0</td>}{visible.created && <td>Hôm nay</td>}{visible.forecast && <td>---</td>}</tr>)}
          {!rows.length && <tr><td colSpan={columns.filter((column) => visible[column.key]).length + 2}><div className="product-no-data">▤<strong>Chưa có hàng hóa</strong><p>Thêm hàng hóa để bắt đầu quản lý kho.</p><button className="primary" type="button" onClick={() => setShowCreate(true)}>Thêm hàng hóa</button></div></td></tr>}
        </tbody></table></div>
        <footer className="product-pager"><span>Hiển thị {filtered.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, filtered.length)} / {filtered.length} hàng hóa</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <button type="button" key={number} className={safePage === number ? "current" : ""} onClick={() => setPage(number)}>{number}</button>)}<button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button></div></footer>
      </section>
    </main>
    <a className="kv-help" href="tel:0704040044"><i>💬</i><span>0704 04 0044</span></a>

    {showCreate && <div className="modal-backdrop" role="presentation"><form className="product-modal" onSubmit={createProduct}><header><div><h2>Thêm hàng hóa</h2><p>Hàng hóa được lưu vào cơ sở dữ liệu</p></div><button type="button" onClick={() => setShowCreate(false)}>×</button></header><div className="product-form"><label>Tên hàng hóa<input autoFocus required value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} /></label><div className="form-row"><label>Mã hàng<input value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} /></label><label>Giá bán<input type="number" min="0" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} /></label></div><label>Tồn kho<input type="number" min="0" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} /></label></div><footer><button type="button" onClick={() => setShowCreate(false)}>Hủy</button><button className="primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></footer></form></div>}
    {showImport && <div className="modal-backdrop" role="presentation"><section className="product-modal import-modal"><header><div><h2>Import hàng hóa</h2><p>Chọn tệp CSV để thêm hàng hóa vào kho</p></div><button type="button" onClick={() => setShowImport(false)}>×</button></header><div className="product-form"><input ref={importInput} type="file" accept=".csv,text/csv" /><p className="import-hint">Dùng tệp CSV được tạo bởi nút Xuất file: Mã hàng, Tên hàng, Giá bán, Tồn kho và Trạng thái.</p></div><footer><button type="button" onClick={() => setShowImport(false)}>Hủy</button><button className="primary" type="button" disabled={saving} onClick={selectImportFile}>{saving ? "Đang import..." : "Xác nhận"}</button></footer></section></div>}
  </div>;
}
