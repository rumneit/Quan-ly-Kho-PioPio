"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, FileUp, HelpCircle, Plus, Search, Settings, Star, X } from "lucide-react";
import * as XLSX from "xlsx";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import DateRangePicker, { type DateValue } from "@/app/date-range-picker";

type Status = "draft" | "completed" | "cancelled";
type Product = { id: string; name: string; sku: string; price: number; cost?: number; stock_quantity: number; base_unit?: string | null };
type Voucher = { id: string; code: string; status: Status; purpose: string; receiver: string; note: string; totalValue: number; branch: string; time: string; creator: string; favorite: boolean };
type ColumnKey = "code" | "purpose" | "totalValue" | "time" | "branch" | "note" | "status";
type Modal = "settings" | "help" | null;
type Notice = { kind: "success" | "error"; text: string } | null;

const PAGE_SIZE = 15;
const columns: Array<{ key: ColumnKey; label: string }> = [
  { key: "code", label: "Mã xuất dùng nội bộ" },
  { key: "purpose", label: "Loại xuất" },
  { key: "totalValue", label: "Tổng giá trị" },
  { key: "time", label: "Thời gian" },
  { key: "branch", label: "Chi nhánh" },
  { key: "note", label: "Ghi chú" },
  { key: "status", label: "Trạng thái" },
];
const statusLabel: Record<Status, string> = { draft: "Phiếu tạm", completed: "Hoàn thành", cancelled: "Đã hủy" };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const dateTime = (value: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

function ImportFileIcon() {
  return <svg className="kt-file-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v6m9-8 5 5h-5V2ZM5 19v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M2 15h11m-4-4 4 4-4 4" /></svg>;
}

function ExportFileIcon() {
  return <svg className="kt-file-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8m-1-20 5 5h-5V2Zm-3 13h11m-4-4 4 4-4 4" /></svg>;
}

function mapVoucher(row: Record<string, unknown>): Voucher {
  const status = row.status === "completed" || row.status === "cancelled" ? row.status : "draft";
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    status,
    purpose: String(row.purpose ?? ""),
    receiver: String(row.receiver ?? ""),
    note: String(row.note ?? ""),
    totalValue: Number(row.total_value ?? 0),
    branch: "Chi nhánh trung tâm",
    time: String(row.created_at ?? new Date().toISOString()),
    creator: String(row.creator ?? ""),
    favorite: false,
  };
}

export default function InternalUseClient({ profile, initialProducts }: { profile: Profile; initialProducts: Product[] }) {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [query, setQuery] = useState("");
  const [codeQuery, setCodeQuery] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [statuses, setStatuses] = useState<Status[]>(["draft", "completed", "cancelled"]);
  const [dateValue, setDateValue] = useState<DateValue>(() => { const now = new Date(); const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; return { preset: "this_month", from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; });
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [receiverFilter, setReceiverFilter] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<"list" | "create">("list");
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [modal]);

  const [productQuery, setProductQuery] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"draft" | "completed">("draft");
  const [purpose, setPurpose] = useState("Sử dụng nội bộ");
  const [receiver, setReceiver] = useState("");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal-use")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data) => {
        if (cancelled) return;
        const list = data && Array.isArray(data.vouchers) ? data.vouchers as Array<Record<string, unknown>> : [];
        setVouchers(list.map(mapVoucher));
      })
      .catch(() => {
        if (!cancelled) setNotice({ kind: "error", text: "Không thể tải danh sách phiếu xuất dùng nội bộ." });
      });
    return () => { cancelled = true; };
  }, []);

  const creatorOptions = useMemo(() => Array.from(new Set(vouchers.map((item) => item.creator).filter(Boolean))), [vouchers]);
  const receiverOptions = useMemo(() => Array.from(new Set(vouchers.map((item) => item.receiver).filter(Boolean))), [vouchers]);

  const filtered = useMemo(() => {
    return vouchers.filter((item) => {
      const createdDate = item.time.slice(0, 10);
      const dateOk = dateValue.preset === "all" || ((!dateValue.from || createdDate >= dateValue.from) && (!dateValue.to || createdDate <= dateValue.to));
      const haystack = `${item.code} ${item.note} ${item.purpose} ${item.receiver} ${item.creator}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase())
        && item.code.toLowerCase().includes(codeQuery.trim().toLowerCase())
        && item.note.toLowerCase().includes(noteQuery.trim().toLowerCase())
        && statuses.includes(item.status)
        && (creatorFilter === "all" || item.creator === creatorFilter)
        && (purposeFilter === "all" || item.purpose === purposeFilter)
        && (receiverFilter === "all" || item.receiver === receiverFilter)
        && dateOk;
    });
  }, [vouchers, query, codeQuery, noteQuery, statuses, creatorFilter, purposeFilter, receiverFilter, dateValue]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const createProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return !q ? initialProducts : initialProducts.filter((product) => `${product.sku} ${product.name} ${product.base_unit || ""}`.toLowerCase().includes(q));
  }, [initialProducts, productQuery]);
  const totalValue = useMemo(() => initialProducts.reduce((sum, product) => sum + (Number(quantities[product.id]) || 0) * (Number(product.cost) || Number(product.price) || 0), 0), [initialProducts, quantities]);
  const selectedCount = Object.values(quantities).filter((value) => Number(value) > 0).length;

  function toggleStatus(value: Status) {
    setStatuses((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setPage(1);
  }

  function toggleFavorite(id: string) {
    setVouchers((current) => current.map((row) => row.id === id ? { ...row, favorite: !row.favorite } : row));
  }

  function openCreate() {
    setCode(`XNB${String(Date.now()).slice(-8)}`);
    setStatus("draft");
    setPurpose("Sử dụng nội bộ");
    setReceiver("");
    setNote("");
    setQuantities({});
    setProductQuery("");
    setMode("create");
  }

  function exportExcel() {
    const headers = ["Mã xuất dùng nội bộ", "Loại xuất", "Tổng giá trị", "Thời gian", "Chi nhánh", "Ghi chú", "Trạng thái"];
    const data = filtered.map((item) => [item.code, item.purpose, item.totalValue, dateTime(item.time), item.branch, item.note, statusLabel[item.status]]);
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "XuatDungNoiBo");
    XLSX.writeFile(workbook, `XuatDungNoiBo_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`);
    setNotice({ kind: "success", text: `Đã xuất ${filtered.length} phiếu ra file Excel.` });
  }

  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([["Mã hàng hóa", "Tên hàng hóa", "Đơn vị tính", "SL xuất"], ["NSTP00030", "Tên hàng ví dụ", "Cái", "1"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "XuatDungNoiBoMau");
    XLSX.writeFile(workbook, "XuatDungNoiBoMau.xlsx");
  }

  async function importExcel() {
    const file = importInput.current?.files?.[0];
    if (!file) { setNotice({ kind: "error", text: "Vui lòng chọn tệp Excel." }); return; }
    try {
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const bySku = new Map(initialProducts.map((product) => [product.sku.trim().toLowerCase(), product]));
      const next = { ...quantities };
      let updated = 0;
      for (const row of rows) {
        const sku = String(row["Mã hàng hóa"] ?? row["Mã hàng"] ?? "").trim().toLowerCase();
        const quantity = Number(row["SL xuất"] ?? row["Số lượng"]);
        const product = bySku.get(sku);
        if (product && Number.isFinite(quantity) && quantity > 0) {
          next[product.id] = Math.floor(quantity);
          updated += 1;
        }
      }
      if (!updated) throw new Error("Không tìm thấy mã hàng hóa hợp lệ trong file.");
      setQuantities(next);
      setNotice({ kind: "success", text: `Đã nhập ${updated} hàng hóa từ file Excel.` });
      if (importInput.current) importInput.current.value = "";
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể nhập hàng hóa từ file." });
    }
  }

  function setQuantity(productId: string, raw: string) {
    const product = initialProducts.find((p) => p.id === productId);
    const stock = Number(product?.stock_quantity || 0);
    const value = Math.min(stock, Math.max(0, Math.floor(Number(raw) || 0)));
    setQuantities((current) => ({ ...current, [productId]: value }));
  }

  async function loadVouchers() {
    try {
      const response = await fetch("/api/internal-use");
      if (!response.ok) return false;
      const data = await response.json() as { vouchers?: Array<Record<string, unknown>> };
      if (Array.isArray(data.vouchers)) setVouchers(data.vouchers.map(mapVoucher));
      return true;
    } catch {
      return false;
    }
  }

  async function saveVoucher(saveStatus: "draft" | "completed") {
    const lines = initialProducts.filter((product) => Number(quantities[product.id] || 0) > 0).map((product) => ({ product_id: product.id, quantity: Math.floor(Number(quantities[product.id])) }));
    if (!lines.length) { setNotice({ kind: "error", text: "Vui lòng nhập số lượng xuất cho ít nhất một hàng hóa." }); return; }
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/internal-use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: saveStatus, purpose: purpose.trim() || "Sử dụng nội bộ", receiver: receiver.trim(), note: note.trim(), lines }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string; message?: string } | null;
        throw new Error(data?.error || data?.message || `Không thể lưu phiếu (${response.status}).`);
      }
      await loadVouchers();
      setMode("list");
      setQuantities({});
      setProductQuery("");
      setNote("");
      setReceiver("");
      setNotice({ kind: "success", text: saveStatus === "completed" ? "Đã hoàn thành phiếu xuất dùng nội bộ." : "Đã lưu phiếu tạm xuất dùng nội bộ." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể lưu phiếu xuất dùng nội bộ." });
    } finally {
      setBusy(false);
    }
  }

  return <div className="kv-shell product-page internal-use-page">
    <ManagementHeader profile={profile} active="internal-use" />
    {mode === "list" ? (
      <>
        <div className="product-actions internal-actions">
          <h1>Xuất dùng nội bộ</h1>
          <div className="internal-search"><label className="product-query"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Theo mã xuất dùng nội bộ" /></label></div>
          <div className="product-toolbar internal-toolbar">
            <button type="button" className="internal-tool primary" title="Tạo phiếu xuất dùng nội bộ" aria-label="Tạo phiếu xuất dùng nội bộ" onClick={openCreate}><Plus /></button>
            <button type="button" className="internal-tool" title="Xuất file Excel" aria-label="Xuất file Excel" onClick={exportExcel}><ExportFileIcon /></button>
            <button type="button" className="internal-tool" title="Thiết lập" aria-label="Thiết lập" onClick={() => setModal("settings")}><Settings /></button>
            <button type="button" className="internal-tool" title="Hướng dẫn sử dụng" aria-label="Hướng dẫn sử dụng" onClick={() => setModal("help")}><HelpCircle /></button>
          </div>
        </div>
        <main className={`product-workspace internal-workspace ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
          {sidebarCollapsed ? (
            <button type="button" className="sidebar-collapse collapsed" aria-label="Mở bộ lọc" onClick={() => setSidebarCollapsed(false)}><ChevronRight /></button>
          ) : (
            <aside className="product-filter-sidebar internal-sidebar">
              <section>
                <h2>Trạng thái</h2>
                {(["draft", "completed", "cancelled"] as Status[]).map((item) => (
                  <label className="stock-check" key={item}><input type="checkbox" checked={statuses.includes(item)} onChange={() => toggleStatus(item)} />{statusLabel[item]}</label>
                ))}
              </section>
              <section>
                <h2>Thời gian</h2>
                <DateRangePicker value={dateValue} onChange={setDateValue} />
              </section>
              <section><h2>Người tạo</h2><select aria-label="Người tạo" value={creatorFilter} onChange={(event) => setCreatorFilter(event.target.value)}><option value="all">Chọn người tạo</option>{creatorOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></section>
              <section><h2>Loại xuất</h2><select aria-label="Loại xuất" value={purposeFilter} onChange={(event) => setPurposeFilter(event.target.value)}><option value="all">Tất cả</option><option>Sử dụng nội bộ</option><option>Khác</option></select></section>
              <section><h2>Người nhận</h2><select aria-label="Người nhận" value={receiverFilter} onChange={(event) => setReceiverFilter(event.target.value)}><option value="all">Chọn người nhận</option>{receiverOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></section>
              <button type="button" className="sidebar-collapse" aria-label="Thu gọn bộ lọc" onClick={() => setSidebarCollapsed(true)}><ChevronLeft /></button>
            </aside>
          )}
          <section className="product-content internal-content">
            {notice && <div className={`product-notice internal-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)}>×</button></div>}
            <div className="product-table internal-table">
              <table>
                <thead>
                  <tr>
                    <th className="internal-check"><input aria-label="Chọn tất cả" type="checkbox" /></th>
                    <th className="internal-star"><Star size={15} /></th>
                    {columns.map((column) => <th key={column.key} className={column.key === "totalValue" ? "number-cell" : ""}>{column.label}</th>)}
                  </tr>
                  <tr className="internal-filter-row">
                    <th /><th />
                    <th><label><Search /><input aria-label="Lọc mã xuất dùng nội bộ" value={codeQuery} onChange={(event) => { setCodeQuery(event.target.value); setPage(1); }} placeholder="Mã phiếu" /></label></th>
                    <th /><th /><th /><th />
                    <th><label><Search /><input aria-label="Lọc ghi chú" value={noteQuery} onChange={(event) => { setNoteQuery(event.target.value); setPage(1); }} placeholder="Ghi chú" /></label></th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr className="product-row" key={item.id}>
                      <td className="internal-check"><input aria-label={`Chọn ${item.code}`} type="checkbox" /></td>
                      <td className="internal-star"><button type="button" aria-label="Đánh dấu yêu thích" onClick={() => toggleFavorite(item.id)}><Star size={15} fill={item.favorite ? "#f5a623" : "none"} /></button></td>
                      <td><b className="internal-code">{item.code}</b></td>
                      <td>{item.purpose || "—"}</td>
                      <td className="number-cell">{money(item.totalValue)}</td>
                      <td>{dateTime(item.time)}</td>
                      <td>{item.branch}</td>
                      <td>{item.note || "—"}</td>
                      <td><span className={`stock-status ${item.status === "draft" ? "draft" : item.status === "completed" ? "balanced" : "cancelled"}`}>{statusLabel[item.status]}</span></td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr><td colSpan={columns.length + 2}><div className="product-empty internal-empty"><Search size={42} /><strong>Không tìm thấy kết quả</strong><p>Không có phiếu xuất dùng nội bộ phù hợp với bộ lọc hiện tại.</p><button type="button" className="primary" onClick={openCreate}>Xuất dùng nội bộ</button></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="product-pager">
              <span>Hiển thị {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} phiếu</span>
              <div>
                <button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button>
                <button type="button" className="current">{safePage}</button>
                <button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button>
              </div>
            </footer>
          </section>
        </main>
      </>
    ) : (
      <>
        <div className="product-actions internal-actions internal-create-actions">
          <div className="internal-create-title">
            <button type="button" className="internal-tool" title="Quay lại danh sách" aria-label="Quay lại danh sách" onClick={() => setMode("list")}><ChevronLeft /></button>
            <h1>Xuất dùng nội bộ</h1>
          </div>
          <div className="internal-search" />
          <div className="product-toolbar internal-toolbar" />
        </div>
        <main className="product-workspace internal-workspace internal-create-workspace">
          <section className="internal-create-main">
            {notice && <div className={`product-notice internal-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)}>×</button></div>}
            <div className="internal-create-tools">
              <label className="product-query internal-create-search"><Search size={18} /><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Theo mã, tên hàng" /></label>
              <div className="internal-excel">
                <span>Thêm sản phẩm từ file excel</span>
                <button type="button" className="internal-excel-link" onClick={downloadTemplate}>Excel file</button>
                <label className="internal-excel-upload"><FileUp size={14} />Chọn file<input ref={importInput} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={importExcel} /></label>
              </div>
            </div>
            <div className="product-table internal-table internal-create-table">
              <table>
                <thead>
                  <tr>
                    <th className="internal-stt">STT</th>
                    <th>Mã hàng hóa</th>
                    <th>Tên hàng hóa</th>
                    <th>Đơn vị tính</th>
                    <th className="number-cell">SL xuất</th>
                    <th className="number-cell">Giá vốn</th>
                    <th className="number-cell">Giá trị xuất</th>
                  </tr>
                </thead>
                <tbody>
                  {createProducts.map((product, index) => {
                    const quantity = Number(quantities[product.id] || 0);
                    const cost = Number(product.cost || product.price || 0);
                    return <tr className="product-row" key={product.id}>
                      <td className="internal-stt">{index + 1}</td>
                      <td><b className="internal-product-sku">{product.sku}</b></td>
                      <td>{product.name}</td>
                      <td>{product.base_unit || "Cái"}</td>
                      <td className="number-cell"><input aria-label={`SL xuất ${product.name}`} type="number" min="0" value={quantity} onChange={(event) => setQuantity(product.id, event.target.value)} /></td>
                      <td className="number-cell">{money(cost)}</td>
                      <td className="number-cell">{money(quantity * cost)}</td>
                    </tr>;
                  })}
                  {!createProducts.length && <tr><td colSpan={7}><div className="product-empty internal-create-empty"><Search size={40} /><strong>Không có hàng hóa</strong><p>Không tìm thấy hàng hóa phù hợp với từ khóa.</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="internal-create-panel">
            <h2>Thông tin phiếu</h2>
            <label>Mã xuất dùng nội bộ<input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Tự động sinh" readOnly style={{background:"#f7f9fb", color:"#6b7a8d"}} title="Mã tự động sinh khi lưu" /></label>
            <label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "completed")}><option value="draft">Phiếu tạm</option><option value="completed">Hoàn thành</option></select></label>
            <label>Loại xuất<select value={purpose} onChange={(event) => setPurpose(event.target.value)}><option>Sử dụng nội bộ</option><option>Khác</option></select></label>
            <label>Người nhận<input value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="Nhập người nhận" /></label>
            <label>Ghi chú<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhập ghi chú" rows={3} /></label>
            <div className="internal-create-total"><span>Tổng giá trị</span><strong>{money(totalValue)}</strong></div>
            <p className="internal-create-note">{selectedCount} hàng hóa được chọn</p>
            <footer className="internal-create-footer">
              <button type="button" disabled={busy || selectedCount === 0} onClick={() => saveVoucher("draft")}>Lưu tạm</button>
              <button type="button" className="primary" disabled={busy || selectedCount === 0} onClick={() => saveVoucher("completed")}><Check size={16} />Hoàn thành</button>
            </footer>
          </aside>
        </main>
      </>
    )}
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>

    {modal === "settings" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal internal-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Thiết lập xuất dùng nội bộ</h2><p>Cấu hình hiển thị và mặc định của phiếu xuất dùng nội bộ</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="internal-settings"><p className="internal-settings-note">Các tùy chọn nâng cao (số hiệu phiếu tự tăng, tự động trừ tồn kho khi hoàn thành, cảnh báo số lượng vượt tồn kho) hiện đang được bật theo mặc định và sẽ được bổ sung trong bản cập nhật tiếp theo.</p></div><footer><span /><button type="button" onClick={() => setModal(null)}>Đóng</button></footer></section></div>}

    {modal === "help" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal internal-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Hướng dẫn xuất dùng nội bộ</h2><p>Lập phiếu xuất hàng hóa phục vụ sử dụng nội bộ</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="internal-help"><h3>Lập phiếu mới</h3><p>Bấm nút <b>＋</b> trên thanh công cụ, chọn hàng hóa, nhập số lượng xuất rồi bấm <b>Lưu tạm</b> hoặc <b>Hoàn thành</b>.</p><h3>Thêm sản phẩm từ file excel</h3><p>Tải file mẫu <b>Excel file</b>, điền mã hàng hóa và số lượng xuất theo cột <b>SL xuất</b>, sau đó chọn file để hệ thống tự điền số lượng.</p><h3>Trạng thái phiếu</h3><p>Phiếu <b>Phiếu tạm</b> chưa trừ tồn kho; khi bấm <b>Hoàn thành</b>, hệ thống sẽ trừ tồn kho tương ứng.</p></div><footer><button type="button" className="primary" onClick={() => setModal(null)}>Đã hiểu</button></footer></section></div>}
  </div>;
}
