"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ChevronLeft, ChevronRight, Columns3, HelpCircle, Plus, Search, Settings, Star, X } from "lucide-react";
import * as XLSX from "xlsx";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import DateRangePicker, { type DateValue } from "@/app/date-range-picker";
import { toVnDateKey } from "@/lib/vn-time";

type Product = { id: string; name: string; sku: string; price: number; cost?: number; stock_quantity: number; base_unit?: string | null };
type Status = "draft" | "balanced" | "cancelled";
type SaveStatus = "draft" | "balanced";
type Voucher = {
  id: string;
  code: string;
  status: Status;
  note: string;
  totalActual: number;
  totalAdjustment: number;
  adjustmentValue: number;
  increaseQty: number;
  decreaseQty: number;
  actualCount: number;
  balancedAt: string;
  creator: string;
  createdAt: string;
  favorite: boolean;
};
type ColumnKey = "code" | "time" | "totalActual" | "totalAdjustment" | "increaseQty" | "decreaseQty" | "balancedAt" | "actualCount" | "note" | "status";
type ChipFilter = "all" | "match" | "diff" | "unchecked";
type Notice = { kind: "success" | "error"; text: string } | null;

const PAGE_SIZE = 15;
const columns: Array<{ key: ColumnKey; label: string; numeric?: boolean }> = [
  { key: "code", label: "Mã kiểm kho" },
  { key: "time", label: "Thời gian" },
  { key: "totalActual", label: "Tổng thực tế", numeric: true },
  { key: "totalAdjustment", label: "Tổng chênh lệch", numeric: true },
  { key: "increaseQty", label: "SL lệch tăng", numeric: true },
  { key: "decreaseQty", label: "SL lệch giảm", numeric: true },
  { key: "balancedAt", label: "Ngày cân bằng" },
  { key: "actualCount", label: "SL thực tế", numeric: true },
  { key: "note", label: "Ghi chú" },
  { key: "status", label: "Trạng thái" },
];
const EXPORT_HEADERS = ["Mã kiểm kho", "Thời gian", "Tổng thực tế", "Tổng chênh lệch", "SL lệch tăng", "SL lệch giảm", "Ngày cân bằng", "SL thực tế", "Ghi chú", "Trạng thái"];
const statusLabel: Record<Status, string> = { draft: "Phiếu tạm", balanced: "Đã cân bằng kho", cancelled: "Đã hủy" };

const number = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const formatDate = (value: string) => {
  if (!value) return "---";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "---";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function ImportFileIcon() {
  return <svg className="kt-file-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v6m9-8 5 5h-5V2ZM5 19v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M2 15h11m-4-4 4 4-4 4" /></svg>;
}

function ExportFileIcon() {
  return <svg className="kt-file-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8m-1-20 5 5h-5V2Zm-3 13h11m-4-4 4 4-4 4" /></svg>;
}

async function apiError(response: Response) {
  const data = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  return data?.error || data?.message || `Yêu cầu thất bại (${response.status}).`;
}

export default function StockTakesClient({ profile, initialProducts }: { profile: Profile; initialProducts: Product[] }) {
  const [mode, setMode] = useState<"list" | "create">("list");
  const [items, setItems] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [noteFilter, setNoteFilter] = useState("");
  const [dateValue, setDateValue] = useState<DateValue>(() => { const now = new Date(); const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; return { preset: "this_month", from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; });
  const [statuses, setStatuses] = useState<Status[]>(["draft", "balanced", "cancelled"]);
  const [creator, setCreator] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [modal, setModal] = useState<"settings" | "help" | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [modal]);

  const [productQuery, setProductQuery] = useState("");
  const [chipFilter, setChipFilter] = useState<ChipFilter>("all");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<SaveStatus>("draft");
  const [note, setNote] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(initialProducts.map((product) => [product.id, Number(product.stock_quantity)])));
  const [truncated, setTruncated] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  async function loadVouchers() {
    try {
      const response = await fetch("/api/stocktakes");
      if (!response.ok) throw new Error(await apiError(response));
      const data = await response.json() as { vouchers?: Array<Record<string, unknown>>; truncated?: boolean };
      setTruncated(data.truncated === true);
      const list: Voucher[] = (data.vouchers || []).map((value) => {
        const rawStatus = String(value.status);
        const parsed: Status = rawStatus === "balanced" || rawStatus === "cancelled" ? rawStatus : "draft";
        return {
          id: value.id ? String(value.id) : "",
          code: String(value.code || ""),
          status: parsed,
          note: String(value.note || ""),
          totalActual: Number(value.total_actual || 0),
          totalAdjustment: Number(value.total_adjustment || 0),
          adjustmentValue: Number(value.adjustment_value || 0),
          increaseQty: Number(value.increase_qty || 0),
          decreaseQty: Number(value.decrease_qty || 0),
          actualCount: Number(value.actual_count || 0),
          balancedAt: String(value.balanced_at || ""),
          creator: String(value.creator || ""),
          createdAt: String(value.created_at || ""),
          favorite: false,
        };
      });
      setItems(list);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể tải phiếu kiểm kho." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const creators = useMemo(() => Array.from(new Set([profile.full_name, ...items.map((item) => item.creator).filter(Boolean)])), [profile.full_name, items]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const codeKeyword = codeFilter.trim().toLowerCase();
    const noteKeyword = noteFilter.trim().toLowerCase();
    const now = new Date();
    return items.filter((item) => {
      const codeMatch = !keyword || item.code.toLowerCase().includes(keyword);
      const codeColumnMatch = !codeKeyword || item.code.toLowerCase().includes(codeKeyword);
      const noteColumnMatch = !noteKeyword || (item.note || "").toLowerCase().includes(noteKeyword);
      const statusMatch = statuses.includes(item.status);
      const creatorMatch = creator === "all" || item.creator === creator;
      const createdDate = toVnDateKey(item.createdAt);
      const dateMatch = dateValue.preset === "all" || ((!dateValue.from || createdDate >= dateValue.from) && (!dateValue.to || createdDate <= dateValue.to));
      return codeMatch && codeColumnMatch && noteColumnMatch && statusMatch && creatorMatch && dateMatch;
    });
    }, [items, query, codeFilter, noteFilter, statuses, creator, dateValue]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleStatus(value: Status) {
    setStatuses((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setPage(1);
  }

  function exportExcel() {
    const rows = filtered.map((item) => [item.code, formatDate(item.createdAt), item.totalActual, item.totalAdjustment, item.increaseQty, item.decreaseQty, formatDate(item.balancedAt), item.actualCount, item.note, statusLabel[item.status]]);
    const sheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "PhieuKiemKho");
    XLSX.writeFile(workbook, `PhieuKiemKho_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`);
    setNotice({ kind: "success", text: `Đã xuất ${filtered.length} phiếu kiểm kho.` });
  }

  const cell = (item: Voucher, key: ColumnKey) => {
    if (key === "code") return <b className="stocktake-code">{item.code}</b>;
    if (key === "time") return formatDate(item.createdAt);
    if (key === "balancedAt") return formatDate(item.balancedAt);
    if (key === "note") return item.note || "---";
    if (key === "status") return <span className={`stock-status ${item.status}`}>{statusLabel[item.status]}</span>;
    return number(item[key]);
  };

  const getActual = (product: Product) => Number(counts[product.id] ?? Number(product.stock_quantity));
  const searchedProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return !q ? initialProducts : initialProducts.filter((product) => `${product.sku} ${product.name} ${product.base_unit || ""}`.toLowerCase().includes(q));
  }, [initialProducts, productQuery]);
  const chips = useMemo(() => ({
    all: searchedProducts.length,
    match: searchedProducts.filter((product) => getActual(product) === Number(product.stock_quantity)).length,
    diff: searchedProducts.filter((product) => getActual(product) !== Number(product.stock_quantity)).length,
    unchecked: searchedProducts.filter((product) => getActual(product) === 0).length,
  }), [searchedProducts, counts]);
  const visibleProducts = useMemo(() => searchedProducts.filter((product) => {
    const actual = getActual(product);
    const stock = Number(product.stock_quantity);
    if (chipFilter === "match") return actual === stock;
    if (chipFilter === "diff") return actual !== stock;
    if (chipFilter === "unchecked") return actual === 0;
    return true;
  }), [searchedProducts, chipFilter, counts]);
  const totalActual = useMemo(() => visibleProducts.reduce((sum, product) => sum + getActual(product), 0), [visibleProducts, counts]);
  const recent = items.slice(0, 5);

  function setActual(productId: string, raw: string) {
    const value = Math.max(0, Number(raw) || 0);
    setCounts((current) => ({ ...current, [productId]: value }));
  }

  function resetCreate() {
    setProductQuery("");
    setChipFilter("all");
    setCode("");
    setStatus("draft");
    setNote("");
    setCounts(Object.fromEntries(initialProducts.map((product) => [product.id, Number(product.stock_quantity)])));
  }

  async function saveVoucher(nextStatus: SaveStatus) {
    if (busy) return;
    if (!initialProducts.length) {
      setNotice({ kind: "error", text: "Chưa có hàng hóa nào được kiểm." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/stocktakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          note: note.trim(),
          lines: initialProducts.map((product) => ({ product_id: product.id, actual: getActual(product) })),
        }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      setMode("list");
      setPage(1);
      resetCreate();
      await loadVouchers();
      setNotice({ kind: "success", text: nextStatus === "balanced" ? "Đã hoàn thành phiếu kiểm kho và cân bằng tồn kho." : "Đã lưu phiếu kiểm kho tạm." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể lưu phiếu kiểm kho." });
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const example = initialProducts[0];
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Mã hàng", "Tên hàng", "Tồn kho", "Thực tế"],
      [example?.sku || "NSTP00030", example?.name || "Tên hàng ví dụ", Number(example?.stock_quantity || 0), Number(example?.stock_quantity || 0)],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "MauKiemKho");
    XLSX.writeFile(workbook, "MauKiemKho.xlsx");
  }

  async function importExcel(file: File) {
    setBusy(true);
    try {
      const workbook = /\.csv$/i.test(file.name) ? XLSX.read(await file.text(), { type: "string" }) : XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }).slice(1);
      const bySku = new Map(initialProducts.map((product) => [product.sku.trim().toLowerCase(), product]));
      const next: Record<string, number> = { ...counts };
      let updated = 0;
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        const sku = String(row[0] ?? "").trim().toLowerCase();
        const product = bySku.get(sku);
        const raw = row[3] ?? row[row.length - 1];
        const actual = Number(raw);
        if (product && Number.isFinite(actual) && actual >= 0) {
          next[product.id] = Math.trunc(actual);
          updated += 1;
        }
      }
      if (!updated) throw new Error("Không tìm thấy mã hàng và số lượng hợp lệ trong file.");
      setCounts(next);
      setNotice({ kind: "success", text: `Đã nhập số lượng thực tế cho ${updated} hàng hóa.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể nhập file kiểm kho." });
    } finally {
      setBusy(false);
      if (importInput.current) importInput.current.value = "";
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) importExcel(file);
  }

  return (
    <div className="kv-shell product-page stocktakes-page">
      <ManagementHeader profile={profile} active="stocktakes" />
      {notice && <div className={`product-notice stocktake-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)}><X size={15} /></button></div>}
      {mode === "list" && truncated && <div style={{background:"#fff4e8", border:"1px solid #ffe2b8", color:"#7a4a00", padding:"8px 12px", borderRadius:"6px", fontSize:"12px", marginBottom:"12px"}}>⚠️ Dữ liệu đã đạt giới hạn 500 phiếu gần nhất. Kết quả có thể bị cắt cụt – vui lòng thu hẹp khoảng thời gian.</div>}
      {mode === "list" ? (
        <>
          <div className="product-actions stocktake-actions">
            <h1>Phiếu kiểm kho</h1>
            <div className="stocktake-search"><label className="product-query"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Theo mã phiếu kiểm" /></label></div>
            <div className="product-toolbar stock-toolbar">
              <button type="button" className="stock-tool primary" title="Kiểm kho" aria-label="Kiểm kho" onClick={() => setMode("create")}><Plus /></button>
              <button type="button" className="stock-tool" title="Xuất file" aria-label="Xuất file" onClick={exportExcel}><ExportFileIcon /></button>
              <button type="button" className="stock-tool" title="Thiết lập" aria-label="Thiết lập" onClick={() => setModal("settings")}><Settings /></button>
              <button type="button" className="stock-tool" title="Hướng dẫn" aria-label="Hướng dẫn" onClick={() => setModal("help")}><HelpCircle /></button>
            </div>
          </div>
          <main className={`product-workspace stocktake-workspace ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
            {sidebarCollapsed
              ? <button type="button" className="sidebar-collapse collapsed" aria-label="Mở bộ lọc" onClick={() => setSidebarCollapsed(false)}><ChevronRight /></button>
              : <aside className="product-filter-sidebar stocktake-sidebar">
                <section><h2>Ngày tạo</h2>
                  <DateRangePicker value={dateValue} onChange={(value) => { setDateValue(value); setPage(1); }} />
                </section>
                <section><h2>Trạng thái</h2>
                  {(["draft", "balanced", "cancelled"] as Status[]).map((value) => <label className="stock-check" key={value}><input type="checkbox" checked={statuses.includes(value)} onChange={() => toggleStatus(value)} /><span>{statusLabel[value]}</span></label>)}
                </section>
                <section><h2>Người tạo</h2>
                  <select aria-label="Người tạo" value={creator} onChange={(event) => { setCreator(event.target.value); setPage(1); }}><option value="all">Chọn người tạo</option>{creators.map((name) => <option key={name} value={name}>{name}</option>)}</select>
                </section>
                <button type="button" className="sidebar-collapse" aria-label="Thu gọn bộ lọc" onClick={() => setSidebarCollapsed(true)}><ChevronLeft /></button>
              </aside>}
            <section className="product-content stocktake-content">
              <div className="product-table stocktake-table">
                <table>
                  <thead>
                    <tr>
                      <th className="stock-select"><input type="checkbox" aria-label="Chọn tất cả" /></th>
                      <th className="stock-star"><Star size={15} /></th>
                      {columns.map((column) => <th key={column.key} className={column.numeric ? "number-cell" : ""}>{column.label}</th>)}
                    </tr>
                    <tr className="stock-filter-row">
                      <th className="stock-select" />
                      <th className="stock-star" />
                      {columns.map((column) => (
                        <th key={column.key} className={column.numeric ? "number-cell" : ""}>
                          {column.key === "code" && <label className="stock-filter-input"><Search size={13} /><input value={codeFilter} onChange={(event) => { setCodeFilter(event.target.value); setPage(1); }} placeholder="Mã kiểm kho" aria-label="Lọc mã kiểm kho" /></label>}
                          {column.key === "note" && <label className="stock-filter-input"><Search size={13} /><input value={noteFilter} onChange={(event) => { setNoteFilter(event.target.value); setPage(1); }} placeholder="Ghi chú" aria-label="Lọc ghi chú" /></label>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !items.length ? <tr><td colSpan={columns.length + 2}><div className="product-empty stocktake-empty"><span className="stock-loading">Đang tải phiếu kiểm kho…</span></div></td></tr> : rows.map((item) => (
                      <tr className="product-row" key={item.id}>
                        <td className="stock-select"><input type="checkbox" aria-label={`Chọn ${item.code}`} /></td>
                        <td className="stock-star"><button type="button" aria-label="Đánh dấu" onClick={() => setItems((current) => current.map((row) => row.id === item.id ? { ...row, favorite: !row.favorite } : row))}><Star size={16} fill={item.favorite ? "#f5a623" : "none"} color={item.favorite ? "#f5a623" : "currentColor"} /></button></td>
                        {columns.map((column) => <td key={column.key} className={column.numeric ? "number-cell" : ""}>{cell(item, column.key)}</td>)}
                      </tr>
                    ))}
                    {!loading && !rows.length && <tr><td colSpan={columns.length + 2}><div className="product-empty stocktake-empty"><Columns3 size={40} /><strong>Không tìm thấy kết quả</strong><p>Không có phiếu kiểm kho phù hợp với bộ lọc hiện tại.</p><button type="button" className="primary" onClick={() => setMode("create")}>Kiểm kho</button></div></td></tr>}
                  </tbody>
                </table>
              </div>
              <footer className="product-pager"><span>Hiển thị {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} phiếu</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button><button type="button" className="current">{safePage}</button><button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button></div></footer>
            </section>
          </main>
        </>
      ) : (
        <>
          <div className="product-actions stocktake-actions stocktake-create-actions">
            <button type="button" className="stock-back" onClick={() => setMode("list")}><ChevronLeft size={18} /><span>Quay lại</span></button>
            <h1>Kiểm kho</h1>
          </div>
          <main className="stocktake-create">
            <section className="stocktake-create-main">
              <div className="stock-summary">
                {([["all", "Tất cả"], ["match", "Khớp"], ["diff", "Lệch"], ["unchecked", "Chưa kiểm"]] as Array<[ChipFilter, string]>).map(([value, label]) => (
                  <button type="button" key={value} className={`stock-chip ${chipFilter === value ? "active" : ""}`} onClick={() => setChipFilter(value)}>{label} <b>({chips[value]})</b></button>
                ))}
              </div>
              <div className="stock-create-toolbar">
                <label className="product-query stock-create-search"><Search size={18} /><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Theo mã, tên hàng" /></label>
                <div className="stock-import">
                  <button type="button" className="stock-import-btn" disabled={busy} onClick={() => importInput.current?.click()}><ImportFileIcon />Thêm sản phẩm từ file excel</button>
                  <span className="stock-import-hint">(Tải về file mẫu: <button type="button" className="stock-link" onClick={downloadTemplate}>Excel file</button>)</span>
                  <input ref={importInput} type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} />
                </div>
              </div>
              <div className="product-table stock-create-table">
                <table>
                  <thead><tr><th className="stock-stt">STT</th><th>Mã hàng</th><th>Tên hàng</th><th>ĐVT</th><th className="number-cell">Tồn kho</th><th className="number-cell">Thực tế</th><th className="number-cell">SL lệch</th><th className="number-cell">Giá trị lệch</th></tr></thead>
                  <tbody>
                    {visibleProducts.map((product, index) => {
                      const stock = Number(product.stock_quantity);
                      const actual = getActual(product);
                      const diff = actual - stock;
                      const diffValue = diff * Number(product.cost || 0);
                      return (
                        <tr className="product-row" key={product.id}>
                          <td className="stock-stt">{index + 1}</td>
                          <td>{product.sku}</td>
                          <td><b className="stock-product-name">{product.name}</b></td>
                          <td>{product.base_unit || "Cái"}</td>
                          <td className="number-cell">{number(stock)}</td>
                          <td className="number-cell stock-edit-cell"><input type="number" min="0" step="1" aria-label={`Thực tế ${product.name}`} value={actual} onChange={(event) => setActual(product.id, event.target.value)} /></td>
                          <td className={`number-cell ${diff > 0 ? "stock-pos" : diff < 0 ? "stock-neg" : ""}`}>{diff > 0 ? `+${number(diff)}` : number(diff)}</td>
                          <td className={`number-cell ${diffValue > 0 ? "stock-pos" : diffValue < 0 ? "stock-neg" : ""}`}>{diffValue > 0 ? `+${number(diffValue)}` : number(diffValue)}</td>
                        </tr>
                      );
                    })}
                    {!visibleProducts.length && <tr><td colSpan={8}><div className="product-empty stock-create-empty"><Search size={40} /><strong>Không có hàng hóa</strong><p>Thử đổi từ khóa tìm kiếm hoặc bộ lọc.</p></div></td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            <aside className="stock-create-side">
              <div className="stock-side-block">
                <label className="stock-field"><span>Mã kiểm kho</span><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Tự động sinh (KK...)" readOnly style={{background:"#f7f9fb", color:"#6b7a8d"}} title="Mã tự động sinh khi lưu" /></label>
                <label className="stock-field"><span>Trạng thái</span><select value={status} onChange={(event) => setStatus(event.target.value as SaveStatus)}><option value="draft">Phiếu tạm</option><option value="balanced">Hoàn thành</option></select></label>
                <label className="stock-field"><span>Ghi chú</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhập ghi chú" /></label>
              </div>
              <div className="stock-side-block">
                <span className="stock-side-label">Tổng SL thực tế</span>
                <b className="stock-side-total">{number(totalActual)}</b>
              </div>
              <div className="stock-side-block stock-recent">
                <span className="stock-side-label">Kiểm gần đây</span>
                <ul>
                  {recent.map((item) => (
                    <li key={item.id}><button type="button" onClick={() => setCode(item.code)}><b>{item.code}</b><span>{formatDate(item.createdAt)}</span></button></li>
                  ))}
                  {!recent.length && <li className="stock-recent-empty">Chưa có phiếu kiểm kho</li>}
                </ul>
              </div>
              <div className="stock-side-footer">
                <button type="button" disabled={busy} onClick={() => saveVoucher("draft")}>Lưu tạm</button>
                <button type="button" className="primary" disabled={busy} onClick={() => saveVoucher("balanced")}>{busy ? "Đang lưu..." : "Hoàn thành"}</button>
              </div>
            </aside>
          </main>
        </>
      )}
      <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>

      {modal === "settings" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal stock-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Thiết lập kiểm kho</h2><p>Ngưỡng cảnh báo và cấu hình phiếu kiểm kho</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="stock-modal-body"><p className="stock-modal-note">Kiểm kho là quá trình đối soát số lượng tồn kho thực tế với số liệu trên hệ thống. Phiếu đã cân bằng kho sẽ cập nhật lại tồn kho theo số lượng thực tế đã nhập.</p><label className="stock-field"><span>Nhắc kiểm kho định kỳ</span><select><option value="never">Không nhắc</option><option value="monthly">Hằng tháng</option></select></label></div><footer><button type="button" className="primary" onClick={() => setModal(null)}>Đã hiểu</button></footer></section></div>}

      {modal === "help" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal stock-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Hướng dẫn kiểm kho</h2><p>Các bước lập phiếu kiểm kho</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="stock-modal-body stock-help"><h3>Tạo phiếu kiểm kho</h3><p>Bấm nút <b>＋ Kiểm kho</b> để bắt đầu phiếu mới. Nhập số lượng thực tế cho từng hàng hóa hoặc nhập nhanh từ file Excel.</p><h3>Khớp và lệch</h3><p>Hàng hóa có số lượng thực tế bằng tồn kho là <b>Khớp</b>; khác tồn kho là <b>Lệch</b>.</p><h3>Trạng thái phiếu</h3><p><b>Phiếu tạm</b> chỉ lưu mà không thay đổi tồn kho. <b>Đã cân bằng kho</b> sẽ cập nhật tồn kho theo số lượng thực tế.</p></div><footer><button type="button" className="primary" onClick={() => setModal(null)}>Đã hiểu</button></footer></section></div>}
    </div>
  );
}
