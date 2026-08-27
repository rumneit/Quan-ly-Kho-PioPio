"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, GripVertical, Plus, Search } from "lucide-react";
import DateFilter from "./date-filter";
import FilterPopover from "./filter-popover";
import { FilterOption, ProductFilters } from "./product-types";

type Props = {
  filters: ProductFilters;
  categories: FilterOption[];
  suppliers: FilterOption[];
  locations?: FilterOption[];
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
  onChange: (filters: ProductFilters) => void;
  onCreateCategory: (name: string, parentId?: string, description?: string) => Promise<void>;
};

const inventoryOptions = [
  ["all", "Tất cả"], ["below_min", "Dưới định mức tồn"], ["above_min", "Vượt định mức tồn"],
  ["in_stock", "Còn hàng trong kho"], ["out_of_stock", "Hết hàng trong kho"], ["custom", "Tùy chỉnh giá trị tồn"],
] as const;
const productTypes = [["all", "Tất cả"], ["product", "Hàng hóa"], ["service", "Dịch vụ"], ["combo", "Combo - đóng gói"]] as const;
const statuses = [["active", "Hàng đang kinh doanh"], ["inactive", "Ngừng kinh doanh"], ["all", "Tất cả"]] as const;

function Segmented({ value, onChange }: { value: "all" | "yes" | "no"; onChange: (value: "all" | "yes" | "no") => void }) {
  return <div className="filter-segmented">{[["all", "Tất cả"], ["yes", "Có"], ["no", "Không"]].map(([id, label]) => <button type="button" key={id} className={value === id ? "selected" : ""} onClick={() => onChange(id as "all" | "yes" | "no")}>{label}</button>)}</div>;
}

function FilterSelect({ label, value, onClick, expanded }: { label: string; value?: string; onClick: (element: HTMLButtonElement) => void; expanded: boolean }) {
  return <button type="button" className="filter-select-button" aria-expanded={expanded} onClick={(event) => onClick(event.currentTarget)}><span className={value ? "has-value" : ""}>{value || label}</span><ChevronDown size={19} /></button>;
}

export default function ProductFilterSidebar({ filters, categories, suppliers, locations = [], collapsed, onCollapsedChange, onChange, onCreateCategory }: Props) {
  const [active, setActive] = useState<"category" | "inventory" | "supplier" | "location" | "type" | "status" | null>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [draftCategories, setDraftCategories] = useState<string[]>(filters.categoryIds);
  const [draftSuppliers, setDraftSuppliers] = useState<string[]>(filters.supplierIds);
  const [draftLocations, setDraftLocations] = useState<string[]>(filters.locationIds);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", parentId: "", description: "" });
  const [savingCategory, setSavingCategory] = useState(false);
  const open = (name: typeof active, element: HTMLButtonElement) => { setActive(name); setAnchor(element); if (name === "category") setDraftCategories(filters.categoryIds); if (name === "supplier") setDraftSuppliers(filters.supplierIds); if (name === "location") setDraftLocations(filters.locationIds); };
  const close = () => setActive(null);
  const categoryRows = useMemo(() => categories.filter((item) => item.name.toLowerCase().includes(categorySearch.toLowerCase())), [categories, categorySearch]);
  const supplierRows = useMemo(() => suppliers.filter((item) => item.name.toLowerCase().includes(supplierSearch.toLowerCase())), [suppliers, supplierSearch]);
  const locationRows = useMemo(() => locations.filter((item) => item.name.toLowerCase().includes(locationSearch.toLowerCase())), [locations, locationSearch]);
  const set = <K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) => onChange({ ...filters, [key]: value });
  const inventoryLabel = inventoryOptions.find(([id]) => id === filters.inventoryCriteria)?.[1] || "Tất cả";
  const typeLabel = productTypes.find(([id]) => id === filters.productType)?.[1] || "Tất cả";
  const statusLabel = statuses.find(([id]) => id === filters.status)?.[1] || "Hàng đang kinh doanh";
  const selectedCategoryLabel = filters.categoryIds.length ? `${filters.categoryIds.length} nhóm đã chọn` : undefined;
  const selectedSupplierLabel = filters.supplierIds.length ? `${filters.supplierIds.length} nhà cung cấp` : undefined;
  const selectedLocationLabel = filters.locationIds.length ? `${filters.locationIds.length} vị trí` : undefined;

  if (collapsed) return <button type="button" className="sidebar-collapse collapsed" aria-label="Mở bộ lọc" onClick={() => onCollapsedChange(false)}><ChevronRight size={20} /></button>;
  return <aside className="product-filter-sidebar">
    <section><h2>Nhóm hàng <button type="button" onClick={() => setShowCategoryModal(true)}>Tạo mới</button></h2><FilterSelect label="Chọn nhóm hàng" value={selectedCategoryLabel} expanded={active === "category"} onClick={(element) => open("category", element)} /></section>
    <section><h2>Tồn kho</h2><span className="filter-caption">Tiêu chí tồn</span><FilterSelect label="Tất cả" value={inventoryLabel} expanded={active === "inventory"} onClick={(element) => open("inventory", element)} />{filters.inventoryCriteria === "custom" && <div className="inventory-custom"><select value={filters.inventoryOperator} onChange={(event) => set("inventoryOperator", event.target.value as ProductFilters["inventoryOperator"])}><option>=</option><option>&gt;</option><option>&gt;=</option><option>&lt;</option><option>&lt;=</option><option value="between">Khoảng</option></select><input type="number" aria-label="Giá trị tồn tối thiểu" value={filters.inventoryMin ?? ""} onChange={(event) => set("inventoryMin", event.target.value ? Number(event.target.value) : undefined)} />{filters.inventoryOperator === "between" && <input type="number" aria-label="Giá trị tồn tối đa" value={filters.inventoryMax ?? ""} onChange={(event) => set("inventoryMax", event.target.value ? Number(event.target.value) : undefined)} />}</div>}</section>
    <section><h2>Dự kiến hết hàng</h2><DateFilter mode="future" value={{ preset: filters.expectedPreset, from: filters.expectedFrom, to: filters.expectedTo }} onChange={(value) => onChange({ ...filters, expectedPreset: value.preset, expectedFrom: value.from, expectedTo: value.to })} /></section>
    <section><h2>Thời gian tạo</h2><DateFilter mode="past" value={{ preset: filters.createdPreset, from: filters.createdFrom, to: filters.createdTo }} onChange={(value) => onChange({ ...filters, createdPreset: value.preset, createdFrom: value.from, createdTo: value.to })} /></section>
    <section><h2>Nhà cung cấp</h2><FilterSelect label="Chọn nhà cung cấp" value={selectedSupplierLabel} expanded={active === "supplier"} onClick={(element) => open("supplier", element)} /></section>
    <section><h2>Vị trí</h2><FilterSelect label="Chọn vị trí" value={selectedLocationLabel} expanded={active === "location"} onClick={(element) => open("location", element)} /></section>
    <section><h2>Loại hàng</h2><FilterSelect label="Chọn loại hàng" value={typeLabel} expanded={active === "type"} onClick={(element) => open("type", element)} /></section>
    <section><h2>Bán trực tiếp</h2><Segmented value={filters.directSale} onChange={(value) => set("directSale", value)} /></section>
    <section><h2>Liên kết kênh bán</h2><Segmented value={filters.linkedSaleChannel} onChange={(value) => set("linkedSaleChannel", value)} /></section>
    <section><h2>Trạng thái hàng hóa</h2><FilterSelect label="Hàng đang kinh doanh" value={statusLabel} expanded={active === "status"} onClick={(element) => open("status", element)} /></section>
    <button type="button" className="sidebar-collapse" aria-label="Thu gọn bộ lọc" onClick={() => onCollapsedChange(true)}><ChevronLeft size={20} /></button>

    <FilterPopover open={active === "category"} anchor={anchor} onClose={close} className="category" ariaLabel="Chọn nhóm hàng"><div className="picker-panel"><header><h3>Nhóm hàng</h3><button type="button" onClick={() => setShowCategoryModal(true)}><Plus size={18} />Tạo mới</button></header><label className="picker-search"><Search size={19} /><input autoFocus value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Tìm kiếm" /></label><div className="picker-list">{categoryRows.map((item) => <label key={item.id}><GripVertical size={18} /><ChevronRight size={17} /><input type="checkbox" checked={draftCategories.includes(item.id)} onChange={() => setDraftCategories((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /><span>{item.name}</span><small>({item.count || 0})</small></label>)}{!categoryRows.length && <p>Không tìm thấy nhóm hàng</p>}</div><footer><label><input type="checkbox" checked={categories.length > 0 && draftCategories.length === categories.length} onChange={(event) => setDraftCategories(event.target.checked ? categories.map((item) => item.id) : [])} />Chọn tất cả</label><button type="button" className="primary" onClick={() => { set("categoryIds", draftCategories); close(); }}>Áp dụng</button></footer></div></FilterPopover>
    <FilterPopover open={active === "inventory"} anchor={anchor} onClose={close} ariaLabel="Tiêu chí tồn kho"><div className="option-menu">{inventoryOptions.map(([id, label]) => <button type="button" key={id} className={filters.inventoryCriteria === id ? "selected" : ""} onClick={() => { set("inventoryCriteria", id); close(); }}><span>{label}</span>{filters.inventoryCriteria === id && <Check size={19} />}</button>)}</div></FilterPopover>
    <FilterPopover open={active === "supplier"} anchor={anchor} onClose={close} ariaLabel="Chọn nhà cung cấp"><div className="picker-panel compact"><label className="picker-search"><Search size={19} /><input autoFocus value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} placeholder="Tìm nhà cung cấp" /></label><div className="picker-list">{supplierRows.map((item) => <label key={item.id}><input type="checkbox" checked={draftSuppliers.includes(item.id)} onChange={() => setDraftSuppliers((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /><span>{item.name}</span></label>)}{!supplierRows.length && <p>Không tìm thấy nhà cung cấp</p>}</div><footer><span /> <button type="button" className="primary" onClick={() => { set("supplierIds", draftSuppliers); close(); }}>Áp dụng</button></footer></div></FilterPopover>
    <FilterPopover open={active === "location"} anchor={anchor} onClose={close} ariaLabel="Chọn vị trí"><div className="picker-panel compact"><label className="picker-search"><Search size={19} /><input autoFocus value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} placeholder="Tìm vị trí" /></label><div className="picker-list">{locationRows.map((item) => <label key={item.id}><input type="checkbox" checked={draftLocations.includes(item.id)} onChange={() => setDraftLocations((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} /><span>{item.name}</span><small>({item.count || 0})</small></label>)}{!locationRows.length && <p>Không tìm thấy vị trí</p>}</div><footer><span /> <button type="button" className="primary" onClick={() => { set("locationIds", draftLocations); close(); }}>Áp dụng</button></footer></div></FilterPopover>
    <FilterPopover open={active === "type"} anchor={anchor} onClose={close} ariaLabel="Chọn loại hàng"><div className="option-menu">{productTypes.map(([id, label]) => <button type="button" key={id} className={filters.productType === id ? "selected" : ""} onClick={() => { set("productType", id); close(); }}><span>{label}</span>{filters.productType === id && <Check size={19} />}</button>)}</div></FilterPopover>
    <FilterPopover open={active === "status"} anchor={anchor} onClose={close} ariaLabel="Chọn trạng thái"><div className="option-menu">{statuses.map(([id, label]) => <button type="button" key={id} className={filters.status === id ? "selected" : ""} onClick={() => { set("status", id); close(); }}><span>{label}</span>{filters.status === id && <Check size={19} />}</button>)}</div></FilterPopover>

    {showCategoryModal && <div className="modal-backdrop"><form className="small-modal" onSubmit={async (event) => { event.preventDefault(); if (!newCategory.name.trim()) return; setSavingCategory(true); await onCreateCategory(newCategory.name.trim(), newCategory.parentId || undefined, newCategory.description.trim() || undefined); setSavingCategory(false); setNewCategory({ name: "", parentId: "", description: "" }); setShowCategoryModal(false); }}><header><h3>Tạo nhóm hàng</h3><button type="button" onClick={() => setShowCategoryModal(false)}>×</button></header><div><label>Tên nhóm *<input autoFocus required value={newCategory.name} onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })} /></label><label>Nhóm cha<select value={newCategory.parentId} onChange={(event) => setNewCategory({ ...newCategory, parentId: event.target.value })}><option value="">Không có nhóm cha</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Mô tả<textarea rows={3} value={newCategory.description} onChange={(event) => setNewCategory({ ...newCategory, description: event.target.value })} /></label></div><footer><button type="button" onClick={() => setShowCategoryModal(false)}>Hủy</button><button className="primary" disabled={savingCategory}>{savingCategory ? "Đang lưu..." : "Lưu"}</button></footer></form></div>}
  </aside>;
}
