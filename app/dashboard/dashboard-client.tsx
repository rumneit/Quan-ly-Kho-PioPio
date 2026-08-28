"use client";

import { FormEvent, useMemo, useState } from "react";
import { Clock3, DollarSign, PackageOpen, RotateCcw, ShieldAlert, ShoppingBag } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";

type Product = { id: string; name: string; sku: string; price: number; stock_quantity: number; active: boolean };
type Customer = { id: string; name: string; total_spent: number };
type OrderItem = { quantity: number; line_total: number; products?: { id?: string; name?: string; sku?: string } | null };
type Order = {
  id: string;
  order_number: number;
  customer_id?: string | null;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  created_at: string;
  customers?: { name?: string } | null;
  order_items?: OrderItem[];
};
type Props = { profile: Profile; products: Product[]; customers: Customer[]; orders: Order[] };
type DateRange = "Hôm nay" | "Hôm qua" | "7 ngày qua" | "Tháng này" | "Tháng trước";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

function inRange(value: string, range: DateRange) {
  const now = new Date();
  const date = new Date(value);
  const today = startOfDay(now);
  const target = startOfDay(date);
  if (range === "Hôm nay") return target.getTime() === today.getTime();
  if (range === "Hôm qua") return target.getTime() === today.getTime() - 86400000;
  if (range === "7 ngày qua") return target <= today && target >= new Date(today.getTime() - 6 * 86400000);
  if (range === "Tháng này") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return date.getMonth() === previous.getMonth() && date.getFullYear() === previous.getFullYear();
}

function timeAgo(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

export default function DashboardClient({ profile, products: initialProducts, customers, orders }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [modal, setModal] = useState<"product" | "staff" | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("Tháng này");
  const [chartMode, setChartMode] = useState<"day" | "hour" | "weekday">("day");
  const [rankingMetric, setRankingMetric] = useState<"Doanh thu thuần" | "Số lượng">("Doanh thu thuần");
  const [rankingRange, setRankingRange] = useState<DateRange>("Tháng này");
  const [customerRange, setCustomerRange] = useState<DateRange>("Tháng này");
  const [activityOpen, setActivityOpen] = useState(true);

  const todayOrders = useMemo(() => orders.filter((order) => inRange(order.created_at, "Hôm nay")), [orders]);
  const todayRevenue = todayOrders.filter((order) => order.status === "paid").reduce((sum, order) => sum + Number(order.total), 0);
  const todayReturns = todayOrders.filter((order) => order.status === "refunded").reduce((sum, order) => sum + Number(order.total), 0);
  const todayInvoiceCount = todayOrders.filter((order) => order.status === "paid").length;
  const todayNet = todayRevenue - todayReturns;

  const yesterdayNet = useMemo(() => {
    const rows = orders.filter((order) => inRange(order.created_at, "Hôm qua"));
    return rows.filter((order) => order.status === "paid").reduce((sum, order) => sum + Number(order.total), 0)
      - rows.filter((order) => order.status === "refunded").reduce((sum, order) => sum + Number(order.total), 0);
  }, [orders]);

  const samePeriodLastMonthNet = useMemo(() => {
    const now = new Date();
    const ref = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    const rows = orders.filter((order) => {
      const date = new Date(order.created_at);
      return date >= start && date <= end && date.getDate() === ref.getDate();
    });
    return rows.filter((order) => order.status === "paid").reduce((sum, order) => sum + Number(order.total), 0)
      - rows.filter((order) => order.status === "refunded").reduce((sum, order) => sum + Number(order.total), 0);
  }, [orders]);

  const pctVsYesterday = yesterdayNet !== 0 ? Math.round(((todayNet - yesterdayNet) / Math.abs(yesterdayNet)) * 100) : (todayNet > 0 ? 100 : 0);
  const pctVsLastMonth = samePeriodLastMonthNet !== 0 ? Math.round(((todayNet - samePeriodLastMonthNet) / Math.abs(samePeriodLastMonthNet)) * 100) : (todayNet > 0 ? 100 : 0);

  const chartOrders = useMemo(() => orders.filter((order) => inRange(order.created_at, dateRange)), [orders, dateRange]);
  const chartData = useMemo(() => {
    const revenueOf = (items: Order[]) => items.reduce((sum, order) => sum + (order.status === "paid" ? Number(order.total) : order.status === "refunded" ? -Number(order.total) : 0), 0);
    if (chartMode === "hour") {
      const labels = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
      return { labels, values: labels.map((_, hour) => revenueOf(chartOrders.filter((order) => new Date(order.created_at).getHours() === hour))) };
    }
    if (chartMode === "weekday") {
      const labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
      return { labels, values: labels.map((_, index) => revenueOf(chartOrders.filter((order) => (new Date(order.created_at).getDay() + 6) % 7 === index))) };
    }
    const grouped = new Map<string, number>();
    for (const order of chartOrders) {
      const key = order.created_at.slice(0, 10);
      grouped.set(key, (grouped.get(key) || 0) + (order.status === "paid" ? Number(order.total) : order.status === "refunded" ? -Number(order.total) : 0));
    }
    const entries = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
    return { labels: entries.map(([key]) => String(new Date(`${key}T00:00:00`).getDate())), values: entries.map(([, value]) => value) };
  }, [chartMode, chartOrders]);
  const chartTotal = chartData.values.reduce((sum, value) => sum + value, 0);
  const chartMax = Math.max(1, ...chartData.values.map((value) => Math.abs(value)));
  const hasChartData = chartData.values.some(Boolean);

  const topProducts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sku: string; revenue: number; quantity: number }>();
    for (const order of orders.filter((item) => item.status === "paid" && inRange(item.created_at, rankingRange))) {
      for (const item of order.order_items || []) {
        const id = item.products?.id || item.products?.sku || "unknown";
        const current = map.get(id) || { id, name: item.products?.name || "Hàng hóa", sku: item.products?.sku || "", revenue: 0, quantity: 0 };
        current.revenue += Number(item.line_total || 0);
        current.quantity += Number(item.quantity || 0);
        map.set(id, current);
      }
    }
    return Array.from(map.values()).sort((a, b) => rankingMetric === "Số lượng" ? b.quantity - a.quantity : b.revenue - a.revenue).slice(0, 10);
  }, [orders, rankingMetric, rankingRange]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; revenue: number; orders: number }>();
    for (const order of orders.filter((item) => item.status === "paid" && inRange(item.created_at, customerRange))) {
      if (!order.customer_id) continue;
      const current = map.get(order.customer_id) || { id: order.customer_id, name: order.customers?.name || "Khách lẻ", revenue: 0, orders: 0 };
      current.revenue += Number(order.total || 0);
      current.orders += 1;
      map.set(order.customer_id, current);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [orders, customerRange]);

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(result.error); return; }
    setProducts((current) => [result.product, ...current]); setModal(null); setMessage("Đã thêm sản phẩm thành công.");
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(result.error); return; }
    setModal(null); setMessage(`Đã tạo tài khoản ${result.user.username}.`);
  }

  return <div className="kv-shell dashboard-page">
    <ManagementHeader profile={profile} active="dashboard" />
    <main className="kv-main">
      {message && <div className="kv-toast-message">✓ {message}</div>}
      <div className="kv-dashboard-grid">
        <div className="kv-main-column">
          <section className="kv-card kv-today-card kv-enter"><h2>Kết quả bán hàng hôm nay</h2><div className="kv-today-stats"><article><span className="kv-stat-icon blue"><DollarSign size={18} /></span><div><small>Doanh thu</small><strong>{money(todayRevenue)}</strong>{todayInvoiceCount > 0 && <p>{todayInvoiceCount} hóa đơn</p>}</div></article><article><span className="kv-stat-icon orange"><RotateCcw size={17} /></span><div><small>Trả hàng</small><strong>{money(todayReturns)}</strong></div></article><article><span className="kv-stat-icon green"><DollarSign size={18} /></span><div><small>Doanh thu thuần</small><strong>{money(todayNet)}</strong></div></article></div><div className="kv-today-compare"><span>So với hôm qua <b className={pctVsYesterday >= 0 ? "up" : "down"}>{pctVsYesterday >= 0 ? "▲" : "▼"} {Math.abs(pctVsYesterday)}%</b></span><span>So với cùng kỳ tháng trước <b className={pctVsLastMonth >= 0 ? "up" : "down"}>{pctVsLastMonth >= 0 ? "▲" : "▼"} {Math.abs(pctVsLastMonth)}%</b></span></div></section>
          <section className="kv-card kv-chart-card kv-enter delay-1"><div className="kv-card-title"><h2>Doanh thu thuần <b>{money(chartTotal)}</b></h2><select aria-label="Khoảng thời gian" value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)}><option>Hôm nay</option><option>Hôm qua</option><option>7 ngày qua</option><option>Tháng này</option><option>Tháng trước</option></select></div><div className="kv-tabs"><button className={chartMode === "day" ? "active" : ""} onClick={() => setChartMode("day")}>Theo ngày</button><button className={chartMode === "hour" ? "active" : ""} onClick={() => setChartMode("hour")}>Theo giờ</button><button className={chartMode === "weekday" ? "active" : ""} onClick={() => setChartMode("weekday")}>Theo thứ</button></div><div className="kv-chart"><div className="kv-y-axis">{hasChartData ? <><span>{money(chartMax)}</span><span>{money(chartMax * .75)}</span><span>{money(chartMax * .5)}</span><span>{money(chartMax * .25)}</span></> : <><span /><span /><span /><span /></>}<span>0</span></div><div className="kv-bars">{chartData.values.map((value, index) => <i key={`${chartData.labels[index]}-${index}`} title={`${chartData.labels[index]}: ${money(value)}`} style={{ height: value ? `${Math.max(2, Math.abs(value) / chartMax * 100)}%` : "1px" }}><span>{chartData.labels[index]}</span></i>)}</div>{!hasChartData && <div className="kv-no-chart">Chưa có dữ liệu doanh thu trong {dateRange.toLowerCase()}</div>}</div></section>
          <div className="kv-rank-grid">
            <section className="kv-card kv-rank-card kv-enter delay-2"><div className="kv-card-title"><h2>Top 10 hàng bán chạy</h2><div className="kv-rank-filters"><select aria-label="Tiêu chí xếp hạng" value={rankingMetric} onChange={(event) => setRankingMetric(event.target.value as typeof rankingMetric)}><option>Doanh thu thuần</option><option>Số lượng</option></select><select aria-label="Khoảng thời gian hàng bán chạy" value={rankingRange} onChange={(event) => setRankingRange(event.target.value as DateRange)}><option>Hôm nay</option><option>Hôm qua</option><option>7 ngày qua</option><option>Tháng này</option><option>Tháng trước</option></select></div></div>{topProducts.length ? <div className="kv-top-products">{topProducts.map((product, index) => <div key={product.id}><b>{index + 1}</b><span>{product.name}<small>{product.sku}</small></span><strong>{rankingMetric === "Số lượng" ? `${money(product.quantity)} sản phẩm` : money(product.revenue)}</strong></div>)}</div> : <div className="kv-empty"><PackageOpen size={42} /><p>Chưa có dữ liệu</p><button onClick={() => setModal("product")}>Thêm hàng hóa</button></div>}</section>
            <section className="kv-card kv-rank-card kv-enter delay-3"><div className="kv-card-title"><h2>Top 10 khách mua nhiều nhất</h2><select aria-label="Khoảng thời gian khách hàng" value={customerRange} onChange={(event) => setCustomerRange(event.target.value as DateRange)}><option>Hôm nay</option><option>Hôm qua</option><option>7 ngày qua</option><option>Tháng này</option><option>Tháng trước</option></select></div>{topCustomers.length ? <div className="kv-top-products">{topCustomers.map((customer, index) => <div key={customer.id}><b>{index + 1}</b><span>{customer.name}<small>{customer.orders} hóa đơn</small></span><strong>{money(customer.revenue)}</strong></div>)}</div> : <div className="kv-empty"><ShoppingBag size={42} /><p>Chưa có dữ liệu</p></div>}</section>
          </div>
        </div>
        <aside className="kv-side-column">
          <section className="kv-card kv-alert-card kv-enter delay-1"><span><ShieldAlert size={20} /></span><div><strong>Có <b>1 hoạt động đăng nhập khác thường</b> cần kiểm tra.</strong></div><button aria-label={activityOpen ? "Thu gọn" : "Mở rộng"} onClick={() => setActivityOpen((value) => !value)}>⌄</button></section>
          {activityOpen && <section className="kv-card kv-activity kv-enter delay-2"><div className="kv-card-title"><h2>Hoạt động gần đây</h2></div><div className="kv-activity-list">{orders.slice(0, 18).map((order) => <article key={order.id}><span>{order.status === "refunded" ? <RotateCcw size={16} /> : <ShoppingBag size={16} />}</span><p><b>{profile.full_name}</b> vừa <strong>{order.status === "refunded" ? "trả hàng" : "bán đơn hàng"}</strong> <a href={`/invoices?code=HD${String(order.order_number).padStart(6, "0")}`}>HD{String(order.order_number).padStart(6, "0")}</a> với giá trị <strong>{money(Number(order.total))}</strong><small>{timeAgo(order.created_at)}</small></p></article>)}{!orders.length && <div className="kv-empty activity-empty"><Clock3 size={42} /><p>Chưa có hoạt động gần đây</p><button onClick={() => setModal("product")}>Thêm hàng hóa</button></div>}</div></section>}
        </aside>
      </div>
    </main>
    <a className="kv-help" href="tel:0704040044" aria-label="Liên hệ 0704 04 0044"><i>💬</i><span>0704 04 0044</span></a>
    {modal && <div className="modal open"><button className="modal-backdrop" aria-label="Đóng" onClick={() => setModal(null)} /><form className="modal-card" onSubmit={modal === "product" ? addProduct : addStaff}><div className="modal-head"><div><h3>{modal === "product" ? "Thêm hàng hóa" : "Tạo tài khoản nhân viên"}</h3><p>{modal === "product" ? "Hàng hóa được lưu vào cơ sở dữ liệu" : "Cấp quyền Quản lý hoặc Bán hàng"}</p></div><button type="button" className="close-btn" onClick={() => setModal(null)}>×</button></div>{modal === "product" ? <div className="form-grid"><label className="full">Tên hàng hóa<input name="name" required /></label><label>Mã hàng<input name="sku" required /></label><label>Giá bán<input name="price" type="number" min="0" required /></label><label>Tồn kho<input name="stock" type="number" min="0" defaultValue="0" /></label></div> : <div className="form-grid"><label className="full">Tên nhân viên<input name="fullName" required /></label><label>Tên đăng nhập<input name="username" required minLength={3} /></label><label>Mật khẩu<input name="password" type="password" required minLength={8} /></label><label>Vai trò<select name="role"><option value="sales">Bán hàng</option><option value="manager">Quản lý</option></select></label></div>}{message && <p className="form-error">{message}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Hủy</button><button className="button primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></div></form></div>}
  </div>;
}
