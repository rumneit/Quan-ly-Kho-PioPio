"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, FileSpreadsheet, Printer, TrendingUp } from "lucide-react";
import ManagementHeader, { type ManagementSection } from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import DateRangePicker, { type DateValue } from "@/app/date-range-picker";

export type ReportMode = "sales" | "orders" | "products" | "customers" | "suppliers" | "channels";
type OrderItem = { quantity: number; line_total: number; unit_price: number; products?: { id?: string; sku?: string; name?: string; cost?: number; category_id?: string | null; brand_id?: string | null } | null };
type Order = { id: string; order_number: number; status: string; subtotal: number; discount: number; total: number; channel?: string | null; created_at: string; created_by?: string | null; customer_id?: string | null; customers?: { name?: string; phone?: string } | null; order_items?: OrderItem[] };
type Product = { id: string; sku: string; name: string; price: number; cost: number; stock_quantity: number; active: boolean; category_id?: string | null; brand_id?: string | null };
type Customer = { id: string; customer_number?: number | null; name: string; phone?: string | null; total_spent: number; created_at: string; group_id?: string | null };
type Supplier = { id: string; code?: string | null; name: string; created_at?: string };
type Purchase = { id: string; code: string; status: string; supplier_id?: string | null; subtotal: number; payable: number; paid: number; created_at: string };
type PurchaseReturn = { id: string; code: string; status: string; supplier_id?: string | null; payable: number; created_at: string };
type Category = { id: string; name: string };
type Brand = { id: string; name: string };
type CustomerGroup = { id: string; name: string };
type Seller = { id: string; full_name: string };
type Row = { id: string; label: string; code: string; orders: number; quantity: number; gross: number; discount: number; returns: number; net: number; cost: number; profit: number; payable: number };
type Metrics = { orders: number; quantity: number; gross: number; discount: number; returns: number; net: number; cost: number; profit: number; payable: number };
type Config = { title: string; active: ManagementSection; interests: string[]; filters: string[]; columns: Array<[keyof Row, string]>; note?: string };

const configs: Record<ReportMode, Config> = {
  sales: { title: "Báo cáo bán hàng", active: "sale-report", interests: ["Bán hàng", "Lợi nhuận", "Giảm giá", "Thuế"], filters: ["Thời gian", "Người bán", "Kênh bán", "Phương thức thanh toán"], columns: [["label", "Thời gian"], ["gross", "Doanh thu"], ["net", "Doanh thu thuần"], ["returns", "Giá trị trả"], ["profit", "Lợi nhuận"], ["orders", "Số hóa đơn"]] },
  orders: { title: "Báo cáo đặt hàng", active: "order-report", interests: ["Hàng hóa", "Doanh thu", "Số lượng đơn", "Khách hàng"], filters: ["Thời gian đặt hàng", "Thời gian giao hàng", "Trạng thái", "Khách hàng", "Hàng hóa", "Loại hàng", "Nhóm hàng", "Nhân viên"], columns: [["label", "Thời gian"], ["orders", "Số đơn đặt hàng"], ["gross", "Tổng tiền hàng"], ["discount", "Giảm giá"], ["net", "Giá trị đơn"], ["payable", "Khách cần trả"]] },
  products: { title: "Báo cáo hàng hóa", active: "product-report", interests: ["Bán hàng", "Lợi nhuận", "Tồn kho", "Xuất nhập tồn"], filters: ["Thời gian", "Bảng giá", "Hàng hóa", "Loại hàng", "Nhóm hàng"], note: "Doanh thu, Doanh thu thuần, Lợi nhuận · Phân bổ giảm giá hóa đơn, giảm giá phiếu trả · Phân bổ giá trị khuyến mại.", columns: [["code", "Mã hàng"], ["label", "Tên hàng"], ["quantity", "Số lượng bán"], ["gross", "Doanh thu"], ["net", "Doanh thu thuần"], ["cost", "Giá vốn"], ["profit", "Lợi nhuận"]] },
  customers: { title: "Báo cáo khách hàng", active: "customer-report", interests: ["Bán hàng", "Công nợ", "Lợi nhuận"], filters: ["Thời gian", "Khách hàng", "Nhóm khách hàng", "Công nợ"], columns: [["code", "Mã khách hàng"], ["label", "Khách hàng"], ["orders", "Số hóa đơn"], ["gross", "Tổng bán"], ["net", "Tổng bán trừ trả hàng"], ["payable", "Công nợ"], ["profit", "Lợi nhuận"]] },
  suppliers: { title: "Báo cáo nhà cung cấp", active: "supplier-report", interests: ["Nhập hàng", "Công nợ"], filters: ["Thời gian", "Nhà cung cấp", "Loại hàng", "Thương hiệu"], columns: [["code", "Mã nhà cung cấp"], ["label", "Nhà cung cấp"], ["orders", "Số phiếu nhập"], ["gross", "Tổng tiền hàng"], ["returns", "Giá trị trả hàng"], ["payable", "Cần trả nhà cung cấp"]] },
  channels: { title: "Báo cáo kênh bán hàng", active: "sale-channel-report", interests: ["Bán hàng", "Doanh thu", "Số lượng đơn"], filters: ["Thời gian", "Người bán", "Kênh bán", "Loại hàng", "Thương hiệu"], columns: [["label", "Kênh bán"], ["orders", "Số hóa đơn"], ["quantity", "Số lượng hàng"], ["gross", "Doanh thu"], ["net", "Doanh thu thuần"], ["returns", "Giá trị trả"]] },
};

const channelNames: Record<string, string> = { direct: "Tại cửa hàng", facebook: "Facebook", shopee: "Shopee / Lazada / Tiki / Sendo", tiktok: "Tiktok Shop", website: "Website", other: "Khác" };
const channelLabel = (channel?: string | null) => channelNames[channel || "direct"] || (channel && channel.trim()) || "Tại cửa hàng";
const customerCode = (value?: number | null) => (value == null ? "" : `KH${String(value).padStart(6, "0")}`);

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const day = (value: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));

const emptyTotals: Metrics = { orders: 0, quantity: 0, gross: 0, discount: 0, returns: 0, net: 0, cost: 0, profit: 0, payable: 0 };
function sumRows(rows: Row[]): Metrics {
  return rows.reduce((total, row) => ({ orders: total.orders + row.orders, quantity: total.quantity + row.quantity, gross: total.gross + row.gross, discount: total.discount + row.discount, returns: total.returns + row.returns, net: total.net + row.net, cost: total.cost + row.cost, profit: total.profit + row.profit, payable: total.payable + row.payable }), emptyTotals);
}

function extractMetric(interest: string): keyof Metrics {
  if (interest.includes("Công nợ")) return "payable";
  if (interest.includes("Lợi nhuận")) return "profit";
  if (interest.includes("Doanh thu thuần")) return "net";
  if (interest.includes("Giảm giá")) return "discount";
  if (interest.includes("Trả hàng") || interest.includes("Giá trị trả")) return "returns";
  if (interest.includes("Số lượng") || interest.includes("Số đơn") || interest.includes("Số phiếu")) return "orders";
  if (interest.includes("Tồn kho") || interest.includes("Xuất nhập tồn") || interest.includes("Hàng hóa")) return "quantity";
  return "gross";
}

const moneyKeys = ["gross", "discount", "returns", "net", "cost", "profit", "payable"];

export default function ReportDashboard({ mode, profile, orders, products, customers, suppliers, purchases, purchaseReturns, categories, brands, customerGroups, sellers }: { mode: ReportMode; profile: Profile; orders: Order[]; products: Product[]; customers: Customer[]; suppliers: Supplier[]; purchases: Purchase[]; purchaseReturns: PurchaseReturn[]; categories: Category[]; brands: Brand[]; customerGroups: CustomerGroup[]; sellers: Seller[] }) {
  const config = configs[mode];
  const [view, setView] = useState("Biểu đồ");
  const [interest, setInterest] = useState(config.interests[0]);
  const [dateValue, setDateValue] = useState<DateValue>(() => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; return { preset: "this_week", from: iso(start), to: iso(end) }; });
  const [groupProducts, setGroupProducts] = useState(true);
  const [status, setStatus] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [productId, setProductId] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sellerId, setSellerId] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");

  const orderedProducts = useMemo(() => products.filter((product) => (categoryId === "all" || product.category_id === categoryId) && (brandId === "all" || product.brand_id === brandId) && (productId === "all" || product.id === productId)), [products, categoryId, brandId, productId]);

  const filteredOrders = useMemo(() => {
    const orderedProductIds = new Set(orderedProducts.map((product) => product.id));
    const orderedItemsHas = (item: OrderItem) => (item.products?.id ? orderedProductIds.has(item.products.id) : false);
    return orders.filter((order) => {
      const dateOk = dateValue.preset === "all" || ((!dateValue.from || order.created_at.slice(0, 10) >= dateValue.from) && (!dateValue.to || order.created_at.slice(0, 10) <= dateValue.to));
      const statusOk = status === "all" || order.status === status;
      const sellerOk = sellerId === "all" || order.created_by === sellerId;
      const channelOk = channelFilter === "all" || (order.channel || "direct") === channelFilter;
      const productOk = (categoryId === "all" && brandId === "all" && productId === "all") || (order.order_items || []).some(orderedItemsHas);
      return dateOk && statusOk && sellerOk && channelOk && productOk;
    });
  }, [orders, dateValue, status, categoryId, brandId, productId, sellerId, channelFilter, orderedProducts]);

  const rows = useMemo<Row[]>(() => {
    const paid = filteredOrders.filter((order) => order.status === "paid");

    if (mode === "products") {
      return orderedProducts.map((product) => {
        const related = paid.flatMap((order) => (order.order_items || []).filter((item) => item.products?.id === product.id));
        const quantity = related.reduce((sum, item) => sum + Number(item.quantity), 0);
        const gross = related.reduce((sum, item) => sum + Number(item.line_total), 0);
        const cost = quantity * Number(product.cost || 0);
        return { id: product.id, code: product.sku, label: product.name, orders: related.length, quantity, gross, discount: 0, returns: 0, net: gross, cost, profit: gross - cost, payable: 0 };
      }).filter((row) => row.quantity || row.orders);
    }

    if (mode === "customers") {
      const scopedCustomers = customers.filter((customer) => groupFilter === "all" || customer.group_id === groupFilter);
      return scopedCustomers.map((customer) => {
        const related = paid.filter((order) => order.customer_id === customer.id);
        const refunded = filteredOrders.filter((order) => order.customer_id === customer.id && order.status === "refunded");
        const gross = related.reduce((sum, order) => sum + Number(order.subtotal), 0);
        const net = related.reduce((sum, order) => sum + Number(order.total), 0);
        const returns = refunded.reduce((sum, order) => sum + Number(order.total), 0);
        const cost = related.reduce((sum, order) => sum + (order.order_items || []).reduce((s, item) => s + Number(item.quantity) * Number(item.products?.cost || 0), 0), 0);
        return { id: customer.id, code: customerCode(customer.customer_number), label: customer.name, orders: related.length, quantity: 0, gross, discount: related.reduce((sum, order) => sum + Number(order.discount), 0), returns, net, cost, profit: net - cost, payable: 0 };
      }).filter((row) => row.orders || row.returns);
    }

    if (mode === "suppliers") {
      const map = new Map<string, Row>();
      const ensure = (key: string) => {
        const supplier = suppliers.find((s) => s.id === key);
        if (!map.has(key)) map.set(key, { id: key, code: supplier?.code || "", label: supplier?.name || "Khách lẻ", orders: 0, quantity: 0, gross: 0, discount: 0, returns: 0, net: 0, cost: 0, profit: 0, payable: 0 });
        return map.get(key)!;
      };
      for (const purchase of purchases) {
        if (purchase.status !== "completed") continue;
        const row = ensure(purchase.supplier_id || "");
        row.orders += 1;
        row.gross += Number(purchase.payable || 0);
        row.payable += Math.max(0, Number(purchase.payable || 0) - Number(purchase.paid || 0));
      }
      for (const ret of purchaseReturns) {
        if (ret.status !== "completed") continue;
        const row = ensure(ret.supplier_id || "");
        row.returns += Number(ret.payable || 0);
      }
      return Array.from(map.values()).filter((row) => row.orders || row.returns).map((row) => ({ ...row, net: row.gross - row.returns, payable: Math.max(0, row.payable - row.returns) }));
    }

    if (mode === "channels") {
      const map = new Map<string, Row>();
      for (const order of filteredOrders) {
        const key = order.channel || "direct";
        if (!map.has(key)) map.set(key, { id: key, code: "", label: channelLabel(order.channel), orders: 0, quantity: 0, gross: 0, discount: 0, returns: 0, net: 0, cost: 0, profit: 0, payable: 0 });
        const row = map.get(key)!;
        row.orders += 1;
        row.quantity += (order.order_items || []).reduce((sum, item) => sum + Number(item.quantity), 0);
        row.gross += Number(order.subtotal || 0);
        row.discount += Number(order.discount || 0);
        if (order.status === "refunded") row.returns += Number(order.total || 0);
        if (order.status === "paid") row.net += Number(order.total || 0);
        row.profit = row.net;
      }
      return Array.from(map.values());
    }

    const groups = new Map<string, Row>();
    for (const order of filteredOrders) {
      const key = order.created_at.slice(0, 10);
      const current = groups.get(key) || { id: key, code: key, label: day(order.created_at), orders: 0, quantity: 0, gross: 0, discount: 0, returns: 0, net: 0, cost: 0, profit: 0, payable: 0 };
      current.orders += 1;
      current.quantity += (order.order_items || []).reduce((sum, item) => sum + Number(item.quantity), 0);
      current.gross += Number(order.subtotal);
      current.discount += Number(order.discount);
      if (order.status === "refunded") current.returns += Number(order.total);
      if (order.status === "paid") {
        current.net += Number(order.total);
        current.payable += Number(order.total);
        current.cost += (order.order_items || []).reduce((sum, item) => sum + Number(item.quantity) * Number(item.products?.cost || 0), 0);
      }
      current.profit = current.net - current.cost;
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => b.id.localeCompare(a.id));
  }, [mode, filteredOrders, products, customers, suppliers, purchases, purchaseReturns, orderedProducts, groupFilter]);

  const totals = useMemo(() => sumRows(rows), [rows]);
  const metric = extractMetric(interest);
  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row[metric]))));
  const topRows = useMemo(() => [...rows].sort((a, b) => Number(b[metric]) - Number(a[metric])).slice(0, 10), [rows, metric]);

  function exportCsv() {
    const lines = [config.columns.map(([, label]) => label), ...rows.map((row) => config.columns.map(([key]) => moneyLike(row, key)))];
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${mode}-report.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  const moneyLike = (row: Row, key: keyof Row) => moneyKeys.includes(key) ? money(Number(row[key])) : String(row[key]);
  const renderValue = (row: Row, key: keyof Row) => moneyLike(row, key);

  const noun = mode === "products" ? "sản phẩm" : mode === "customers" ? "khách hàng" : mode === "suppliers" ? "nhà cung cấp" : mode === "channels" ? "kênh bán" : "ngày";
  const chartTitle = `Top 10 ${noun} theo ${interest.toLowerCase()}`;

  return (
    <div className="kv-shell product-page business-page analytics-page">
      <ManagementHeader profile={profile} active={config.active} />
      <div className="analytics-toolbar">
        <h1>{config.title}</h1>
        <label>Kiểu hiển thị
          <select value={view} onChange={(event) => setView(event.target.value)}><option>Biểu đồ</option><option>Báo cáo</option></select>
        </label>
        {mode === "orders" || mode === "products" ? <label className="analytics-check"><input type="checkbox" checked={groupProducts} onChange={(event) => setGroupProducts(event.target.checked)} />Gộp hàng hóa cùng loại</label> : null}
        <button onClick={() => window.print()}><Printer size={18} />In báo cáo</button>
        <button onClick={exportCsv}><Download size={18} />Xuất file</button>
      </div>
      <main className="analytics-workspace">
        <aside className="analytics-sidebar">
          <section>
            <h2>Mối quan tâm</h2>
            {config.interests.map((value) => <label className="stock-radio" key={value}><input type="radio" name={`${mode}-interest`} checked={interest === value} onChange={() => setInterest(value)} /><span>{value}</span></label>)}
            {config.note && <p className="analytics-note">{config.note}</p>}
          </section>
          {config.filters.map((filter) => (
            <section key={filter}>
              <h2>{filter}</h2>
              {filter.includes("Thời gian") ? (
                <DateRangePicker value={dateValue} onChange={setDateValue} />
              ) : filter === "Trạng thái" ? (
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="all">Chọn trạng thái</option><option value="draft">Phiếu tạm</option><option value="paid">Hoàn thành</option><option value="cancelled">Đã hủy</option>
                </select>
              ) : filter === "Khách hàng" ? (
                <select defaultValue="all"><option value="all">Tất cả khách hàng</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>
              ) : filter === "Nhà cung cấp" ? (
                <select defaultValue="all"><option value="all">Tất cả nhà cung cấp</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
              ) : filter === "Hàng hóa" ? (
                <select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="all">Tất cả hàng hóa</option>{products.slice(0, 300).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
              ) : filter === "Loại hàng" || filter === "Nhóm hàng" ? (
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">Tất cả loại hàng</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
              ) : filter === "Thương hiệu" ? (
                <select value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="all">Tất cả thương hiệu</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
              ) : filter === "Nhóm khách hàng" ? (
                <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="all">Tất cả nhóm</option>{customerGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
              ) : filter === "Kênh bán" ? (
                <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}><option value="all">Tất cả kênh bán</option>{Object.entries(channelNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              ) : filter === "Người bán" || filter === "Nhân viên" ? (
                <select value={sellerId} onChange={(event) => setSellerId(event.target.value)}><option value="all">Tất cả nhân viên</option>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.full_name}</option>)}</select>
              ) : (
                <select defaultValue="all"><option value="all">Tất cả</option></select>
              )}
            </section>
          ))}
        </aside>
        <section className="analytics-content">
          <div className="analytics-kpis">
            <article><TrendingUp /><span>Tổng doanh thu<b>{money(totals.gross)}</b></span></article>
            <article><BarChart3 /><span>Doanh thu thuần<b>{money(totals.net)}</b></span></article>
            <article><FileSpreadsheet /><span>Số giao dịch<b>{totals.orders}</b></span></article>
            <article><span>Lợi nhuận<b>{money(totals.profit)}</b></span></article>
          </div>
          {view === "Biểu đồ" ? (
            <section className="analytics-chart-card">
              <header><div><h2>{chartTitle}</h2><p>{dateValue.preset === "all" ? "Toàn thời gian" : dateValue.from && dateValue.to ? `${dateValue.from.split("-").reverse().join("/")} – ${dateValue.to.split("-").reverse().join("/")}` : ""}</p></div><strong>{money(Number(totals[metric]))}</strong></header>
              <div className="analytics-chart">
                {topRows.length ? topRows.map((row) => <div className="analytics-bar" key={row.id}><span>{Number(row[metric]) ? money(Number(row[metric])) : "0"}</span><i style={{ height: `${Math.max(3, Math.abs(Number(row[metric])) / max * 100)}%` }} /><b>{row.label}</b></div>) : <div className="analytics-empty"><BarChart3 size={50} /><strong>Báo cáo không có dữ liệu</strong><p>Hãy chọn khoảng thời gian khác hoặc bổ sung giao dịch.</p></div>}
              </div>
            </section>
          ) : (
            <section className="analytics-table-card">
              <table>
                <thead><tr>{config.columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
                <tbody>
                  {rows.map((row) => <tr key={row.id}>{config.columns.map(([key]) => <td key={key}>{renderValue(row, key)}</td>)}</tr>)}
                  {!rows.length && <tr><td colSpan={config.columns.length}><div className="analytics-empty">Báo cáo không có dữ liệu</div></td></tr>}
                </tbody>
                {rows.length > 0 && <tfoot><tr>{config.columns.map(([key], index) => <th key={key}>{index === 0 ? "Tổng cộng" : typeof totals[key as keyof Metrics] === "number" ? renderValue({ ...rows[0], ...totals } as Row, key) : ""}</th>)}</tr></tfoot>}
              </table>
            </section>
          )}
        </section>
      </main>
      <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>
    </div>
  );
}