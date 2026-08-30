"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, FileUp, HelpCircle, Plus, Search, Settings, Star, X } from "lucide-react";
import * as XLSX from "xlsx";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import DateRangePicker, { type DateValue } from "@/app/date-range-picker";
import "../suppliers.css";

type Supplier = {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  area: string;
  ward: string;
  group: string;
  company: string;
  taxCode: string;
  identity: string;
  note: string;
  creator: string;
  createdAt: string;
  debt: number;
  totalPurchase: number;
  active: boolean;
  favorite: boolean;
};
type ColumnKey = "code" | "name" | "phone" | "email" | "debt" | "totalPurchase";
type Notice = { kind: "success" | "error"; text: string } | null;
type Modal = "import" | "settings" | "help" | null;
type StatusFilter = "all" | "active" | "inactive";

const PAGE_SIZE = 15;
const columns: Array<{ key: ColumnKey; label: string; numeric?: boolean }> = [
  { key: "code", label: "Mã nhà cung cấp" },
  { key: "name", label: "Tên nhà cung cấp" },
  { key: "phone", label: "Điện thoại" },
  { key: "email", label: "Email" },
  { key: "debt", label: "Nợ cần trả hiện tại", numeric: true },
  { key: "totalPurchase", label: "Tổng mua", numeric: true },
];
const EXPORT_HEADERS = ["Mã nhà cung cấp", "Tên nhà cung cấp", "Điện thoại", "Email", "Địa chỉ", "Nhóm", "Trạng thái"];
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

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

function mapSupplier(row: Record<string, unknown>): Supplier {
  const profiles = row.profiles as { full_name?: string } | null | undefined;
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    address: String(row.address ?? ""),
    area: String(row.area ?? ""),
    ward: String(row.ward ?? ""),
    group: String((row.group as string) ?? (row.group_name as string) ?? ""),
    company: String(row.company ?? ""),
    taxCode: String((row.taxCode as string) ?? (row.tax_code as string) ?? ""),
    identity: String(row.identity ?? ""),
    note: String(row.note ?? ""),
    creator: String((row.creator as string) ?? profiles?.full_name ?? ""),
    createdAt: String((row.createdAt as string) ?? (row.created_at as string) ?? new Date().toISOString()),
    debt: Number((row.debt as number) ?? 0),
    totalPurchase: Number((row.totalPurchase as number) ?? (row.total_purchase as number) ?? 0),
    active: row.active !== false,
    favorite: false,
  };
}

const emptyForm = { name: "", code: "", phone: "", email: "", address: "", area: "", ward: "", group: "", company: "", taxCode: "", identity: "", note: "" };

export default function SuppliersClient({ profile, initialSuppliers, initialProducts }: { profile: Profile; initialSuppliers: Array<Record<string, unknown>>; initialProducts: Array<{ id: string; name: string; sku: string; price: number; cost?: number; stock_quantity: number; base_unit?: string | null }> }) {
  const seed = useMemo<Supplier[]>(() => initialSuppliers.map((item) => mapSupplier(item as Record<string, unknown>)), [initialSuppliers]);
  const [items, setItems] = useState<Supplier[]>(seed);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [codeQuery, setCodeQuery] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [phoneQuery, setPhoneQuery] = useState("");
  const [emailQuery, setEmailQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [totalMin, setTotalMin] = useState("");
  const [totalMax, setTotalMax] = useState("");
  const [dateValue, setDateValue] = useState<DateValue>({ preset: "all" });
  const [debtMin, setDebtMin] = useState("");
  const [debtMax, setDebtMax] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showGroup, setShowGroup] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const importInput = useRef<HTMLInputElement>(null);

  async function loadSuppliers() {
    setLoading(true);
    try {
      const response = await fetch("/api/suppliers");
      if (!response.ok) throw new Error(await apiError(response));
      const data = await response.json() as { suppliers?: Array<Record<string, unknown>> };
      setItems((data.suppliers || []).map(mapSupplier));
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể tải nhà cung cấp; đang hiển thị dữ liệu khởi tạo." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => Array.from(new Set([...customGroups, ...items.map((item) => item.group).filter(Boolean)])), [customGroups, items]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      const haystack = `${item.code} ${item.name} ${item.phone} ${item.email}`.toLowerCase();
      const globalMatch = !keyword || haystack.includes(keyword);
      const codeMatch = item.code.toLowerCase().includes(codeQuery.trim().toLowerCase());
      const nameMatch = item.name.toLowerCase().includes(nameQuery.trim().toLowerCase());
      const phoneMatch = item.phone.toLowerCase().includes(phoneQuery.trim().toLowerCase());
      const emailMatch = item.email.toLowerCase().includes(emailQuery.trim().toLowerCase());
      const groupMatch = groupFilter === "all" || item.group === groupFilter;
      const totalOk = (!totalMin || item.totalPurchase >= Number(totalMin)) && (!totalMax || item.totalPurchase <= Number(totalMax));
      const created = item.createdAt.slice(0, 10);
      const dateOk = dateValue.preset === "all" || ((!dateValue.from || created >= dateValue.from) && (!dateValue.to || created <= dateValue.to));
      const debtOk = (!debtMin || item.debt >= Number(debtMin)) && (!debtMax || item.debt <= Number(debtMax));
      const statusOk = status === "all" || (status === "active" ? item.active : !item.active);
      return globalMatch && codeMatch && nameMatch && phoneMatch && emailMatch && groupMatch && totalOk && dateOk && debtOk && statusOk;
    });
  }, [items, query, codeQuery, nameQuery, phoneQuery, emailQuery, groupFilter, totalMin, totalMax, dateValue, debtMin, debtMax, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, group: groupFilter === "all" ? "" : groupFilter });
    setShowCreate(true);
  }

  function openEdit(item: Supplier) {
    setEditing(item);
    setForm({ name: item.name, code: item.code, phone: item.phone, email: item.email, address: item.address, area: item.area, ward: item.ward, group: item.group, company: item.company, taxCode: item.taxCode, identity: item.identity, note: item.note });
    setShowCreate(true);
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const payload = {
        name,
        code: form.code.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        area: form.area.trim(),
        ward: form.ward.trim(),
        group: form.group.trim(),
        company: form.company.trim(),
        taxCode: form.taxCode.trim(),
        identity: form.identity.trim(),
        note: form.note.trim(),
      };
      const response = editing
        ? await fetch(`/api/suppliers?id=${encodeURIComponent(editing.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await apiError(response));
      setShowCreate(false);
      setEditing(null);
      setForm(emptyForm);
      await loadSuppliers();
      setNotice({ kind: "success", text: editing ? "Đã cập nhật nhà cung cấp." : "Đã thêm nhà cung cấp." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể lưu nhà cung cấp." });
    } finally {
      setBusy(false);
    }
  }

  function exportExcel() {
    const rows = filtered.map((item) => [item.code, item.name, item.phone, item.email, item.address, item.group, item.active ? "Đang hoạt động" : "Ngừng hoạt động"]);
    const sheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "NhaCungCap");
    XLSX.writeFile(workbook, `NhaCungCap_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`);
    setNotice({ kind: "success", text: `Đã xuất ${filtered.length} nhà cung cấp ra file Excel.` });
  }

  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([["Mã", "Tên", "Điện thoại", "Email", "Địa chỉ", "Nhóm"], ["NCC000001", "Tên nhà cung cấp ví dụ", "0900000000", "email@gmail.com", "Nhập địa chỉ", "Nhóm mặc định"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "MauNhaCungCap");
    XLSX.writeFile(workbook, "MauNhaCungCap.xlsx");
  }

  async function importExcel() {
    const file = importInput.current?.files?.[0];
    if (!file) { setNotice({ kind: "error", text: "Vui lòng chọn tệp Excel." }); return; }
    setBusy(true);
    setNotice(null);
    try {
      const workbook = /\.csv$/i.test(file.name) ? XLSX.read(await file.text(), { type: "string" }) : XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }).slice(1);
      const byCode = new Map(items.map((item) => [item.code.trim().toLowerCase(), item]));
      const byName = new Map(items.map((item) => [item.name.trim().toLowerCase(), item]));
      let created = 0;
      let updated = 0;
      const failed: string[] = [];
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        const code = String(row[0] ?? "").trim();
        const name = String(row[1] ?? "").trim();
        if (!code && !name) continue;
        const phone = String(row[2] ?? "").trim();
        const email = String(row[3] ?? "").trim();
        const address = String(row[4] ?? "").trim();
        const group = String(row[5] ?? "").trim();
        const existing = (code && byCode.get(code.toLowerCase())) || (name && byName.get(name.toLowerCase()));
        if (existing) {
          try {
            const response = await fetch(`/api/suppliers?id=${encodeURIComponent(existing.id)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code, name: name || existing.name, phone, email, address, group }),
            });
            if (!response.ok) throw new Error(await apiError(response));
          } catch {
            // fallback: update locally only
          }
          setItems((current) => current.map((item) => item.id === existing.id ? { ...item, code: code || item.code, name: name || item.name, phone: phone || item.phone, email: email || item.email, address: address || item.address, group: group || item.group } : item));
          updated += 1;
        } else {
          try {
            const response = await fetch("/api/suppliers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: name || "Nhà cung cấp mới", code, phone, email, address, group }),
            });
            if (!response.ok) throw new Error(await apiError(response));
            created += 1;
          } catch {
            failed.push(name || code || "Nhà cung cấp");
          }
        }
      }
      if (!created && !updated && !failed.length) throw new Error("Không tìm thấy dữ liệu nhà cung cấp hợp lệ trong file.");
      await loadSuppliers();
      setModal(null);
      if (importInput.current) importInput.current.value = "";
      const message = `Đã nhập ${created + updated} nhà cung cấp (${updated} cập nhật, ${created} mới).` + (failed.length ? ` ${failed.length} dòng không lưu được: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}` : "");
      setNotice({ kind: failed.length ? "error" : "success", text: message });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không thể nhập file nhà cung cấp." });
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) importExcel();
  }

  function addGroup() {
    const name = newGroup.trim();
    if (!name) return;
    setCustomGroups((current) => current.includes(name) ? current : [...current, name]);
    setGroupFilter(name);
    setNewGroup("");
    setShowGroup(false);
  }

  const cell = (item: Supplier, key: ColumnKey) => {
    if (key === "code") return <button type="button" className="purchase-link supplier-code" onClick={() => openEdit(item)}>{item.code || "---"}</button>;
    if (key === "name") return <b className="supplier-name">{item.name || "---"}</b>;
    if (key === "debt" || key === "totalPurchase") return money(item[key]);
    return item[key] || "---";
  };

  return <div className="kv-shell product-page suppliers-page">
    <ManagementHeader profile={profile} active="suppliers" />
    {notice && <div className={`product-notice suppliers-notice ${notice.kind === "error" ? "error" : ""}`} role={notice.kind === "error" ? "alert" : "status"}><span>{notice.text}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)}>×</button></div>}
    <div className="product-actions suppliers-actions">
      <h1>Nhà cung cấp</h1>
      <div className="suppliers-search"><label className="product-query"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Theo mã, tên, số điện thoại, email" /></label></div>
      <div className="product-toolbar suppliers-toolbar">
        <button type="button" className="supplier-tool primary" title="Thêm nhà cung cấp" aria-label="Thêm nhà cung cấp" onClick={openCreate}><Plus /></button>
        <button type="button" className="supplier-tool" title="Import file" aria-label="Import file" onClick={() => setModal("import")}><ImportFileIcon /></button>
        <button type="button" className="supplier-tool" title="Xuất file" aria-label="Xuất file" onClick={exportExcel}><ExportFileIcon /></button>
        <button type="button" className="supplier-tool" title="Thiết lập" aria-label="Thiết lập" onClick={() => setModal("settings")}><Settings /></button>
        <button type="button" className="supplier-tool" title="Hướng dẫn" aria-label="Hướng dẫn" onClick={() => setModal("help")}><HelpCircle /></button>
      </div>
    </div>
    <main className={`product-workspace suppliers-workspace ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      {sidebarCollapsed
        ? <button type="button" className="sidebar-collapse collapsed" aria-label="Mở bộ lọc" onClick={() => setSidebarCollapsed(false)}><ChevronRight /></button>
        : <aside className="product-filter-sidebar suppliers-sidebar">
          <section><h2>Nhóm nhà cung cấp <button type="button" onClick={() => setShowGroup(true)}>Tạo mới</button></h2><select aria-label="Nhóm nhà cung cấp" value={groupFilter} onChange={(event) => { setGroupFilter(event.target.value); setPage(1); }}><option value="all">Tất cả các nhóm</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select></section>
          <section><h2>Tổng mua</h2><span className="filter-caption">Giá trị</span><div className="supplier-range"><input type="number" min="0" value={totalMin} onChange={(event) => { setTotalMin(event.target.value); setPage(1); }} placeholder="Từ" aria-label="Tổng mua từ" /><input type="number" min="0" value={totalMax} onChange={(event) => { setTotalMax(event.target.value); setPage(1); }} placeholder="Tới" aria-label="Tổng mua tới" /></div></section>
          <section><h2>Thời gian</h2><DateRangePicker value={dateValue} onChange={(value) => { setDateValue(value); setPage(1); }} /></section>
          <section><h2>Nợ hiện tại</h2><div className="supplier-range"><input type="number" min="0" value={debtMin} onChange={(event) => { setDebtMin(event.target.value); setPage(1); }} placeholder="Từ" aria-label="Nợ từ" /><input type="number" min="0" value={debtMax} onChange={(event) => { setDebtMax(event.target.value); setPage(1); }} placeholder="Tới" aria-label="Nợ tới" /></div></section>
          <section><h2>Trạng thái</h2>
            {([["all", "Tất cả"], ["active", "Đang hoạt động"], ["inactive", "Ngừng hoạt động"]] as Array<[StatusFilter, string]>).map(([value, label]) => <label className="stock-radio" key={value}><input type="radio" name="supplier-status" checked={status === value} onChange={() => { setStatus(value); setPage(1); }} /><span>{label}</span></label>)}
          </section>
          <button type="button" className="sidebar-collapse" aria-label="Thu gọn bộ lọc" onClick={() => setSidebarCollapsed(true)}><ChevronLeft /></button>
        </aside>}
      <section className="product-content suppliers-content">
        <div className="product-table suppliers-table">
          <table>
            <thead>
              <tr>
                <th className="row-select"><input type="checkbox" aria-label="Chọn tất cả" /></th>
                <th className="row-star"><Star size={15} /></th>
                {columns.map((column) => <th key={column.key} className={column.numeric ? "number-cell" : ""}>{column.label}</th>)}
              </tr>
              <tr className="suppliers-filter-row">
                <th className="row-select" />
                <th className="row-star" />
                {columns.map((column) => (
                  <th key={column.key} className={column.numeric ? "number-cell" : ""}>
                    {column.key === "code" && <label><Search size={13} /><input value={codeQuery} onChange={(event) => { setCodeQuery(event.target.value); setPage(1); }} placeholder="Mã nhà cung cấp" aria-label="Lọc mã nhà cung cấp" /></label>}
                    {column.key === "name" && <label><Search size={13} /><input value={nameQuery} onChange={(event) => { setNameQuery(event.target.value); setPage(1); }} placeholder="Tên nhà cung cấp" aria-label="Lọc tên nhà cung cấp" /></label>}
                    {column.key === "phone" && <label><Search size={13} /><input value={phoneQuery} onChange={(event) => { setPhoneQuery(event.target.value); setPage(1); }} placeholder="Điện thoại" aria-label="Lọc điện thoại" /></label>}
                    {column.key === "email" && <label><Search size={13} /><input value={emailQuery} onChange={(event) => { setEmailQuery(event.target.value); setPage(1); }} placeholder="Email" aria-label="Lọc email" /></label>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !items.length ? <tr><td colSpan={columns.length + 2}><div className="product-empty suppliers-empty"><span className="suppliers-loading">Đang tải nhà cung cấp…</span></div></td></tr>
                : rows.map((item) => <tr className="product-row" key={item.id}>
                  <td className="row-select"><input type="checkbox" aria-label={`Chọn ${item.name}`} /></td>
                  <td className="row-star"><button type="button" aria-label="Đánh dấu" onClick={() => setItems((current) => current.map((row) => row.id === item.id ? { ...row, favorite: !row.favorite } : row))}><Star size={16} fill={item.favorite ? "#f5a623" : "none"} color={item.favorite ? "#f5a623" : "currentColor"} /></button></td>
                  {columns.map((column) => <td key={column.key} className={column.numeric ? "number-cell" : ""}>{cell(item, column.key)}</td>)}
                </tr>)}
              {!loading && !rows.length && <tr><td colSpan={columns.length + 2}><div className="product-empty suppliers-empty"><Search size={42} /><strong>Không tìm thấy kết quả</strong><p>Không có nhà cung cấp phù hợp với bộ lọc hiện tại.</p><button type="button" className="primary" onClick={openCreate}>Thêm nhà cung cấp</button></div></td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="product-pager"><span>Hiển thị {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} nhà cung cấp</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button><button type="button" className="current">{safePage}</button><button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button></div></footer>
      </section>
    </main>
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>

    {showCreate && <div className="modal-backdrop" onMouseDown={() => setShowCreate(false)}><form className="product-modal supplier-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={saveSupplier}>
      <header><div><h2>{editing ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}</h2><p>Thông tin nhà cung cấp và liên hệ</p></div><button type="button" aria-label="Đóng" onClick={() => setShowCreate(false)}><X /></button></header>
      <div className="supplier-modal-body">
        <section className="supplier-section"><h3>Thông tin nhà cung cấp</h3>
          <div className="supplier-grid">
            <label className="supplier-field wide"><span>Tên nhà cung cấp <em>*</em></span><input autoFocus required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nhập tên nhà cung cấp" /></label>
            <label className="supplier-field"><span>Mã nhà cung cấp</span><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="Tự động" /></label>
            <label className="supplier-field"><span>Điện thoại</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Số điện thoại" /></label>
            <label className="supplier-field"><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="email@gmail.com" /></label>
            <label className="supplier-field wide"><span>Địa chỉ</span><input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Nhập địa chỉ" /></label>
            <label className="supplier-field"><span>Khu vực</span><select value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))}><option value="">Chọn Tỉnh/Thành phố</option></select></label>
            <label className="supplier-field"><span>Phường/Xã</span><select value={form.ward} onChange={(event) => setForm((current) => ({ ...current, ward: event.target.value }))}><option value="">Chọn Phường/Xã</option></select></label>
          </div>
        </section>
        <section className="supplier-section"><h3>Nhóm nhà cung cấp, ghi chú</h3>
          <div className="supplier-grid">
            <label className="supplier-field"><span>Nhóm nhà cung cấp</span><select value={form.group} onChange={(event) => setForm((current) => ({ ...current, group: event.target.value }))}><option value="">Chọn nhóm nhà cung cấp</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select></label>
            <label className="supplier-field wide"><span>Ghi chú</span><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Nhập ghi chú" rows={3} /></label>
          </div>
        </section>
        <section className="supplier-section"><h3>Thông tin xuất hóa đơn</h3>
          <div className="supplier-grid">
            <label className="supplier-field"><span>Tên công ty</span><input value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} placeholder="Nhập tên công ty" /></label>
            <label className="supplier-field"><span>Mã số thuế</span><input value={form.taxCode} onChange={(event) => setForm((current) => ({ ...current, taxCode: event.target.value }))} placeholder="Nhập mã số thuế" /></label>
            <label className="supplier-field"><span>Số CCCD/CMND</span><input value={form.identity} onChange={(event) => setForm((current) => ({ ...current, identity: event.target.value }))} placeholder="Nhập số CCCD/CMND" /></label>
          </div>
        </section>
      </div>
      <footer><span /><button type="button" onClick={() => setShowCreate(false)}>Bỏ qua</button><button className="primary" disabled={!form.name.trim() || busy}>{busy ? "Đang lưu..." : "Lưu"}</button></footer>
    </form></div>}

    {modal === "import" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal supplier-modal supplier-import-modal" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><h2>Thêm nhà cung cấp từ file excel</h2></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header>
      <div className="supplier-import-body">
        <p className="supplier-import-hint">(Tải về file mẫu: <button type="button" className="supplier-link" onClick={downloadTemplate}>Excel file</button>)</p>
        <div className="supplier-file"><FileUp size={22} /><label>Chọn file dữ liệu<input ref={importInput} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={onFileChange} /></label></div>
        <p className="supplier-import-hint">File cần có cột Mã, Tên, Điện thoại, Email, Địa chỉ, Nhóm. Nhà cung cấp đã tồn tại (theo mã hoặc tên) sẽ được cập nhật, nhà cung cấp mới sẽ được tạo.</p>
      </div>
      <footer><button type="button" onClick={() => setModal(null)}>Bỏ qua</button><button type="button" className="primary" disabled={busy} onClick={importExcel}>{busy ? "Đang nhập..." : "Lưu"}</button></footer>
    </section></div>}

    {modal === "settings" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal supplier-modal supplier-small-modal" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><h2>Thiết lập nhà cung cấp</h2><p>Cấu hình hiển thị và mặc định của danh sách nhà cung cấp</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header>
      <div className="supplier-settings"><p className="supplier-settings-note">Các tùy chọn nâng cao (mã nhà cung cấp tự tăng, cảnh báo trùng mã, phân quyền chỉnh sửa công nợ) hiện đang được bật theo mặc định và sẽ được bổ sung trong bản cập nhật tiếp theo.</p></div>
      <footer><span /><button type="button" onClick={() => setModal(null)}>Đóng</button></footer>
    </section></div>}

    {modal === "help" && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="product-modal supplier-modal supplier-small-modal" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><h2>Hướng dẫn nhà cung cấp</h2><p>Quản lý nhà cung cấp và công nợ mua hàng</p></div><button type="button" aria-label="Đóng" onClick={() => setModal(null)}><X /></button></header>
      <div className="supplier-help">
        <h3>Thêm nhà cung cấp</h3><p>Bấm nút <b>＋ Thêm nhà cung cấp</b> trên thanh công cụ, nhập thông tin liên hệ rồi bấm <b>Lưu</b>.</p>
        <h3>Import và xuất file</h3><p>Bấm <b>Import file</b> để thêm hàng loạt nhà cung cấp theo mẫu <b>Excel file</b>; bấm <b>Xuất file</b> để tải danh sách theo bộ lọc hiện tại.</p>
        <h3>Bộ lọc</h3><p>Sử dụng cột bên trái để lọc theo nhóm, tổng mua, thời gian, nợ hiện tại và trạng thái hoạt động.</p>
      </div>
      <footer><button type="button" className="primary" onClick={() => setModal(null)}>Đã hiểu</button></footer>
    </section></div>}

    {showGroup && <div className="modal-backdrop" onMouseDown={() => setShowGroup(false)}><section className="product-modal supplier-modal supplier-group-modal" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><h2>Tạo nhóm nhà cung cấp</h2></div><button type="button" aria-label="Đóng" onClick={() => setShowGroup(false)}><X /></button></header>
      <div className="supplier-group-body"><label>Tên nhóm<input autoFocus value={newGroup} onChange={(event) => setNewGroup(event.target.value)} placeholder="Nhập tên nhóm nhà cung cấp" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addGroup(); } }} /></label></div>
      <footer><button type="button" onClick={() => setShowGroup(false)}>Bỏ qua</button><button type="button" className="primary" disabled={!newGroup.trim()} onClick={addGroup}>Lưu</button></footer>
    </section></div>}
  </div>;
}
