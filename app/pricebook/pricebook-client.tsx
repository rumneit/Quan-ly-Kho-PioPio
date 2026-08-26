"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Columns3, Download, FileUp, HelpCircle, Search, Settings } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";

type PriceProduct = { id: string; name: string; sku: string; price: number; cost?: number; stock_quantity: number; category_id?: string | null; category_name?: string | null };
type Category = { id: string; name: string };
type PriceBook = { id: string; name: string; prices: Record<string, number> };
type ColumnKey = "sku" | "name" | "stock" | "cost" | "latest" | "price";
const PAGE_SIZE = 15;
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export default function PriceBookClient({ profile, initialProducts, categories }: { profile: Profile; initialProducts: PriceProduct[]; categories: Category[] }) {
  const basePrices = useMemo(() => Object.fromEntries(initialProducts.map((product) => [product.id, Number(product.price)])), [initialProducts]);
  const [books, setBooks] = useState<PriceBook[]>([{ id: "base", name: "Bảng giá chung", prices: basePrices }]);
  const [selectedBookId, setSelectedBookId] = useState("base");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [newBook, setNewBook] = useState({ name: "", adjustment: "0" });
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({ sku: true, name: true, stock: false, cost: true, latest: true, price: true });
  const importInput = useRef<HTMLInputElement>(null);
  const selectedBook = books.find((book) => book.id === selectedBookId) || books[0];
  const getPrice = (product: PriceProduct) => selectedBook.prices[product.id] ?? Number(product.price);

  const filtered = useMemo(() => initialProducts.filter((product) => {
    const keyword = `${product.sku} ${product.name}`.toLowerCase().includes(query.trim().toLowerCase());
    const category = categoryId === "all" || product.category_id === categoryId;
    const stock = stockFilter === "all" || (stockFilter === "in" ? product.stock_quantity > 0 : product.stock_quantity <= 0);
    const currentPrice = selectedBook.prices[product.id] ?? Number(product.price);
    const cost = Number(product.cost || 0);
    const price = priceFilter === "all" || (priceFilter === "below_cost" ? currentPrice < cost : priceFilter === "above_cost" ? currentPrice > cost : currentPrice === 0);
    return keyword && category && stock && price;
  }), [initialProducts, query, categoryId, stockFilter, priceFilter, selectedBook]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function updatePrice(productId: string, value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    setBooks((current) => current.map((book) => book.id === selectedBook.id ? { ...book, prices: { ...book.prices, [productId]: value } } : book));
  }

  function createBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newBook.name.trim();
    if (!name) return;
    const adjustment = Number(newBook.adjustment || 0);
    const id = `pricebook-${Date.now()}`;
    const prices = Object.fromEntries(initialProducts.map((product) => [product.id, Math.max(0, Math.round(Number(product.price) * (1 + adjustment / 100)))]));
    setBooks((current) => [...current, { id, name, prices }]); setSelectedBookId(id); setNewBook({ name: "", adjustment: "0" }); setShowCreate(false); setNotice(`Đã tạo ${name} trong phiên làm việc này.`);
  }

  function exportCsv() {
    const lines = ["Mã hàng,Tên hàng,Tồn kho,Giá vốn,Giá nhập cuối,Bảng giá", ...filtered.map((product) => [product.sku, product.name, product.stock_quantity, Number(product.cost || 0), Number(product.cost || 0), getPrice(product)].map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(","))];
    const url = URL.createObjectURL(new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${selectedBook.name}.csv`; link.click(); URL.revokeObjectURL(url); setNotice(`Đã xuất ${filtered.length} hàng hóa.`);
  }

  async function importCsv() {
    const file = importInput.current?.files?.[0]; if (!file) { setNotice("Vui lòng chọn tệp CSV."); return; }
    const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).slice(1); const bySku = new Map(initialProducts.map((product) => [product.sku.toLowerCase(), product])); let updated = 0;
    const next = { ...selectedBook.prices };
    for (const line of lines) { const cells = line.split(",").map((value) => value.replace(/^\"|\"$/g, "").replaceAll("\"\"", "\"")); const product = bySku.get(String(cells[0] || "").trim().toLowerCase()); const price = Number(cells.at(-1)); if (product && Number.isFinite(price) && price >= 0) { next[product.id] = price; updated += 1; } }
    setBooks((current) => current.map((book) => book.id === selectedBook.id ? { ...book, prices: next } : book)); setShowImport(false); setNotice(`Đã cập nhật ${updated} mức giá từ file.`);
  }

  const columns: Array<{ key: ColumnKey; label: string }> = [{ key: "sku", label: "Mã hàng" }, { key: "name", label: "Tên hàng" }, { key: "stock", label: "Tồn kho" }, { key: "cost", label: "Giá vốn" }, { key: "latest", label: "Giá nhập cuối" }, { key: "price", label: selectedBook.name }];
  return <div className="kv-shell product-page pricebook-page">
    <ManagementHeader profile={profile} active="pricebook" />
    <div className="product-actions pricebook-actions"><h1>{selectedBook.name}</h1><div className="product-toolbar"><label className="product-query"><Search size={20} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Theo mã, tên hàng" /></label><button className="primary" onClick={() => setShowCreate(true)}>＋ Bảng giá</button><button onClick={() => setShowImport(true)}><FileUp size={18} />Import</button><button onClick={exportCsv}><Download size={18} />Xuất file</button><div className="column-control"><button aria-label="Chọn cột" aria-expanded={showColumns} onClick={() => setShowColumns((value) => !value)}><Columns3 size={19} /></button>{showColumns && <div className="columns-popover">{columns.map((column) => <label key={column.key}><input type="checkbox" checked={visible[column.key]} onChange={() => setVisible((current) => ({ ...current, [column.key]: !current[column.key] }))} />{column.label}</label>)}</div>}</div><button aria-label="Thiết lập"><Settings size={19} /></button><button aria-label="Hướng dẫn"><HelpCircle size={19} /></button></div></div>
    <main className={`product-workspace ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      {sidebarCollapsed ? <button className="sidebar-collapse collapsed" aria-label="Mở bộ lọc" onClick={() => setSidebarCollapsed(false)}><ChevronRight /></button> : <aside className="product-filter-sidebar pricebook-sidebar"><section><h2>Bảng giá <button onClick={() => setShowCreate(true)}>Tạo mới</button></h2><select aria-label="Bảng giá" value={selectedBookId} onChange={(event) => { setSelectedBookId(event.target.value); setPage(1); }}>{books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}</select></section><section><h2>Nhóm hàng</h2><select aria-label="Nhóm hàng" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}><option value="all">Chọn nhóm hàng</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></section><section><h2>Tồn kho</h2><select aria-label="Tồn kho" value={stockFilter} onChange={(event) => { setStockFilter(event.target.value); setPage(1); }}><option value="all">Tất cả</option><option value="in">Còn hàng trong kho</option><option value="out">Hết hàng trong kho</option></select></section><section><h2>Giá bán</h2><select aria-label="Điều kiện giá bán" value={priceFilter} onChange={(event) => { setPriceFilter(event.target.value); setPage(1); }}><option value="all">Chọn điều kiện</option><option value="below_cost">Nhỏ hơn giá vốn</option><option value="above_cost">Lớn hơn giá vốn</option><option value="zero">Bằng 0</option></select><select aria-label="Giá so sánh" disabled={priceFilter === "all"}><option>Giá vốn</option></select></section><button className="sidebar-collapse" aria-label="Thu gọn bộ lọc" onClick={() => setSidebarCollapsed(true)}><ChevronLeft /></button></aside>}
      <section className="product-content pricebook-content">{notice && <div className="product-notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}<div className="pricebook-summary"><span>{selectedBook.name}</span><b>{filtered.length} hàng hóa</b><button onClick={() => setNotice("Thay đổi hiện được lưu trong phiên làm việc; cần API PriceBook để lưu vĩnh viễn.")}><Check size={17} />Lưu thay đổi</button></div><div className="product-table pricebook-table"><table><thead><tr>{visible.sku && <th>Mã hàng</th>}{visible.name && <th>Tên hàng</th>}{visible.stock && <th>Tồn kho</th>}{visible.cost && <th>Giá vốn</th>}{visible.latest && <th>Giá nhập cuối</th>}{visible.price && <th>{selectedBook.name}</th>}</tr></thead><tbody>{rows.map((product) => <tr className="product-row" key={product.id}>{visible.sku && <td>{product.sku}</td>}{visible.name && <td><b className="pricebook-product-name">{product.name}</b></td>}{visible.stock && <td className="number-cell">{product.stock_quantity}</td>}{visible.cost && <td className="number-cell">{money(Number(product.cost || 0))}</td>}{visible.latest && <td className="number-cell">{money(Number(product.cost || 0))}</td>}{visible.price && <td className="price-input-cell"><input aria-label={`Giá ${product.name}`} type="number" min="0" value={getPrice(product)} onChange={(event) => updatePrice(product.id, Number(event.target.value))} /></td>}</tr>)}{!rows.length && <tr><td colSpan={columns.filter((column) => visible[column.key]).length}><div className="product-empty"><Columns3 size={46} /><strong>Không có hàng hóa phù hợp</strong><p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p></div></td></tr>}</tbody></table></div><footer className="product-pager"><span>Hiển thị {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} hàng hóa</span><div><button disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, safePage - 3), safePage + 2).map((number) => <button key={number} className={safePage === number ? "current" : ""} onClick={() => setPage(number)}>{number}</button>)}<button disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button></div></footer></section>
    </main>
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>
    {showCreate && <div className="modal-backdrop"><form className="product-modal pricebook-modal" onSubmit={createBook}><header><div><h2>Tạo bảng giá</h2><p>Tạo giá mới dựa trên Bảng giá chung</p></div><button type="button" onClick={() => setShowCreate(false)}>×</button></header><div className="product-form"><label>Tên bảng giá<input autoFocus required value={newBook.name} onChange={(event) => setNewBook({ ...newBook, name: event.target.value })} placeholder="Ví dụ: Giá bán sỉ" /></label><label>Điều chỉnh so với bảng giá chung (%)<input type="number" value={newBook.adjustment} onChange={(event) => setNewBook({ ...newBook, adjustment: event.target.value })} /></label></div><footer><button type="button" onClick={() => setShowCreate(false)}>Hủy</button><button className="primary">Lưu</button></footer></form></div>}
    {showImport && <div className="modal-backdrop"><section className="product-modal"><header><div><h2>Import bảng giá</h2><p>File CSV cần có Mã hàng và Giá ở cột cuối</p></div><button onClick={() => setShowImport(false)}>×</button></header><div className="product-form"><input ref={importInput} type="file" accept=".csv,text/csv" /></div><footer><button onClick={() => setShowImport(false)}>Hủy</button><button className="primary" onClick={importCsv}>Xác nhận</button></footer></section></div>}
  </div>;
}
