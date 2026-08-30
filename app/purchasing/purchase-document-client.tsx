"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Check, ChevronLeft, ChevronRight, HelpCircle, Plus, Search, Settings, Star, X } from "lucide-react";
import * as XLSX from "xlsx";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import DateRangePicker, { type DateValue } from "@/app/date-range-picker";
import { toVnDateKey } from "@/lib/vn-time";

type Product = { id: string; name: string; sku: string; price: number; cost?: number; stock_quantity: number; base_unit?: string | null };
type Supplier = { id: string; name: string; code?: string; phone?: string; email?: string; group_name?: string };
type Status = "draft" | "completed" | "cancelled";
type SaveStatus = "draft" | "completed";
type Mode = "list" | "create";
type RefundType = "cash" | "debt";
type Notice = { kind: "success" | "error"; text: string } | null;
type Modal = "settings" | "help" | null;
type DatePreset = "month" | "custom" | "all";
type ColumnKey = "code" | "time" | "supplierCode" | "supplier" | "subtotal" | "discount" | "payable" | "paid" | "status";

type Voucher = {
  id: string;
  code: string;
  status: Status;
  supplierCode: string;
  supplier: string;
  branch: string;
  handler: string;
  invoice: string;
  note: string;
  totalQty: number;
  itemCount: number;
  subtotal: number;
  discount: number;
  payable: number;
  paid: number;
  creator: string;
  createdAt: string;
  favorite: boolean;
};

type Config = {
  title: string;
  active: "purchase-orders" | "purchase-returns";
  placeholder: string;
  codeLabel: string;
  emptyText: string;
  statuses: Record<Status, string>;
  columns: Array<{ key: ColumnKey; label: string; numeric?: boolean }>;
};

const CONFIGS: Record<"purchase" | "return", Config> = {
  purchase: {
    title: "Nhập hàng",
    active: "purchase-orders",
    placeholder: "Theo mã phiếu nhập",
    codeLabel: "Mã nhập hàng",
    emptyText: "Không có phiếu nhập hàng phù hợp với bộ lọc hiện tại.",
    statuses: { draft: "Phiếu tạm", completed: "Đã nhập hàng", cancelled: "Đã hủy" },
    columns: [
      { key: "code", label: "Mã nhập hàng" },
      { key: "time", label: "Thời gian" },
      { key: "supplierCode", label: "Mã NCC" },
      { key: "supplier", label: "Nhà cung cấp" },
      { key: "payable", label: "Cần trả NCC", numeric: true },
      { key: "status", label: "Trạng thái" },
    ],
  },
  return: {
    title: "Trả hàng nhập",
    active: "purchase-returns",
    placeholder: "Theo mã phiếu trả hàng",
    codeLabel: "Mã trả hàng nhập",
    emptyText: "Không có phiếu trả hàng nhập phù hợp với bộ lọc hiện tại.",
    statuses: { draft: "Phiếu tạm", completed: "Đã trả hàng", cancelled: "Đã hủy" },
    columns: [
      { key: "code", label: "Mã trả hàng nhập" },
      { key: "time", label: "Thời gian" },
      { key: "supplier", label: "Nhà cung cấp" },
      { key: "subtotal", label: "Tổng tiền hàng", numeric: true },
      { key: "discount", label: "Giảm giá", numeric: true },
      { key: "payable", label: "NCC cần trả", numeric: true },
      { key: "paid", label: "NCC đã trả", numeric: true },
      { key: "status", label: "Trạng thái" },
    ],
  },
};

const PAGE_SIZE = 15;
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const formatDate = (value: string) => {
  if (!value) return "---";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "---";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const nowLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
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

function mapVoucher(row: Record<string, unknown>): Voucher {
  const rawStatus = String(row.status);
  const status: Status = rawStatus === "completed" || rawStatus === "cancelled" ? rawStatus : "draft";
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    status,
    supplierCode: String(row.supplierCode ?? row.supplier_code ?? ""),
    supplier: String(row.supplier ?? ""),
    branch: String(row.branch ?? "Chi nhánh trung tâm"),
    handler: String(row.handler ?? ""),
    invoice: String(row.invoice ?? row.invoice_number ?? ""),
    note: String(row.note ?? ""),
    totalQty: Number(row.totalQty ?? row.total_qty ?? 0),
    itemCount: Number(row.itemCount ?? row.item_count ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount ?? 0),
    payable: Number(row.payable ?? 0),
    paid: Number(row.paid ?? 0),
    creator: String(row.creator ?? ""),
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    favorite: false,
  };
}

export default function PurchaseDocumentClient({ mode, profile, products, suppliers }: { mode: "purchase" | "return"; profile: Profile; products: Product[]; suppliers: Supplier[] }) {
  const config = CONFIGS[mode];
  const codePrefix = mode === "purchase" ? "PN" : "THN";

  const [view, setView] = useState<Mode>("list");
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  const [query, setQuery] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [statuses, setStatuses] = useState<Status[]>(["draft", "completed", "cancelled"]);
  const [dateValue, setDateValue] = useState<DateValue>(() => { const now = new Date(); const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; return { preset: "this_month", from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; });
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [handlerFilter, setHandlerFilter] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [page, setPage] = useState(1);

  const [productQuery, setProductQuery] = useState("");
  const [supplierId, setSupplierId] = useState(() => suppliers[0]?.id || "");
  const [createdAt, setCreatedAt] = useState(nowLocal());
  const [code, setCode] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [invoice, setInvoice] = useState("");
  const [createStatus, setCreateStatus] = useState<SaveStatus>("draft");
  const [refundType, setRefundType] = useState<RefundType>("debt");
  const [refundAmount, setRefundAmount] = useState("");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [returnPrices, setReturnPrices] = useState<Record<string, number>>({});
  const importInput = useRef<HTMLInputElement>(null);

  async function loadVouchers() {
    try {
      const response = await fetch(mode === "purchase" ? "/api/purchase-orders" : "/api/purchase-returns");
      if (!response.ok) throw new Error(await apiError(response));
      const data = await response.json() as { vouchers?: Array<Record<string, unknown>>; truncated?: boolean };
      setVouchers((data.vouchers || []).map(mapVoucher));
      setTruncated(data.truncated === true);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể tải danh sách phiếu." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const creators = useMemo(() => Array.from(new Set([profile.full_name, ...vouchers.map((item) => item.creator).filter(Boolean)])), [vouchers, profile.full_name]);
  const handlers = useMemo(() => Array.from(new Set([profile.full_name, ...vouchers.map((item) => item.handler).filter(Boolean)])), [vouchers, profile.full_name]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const codeKeyword = codeFilter.trim().toLowerCase();
    const invoiceKeyword = invoiceQuery.trim().toLowerCase();
    const now = new Date();
    return vouchers.filter((item) => {
      const created = toVnDateKey(item.createdAt);
      const dateOk = dateValue.preset === "all" || ((!dateValue.from || created >= dateValue.from) && (!dateValue.to || created <= dateValue.to));
      return `${item.code} ${item.note} ${item.supplier}`.toLowerCase().includes(keyword)
        && item.code.toLowerCase().includes(codeKeyword)
        && (mode === "return" || item.invoice.toLowerCase().includes(invoiceKeyword))
        && statuses.includes(item.status)
        && (creatorFilter === "all" || item.creator === creatorFilter)
        && (handlerFilter === "all" || item.handler === handlerFilter)
        && dateOk;
    });
  }, [vouchers, query, codeFilter, invoiceQuery, mode, statuses, creatorFilter, handlerFilter, dateValue]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const createProducts = useMemo(() => products.filter((product) => `${product.sku} ${product.name}`.toLowerCase().includes(productQuery.trim().toLowerCase())), [products, productQuery]);
  const selectedCount = useMemo(() => products.filter((product) => Number(quantities[product.id] || 0) > 0).length, [products, quantities]);
  const subtotal = useMemo(() => products.reduce((sum, product) => {
    const qty = Number(quantities[product.id] || 0);
    const price = mode === "purchase" ? Number(prices[product.id] || 0) : Number(returnPrices[product.id] || 0);
    return sum + qty * price;
  }, 0), [products, quantities, prices, returnPrices, mode]);
  const discountTotal = useMemo(() => products.reduce((sum, product) => sum + (Number(quantities[product.id] || 0) > 0 ? Number(discounts[product.id] || 0) : 0), 0), [products, quantities, discounts]);
  const payable = Math.max(0, subtotal - discountTotal);

  function toggleStatus(value: Status) {
    setStatuses((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setPage(1);
  }

  function toggleFavorite(id: string) {
    setVouchers((current) => current.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item));
  }

  function resetCreate() {
    setProductQuery("");
    setSupplierId(suppliers[0]?.id || "");
    setCreatedAt(nowLocal());
    setCode(`${codePrefix}${String(Date.now()).slice(-8)}`);
    setSourceCode("");
    setInvoice("");
    setCreateStatus("draft");
    setRefundType("debt");
    setRefundAmount("");
    setNote("");
    setQuantities({});
    setPrices(Object.fromEntries(products.map((product) => [product.id, Number(product.cost || product.price || 0)])));
    setDiscounts({});
    setReturnPrices(Object.fromEntries(products.map((product) => [product.id, Number(product.cost || product.price || 0)])));
  }

  function openCreate() {
    resetCreate();
    setPage(1);
    setView("create");
  }

  async function saveDocument(nextStatus: SaveStatus) {
    if (busy) return;
    const selected = products.filter((product) => Number(quantities[product.id] || 0) > 0);
    if (!selected.length) {
      setNotice({ kind: "error", text: "Vui lòng nhập số lượng cho ít nhất một hàng hóa." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const endpoint = mode === "purchase" ? "/api/purchase-orders" : "/api/purchase-returns";
      const body = mode === "purchase"
        ? {
            status: nextStatus,
            supplier_id: supplierId || null,
            code: code.trim() || undefined,
            created_at: createdAt ? new Date(createdAt).toISOString() : undefined,
            purchase_order_code: sourceCode.trim() || undefined,
            invoice_number: invoice.trim(),
            note: note.trim(),
            lines: selected.map((product) => ({
              product_id: product.id,
              quantity: Math.trunc(Number(quantities[product.id])),
              cost: Math.max(0, Number(prices[product.id] || 0)),
              discount: Math.max(0, Number(discounts[product.id] || 0)),
            })),
          }
        : {
            status: nextStatus,
            supplier_id: supplierId || null,
            code: code.trim() || undefined,
            purchase_id: sourceCode.trim() || null,
            purchase_code: sourceCode.trim() || null,
            refund_type: refundType,
            refund_amount: Math.max(0, Number(refundAmount) || 0),
            note: note.trim(),
            lines: selected.map((product) => ({
              product_id: product.id,
              quantity: Math.trunc(Number(quantities[product.id])),
              return_price: Math.max(0, Number(returnPrices[product.id] || 0)),
            })),
          };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await apiError(response));
      setView("list");
      setPage(1);
      resetCreate();
      await loadVouchers();
      setNotice({ kind: "success", text: nextStatus === "completed" ? `Đã hoàn thành phiếu ${config.title.toLowerCase()}.` : `Đã lưu phiếu ${config.title.toLowerCase()} tạm.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể lưu phiếu." });
    } finally {
      setBusy(false);
    }
  }

  function exportExcel() {
    const headers = config.columns.map((column) => column.label);
    const data = filtered.map((item) => config.columns.map((column) => {
      if (column.key === "time") return formatDate(item.createdAt);
      if (column.key === "status") return config.statuses[item.status];
      return item[column.key];
    }));
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    const fileName = mode === "purchase" ? "NhapHang" : "TraHangNhap";
    XLSX.utils.book_append_sheet(workbook, sheet, fileName);
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`);
    setNotice({ kind: "success", text: `Đã xuất ${filtered.length} phiếu ra file Excel.` });
  }

  function downloadTemplate() {
    const example = products[0];
    const headers = mode === "purchase" ? ["Mã hàng", "Tên hàng", "ĐVT", "Số lượng", "Đơn giá"] : ["Mã hàng", "Tên hàng", "ĐVT", "Số lượng"];
    const sample = mode === "purchase"
      ? [example?.sku || "NSTP00030", example?.name || "Tên hàng ví dụ", example?.base_unit || "Cái", 1, Number(example?.cost || 0)]
      : [example?.sku || "NSTP00030", example?.name || "Tên hàng ví dụ", example?.base_unit || "Cái", 1];
    const sheet = XLSX.utils.aoa_to_sheet([headers, sample]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, mode === "purchase" ? "MauNhapHang" : "MauTraHang");
    XLSX.writeFile(workbook, mode === "purchase" ? "MauNhapHang.xlsx" : "MauTraHang.xlsx");
  }

  async function importExcel(file: File) {
    setBusy(true);
    try {
      const workbook = /\.csv$/i.test(file.name) ? XLSX.read(await file.text(), { type: "string" }) : XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }).slice(1);
      const bySku = new Map(products.map((product) => [product.sku.trim().toLowerCase(), product]));
      const nextQty = { ...quantities };
      const nextPrices = { ...prices };
      const nextReturn = { ...returnPrices };
      let updated = 0;
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        const sku = String(row[0] ?? "").trim().toLowerCase();
        const product = bySku.get(sku);
        const qty = Number(row[3] ?? row[row.length - 1]);
        if (product && Number.isFinite(qty) && qty > 0) {
          nextQty[product.id] = Math.trunc(qty);
          if (mode === "purchase") {
            const price = Number(row[4]);
            if (Number.isFinite(price) && price >= 0) nextPrices[product.id] = price;
          }
          updated += 1;
        }
      }
      if (!updated) throw new Error("Không tìm thấy mã hàng và số lượng hợp lệ trong file.");
      setQuantities(nextQty);
      setPrices(nextPrices);
      setReturnPrices(nextReturn);
      setNotice({ kind: "success", text: `Đã nhập số lượng cho ${updated} hàng hóa từ file Excel.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể nhập file Excel." });
    } finally {
      setBusy(false);
      if (importInput.current) importInput.current.value = "";
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) importExcel(file);
  }

  function setQty(productId: string, raw: string) {
    setQuantities((current) => ({ ...current, [productId]: Math.max(0, Math.trunc(Number(raw) || 0)) }));
  }

  function renderCell(item: Voucher, key: ColumnKey, numeric?: boolean) {
    if (key === "code") return <b className="purchase-link">{item.code}</b>;
    if (key === "time") return formatDate(item.createdAt);
    if (key === "status") return <span className={`stock-status ${item.status === "completed" ? "balanced" : item.status}`}>{config.statuses[item.status]}</span>;
    if (numeric) return money(Number(item[key]));
    return item[key];
  }

  return <div className="kv-shell product-page purchasing-page purchase-document-page">
    <ManagementHeader profile={profile} active={config.active} />
    {notice && <div className={`product-notice purchase-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)}><X size={15} /></button></div>}
    {view === "list" && truncated && <div style={{background:"#fff4e8", border:"1px solid #ffe2b8", color:"#7a4a00", padding:"8px 12px", borderRadius:"6px", fontSize:"12px", marginBottom:"12px"}}>⚠️ Dữ liệu đã đạt giới hạn 500 phiếu gần nhất. Kết quả có thể bị cắt cụt – vui lòng thu hẹp khoảng thời gian.</div>}

    {view === "list" ? (
      <>
        <div className="product-actions purchase-actions">
          <h1>{config.title}</h1>
          <div className="purchase-search"><label className="product-query"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={config.placeholder} /></label></div>
          <div className="product-toolbar purchase-toolbar">
            <button type="button" className="purchase-tool primary" title={`Tạo phiếu ${config.title.toLowerCase()}`} aria-label={`Tạo phiếu ${config.title.toLowerCase()}`} onClick={openCreate}><Plus /></button>
            <button type="button" className="purchase-tool" title="Xuất file Excel" aria-label="Xuất file Excel" onClick={exportExcel}><ExportFileIcon /></button>
            <button type="button" className="purchase-tool" title="Thiết lập" aria-label="Thiết lập" onClick={() => setModal("settings")}><Settings /></button>
            <button type="button" className="purchase-tool" title="Hướng dẫn sử dụng" aria-label="Hướng dẫn sử dụng" onClick={() => setModal("help")}><HelpCircle /></button>
          </div>
        </div>
        <main className={`product-workspace purchase-workspace ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
          {sidebarCollapsed ? (
            <button type="button" className="sidebar-collapse collapsed" aria-label="Mở bộ lọc" onClick={() => setSidebarCollapsed(false)}><ChevronRight /></button>
          ) : (
            <aside className="product-filter-sidebar purchase-sidebar">
              <section>
                <h2>Trạng thái</h2>
                {(["draft", "completed", "cancelled"] as Status[]).map((value) => (
                  <label className="stock-check" key={value}><input type="checkbox" checked={statuses.includes(value)} onChange={() => toggleStatus(value)} /><span>{config.statuses[value]}</span></label>
                ))}
              </section>
              <section>
                <h2>Thời gian</h2>
                <DateRangePicker value={dateValue} onChange={(value) => { setDateValue(value); setPage(1); }} />
              </section>
              <section>
                <h2>Người tạo</h2>
                <select aria-label="Người tạo" value={creatorFilter} onChange={(event) => { setCreatorFilter(event.target.value); setPage(1); }}><option value="all">Chọn người tạo</option>{creators.map((name) => <option key={name} value={name}>{name}</option>)}</select>
              </section>
              {mode === "purchase" && (
                <section>
                  <h2>Số hóa đơn đầu vào</h2>
                  <input className="purchase-invoice-filter" aria-label="Số hóa đơn đầu vào" value={invoiceQuery} onChange={(event) => { setInvoiceQuery(event.target.value); setPage(1); }} placeholder="Theo số hóa đơn đầu vào" />
                </section>
              )}
              <section>
                <h2>{mode === "purchase" ? "Người nhập" : "Người trả"}</h2>
                <select aria-label="Người nhập" value={handlerFilter} onChange={(event) => { setHandlerFilter(event.target.value); setPage(1); }}><option value="all">Chọn người {mode === "purchase" ? "nhập" : "trả"}</option>{handlers.map((name) => <option key={name} value={name}>{name}</option>)}</select>
              </section>
              <button type="button" className="sidebar-collapse" aria-label="Thu gọn bộ lọc" onClick={() => setSidebarCollapsed(true)}><ChevronLeft /></button>
            </aside>
          )}
          <section className="product-content purchase-content">
            <div className="product-table purchase-table">
              <table>
                <thead>
                  <tr>
                    <th className="row-select"><input aria-label="Chọn tất cả" type="checkbox" /></th>
                    <th className="row-star"><Star size={15} /></th>
                    {config.columns.map((column) => <th key={column.key} className={column.numeric ? "number-cell" : ""}>{column.label}</th>)}
                  </tr>
                  <tr className="stock-filter-row purchase-filter-row">
                    <th className="row-select" />
                    <th className="row-star" />
                    {config.columns.map((column) => (
                      <th key={column.key} className={column.numeric ? "number-cell" : ""}>
                        {column.key === "code" && <label className="stock-filter-input"><Search size={13} /><input aria-label={`Lọc ${config.codeLabel}`} value={codeFilter} onChange={(event) => { setCodeFilter(event.target.value); setPage(1); }} placeholder={config.codeLabel} /></label>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && !vouchers.length ? (
                    <tr><td colSpan={config.columns.length + 2}><div className="product-empty purchase-empty"><p className="stock-loading">Đang tải phiếu {config.title.toLowerCase()}...</p></div></td></tr>
                  ) : rows.map((item) => (
                    <tr className="product-row" key={item.id}>
                      <td className="row-select"><input aria-label={`Chọn ${item.code}`} type="checkbox" /></td>
                      <td className="row-star"><button type="button" aria-label="Đánh dấu" onClick={() => toggleFavorite(item.id)}><Star size={17} fill={item.favorite ? "#f5a623" : "none"} color={item.favorite ? "#f5a623" : "currentColor"} /></button></td>
                      {config.columns.map((column) => <td key={column.key} className={column.numeric ? "number-cell" : ""}>{renderCell(item, column.key, column.numeric)}</td>)}
                    </tr>
                  ))}
                  {!loading && !rows.length && (
                    <tr><td colSpan={config.columns.length + 2}><div className="product-empty purchase-empty"><Search size={42} /><strong>Không tìm thấy kết quả</strong><p>{config.emptyText}</p><button type="button" className="primary" onClick={openCreate}>+ {config.title}</button></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="product-pager"><span>Hiển thị {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} phiếu</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button><button type="button" className="current">{safePage}</button><button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button></div></footer>
          </section>
        </main>
      </>
    ) : (
      <>
        <div className="product-actions purchase-actions purchase-create-actions">
          <button type="button" className="stock-back" onClick={() => setView("list")}><ChevronLeft size={18} /><span>Quay lại</span></button>
          <h1>{config.title}</h1>
        </div>
        <main className="purchase-create">
          <section className="purchase-create-main">
            <div className="stock-create-toolbar purchase-create-toolbar">
              <label className="product-query stock-create-search purchase-create-search"><Search size={18} /><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Theo mã, tên hàng" /></label>
              <div className="stock-import">
                <button type="button" className="stock-import-btn" disabled={busy} onClick={() => importInput.current?.click()}><ImportFileIcon />Thêm sản phẩm từ file excel</button>
                <span className="stock-import-hint">(Tải về file mẫu: <button type="button" className="stock-link" onClick={downloadTemplate}>Excel file</button>)</span>
                <input ref={importInput} type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} />
              </div>
            </div>
            <div className="product-table stock-create-table purchase-create-table">
              <table>
                <thead><tr>
                  <th className="stock-stt">STT</th>
                  <th>Mã hàng</th>
                  <th>Tên hàng</th>
                  <th>ĐVT</th>
                  <th className="number-cell">Số lượng</th>
                  <th className="number-cell">{mode === "purchase" ? "Đơn giá" : "Giá nhập"}</th>
                  <th className="number-cell">{mode === "purchase" ? "Giảm giá" : "Giá trả lại"}</th>
                  <th className="number-cell">Thành tiền</th>
                </tr></thead>
                <tbody>
                  {createProducts.map((product, index) => {
                    const qty = Number(quantities[product.id] || 0);
                    const price = Number(prices[product.id] || 0);
                    const discount = Number(discounts[product.id] || 0);
                    const returnPrice = Number(returnPrices[product.id] || 0);
                    const lineValue = mode === "purchase" ? qty * price - discount : qty * returnPrice;
                    return (
                      <tr className="product-row" key={product.id}>
                        <td className="stock-stt">{index + 1}</td>
                        <td><b className="stock-product-name">{product.sku}</b></td>
                        <td>{product.name}</td>
                        <td>{product.base_unit || "Cái"}</td>
                        <td className="number-cell"><input className="purchase-edit" aria-label={`Số lượng ${product.name}`} type="number" min="0" value={qty} onChange={(event) => setQty(product.id, event.target.value)} /></td>
                        {mode === "purchase" ? (
                          <>
                            <td className="number-cell"><input className="purchase-edit" aria-label={`Đơn giá ${product.name}`} type="number" min="0" value={price} onChange={(event) => setPrices((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value) || 0) }))} /></td>
                            <td className="number-cell"><input className="purchase-edit" aria-label={`Giảm giá ${product.name}`} type="number" min="0" value={discount} onChange={(event) => setDiscounts((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value) || 0) }))} /></td>
                          </>
                        ) : (
                          <>
                            <td className="number-cell">{money(Number(product.cost || product.price || 0))}</td>
                            <td className="number-cell"><input className="purchase-edit" aria-label={`Giá trả lại ${product.name}`} type="number" min="0" value={returnPrice} onChange={(event) => setReturnPrices((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value) || 0) }))} /></td>
                          </>
                        )}
                        <td className="number-cell"><b className="purchase-line-value">{money(Math.max(0, lineValue))}</b></td>
                      </tr>
                    );
                  })}
                  {!createProducts.length && <tr><td colSpan={8}><div className="product-empty purchase-create-empty"><Search size={40} /><strong>Không có hàng hóa</strong><p>Thử đổi từ khóa tìm kiếm hoặc bộ lọc.</p></div></td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="purchase-create-panel">
            <div className="stock-side-block">
              <label className="stock-field"><span>Nhà cung cấp</span><select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Chọn nhà cung cấp</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
              {mode === "purchase" && <label className="stock-field"><span>Thời gian</span><input type="datetime-local" value={createdAt} onChange={(event) => setCreatedAt(event.target.value)} /></label>}
              <label className="stock-field"><span>{mode === "purchase" ? "Mã phiếu nhập" : "Mã trả hàng nhập"}</span><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Mã phiếu tự động" /></label>
              <label className="stock-field"><span>{mode === "purchase" ? "Mã đặt hàng nhập" : "Mã phiếu nhập"}</span><input value={sourceCode} onChange={(event) => setSourceCode(event.target.value)} placeholder={mode === "purchase" ? "Nhập mã đặt hàng nhập" : "Nhập mã phiếu nhập" } /></label>
              <label className="stock-field"><span>Trạng thái</span><select value={createStatus} onChange={(event) => setCreateStatus(event.target.value as SaveStatus)}><option value="draft">Phiếu tạm</option><option value="completed">Hoàn thành</option></select></label>
              {mode === "purchase" && <label className="stock-field"><span>Số hóa đơn đầu vào</span><input value={invoice} onChange={(event) => setInvoice(event.target.value)} placeholder="Nhập số hóa đơn đầu vào..." /></label>}
            </div>
            <div className="stock-side-block">
              <div className="purchase-total-row"><span>Tổng tiền hàng</span><b>{money(subtotal)}</b></div>
              <div className="purchase-total-row"><span>Giảm giá</span><b>{money(discountTotal)}</b></div>
              <div className="purchase-total-row purchase-payable-row"><span>{mode === "purchase" ? "Cần trả nhà cung cấp" : "Nhà cung cấp cần trả"}</span><b>{money(payable)}</b></div>
            </div>
            {mode === "return" && (
              <div className="stock-side-block purchase-refund-block">
                <span className="stock-side-label">Tiền nhà cung cấp trả (F8)</span>
                <label className="stock-radio"><input type="radio" name="purchase-refund" checked={refundType === "cash"} onChange={() => setRefundType("cash")} /><span>Tiền mặt</span></label>
                <label className="stock-radio"><input type="radio" name="purchase-refund" checked={refundType === "debt"} onChange={() => setRefundType("debt")} /><span>Tính vào công nợ</span></label>
                <input className="purchase-refund-amount" type="number" min="0" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder="Nhập số tiền" />
              </div>
            )}
            <div className="stock-side-block">
              <label className="stock-field"><span>Ghi chú</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhập ghi chú phiếu" rows={4} /></label>
            </div>
            <div className="stock-side-footer">
              <button type="button" disabled={busy || selectedCount === 0} onClick={() => saveDocument("draft")}>Lưu tạm</button>
              <button type="button" className="primary" disabled={busy || selectedCount === 0} onClick={() => saveDocument("completed")}>{busy ? "Đang lưu..." : <><Check size={16} />Hoàn thành</>}</button>
            </div>
          </aside>
        </main>
      </>
    )}
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>

    {modal === "settings" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal purchase-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Thiết lập {config.title.toLowerCase()}</h2><p>Cấu hình phiếu {config.title.toLowerCase()}</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="purchase-modal-body purchase-settings"><p className="purchase-settings-note">Số phiếu mỗi trang mặc định là 15. Mã phiếu được sinh tự động theo tiền tố {codePrefix} và khi hoàn thành, hệ thống sẽ {mode === "purchase" ? "tăng tồn kho theo số lượng nhập." : "trừ tồn kho theo số lượng trả."}</p></div><footer><span /><button type="button" onClick={() => setModal(null)}>Đóng</button></footer></section></div>}

    {modal === "help" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal purchase-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><h2>Hướng dẫn {config.title.toLowerCase()}</h2><p>{mode === "purchase" ? "Lập phiếu nhập hàng từ nhà cung cấp" : "Lập phiếu trả hàng cho nhà cung cấp"}</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header><div className="purchase-modal-body purchase-help"><h3>Tạo phiếu mới</h3><p>Bấm nút <b>＋ {config.title}</b> trên thanh công cụ, chọn hàng hóa, nhập số lượng và đơn giá rồi bấm <b>Lưu tạm</b> hoặc <b>Hoàn thành</b>.</p><h3>Thêm sản phẩm từ file excel</h3><p>Tải file mẫu <b>Excel file</b>, điền mã hàng và số lượng theo cột <b>Số lượng</b>, sau đó chọn file để hệ thống tự điền.</p><h3>Trạng thái phiếu</h3><p>Phiếu <b>Phiếu tạm</b> chưa cập nhật tồn kho. Khi bấm <b>Hoàn thành</b>, hệ thống sẽ {mode === "purchase" ? "tăng tồn kho theo số lượng nhập." : "trừ tồn kho theo số lượng trả."}</p></div><footer><button type="button" className="primary" onClick={() => setModal(null)}>Đã hiểu</button></footer></section></div>}
  </div>;
}
