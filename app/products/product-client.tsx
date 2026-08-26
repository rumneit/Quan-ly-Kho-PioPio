"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, ChevronDown, Columns3, Download, FileDown, FileUp, HelpCircle, ImageIcon, Plus, Search, Settings, SlidersHorizontal, Upload } from "lucide-react";
import type { Profile } from "@/lib/auth";
import ManagementHeader from "@/app/management-header";
import ProductFilterSidebar from "./product-filter-sidebar";
import { DEFAULT_FILTERS, FilterOption, Product, ProductFilters } from "./product-types";

type NewProduct = { name: string; sku: string; price: string; cost: string; stock: string; category_id: string; supplier_id: string; product_type: "product" | "service" | "combo"; description: string };
type ColumnKey = "image" | "sku" | "name" | "category" | "type" | "linked" | "price" | "cost" | "brand" | "stock" | "location" | "reserved" | "created" | "expected" | "minStock" | "maxStock" | "status";
type SortKey = "sku" | "name" | "price" | "stock_quantity";
const PAGE_SIZE = 10;
const COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: "image", label: "Hình ảnh" }, { key: "sku", label: "Mã hàng" }, { key: "name", label: "Tên hàng" }, { key: "category", label: "Nhóm hàng" },
  { key: "type", label: "Loại hàng" }, { key: "linked", label: "Liên kết kênh bán" }, { key: "price", label: "Giá bán" }, { key: "cost", label: "Giá vốn" },
  { key: "brand", label: "Thương hiệu" }, { key: "stock", label: "Tồn kho" }, { key: "location", label: "Vị trí" }, { key: "reserved", label: "Khách đặt" },
  { key: "created", label: "Thời gian tạo" }, { key: "expected", label: "Dự kiến hết hàng" }, { key: "minStock", label: "Định mức tồn ít nhất" },
  { key: "maxStock", label: "Định mức tồn nhiều nhất" }, { key: "status", label: "Trạng thái" },
];
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const dateTime = (value?: string | null) => {
  if (!value) return "---";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "---" : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(parsed);
};

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

function csvEscape(cell: unknown) {
  return `"${String(cell ?? "").replaceAll('"', '""')}"`;
}

function parseCsvLine(line: string): string[] {
  return Array.from(line.matchAll(/(?:^|,)("(?:""|[^"])*"|[^,]*)/g)).map((m) => m[1].replace(/^"|"$/g, "").replaceAll('""', '"'));
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function ProductClient({ profile, initialProducts, initialCategories = [], initialSuppliers = [] }: { profile: Profile; initialProducts: Product[]; initialCategories?: FilterOption[]; initialSuppliers?: FilterOption[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [categoryOptions, setCategoryOptions] = useState(initialCategories);
  const [supplierOptions] = useState(initialSuppliers);
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProduct>({ name: "", sku: "", price: "", cost: "", stock: "0", category_id: "", supplier_id: "", product_type: "product", description: "" });
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({ image: true, sku: true, name: true, category: false, type: false, linked: false, price: true, cost: true, brand: false, stock: true, location: false, reserved: true, created: true, expected: true, minStock: false, maxStock: false, status: false });
  const [importMode, setImportMode] = useState<"skip" | "update">("skip");
  const [importPreview, setImportPreview] = useState<Array<Record<string, string>>>([]);
  const [importFileName, setImportFileName] = useState("");
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
    const descriptiveText = `${product.description || ""} ${product.note || ""}`.toLowerCase().includes(noteQuery.trim().toLowerCase());
    const status = filters.status === "all" || (filters.status === "active" ? product.active : !product.active);
    const category = !filters.categoryIds.length || Boolean(product.category_id && filters.categoryIds.includes(product.category_id));
    const supplier = !filters.supplierIds.length || Boolean(product.supplier_id && filters.supplierIds.includes(product.supplier_id));
    const type = filters.productType === "all" || (product.product_type || "product") === filters.productType;
    const direct = filters.directSale === "all" || (product.direct_sale ?? true) === (filters.directSale === "yes");
    const linked = filters.linkedSaleChannel === "all" || (product.linked_sale_channel ?? false) === (filters.linkedSaleChannel === "yes");
    const created = filters.createdPreset === "all" || dateInRange(product.created_at, filters.createdFrom, filters.createdTo);
    const expected = filters.expectedPreset === "all" || dateInRange(product.expected_out_of_stock_at, filters.expectedFrom, filters.expectedTo);
    return text && descriptiveText && status && category && supplier && type && direct && linked && created && expected && matchesInventory(product, filters);
  }).sort((a, b) => { const av = a[sort.key], bv = b[sort.key]; const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "vi"); return sort.direction === "asc" ? result : -result; }), [products, query, noteQuery, filters, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const updateFilters = (next: ProductFilters) => { setFilters(next); setPage(1); setSelected([]); };
  const sortBy = (key: SortKey) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const sortMark = (key: SortKey) => sort.key === key ? (sort.direction === "asc" ? " ↑" : " ↓") : "";

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setNotice("");
    const payload = {
      name: newProduct.name.trim(),
      sku: newProduct.sku.trim() || `HH-${Date.now().toString().slice(-6)}`,
      price: Number(newProduct.price || 0),
      cost: Number(newProduct.cost || 0),
      stock: Number(newProduct.stock || 0),
      category_id: newProduct.category_id || null,
      supplier_id: newProduct.supplier_id || null,
      product_type: newProduct.product_type,
      description: newProduct.description.trim() || null,
    };
    const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setNotice(result.error || "Không thể lưu hàng hóa."); return; }
    const enriched = result.product as Product;
    // hydrate category_name/supplier_name for table
    const cat = categoryOptions.find((c) => c.id === newProduct.category_id)?.name || null;
    const sup = supplierOptions.find((s) => s.id === newProduct.supplier_id)?.name || null;
    setProducts((current) => [{ ...enriched, category_name: cat, supplier_name: sup } as Product, ...current]);
    setNewProduct({ name: "", sku: "", price: "", cost: "", stock: "0", category_id: "", supplier_id: "", product_type: "product", description: "" });
    setShowCreate(false); setPage(1); setNotice("Đã tạo hàng hóa mới.");
  }

  async function createCategory(name: string, parentId?: string, description?: string) {
    const response = await fetch("/api/product-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parentId, description }) });
    const result = await response.json();
    if (response.ok) { setCategoryOptions((current) => [...current, result.category].sort((a, b) => a.name.localeCompare(b.name, "vi"))); setNotice(`Đã tạo nhóm ${name}.`); }
    else setNotice(result.error || "Không thể tạo nhóm hàng.");
  }

  // === XUẤT FILE (giống KiotViet: xuất theo bộ lọc, đầy đủ cột, UTF-8 BOM) ===
  function exportCsv() {
    if (!filtered.length) { setNotice("Không có dữ liệu để xuất."); return; }
    const headers = ["Mã hàng", "Tên hàng", "Nhóm hàng", "Loại hàng", "Giá bán", "Giá vốn", "Tồn kho", "Nhà cung cấp", "Mô tả", "Trạng thái", "Ngày tạo"];
    const typeLabel = (t?: string) => t === "service" ? "Dịch vụ" : t === "combo" ? "Combo" : "Hàng hóa";
    const lines = [
      headers.map(csvEscape).join(","),
      ...filtered.map((p) => [
        p.sku, p.name, p.category_name || "", typeLabel(p.product_type), p.price, p.cost ?? 0, p.stock_quantity, p.supplier_name || "", (p.description || p.note || ""), p.active ? "Đang kinh doanh" : "Ngừng kinh doanh", p.created_at ? new Date(p.created_at).toLocaleDateString("vi-VN") : ""
      ].map(csvEscape).join(",")),
    ];
    const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    link.download = `hang-hoa-${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`Đã xuất ${filtered.length} hàng hóa ra CSV (UTF-8). Mở bằng Excel sẽ hiển thị tiếng Việt đúng.`);
  }

  function downloadTemplate() {
    const headers = ["Mã hàng", "Tên hàng*", "Nhóm hàng", "Loại hàng (product/service/combo)", "Giá bán", "Giá vốn", "Tồn kho", "Mô tả"];
    const sample = [
      ["SP001", "Cà phê đen đá", "Đồ uống", "product", "25000", "15000", "100", "Mẫu 1"],
      ["SP002", "Bạc sỉu", "Đồ uống", "product", "30000", "18000", "50", "Mẫu 2"],
      ["DV001", "Phí ship", "", "service", "15000", "0", "0", "Dịch vụ"],
    ];
    const lines = [headers.map(csvEscape).join(","), ...sample.map((r) => r.map(csvEscape).join(","))];
    const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mau-import-hang-hoa.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // === IMPORT FILE ===
  async function handleFileChange(file: File | undefined) {
    if (!file) return;
    setImportFileName(file.name);
    // If xlsx/xls, hint user - but try to read as text if possible
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      setNotice("File Excel (.xlsx/.xls): vui lòng mở bằng Excel và Lưu thành CSV UTF-8 rồi chọn lại, hoặc hệ thống sẽ cố gắng đọc như CSV.");
    }
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length < 2) { setNotice("Tệp chưa có dữ liệu (cần dòng tiêu đề + ít nhất 1 dòng)."); return; }
      const headers = parseCsvLine(lines[0]).map(normalizeHeader);
      // map flexible headers
      const idx = {
        sku: headers.findIndex((h) => ["mã hàng", "ma hang", "sku", "mã"].includes(h)),
        name: headers.findIndex((h) => ["tên hàng", "ten hang", "tên hàng*", "name"].includes(h)),
        category: headers.findIndex((h) => ["nhóm hàng", "nhom hang", "category", "nhóm"].includes(h)),
        type: headers.findIndex((h) => h.includes("loại hàng") || h === "type" || h === "product_type"),
        price: headers.findIndex((h) => ["giá bán", "gia ban", "price"].includes(h)),
        cost: headers.findIndex((h) => ["giá vốn", "gia von", "cost", "giá nhập"].includes(h)),
        stock: headers.findIndex((h) => ["tồn kho", "ton kho", "stock", "số lượng", "tồn"].includes(h)),
        desc: headers.findIndex((h) => ["mô tả", "mo ta", "ghi chú", "description", "note"].includes(h)),
      };
      if (idx.name === -1) { setNotice("Không tìm thấy cột 'Tên hàng' trong file. Vui lòng tải file mẫu."); return; }
      const preview: Array<Record<string, string>> = [];
      for (const line of lines.slice(1, 6)) {
        const cells = parseCsvLine(line);
        preview.push({
          sku: idx.sku >= 0 ? (cells[idx.sku] || "") : "",
          name: cells[idx.name] || "",
          category: idx.category >= 0 ? (cells[idx.category] || "") : "",
          price: idx.price >= 0 ? (cells[idx.price] || "") : "",
          stock: idx.stock >= 0 ? (cells[idx.stock] || "") : "",
        });
      }
      setImportPreview(preview);
      // store parsed for later import via dataset attribute
      (importInput.current as unknown as { _parsed?: unknown })!._parsed = { headers: idx, lines: lines.slice(1) };
    } catch (e) {
      setNotice("Không đọc được file. Hãy đảm bảo file là CSV UTF-8.");
    }
  }

  async function importCsv() {
    const file = importInput.current?.files?.[0];
    if (!file) { setNotice("Vui lòng chọn tệp CSV."); return; }
    const parsed = (importInput.current as unknown as { _parsed?: { headers: Record<string, number>; lines: string[] } })._parsed;
    if (!parsed) { setNotice("File chưa được phân tích. Vui lòng chọn lại file."); return; }
    const { headers: idx, lines } = parsed;
    const items: Array<Record<string, unknown>> = [];
    const catMap = new Map(categoryOptions.map((c) => [c.name.toLowerCase(), c.id]));
    const supMap = new Map(supplierOptions.map((s) => [s.name.toLowerCase(), s.id]));
    for (const line of lines) {
      if (!line.trim()) continue;
      const cells = parseCsvLine(line);
      const name = (idx.name >= 0 ? cells[idx.name] : "")?.trim();
      if (!name) continue;
      const sku = (idx.sku >= 0 ? cells[idx.sku] : "")?.trim();
      const catName = (idx.category >= 0 ? cells[idx.category] : "")?.trim();
      const typeRaw = (idx.type >= 0 ? cells[idx.type] : "")?.trim().toLowerCase();
      const price = Number((idx.price >= 0 ? cells[idx.price] : "0")?.replace(/[^\d.-]/g, "") || 0);
      const cost = Number((idx.cost >= 0 ? cells[idx.cost] : "0")?.replace(/[^\d.-]/g, "") || 0);
      const stock = Number((idx.stock >= 0 ? cells[idx.stock] : "0")?.replace(/[^\d.-]/g, "") || 0);
      const desc = (idx.desc >= 0 ? cells[idx.desc] : "")?.trim();
      items.push({
        sku: sku || undefined,
        name,
        price: Number.isFinite(price) ? price : 0,
        cost: Number.isFinite(cost) ? cost : 0,
        stock: Number.isFinite(stock) ? Math.trunc(stock) : 0,
        category_id: catName ? (catMap.get(catName.toLowerCase()) || null) : null,
        supplier_id: null, // can extend mapping if needed
        product_type: ["service", "combo", "product"].includes(typeRaw) ? typeRaw : "product",
        description: desc || null,
      });
    }
    if (!items.length) { setNotice("Không có dòng hợp lệ để import."); return; }
    setSaving(true);
    const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, mode: importMode }) });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) { setNotice(result.error || "Import thất bại."); return; }
    const newProds = (result.products || []) as Product[];
    // enrich category names
    const catReverse = new Map(categoryOptions.map((c) => [c.id, c.name] as const));
    const enriched = newProds.map((p) => ({ ...p, category_name: p.category_id ? (catReverse.get(p.category_id) || null) : null } as Product));
    setProducts((cur) => [...enriched, ...cur]);
    setShowImport(false); setImportPreview([]); setImportFileName(""); if (importInput.current) importInput.current.value = "";
    const msg = `Import xong: thêm ${result.inserted}, cập nhật ${result.updated}, bỏ qua ${result.skipped}.` + (result.errors?.length ? ` Lỗi ${result.errors.length} dòng.` : "");
    setNotice(msg);
  }

  async function bulkStatus(active: boolean) {
    const response = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, active }) });
    if (!response.ok) { setNotice("Không thể cập nhật hàng hóa đã chọn."); return; }
    setProducts((current) => current.map((item) => selected.includes(item.id) ? { ...item, active } : item)); setSelected([]); setNotice("Đã cập nhật trạng thái hàng hóa.");
  }

  const checkedAll = rows.length > 0 && rows.every((item) => selected.includes(item.id));
  // close create dropdown when clicking outside - KiotViet behavior
  useEffect(() => {
    if (!showCreateMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".kv-create-wrap")) setShowCreateMenu(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showCreateMenu]);

  return <div className="kv-shell product-page">
    <ManagementHeader profile={profile} active="products" />
    <div className="product-actions">
      <h1>Hàng hóa</h1>
      <div className="product-actions-center">
        <div className="product-query-wrap"><label className="product-query"><Search size={16} strokeWidth={2} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Theo mã, tên hàng" /></label><button className={`advanced-search-toggle ${showAdvancedSearch ? "active" : ""}`} type="button" aria-label="Tìm kiếm nâng cao" aria-expanded={showAdvancedSearch} onClick={() => setShowAdvancedSearch((value) => !value)}><SlidersHorizontal size={14} /></button>{showAdvancedSearch && <div className="advanced-search-popover"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Theo mã, tên hàng" /><input value={noteQuery} onChange={(event) => setNoteQuery(event.target.value)} placeholder="Theo ghi chú, mô tả hàng hóa" /><footer><button type="button" onClick={() => { setPage(1); setShowAdvancedSearch(false); }}>Tìm kiếm</button></footer></div>}</div>
      </div>
      <div className="product-toolbar kv-toolbar-100">
        <div className="kv-create-wrap">
          <button className="kv-btn kv-btn-create" type="button" aria-expanded={showCreateMenu} onClick={() => setShowCreateMenu((v) => !v)}><Plus size={13} strokeWidth={2.4} /><span>Tạo mới</span><ChevronDown size={13} strokeWidth={2.2} className={`kv-caret ${showCreateMenu ? "open" : ""}`} /></button>
          {showCreateMenu && <div className="kv-dropdown">
            <button type="button" onClick={() => { setNewProduct((p) => ({ ...p, product_type: "product" })); setShowCreate(true); setShowCreateMenu(false); }}>Hàng hóa</button>
            <button type="button" onClick={() => { setNewProduct((p) => ({ ...p, product_type: "service" })); setShowCreate(true); setShowCreateMenu(false); }}>Dịch vụ</button>
            <button type="button" onClick={() => { setNewProduct((p) => ({ ...p, product_type: "combo" })); setShowCreate(true); setShowCreateMenu(false); }}>Combo - đóng gói</button>
          </div>}
        </div>
        <button type="button" className="kv-btn kv-btn-file" onClick={() => { setShowImport(true); setImportPreview([]); setImportFileName(""); }}><FileUp size={13} strokeWidth={2} />Import file</button>
        <button type="button" className="kv-btn kv-btn-file" onClick={exportCsv}><Download size={13} strokeWidth={2} />Xuất file</button>
        <div className="column-control"><button type="button" className="kv-btn-icon" aria-label="Chọn cột" aria-expanded={showColumns} onClick={() => setShowColumns((value) => !value)}><Columns3 size={14} strokeWidth={2} /></button>{showColumns && <div className="columns-popover">{COLUMNS.map((column) => <label key={column.key}><input type="checkbox" checked={visible[column.key]} onChange={() => setVisible((current) => ({ ...current, [column.key]: !current[column.key] }))} />{column.label}</label>)}</div>}</div>
        <button type="button" className="kv-btn-icon" aria-label="Cài đặt bảng"><Settings size={14} strokeWidth={2} /></button>
        <button type="button" className="kv-btn-icon" aria-label="Trợ giúp"><HelpCircle size={14} strokeWidth={2} /></button>
      </div>
    </div>
    <main className={`product-workspace ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      <ProductFilterSidebar filters={filters} categories={categories} suppliers={suppliers} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} onChange={updateFilters} onCreateCategory={createCategory} />
      <section className="product-content">
        {notice && <div className="product-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
        {selected.length > 0 && <div className="bulk-bar"><CheckSquare size={19} /><b>{selected.length} hàng đã chọn</b><button type="button" onClick={() => bulkStatus(true)}>Đang kinh doanh</button><button type="button" onClick={() => bulkStatus(false)}>Ngừng kinh doanh</button><button type="button" onClick={() => setSelected([])}>Bỏ chọn</button></div>}
        <div className="product-table"><table><thead><tr><th><input aria-label="Chọn tất cả hàng trên trang" type="checkbox" checked={checkedAll} onChange={(event) => setSelected(event.target.checked ? Array.from(new Set([...selected, ...rows.map((item) => item.id)])) : selected.filter((id) => !rows.some((item) => item.id === id)))} /></th>{visible.image && <th>Hình ảnh</th>}{visible.sku && <th><button onClick={() => sortBy("sku")}>Mã hàng{sortMark("sku")}</button></th>}{visible.name && <th><button onClick={() => sortBy("name")}>Tên hàng{sortMark("name")}</button></th>}{visible.category && <th>Nhóm hàng</th>}{visible.type && <th>Loại hàng</th>}{visible.linked && <th>Liên kết kênh bán</th>}{visible.price && <th><button onClick={() => sortBy("price")}>Giá bán{sortMark("price")}</button></th>}{visible.cost && <th>Giá vốn</th>}{visible.brand && <th>Thương hiệu</th>}{visible.stock && <th><button onClick={() => sortBy("stock_quantity")}>Tồn kho{sortMark("stock_quantity")}</button></th>}{visible.location && <th>Vị trí</th>}{visible.reserved && <th>Khách đặt</th>}{visible.created && <th>Thời gian tạo</th>}{visible.expected && <th>Dự kiến hết hàng</th>}{visible.minStock && <th>Định mức tồn ít nhất</th>}{visible.maxStock && <th>Định mức tồn nhiều nhất</th>}{visible.status && <th>Trạng thái</th>}</tr></thead><tbody>
          {rows.map((product) => <ProductRow key={product.id} product={product} visible={visible} selected={selected.includes(product.id)} expanded={expanded === product.id} onSelect={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} onExpand={() => setExpanded(expanded === product.id ? null : product.id)} />)}
          {!rows.length && <tr><td colSpan={COLUMNS.filter((column) => visible[column.key]).length + 1}><div className="product-empty"><ImageIcon size={48} /><strong>Không có hàng hóa phù hợp bộ lọc</strong><p>Thử thay đổi điều kiện tìm kiếm hoặc đặt lại bộ lọc.</p><button type="button" onClick={() => updateFilters(DEFAULT_FILTERS)}>Xóa bộ lọc</button></div></td></tr>}
        </tbody></table></div>
        <footer className="product-pager"><span>Hiển thị {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} hàng hóa</span><div><button disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, safePage - 3), safePage + 2).map((number) => <button key={number} className={safePage === number ? "current" : ""} onClick={() => setPage(number)}>{number}</button>)}<button disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button></div></footer>
      </section>
    </main>
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>
    {showCreate && <div className="modal-backdrop" onClick={() => setShowCreate(false)}><form className="product-modal" onClick={(e) => e.stopPropagation()} onSubmit={createProduct}><header><div><h2>{newProduct.product_type === "service" ? "Thêm dịch vụ" : newProduct.product_type === "combo" ? "Thêm combo" : "Thêm hàng hóa"}</h2><p>Hàng hóa được lưu vào cơ sở dữ liệu — giống KiôtViệt</p></div><button type="button" onClick={() => setShowCreate(false)}>×</button></header><div className="product-form">
      <label>Tên hàng hóa *<input autoFocus required value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="VD: Cà phê đen" /></label>
      <div className="form-row"><label>Mã hàng<input value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} placeholder="Tự sinh nếu để trống" /></label><label>Loại hàng<select value={newProduct.product_type} onChange={(e) => setNewProduct({ ...newProduct, product_type: e.target.value as NewProduct["product_type"] })}><option value="product">Hàng hóa</option><option value="service">Dịch vụ</option><option value="combo">Combo - đóng gói</option></select></label></div>
      <div className="form-row"><label>Nhóm hàng<select value={newProduct.category_id} onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}><option value="">— Chọn nhóm —</option>{categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Nhà cung cấp<select value={newProduct.supplier_id} onChange={(e) => setNewProduct({ ...newProduct, supplier_id: e.target.value })}><option value="">— Chọn NCC —</option>{supplierOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
      <div className="form-row"><label>Giá bán<input type="number" min="0" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="0" /></label><label>Giá vốn<input type="number" min="0" value={newProduct.cost} onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })} placeholder="0" /></label></div>
      <label>Tồn kho<input type="number" min="0" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} /></label>
      <label>Mô tả / Ghi chú<textarea rows={2} value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="Ghi chú nội bộ..." style={{ height: 72, padding: 10, border: "1px solid #d5dde6", borderRadius: 9 }} /></label>
    </div><footer><button type="button" onClick={() => setShowCreate(false)}>Hủy</button><button className="primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></footer></form></div>}
    {showImport && <div className="modal-backdrop" onClick={() => setShowImport(false)}><section className="product-modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(720px, 100%)" }}><header><div><h2>Import hàng hóa</h2><p>Nhập hàng loạt từ file — tương tự KiotViet (CSV UTF-8, hỗ trợ Excel lưu thành CSV)</p></div><button type="button" onClick={() => setShowImport(false)}>×</button></header><div className="product-form">
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button type="button" onClick={downloadTemplate} style={{ display: "flex", alignItems: "center", gap: 7, height: 42, padding: "0 14px", border: "1px solid #d5dde6", borderRadius: 8, background: "#fff", fontWeight: 600 }}><FileDown size={16} /> Tải file mẫu</button>
        <span style={{ alignSelf: "center", color: "#677482", fontSize: 13 }}>Mẫu gồm: Mã hàng, Tên hàng*, Nhóm hàng, Loại hàng, Giá bán, Giá vốn, Tồn kho, Mô tả</span>
      </div>
      <label style={{ border: "1.5px dashed #b9c4d2", borderRadius: 10, padding: 18, display: "grid", placeItems: "center", gap: 8, background: "#fbfcfd", cursor: "pointer" }}>
        <Upload size={22} color="#0878f9" />
        <span style={{ fontWeight: 600 }}>{importFileName || "Kéo thả hoặc bấm để chọn file"}</span>
        <span style={{ color: "#8b96a5", fontSize: 13 }}>Chấp nhận .csv (khuyến nghị UTF-8). File .xlsx vui lòng Save As → CSV UTF-8 trước khi import</span>
        <input ref={importInput} type="file" accept=".csv,.xlsx,.xls,text/csv" style={{ display: "none" }} onChange={(e) => handleFileChange(e.target.files?.[0])} />
        <button type="button" onClick={() => importInput.current?.click()} style={{ marginTop: 6, height: 36, padding: "0 14px", border: "1px solid #0878f9", borderRadius: 7, background: "#fff", color: "#0878f9", fontWeight: 600 }}>Chọn file</button>
      </label>
      {importPreview.length > 0 && <div style={{ marginTop: 14, border: "1px solid #e3e7ec", borderRadius: 9, overflow: "hidden" }}>
        <div style={{ padding: "9px 12px", background: "#f5f7f9", fontWeight: 700, fontSize: 13 }}>Xem trước 5 dòng đầu</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr style={{ background: "#fff" }}><th style={{ textAlign: "left", padding: "7px 10px", borderBottom: "1px solid #e8edf2" }}>Mã</th><th style={{ textAlign: "left", padding: "7px 10px", borderBottom: "1px solid #e8edf2" }}>Tên</th><th style={{ textAlign: "left", padding: "7px 10px", borderBottom: "1px solid #e8edf2" }}>Nhóm</th><th style={{ textAlign: "right", padding: "7px 10px", borderBottom: "1px solid #e8edf2" }}>Giá</th><th style={{ textAlign: "right", padding: "7px 10px", borderBottom: "1px solid #e8edf2" }}>Tồn</th></tr></thead><tbody>{importPreview.map((r, i) => <tr key={i}><td style={{ padding: "6px 10px" }}>{r.sku}</td><td style={{ padding: "6px 10px" }}>{r.name}</td><td style={{ padding: "6px 10px" }}>{r.category}</td><td style={{ padding: "6px 10px", textAlign: "right" }}>{r.price}</td><td style={{ padding: "6px 10px", textAlign: "right" }}>{r.stock}</td></tr>)}</tbody></table>
      </div>}
      <div style={{ marginTop: 14, display: "flex", gap: 16, fontSize: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 400 }}><input type="radio" checked={importMode === "skip"} onChange={() => setImportMode("skip")} /> Bỏ qua hàng trùng mã</label>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 400 }}><input type="radio" checked={importMode === "update"} onChange={() => setImportMode("update")} /> Cập nhật hàng trùng mã</label>
      </div>
      <p className="import-hint" style={{ marginTop: 10 }}>Lưu ý: Cột <b>Tên hàng</b> là bắt buộc. Nhóm hàng phải khớp tên đã có trong hệ thống, nếu không sẽ để trống.</p>
    </div><footer><button type="button" onClick={() => setShowImport(false)}>Hủy</button><button className="primary" type="button" disabled={saving || !importFileName} onClick={importCsv}>{saving ? "Đang import..." : `Nhập ${importPreview.length ? `(${importPreview.length}+ dòng)` : "file"}`}</button></footer></section></div>}
  </div>;
}

function ProductRow({ product, visible, selected, expanded, onSelect, onExpand }: { product: Product; visible: Record<ColumnKey, boolean>; selected: boolean; expanded: boolean; onSelect: () => void; onExpand: () => void }) {
  const typeName = product.product_type === "service" ? "Dịch vụ" : product.product_type === "combo" ? "Combo - đóng gói" : "Hàng hóa";
  return <><tr className="product-row"><td><input type="checkbox" aria-label={`Chọn ${product.name}`} checked={selected} onChange={onSelect} /></td>{visible.image && <td><span className="product-thumb"><ImageIcon size={20} /></span></td>}{visible.sku && <td>{product.sku}</td>}{visible.name && <td><button className="product-name" onClick={onExpand}>{product.name}</button></td>}{visible.category && <td>{product.category_name || "—"}</td>}{visible.type && <td>{typeName}</td>}{visible.linked && <td>{product.linked_sale_channel ? "Có" : "Không"}</td>}{visible.price && <td>{money(Number(product.price))}</td>}{visible.cost && <td>{money(Number(product.cost || 0))}</td>}{visible.brand && <td>{product.brand || "—"}</td>}{visible.stock && <td>{product.stock_quantity}</td>}{visible.location && <td>{product.location || "—"}</td>}{visible.reserved && <td>0</td>}{visible.created && <td>{dateTime(product.created_at)}</td>}{visible.expected && <td>{dateTime(product.expected_out_of_stock_at)}</td>}{visible.minStock && <td>{product.min_stock ?? 0}</td>}{visible.maxStock && <td>{product.max_stock ?? 0}</td>}{visible.status && <td><span className={product.active ? "status-active" : "status-inactive"}>{product.active ? "Đang kinh doanh" : "Ngừng kinh doanh"}</span></td>}</tr>{expanded && <tr className="product-detail"><td colSpan={COLUMNS.filter((column) => visible[column.key]).length + 1}><nav><button className="active">Thông tin</button><button>Mô tả, ghi chú</button><button>Thẻ kho</button><button>Tồn kho</button></nav><div><p><b>Mã hàng:</b> {product.sku}</p><p><b>Giá bán:</b> {money(Number(product.price))}</p><p><b>Giá vốn:</b> {money(Number(product.cost || 0))}</p><p><b>Tồn kho:</b> {product.stock_quantity}</p>{product.description && <p><b>Mô tả:</b> {product.description}</p>}</div></td></tr>}</>;
}
