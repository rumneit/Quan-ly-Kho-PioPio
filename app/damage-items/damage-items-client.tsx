"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, HelpCircle, Plus, Search, Settings, Star, X } from "lucide-react";
import * as XLSX from "xlsx";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import DateRangePicker, { type DateValue } from "@/app/date-range-picker";
import { toVnDateKey } from "@/lib/vn-time";

type Product = { id: string; name: string; sku: string; price: number; cost?: number; stock_quantity: number; base_unit?: string | null };
type Status = "draft" | "completed" | "cancelled";
type Voucher = { id: string; code: string; status: Status; note: string; totalValue: number; creator: string; exporter: string; createdAt: string; branch: string; favorite: boolean };
type ColumnKey = "code" | "totalValue" | "time" | "branch" | "note" | "status";
type Notice = { kind: "success" | "error"; text: string } | null;
type Modal = "settings" | "help" | null;
type Mode = "list" | "create";

const statusLabel: Record<Status, string> = { draft: "Phiếu tạm", completed: "Hoàn thành", cancelled: "Đã hủy" };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const dateTime = (value: string) => value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "---";
const startOfDay = (value: string) => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; };
const endOfDay = (value: string) => { const date = new Date(value); date.setHours(23, 59, 59, 999); return date; };

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

const columns: Array<{ key: ColumnKey; label: string }> = [
  { key: "code", label: "Mã xuất hủy" },
  { key: "totalValue", label: "Tổng giá trị hủy" },
  { key: "time", label: "Thời gian" },
  { key: "branch", label: "Chi nhánh" },
  { key: "note", label: "Ghi chú" },
  { key: "status", label: "Trạng thái" },
];

export default function DamageItemsClient({ profile, initialProducts }: { profile: Profile; initialProducts: Product[] }) {
  const [mode, setMode] = useState<Mode>("list");
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [codeQuery, setCodeQuery] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
const [dateValue, setDateValue] = useState<DateValue>(() => { const now = new Date(); const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; return { preset: "this_month", from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; });
  const [statuses, setStatuses] = useState<Status[]>(["draft", "completed", "cancelled"]);
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [exporterFilter, setExporterFilter] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [page, setPage] = useState(1);
  const [settings, setSettings] = useState({ pageSize: 15, codeMode: "auto" as "auto" | "manual" });
  const [productQuery, setProductQuery] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [createStatus, setCreateStatus] = useState<"draft" | "completed">("draft");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [modal]);

  async function loadVouchers() {
    setLoading(true);
    try {
      const response = await fetch("/api/damage-items");
      if (!response.ok) throw new Error(await apiError(response));
      const data = await response.json() as { vouchers?: Array<{ id: unknown; code: unknown; status: unknown; note?: unknown; total_value?: unknown; creator?: unknown; created_at?: unknown }>; truncated?: boolean };
      setTruncated(data.truncated === true);
      const list: Voucher[] = (data.vouchers || []).map((row) => {
        const creator = typeof row.creator === "string" ? row.creator : "";
        return {
          id: String(row.id),
          code: String(row.code || ""),
          status: row.status === "completed" || row.status === "cancelled" ? row.status : "draft",
          note: typeof row.note === "string" ? row.note : "",
          totalValue: Number(row.total_value || 0),
          creator,
          exporter: creator,
          createdAt: typeof row.created_at === "string" ? row.created_at : "",
          branch: "Chi nhánh trung tâm",
          favorite: false,
        };
      });
      setVouchers(list);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể tải phiếu xuất hủy." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVouchers();
  }, []);

  const creators = useMemo(() => {
    const set = new Set<string>();
    if (profile.full_name) set.add(profile.full_name);
    vouchers.forEach((item) => { if (item.creator) set.add(item.creator); });
    return [...set];
  }, [vouchers, profile.full_name]);

  const exporters = useMemo(() => {
    const set = new Set<string>();
    if (profile.full_name) set.add(profile.full_name);
    vouchers.forEach((item) => { if (item.exporter) set.add(item.exporter); });
    return [...set];
  }, [vouchers, profile.full_name]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const byCode = codeQuery.trim().toLowerCase();
    const byNote = noteQuery.trim().toLowerCase();
    const now = new Date();
    return vouchers.filter((item) => {
      const created = toVnDateKey(item.createdAt);
      const dateOk = dateValue.preset === "all" || ((!dateValue.from || created >= dateValue.from) && (!dateValue.to || created <= dateValue.to));
      return `${item.code} ${item.note}`.toLowerCase().includes(keyword)
        && item.code.toLowerCase().includes(byCode)
        && item.note.toLowerCase().includes(byNote)
        && statuses.includes(item.status)
        && (creatorFilter === "all" || item.creator === creatorFilter)
        && (exporterFilter === "all" || item.exporter === exporterFilter)
        && dateOk;
    });
  }, [vouchers, query, codeQuery, noteQuery, statuses, creatorFilter, exporterFilter, dateValue]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / settings.pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * settings.pageSize, safePage * settings.pageSize);

  const createProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return !q ? initialProducts : initialProducts.filter((product) => `${product.sku} ${product.name} ${product.base_unit || ""}`.toLowerCase().includes(q));
  }, [initialProducts, productQuery]);
  const totalValue = useMemo(() => initialProducts.reduce((sum, product) => sum + Number(quantities[product.id] || 0) * Number(product.cost || product.price || 0), 0), [initialProducts, quantities]);
  const selectedCount = useMemo(() => initialProducts.filter((product) => Number(quantities[product.id] || 0) > 0).length, [initialProducts, quantities]);

  function toggleStatus(status: Status) {
    setStatuses((current) => current.includes(status) ? current.filter((value) => value !== status) : [...current, status]);
    setPage(1);
  }

  const nextCode = () => `XH${String(Date.now()).slice(-8)}`;

  function openCreate() {
    setQuantities({});
    setProductQuery("");
    setNote("");
    setCreateStatus("draft");
    setCode(settings.codeMode === "manual" ? "" : nextCode());
    setMode("create");
  }

  async function saveVoucher(status: Exclude<Status, "cancelled">) {
    if (saving) return;
    const lines = initialProducts.filter((product) => Number(quantities[product.id] || 0) > 0).map((product) => ({ product_id: product.id, quantity: Number(quantities[product.id]) }));
    if (!lines.length) { setNotice({ kind: "error", text: "Vui lòng nhập số lượng hủy cho ít nhất một hàng hóa." }); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/damage-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note.trim(), lines }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      setNotice({ kind: "success", text: status === "draft" ? "Đã lưu phiếu xuất hủy tạm." : "Đã hoàn thành phiếu xuất hủy; tồn kho đã được cập nhật." });
      setMode("list");
      setQuantities({});
      setProductQuery("");
      setNote("");
      setCode(nextCode());
      await loadVouchers();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể lưu phiếu xuất hủy." });
    } finally {
      setSaving(false);
    }
  }

  function exportExcel() {
    const header = ["Mã xuất hủy", "Tổng giá trị hủy", "Thời gian", "Chi nhánh", "Ghi chú", "Trạng thái"];
    const rows = filtered.map((item) => [item.code, item.totalValue, dateTime(item.createdAt), item.branch, item.note, statusLabel[item.status]]);
    const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "XuatHuy");
    XLSX.writeFile(workbook, `XuatHuy_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`);
    setNotice({ kind: "success", text: `Đã xuất ${filtered.length} phiếu xuất hủy ra file Excel.` });
  }

  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([["Mã hàng", "SL hủy"], ["NSTP00030", 2]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "MauXuatHuy");
    XLSX.writeFile(workbook, "MauXuatHuy.xlsx");
  }

  async function importExcel() {
    const file = importInput.current?.files?.[0];
    if (!file) { setNotice({ kind: "error", text: "Vui lòng chọn tệp Excel." }); return; }
    try {
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }).slice(1);
      const bySku = new Map(initialProducts.map((product) => [product.sku.trim().toLowerCase(), product]));
      const next = { ...quantities };
      let updated = 0;
      for (const row of data) {
        if (!Array.isArray(row)) continue;
        const sku = String(row[0] ?? "").trim().toLowerCase();
        const product = bySku.get(sku);
        const quantity = Math.trunc(Number(row[1]));
        if (product && Number.isFinite(quantity) && quantity >= 0) {
          next[product.id] = Math.min(quantity, Number(product.stock_quantity));
          updated += 1;
        }
      }
      if (!updated) { setNotice({ kind: "error", text: "Không tìm thấy mã hàng và số lượng hợp lệ trong file." }); return; }
      setQuantities(next);
      setNotice({ kind: "success", text: `Đã nhập số lượng hủy cho ${updated} hàng hóa.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể nhập file Excel." });
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  }

  const cell = (item: Voucher, key: ColumnKey) => {
    if (key === "code") return <b className="damage-code">{item.code}</b>;
    if (key === "totalValue") return money(item.totalValue);
    if (key === "time") return dateTime(item.createdAt);
    if (key === "note") return item.note || "---";
    if (key === "status") return <span className={`stock-status ${item.status === "completed" ? "completed" : item.status}`}>{statusLabel[item.status]}</span>;
    return item[key];
  };

  return <div className="kv-shell product-page damage-page">
    <ManagementHeader profile={profile} active="damage-items" />
    <div className={`product-actions damage-actions ${mode === "create" ? "damage-create-actions" : ""}`}>
      {mode === "list" ? <>
        <h1>Xuất hủy</h1>
        <div className="damage-search"><label className="product-query"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Theo mã xuất hủy" /></label></div>
        <div className="product-toolbar damage-toolbar">
          <button type="button" className="damage-tool primary" title="Tạo phiếu xuất hủy" aria-label="Tạo phiếu xuất hủy" onClick={openCreate}><Plus /></button>
          <button type="button" className="damage-tool" title="Xuất file" aria-label="Xuất file" onClick={exportExcel}><ExportFileIcon /></button>
          <button type="button" className="damage-tool" title="Thiết lập" aria-label="Thiết lập" onClick={() => setModal("settings")}><Settings /></button>
          <button type="button" className="damage-tool" title="Hướng dẫn" aria-label="Hướng dẫn" onClick={() => setModal("help")}><HelpCircle /></button>
        </div>
      </> : <>
        <button type="button" className="damage-back" aria-label="Quay lại danh sách" onClick={() => setMode("list")}><ArrowLeft size={18} />Xuất hủy</button>
        <div className="damage-create-title"><strong>Lập phiếu xuất hủy</strong><span>Hàng hóa hỏng, lỗi hoặc hết hạn bị loại khỏi kho</span></div>
        <div />
      </>}
    </div>

    <main className={`product-workspace damage-workspace ${mode === "create" ? "damage-workspace-create" : sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      {mode === "list" && truncated && <div style={{background:"#fff4e8", border:"1px solid #ffe2b8", color:"#7a4a00", padding:"8px 12px", borderRadius:"6px", fontSize:"12px", marginBottom:"12px"}}>⚠️ Dữ liệu đã đạt giới hạn 500 phiếu gần nhất. Kết quả có thể bị cắt cụt – vui lòng thu hẹp khoảng thời gian.</div>}
      {mode === "list" ? <>
        {sidebarCollapsed
          ? <button className="sidebar-collapse collapsed" aria-label="Mở bộ lọc" onClick={() => setSidebarCollapsed(false)}><ChevronRight /></button>
          : <aside className="product-filter-sidebar damage-sidebar">
            <section><h2>Trạng thái</h2>{(["draft", "completed", "cancelled"] as Status[]).map((status) => <label className="stock-check" key={status}><input type="checkbox" checked={statuses.includes(status)} onChange={() => toggleStatus(status)} /><span>{statusLabel[status]}</span></label>)}</section>
            <section><h2>Thời gian</h2>
              <DateRangePicker value={dateValue} onChange={setDateValue} />
            </section>
            <section><h2>Người tạo</h2><select aria-label="Người tạo" value={creatorFilter} onChange={(event) => { setCreatorFilter(event.target.value); setPage(1); }}><option value="all">Chọn người tạo</option>{creators.map((name) => <option key={name} value={name}>{name}</option>)}</select></section>
            <section><h2>Người xuất hủy</h2><select aria-label="Người xuất hủy" value={exporterFilter} onChange={(event) => { setExporterFilter(event.target.value); setPage(1); }}><option value="all">Chọn người xuất hủy</option>{exporters.map((name) => <option key={name} value={name}>{name}</option>)}</select></section>
            <button type="button" className="sidebar-collapse" aria-label="Thu gọn bộ lọc" onClick={() => setSidebarCollapsed(true)}><ChevronLeft /></button>
          </aside>}
        <section className="product-content damage-content">
          {notice && <div className={`product-notice damage-notice ${notice.kind === "error" ? "error" : ""}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)}>×</button></div>}
          <div className="product-table damage-table"><table>
            <thead>
              <tr><th className="stock-select"><input aria-label="Chọn tất cả" type="checkbox" /></th><th className="stock-star"><Star size={16} /></th>{columns.map((column) => <th key={column.key} className={column.key === "totalValue" ? "number-cell" : ""}>{column.label}</th>)}</tr>
              <tr className="damage-filter-row"><th /><th /><th><label><Search size={13} /><input aria-label="Lọc mã xuất hủy" value={codeQuery} onChange={(event) => { setCodeQuery(event.target.value); setPage(1); }} placeholder="Mã xuất hủy" /></label></th><th /><th /><th /><th><label><Search size={13} /><input aria-label="Lọc ghi chú" value={noteQuery} onChange={(event) => { setNoteQuery(event.target.value); setPage(1); }} placeholder="Ghi chú" /></label></th><th /></tr>
            </thead>
            <tbody>
              {rows.map((item) => <tr className="product-row" key={item.id}>
                <td className="stock-select"><input aria-label={`Chọn ${item.code}`} type="checkbox" /></td>
                <td className="stock-star"><button type="button" aria-label="Đánh dấu" onClick={() => setVouchers((current) => current.map((row) => row.id === item.id ? { ...row, favorite: !row.favorite } : row))}><Star size={17} fill={item.favorite ? "#f5a623" : "none"} color={item.favorite ? "#f5a623" : "currentColor"} /></button></td>
                {columns.map((column) => <td className={column.key === "totalValue" ? "number-cell" : ""} key={column.key}>{cell(item, column.key)}</td>)}
              </tr>)}
              {!rows.length && !loading && <tr><td colSpan={8}><div className="product-empty damage-empty"><Search size={42} /><strong>Không tìm thấy kết quả</strong><p>Không có phiếu xuất hủy phù hợp với bộ lọc hiện tại.</p><button type="button" className="primary" onClick={openCreate}>Xuất hủy</button></div></td></tr>}
              {loading && !vouchers.length && <tr><td colSpan={8}><div className="product-empty damage-empty"><p>Đang tải phiếu xuất hủy...</p></div></td></tr>}
            </tbody>
          </table></div>
          <footer className="product-pager"><span>Hiển thị {filtered.length ? (safePage - 1) * settings.pageSize + 1 : 0}–{Math.min(safePage * settings.pageSize, filtered.length)} / {filtered.length} phiếu</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button><button type="button" className="current">{safePage}</button><button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button></div></footer>
        </section>
      </> : <>
        <section className="damage-create-main">
          <div className="damage-create-tools">
            <label className="product-query damage-create-search"><Search size={18} /><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Theo mã, tên hàng" /></label>
            <div className="damage-import">
              <label className="damage-import-btn"><ImportFileIcon />Thêm sản phẩm từ file excel<input ref={importInput} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={importExcel} /></label>
              <span className="damage-import-hint">(Tải về file mẫu: <button type="button" className="damage-template-btn" onClick={downloadTemplate}>Excel file</button>)</span>
            </div>
          </div>
          <div className="product-table damage-create-table"><table>
            <thead><tr><th className="stt">STT</th><th>Mã hàng</th><th>Tên hàng</th><th>ĐVT</th><th className="number-cell">SL hủy</th><th className="number-cell">Giá vốn</th><th className="number-cell">Giá trị hủy</th></tr></thead>
            <tbody>
              {createProducts.map((product, index) => {
                const quantity = Number(quantities[product.id] || 0);
                const value = quantity * Number(product.cost || product.price || 0);
                return <tr className="product-row" key={product.id}>
                  <td className="stt">{index + 1}</td>
                  <td className="damage-unit">{product.sku}</td>
                  <td><b className="damage-product-name">{product.name}</b></td>
                  <td className="damage-unit">{product.base_unit || "Cái"}</td>
                  <td className="number-cell"><input className="damage-qty-input" aria-label={`Số lượng hủy ${product.name}`} type="number" min="0" max={Number(product.stock_quantity)} value={quantity} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: Math.min(Number(product.stock_quantity), Math.max(0, Math.trunc(Number(event.target.value) || 0))) }))} /></td>
                  <td className="number-cell">{money(Number(product.cost || product.price || 0))}</td>
                  <td className="number-cell"><b className="damage-value-cell">{money(value)}</b></td>
                </tr>;
              })}
              {!createProducts.length && <tr><td colSpan={7}><div className="product-empty damage-create-empty"><Search size={38} /><strong>Không có hàng hóa</strong><p>Thử thay đổi từ khóa tìm kiếm.</p></div></td></tr>}
            </tbody>
          </table></div>
          <footer className="damage-create-footer"><span>{selectedCount} hàng hóa được chọn</span><button type="button" disabled={!selectedCount || saving} onClick={() => saveVoucher("draft")}>Lưu tạm</button><button type="button" className="primary" disabled={!selectedCount || saving} onClick={() => saveVoucher("completed")}><Check size={16} />Hoàn thành</button></footer>
        </section>
        <aside className="damage-create-panel">
          <label>Mã xuất hủy<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Tự động sinh khi lưu" readOnly style={{background:"#f7f9fb", color:"#6b7a8d"}} title="Mã tự động sinh khi lưu" /></label>
          <label>Trạng thái<select value={createStatus} onChange={(event) => setCreateStatus(event.target.value as "draft" | "completed")}><option value="draft">Phiếu tạm</option><option value="completed">Hoàn thành</option></select></label>
          <label>Ghi chú<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhập ghi chú phiếu xuất hủy" /></label>
          <div className="damage-create-total"><span>Tổng giá trị hủy</span><b>{money(totalValue)}</b></div>
        </aside>
      </>}
    </main>

    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>

    {modal === "settings" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal damage-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Thiết lập phiếu xuất hủy</h2><p>Cấu hình mã phiếu và số phiếu mỗi trang</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="damage-settings">
      <label>Mã phiếu<select value={settings.codeMode} onChange={(event) => setSettings((current) => ({ ...current, codeMode: event.target.value as "auto" | "manual" }))}><option value="auto">Tự động sinh mã</option><option value="manual">Nhập tay mã phiếu</option></select></label>
      <label>Số phiếu mỗi trang<select value={settings.pageSize} onChange={(event) => setSettings((current) => ({ ...current, pageSize: Number(event.target.value) }))}><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option><option value={30}>30</option></select></label>
    </div><footer><span /><button type="button" onClick={() => setModal(null)}>Đóng</button></footer></section></div>}

    {modal === "help" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal damage-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Hướng dẫn xuất hủy</h2><p>Loại hàng hóa hỏng, lỗi hoặc hết hạn khỏi kho</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="damage-help">
      <h3>Tạo phiếu xuất hủy</h3><p>Bấm nút <b>＋ Tạo phiếu</b>, chọn hàng hóa, nhập số lượng hủy rồi bấm <b>Lưu tạm</b> hoặc <b>Hoàn thành</b>.</p>
      <h3>Hoàn thành phiếu</h3><p>Khi hoàn thành, tồn kho của hàng hóa sẽ tự động được trừ theo số lượng đã hủy.</p>
      <h3>Xuất file Excel</h3><p>Bấm <b>Xuất file</b> để tải danh sách phiếu xuất hủy theo bộ lọc hiện tại.</p>
      <h3>Thêm sản phẩm từ file excel</h3><p>Trong màn hình tạo phiếu, bấm <b>Thêm sản phẩm từ file excel</b> và chọn file theo mẫu <b>Excel file</b>.</p>
    </div><footer><button type="button" className="primary" onClick={() => setModal(null)}>Đã hiểu</button></footer></section></div>}
  </div>;
}
