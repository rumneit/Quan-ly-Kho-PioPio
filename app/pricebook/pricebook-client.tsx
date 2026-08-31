"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileUp, HelpCircle, Plus, Search, Settings, Trash2, X } from "lucide-react";
import { getXLSX } from "@/lib/xlsx";
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
type PriceBook = {
  id: string;
  name: string;
  prices: Record<string, number>;
  start_date?: string;
  end_date?: string;
  active?: boolean;
  base_book_id?: string;
  adjustment_type?: "vnd" | "percent";
  adjustment_value?: number;
  pos_rule?: string;
};
type ColumnKey = "sku" | "name" | "stock" | "cost" | "latest" | "price";
type Notice = { kind: "success" | "error"; text: string } | null;
type CreateTab = "info" | "scope";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const nowLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

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
      if (typeof entry.start_date === "string") book.start_date = entry.start_date;
      if (typeof entry.end_date === "string") book.end_date = entry.end_date;
      if (typeof entry.active === "boolean") book.active = entry.active;
      if (typeof entry.base_book_id === "string") book.base_book_id = entry.base_book_id;
      if (entry.adjustment_type === "vnd" || entry.adjustment_type === "percent") book.adjustment_type = entry.adjustment_type;
      if (typeof entry.adjustment_value === "number") book.adjustment_value = entry.adjustment_value;
      if (typeof entry.pos_rule === "string") book.pos_rule = entry.pos_rule;
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

const EXPORT_HEADERS = ["Mã hàng", "Tên hàng", "Tồn kho", "Giá vốn", "Giá nhập cuối", "Giá bán"];

export default function PriceBookClient({ profile, initialProducts, categories }: { profile: Profile; initialProducts: PriceProduct[]; categories: Category[] }) {
  const [books, setBooks] = useState<PriceBook[]>(() => initialBooks(initialProducts));
  const [selectedBookId, setSelectedBookId] = useState("base");
  const [query, setQuery] = useState("");
  const [skuQuery, setSkuQuery] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [compareFilter, setCompareFilter] = useState("cost");
  const [modal, setModal] = useState<"create" | "import" | "settings" | "help" | null>(null);
  const [createTab, setCreateTab] = useState<CreateTab>("info");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dirtyBooks, setDirtyBooks] = useState<string[]>([]);
  const [newBook, setNewBook] = useState({
    name: "",
    base_book_id: "base",
    adjustment_type: "percent" as "vnd" | "percent",
    adjustment_value: "0",
    start_date: nowLocal(),
    end_date: "",
    active: true,
    pos_rule: "allow",
    branch_scope: "all",
    customer_scope: "all",
    creator_scope: "all",
  });
  const [rename, setRename] = useState("");
  const [visible] = useState<Record<ColumnKey, boolean>>({ sku: true, name: true, stock: false, cost: true, latest: true, price: true });
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [modal]);
  const selectedBook = books.find((book) => book.id === selectedBookId) || books[0];
  const isDirty = dirtyBooks.includes(selectedBook.id);
  const getPrice = (product: PriceProduct) => selectedBook.prices[product.id] ?? (Number(product.price) || 0);

  const filtered = useMemo(() => initialProducts.filter((product) => {
    const globalMatch = `${product.sku} ${product.name}`.toLowerCase().includes(query.trim().toLowerCase());
    const skuMatch = product.sku.toLowerCase().includes(skuQuery.trim().toLowerCase());
    const nameMatch = product.name.toLowerCase().includes(nameQuery.trim().toLowerCase());
    const categoryMatch = categoryId === "all" || product.category_id === categoryId;
    const stockMatch = stockFilter === "all" || (stockFilter === "in" ? product.stock_quantity > 0 : product.stock_quantity <= 0);
    const currentPrice = getPrice(product);
    const cost = Number(product.cost) || 0;
    const basePrice = Number(product.price) || 0;
    const compare = compareFilter === "cost" ? cost : basePrice;
    const priceMatch = priceFilter === "all" || (priceFilter === "below_cost" ? currentPrice < compare : priceFilter === "above_cost" ? currentPrice > compare : currentPrice === 0);
    return globalMatch && skuMatch && nameMatch && categoryMatch && stockMatch && priceMatch;
  }), [initialProducts, query, skuQuery, nameQuery, categoryId, stockFilter, priceFilter, compareFilter, selectedBook, getPrice]);

  function selectBook(id: string) {
    setSelectedBookId(id);
  }

  function updatePrice(productId: string, rawValue: string) {
    const value = Number(rawValue.replace(/[^\d]/g, "")) || 0;
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
    const adjustmentValue = Number(newBook.adjustment_value || 0);
    if (!name || !Number.isFinite(adjustmentValue)) return;
    setBusy("create");
    setNotice(null);
    try {
      const response = await fetch("/api/pricebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name,
          base_book_id: newBook.base_book_id,
          adjustment_type: newBook.adjustment_type,
          adjustment_value: adjustmentValue,
          start_date: newBook.start_date || null,
          end_date: newBook.end_date || null,
          active: newBook.active,
          pos_rule: newBook.pos_rule,
          branch_scope: newBook.branch_scope,
          customer_scope: newBook.customer_scope,
          creator_scope: newBook.creator_scope,
        }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const data = await response.json() as { book?: { id?: unknown; name?: unknown; prices?: unknown; start_date?: unknown; end_date?: unknown; active?: unknown } };
      if (!data.book || typeof data.book.id !== "string") throw new Error("Máy chủ không trả về bảng giá vừa tạo.");
      const calculated = Object.fromEntries(initialProducts.map((product) => [product.id, Math.max(0, Math.round(Number(product.price) * (1 + adjustmentValue / 100)))]));
      const returnedPrices = data.book.prices && typeof data.book.prices === "object" ? data.book.prices as Record<string, number> : calculated;
      const book: PriceBook = {
        id: data.book.id,
        name: typeof data.book.name === "string" ? data.book.name : name,
        prices: returnedPrices,
        start_date: typeof data.book.start_date === "string" ? data.book.start_date : undefined,
        end_date: typeof data.book.end_date === "string" ? data.book.end_date : undefined,
        active: typeof data.book.active === "boolean" ? data.book.active : true,
        base_book_id: newBook.base_book_id,
        adjustment_type: newBook.adjustment_type,
        adjustment_value: adjustmentValue,
        pos_rule: newBook.pos_rule,
      };
      setBooks((current) => [...current.filter((item) => item.id !== book.id), book]);
      setSelectedBookId(book.id);
      setNewBook({ name: "", base_book_id: "base", adjustment_type: "percent", adjustment_value: "0", start_date: nowLocal(), end_date: "", active: true, pos_rule: "allow", branch_scope: "all", customer_scope: "all", creator_scope: "all" });
      setCreateTab("info");
      setModal(null);
      setNotice({ kind: "success", text: `Đã tạo ${book.name}.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể tạo bảng giá." });
    } finally {
      setBusy(null);
    }
  }

  async function exportExcel() {
    const XLSX = await getXLSX();
    const rows = filtered.map((product) => [product.sku, product.name, product.stock_quantity, Number(product.cost) || 0, Number(product.cost) || 0, getPrice(product)]);
    const sheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, selectedBook.name.slice(0, 31) || "Bảng giá");
    XLSX.writeFile(workbook, `BangGia_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`);
    setNotice({ kind: "success", text: `Đã xuất ${filtered.length} hàng hóa ra file Excel.` });
  }

  async function downloadTemplate() {
    const XLSX = await getXLSX();
    const sheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ["NSTP00030", "Tên hàng ví dụ", "0", "0", "0", "10000"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "BangGiaMau");
    XLSX.writeFile(workbook, "BangGiaMau.xlsx");
  }

  async function importExcel() {
    const XLSX = await getXLSX();
    const file = importInput.current?.files?.[0];
    if (!file) { setNotice({ kind: "error", text: "Vui lòng chọn tệp Excel." }); return; }
    setBusy("import");
    try {
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }).slice(1);
      const bySku = new Map(initialProducts.map((product) => [product.sku.trim().toLowerCase(), product]));
      const prices = { ...selectedBook.prices };
      let updated = 0;
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        const sku = String(row[0] ?? "").trim().toLowerCase();
        const product = bySku.get(sku);
        const price = Number(row[5] ?? row[row.length - 1]);
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

  const visibleCount = 5;
  return <div className="kv-shell product-page pricebook-page">
    <ManagementHeader profile={profile} active="pricebook" />
    <div className="product-actions pricebook-actions">
      <h1>{selectedBook.name}</h1>
      <div className="pricebook-search"><label className="product-query"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Theo mã, tên hàng" /></label></div>
      <div className="product-toolbar pricebook-toolbar">
        <button type="button" className="pricebook-tool primary" title="Tạo bảng giá" aria-label="Tạo bảng giá" onClick={() => { setCreateTab("info"); setModal("create"); }}><Plus /></button>
        <button type="button" className="pricebook-tool" title="Import file" aria-label="Import file" onClick={() => setModal("import")}><ImportFileIcon /></button>
        <button type="button" className="pricebook-tool" title="Xuất file" aria-label="Xuất file" onClick={exportExcel}><ExportFileIcon /></button>
        <button type="button" className="pricebook-tool" title="Thiết lập" aria-label="Thiết lập" onClick={openSettings}><Settings /></button>
        <button type="button" className="pricebook-tool" title="Hướng dẫn sử dụng" aria-label="Hướng dẫn sử dụng" onClick={() => setModal("help")}><HelpCircle /></button>
      </div>
    </div>
    <main className="product-workspace pricebook-workspace">
      <aside className="product-filter-sidebar pricebook-sidebar">
        <section><h2>Bảng giá <button type="button" onClick={() => { setCreateTab("info"); setModal("create"); }}>Tạo mới</button></h2><select aria-label="Chọn bảng giá" value={selectedBook.id} onChange={(event) => selectBook(event.target.value)}>{books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}</select><div className="pricebook-chip"><span>{selectedBook.name}</span>{isDirty && <i title="Có thay đổi chưa lưu" />}<button type="button" aria-label="Bỏ chọn bảng giá" title="Bỏ chọn" onClick={() => selectBook("base")}><X /></button></div></section>
        <section><h2>Nhóm hàng</h2><select aria-label="Nhóm hàng" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">Chọn nhóm hàng</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></section>
        <section><h2>Tồn kho</h2><select aria-label="Tồn kho" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">Tất cả</option><option value="in">Còn hàng trong kho</option><option value="out">Hết hàng trong kho</option></select></section>
        <section><h2>Giá bán</h2><select aria-label="Điều kiện giá bán" value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}><option value="all">Chọn điều kiện</option><option value="below_cost">Nhỏ hơn giá so sánh</option><option value="above_cost">Lớn hơn giá so sánh</option><option value="zero">Bằng 0</option></select><select aria-label="Giá so sánh" value={compareFilter} onChange={(event) => setCompareFilter(event.target.value)} disabled={priceFilter === "all"}><option value="cost">Giá vốn</option><option value="base">Bảng giá chung</option></select></section>
      </aside>
      <section className="product-content pricebook-content">
        {notice && <div className={`product-notice pricebook-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)}>×</button></div>}
        <div className="pricebook-summary"><div><strong>{selectedBook.name}</strong><span>{filtered.length} hàng hóa</span>{isDirty && <em>Chưa lưu</em>}</div><button type="button" disabled={!isDirty || busy !== null} onClick={() => savePrices()}><Check />{busy === "save" ? "Đang lưu..." : "Lưu thay đổi"}</button></div>
        <div className="product-table pricebook-table"><table><thead><tr><th>Mã hàng</th><th>Tên hàng</th><th className="number-cell">Giá vốn</th><th className="number-cell">Giá nhập cuối</th><th className="number-cell">{selectedBook.name}</th></tr><tr className="pricebook-filter-row"><th><label><Search /><input aria-label="Lọc mã hàng" value={skuQuery} onChange={(event) => setSkuQuery(event.target.value)} placeholder="Mã hàng" /></label></th><th><label><Search /><input aria-label="Lọc tên hàng" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} placeholder="Tên hàng" /></label></th><th /><th /><th /></tr></thead><tbody>{filtered.map((product) => <tr className="product-row" key={product.id}><td className="pricebook-sku">{product.sku}</td><td><b className="pricebook-product-name">{product.name}</b></td><td className="number-cell">{money(Number(product.cost) || 0)}</td><td className="number-cell">{money(Number(product.cost) || 0)}</td><td className="price-input-cell"><input aria-label={`Giá ${product.name}`} type="text" inputMode="numeric" value={money(getPrice(product))} onFocus={(event) => event.target.select()} onChange={(event) => updatePrice(product.id, event.target.value)} /></td></tr>)}{!filtered.length && <tr><td colSpan={visibleCount}><div className="product-empty"><Search size={42} /><strong>Không có hàng hóa phù hợp</strong><p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</p></div></td></tr>}</tbody></table></div>
      </section>
    </main>
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>

    {modal === "create" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><form className="product-modal pricebook-modal pricebook-create-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={createBook}><header><div><h2>Tạo bảng giá</h2></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header>
      <div className="pricebook-tabs"><button type="button" className={createTab === "info" ? "active" : ""} onClick={() => setCreateTab("info")}>Thông tin</button><button type="button" className={createTab === "scope" ? "active" : ""} onClick={() => setCreateTab("scope")}>Phạm vi áp dụng</button></div>
      <div className="pricebook-create-body">
        {createTab === "info" && <div className="pricebook-tab-pane">
          <div className="pb-field"><label>Tên bảng giá</label><input autoFocus required value={newBook.name} onChange={(event) => setNewBook((current) => ({ ...current, name: event.target.value }))} placeholder="Nhập tên bảng giá" /></div>
          <div className="pb-card"><div className="pb-card-title">Hiệu lực</div><div className="pb-card-body">
            <div className="pb-field-row"><label>Hiệu lực</label><div className="pb-datetime"><input type="datetime-local" value={newBook.start_date} onChange={(event) => setNewBook((current) => ({ ...current, start_date: event.target.value }))} /><span>đến</span><input type="datetime-local" value={newBook.end_date} onChange={(event) => setNewBook((current) => ({ ...current, end_date: event.target.value }))} /></div></div>
            <div className="pb-field-row"><label>Trạng thái</label><div className="pb-radios"><label className="pb-radio"><input type="radio" name="pb-status" checked={newBook.active} onChange={() => setNewBook((current) => ({ ...current, active: true }))} /><span>Áp dụng</span></label><label className="pb-radio"><input type="radio" name="pb-status" checked={!newBook.active} onChange={() => setNewBook((current) => ({ ...current, active: false }))} /><span>Chưa áp dụng</span></label></div></div>
          </div></div>
          <div className="pb-card"><div className="pb-card-title">Công thức giá</div><div className="pb-card-body"><p className="pb-hint">Tạo công thức dựa trên giá vốn, giá nhập hoặc giá bán ở các bảng giá khác</p>
            <div className="pb-formula"><span>Giá mới =</span><select value={newBook.base_book_id} onChange={(event) => setNewBook((current) => ({ ...current, base_book_id: event.target.value }))}>{books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}</select><select value={newBook.adjustment_type} onChange={(event) => setNewBook((current) => ({ ...current, adjustment_type: event.target.value as "vnd" | "percent" }))}><option value="vnd">VND</option><option value="percent">%</option></select><input type="number" step="any" value={newBook.adjustment_value} onChange={(event) => setNewBook((current) => ({ ...current, adjustment_value: event.target.value }))} /></div>
          </div></div>
          <div className="pb-card"><div className="pb-card-title">Khi thu ngân lên đơn với bảng giá này</div><div className="pb-card-body"><label className="pb-radio"><input type="radio" name="pb-pos" checked={newBook.pos_rule === "allow"} onChange={() => setNewBook((current) => ({ ...current, pos_rule: "allow" }))} /><span>Được phép thêm hàng hóa không có trong bảng giá</span></label><label className="pb-radio"><input type="radio" name="pb-pos" checked={newBook.pos_rule === "warn"} onChange={() => setNewBook((current) => ({ ...current, pos_rule: "warn" }))} /><span>Gửi cảnh báo khi thêm hàng hóa không có trong bảng giá</span></label><label className="pb-radio"><input type="radio" name="pb-pos" checked={newBook.pos_rule === "strict"} onChange={() => setNewBook((current) => ({ ...current, pos_rule: "strict" }))} /><span>Chỉ được thêm hàng hóa có trong bảng giá này</span></label></div></div>
        </div>}
        {createTab === "scope" && <div className="pricebook-tab-pane">
          <div className="pb-card"><div className="pb-card-title">Chi nhánh</div><div className="pb-card-body"><span style={{fontSize:"13px", color:"#374450"}}>Toàn hệ thống — 1 chi nhánh mặc định (không cần chọn)</span></div></div>
          <div className="pb-card"><div className="pb-card-title">Nhóm khách hàng</div><div className="pb-card-body"><label className="pb-radio"><input type="radio" name="pb-customer" checked={newBook.customer_scope === "all"} onChange={() => setNewBook((current) => ({ ...current, customer_scope: "all" }))} /><span>Tất cả</span></label><label className="pb-radio"><input type="radio" name="pb-customer" checked={newBook.customer_scope === "specific"} onChange={() => setNewBook((current) => ({ ...current, customer_scope: "specific" }))} /><span>Nhóm khách hàng cụ thể</span></label></div></div>
          <div className="pb-card"><div className="pb-card-title">Người tạo giao dịch</div><div className="pb-card-body"><label className="pb-radio"><input type="radio" name="pb-creator" checked={newBook.creator_scope === "all"} onChange={() => setNewBook((current) => ({ ...current, creator_scope: "all" }))} /><span>Tất cả</span></label><label className="pb-radio"><input type="radio" name="pb-creator" checked={newBook.creator_scope === "specific"} onChange={() => setNewBook((current) => ({ ...current, creator_scope: "specific" }))} /><span>Người tạo giao dịch cụ thể</span></label></div></div>
        </div>}
      </div>
      <footer><button type="button" onClick={() => setModal(null)}>Bỏ qua</button><button className="primary" disabled={busy !== null}>{busy === "create" ? "Đang tạo..." : "Lưu"}</button></footer>
    </form></div>}

    {modal === "import" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal pricebook-modal pricebook-import-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Thêm sản phẩm từ file excel</h2></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="pricebook-import-body"><p className="pb-hint">(Tải về file mẫu: <button type="button" className="pb-link" onClick={downloadTemplate}>Excel file</button>)</p><div className="pb-file"><FileUp size={22} /><label>Chọn file dữ liệu<input ref={importInput} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" /></label></div><p className="pb-hint">File cần có cột Mã hàng và cột Giá bán (cột cuối cùng).</p></div><footer><button type="button" onClick={() => setModal(null)}>Bỏ qua</button><button type="button" className="primary" disabled={busy !== null} onClick={importExcel}>{busy === "import" || busy === "save" ? "Đang nhập..." : "Lưu"}</button></footer></section></div>}

    {modal === "settings" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><form className="product-modal pricebook-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={renameBook}><header><div><h2>Thiết lập bảng giá</h2><p>{selectedBook.name}</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header>{selectedBook.id === "base" ? <div className="pricebook-base-message">Bảng giá chung là bảng giá mặc định. Bạn có thể sửa giá và lưu thay đổi, nhưng không thể đổi tên hoặc xóa.</div> : <div className="product-form pricebook-form"><label>Tên bảng giá<input autoFocus required value={rename} onChange={(event) => setRename(event.target.value)} /></label></div>}<footer>{selectedBook.id !== "base" && <button type="button" className="pricebook-delete" disabled={busy !== null} onClick={deleteBook}><Trash2 />{busy === "delete" ? "Đang xóa..." : "Xóa bảng giá"}</button>}<span /><button type="button" onClick={() => setModal(null)}>Đóng</button>{selectedBook.id !== "base" && <button className="primary" disabled={busy !== null}>{busy === "rename" ? "Đang lưu..." : "Lưu tên"}</button>}</footer></form></div>}

    {modal === "help" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal pricebook-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Hướng dẫn bảng giá</h2><p>Tạo và cập nhật giá bán theo từng nhóm khách hàng</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="pricebook-help"><h3>Chỉnh sửa giá</h3><p>Chọn một bảng giá, nhập giá mới trực tiếp trong cột bên phải rồi bấm <b>Lưu thay đổi</b>.</p><h3>Import và xuất file</h3><p>Import file Excel với cột Mã hàng ở đầu và Giá bán ở cuối. Import thành công sẽ tự động lưu.</p><h3>Bảng giá chung</h3><p>Thay đổi trên bảng giá chung cập nhật giá bán cơ bản của hàng hóa.</p></div><footer><button type="button" className="primary" onClick={() => setModal(null)}>Đã hiểu</button></footer></section></div>}
  </div>;
}
