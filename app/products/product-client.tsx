"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckSquare, Columns3, Download, FileUp, ImageIcon, Search, Settings, ShoppingCart } from "lucide-react";
import type { Profile } from "@/lib/auth";
import ProductFilterSidebar from "./product-filter-sidebar";
import { DEFAULT_FILTERS, FilterOption, Product, ProductFilters } from "./product-types";

type NewProduct = { name: string; sku: string; price: string; stock: string };
type ColumnKey = "image" | "sku" | "name" | "category" | "type" | "price" | "cost" | "stock" | "reserved" | "sellable" | "status";
type SortKey = "sku" | "name" | "price" | "stock_quantity";
const PAGE_SIZE = 10;
const NAV_ITEMS = ["Mua hàng", "Đơn hàng", "Khách hàng", "Nhân viên", "Sổ quỹ", "Báo cáo", "Bán online", "Thuế & Kế toán"];
const COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: "image", label: "Ảnh" }, { key: "sku", label: "Mã hàng" }, { key: "name", label: "Tên hàng" }, { key: "category", label: "Nhóm hàng" },
  { key: "type", label: "Loại hàng" }, { key: "price", label: "Giá bán" }, { key: "cost", label: "Giá vốn" }, { key: "stock", label: "Tồn kho" },
  { key: "reserved", label: "Khách đặt" }, { key: "sellable", label: "Có thể bán" }, { key: "status", label: "Trạng thái" },
];
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

function matchesInventory(product: Product, filters: ProductFilters) {
  const value = product.stock_quantity;
  if (filters.inventoryCriteria === "all") return true;
  if (filters.inventoryCriteria === "below_min") return value <= 5;
  if (filters.inventoryCriteria === "above_min") return value > 100;
  if (filters.inventoryCriteria === "in_stock") return value > 0;
  if (filters.inventoryCriteria === "out_of_stock") return value === 0;
  const min = filters.inventoryMin ?? 0, max = filters.inventoryMax ?? min;
  return filters.inventoryOperator === "=" ? value === min : filters.inventoryOperator === ">" ? value > min : filters.inventoryOperator === ">=" ? value >= min : filters.inventoryOperator === "<" ? value < min : filters.inventoryOperator === "<=" ? value <= min : value >= min && value <= max;
}

function dateInRange(value: string | null | undefined, from?: string, to?: string) {
  if (!from && !to) return true;
  if (!value) return false;
  const date = value.slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}

function filtersFromUrl(): ProductFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  const params = new URLSearchParams(window.location.search);
  return {
    ...DEFAULT_FILTERS,
    categoryIds: params.get("categories")?.split(",").filter(Boolean) || [], supplierIds: params.get("suppliers")?.split(",").filter(Boolean) || [],
    inventoryCriteria: (params.get("stock") as ProductFilters["inventoryCriteria"]) || "all", inventoryOperator: (params.get("stockOp") as ProductFilters["inventoryOperator"]) || "=",
    inventoryMin: params.has("stockMin") ? Number(params.get("stockMin")) : undefined, inventoryMax: params.has("stockMax") ? Number(params.get("stockMax")) : undefined,
    expectedPreset: params.get("expected") || "all", expectedFrom: params.get("expectedFrom") || undefined, expectedTo: params.get("expectedTo") || undefined,
    createdPreset: params.get("created") || "all", createdFrom: params.get("createdFrom") || undefined, createdTo: params.get("createdTo") || undefined,
    productType: (params.get("type") as ProductFilters["productType"]) || "all", directSale: (params.get("direct") as ProductFilters["directSale"]) || "all",
    linkedSaleChannel: (params.get("linked") as ProductFilters["linkedSaleChannel"]) || "all", status: (params.get("status") as ProductFilters["status"]) || "active",
  };
}

export default function ProductClient({ profile, initialProducts, initialCategories = [], initialSuppliers = [] }: { profile: Profile; initialProducts: Product[]; initialCategories?: FilterOption[]; initialSuppliers?: FilterOption[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [categoryOptions, setCategoryOptions] = useState(initialCategories);
  const [supplierOptions] = useState(initialSuppliers);
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProduct>({ name: "", sku: "", price: "", stock: "0" });
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({ image: true, sku: true, name: true, category: true, type: true, price: true, cost: true, stock: true, reserved: true, sellable: true, status: true });
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => { setFilters(filtersFromUrl()); setUrlReady(true); }, []);
  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (filters.categoryIds.length) params.set("categories", filters.categoryIds.join(",")); if (filters.supplierIds.length) params.set("suppliers", filters.supplierIds.join(","));
    if (filters.inventoryCriteria !== "all") params.set("stock", filters.inventoryCriteria); if (filters.inventoryCriteria === "custom") { params.set("stockOp", filters.inventoryOperator); if (filters.inventoryMin !== undefined) params.set("stockMin", String(filters.inventoryMin)); if (filters.inventoryMax !== undefined) params.set("stockMax", String(filters.inventoryMax)); }
    if (filters.expectedPreset !== "all") params.set("expected", filters.expectedPreset); if (filters.expectedFrom) params.set("expectedFrom", filters.expectedFrom); if (filters.expectedTo) params.set("expectedTo", filters.expectedTo);
    if (filters.createdPreset !== "all") params.set("created", filters.createdPreset); if (filters.createdFrom) params.set("createdFrom", filters.createdFrom); if (filters.createdTo) params.set("createdTo", filters.createdTo);
    if (filters.productType !== "all") params.set("type", filters.productType); if (filters.directSale !== "all") params.set("direct", filters.directSale); if (filters.linkedSaleChannel !== "all") params.set("linked", filters.linkedSaleChannel); if (filters.status !== "active") params.set("status", filters.status);
    const search = params.toString(); window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [filters, urlReady]);

  const categories = useMemo<FilterOption[]>(() => categoryOptions.map((item) => ({ ...item, count: products.filter((product) => product.category_id === item.id).length })), [categoryOptions, products]);
  const suppliers = useMemo<FilterOption[]>(() => supplierOptions.map((item) => ({ ...item, count: products.filter((product) => product.supplier_id === item.id).length })), [supplierOptions, products]);
  const filtered = useMemo(() => products.filter((product) => {
    const text = `${product.name} ${product.sku}`.toLowerCase().includes(query.trim().toLowerCase());
    const status = filters.status === "all" || (filters.status === "active" ? product.active : !product.active);
    const category = !filters.categoryIds.length || Boolean(product.category_id && filters.categoryIds.includes(product.category_id));
    const supplier = !filters.supplierIds.length || Boolean(product.supplier_id && filters.supplierIds.includes(product.supplier_id));
    const type = filters.productType === "all" || (product.product_type || "product") === filters.productType;
    const direct = filters.directSale === "all" || (product.direct_sale ?? true) === (filters.directSale === "yes");
    const linked = filters.linkedSaleChannel === "all" || (product.linked_sale_channel ?? false) === (filters.linkedSaleChannel === "yes");
    const created = filters.createdPreset === "all" || dateInRange(product.created_at, filters.createdFrom, filters.createdTo);
    const expected = filters.expectedPreset === "all" || dateInRange(product.expected_out_of_stock_at, filters.expectedFrom, filters.expectedTo);
    return text && status && category && supplier && type && direct && linked && created && expected && matchesInventory(product, filters);
  }).sort((a, b) => { const av = a[sort.key], bv = b[sort.key]; const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "vi"); return sort.direction === "asc" ? result : -result; }), [products, query, filters, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const initials = profile.full_name.split(" ").map((item) => item[0]).slice(-2).join("");
  const updateFilters = (next: ProductFilters) => { setFilters(next); setPage(1); setSelected([]); };
  const sortBy = (key: SortKey) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const sortMark = (key: SortKey) => sort.key === key ? (sort.direction === "asc" ? " ↑" : " ↓") : "";

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setNotice("");
    const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newProduct.name.trim(), sku: newProduct.sku.trim() || `HH-${Date.now().toString().slice(-6)}`, price: Number(newProduct.price || 0), stock: Number(newProduct.stock || 0) }) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setNotice(result.error || "Không thể lưu hàng hóa."); return; }
    setProducts((current) => [result.product, ...current]); setNewProduct({ name: "", sku: "", price: "", stock: "0" }); setShowCreate(false); setPage(1); setNotice("Đã tạo hàng hóa mới.");
  }
  async function createCategory(name: string, parentId?: string, description?: string) {
    const response = await fetch("/api/product-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parentId, description }) });
    const result = await response.json();
    if (response.ok) { setCategoryOptions((current) => [...current, result.category].sort((a, b) => a.name.localeCompare(b.name, "vi"))); setNotice(`Đã tạo nhóm ${name}.`); }
    else setNotice(result.error || "Không thể tạo nhóm hàng.");
  }
  function exportCsv() {
    const lines = ["Mã hàng,Tên hàng,Giá bán,Tồn kho,Trạng thái", ...filtered.map((p) => [p.sku, p.name, p.price, p.stock_quantity, p.active ? "Đang kinh doanh" : "Ngừng kinh doanh"].map((cell) => `\"${String(cell).replaceAll("\"", "\"\"")}\"`).join(","))];
    const url = URL.createObjectURL(new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "hang-hoa.csv"; link.click(); URL.revokeObjectURL(url); setNotice(`Đã xuất ${filtered.length} hàng hóa.`);
  }
  async function importCsv() {
    const file = importInput.current?.files?.[0]; if (!file) { setNotice("Vui lòng chọn tệp CSV."); return; }
    const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean); if (lines.length < 2) { setNotice("Tệp CSV chưa có dữ liệu."); return; }
    const read = (line: string) => Array.from(line.matchAll(/(?:^|,)(\"(?:\"\"|[^\"])*\"|[^,]*)/g)).map((item) => item[1].replace(/^\"|\"$/g, "").replaceAll("\"\"", "\""));
    const added: Product[] = []; let failed = 0; setSaving(true);
    for (const line of lines.slice(1)) { const cells = read(line); const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku: cells[0], name: cells[1], price: Number(cells[2]) || 0, stock: Number(cells[3]) || 0 }) }); const result = await response.json(); if (response.ok) added.push(result.product); else failed += 1; }
    setSaving(false); setShowImport(false); setProducts((current) => [...added, ...current]); setNotice(`Đã import ${added.length} hàng hóa${failed ? `; lỗi ${failed} dòng.` : "."}`);
  }
  async function bulkStatus(active: boolean) {
    const response = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, active }) });
    if (!response.ok) { setNotice("Không thể cập nhật hàng hóa đã chọn."); return; }
    setProducts((current) => current.map((item) => selected.includes(item.id) ? { ...item, active } : item)); setSelected([]); setNotice("Đã cập nhật trạng thái hàng hóa.");
  }

  const checkedAll = rows.length > 0 && rows.every((item) => selected.includes(item.id));
  return <div className="kv-shell product-page">
    <header className="kv-header"><Link className="kv-brand" href="/dashboard"><span className="kv-brand-symbol"><i /><i /></span><strong>PioPio</strong></Link><div className="kv-header-actions"><button className="kv-round" aria-label="Thông báo"><Bell size={20} /></button><button className="kv-round" aria-label="Cài đặt"><Settings size={20} /></button><button className="kv-avatar">{initials}</button></div></header>
    <nav className="kv-horizontal-nav"><div className="kv-horizontal-items"><Link className="kv-top-item" href="/dashboard">Tổng quan</Link><Link className="kv-top-item active" href="/products">Hàng hóa</Link>{NAV_ITEMS.map((item) => <span className="kv-top-item" key={item}>{item}</span>)}</div><Link className="kv-sale-link" href="/sales"><ShoppingCart size={20} />Bán hàng</Link></nav>
    <main className={`product-workspace ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      <ProductFilterSidebar filters={filters} categories={categories} suppliers={suppliers} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} onChange={updateFilters} onCreateCategory={createCategory} />
      <section className="product-content">
        {notice && <div className="product-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
        <div className="product-toolbar">
          <label className="product-query"><Search size={22} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Theo mã, tên hàng" /><Settings size={19} /></label>
          <button className="primary" type="button" onClick={() => setShowCreate(true)}>＋ Tạo mới</button><button type="button" onClick={() => setShowImport(true)}><FileUp size={20} />Import file</button><button type="button" onClick={exportCsv}><Download size={20} />Xuất file</button>
          <div className="column-control"><button type="button" aria-label="Chọn cột" aria-expanded={showColumns} onClick={() => setShowColumns((value) => !value)}><Columns3 size={21} /></button>{showColumns && <div className="columns-popover">{COLUMNS.map((column) => <label key={column.key}><input type="checkbox" checked={visible[column.key]} onChange={() => setVisible((current) => ({ ...current, [column.key]: !current[column.key] }))} />{column.label}</label>)}</div>}</div>
          <button type="button" aria-label="Cài đặt bảng"><Settings size={21} /></button>
        </div>
        {selected.length > 0 && <div className="bulk-bar"><CheckSquare size={19} /><b>{selected.length} hàng đã chọn</b><button type="button" onClick={() => bulkStatus(true)}>Đang kinh doanh</button><button type="button" onClick={() => bulkStatus(false)}>Ngừng kinh doanh</button><button type="button" onClick={() => setSelected([])}>Bỏ chọn</button></div>}
        <div className="product-table"><table><thead><tr><th><input aria-label="Chọn tất cả hàng trên trang" type="checkbox" checked={checkedAll} onChange={(event) => setSelected(event.target.checked ? Array.from(new Set([...selected, ...rows.map((item) => item.id)])) : selected.filter((id) => !rows.some((item) => item.id === id)))} /></th>{visible.image && <th>Ảnh</th>}{visible.sku && <th><button onClick={() => sortBy("sku")}>Mã hàng{sortMark("sku")}</button></th>}{visible.name && <th><button onClick={() => sortBy("name")}>Tên hàng{sortMark("name")}</button></th>}{visible.category && <th>Nhóm hàng</th>}{visible.type && <th>Loại hàng</th>}{visible.price && <th><button onClick={() => sortBy("price")}>Giá bán{sortMark("price")}</button></th>}{visible.cost && <th>Giá vốn</th>}{visible.stock && <th><button onClick={() => sortBy("stock_quantity")}>Tồn kho{sortMark("stock_quantity")}</button></th>}{visible.reserved && <th>Khách đặt</th>}{visible.sellable && <th>Có thể bán</th>}{visible.status && <th>Trạng thái</th>}</tr></thead><tbody>
          {rows.map((product) => <ProductRow key={product.id} product={product} visible={visible} selected={selected.includes(product.id)} expanded={expanded === product.id} onSelect={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} onExpand={() => setExpanded(expanded === product.id ? null : product.id)} />)}
          {!rows.length && <tr><td colSpan={COLUMNS.filter((column) => visible[column.key]).length + 1}><div className="product-empty"><ImageIcon size={48} /><strong>Không có hàng hóa phù hợp bộ lọc</strong><p>Thử thay đổi điều kiện tìm kiếm hoặc đặt lại bộ lọc.</p><button type="button" onClick={() => updateFilters(DEFAULT_FILTERS)}>Xóa bộ lọc</button></div></td></tr>}
        </tbody></table></div>
        <footer className="product-pager"><span>Hiển thị {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} hàng hóa</span><div><button disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, safePage - 3), safePage + 2).map((number) => <button key={number} className={safePage === number ? "current" : ""} onClick={() => setPage(number)}>{number}</button>)}<button disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button></div></footer>
      </section>
    </main>
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>
    {showCreate && <div className="modal-backdrop"><form className="product-modal" onSubmit={createProduct}><header><div><h2>Thêm hàng hóa</h2><p>Hàng hóa được lưu vào cơ sở dữ liệu</p></div><button type="button" onClick={() => setShowCreate(false)}>×</button></header><div className="product-form"><label>Tên hàng hóa<input autoFocus required value={newProduct.name} onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })} /></label><div className="form-row"><label>Mã hàng<input value={newProduct.sku} onChange={(event) => setNewProduct({ ...newProduct, sku: event.target.value })} /></label><label>Giá bán<input type="number" min="0" value={newProduct.price} onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })} /></label></div><label>Tồn kho<input type="number" min="0" value={newProduct.stock} onChange={(event) => setNewProduct({ ...newProduct, stock: event.target.value })} /></label></div><footer><button type="button" onClick={() => setShowCreate(false)}>Hủy</button><button className="primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></footer></form></div>}
    {showImport && <div className="modal-backdrop"><section className="product-modal"><header><div><h2>Import hàng hóa</h2><p>Chọn tệp CSV để thêm hàng hóa vào kho</p></div><button type="button" onClick={() => setShowImport(false)}>×</button></header><div className="product-form"><input ref={importInput} type="file" accept=".csv,text/csv" /><p className="import-hint">Cột mẫu: Mã hàng, Tên hàng, Giá bán, Tồn kho, Trạng thái.</p></div><footer><button type="button" onClick={() => setShowImport(false)}>Hủy</button><button className="primary" type="button" disabled={saving} onClick={importCsv}>{saving ? "Đang import..." : "Xác nhận"}</button></footer></section></div>}
  </div>;
}

function ProductRow({ product, visible, selected, expanded, onSelect, onExpand }: { product: Product; visible: Record<ColumnKey, boolean>; selected: boolean; expanded: boolean; onSelect: () => void; onExpand: () => void }) {
  const typeName = product.product_type === "service" ? "Dịch vụ" : product.product_type === "combo" ? "Combo - đóng gói" : "Hàng hóa";
  return <><tr className="product-row"><td><input type="checkbox" aria-label={`Chọn ${product.name}`} checked={selected} onChange={onSelect} /></td>{visible.image && <td><span className="product-thumb"><ImageIcon size={20} /></span></td>}{visible.sku && <td>{product.sku}</td>}{visible.name && <td><button className="product-name" onClick={onExpand}>{product.name}</button></td>}{visible.category && <td>{product.category_name || "—"}</td>}{visible.type && <td>{typeName}</td>}{visible.price && <td>{money(Number(product.price))}</td>}{visible.cost && <td>{money(Number(product.cost || 0))}</td>}{visible.stock && <td>{product.stock_quantity}</td>}{visible.reserved && <td>0</td>}{visible.sellable && <td>{Math.max(0, product.stock_quantity)}</td>}{visible.status && <td><span className={product.active ? "status-active" : "status-inactive"}>{product.active ? "Đang kinh doanh" : "Ngừng kinh doanh"}</span></td>}</tr>{expanded && <tr className="product-detail"><td colSpan={COLUMNS.filter((column) => visible[column.key]).length + 1}><nav><button className="active">Thông tin</button><button>Mô tả, ghi chú</button><button>Thẻ kho</button><button>Tồn kho</button></nav><div><p><b>Mã hàng:</b> {product.sku}</p><p><b>Giá bán:</b> {money(Number(product.price))}</p><p><b>Tồn kho:</b> {product.stock_quantity}</p></div></td></tr>}</>;
}
