"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Columns3, Download, HelpCircle, Search, Settings, SlidersHorizontal, Star } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";

type Product = { id: string; name: string; sku: string; price: number; cost?: number; stock_quantity: number };
type Status = "draft" | "balanced" | "cancelled";
type StockTake = { id: string; code: string; createdAt: string; creator: string; balancer: string; totalActual: number; totalAdjustment: number; adjustmentValue: number; increaseQty: number; increaseValue: number; decreaseQty: number; decreaseValue: number; adjustmentDate: string; actualCount: number; note: string; status: Status; favorite: boolean };
type ColumnKey = "code" | "time" | "creator" | "balancer" | "totalActual" | "totalAdjustment" | "adjustmentValue" | "increaseQty" | "increaseValue" | "decreaseQty" | "decreaseValue" | "adjustmentDate" | "actualCount" | "note" | "status";

const PAGE_SIZE = 15;
const columns: Array<{ key: ColumnKey; label: string }> = [
  { key: "code", label: "Mã kiểm kho" }, { key: "time", label: "Thời gian" }, { key: "creator", label: "Người tạo" }, { key: "balancer", label: "Người cân bằng" },
  { key: "totalActual", label: "Tổng thực tế" }, { key: "totalAdjustment", label: "Tổng chênh lệch" }, { key: "adjustmentValue", label: "Tổng giá trị lệch" },
  { key: "increaseQty", label: "SL lệch tăng" }, { key: "increaseValue", label: "Tổng giá trị tăng" }, { key: "decreaseQty", label: "SL lệch giảm" },
  { key: "decreaseValue", label: "Tổng giá trị giảm" }, { key: "adjustmentDate", label: "Ngày cân bằng" }, { key: "actualCount", label: "SL thực tế" },
  { key: "note", label: "Ghi chú" }, { key: "status", label: "Trạng thái" },
];
const statusLabel: Record<Status, string> = { draft: "Phiếu tạm", balanced: "Đã cân bằng kho", cancelled: "Đã hủy" };
const number = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const dateTime = (value: string) => value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "---";

export default function StockTakesClient({ profile, initialProducts }: { profile: Profile; initialProducts: Product[] }) {
  const [items, setItems] = useState<StockTake[]>([]);
  const [query, setQuery] = useState("");
  const [datePreset, setDatePreset] = useState("month");
  const [statuses, setStatuses] = useState<Status[]>(["draft", "balanced", "cancelled"]);
  const [creator, setCreator] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [productQuery, setProductQuery] = useState("");
  const [note, setNote] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(initialProducts.map((product) => [product.id, Number(product.stock_quantity)])));
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({ code: true, time: true, creator: false, balancer: false, totalActual: true, totalAdjustment: true, adjustmentValue: false, increaseQty: true, increaseValue: false, decreaseQty: true, decreaseValue: false, adjustmentDate: true, actualCount: true, note: true, status: true });

  const filtered = useMemo(() => items.filter((item) => {
    const keyword = `${item.code} ${item.note}`.toLowerCase().includes(query.trim().toLowerCase());
    const status = statuses.includes(item.status);
    const byCreator = creator === "all" || item.creator === creator;
    const created = new Date(item.createdAt); const now = new Date();
    const date = datePreset === "all" || (datePreset === "today" ? created.toDateString() === now.toDateString() : created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear());
    return keyword && status && byCreator && date;
  }), [items, query, statuses, creator, datePreset]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); const safePage = Math.min(page, totalPages); const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const modalProducts = initialProducts.filter((product) => `${product.sku} ${product.name}`.toLowerCase().includes(productQuery.toLowerCase())).slice(0, 40);

  function toggleStatus(status: Status) { setStatuses((current) => current.includes(status) ? current.filter((value) => value !== status) : [...current, status]); setPage(1); }
  function createStockTake(status: Exclude<Status, "cancelled">) {
    const now = new Date(); let totalActual = 0; let totalAdjustment = 0; let adjustmentValue = 0; let increaseQty = 0; let increaseValue = 0; let decreaseQty = 0; let decreaseValue = 0;
    initialProducts.forEach((product) => { const actual = Number(counts[product.id] ?? product.stock_quantity); const diff = actual - Number(product.stock_quantity); const cost = Number(product.cost || 0); totalActual += actual; totalAdjustment += diff; adjustmentValue += diff * cost; if (diff > 0) { increaseQty += diff; increaseValue += diff * cost; } else { decreaseQty += Math.abs(diff); decreaseValue += Math.abs(diff * cost); } });
    const item: StockTake = { id: crypto.randomUUID(), code: `KK${String(Date.now()).slice(-8)}`, createdAt: now.toISOString(), creator: profile.full_name, balancer: status === "balanced" ? profile.full_name : "", totalActual, totalAdjustment, adjustmentValue, increaseQty, increaseValue, decreaseQty, decreaseValue, adjustmentDate: status === "balanced" ? now.toISOString() : "", actualCount: totalActual, note: note.trim(), status, favorite: false };
    setItems((current) => [item, ...current]); setShowCreate(false); setNote(""); setProductQuery(""); setNotice(status === "draft" ? "Đã lưu phiếu kiểm kho tạm trong phiên làm việc." : "Đã tạo phiếu cân bằng trong phiên làm việc; tồn kho chưa được cập nhật vào cơ sở dữ liệu.");
  }
  function exportCsv() {
    const header = columns.map((column) => column.label); const lines = [header, ...filtered.map((item) => [item.code, dateTime(item.createdAt), item.creator, item.balancer, item.totalActual, item.totalAdjustment, item.adjustmentValue, item.increaseQty, item.increaseValue, item.decreaseQty, item.decreaseValue, dateTime(item.adjustmentDate), item.actualCount, item.note, statusLabel[item.status]])];
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "phieu-kiem-kho.csv"; link.click(); URL.revokeObjectURL(url); setNotice(`Đã xuất ${filtered.length} phiếu kiểm kho.`);
  }

  const cell = (item: StockTake, key: ColumnKey) => {
    if (key === "code") return <b className="stocktake-code">{item.code}</b>;
    if (key === "time") return dateTime(item.createdAt); if (key === "creator") return item.creator; if (key === "balancer") return item.balancer || "---";
    if (key === "adjustmentDate") return dateTime(item.adjustmentDate); if (key === "note") return item.note || "---"; if (key === "status") return <span className={`stock-status ${item.status}`}>{statusLabel[item.status]}</span>;
    return number(item[key]);
  };

  return <div className="kv-shell product-page stocktakes-page">
    <ManagementHeader profile={profile} active="stocktakes" />
    <div className="product-actions stocktake-actions"><h1>Phiếu kiểm kho</h1><div className="product-toolbar"><label className="product-query"><Search size={20} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Theo mã phiếu kiểm" /><SlidersHorizontal size={17} /></label><button className="primary" onClick={() => setShowCreate(true)}>＋ Kiểm kho</button><button onClick={exportCsv}><Download size={18} />Xuất file</button><div className="column-control"><button aria-label="Chọn cột" aria-expanded={showColumns} onClick={() => setShowColumns((value) => !value)}><Columns3 size={19} /></button>{showColumns && <div className="columns-popover stock-columns">{columns.map((column) => <label key={column.key}><input type="checkbox" checked={visible[column.key]} onChange={() => setVisible((current) => ({ ...current, [column.key]: !current[column.key] }))} />{column.label}</label>)}</div>}</div><button aria-label="Thiết lập"><Settings size={19} /></button><button aria-label="Hướng dẫn"><HelpCircle size={19} /></button></div></div>
    <main className={`product-workspace ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      {sidebarCollapsed ? <button className="sidebar-collapse collapsed" aria-label="Mở bộ lọc" onClick={() => setSidebarCollapsed(false)}><ChevronRight /></button> : <aside className="product-filter-sidebar stocktake-sidebar"><section><h2>Ngày tạo</h2><label className="stock-radio"><input type="radio" name="date" checked={datePreset === "month"} onChange={() => setDatePreset("month")} /><span>Tháng này</span><ChevronRight size={17} /></label><label className="stock-radio"><input type="radio" name="date" checked={datePreset === "today"} onChange={() => setDatePreset("today")} /><span>Hôm nay</span><CalendarDays size={17} /></label><label className="stock-radio"><input type="radio" name="date" checked={datePreset === "all"} onChange={() => setDatePreset("all")} /><span>Toàn thời gian</span></label></section><section><h2>Trạng thái</h2>{(["draft", "balanced", "cancelled"] as Status[]).map((status) => <label className="stock-check" key={status}><input type="checkbox" checked={statuses.includes(status)} onChange={() => toggleStatus(status)} /><span>{statusLabel[status]}</span></label>)}</section><section><h2>Người tạo</h2><select aria-label="Người tạo" value={creator} onChange={(event) => setCreator(event.target.value)}><option value="all">Chọn người tạo</option><option value={profile.full_name}>{profile.full_name}</option></select></section><button className="sidebar-collapse" aria-label="Thu gọn bộ lọc" onClick={() => setSidebarCollapsed(true)}><ChevronLeft /></button></aside>}
      <section className="product-content stocktake-content">{notice && <div className="product-notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}<div className="product-table stocktake-table"><table><thead><tr><th className="stock-select"><input aria-label="Chọn tất cả" type="checkbox" /></th><th className="stock-star"><Star size={16} /></th>{columns.filter((column) => visible[column.key]).map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((item) => <tr className="product-row" key={item.id}><td className="stock-select"><input aria-label={`Chọn ${item.code}`} type="checkbox" /></td><td className="stock-star"><button aria-label="Đánh dấu" onClick={() => setItems((current) => current.map((row) => row.id === item.id ? { ...row, favorite: !row.favorite } : row))}><Star size={17} fill={item.favorite ? "#f5a623" : "none"} color={item.favorite ? "#f5a623" : "currentColor"} /></button></td>{columns.filter((column) => visible[column.key]).map((column) => <td className={column.key.includes("Value") || ["totalActual", "totalAdjustment", "increaseQty", "decreaseQty", "actualCount"].includes(column.key) ? "number-cell" : ""} key={column.key}>{cell(item, column.key)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={columns.filter((column) => visible[column.key]).length + 2}><div className="product-empty stocktake-empty"><Columns3 size={46} /><strong>Không tìm thấy kết quả</strong><p>Không có phiếu kiểm kho phù hợp với bộ lọc hiện tại.</p><button className="primary" onClick={() => setShowCreate(true)}>Kiểm kho</button></div></td></tr>}</tbody></table></div><footer className="product-pager"><span>Hiển thị {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} phiếu</span><div><button disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((value) => <button className={safePage === value ? "current" : ""} key={value} onClick={() => setPage(value)}>{value}</button>)}<button disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button></div></footer></section>
    </main>
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>
    {showCreate && <div className="modal-backdrop"><section className="product-modal stocktake-modal"><header><div><h2>Phiếu kiểm kho</h2><p>Nhập số lượng thực tế để tính chênh lệch tồn kho</p></div><button onClick={() => setShowCreate(false)}>×</button></header><div className="stocktake-form-head"><label className="product-query"><Search size={18} /><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Theo mã, tên hàng" /></label><label>Ghi chú<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhập ghi chú phiếu kiểm" /></label></div><div className="stocktake-lines"><table><thead><tr><th>Mã hàng</th><th>Tên hàng</th><th>Tồn kho</th><th>Thực tế</th><th>Chênh lệch</th></tr></thead><tbody>{modalProducts.map((product) => { const actual = Number(counts[product.id] ?? product.stock_quantity); const diff = actual - Number(product.stock_quantity); return <tr key={product.id}><td>{product.sku}</td><td>{product.name}</td><td>{product.stock_quantity}</td><td><input aria-label={`Thực tế ${product.name}`} type="number" min="0" value={actual} onChange={(event) => setCounts((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value)) }))} /></td><td className={diff === 0 ? "" : diff > 0 ? "positive" : "negative"}>{diff > 0 ? `+${diff}` : diff}</td></tr>})}{!modalProducts.length && <tr><td colSpan={5}>Không có hàng hóa</td></tr>}</tbody></table></div><footer><span>{initialProducts.length} hàng hóa</span><button onClick={() => setShowCreate(false)}>Hủy</button><button onClick={() => createStockTake("draft")}>Lưu tạm</button><button className="primary" onClick={() => createStockTake("balanced")}><Check size={17} />Cân bằng kho</button></footer></section></div>}
  </div>;
}
