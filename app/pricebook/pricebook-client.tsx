"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Check, Columns3, HelpCircle, Plus, Search, Settings, Trash2, X } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";

type PriceProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost?: number;
  stock_quantity: number;
  category_id?: string | null;
  category_name?: string | null;
  price_lists?: unknown;
};
type Category = { id: string; name: string };
type PriceBook = { id: string; name: string; prices: Record<string, number> };
type ColumnKey = "sku" | "name" | "stock" | "cost" | "latest" | "price";
type Notice = { kind: "success" | "error"; text: string } | null;

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: "sku", label: "Mã hàng" },
  { key: "name", label: "Tên hàng" },
  { key: "stock", label: "Tồn kho" },
  { key: "cost", label: "Giá vốn" },
  { key: "latest", label: "Giá nhập cuối" },
  { key: "price", label: "Bảng giá đang chọn" },
];

function ImportFileIcon() {
  return <svg className="pricebook-file-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v6m9-8 5 5h-5V2ZM5 19v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M2 15h11m-4-4 4 4-4 4" /></svg>;
}

function ExportFileIcon() {
  return <svg className="pricebook-file-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8m-1-20 5 5h-5V2Zm-3 13h11m-4-4 4 4-4 4" /></svg>;
}

function initialBooks(products: PriceProduct[]): PriceBook[] {
  const base: PriceBook = { id: "base", name: "Bảng giá chung", prices: Object.fromEntries(products.map((product) => [product.id, Number(product.price) || 0])) };
  const custom = new Map<string, PriceBook>();
  for (const product of products) {
    if (!Array.isArray(product.price_lists)) continue;
    for (const value of product.price_lists) {
      if (!value || typeof value !== "object") continue;
      const entry = value as Record<string, unknown>;
      if (typeof entry.id !== "string" || typeof entry.name !== "string") continue;
      const price = Number(entry.price);
      if (!Number.isFinite(price)) continue;
      const book = custom.get(entry.id) || { id: entry.id, name: entry.name, prices: {} };
      book.name = entry.name;
      book.prices[product.id] = price;
      custom.set(entry.id, book);
    }
  }
  return [base, ...custom.values()];
}

function parseCsvRow(line: string) {
  const cells: string[] = [];
  let cell = "", quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { cells.push(cell); cell = ""; }
    else cell += character;
  }
  cells.push(cell);
  return cells;
}

async function apiError(response: Response) {
  const data = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  return data?.error || data?.message || `Yêu cầu thất bại (${response.status}).`;
}

export default function PriceBookClient({ profile, initialProducts, categories }: { profile: Profile; initialProducts: PriceProduct[]; categories: Category[] }) {
  const [books, setBooks] = useState<PriceBook[]>(() => initialBooks(initialProducts));
  const [selectedBookId, setSelectedBookId] = useState("base");
  const [query, setQuery] = useState("");
  const [skuQuery, setSkuQuery] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [showColumns, setShowColumns] = useState(false);
  const [modal, setModal] = useState<"create" | "import" | "settings" | "help" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dirtyBooks, setDirtyBooks] = useState<string[]>([]);
  const [newBook, setNewBook] = useState({ name: "", adjustment: "0" });
  const [rename, setRename] = useState("");
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({ sku: true, name: true, stock: false, cost: true, latest: true, price: true });
  const importInput = useRef<HTMLInputElement>(null);
  const selectedBook = books.find((book) => book.id === selectedBookId) || books[0];
  const isDirty = dirtyBooks.includes(selectedBook.id);
  const getPrice = (product: PriceProduct) => selectedBook.prices[product.id] ?? (Number(product.price) || 0);

  const filtered = useMemo(() => initialProducts.filter((product) => {
    const globalMatch = `${product.sku} ${product.name}`.toLowerCase().includes(query.trim().toLowerCase());
    const skuMatch = product.sku.toLowerCase().includes(skuQuery.trim().toLowerCase());
    const nameMatch = product.name.toLowerCase().includes(nameQuery.trim().toLowerCase());
    const categoryMatch = categoryId === "all" || product.category_id === categoryId;
    const stockMatch = stockFilter === "all" || (stockFilter === "in" ? product.stock_quantity > 0 : product.stock_quantity <= 0);
    const currentPrice = selectedBook.prices[product.id] ?? (Number(product.price) || 0);
    const cost = Number(product.cost) || 0;
    const priceMatch = priceFilter === "all" || (priceFilter === "below_cost" ? currentPrice < cost : priceFilter === "above_cost" ? currentPrice > cost : currentPrice === 0);
    return globalMatch && skuMatch && nameMatch && categoryMatch && stockMatch && priceMatch;
  }), [initialProducts, query, skuQuery, nameQuery, categoryId, stockFilter, priceFilter, selectedBook]);

  function selectBook(id: string) {
    setSelectedBookId(id);
    setShowColumns(false);
  }

  function updatePrice(productId: string, rawValue: string) {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) return;
    setBooks((current) => current.map((book) => book.id === selectedBook.id ? { ...book, prices: { ...book.prices, [productId]: value } } : book));
    setDirtyBooks((current) => current.includes(selectedBook.id) ? current : [...current, selectedBook.id]);
  }

  async function savePrices(prices = selectedBook.prices, successText = "Đã lưu thay đổi bảng giá.") {
    setBusy("save");
    setNotice(null);
    try {
      const response = await fetch("/api/pricebooks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", book_id: selectedBook.id, prices }) });
      if (!response.ok) throw new Error(await apiError(response));
      setDirtyBooks((current) => current.filter((id) => id !== selectedBook.id));
      setNotice({ kind: "success", text: successText });
      return true;
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể lưu bảng giá." });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function createBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newBook.name.trim();
    const adjustment = Number(newBook.adjustment || 0);
    if (!name || !Number.isFinite(adjustment)) return;
    setBusy("create");
    setNotice(null);
    try {
      const response = await fetch("/api/pricebooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name, adjustment }) });
      if (!response.ok) throw new Error(await apiError(response));
      const data = await response.json() as { book?: { id?: unknown; name?: unknown; prices?: unknown } };
      if (!data.book || typeof data.book.id !== "string") throw new Error("Máy chủ không trả về bảng giá vừa tạo.");
      const calculated = Object.fromEntries(initialProducts.map((product) => [product.id, Math.max(0, Math.round(Number(product.price) * (1 + adjustment / 100)))]));
      const returnedPrices = data.book.prices && typeof data.book.prices === "object" ? data.book.prices as Record<string, number> : calculated;
      const book = { id: data.book.id, name: typeof data.book.name === "string" ? data.book.name : name, prices: returnedPrices };
      setBooks((current) => [...current.filter((item) => item.id !== book.id), book]);
      setSelectedBookId(book.id);
      setNewBook({ name: "", adjustment: "0" });
      setModal(null);
      setNotice({ kind: "success", text: `Đã tạo ${book.name}.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể tạo bảng giá." });
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = ["Mã hàng,Tên hàng,Tồn kho,Giá vốn,Giá nhập cuối,Bảng giá", ...filtered.map((product) => [product.sku, product.name, product.stock_quantity, Number(product.cost) || 0, Number(product.cost) || 0, getPrice(product)].map(quote).join(","))];
    const url = URL.createObjectURL(new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedBook.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ kind: "success", text: `Đã xuất ${filtered.length} hàng hóa.` });
  }

  async function importCsv() {
    const file = importInput.current?.files?.[0];
    if (!file) { setNotice({ kind: "error", text: "Vui lòng chọn tệp CSV." }); return; }
    setBusy("import");
    try {
      const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).slice(1);
      const bySku = new Map(initialProducts.map((product) => [product.sku.trim().toLowerCase(), product]));
      const prices = { ...selectedBook.prices };
      let updated = 0;
      for (const line of lines) {
        const cells = parseCsvRow(line);
        const product = bySku.get(String(cells[0] || "").trim().toLowerCase());
        const price = Number(cells.at(-1));
        if (product && Number.isFinite(price) && price >= 0) { prices[product.id] = price; updated += 1; }
      }
      if (!updated) throw new Error("Không tìm thấy mã hàng và mức giá hợp lệ trong file.");
      setBooks((current) => current.map((book) => book.id === selectedBook.id ? { ...book, prices } : book));
      setDirtyBooks((current) => current.includes(selectedBook.id) ? current : [...current, selectedBook.id]);
      const saved = await savePrices(prices, `Đã nhập và lưu ${updated} mức giá.`);
      if (saved) setModal(null);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể nhập bảng giá." });
    } finally {
      setBusy(null);
    }
  }

  async function renameBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = rename.trim();
    if (!name || selectedBook.id === "base") return;
    setBusy("rename");
    try {
      const response = await fetch("/api/pricebooks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rename", book_id: selectedBook.id, name }) });
      if (!response.ok) throw new Error(await apiError(response));
      setBooks((current) => current.map((book) => book.id === selectedBook.id ? { ...book, name } : book));
      setModal(null);
      setNotice({ kind: "success", text: "Đã đổi tên bảng giá." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể đổi tên bảng giá." });
    } finally {
      setBusy(null);
    }
  }

  async function deleteBook() {
    if (selectedBook.id === "base" || !window.confirm(`Xóa bảng giá “${selectedBook.name}”?`)) return;
    setBusy("delete");
    try {
      const response = await fetch(`/api/pricebooks?id=${encodeURIComponent(selectedBook.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await apiError(response));
      const deletedId = selectedBook.id;
      setBooks((current) => current.filter((book) => book.id !== deletedId));
      setDirtyBooks((current) => current.filter((id) => id !== deletedId));
      setSelectedBookId("base");
      setModal(null);
      setNotice({ kind: "success", text: "Đã xóa bảng giá." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể xóa bảng giá." });
    } finally {
      setBusy(null);
    }
  }

  function openSettings() {
    setRename(selectedBook.name);
    setModal("settings");
  }

  const visibleCount = COLUMNS.filter((column) => visible[column.key]).length;
  return <div className="kv-shell product-page pricebook-page">
    <ManagementHeader profile={profile} active="pricebook" />
    <div className="product-actions pricebook-actions">
      <h1>{selectedBook.name}</h1>
      <div className="pricebook-search"><label className="product-query"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Theo mã, tên hàng" /></label></div>
      <div className="product-toolbar pricebook-toolbar">
        <button type="button" className="pricebook-tool primary" title="Tạo bảng giá" aria-label="Tạo bảng giá" onClick={() => setModal("create")}><Plus /></button>
        <button type="button" className="pricebook-tool" title="Import file" aria-label="Import file" onClick={() => setModal("import")}><ImportFileIcon /></button>
        <button type="button" className="pricebook-tool" title="Xuất file" aria-label="Xuất file" onClick={exportCsv}><ExportFileIcon /></button>
        <div className="column-control"><button type="button" className="pricebook-tool" title="Chọn cột" aria-label="Chọn cột" aria-expanded={showColumns} onClick={() => setShowColumns((value) => !value)}><Columns3 /></button>{showColumns && <div className="columns-popover pricebook-columns">{COLUMNS.map((column) => <label key={column.key}><input type="checkbox" checked={visible[column.key]} onChange={() => setVisible((current) => ({ ...current, [column.key]: !current[column.key] }))} />{column.key === "price" ? selectedBook.name : column.label}</label>)}</div>}</div>
        <button type="button" className="pricebook-tool" title="Thiết lập" aria-label="Thiết lập" onClick={openSettings}><Settings /></button>
        <button type="button" className="pricebook-tool" title="Trợ giúp" aria-label="Trợ giúp" onClick={() => setModal("help")}><HelpCircle /></button>
      </div>
    </div>
    <main className="product-workspace pricebook-workspace">
      <aside className="product-filter-sidebar pricebook-sidebar">
        <section><h2>Bảng giá <button type="button" onClick={() => setModal("create")}>Tạo mới</button></h2><select aria-label="Chọn bảng giá" value={selectedBook.id} onChange={(event) => selectBook(event.target.value)}>{books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}</select><div className="pricebook-chip"><span>{selectedBook.name}</span>{isDirty && <i title="Có thay đổi chưa lưu" />}<button type="button" aria-label="Bỏ chọn bảng giá" title="Bỏ chọn" onClick={() => selectBook("base")}><X /></button></div></section>
        <section><h2>Nhóm hàng</h2><select aria-label="Nhóm hàng" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">Tất cả nhóm hàng</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></section>
        <section><h2>Tồn kho</h2><select aria-label="Tồn kho" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">Tất cả</option><option value="in">Còn hàng trong kho</option><option value="out">Hết hàng trong kho</option></select></section>
        <section><h2>Giá bán</h2><select aria-label="Điều kiện giá bán" value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}><option value="all">Tất cả</option><option value="below_cost">Nhỏ hơn giá vốn</option><option value="above_cost">Lớn hơn giá vốn</option><option value="zero">Bằng 0</option></select></section>
      </aside>
      <section className="product-content pricebook-content">
        {notice && <div className={`product-notice pricebook-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)}>×</button></div>}
        <div className="pricebook-summary"><div><strong>{selectedBook.name}</strong><span>{filtered.length} hàng hóa</span>{isDirty && <em>Chưa lưu</em>}</div><button type="button" disabled={!isDirty || busy !== null} onClick={() => savePrices()}><Check />{busy === "save" ? "Đang lưu..." : "Lưu thay đổi"}</button></div>
        <div className="product-table pricebook-table"><table><thead><tr>{visible.sku && <th>Mã hàng</th>}{visible.name && <th>Tên hàng</th>}{visible.stock && <th className="number-cell">Tồn kho</th>}{visible.cost && <th className="number-cell">Giá vốn</th>}{visible.latest && <th className="number-cell">Giá nhập cuối</th>}{visible.price && <th className="number-cell">{selectedBook.name}</th>}</tr><tr className="pricebook-filter-row">{visible.sku && <th><label><Search /><input aria-label="Lọc mã hàng" value={skuQuery} onChange={(event) => setSkuQuery(event.target.value)} placeholder="Mã hàng" /></label></th>}{visible.name && <th><label><Search /><input aria-label="Lọc tên hàng" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} placeholder="Tên hàng" /></label></th>}{visible.stock && <th />}{visible.cost && <th />}{visible.latest && <th />}{visible.price && <th />}</tr></thead><tbody>{filtered.map((product) => <tr className="product-row" key={product.id}>{visible.sku && <td className="pricebook-sku">{product.sku}</td>}{visible.name && <td><b className="pricebook-product-name">{product.name}</b></td>}{visible.stock && <td className="number-cell">{money(product.stock_quantity)}</td>}{visible.cost && <td className="number-cell">{money(Number(product.cost) || 0)}</td>}{visible.latest && <td className="number-cell">{money(Number(product.cost) || 0)}</td>}{visible.price && <td className="price-input-cell"><input aria-label={`Giá ${product.name}`} type="number" min="0" step="any" value={getPrice(product)} onChange={(event) => updatePrice(product.id, event.target.value)} /></td>}</tr>)}{!filtered.length && <tr><td colSpan={visibleCount}><div className="product-empty"><Search size={42} /><strong>Không có hàng hóa phù hợp</strong><p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p></div></td></tr>}</tbody></table></div>
      </section>
    </main>
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>

    {modal === "create" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><form className="product-modal pricebook-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={createBook}><header><div><h2>Tạo bảng giá</h2><p>Tạo bảng giá mới từ Bảng giá chung</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="product-form pricebook-form"><label>Tên bảng giá<input autoFocus required value={newBook.name} onChange={(event) => setNewBook((current) => ({ ...current, name: event.target.value }))} placeholder="Ví dụ: Giá bán sỉ" /></label><label>Điều chỉnh so với bảng giá chung (%)<input required type="number" step="any" value={newBook.adjustment} onChange={(event) => setNewBook((current) => ({ ...current, adjustment: event.target.value }))} /></label></div><footer><button type="button" onClick={() => setModal(null)}>Hủy</button><button className="primary" disabled={busy !== null}>{busy === "create" ? "Đang tạo..." : "Lưu"}</button></footer></form></div>}
    {modal === "import" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal pricebook-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Import bảng giá</h2><p>Giá hợp lệ sẽ được lưu ngay vào {selectedBook.name}</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="product-form pricebook-import"><ImportFileIcon /><label>Chọn file CSV<input ref={importInput} type="file" accept=".csv,text/csv" /></label><p>File cần có mã hàng ở cột đầu và giá bán ở cột cuối.</p></div><footer><button type="button" onClick={() => setModal(null)}>Hủy</button><button type="button" className="primary" disabled={busy !== null} onClick={importCsv}>{busy === "import" || busy === "save" ? "Đang nhập..." : "Import"}</button></footer></section></div>}
    {modal === "settings" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><form className="product-modal pricebook-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={renameBook}><header><div><h2>Thiết lập bảng giá</h2><p>{selectedBook.name}</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header>{selectedBook.id === "base" ? <div className="pricebook-base-message">Bảng giá chung là bảng giá mặc định. Bạn có thể sửa giá và lưu thay đổi, nhưng không thể đổi tên hoặc xóa.</div> : <div className="product-form pricebook-form"><label>Tên bảng giá<input autoFocus required value={rename} onChange={(event) => setRename(event.target.value)} /></label></div>}<footer>{selectedBook.id !== "base" && <button type="button" className="pricebook-delete" disabled={busy !== null} onClick={deleteBook}><Trash2 />{busy === "delete" ? "Đang xóa..." : "Xóa bảng giá"}</button>}<span /><button type="button" onClick={() => setModal(null)}>Đóng</button>{selectedBook.id !== "base" && <button className="primary" disabled={busy !== null}>{busy === "rename" ? "Đang lưu..." : "Lưu tên"}</button>}</footer></form></div>}
    {modal === "help" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal pricebook-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Hướng dẫn bảng giá</h2><p>Tạo và cập nhật giá bán theo từng nhóm khách hàng</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="pricebook-help"><h3>Chỉnh sửa giá</h3><p>Chọn một bảng giá, nhập giá mới trực tiếp trong cột bên phải rồi bấm <b>Lưu thay đổi</b>.</p><h3>Import và xuất file</h3><p>File CSV import cần có mã hàng ở cột đầu, giá ở cột cuối. Import thành công sẽ tự động lưu.</p><h3>Bảng giá chung</h3><p>Thay đổi trên bảng giá chung cập nhật giá bán cơ bản của hàng hóa.</p></div><footer><button type="button" className="primary" onClick={() => setModal(null)}>Đã hiểu</button></footer></section></div>}
  </div>;
}
