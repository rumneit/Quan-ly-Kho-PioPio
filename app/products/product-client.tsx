"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, ChevronDown, ChevronUp, Columns3, FileDown, HelpCircle, ImageIcon, Info, Plus, Search, Settings, SlidersHorizontal, Tag, Upload, X } from "lucide-react";
import type { Profile } from "@/lib/auth";
import ManagementHeader from "@/app/management-header";
import ProductFilterSidebar from "./product-filter-sidebar";
import { DEFAULT_FILTERS, FilterOption, Product, ProductFilters } from "./product-types";

type NewProduct = { name: string; sku: string; barcode: string; price: string; cost: string; stock: string; category_id: string; supplier_id: string; brand_id: string; branch_id: string; product_type: "product" | "service" | "combo"; description: string; note: string; base_unit: string; sold_by: "quantity" | "weight"; weight: string; warranty_months: string; tax_percent: string; min_stock: string; max_stock: string; location: string };
type UnitRow = { name: string; conversion: string; price: string };
type AttributeRow = { name: string; values: string };
type PriceListRow = { name: string; price: string };
type ComponentRow = { product_id: string; quantity: string };
const EMPTY_PRODUCT: NewProduct = { name: "", sku: "", barcode: "", price: "", cost: "", stock: "0", category_id: "", supplier_id: "", brand_id: "", branch_id: "", product_type: "product", description: "", note: "", base_unit: "Cái", sold_by: "quantity", weight: "", warranty_months: "0", tax_percent: "0", min_stock: "", max_stock: "", location: "" };
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

function ImportFileIcon() {
  return <svg className="kv-file-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v6m9-8 5 5h-5V2ZM5 19v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M2 15h11m-4-4 4 4-4 4" /></svg>;
}

function ExportFileIcon() {
  return <svg className="kv-file-action-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8m-1-20 5 5h-5V2Zm-3 13h11m-4-4 4 4-4 4" /></svg>;
}

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

// Mock gợi ý - y hệt ảnh 4
const SUGGESTED_PRODUCTS = [
  { id: "NSTP00051", name: "Xì dầu càng cua Nhất phẩm 500ml", group: "Thực phẩm khô>Gia vị", price: 0, cost: 0, stock: 0 },
  { id: "NSTP00050", name: "Nước mắm Thanh Hà 520ml", group: "Thực phẩm khô>Gia vị", price: 0, cost: 0, stock: 0 },
  { id: "NSTP00049", name: "Bột chiên giòn Miwon 100g", group: "Thực phẩm khô>Bột các loại", price: 0, cost: 0, stock: 0 },
  { id: "NSTP00048", name: "Măng nứa tươi Kim Bôi 500g", group: "Thực phẩm khô>Thực phẩm đóng gói", price: 0, cost: 0, stock: 0 },
  { id: "NSTP00047", name: "Thịt chưng mắm tép 400g", group: "Thực phẩm khô>Thực phẩm đóng gói", price: 0, cost: 0, stock: 0 },
  { id: "NSTP00026", name: "Há cảo heo thả lẩu Manwah Icook 500gr", group: "Thực phẩm đông lạnh", price: 0, cost: 0, stock: 0 },
  { id: "NSTP00025", name: "Bề bề bóc nõn 300gr", group: "Hải sản", price: 0, cost: 0, stock: 0 },
];

export default function ProductClient({ profile, initialProducts, initialCategories = [], initialSuppliers = [], initialBrands = [], initialBranches = [] }: { profile: Profile; initialProducts: Product[]; initialCategories?: FilterOption[]; initialSuppliers?: FilterOption[]; initialBrands?: FilterOption[]; initialBranches?: FilterOption[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [categoryOptions, setCategoryOptions] = useState(initialCategories);
  const [supplierOptions] = useState(initialSuppliers);
  const [brandOptions, setBrandOptions] = useState(initialBrands);
  const [branchOptions] = useState(initialBranches);
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createTab, setCreateTab] = useState<"info" | "desc">("info");
  const [priceOpen, setPriceOpen] = useState(true);
  const [stockOpen, setStockOpen] = useState(true);
  const [directSale, setDirectSale] = useState(true);
  const [createImages, setCreateImages] = useState<string[]>([]);
  const [productUnits, setProductUnits] = useState<UnitRow[]>([]);
  const [productAttributes, setProductAttributes] = useState<AttributeRow[]>([]);
  const [productPriceLists, setProductPriceLists] = useState<PriceListRow[]>([]);
  const [productComponents, setProductComponents] = useState<ComponentRow[]>([]);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProduct>({ ...EMPTY_PRODUCT, branch_id: initialBranches[0]?.id || "" });
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>({ image: true, sku: true, name: true, category: false, type: false, linked: false, price: true, cost: true, brand: false, stock: true, location: false, reserved: true, created: true, expected: true, minStock: false, maxStock: false, status: false });
  const [importMode, setImportMode] = useState<"skip" | "update">("skip");
  const [importPreview, setImportPreview] = useState<Array<Record<string, string>>>([]);
  const [importFileName, setImportFileName] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  // Import 3-step flow y hệt KiotViet
  const [showImportChooser, setShowImportChooser] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [showSuggested, setShowSuggested] = useState(false);
  const [importExcelOpt1, setImportExcelOpt1] = useState<"error" | "replace">("error");
  const [importExcelOpt2, setImportExcelOpt2] = useState<"error" | "replace">("error");
  const [importExcelOpt3, setImportExcelOpt3] = useState<"no" | "yes">("no");
  const [suggestedQuery, setSuggestedQuery] = useState("");
  const [suggestedCategory, setSuggestedCategory] = useState("all");
  const [selectedSuggested, setSelectedSuggested] = useState<Set<string>>(new Set());
  const [suggestedInputs, setSuggestedInputs] = useState<Record<string, { price: string; cost: string; stock: string }>>({});

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

  async function createProduct(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setSaving(true); setNotice("");
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
      note: newProduct.note.trim() || null,
      barcode: newProduct.barcode.trim() || null,
      brand_id: newProduct.brand_id || null,
      branch_id: newProduct.branch_id || null,
      base_unit: newProduct.base_unit,
      sold_by: newProduct.sold_by,
      weight: newProduct.weight,
      warranty_months: newProduct.warranty_months,
      tax_percent: newProduct.tax_percent,
      min_stock: newProduct.min_stock,
      max_stock: newProduct.max_stock,
      location: newProduct.location,
      images: createImages,
      units: productUnits.filter((unit) => unit.name.trim()).map((unit) => ({ name: unit.name.trim(), conversion: Number(unit.conversion || 1), price: Number(unit.price || 0) })),
      attributes: Object.fromEntries(productAttributes.filter((attribute) => attribute.name.trim()).map((attribute) => [attribute.name.trim(), attribute.values.split(",").map((value) => value.trim()).filter(Boolean)])),
      price_lists: productPriceLists.filter((list) => list.name.trim()).map((list) => ({ name: list.name.trim(), price: Number(list.price || 0) })),
      components: productComponents.filter((component) => component.product_id).map((component) => ({ product_id: component.product_id, quantity: Number(component.quantity || 1) })),
      track_inventory: newProduct.product_type !== "service",
      direct_sale: directSale,
    };
    if (!payload.name) { setSaving(false); setNotice("Tên hàng là bắt buộc (giống KiotViet)."); return; }
    if (!payload.category_id) { setSaving(false); setNotice("Vui lòng chọn nhóm hàng (Bắt buộc) — giống KiotViet."); return; }
    const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setNotice(result.error || "Không thể lưu hàng hóa."); return; }
    const enriched = result.product as Product;
    const cat = categoryOptions.find((c) => c.id === newProduct.category_id)?.name || null;
    const sup = supplierOptions.find((s) => s.id === newProduct.supplier_id)?.name || null;
    setProducts((current) => [{ ...enriched, category_name: cat, supplier_name: sup } as Product, ...current]);
    setNewProduct({ ...EMPTY_PRODUCT, branch_id: branchOptions[0]?.id || "" });
    setCreateImages([]); setProductUnits([]); setProductAttributes([]); setProductPriceLists([]); setProductComponents([]); setShowCreate(false); setPage(1); setNotice("Đã tạo hàng hóa mới.");
  }

  async function createProductAndAddMore() {
    await createProduct();
    // keep modal open for adding more - KiotViet "Lưu & Tạo thêm hàng"
    setShowCreate(true);
    setNewProduct({ ...EMPTY_PRODUCT, branch_id: branchOptions[0]?.id || "" });
    setCreateImages([]);
    setProductUnits([]); setProductAttributes([]); setProductPriceLists([]); setProductComponents([]);
  }

  async function createCategory(name: string, parentId?: string, description?: string) {
    const response = await fetch("/api/product-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, parentId, description }) });
    const result = await response.json();
    if (response.ok) { setCategoryOptions((current) => [...current, result.category].sort((a, b) => a.name.localeCompare(b.name, "vi"))); setNotice(`Đã tạo nhóm ${name}.`); }
    else setNotice(result.error || "Không thể tạo nhóm hàng.");
  }

  async function createBrand(name: string) {
    const response = await fetch("/api/product-brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error || "Không thể tạo thương hiệu."); return; }
    setBrandOptions((current) => [...current, result.brand].sort((a, b) => a.name.localeCompare(b.name, "vi")));
    setNewProduct((current) => ({ ...current, brand_id: result.brand.id }));
  }

  async function uploadProductImage(file: File) {
    if (file.size > 2 * 1024 * 1024) { setNotice("Mỗi ảnh không quá 2 MB — giống KiotViet."); return; }
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/products/images", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) { setNotice(result.error || "Không thể tải ảnh."); return; }
    setCreateImages((current) => [...current, result.url].slice(0, 5));
  }

  function exportCsv() {
    if (!filtered.length) { setNotice("Không có dữ liệu để xuất."); return; }
    setNotice("Đang chuẩn bị file xuất...");
    const headers = ["Mã hàng", "Mã vạch", "Tên hàng", "Nhóm hàng", "Thương hiệu", "Loại hàng", "Đơn vị", "Giá bán", "Giá vốn", "Tồn kho", "Định mức tồn ít nhất", "Định mức tồn nhiều nhất", "Vị trí", "Nhà cung cấp", "Mô tả", "Ghi chú", "Bảo hành (tháng)", "Thuế (%)", "Trạng thái", "Ngày tạo"];
    const typeLabel = (t?: string) => t === "service" ? "Dịch vụ" : t === "combo" ? "Combo - đóng gói" : "Hàng hóa";
    const lines = [
      headers.map(csvEscape).join(","),
      ...filtered.map((p) => [
        p.sku, p.barcode || "", p.name, p.category_name || "", p.brand_name || p.brand || "", typeLabel(p.product_type), p.base_unit || "Cái", p.price, p.cost ?? 0, p.stock_quantity, p.min_stock ?? "", p.max_stock ?? "", p.location || "", p.supplier_name || "", p.description || "", p.note || "", p.warranty_months ?? 0, p.tax_percent ?? 0, p.active ? "Đang kinh doanh" : "Ngừng kinh doanh", p.created_at ? new Date(p.created_at).toLocaleDateString("vi-VN") : ""
      ].map(csvEscape).join(",")),
    ];
    const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    link.download = `hang-hoa-${stamp}.csv`;
    setTimeout(() => {
      link.click();
      URL.revokeObjectURL(url);
      setNotice(`Đã xuất ${filtered.length} hàng hóa ra file CSV (UTF-8) — giống KiotViet.`);
    }, 350);
  }

  function downloadTemplate() {
    const headers = ["Mã hàng", "Mã vạch", "Tên hàng*", "Nhóm hàng", "Thương hiệu", "Loại hàng (product/service/combo)", "Đơn vị", "Giá bán", "Giá vốn", "Tồn kho", "Tồn ít nhất", "Tồn nhiều nhất", "Vị trí", "Bảo hành (tháng)", "Thuế (%)", "Mô tả"];
    const sample = [
      ["SP001", "893000000001", "Cà phê đen đá", "Đồ uống", "PioPio", "product", "Ly", "25000", "15000", "100", "10", "200", "Kệ A", "0", "0", "Mẫu 1"],
      ["SP002", "893000000002", "Bạc sỉu", "Đồ uống", "PioPio", "product", "Ly", "30000", "18000", "50", "5", "100", "Kệ A", "0", "0", "Mẫu 2"],
    ];
    const lines = [headers.map(csvEscape).join(","), ...sample.map((r) => r.map(csvEscape).join(","))];
    const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mau-import-hang-hoa.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(file: File | undefined) {
    if (!file) return;
    setImportFileName(file.name);
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    if (isExcel) {
      setNotice("File Excel: hệ thống sẽ cố gắng đọc như CSV. Khuyến nghị lưu CSV UTF-8.");
    }
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (lines.length < 2) { setNotice("Tệp chưa có dữ liệu (cần dòng tiêu đề + ít nhất 1 dòng)."); return; }
      const headers = parseCsvLine(lines[0]).map(normalizeHeader);
      const idx = {
        sku: headers.findIndex((h) => ["mã hàng", "ma hang", "sku", "mã"].includes(h)),
        barcode: headers.findIndex((h) => ["mã vạch", "ma vach", "barcode"].includes(h)),
        name: headers.findIndex((h) => ["tên hàng", "ten hang", "tên hàng*", "name"].includes(h)),
        category: headers.findIndex((h) => ["nhóm hàng", "nhom hang", "category", "nhóm"].includes(h)),
        brand: headers.findIndex((h) => ["thương hiệu", "thuong hieu", "brand"].includes(h)),
        unit: headers.findIndex((h) => ["đơn vị", "don vi", "unit"].includes(h)),
        type: headers.findIndex((h) => h.includes("loại hàng") || h === "type" || h === "product_type"),
        price: headers.findIndex((h) => ["giá bán", "gia ban", "price"].includes(h)),
        cost: headers.findIndex((h) => ["giá vốn", "gia von", "cost", "giá nhập"].includes(h)),
        stock: headers.findIndex((h) => ["tồn kho", "ton kho", "stock", "số lượng", "tồn"].includes(h)),
        desc: headers.findIndex((h) => ["mô tả", "mo ta", "ghi chú", "description", "note"].includes(h)),
        minStock: headers.findIndex((h) => ["tồn ít nhất", "ton it nhat", "min stock"].includes(h)),
        maxStock: headers.findIndex((h) => ["tồn nhiều nhất", "ton nhieu nhat", "max stock"].includes(h)),
        location: headers.findIndex((h) => ["vị trí", "vi tri", "location"].includes(h)),
        warranty: headers.findIndex((h) => h.includes("bảo hành") || h === "warranty"),
        tax: headers.findIndex((h) => h.includes("thuế") || h === "tax"),
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
    const brandMap = new Map(brandOptions.map((b) => [b.name.toLowerCase(), b.id]));
    for (const line of lines) {
      if (!line.trim()) continue;
      const cells = parseCsvLine(line);
      const name = (idx.name >= 0 ? cells[idx.name] : "")?.trim();
      if (!name) continue;
      const sku = (idx.sku >= 0 ? cells[idx.sku] : "")?.trim();
      const catName = (idx.category >= 0 ? cells[idx.category] : "")?.trim();
      const brandName = (idx.brand >= 0 ? cells[idx.brand] : "")?.trim();
      const typeRaw = (idx.type >= 0 ? cells[idx.type] : "")?.trim().toLowerCase();
      const price = Number((idx.price >= 0 ? cells[idx.price] : "0")?.replace(/[^\d.-]/g, "") || 0);
      const cost = Number((idx.cost >= 0 ? cells[idx.cost] : "0")?.replace(/[^\d.-]/g, "") || 0);
      const stock = Number((idx.stock >= 0 ? cells[idx.stock] : "0")?.replace(/[^\d.-]/g, "") || 0);
      const desc = (idx.desc >= 0 ? cells[idx.desc] : "")?.trim();
      items.push({
        sku: sku || undefined,
        barcode: idx.barcode >= 0 ? (cells[idx.barcode] || "").trim() : null,
        name,
        price: Number.isFinite(price) ? price : 0,
        cost: Number.isFinite(cost) ? cost : 0,
        stock: Number.isFinite(stock) ? Math.trunc(stock) : 0,
        category_id: catName ? (catMap.get(catName.toLowerCase()) || null) : null,
        brand_id: brandName ? (brandMap.get(brandName.toLowerCase()) || null) : null,
        base_unit: idx.unit >= 0 ? (cells[idx.unit] || "Cái").trim() : "Cái",
        min_stock: idx.minStock >= 0 ? Number(cells[idx.minStock] || 0) : null,
        max_stock: idx.maxStock >= 0 ? Number(cells[idx.maxStock] || 0) : null,
        location: idx.location >= 0 ? (cells[idx.location] || "").trim() : null,
        warranty_months: idx.warranty >= 0 ? Number(cells[idx.warranty] || 0) : 0,
        tax_percent: idx.tax >= 0 ? Number(cells[idx.tax] || 0) : 0,
        supplier_id: null,
        product_type: ["service", "combo", "product"].includes(typeRaw) ? typeRaw : "product",
        description: desc || null,
      });
    }
    if (!items.length) { setNotice("Không có dòng hợp lệ để import."); return; }
    setSaving(true);
    const mode = importExcelOpt1 === "replace" || importExcelOpt2 === "replace" ? "update" : importMode;
    const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, mode, file_name: importFileName, update_stock: importExcelOpt3 === "yes", name_conflict: importExcelOpt1, barcode_conflict: importExcelOpt2, stop_on_conflict: importExcelOpt1 === "error" || importExcelOpt2 === "error" }) });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) { setNotice(result.error || "Import thất bại."); return; }
    const newProds = (result.products || []) as Product[];
    const catReverse = new Map(categoryOptions.map((c) => [c.id, c.name] as const));
    const enriched = newProds.map((p) => ({ ...p, category_name: p.category_id ? (catReverse.get(p.category_id) || null) : null } as Product));
    setProducts((cur) => [...enriched, ...cur]);
    setShowImportExcel(false); setShowImportChooser(false); setImportPreview([]); setImportFileName(""); if (importInput.current) importInput.current.value = "";
    const msg = `Import xong: thêm ${result.inserted}, cập nhật ${result.updated}, bỏ qua ${result.skipped}.` + (result.errors?.length ? ` Lỗi ${result.errors.length} dòng.` : "");
    setNotice(msg);
  }

  async function handleSuggestedAdd() {
    const selected = Array.from(selectedSuggested);
    if (!selected.length) { setNotice("Vui lòng chọn ít nhất 1 hàng hóa gợi ý."); return; }
    const items = selected.map((id) => {
      const s = SUGGESTED_PRODUCTS.find((x) => x.id === id)!;
      const inp = suggestedInputs[id] || { price: "0", cost: "0", stock: "0" };
      return {
        sku: s.id,
        name: s.name,
        price: Number(inp.price || 0),
        cost: Number(inp.cost || 0),
        stock: Number(inp.stock || 0),
        category_id: null,
        product_type: "product",
        description: s.group,
      };
    });
    setSaving(true);
    const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, mode: "skip" }) });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) { setNotice(result.error || "Không thể thêm hàng gợi ý."); return; }
    const newProds = (result.products || []) as Product[];
    setProducts((cur) => [...(newProds as Product[]), ...cur]);
    setShowSuggested(false); setSelectedSuggested(new Set()); setNotice(`Đã thêm ${newProds.length} hàng hóa gợi ý.`);
  }

  async function bulkStatus(active: boolean) {
    const response = await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, active }) });
    if (!response.ok) { setNotice("Không thể cập nhật hàng hóa đã chọn."); return; }
    setProducts((current) => current.map((item) => selected.includes(item.id) ? { ...item, active } : item)); setSelected([]); setNotice("Đã cập nhật trạng thái hàng hóa.");
  }

  const checkedAll = rows.length > 0 && rows.every((item) => selected.includes(item.id));
  useEffect(() => {
    if (!showCreateMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".kv-create-wrap")) setShowCreateMenu(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showCreateMenu]);

  const filteredSuggested = SUGGESTED_PRODUCTS.filter((p) => {
    const q = suggestedQuery.trim().toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    const matchCat = suggestedCategory === "all" || p.group.toLowerCase().includes(suggestedCategory.toLowerCase());
    return matchQ && matchCat;
  });

  return <div className="kv-shell product-page">
    <ManagementHeader profile={profile} active="products" />
    <div className="product-actions">
      <h1>Hàng hóa</h1>
      <div className="product-actions-center">
        <div className="product-query-wrap"><label className="product-query"><Search size={16} strokeWidth={2} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Theo mã, tên hàng" /></label><button className={`advanced-search-toggle ${showAdvancedSearch ? "active" : ""}`} type="button" aria-label="Tìm kiếm nâng cao" aria-expanded={showAdvancedSearch} onClick={() => setShowAdvancedSearch((value) => !value)}><SlidersHorizontal size={14} /></button>{showAdvancedSearch && <div className="advanced-search-popover"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Theo mã, tên hàng" /><input value={noteQuery} onChange={(event) => setNoteQuery(event.target.value)} placeholder="Theo ghi chú, mô tả hàng hóa" /><footer><button type="button" onClick={() => { setPage(1); setShowAdvancedSearch(false); }}>Tìm kiếm</button></footer></div>}</div>
      </div>
      <div className="product-toolbar kv-toolbar-100">
        <div className="kv-create-wrap">
          <button className="kv-btn kv-btn-create" type="button" title="Tạo mới" aria-label="Tạo mới" aria-expanded={showCreateMenu} onClick={() => setShowCreateMenu((v) => !v)}><Plus size={13} strokeWidth={2.4} /><span>Tạo mới</span><ChevronDown size={13} strokeWidth={2.2} className={`kv-caret ${showCreateMenu ? "open" : ""}`} /></button>
          {showCreateMenu && <div className="kv-dropdown">
            <button type="button" onClick={() => { setNewProduct((p) => ({ ...p, product_type: "product" })); setShowCreate(true); setShowCreateMenu(false); setCreateTab("info"); }}>Hàng hóa</button>
            <button type="button" onClick={() => { setNewProduct((p) => ({ ...p, product_type: "service" })); setShowCreate(true); setShowCreateMenu(false); setCreateTab("info"); }}>Dịch vụ</button>
            <button type="button" onClick={() => { setNewProduct((p) => ({ ...p, product_type: "combo" })); setShowCreate(true); setShowCreateMenu(false); setCreateTab("info"); }}>Combo - đóng gói</button>
          </div>}
        </div>
        <button type="button" className="kv-btn kv-btn-file kv-btn-import" title="Import file" aria-label="Import file" onClick={() => setShowImportChooser(true)}><ImportFileIcon />Import file</button>
        <button type="button" className="kv-btn kv-btn-file kv-btn-export" title="Xuất file" aria-label="Xuất file" onClick={exportCsv}><ExportFileIcon />Xuất file</button>
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

    {/* ===== Tạo hàng hóa - 100% KiotViet ảnh 1 ===== */}
    {showCreate && <div className="modal-backdrop kv-backdrop" onClick={() => setShowCreate(false)}><form className="kv-modal-large" onClick={(e) => e.stopPropagation()} onSubmit={createProduct}>
      <header className="kv-modal-header">
        <h2>{newProduct.product_type === "service" ? "Tạo dịch vụ" : newProduct.product_type === "combo" ? "Tạo combo - đóng gói" : "Tạo hàng hóa"}</h2>
        <button type="button" className="kv-modal-close" onClick={() => setShowCreate(false)} aria-label="Đóng"><X size={18} /></button>
      </header>
      <div className="kv-modal-tabs">
        <button type="button" className={createTab === "info" ? "active" : ""} onClick={() => setCreateTab("info")}>Thông tin</button>
        <button type="button" className={createTab === "desc" ? "active" : ""} onClick={() => setCreateTab("desc")}>Mô tả</button>
      </div>
      <div className="kv-modal-body">
        {createTab === "info" ? <>
          <div className="kv-create-grid">
            <div className="kv-create-main">
              <label className="kv-field">Mã hàng<input value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} placeholder="Tự động" /></label>
              <label className="kv-field">Tên hàng<span className="kv-req">*</span><input autoFocus required value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Bắt buộc" /></label>
              <div className="kv-three-grid">
                <label className="kv-field">Mã vạch<input value={newProduct.barcode} onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })} placeholder="Nhập hoặc quét mã vạch" /></label>
                <label className="kv-field">Đơn vị cơ bản<input value={newProduct.base_unit} onChange={(e) => setNewProduct({ ...newProduct, base_unit: e.target.value })} placeholder="Cái" /></label>
                {newProduct.product_type === "product" ? <label className="kv-field">Bán theo<select value={newProduct.sold_by} onChange={(e) => setNewProduct({ ...newProduct, sold_by: e.target.value as "quantity" | "weight" })}><option value="quantity">Số lượng</option><option value="weight">Trọng lượng</option></select></label> : <label className="kv-field">Loại hàng<input value={newProduct.product_type === "service" ? "Dịch vụ" : "Combo - đóng gói"} disabled /></label>}
              </div>
              <div className="kv-create-row2">
                <label className="kv-field">Nhóm hàng<span style={{ color: "#666", fontWeight: 400, marginLeft: 4 }}></span>
                  <div className="kv-select-wrap">
                    <select value={newProduct.category_id} onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}>
                      <option value="">Chọn nhóm hàng (Bắt buộc)</option>
                      {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="kv-select-chevron" />
                  </div>
                </label>
                <button type="button" className="kv-link" onClick={() => { const n = prompt("Tên nhóm mới:"); if (n) createCategory(n); }} style={{ alignSelf: "end", marginBottom: 8 }}>Tạo mới</button>
                <label className="kv-field">Thương hiệu
                  <div className="kv-select-wrap">
                    <select value={newProduct.brand_id} onChange={(e) => setNewProduct({ ...newProduct, brand_id: e.target.value })}>
                      <option value="">Chọn thương hiệu</option>
                      {brandOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="kv-select-chevron" />
                  </div>
                </label>
                <button type="button" className="kv-link" onClick={() => { const n = prompt("Tên thương hiệu mới:"); if (n) createBrand(n); }} style={{ alignSelf: "end", marginBottom: 8 }}>Tạo mới</button>
              </div>
            </div>
            <div className="kv-create-images">
              <div className="kv-image-main">
                {createImages[0] ? <img src={createImages[0]} alt="preview" /> : <div className="kv-image-placeholder"><ImageIcon size={28} color="#b9c4d2" /></div>}
                <label className="kv-image-add">
                  <input type="file" accept="image/*" hidden onChange={(e) => {
                    const f = e.target.files?.[0]; if (f) uploadProductImage(f);
                  }} />
                  <span>Thêm ảnh</span>
                </label>
                <small>Mỗi ảnh không quá 2 MB</small>
              </div>
              <div className="kv-image-thumbs">
                {[0, 1, 2, 3].map((i) => <div key={i} className="kv-thumb">
                  {createImages[i + 1] ? <img src={createImages[i + 1]} alt="" /> : <ImageIcon size={18} color="#cbd5e1" />}
                </div>)}
              </div>
            </div>
          </div>

          <div className={`kv-collapse ${priceOpen ? "open" : ""}`}>
            <button type="button" className="kv-collapse-head" onClick={() => setPriceOpen((v) => !v)}>
              <span>Giá vốn, giá bán</span>
              {priceOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {priceOpen && <div className="kv-collapse-body">
              <div className="kv-price-grid">
                <label className="kv-field">Giá vốn<input type="number" min="0" value={newProduct.cost} onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })} placeholder="0" /></label>
                <label className="kv-field">Giá bán
                  <div className="kv-input-with-link">
                    <input type="number" min="0" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="0" />
                    <button type="button" className="kv-link" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12 }}><Tag size={12} /> Thiết lập giá</button>
                  </div>
                </label>
              </div>
            </div>}
          </div>

          {newProduct.product_type !== "service" && <div className={`kv-collapse ${stockOpen ? "open" : ""}`}>
            <button type="button" className="kv-collapse-head" onClick={() => setStockOpen((v) => !v)}>
              <div>
                <div style={{ fontWeight: 700 }}>Tồn kho</div>
                <small style={{ color: "#6b7a8d", fontWeight: 400 }}>Quản lý số lượng tồn kho và định mức tồn. Khi tồn kho chạm đến định mức, bạn sẽ nhận được cảnh báo từ KiotViet.</small>
              </div>
              {stockOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {stockOpen && <div className="kv-collapse-body">
              <div className="kv-three-grid" style={{ paddingTop: 12 }}>
                <label className="kv-field">Chi nhánh<select value={newProduct.branch_id} onChange={(e) => setNewProduct({ ...newProduct, branch_id: e.target.value })}><option value="">Chi nhánh trung tâm</option>{branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                <label className="kv-field">Tồn kho<input type="number" min="0" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} placeholder="0" /></label>
                <label className="kv-field">Vị trí<input value={newProduct.location} onChange={(e) => setNewProduct({ ...newProduct, location: e.target.value })} placeholder="Kệ, kho..." /></label>
                <label className="kv-field">Định mức tồn ít nhất<input type="number" min="0" value={newProduct.min_stock} onChange={(e) => setNewProduct({ ...newProduct, min_stock: e.target.value })} placeholder="0" /></label>
                <label className="kv-field">Định mức tồn nhiều nhất<input type="number" min="0" value={newProduct.max_stock} onChange={(e) => setNewProduct({ ...newProduct, max_stock: e.target.value })} placeholder="0" /></label>
                <label className="kv-field">Nhà cung cấp<select value={newProduct.supplier_id} onChange={(e) => setNewProduct({ ...newProduct, supplier_id: e.target.value })}><option value="">Chọn nhà cung cấp</option>{supplierOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              </div>
            </div>}
          </div>}

          <div className="kv-collapse open">
            <div className="kv-collapse-head"><span>Thông tin mở rộng</span><ChevronUp size={16} /></div>
            <div className="kv-collapse-body"><div className="kv-three-grid" style={{ paddingTop: 12 }}>
              {newProduct.product_type === "product" ? <label className="kv-field">Trọng lượng<input type="number" min="0" step="0.001" value={newProduct.weight} onChange={(e) => setNewProduct({ ...newProduct, weight: e.target.value })} placeholder="0" /></label> : <label className="kv-field">Đơn vị dịch vụ/combo<input value={newProduct.base_unit} onChange={(e) => setNewProduct({ ...newProduct, base_unit: e.target.value })} /></label>}
              <label className="kv-field">Bảo hành (tháng)<input type="number" min="0" value={newProduct.warranty_months} onChange={(e) => setNewProduct({ ...newProduct, warranty_months: e.target.value })} /></label>
              <label className="kv-field">Thuế (%)<input type="number" min="0" value={newProduct.tax_percent} onChange={(e) => setNewProduct({ ...newProduct, tax_percent: e.target.value })} /></label>
            </div></div>
          </div>

          {newProduct.product_type === "product" && <div className="kv-collapse open">
            <div className="kv-collapse-head"><span>Đơn vị tính &amp; thuộc tính</span><ChevronUp size={16} /></div>
            <div className="kv-collapse-body kv-dynamic-section">
              <div className="kv-dynamic-title"><b>Đơn vị quy đổi</b><button type="button" className="kv-link" onClick={() => setProductUnits((rows) => [...rows, { name: "", conversion: "1", price: "0" }])}><Plus size={15} /> Thêm đơn vị</button></div>
              {productUnits.map((unit, index) => <div className="kv-dynamic-row three" key={`unit-${index}`}>
                <input value={unit.name} onChange={(e) => setProductUnits((rows) => rows.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} placeholder="Tên đơn vị (Thùng, Hộp...)" />
                <input type="number" min="0.001" step="0.001" value={unit.conversion} onChange={(e) => setProductUnits((rows) => rows.map((row, i) => i === index ? { ...row, conversion: e.target.value } : row))} placeholder="Quy đổi" />
                <input type="number" min="0" value={unit.price} onChange={(e) => setProductUnits((rows) => rows.map((row, i) => i === index ? { ...row, price: e.target.value } : row))} placeholder="Giá bán" />
                <button type="button" onClick={() => setProductUnits((rows) => rows.filter((_, i) => i !== index))}><X size={16} /></button>
              </div>)}
              <div className="kv-dynamic-title"><b>Thuộc tính / phiên bản</b><button type="button" className="kv-link" onClick={() => setProductAttributes((rows) => [...rows, { name: "", values: "" }])}><Plus size={15} /> Thêm thuộc tính</button></div>
              {productAttributes.map((attribute, index) => <div className="kv-dynamic-row two" key={`attribute-${index}`}>
                <input value={attribute.name} onChange={(e) => setProductAttributes((rows) => rows.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} placeholder="Tên thuộc tính (Màu sắc, Size...)" />
                <input value={attribute.values} onChange={(e) => setProductAttributes((rows) => rows.map((row, i) => i === index ? { ...row, values: e.target.value } : row))} placeholder="Các giá trị, cách nhau bằng dấu phẩy" />
                <button type="button" onClick={() => setProductAttributes((rows) => rows.filter((_, i) => i !== index))}><X size={16} /></button>
              </div>)}
            </div>
          </div>}

          <div className="kv-collapse open">
            <div className="kv-collapse-head"><span>Bảng giá</span><ChevronUp size={16} /></div>
            <div className="kv-collapse-body kv-dynamic-section">
              <div className="kv-dynamic-title"><span>Thiết lập giá bán riêng theo từng bảng giá</span><button type="button" className="kv-link" onClick={() => setProductPriceLists((rows) => [...rows, { name: "", price: newProduct.price || "0" }])}><Plus size={15} /> Thêm bảng giá</button></div>
              {productPriceLists.map((list, index) => <div className="kv-dynamic-row two" key={`price-${index}`}>
                <input value={list.name} onChange={(e) => setProductPriceLists((rows) => rows.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} placeholder="Tên bảng giá" />
                <input type="number" min="0" value={list.price} onChange={(e) => setProductPriceLists((rows) => rows.map((row, i) => i === index ? { ...row, price: e.target.value } : row))} placeholder="Giá bán" />
                <button type="button" onClick={() => setProductPriceLists((rows) => rows.filter((_, i) => i !== index))}><X size={16} /></button>
              </div>)}
            </div>
          </div>

          {newProduct.product_type === "combo" && <div className="kv-collapse open">
            <div className="kv-collapse-head"><span>Hàng thành phần</span><ChevronUp size={16} /></div>
            <div className="kv-collapse-body kv-dynamic-section">
              <div className="kv-dynamic-title"><span>Chọn hàng hóa cấu thành combo</span><button type="button" className="kv-link" onClick={() => setProductComponents((rows) => [...rows, { product_id: "", quantity: "1" }])}><Plus size={15} /> Thêm hàng thành phần</button></div>
              {productComponents.map((component, index) => <div className="kv-dynamic-row component" key={`component-${index}`}>
                <select value={component.product_id} onChange={(e) => setProductComponents((rows) => rows.map((row, i) => i === index ? { ...row, product_id: e.target.value } : row))}><option value="">Chọn hàng hóa</option>{products.filter((product) => product.product_type !== "service").map((product) => <option key={product.id} value={product.id}>{product.sku} - {product.name}</option>)}</select>
                <input type="number" min="0.001" step="0.001" value={component.quantity} onChange={(e) => setProductComponents((rows) => rows.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} placeholder="Số lượng" />
                <button type="button" onClick={() => setProductComponents((rows) => rows.filter((_, i) => i !== index))}><X size={16} /></button>
              </div>)}
            </div>
          </div>}
        </> : <div className="kv-desc-tab">
          <label className="kv-field">Mô tả<textarea rows={6} value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="Nhập mô tả chi tiết hàng hóa..." style={{ minHeight: 160 }} /></label>
          <label className="kv-field" style={{ marginTop: 14 }}>Ghi chú nội bộ<textarea rows={4} value={newProduct.note} onChange={(e) => setNewProduct({ ...newProduct, note: e.target.value })} placeholder="Ghi chú chỉ nhân viên cửa hàng nhìn thấy..." /></label>
        </div>}
      </div>
      <footer className="kv-modal-footer">
        <label className="kv-check"><input type="checkbox" checked={directSale} onChange={(e) => setDirectSale(e.target.checked)} /><span>Bán trực tiếp</span><Info size={14} color="#8a96a7" /></label>
        <div className="kv-footer-actions">
          <button type="button" className="kv-btn kv-btn-file" onClick={() => setShowCreate(false)}>Bỏ qua</button>
          <div className="kv-split-btn">
            <button type="button" className="kv-btn kv-btn-file" disabled={saving} onClick={createProductAndAddMore}>Lưu &amp; Tạo thêm hàng</button>
            <button type="button" className="kv-btn kv-btn-file" style={{ padding: "0 8px", borderLeft: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}><ChevronDown size={14} /></button>
          </div>
          <button className="kv-btn kv-btn-primary" disabled={saving} style={{ minWidth: 72 }}>{saving ? "Đang lưu..." : "Lưu"}</button>
        </div>
      </footer>
    </form></div>}

    {/* ===== Import: Chọn cách thêm (ảnh 2) ===== */}
    {showImportChooser && <div className="modal-backdrop kv-backdrop" onClick={() => setShowImportChooser(false)}><section className="kv-modal-small" onClick={(e) => e.stopPropagation()}>
      <header className="kv-modal-header"><h2>Chọn cách thêm hàng hóa</h2><button type="button" className="kv-modal-close" onClick={() => setShowImportChooser(false)}><X size={18} /></button></header>
      <div className="kv-chooser-body">
        <button className="kv-chooser-card" onClick={() => { setShowImportChooser(false); setShowImportExcel(true); setImportFileName(""); setImportPreview([]); }}>
          <div className="kv-chooser-title">Nhập từ Excel</div>
          <div className="kv-chooser-desc">Điền thông tin hàng hoá trên file Excel và tải file lên phần mềm.</div>
        </button>
        <button className="kv-chooser-card" onClick={() => { setShowImportChooser(false); setShowSuggested(true); }}>
          <div className="kv-chooser-title">Chọn từ danh sách gợi ý</div>
          <div className="kv-chooser-desc">Thêm các hàng hoá phổ biến của ngành hàng Nông sản &amp; Thực phẩm với đầy đủ thông tin, hình ảnh</div>
        </button>
      </div>
    </section></div>}

    {/* ===== Import từ Excel (ảnh 3) ===== */}
    {showImportExcel && <div className="modal-backdrop kv-backdrop" onClick={() => setShowImportExcel(false)}><section className="kv-modal-medium" onClick={(e) => e.stopPropagation()}>
      <header className="kv-modal-header"><h2>Nhập hàng hóa từ file dữ liệu <span style={{ fontWeight: 400, fontSize: 13, color: "#333" }}>(Tải về file mẫu: <button type="button" className="kv-link" onClick={downloadTemplate} style={{ fontSize: 13 }}>Excel file</button>)</span></h2><button type="button" className="kv-modal-close" onClick={() => setShowImportExcel(false)}><X size={18} /></button></header>
      <div className="kv-modal-body" style={{ padding: "0 20px" }}>
        <div className="kv-import-section">
          <div className="kv-import-section-title">Xử lý trùng <i>mã hàng/mã vạch, khác tên hàng hóa?</i></div>
          <label className="kv-radio-large"><input type="radio" checked={importExcelOpt1 === "error"} onChange={() => setImportExcelOpt1("error")} /><span>Báo lỗi và dừng import</span></label>
          <label className="kv-radio-large"><input type="radio" checked={importExcelOpt1 === "replace"} onChange={() => setImportExcelOpt1("replace")} /><span>Thay thế tên hàng cũ bằng tên hàng mới</span></label>
        </div>
        <div className="kv-import-section">
          <div className="kv-import-section-title">Xử lý trùng <i>mã vạch, khác mã hàng?</i> <Info size={13} color="#8a96a7" style={{ display: "inline", verticalAlign: "middle" }} /></div>
          <label className="kv-radio-large"><input type="radio" checked={importExcelOpt2 === "error"} onChange={() => setImportExcelOpt2("error")} /><span>Báo lỗi và dừng import</span></label>
          <label className="kv-radio-large"><input type="radio" checked={importExcelOpt2 === "replace"} onChange={() => setImportExcelOpt2("replace")} /><span>Thay thế mã hàng cũ bằng mã hàng mới</span></label>
        </div>
        <div className="kv-import-section">
          <div className="kv-import-section-title">Cập nhật tồn kho? <Info size={13} color="#8a96a7" style={{ display: "inline", verticalAlign: "middle" }} /></div>
          <label className="kv-radio-large"><input type="radio" checked={importExcelOpt3 === "no"} onChange={() => setImportExcelOpt3("no")} /><span>Không</span></label>
          <label className="kv-radio-large"><input type="radio" checked={importExcelOpt3 === "yes"} onChange={() => setImportExcelOpt3("yes")} /><span>Có</span></label>
        </div>
        <input ref={importInput} type="file" accept=".csv,.xlsx,.xls,text/csv" hidden onChange={(e) => handleFileChange(e.target.files?.[0])} />
        {importPreview.length > 0 && <div className="kv-preview" style={{ margin: "16px 0" }}><div className="kv-preview-head">{importFileName} — Xem trước 5 dòng đầu</div><table><thead><tr><th>Mã</th><th>Tên</th><th>Nhóm</th><th>Giá</th><th>Tồn</th></tr></thead><tbody>{importPreview.map((r, i) => <tr key={i}><td>{r.sku}</td><td>{r.name}</td><td>{r.category}</td><td>{r.price}</td><td>{r.stock}</td></tr>)}</tbody></table></div>}
      </div>
      <footer className="kv-modal-footer" style={{ background: "#f7f9fb", justifyContent: "flex-end" }}>
        <button type="button" className="kv-btn kv-btn-primary" onClick={() => importInput.current?.click()} style={{ minWidth: 140 }}>Chọn file dữ liệu</button>
      </footer>
      {importFileName && <div style={{ padding: "8px 20px 12px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="kv-btn kv-btn-file" onClick={() => setShowImportExcel(false)}>Bỏ qua</button>
        <button type="button" className="kv-btn kv-btn-primary" disabled={saving} onClick={importCsv}>{saving ? "Đang xử lý..." : "Nhập file"}</button>
      </div>}
    </section></div>}

    {/* ===== Danh sách gợi ý (ảnh 4) ===== */}
    {showSuggested && <div className="modal-backdrop kv-backdrop" onClick={() => setShowSuggested(false)}><section className="kv-modal-large" onClick={(e) => e.stopPropagation()}>
      <header className="kv-modal-header"><div><h2>Danh sách hàng hóa gợi ý</h2><p style={{ margin: "4px 0 0", color: "#6b7a8d", fontSize: 13 }}>Hãy chọn hàng hóa bạn muốn thêm vào gian hàng, sau đó nhập giá và số lượng tồn kho.</p></div><button type="button" className="kv-modal-close" onClick={() => setShowSuggested(false)}><X size={18} /></button></header>
      <div className="kv-modal-body" style={{ padding: "12px 16px" }}>
        <div className="kv-suggest-toolbar">
          <label className="kv-search"><Search size={14} /><input value={suggestedQuery} onChange={(e) => setSuggestedQuery(e.target.value)} placeholder="Tìm tên hàng" /></label>
          <div className="kv-select-wrap" style={{ minWidth: 200 }}>
            <select value={suggestedCategory} onChange={(e) => setSuggestedCategory(e.target.value)}>
              <option value="all">Chọn nhóm hàng</option>
              <option value="Gia vị">Gia vị</option>
              <option value="Bột">Bột</option>
              <option value="Thực phẩm đóng gói">Thực phẩm đóng gói</option>
            </select>
            <ChevronDown size={14} className="kv-select-chevron" />
          </div>
        </div>
        <div className="kv-table-wrap">
          <table className="kv-suggest-table">
            <thead><tr><th style={{ width: 32 }}><input type="checkbox" checked={selectedSuggested.size === filteredSuggested.length && filteredSuggested.length > 0} onChange={(e) => setSelectedSuggested(e.target.checked ? new Set(filteredSuggested.map((s) => s.id)) : new Set())} /></th><th>Ảnh</th><th>Mã hàng</th><th>Tên hàng</th><th>Nhóm hàng</th><th>Giá bán</th><th>Giá vốn</th><th>Tồn kho</th></tr></thead>
            <tbody>{filteredSuggested.map((p) => <tr key={p.id} className={selectedSuggested.has(p.id) ? "selected" : ""}>
              <td><input type="checkbox" checked={selectedSuggested.has(p.id)} onChange={(e) => setSelectedSuggested((prev) => { const n = new Set(prev); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })} /></td>
              <td><span className="kv-thumb-small"><ImageIcon size={14} color="#8fa0b1" /></span></td>
              <td>{p.id}</td><td>{p.name}</td><td>{p.group}</td>
              <td><input className="kv-cell-input" value={suggestedInputs[p.id]?.price ?? "0"} onChange={(e) => setSuggestedInputs((prev) => ({ ...prev, [p.id]: { ...prev[p.id], price: e.target.value, cost: prev[p.id]?.cost ?? "0", stock: prev[p.id]?.stock ?? "0" } }))} /></td>
              <td><input className="kv-cell-input" value={suggestedInputs[p.id]?.cost ?? "0"} onChange={(e) => setSuggestedInputs((prev) => ({ ...prev, [p.id]: { ...prev[p.id], cost: e.target.value, price: prev[p.id]?.price ?? "0", stock: prev[p.id]?.stock ?? "0" } }))} /></td>
              <td><input className="kv-cell-input" value={suggestedInputs[p.id]?.stock ?? "0"} onChange={(e) => setSuggestedInputs((prev) => ({ ...prev, [p.id]: { ...prev[p.id], stock: e.target.value, price: prev[p.id]?.price ?? "0", cost: prev[p.id]?.cost ?? "0" } }))} /></td>
            </tr>)}
            {!filteredSuggested.length && <tr><td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#8a96a7" }}>Không có hàng hóa gợi ý</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <footer className="kv-modal-footer">
        <div style={{ color: "#6b7a8d", fontSize: 13 }}>{selectedSuggested.size} hàng đã chọn</div>
        <div className="kv-footer-actions">
          <button type="button" className="kv-btn kv-btn-file" onClick={() => setShowSuggested(false)}>Bỏ qua</button>
          <button type="button" className="kv-btn kv-btn-primary" disabled={saving || !selectedSuggested.size} onClick={handleSuggestedAdd}>{saving ? "Đang thêm..." : `Thêm ${selectedSuggested.size ? `(${selectedSuggested.size})` : ""}`}</button>
        </div>
      </footer>
    </section></div>}

  </div>;
}

function ProductRow({ product, visible, selected, expanded, onSelect, onExpand }: { product: Product; visible: Record<ColumnKey, boolean>; selected: boolean; expanded: boolean; onSelect: () => void; onExpand: () => void }) {
  const typeName = product.product_type === "service" ? "Dịch vụ" : product.product_type === "combo" ? "Combo - đóng gói" : "Hàng hóa";
  return <><tr className="product-row"><td><input type="checkbox" aria-label={`Chọn ${product.name}`} checked={selected} onChange={onSelect} /></td>{visible.image && <td><span className="product-thumb"><ImageIcon size={20} /></span></td>}{visible.sku && <td>{product.sku}</td>}{visible.name && <td><button className="product-name" onClick={onExpand}>{product.name}</button></td>}{visible.category && <td>{product.category_name || "—"}</td>}{visible.type && <td>{typeName}</td>}{visible.linked && <td>{product.linked_sale_channel ? "Có" : "Không"}</td>}{visible.price && <td>{money(Number(product.price))}</td>}{visible.cost && <td>{money(Number(product.cost || 0))}</td>}{visible.brand && <td>{product.brand || "—"}</td>}{visible.stock && <td>{product.stock_quantity}</td>}{visible.location && <td>{product.location || "—"}</td>}{visible.reserved && <td>0</td>}{visible.created && <td>{dateTime(product.created_at)}</td>}{visible.expected && <td>{dateTime(product.expected_out_of_stock_at)}</td>}{visible.minStock && <td>{product.min_stock ?? 0}</td>}{visible.maxStock && <td>{product.max_stock ?? 0}</td>}{visible.status && <td><span className={product.active ? "status-active" : "status-inactive"}>{product.active ? "Đang kinh doanh" : "Ngừng kinh doanh"}</span></td>}</tr>{expanded && <tr className="product-detail"><td colSpan={COLUMNS.filter((column) => visible[column.key]).length + 1}><nav><button className="active">Thông tin</button><button>Mô tả, ghi chú</button><button>Thẻ kho</button><button>Tồn kho</button></nav><div><p><b>Mã hàng:</b> {product.sku}</p><p><b>Giá bán:</b> {money(Number(product.price))}</p><p><b>Giá vốn:</b> {money(Number(product.cost || 0))}</p><p><b>Tồn kho:</b> {product.stock_quantity}</p>{product.description && <p><b>Mô tả:</b> {product.description}</p>}</div></td></tr>}</>;
}
