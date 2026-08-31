"use client";

import { FormEvent, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Columns3, Download, FileUp, HelpCircle, Inbox, MoreHorizontal, Plus, Search, Settings, SlidersHorizontal, Star, Users, X } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import { VN_PROVINCES, getWardsForProvince } from "@/app/lib/vietnam-data";
import { getTodayVnKey } from "@/lib/vn-time";

type SourceShipment = { status: string; cod_amount: number; collected_cod: number };
type SourceReturn = { id: string; return_number: number; status: string; refund_amount: number; created_at: string };
type SourceOrder = { id: string; order_number: number; status: string; total: number; created_at: string; shipments?: SourceShipment[]; sales_returns?: SourceReturn[] };
export type CustomerGroup = { id: string; name: string };
export type SourceCustomer = {
  id: string;
  customer_number?: number | null;
  name: string;
  phone?: string | null;
  secondary_phone?: string | null;
  email?: string | null;
  birthday?: string | null;
  gender?: "male" | "female" | null;
  customer_type?: "individual" | "company";
  facebook?: string | null;
  address?: string | null;
  area?: string | null;
  ward?: string | null;
  note?: string | null;
  tax_code?: string | null;
  identity_number?: string | null;
  organization?: string | null;
  buyer_name?: string | null;
  invoice_address?: string | null;
  invoice_email?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  total_spent?: number;
  active?: boolean;
  favorite?: boolean;
  group_id?: string | null;
  created_at: string;
  updated_at?: string;
  created_by?: string | null;
  creator?: { full_name?: string } | null;
  customer_groups?: CustomerGroup | null;
  orders?: SourceOrder[];
};

type CustomerRow = SourceCustomer & { code: string; grossSales: number; netSales: number; debt: number; creatorName: string; groupName: string; lastTransaction: string };
type CustomerForm = {
  name: string; phone: string; secondary_phone: string; email: string; birthday: string; gender: "" | "male" | "female"; customer_type: "individual" | "company"; facebook: string; address: string; area: string; ward: string; group_id: string; note: string; tax_code: string; identity_number: string; organization: string; buyer_name: string; invoice_address: string; invoice_email: string; bank_name: string; bank_account: string; active: boolean; favorite: boolean;
};
type FilterState = { groupId: string; datePreset: "all" | "month" | "custom"; dateFrom: string; dateTo: string; creatorId: string; type: "all" | "individual" | "company"; gender: "all" | "male" | "female"; birthdayFrom: string; birthdayTo: string; transactionFrom: string; transactionTo: string; totalMin: string; totalMax: string; debtMin: string; debtMax: string; area: string; status: "all" | "active" | "inactive" };
type ColumnKey = "code" | "name" | "phone" | "birthday" | "email" | "facebook" | "taxCode" | "identity" | "address" | "ward" | "note" | "totalSpent" | "netSales" | "debt" | "createdAt" | "status";

const columns: Array<[ColumnKey, string]> = [["code", "Mã khách hàng"], ["name", "Tên khách hàng"], ["phone", "Điện thoại"], ["birthday", "Ngày sinh"], ["email", "Email"], ["facebook", "Facebook"], ["taxCode", "Mã số thuế"], ["identity", "Số CCCD/CMND"], ["address", "Địa chỉ"], ["ward", "Phường/Xã"], ["note", "Ghi chú"], ["totalSpent", "Tổng bán"], ["netSales", "Tổng bán trừ trả hàng"], ["debt", "Nợ hiện tại"], ["createdAt", "Ngày tạo"], ["status", "Trạng thái"]];
const defaultVisible = new Set<ColumnKey>(["code", "name", "phone", "debt", "totalSpent", "netSales"]);
const emptyForm: CustomerForm = { name: "", phone: "", secondary_phone: "", email: "", birthday: "", gender: "", customer_type: "individual", facebook: "", address: "", area: "", ward: "", group_id: "", note: "", tax_code: "", identity_number: "", organization: "", buyer_name: "", invoice_address: "", invoice_email: "", bank_name: "", bank_account: "", active: true, favorite: false };
const initialFilters: FilterState = { groupId: "", datePreset: "all", dateFrom: "", dateTo: "", creatorId: "", type: "all", gender: "all", birthdayFrom: "", birthdayTo: "", transactionFrom: "", transactionTo: "", totalMin: "", totalMax: "", debtMin: "", debtMax: "", area: "", status: "all" };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "Chưa có";
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "---";
const customerCode = (value?: number | null) => value == null ? "---" : `KH${String(value).padStart(6, "0")}`;
const invoiceCode = (value: number) => `HD${String(value).padStart(6, "0")}`;
const returnCode = (value: number) => `TH${String(value).padStart(6, "0")}`;

function toRow(customer: SourceCustomer): CustomerRow {
  const orders = customer.orders || [];
  const completed = orders.filter((order) => order.status === "paid" || order.status === "refunded");
  const grossSales = completed.reduce((sum, order) => sum + Number(order.total), 0);
  const returns = completed.flatMap((order) => order.sales_returns || []).filter((item) => item.status === "completed").reduce((sum, item) => sum + Number(item.refund_amount), 0);
  const debt = orders
    .filter((order) => order.status !== "draft" && order.status !== "cancelled")
    .flatMap((order) => order.shipments || [])
    .filter((shipment) => shipment.status !== "cancelled")
    .reduce((sum, shipment) => sum + Math.max(0, Number(shipment.cod_amount) - Number(shipment.collected_cod)), 0);
  const lastTransaction = orders.reduce((latest, order) => order.created_at > latest ? order.created_at : latest, customer.created_at);
  return { ...customer, code: customerCode(customer.customer_number), grossSales, netSales: Number(customer.total_spent ?? grossSales - returns), debt, creatorName: customer.creator?.full_name || "---", groupName: customer.customer_groups?.name || "Chưa có", lastTransaction };
}

function toForm(customer: SourceCustomer): CustomerForm {
  return { name: customer.name, phone: customer.phone || "", secondary_phone: customer.secondary_phone || "", email: customer.email || "", birthday: customer.birthday || "", gender: customer.gender || "", customer_type: customer.customer_type || "individual", facebook: customer.facebook || "", address: customer.address || "", area: customer.area || "", ward: customer.ward || "", group_id: customer.group_id || "", note: customer.note || "", tax_code: customer.tax_code || "", identity_number: customer.identity_number || "", organization: customer.organization || "", buyer_name: customer.buyer_name || "", invoice_address: customer.invoice_address || "", invoice_email: customer.invoice_email || "", bank_name: customer.bank_name || "", bank_account: customer.bank_account || "", active: customer.active !== false, favorite: customer.favorite === true };
}

export default function CustomersClient({ profile, initialCustomers, initialCount, groups: initialGroups, creators, dataWarning = "" }: { profile: Profile; initialCustomers: SourceCustomer[]; initialCount: number; groups: CustomerGroup[]; creators: Array<{ id: string; full_name: string }>; dataWarning?: string }) {
  const [items, setItems] = useState(initialCustomers);
  const [count, setCount] = useState(initialCount);
  const [groups, setGroups] = useState(initialGroups);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sort, setSort] = useState<{ key: ColumnKey; direction: "asc" | "desc" }>({ key: "code", direction: "desc" });
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(columns.map(([key]) => [key, defaultVisible.has(key)])));
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "history" | "debt">("info");
  const [showColumns, setShowColumns] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [editing, setEditing] = useState<SourceCustomer | null | "new">(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [notice, setNotice] = useState(dataWarning);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const firstRequest = useRef(true);
  const importRef = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => items.map(toRow), [items]);
  const areas = VN_PROVINCES as unknown as string[];
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(page, totalPages);
  const displayedColumns = columns.filter(([key]) => visible[key]);

  function paramsFor(targetPage = page, exportAll = false) {
    const params = new URLSearchParams({ page: String(targetPage), pageSize: exportAll ? "5000" : String(pageSize), q: query, sort: sort.key, direction: sort.direction });
    if (exportAll) params.set("export", "1");
    if (filters.groupId) params.set("groupId", filters.groupId);
    if (filters.creatorId) params.set("creatorId", filters.creatorId);
    if (filters.type !== "all") params.set("type", filters.type);
    if (filters.gender !== "all") params.set("gender", filters.gender);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.area) params.set("area", filters.area);
    for (const key of ["dateFrom", "dateTo", "birthdayFrom", "birthdayTo", "transactionFrom", "transactionTo", "totalMin", "totalMax", "debtMin", "debtMax"] as const) if (filters[key]) params.set(key, filters[key]);
    if (filters.datePreset === "month") {
      const today = getTodayVnKey();
      params.set("dateFrom", `${today.slice(0, 7)}-01`);
      params.set("dateTo", today);
    }
    return params;
  }

  useEffect(() => {
    if (firstRequest.current) { firstRequest.current = false; return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/customers?${paramsFor().toString()}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) { setError(result.error || "Không thể tải khách hàng."); return; }
        startTransition(() => { setItems(result.customers); setCount(result.count); setSelected([]); });
      } catch (requestError) {
        if ((requestError as Error).name !== "AbortError") setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filters, page, pageSize, query, refreshKey, sort]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowColumns(false); setShowMore(false); setShowSettings(false); setShowHelp(false); setShowGroup(false); setEditing(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  const changeFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const toggleSort = (key: ColumnKey) => { if (!["code", "name", "phone", "totalSpent", "createdAt", "status"].includes(key)) return; setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" })); setPage(1); };
  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  function openCreate() { setForm(emptyForm); setEditing("new"); setError(""); }
  function openEdit(customer: SourceCustomer) { setForm(toForm(customer)); setEditing(customer); setError(""); }

  async function saveCustomer(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) { setError("Tên khách hàng là bắt buộc."); return; }
    setSaving(true); setError("");
    try {
      const method = editing === "new" ? "POST" : "PATCH";
      const response = await fetch("/api/customers", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing === "new" ? form : { ...form, id: editing?.id }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể lưu khách hàng."); return; }
      setEditing(null); setNotice(editing === "new" ? "Đã tạo khách hàng." : "Đã cập nhật khách hàng."); setRefreshKey((value) => value + 1);
    } catch { setError("Không thể kết nối máy chủ. Vui lòng thử lại."); }
    finally { setSaving(false); }
  }

  async function patchCustomer(customer: SourceCustomer, changes: Partial<CustomerForm>) {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/customers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: customer.id, ...toForm(customer), ...changes }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể cập nhật khách hàng."); return; }
      setItems((current) => current.map((item) => item.id === customer.id ? result.customer : item));
      setNotice("Đã cập nhật khách hàng.");
    } catch { setError("Không thể kết nối máy chủ. Vui lòng thử lại."); }
    finally { setSaving(false); }
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/customer-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: groupName }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể tạo nhóm."); return; }
      setGroups((current) => [...current, result.group].sort((a, b) => a.name.localeCompare(b.name, "vi"))); setGroupName(""); setShowGroup(false); setNotice("Đã tạo nhóm khách hàng.");
    } catch { setError("Không thể kết nối máy chủ. Vui lòng thử lại."); }
    finally { setSaving(false); }
  }

  async function importCustomers() {
    const file = importRef.current?.files?.[0];
    if (!file) return;
    setLoading(true); setError("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const imported = records.map((record) => ({ name: record["Tên khách hàng"] || record.name, phone: record["Điện thoại"] || record.phone, email: record.Email || record.email, birthday: record["Ngày sinh"] || record.birthday, address: record["Địa chỉ"] || record.address, note: record["Ghi chú"] || record.note }));
      if (!imported.length) { setError("File không có dữ liệu khách hàng."); return; }
      const response = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: imported }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể import khách hàng."); return; }
      setNotice(`Đã import ${result.customers.length} khách hàng.`); setPage(1); setRefreshKey((value) => value + 1);
    } catch { setError("Không thể đọc hoặc import file."); }
    finally { setLoading(false); if (importRef.current) importRef.current.value = ""; }
  }

  async function exportCustomers() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/customers?${paramsFor(1, true).toString()}`);
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể xuất khách hàng."); return; }
      const exportRows = (result.customers as SourceCustomer[]).map(toRow);
      const lines = [displayedColumns.map(([, label]) => label), ...exportRows.map((row) => displayedColumns.map(([key]) => rawCell(row, key)))];
      const csv = lines.map((line) => line.map((cell) => { const text = String(cell ?? "---"); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll("\"", "\"\"")}"`; }).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `khach-hang-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
    } catch { setError("Không thể kết nối máy chủ. Vui lòng thử lại."); }
    finally { setLoading(false); }
  }

  function rawCell(row: CustomerRow, key: ColumnKey): string | number {
    if (key === "birthday") return date(row.birthday);
    if (key === "taxCode") return row.tax_code || "---";
    if (key === "identity") return row.identity_number || "---";
    if (key === "ward") return row.ward || "---";
    if (key === "note") return row.note || "---";
    if (key === "totalSpent") return row.grossSales;
    if (key === "netSales") return row.netSales;
    if (key === "debt") return row.debt;
    if (key === "createdAt") return date(row.created_at);
    if (key === "status") return row.active === false ? "Ngừng hoạt động" : "Đang hoạt động";
    return String(row[key as keyof CustomerRow] || "---");
  }

  function renderCell(row: CustomerRow, key: ColumnKey) {
    if (key === "code" || key === "name") return <button type="button" className="customer-link" onClick={() => { setExpanded((current) => current === row.id ? null : row.id); setDetailTab("info"); }}>{rawCell(row, key)}</button>;
    if (["totalSpent", "netSales", "debt"].includes(key)) return money(Number(rawCell(row, key)));
    if (key === "status") return <span className={`customer-status ${row.active === false ? "inactive" : "active"}`}>{rawCell(row, key)}</span>;
    return rawCell(row, key);
  }

  return <div className="kv-shell product-page business-page customers-page">
    <ManagementHeader profile={profile} active="customers" />
    <div className="product-actions business-actions customer-actions"><h1>Khách hàng</h1><div className="product-toolbar customer-toolbar">
      <label className="product-query"><Search size={18} /><input aria-label="Tìm kiếm khách hàng" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Theo mã, tên, số điện thoại" /><SlidersHorizontal size={16} /></label>
      <button type="button" className="customer-tool primary" title="Khách hàng" aria-label="Tạo khách hàng" onClick={openCreate}><Plus /></button>
      <button type="button" className="customer-tool" title="Import file" aria-label="Import file" onClick={() => importRef.current?.click()}><FileUp /></button><input hidden type="file" accept=".csv,.xlsx,.xls" ref={importRef} onChange={importCustomers} />
      <div className="customer-more"><button type="button" className="customer-tool" title="Khác" aria-label="Khác" onClick={() => setShowMore((value) => !value)}><MoreHorizontal /></button>{showMore && <div className="customer-more-menu"><button type="button" onClick={exportCustomers}><Download size={16} />Xuất file</button></div>}</div>
      <div className="column-control"><button type="button" className="customer-tool" title="Chọn cột" aria-label="Chọn cột" onClick={() => setShowColumns((value) => !value)}><Columns3 /></button>{showColumns && <div className="columns-popover business-columns customer-columns">{columns.map(([key, label]) => <label key={key}><input type="checkbox" checked={visible[key]} onChange={() => setVisible((current) => ({ ...current, [key]: !current[key] }))} />{label}</label>)}</div>}</div>
      <button type="button" className="customer-tool" title="Thiết lập" aria-label="Thiết lập" onClick={() => setShowSettings(true)}><Settings /></button><button type="button" className="customer-tool" title="Hướng dẫn sử dụng" aria-label="Hướng dẫn sử dụng" onClick={() => setShowHelp(true)}><HelpCircle /></button>
    </div></div>
    <main className="product-workspace customer-workspace"><aside className="product-filter-sidebar business-sidebar customer-sidebar">
      <section><h2>Nhóm khách hàng <button type="button" onClick={() => { setError(""); setShowGroup(true); }}>Tạo mới</button></h2><select aria-label="Nhóm khách hàng" value={filters.groupId} onChange={(event) => changeFilter("groupId", event.target.value)}><option value="">Tất cả các nhóm</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></section>
      <DateFilter title="Ngày tạo" preset={filters.datePreset} from={filters.dateFrom} to={filters.dateTo} onChange={(preset, from, to) => { setFilters((current) => ({ ...current, datePreset: preset, dateFrom: from, dateTo: to })); setPage(1); }} />
      <section><h2>Người tạo</h2><select aria-label="Người tạo" value={filters.creatorId} onChange={(event) => changeFilter("creatorId", event.target.value)}><option value="">Chọn người tạo</option>{creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.full_name}</option>)}</select></section>
      <ChipFilter title="Loại khách hàng" value={filters.type} options={[["all", "Tất cả"], ["individual", "Cá nhân"], ["company", "Công ty"]]} onChange={(value) => changeFilter("type", value as FilterState["type"])} />
      <ChipFilter title="Giới tính" value={filters.gender} options={[["all", "Tất cả"], ["male", "Nam"], ["female", "Nữ"]]} onChange={(value) => changeFilter("gender", value as FilterState["gender"])} />
      <RangeDateFilter title="Sinh nhật" from={filters.birthdayFrom} to={filters.birthdayTo} onChange={(from, to) => { setFilters((current) => ({ ...current, birthdayFrom: from, birthdayTo: to })); setPage(1); }} />
      <RangeDateFilter title="Ngày giao dịch cuối" from={filters.transactionFrom} to={filters.transactionTo} onChange={(from, to) => { setFilters((current) => ({ ...current, transactionFrom: from, transactionTo: to })); setPage(1); }} />
      <MoneyRange title="Tổng bán" from={filters.totalMin} to={filters.totalMax} onChange={(from, to) => { setFilters((current) => ({ ...current, totalMin: from, totalMax: to })); setPage(1); }} />
      <MoneyRange title="Nợ hiện tại" from={filters.debtMin} to={filters.debtMax} onChange={(from, to) => { setFilters((current) => ({ ...current, debtMin: from, debtMax: to })); setPage(1); }} />
      <section><h2>Khu vực giao hàng</h2><select aria-label="Khu vực giao hàng" value={filters.area} onChange={(event) => changeFilter("area", event.target.value)}><option value="">Chọn Tỉnh/TP - Quận/Huyện</option>{areas.map((area) => <option key={area}>{area}</option>)}</select></section>
      <ChipFilter title="Trạng thái" value={filters.status} options={[["all", "Tất cả"], ["active", "Đang hoạt động"], ["inactive", "Ngừng hoạt động"]]} onChange={(value) => changeFilter("status", value as FilterState["status"])} />
    </aside><section className="product-content business-content customer-content">
      {notice && <div className="product-notice" role="status">{notice}<button type="button" aria-label="Đóng thông báo" onClick={() => setNotice("")}>×</button></div>}{error && <div className="customer-error" role="alert">{error}<button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Thử lại</button></div>}
      {selected.length > 0 && <div className="customer-selection"><span>Đã chọn {selected.length} khách hàng</span><button type="button" onClick={() => setSelected([])}>Bỏ chọn</button></div>}
      <div className={`product-table business-table customer-table ${loading ? "loading" : ""}`}><table><thead><tr><th className="row-select"><input type="checkbox" aria-label="Chọn tất cả" checked={rows.length > 0 && rows.every((row) => selected.includes(row.id))} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th><th className="row-star"><Star size={17} /></th>{displayedColumns.map(([key, label]) => <th key={key}><button type="button" aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined} onClick={() => toggleSort(key)}>{label}{sort.key === key ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>)}</tr></thead><tbody>
        <tr className="customer-summary-row"><td /><td />{displayedColumns.map(([key]) => <td className={["totalSpent", "netSales", "debt"].includes(key) ? "number-cell" : ""} key={key}>{key === "totalSpent" ? money(rows.reduce((sum, row) => sum + row.grossSales, 0)) : key === "netSales" ? money(rows.reduce((sum, row) => sum + row.netSales, 0)) : key === "debt" ? money(rows.reduce((sum, row) => sum + row.debt, 0)) : ""}</td>)}</tr>
        {rows.map((row) => <CustomerTableRows key={row.id} row={row} columns={displayedColumns} selected={selected.includes(row.id)} expanded={expanded === row.id} detailTab={detailTab} saving={saving} onSelect={() => toggleSelected(row.id)} onFavorite={() => patchCustomer(row, { favorite: !row.favorite })} onExpand={() => { setExpanded((current) => current === row.id ? null : row.id); setDetailTab("info"); }} onTab={setDetailTab} onEdit={() => openEdit(row)} onToggleActive={() => patchCustomer(row, { active: row.active === false })} renderCell={renderCell} />)}
        {!rows.length && !loading && <tr><td colSpan={displayedColumns.length + 2}><div className="product-empty customer-empty"><Inbox /><strong>Không tìm thấy kết quả</strong><p>Không có khách hàng phù hợp với bộ lọc hiện tại.</p></div></td></tr>}
      </tbody></table>{loading && <div className="customer-loading" aria-label="Đang tải">Đang tải...</div>}</div>
      <footer className="product-pager customer-pager"><label>Hiển thị<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="15">15 dòng</option><option value="30">30 dòng</option><option value="50">50 dòng</option></select></label><div><button type="button" disabled={safePage === 1} onClick={() => setPage(1)} aria-label="Trang đầu">«</button><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria-label="Trang trước">‹</button><button type="button" className="current">{safePage}</button><button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} aria-label="Trang sau">›</button><button type="button" disabled={safePage === totalPages} onClick={() => setPage(totalPages)} aria-label="Trang cuối">»</button></div><span>{count ? (safePage - 1) * pageSize + 1 : 0} - {Math.min(safePage * pageSize, count)} trong {count} khách hàng</span></footer>
    </section></main><a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>
    {editing && <CustomerDialog customer={editing === "new" ? null : editing} form={form} groups={groups} saving={saving} error={error} onForm={setForm} onClose={() => setEditing(null)} onSubmit={saveCustomer} />}
    {showGroup && <SimpleDialog title="Tạo nhóm khách hàng" onClose={() => setShowGroup(false)}><form className="customer-group-form" onSubmit={createGroup}><label>Tên nhóm *<input autoFocus required value={groupName} onChange={(event) => setGroupName(event.target.value)} /></label>{error && <p className="customer-form-error">{error}</p>}<footer><button type="button" onClick={() => setShowGroup(false)}>Bỏ qua</button><button className="primary" disabled={saving || !groupName.trim()}>{saving ? "Đang lưu..." : "Lưu"}</button></footer></form></SimpleDialog>}
    {showSettings && <SimpleDialog title="Thiết lập danh sách" onClose={() => setShowSettings(false)}><p>Chọn các cột cần hiển thị bằng nút danh sách cột trên thanh công cụ.</p></SimpleDialog>}
    {showHelp && <SimpleDialog title="Hướng dẫn khách hàng" onClose={() => setShowHelp(false)}><p>Tìm kiếm theo mã, tên hoặc số điện thoại. Bấm mã hoặc tên khách hàng để xem thông tin, lịch sử giao dịch và công nợ.</p></SimpleDialog>}
  </div>;
}

function CustomerTableRows({ row, columns, selected, expanded, detailTab, saving, onSelect, onFavorite, onExpand, onTab, onEdit, onToggleActive, renderCell }: { row: CustomerRow; columns: Array<[ColumnKey, string]>; selected: boolean; expanded: boolean; detailTab: "info" | "history" | "debt"; saving: boolean; onSelect: () => void; onFavorite: () => void; onExpand: () => void; onTab: (tab: "info" | "history" | "debt") => void; onEdit: () => void; onToggleActive: () => void; renderCell: (row: CustomerRow, key: ColumnKey) => React.ReactNode }) {
  return <><tr className={`customer-row ${selected || expanded ? "selected" : ""}`} onDoubleClick={onExpand}><td className="row-select"><input type="checkbox" aria-label={`Chọn ${row.name}`} checked={selected} onChange={onSelect} /></td><td className="row-star"><button type="button" aria-label={row.favorite ? "Bỏ đánh dấu" : "Đánh dấu"} disabled={saving} onClick={onFavorite}><Star size={17} fill={row.favorite ? "#f5a623" : "none"} /></button></td>{columns.map(([key]) => <td className={["totalSpent", "netSales", "debt"].includes(key) ? "number-cell" : ""} key={key}>{renderCell(row, key)}</td>)}</tr>{expanded && <tr className="customer-detail-row"><td colSpan={columns.length + 2}><CustomerDetail row={row} tab={detailTab} saving={saving} onTab={onTab} onEdit={onEdit} onToggleActive={onToggleActive} /></td></tr>}</>;
}

function CustomerDetail({ row, tab, saving, onTab, onEdit, onToggleActive }: { row: CustomerRow; tab: "info" | "history" | "debt"; saving: boolean; onTab: (tab: "info" | "history" | "debt") => void; onEdit: () => void; onToggleActive: () => void }) {
  const orders = row.orders || [];
  return <div className="customer-detail"><nav><button type="button" className={tab === "info" ? "active" : ""} onClick={() => onTab("info")}>Thông tin</button><button type="button" className={tab === "history" ? "active" : ""} onClick={() => onTab("history")}>Lịch sử mua hàng</button><button type="button" className={tab === "debt" ? "active" : ""} onClick={() => onTab("debt")}>Nợ cần thu từ khách</button></nav>{tab === "info" && <div className="customer-info"><div className="customer-avatar"><Users /></div><div className="customer-identity"><h3>{row.name} <small>{row.code}</small></h3><p>Người tạo: <b>{row.creatorName}</b><span />Ngày tạo: <b>{date(row.created_at)}</b><span />Nhóm khách: <b>{row.groupName}</b></p></div><strong className="customer-branch">Chi nhánh trung tâm</strong><div className="customer-fields"><InfoField label="Điện thoại" value={row.phone} /><InfoField label="Sinh nhật" value={row.birthday ? date(row.birthday) : null} /><InfoField label="Giới tính" value={row.gender === "male" ? "Nam" : row.gender === "female" ? "Nữ" : null} /><InfoField label="Email" value={row.email} /><InfoField label="Facebook" value={row.facebook} /><InfoField label="Địa chỉ" value={[row.address, row.ward, row.area].filter(Boolean).join(", ")} /></div><p className="customer-note">{row.note || "Chưa có ghi chú"}</p></div>}{tab === "history" && <div className="customer-history"><table><thead><tr><th>Mã hóa đơn</th><th>Thời gian</th><th>Trạng thái</th><th>Tổng tiền</th><th>Mã trả hàng</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><a href={`/invoices?code=${invoiceCode(order.order_number)}`}>{invoiceCode(order.order_number)}</a></td><td>{dateTime(order.created_at)}</td><td>{order.status === "paid" ? "Hoàn thành" : order.status === "refunded" ? "Đã trả hàng" : order.status}</td><td>{money(Number(order.total))}</td><td>{order.sales_returns?.[0] ? <a href={`/returns?code=${returnCode(order.sales_returns[0].return_number)}`}>{returnCode(order.sales_returns[0].return_number)}</a> : "---"}</td></tr>)}{!orders.length && <tr><td colSpan={5}>Chưa có giao dịch</td></tr>}</tbody></table></div>}{tab === "debt" && <div className="customer-debt"><strong>Nợ hiện tại <b>{money(row.debt)}</b></strong>{orders.flatMap((order) => (order.shipments || []).filter((shipment) => Number(shipment.cod_amount) > Number(shipment.collected_cod)).map((shipment, index) => <p key={`${order.id}-${index}`}><a href={`/invoices?code=${invoiceCode(order.order_number)}`}>{invoiceCode(order.order_number)}</a><span>COD còn phải thu</span><b>{money(Number(shipment.cod_amount) - Number(shipment.collected_cod))}</b></p>))}{row.debt === 0 && <p>Khách hàng không có công nợ.</p>}</div>}<footer><button type="button" onClick={onEdit}>Chỉnh sửa</button><button type="button" disabled={saving} onClick={onToggleActive}>{row.active === false ? "Hoạt động" : "Ngừng hoạt động"}</button></footer></div>;
}

function InfoField({ label, value }: { label: string; value?: string | null }) { return <p><span>{label}</span><b>{value || "Chưa có"}</b></p>; }

function DateFilter({ title, preset, from, to, onChange }: { title: string; preset: "all" | "month" | "custom"; from: string; to: string; onChange: (preset: "all" | "month" | "custom", from: string, to: string) => void }) {
  return <section><h2>{title}</h2><label className="customer-radio-card"><input type="radio" name="customer-created-date" checked={preset === "all"} onChange={() => onChange("all", "", "")} /><span>Toàn thời gian</span><b>›</b></label><label className="customer-radio-card"><input type="radio" name="customer-created-date" checked={preset === "custom"} onChange={() => onChange("custom", from, to)} /><span>Tùy chỉnh</span><CalendarDays /></label>{preset === "custom" && <div className="customer-date-range"><input type="date" aria-label="Từ ngày" value={from} onChange={(event) => onChange("custom", event.target.value, to)} /><input type="date" aria-label="Đến ngày" value={to} onChange={(event) => onChange("custom", from, event.target.value)} /></div>}<button type="button" className={`customer-month-shortcut ${preset === "month" ? "active" : ""}`} onClick={() => onChange("month", "", "")}>Tháng này</button></section>;
}

function RangeDateFilter({ title, from, to, onChange }: { title: string; from: string; to: string; onChange: (from: string, to: string) => void }) { const custom = Boolean(from || to); return <section><h2>{title}</h2><button type="button" className={`customer-range-toggle ${custom ? "active" : ""}`} onClick={() => custom ? onChange("", "") : onChange(getTodayVnKey(), "")}>{custom ? "Tùy chỉnh" : "Toàn thời gian"}<CalendarDays /></button>{custom && <div className="customer-date-range"><input type="date" aria-label={`${title} từ ngày`} value={from} onChange={(event) => onChange(event.target.value, to)} /><input type="date" aria-label={`${title} đến ngày`} value={to} onChange={(event) => onChange(from, event.target.value)} /></div>}</section>; }
function ChipFilter({ title, value, options, onChange }: { title: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) { return <section><h2>{title}</h2><div className="customer-chips">{options.map(([key, label]) => <button type="button" className={value === key ? "active" : ""} key={key} onClick={() => onChange(key)}>{label}</button>)}</div></section>; }
function MoneyRange({ title, from, to, onChange }: { title: string; from: string; to: string; onChange: (from: string, to: string) => void }) { return <section><h2>{title}</h2><select aria-label={`${title} kiểu lọc`} value="range" disabled><option value="range">Giá trị</option></select><div className="customer-money-range"><input type="number" min="0" placeholder="Từ" value={from} onChange={(event) => onChange(event.target.value, to)} /><input type="number" min="0" placeholder="Tới" value={to} onChange={(event) => onChange(from, event.target.value)} /></div></section>; }

function CustomerDialog({ customer, form, groups, saving, error, onForm, onClose, onSubmit }: { customer: SourceCustomer | null; form: CustomerForm; groups: CustomerGroup[]; saving: boolean; error: string; onForm: (form: CustomerForm) => void; onClose: () => void; onSubmit: (event: FormEvent) => void }) {
  const field = <K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) => onForm({ ...form, [key]: value });
  return <div className="modal-backdrop customer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="product-modal customer-modal" role="dialog" aria-modal="true" aria-label={customer ? "Chỉnh sửa khách hàng" : "Tạo khách hàng"}><header><h2>{customer ? "Chỉnh sửa khách hàng" : "Tạo khách hàng"}</h2><button type="button" aria-label="Đóng" onClick={onClose}><X /></button></header><form onSubmit={onSubmit}><div className="customer-form customer-main-form"><label>Tên khách hàng<input autoFocus required placeholder="Bắt buộc" value={form.name} onChange={(event) => field("name", event.target.value)} /></label><label>Mã khách hàng<input disabled placeholder={customer ? customerCode(customer.customer_number) : "Tự động"} /></label><label>Điện thoại 1<input value={form.phone} onChange={(event) => field("phone", event.target.value)} /></label><label>Điện thoại 2<input value={form.secondary_phone} onChange={(event) => field("secondary_phone", event.target.value)} /></label><label>Sinh nhật<input type="date" value={form.birthday} onChange={(event) => field("birthday", event.target.value)} /></label><label>Giới tính<select value={form.gender} onChange={(event) => field("gender", event.target.value as CustomerForm["gender"])}><option value="">Chọn giới tính</option><option value="male">Nam</option><option value="female">Nữ</option></select></label><label>Email<input type="email" placeholder="email@gmail.com" value={form.email} onChange={(event) => field("email", event.target.value)} /></label><label>Facebook<input placeholder="facebook.com/username" value={form.facebook} onChange={(event) => field("facebook", event.target.value)} /></label></div><CustomerFormSection title="Địa chỉ"><div className="customer-section-grid"><label className="wide">Địa chỉ<input placeholder="Nhập địa chỉ" value={form.address} onChange={(event) => field("address", event.target.value)} /></label><label>Khu vực<select value={form.area} onChange={(event) => field("area", event.target.value)}><option value="">Chọn Tỉnh/Thành phố</option>{!(VN_PROVINCES as readonly string[]).includes(form.area) && form.area && <option value={form.area}>{form.area} (tên cũ)</option>}{VN_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label><label>Phường/Xã<input list="customer-wards" placeholder={form.area ? "Chọn hoặc nhập Phường/Xã" : "Chọn Tỉnh/TP trước"} value={form.ward} onChange={(event) => field("ward", event.target.value)} disabled={!form.area} />{form.area && <datalist id="customer-wards">{getWardsForProvince(form.area).map((w) => <option key={w} value={w} />)}</datalist>}</label></div></CustomerFormSection><CustomerFormSection title="Nhóm khách hàng, ghi chú"><div className="customer-section-grid"><label>Nhóm khách hàng<select value={form.group_id} onChange={(event) => field("group_id", event.target.value)}><option value="">Chưa có</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label className="wide">Ghi chú<textarea rows={2} value={form.note} onChange={(event) => field("note", event.target.value)} /></label></div></CustomerFormSection><CustomerFormSection title="Thông tin xuất hóa đơn"><div className="customer-section-grid"><label>Loại khách hàng<select value={form.customer_type} onChange={(event) => field("customer_type", event.target.value as CustomerForm["customer_type"])}><option value="individual">Cá nhân / Hộ kinh doanh</option><option value="company">Doanh nghiệp</option></select></label><label>Mã số thuế<input value={form.tax_code} onChange={(event) => field("tax_code", event.target.value)} /></label><label>Số CCCD/CMND<input value={form.identity_number} onChange={(event) => field("identity_number", event.target.value)} /></label><label>Tên đơn vị<input value={form.organization} onChange={(event) => field("organization", event.target.value)} /></label><label>Tên người mua<input value={form.buyer_name} onChange={(event) => field("buyer_name", event.target.value)} /></label><label>Email hóa đơn<input type="email" value={form.invoice_email} onChange={(event) => field("invoice_email", event.target.value)} /></label><label className="wide">Địa chỉ hóa đơn<input value={form.invoice_address} onChange={(event) => field("invoice_address", event.target.value)} /></label><label>Ngân hàng<input value={form.bank_name} onChange={(event) => field("bank_name", event.target.value)} /></label><label>Số tài khoản ngân hàng<input value={form.bank_account} onChange={(event) => field("bank_account", event.target.value)} /></label></div></CustomerFormSection>{error && <p className="customer-form-error" role="alert">{error}</p>}<footer><button type="button" onClick={onClose}>Bỏ qua</button><button className="primary" disabled={saving || !form.name.trim()}>{saving ? "Đang lưu..." : "Lưu"}</button></footer></form></section></div>;
}
function CustomerFormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="customer-form-section"><h3>{title}</h3>{children}</section>; }
function SimpleDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop customer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="small-modal customer-small-dialog" role="dialog" aria-modal="true" aria-label={title}><header><h3>{title}</h3><button type="button" aria-label="Đóng" onClick={onClose}><X /></button></header><div>{children}</div><footer><button type="button" className="primary" onClick={onClose}>Đóng</button></footer></section></div>; }
