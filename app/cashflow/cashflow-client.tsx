"use client";

import { FormEvent, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Columns3, Download, HelpCircle, Minus, Plus, Search, Settings, SlidersHorizontal, WalletCards, X } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";

export type CashAccount = { id: string; name: string; account_type: "cash" | "bank" | "ewallet"; opening_balance: number; bank_name: string | null; bank_account: string | null; active: boolean };
export type CashVoucher = {
  id: string; voucher_number: number; account_id: string; type: "receipt" | "expense"; kind: string; amount: number;
  partner_kind: "customer" | "supplier" | null; partner_id: string | null; partner_name: string | null; note: string | null;
  affects_profit: boolean; status: "completed" | "cancelled"; occurred_at: string; created_at: string; cancelled_at: string | null; created_by: string;
  creator: { full_name: string } | null; cash_accounts: { id: string; name: string; account_type: string; bank_name: string | null; bank_account: string | null } | null;
};
export type CashMeta = { creators: Array<{ id: string; full_name: string }>; customers: Array<{ id: string; name: string }>; suppliers: Array<{ id: string; name: string }> };
export type CashSummary = { opening: number; total_receipt: number; total_expense: number };

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "---";
const voucherCode = (type: "receipt" | "expense", number: number) => `${type === "receipt" ? "PT" : "PC"}${String(number).padStart(6, "0")}`;
const fundLabel: Record<string, string> = { cash: "Tiền mặt", bank: "Ngân hàng", ewallet: "Ví điện tử", all: "Tổng quỹ" };
const kindLabels: Record<string, string> = { sale_payment: "Thu bán hàng", debt_collection: "Thu công nợ", other_income: "Thu khác", transfer_in: "Thu chuyển khoản", purchase_payment: "Chi mua hàng", debt_payment: "Trả công nợ", other_expense: "Chi khác", transfer_out: "Chi chuyển khoản" };
const receiptKinds = [["sale_payment", "Thu bán hàng"], ["debt_collection", "Thu công nợ"], ["other_income", "Thu khác"], ["transfer_in", "Thu chuyển khoản"]] as const;
const expenseKinds = [["purchase_payment", "Chi mua hàng"], ["debt_payment", "Trả công nợ"], ["other_expense", "Chi khác"], ["transfer_out", "Chi chuyển khoản"]] as const;

type ColumnKey = "code" | "time" | "kind" | "partner" | "amount" | "accountName" | "accountNumber" | "note" | "creator" | "status";
const columns: Array<[ColumnKey, string]> = [["code", "Mã phiếu"], ["time", "Thời gian"], ["kind", "Loại thu chi"], ["partner", "Người nộp/nhận"], ["amount", "Giá trị"], ["accountName", "Tên tài khoản"], ["accountNumber", "Số tài khoản"], ["note", "Ghi chú"], ["creator", "Người tạo"], ["status", "Trạng thái"]];
const defaultVisible = new Set<ColumnKey>(["code", "time", "kind", "partner", "amount"]);

type FundTab = "all" | "cash" | "bank" | "ewallet";
type FilterState = { type: "all" | "receipt" | "expense"; kind: string; status: string[]; profit: "all" | "yes" | "no"; creatorId: string; partnerKind: "all" | "customer" | "supplier"; partnerQuery: string };
const initialFilters: FilterState = { type: "all", kind: "", status: ["completed", "cancelled"], profit: "all", creatorId: "", partnerKind: "all", partnerQuery: "" };
const emptyForm = { account_id: "", kind: "", partner_kind: "" as "" | "customer" | "supplier", partner_id: "", partner_name: "", amount: "", occurred_at: "", note: "", affects_profit: true };

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  return { from, to };
}

export default function CashFlowClient({ profile, initialAccounts, initialVouchers, initialCount, initialSummary, initialMeta, dataWarning = "" }: { profile: Profile; initialAccounts: CashAccount[]; initialVouchers: CashVoucher[]; initialCount: number; initialSummary: CashSummary; initialMeta: CashMeta; dataWarning?: string }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [count, setCount] = useState(initialCount);
  const [summary, setSummary] = useState(initialSummary);
  const [meta, setMeta] = useState(initialMeta);
  const [fund, setFund] = useState<FundTab>("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [datePreset, setDatePreset] = useState<"all" | "month" | "custom">("month");
  const [dateRange, setDateRange] = useState(monthRange());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(columns.map(([key]) => [key, defaultVisible.has(key)])));
  const [showColumns, setShowColumns] = useState(false);
  const [showCreate, setShowCreate] = useState<"receipt" | "expense" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState(dataWarning);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const firstRequest = useRef(true);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(page, totalPages);
  const displayedColumns = columns.filter(([key]) => visible[key]);

  const fundAccounts = useMemo(() => fund === "all" ? accounts : accounts.filter((account) => account.account_type === fund), [accounts, fund]);

  function paramsFor(targetPage = page, exportAll = false) {
    const params = new URLSearchParams({ fund, page: String(targetPage), pageSize: exportAll ? "5000" : String(pageSize), q: query, status: filters.status.join(",") });
    if (filters.type !== "all") params.set("type", filters.type);
    if (filters.kind) params.set("kind", filters.kind);
    if (filters.creatorId) params.set("creatorId", filters.creatorId);
    if (filters.partnerKind !== "all") params.set("partnerKind", filters.partnerKind);
    if (filters.partnerQuery) params.set("partnerQuery", filters.partnerQuery);
    if (filters.profit === "yes") params.set("profit", "1");
    if (filters.profit === "no") params.set("profit", "0");
    if (datePreset !== "all") { params.set("dateFrom", dateRange.from); params.set("dateTo", dateRange.to); }
    return params;
  }

  useEffect(() => {
    if (firstRequest.current) { firstRequest.current = false; return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/cashbook?${paramsFor().toString()}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) { setError(result.error || "Không thể tải sổ quỹ."); return; }
        startTransition(() => { setVouchers(result.vouchers); setCount(result.count); setSummary(result.summary); setAccounts(result.accounts); setMeta({ creators: result.creators, customers: result.customers, suppliers: result.suppliers }); });
      } catch (requestError) {
        if ((requestError as Error).name !== "AbortError") setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 280 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filters, page, pageSize, query, fund, datePreset, dateRange]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowColumns(false); setShowCreate(null); setShowSettings(false); setShowHelp(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  const changeFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const toggleStatus = (value: string) => setFilters((current) => ({ ...current, status: current.status.includes(value) ? current.status.filter((item) => item !== value) : [...current.status, value] }));

  function openCreate(type: "receipt" | "expense") {
    const target = fundAccounts[0];
    setForm({ ...emptyForm, account_id: target?.id || "", kind: type === "receipt" ? "sale_payment" : "purchase_payment", occurred_at: new Date().toISOString().slice(0, 16) });
    setShowCreate(type); setError("");
  }

  async function saveVoucher(event: FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!showCreate || !form.account_id || !form.kind) { setError("Vui lòng chọn tài khoản quỹ và loại thu chi."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setError("Số tiền giao dịch không hợp lệ."); return; }
    setSaving(true); setError("");
    try {
      const occurredAt = form.occurred_at ? new Date(form.occurred_at).toISOString() : new Date().toISOString();
      const response = await fetch("/api/cashbook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account_id: form.account_id, type: showCreate, kind: form.kind, amount, partner_kind: form.partner_kind || null, partner_id: form.partner_id || null, partner_name: form.partner_name, note: form.note, occurred_at: occurredAt, affects_profit: form.affects_profit }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể lưu phiếu."); return; }
      setShowCreate(null); setNotice(`Đã tạo ${showCreate === "receipt" ? "phiếu thu" : "phiếu chi"}.`); setPage(1);
      const params = paramsFor(1);
      const refresh = await fetch(`/api/cashbook?${params.toString()}`);
      const refreshed = await refresh.json();
      if (refresh.ok) { setVouchers(refreshed.vouchers); setCount(refreshed.count); setSummary(refreshed.summary); }
    } catch { setError("Không thể kết nối máy chủ. Vui lòng thử lại."); }
    finally { setSaving(false); }
  }

  async function cancelVoucher(id: string) {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/cashbook", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể hủy phiếu."); return; }
      setVouchers((current) => current.map((voucher) => voucher.id === id ? result.voucher : voucher));
      setNotice("Đã hủy phiếu.");
    } catch { setError("Không thể kết nối máy chủ. Vui lòng thử lại."); }
    finally { setSaving(false); }
  }

  async function exportCsv() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/cashbook?${paramsFor(1, true).toString()}`);
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể xuất sổ quỹ."); return; }
      const lines = [displayedColumns.map(([, label]) => label), ...(result.vouchers as CashVoucher[]).map((voucher) => displayedColumns.map(([key]) => rawCell(voucher, key)))];
      const csv = lines.map((line) => line.map((cell) => { const text = String(cell ?? ""); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll("\"", "\"\"")}"`; }).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `so-quy-${fund}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
    } catch { setError("Không thể kết nối máy chủ. Vui lòng thử lại."); }
    finally { setLoading(false); }
  }

  function rawCell(voucher: CashVoucher, key: ColumnKey): string {
    if (key === "code") return voucherCode(voucher.type, voucher.voucher_number);
    if (key === "time") return dateTime(voucher.occurred_at);
    if (key === "kind") return `${voucher.type === "receipt" ? "Thu" : "Chi"} - ${kindLabels[voucher.kind] || voucher.kind}`;
    if (key === "partner") return voucher.partner_name || "Khách lẻ";
    if (key === "amount") return money(Number(voucher.amount));
    if (key === "accountName") return voucher.cash_accounts?.name || "---";
    if (key === "accountNumber") return voucher.cash_accounts?.bank_account || "---";
    if (key === "note") return voucher.note || "---";
    if (key === "creator") return voucher.creator?.full_name || "---";
    if (key === "status") return voucher.status === "cancelled" ? "Đã hủy" : "Hoàn thành";
    return "---";
  }

  function renderCell(voucher: CashVoucher, key: ColumnKey) {
    if (key === "amount") return <span className={voucher.type === "receipt" ? "cash-income" : "cash-expense"}>{voucher.type === "receipt" ? "+" : "-"}{rawCell(voucher, "amount")}</span>;
    if (key === "status") return <span className={`cash-status ${voucher.status}`}>{rawCell(voucher, "status")}</span>;
    if (key === "code") return <button type="button" className="cash-code" onClick={() => onCancelAsk(voucher)} disabled={saving || voucher.status === "cancelled"} title={voucher.status === "cancelled" ? "Đã hủy" : "Bấm để hủy phiếu"}>{rawCell(voucher, "code")}</button>;
    return rawCell(voucher, key);
  }

  function onCancelAsk(voucher: CashVoucher) {
    if (voucher.status === "cancelled") return;
    if (window.confirm(`Hủy phiếu ${voucherCode(voucher.type, voucher.voucher_number)}?`)) cancelVoucher(voucher.id);
  }

  const summaryRows = useMemo(() => [{ label: "Quỹ đầu kỳ", value: summary.opening }, { label: "Tổng thu", value: summary.total_receipt, cls: "income" }, { label: "Tổng chi", value: summary.total_expense, cls: "expense" }, { label: "Tồn quỹ", value: summary.opening + summary.total_receipt - summary.total_expense }], [summary]);

  return <div className="kv-shell product-page business-page cashflow-page">
    <ManagementHeader profile={profile} active="cashflow" />
    <div className="cash-tabs">
      <strong>Sổ quỹ</strong>
      {(["all", "cash", "bank", "ewallet"] as FundTab[]).map((tab) => <button type="button" className={fund === tab ? "active" : ""} key={tab} onClick={() => { setFund(tab); setPage(1); }}>{fundLabel[tab]}</button>)}
      <span>{fundLabel[fund]} <b>{money(summary.opening + summary.total_receipt - summary.total_expense)}</b></span>
    </div>
    <div className="product-actions business-actions cash-actions"><h1>{fundLabel[fund]}</h1>
      <div className="product-toolbar cash-toolbar">
        <label className="product-query"><Search size={18} /><input aria-label="Tìm kiếm phiếu" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Theo mã phiếu, người nộp/nhận" /><SlidersHorizontal size={16} /></label>
        <button type="button" className="cash-create primary" onClick={() => openCreate("receipt")}><Plus size={17} />Phiếu thu</button>
        <button type="button" className="cash-create" onClick={() => openCreate("expense")}><Minus size={17} />Phiếu chi</button>
        <button type="button" className="cash-tool-button" onClick={exportCsv}><Download size={17} />Xuất file</button>
        <div className="column-control"><button type="button" className="cash-tool-button cash-icon" onClick={() => setShowColumns((value) => !value)}><Columns3 size={17} /></button>{showColumns && <div className="columns-popover business-columns cash-columns">{columns.map(([key, label]) => <label key={key}><input type="checkbox" checked={visible[key]} onChange={() => setVisible((current) => ({ ...current, [key]: !current[key] }))} />{label}</label>)}</div>}</div>
        <button type="button" className="cash-tool-button cash-icon" title="Thiết lập" onClick={() => setShowSettings(true)}><Settings size={17} /></button>
        <button type="button" className="cash-tool-button cash-icon" title="Hướng dẫn" onClick={() => setShowHelp(true)}><HelpCircle size={17} /></button>
      </div>
    </div>
    <main className="product-workspace cash-workspace">
      <aside className="product-filter-sidebar business-sidebar cash-sidebar">
        <section><h2>Thời gian</h2>{[["all", "Toàn thời gian"], ["month", "Tháng này"], ["custom", "Tùy chỉnh"]].map(([value, label]) => <label className="stock-radio" key={value}><input type="radio" name="cash-date" checked={datePreset === value} onChange={() => { if (value === "month") setDateRange(monthRange()); setDatePreset(value as "all" | "month" | "custom"); setPage(1); }} /><span>{label}</span>{value === "custom" && <CalendarDays size={16} />}</label>)}{datePreset === "custom" && <div className="cash-date-range"><input type="date" aria-label="Từ ngày" value={dateRange.from} onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))} /><input type="date" aria-label="Đến ngày" value={dateRange.to} onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))} /></div>}</section>
        <section><h2>Loại chứng từ</h2>{[["all", "Tất cả"], ["receipt", "Phiếu thu"], ["expense", "Phiếu chi"]].map(([value, label]) => <label className="stock-radio" key={value}><input type="radio" name="cash-type" checked={filters.type === value} onChange={() => changeFilter("type", value as FilterState["type"])} /><span>{label}</span></label>)}</section>
        <section><h2>Loại thu chi</h2><select aria-label="Loại thu chi" value={filters.kind} onChange={(event) => changeFilter("kind", event.target.value)}><option value="">Tất cả</option><optgroup label="Phiếu thu">{receiptKinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup><optgroup label="Phiếu chi">{expenseKinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup></select></section>
        <section><h2>Trạng thái</h2>{[["completed", "Hoàn thành"], ["cancelled", "Đã hủy"]].map(([value, label]) => <label className="stock-check" key={value}><input type="checkbox" checked={filters.status.includes(value)} onChange={() => toggleStatus(value)} />{label}</label>)}</section>
        <section><h2>Hạch toán KQKD</h2><div className="cash-chips">{[["all", "Tất cả"], ["yes", "Có"], ["no", "Không"]].map(([value, label]) => <button type="button" className={filters.profit === value ? "active" : ""} key={value} onClick={() => changeFilter("profit", value as FilterState["profit"])}>{label}</button>)}</div></section>
        <section><h2>Người tạo</h2><select aria-label="Người tạo" value={filters.creatorId} onChange={(event) => changeFilter("creatorId", event.target.value)}><option value="">Chọn người tạo</option>{meta.creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.full_name}</option>)}</select></section>
        <section><h2>Người nộp/nhận</h2><input aria-label="Tên người nộp/nhận" placeholder="Tìm theo tên" value={filters.partnerQuery} onChange={(event) => { setFilters((current) => ({ ...current, partnerQuery: event.target.value })); setPage(1); }} /></section>
        <section><h2>Công nợ đối tác</h2><select aria-label="Công nợ đối tác" value={filters.partnerKind} onChange={(event) => changeFilter("partnerKind", event.target.value as FilterState["partnerKind"])}><option value="all">Tất cả</option><option value="customer">Khách hàng</option><option value="supplier">Nhà cung cấp</option></select></section>
      </aside>
      <section className="product-content business-content cash-content">
        {notice && <div className="product-notice" role="status">{notice}<button type="button" aria-label="Đóng thông báo" onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="cash-error" role="alert">{error}<button type="button" onClick={() => setPage((value) => value)}>Thử lại</button></div>}
        <div className="cash-summary">{summaryRows.map((row) => <article key={row.label}><span>{row.label}</span><b className={row.cls || ""}>{money(row.value)}</b></article>)}</div>
        <div className={`product-table business-table cash-table ${loading ? "loading" : ""}`}>
          <table>
            <thead><tr>{displayedColumns.map(([key, label]) => <th key={key}>{label}</th>)}<th className="cash-act">Thao tác</th></tr></thead>
            <tbody>
              {vouchers.map((voucher) => <tr key={voucher.id} className={voucher.status === "cancelled" ? "cash-cancelled-row" : ""}>{displayedColumns.map(([key]) => <td className={key === "amount" ? "number-cell" : ""} key={key}>{renderCell(voucher, key)}</td>)}<td className="cash-act">{voucher.status === "completed" && <button type="button" className="cash-cancel" disabled={saving} onClick={() => onCancelAsk(voucher)}>Hủy</button>}</td></tr>)}
              {!vouchers.length && !loading && <tr><td colSpan={displayedColumns.length + 1}><div className="product-empty cash-empty"><WalletCards /><strong>Chưa có phiếu thu chi</strong><p>Bấm "Phiếu thu" hoặc "Phiếu chi" để tạo phiếu đầu tiên.</p></div></td></tr>}
            </tbody>
          </table>
          {loading && <div className="cash-loading" aria-label="Đang tải">Đang tải...</div>}
        </div>
        <footer className="product-pager customer-pager cash-pager"><label>Hiển thị<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="15">15 dòng</option><option value="30">30 dòng</option><option value="50">50 dòng</option></select></label><div><button type="button" disabled={safePage === 1} onClick={() => setPage(1)}>«</button><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button><button type="button" className="current">{safePage}</button><button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button><button type="button" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>»</button></div><span>{count ? (safePage - 1) * pageSize + 1 : 0} - {Math.min(safePage * pageSize, count)} trong {count} phiếu</span></footer>
      </section>
    </main>
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>
    {showCreate && <VoucherDialog type={showCreate} form={form} fundAccounts={fundAccounts} meta={meta} saving={saving} error={error} onForm={setForm} onClose={() => setShowCreate(null)} onSubmit={saveVoucher} />}
    {showSettings && <SettingsDialog accounts={accounts} saving={saving} error={error} notice={setNotice} onError={setError} onClose={() => setShowSettings(false)} onReload={async () => { const response = await fetch(`/api/cashbook?fund=all&page=1&pageSize=15&status=completed,cancelled`); const result = await response.json(); if (response.ok) { setAccounts(result.accounts); setSummary(result.summary); } }} />}
    {showHelp && <SimpleDialog title="Hướng dẫn sổ quỹ" onClose={() => setShowHelp(false)}><p>Sổ quỹ ghi nhận các phiếu thu/chi độc lập. Số dư quỹ = Quỹ đầu kỳ + Tổng thu − Tổng chi. Bấm mã phiếu để hủy phiếu đã tạo.</p></SimpleDialog>}
  </div>;
}

function VoucherDialog({ type, form, fundAccounts, meta, saving, error, onForm, onClose, onSubmit }: { type: "receipt" | "expense"; form: typeof emptyForm; fundAccounts: CashAccount[]; meta: CashMeta; saving: boolean; error: string; onForm: (form: typeof emptyForm) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const kinds = type === "receipt" ? receiptKinds : expenseKinds;
  const partners = type === "receipt" ? meta.customers : meta.suppliers;
  const field = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => onForm({ ...form, [key]: value });
  return <div className="modal-backdrop cash-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="product-modal cash-modal" role="dialog" aria-modal="true" aria-label={type === "receipt" ? "Tạo phiếu thu" : "Tạo phiếu chi"}>
      <header><div><h2>{type === "receipt" ? "Tạo phiếu thu" : "Tạo phiếu chi"}</h2><p>{type === "receipt" ? "Phiếu thu tiền" : "Phiếu chi tiền"} · {fundAccounts.find((account) => account.id === form.account_id)?.name || "Chọn tài khoản quỹ"}</p></div><button type="button" aria-label="Đóng" onClick={onClose}><X /></button></header>
      <form onSubmit={onSubmit}>
        <div className="cash-form">
          <label className="wide">Tài khoản quỹ<select value={form.account_id} onChange={(event) => field("account_id", event.target.value)}>{fundAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label>Loại {type === "receipt" ? "thu" : "chi"}<select value={form.kind} onChange={(event) => field("kind", event.target.value)}>{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Thời gian<input type="datetime-local" value={form.occurred_at} onChange={(event) => field("occurred_at", event.target.value)} /></label>
          <label>Đối tượng {type === "receipt" ? "nộp" : "nhận"}<select value={form.partner_kind} onChange={(event) => field("partner_kind", event.target.value as typeof form.partner_kind)}><option value="">Không</option><option value={type === "receipt" ? "customer" : "supplier"}>{type === "receipt" ? "Khách hàng" : "Nhà cung cấp"}</option></select></label>
          {form.partner_kind !== "" && <label>Chọn {type === "receipt" ? "khách hàng" : "nhà cung cấp"}<select value={form.partner_id} onChange={(event) => { const picked = partners.find((item) => item.id === event.target.value); field("partner_id", event.target.value); if (picked) field("partner_name", picked.name); }}><option value="">Chọn...</option>{partners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          <label className="wide">Tên người {type === "receipt" ? "nộp" : "nhận"}<input value={form.partner_name} onChange={(event) => field("partner_name", event.target.value)} /></label>
          <label>Số tiền<input type="number" min="0" inputMode="decimal" value={form.amount} onChange={(event) => field("amount", event.target.value)} /></label>
          <label className="wide">Ghi chú<textarea rows={2} value={form.note} onChange={(event) => field("note", event.target.value)} /></label>
          <label className="cash-check"><input type="checkbox" checked={form.affects_profit} onChange={(event) => field("affects_profit", event.target.checked)} />Hạch toán kết quả kinh doanh</label>
        </div>
        {error && <p className="cash-form-error" role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose}>Bỏ qua</button><button className="primary" disabled={saving || !Number(form.amount)}>{saving ? "Đang lưu..." : "Lưu"}</button></footer>
      </form>
    </section>
  </div>;
}

function SettingsDialog({ accounts, saving, error, notice, onError, onClose, onReload }: { accounts: CashAccount[]; saving: boolean; error: string; notice: (text: string) => void; onError: (text: string) => void; onClose: () => void; onReload: () => void }) {
  const [edits, setEdits] = useState<Record<string, string>>(() => Object.fromEntries(accounts.map((account) => [account.id, String(account.opening_balance)])));
  const [newForm, setNewForm] = useState({ name: "", account_type: "bank", opening_balance: "", bank_name: "", bank_account: "" });
  async function saveAccount(id: string) {
    const openingBalance = Number(edits[id]);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) { onError("Số dư đầu kỳ không hợp lệ."); return; }
    onError("");
    const response = await fetch("/api/cashbook/accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, opening_balance: openingBalance }) });
    const result = await response.json();
    if (!response.ok) { onError(result.error || "Không thể cập nhật."); return; }
    notice("Đã cập nhật số dư đầu kỳ."); onReload();
  }
  async function createAccount(event: FormEvent) {
    event.preventDefault();
    onError("");
    const response = await fetch("/api/cashbook/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newForm) });
    const result = await response.json();
    if (!response.ok) { onError(result.error || "Không thể tạo tài khoản quỹ."); return; }
    notice("Đã tạo tài khoản quỹ."); setNewForm({ name: "", account_type: "bank", opening_balance: "", bank_name: "", bank_account: "" }); onReload();
  }
  return <div className="modal-backdrop cash-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="product-modal cash-settings" role="dialog" aria-modal="true" aria-label="Thiết lập sổ quỹ">
      <header><div><h2>Thiết lập sổ quỹ</h2><p>Quản lý tài khoản quỹ và số dư đầu kỳ</p></div><button type="button" aria-label="Đóng" onClick={onClose}><X /></button></header>
      <div className="cash-settings-body">
        {accounts.map((account) => <div className="cash-account-row" key={account.id}><span className="cash-account-meta"><strong>{account.name}</strong><small>{fundLabel[account.account_type]}{account.bank_account ? ` · ${account.bank_account}` : ""}</small></span><input type="number" min="0" value={edits[account.id] ?? String(account.opening_balance)} onChange={(event) => setEdits((current) => ({ ...current, [account.id]: event.target.value }))} /><button type="button" onClick={() => saveAccount(account.id)} disabled={saving}>Lưu</button></div>)}
        {error && <p className="cash-form-error" role="alert">{error}</p>}
        <form className="cash-account-new" onSubmit={createAccount}><label>Tên tài khoản<input value={newForm.name} onChange={(event) => setNewForm((current) => ({ ...current, name: event.target.value }))} /></label><label>Loại quỹ<select value={newForm.account_type} onChange={(event) => setNewForm((current) => ({ ...current, account_type: event.target.value }))}><option value="cash">Tiền mặt</option><option value="bank">Ngân hàng</option><option value="ewallet">Ví điện tử</option></select></label><label>Ngân hàng<input value={newForm.bank_name} onChange={(event) => setNewForm((current) => ({ ...current, bank_name: event.target.value }))} /></label><label>Số tài khoản<input value={newForm.bank_account} onChange={(event) => setNewForm((current) => ({ ...current, bank_account: event.target.value }))} /></label><label>Số dư đầu kỳ<input type="number" min="0" value={newForm.opening_balance} onChange={(event) => setNewForm((current) => ({ ...current, opening_balance: event.target.value }))} /></label><button type="submit" className="primary" disabled={saving || !newForm.name.trim()}>Thêm tài khoản</button></form>
      </div>
      <footer><button type="button" className="primary" onClick={onClose}>Đóng</button></footer>
    </section>
  </div>;
}

function SimpleDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop cash-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="small-modal cash-small" role="dialog" aria-modal="true" aria-label={title}><header><h3>{title}</h3><button type="button" aria-label="Đóng" onClick={onClose}><X /></button></header><div>{children}</div><footer><button type="button" className="primary" onClick={onClose}>Đóng</button></footer></section></div>; }