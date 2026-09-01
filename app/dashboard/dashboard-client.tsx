"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, DollarSign, MessageCircle, PackageOpen, RotateCcw, ShieldAlert, ShoppingBag, Users, Download } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";

type Product = { id: string; name: string; sku: string; price: number; cost?: number; stock_quantity: number; active: boolean; created_at?: string };
type Branch = { id: string; name: string; is_default: boolean; active: boolean };
type Customer = { id: string; name: string; total_spent: number };
type OrderItem = { quantity: number; line_total: number; products?: { id?: string; name?: string; sku?: string; cost?: number } | null };
type Order = {
  id: string;
  order_number: number;
  customer_id?: string | null;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  created_at: string;
  branch_id?: string | null;
  created_by?: string | null;
  customers?: { name?: string } | null;
  creator?: { full_name?: string } | null;
  order_items?: OrderItem[];
};
type Props = { profile: Profile; products: Product[]; customers: Customer[]; orders: Order[]; branches: Branch[]; truncated?: boolean };
type DateRange = "Hôm nay" | "Hôm qua" | "7 ngày qua" | "Tháng này" | "Tháng trước" | "Tùy chỉnh";

const VN_TZ = "Asia/Ho_Chi_Minh";
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(Math.round(value));
const moneyDetailed = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

// VN timezone helpers - critical for correct daily aggregation (KiotViet uses VN time)
function toVNDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function getVNParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(date);
  const y = Number(parts.find(p => p.type === "year")?.value);
  const m = Number(parts.find(p => p.type === "month")?.value);
  const d = Number(parts.find(p => p.type === "day")?.value);
  return { y, m, d };
}
function getVNHour(iso: string): number {
  const str = new Intl.DateTimeFormat("en-US", { timeZone: VN_TZ, hour: "2-digit", hour12: false }).format(new Date(iso));
  return Number(str);
}
function getVNWeekdayIndex(iso: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: VN_TZ, weekday: "short" }).format(new Date(iso));
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
}
function getTodayVNKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDaysVNKey(baseKey: string, offset: number): string {
  const [y, m, d] = baseKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const shifted = new Date(utc + offset * 86400000);
  const y2 = shifted.getUTCFullYear();
  const m2 = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d2 = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
}
function getMonthKeyVN(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "2-digit" });
  return fmt.format(date); // YYYY-MM
}
function inRangeVN(value: string, range: DateRange, customStart?: string, customEnd?: string): boolean {
  const key = toVNDateKey(value);
  const todayKey = getTodayVNKey();
  if (range === "Hôm nay") return key === todayKey;
  if (range === "Hôm qua") return key === addDaysVNKey(todayKey, -1);
  if (range === "7 ngày qua") {
    const start = addDaysVNKey(todayKey, -6);
    return key >= start && key <= todayKey;
  }
  if (range === "Tháng này") {
    const curMonth = getMonthKeyVN(new Date());
    return key.startsWith(curMonth);
  }
  if (range === "Tháng trước") {
    const now = new Date();
    const vn = new Date(now.toLocaleString("en-US", { timeZone: VN_TZ }));
    const prev = new Date(Date.UTC(vn.getFullYear(), vn.getMonth() - 1, 1));
    const prevMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
    return key.startsWith(prevMonth);
  }
  if (range === "Tùy chỉnh" && customStart && customEnd) {
    return key >= customStart && key <= customEnd;
  }
  return false;
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

export default function DashboardClient({ profile, products: initialProducts, customers, orders, branches: _branches, truncated }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [modal, setModal] = useState<"product" | "staff" | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("Tháng này");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [chartMode, setChartMode] = useState<"day" | "hour" | "weekday">("day");
  const [rankingMetric, setRankingMetric] = useState<"Doanh thu thuần" | "Số lượng">("Doanh thu thuần");
  const [rankingRange, setRankingRange] = useState<DateRange>("Tháng này");
  const [customerRange, setCustomerRange] = useState<DateRange>("Tháng này");
  const [activityOpen, setActivityOpen] = useState(true);
  const [activityPage, setActivityPage] = useState(0);
  const activityPageSize = 10;

  // Single branch mode - no branch filtering needed
  const filteredOrders = orders;
  const totalActivityPages = Math.max(1, Math.ceil(filteredOrders.length / activityPageSize));
  const paginatedActivities = useMemo(() => filteredOrders.slice(activityPage * activityPageSize, (activityPage + 1) * activityPageSize), [filteredOrders, activityPage]);

  // Alerts derived from REAL data - not fake
  const lowStockProducts = useMemo(() => products.filter(p => p.active && p.stock_quantity <= 5).slice(0, 8), [products]);
  const outOfStockCount = useMemo(() => products.filter(p => p.active && p.stock_quantity === 0).length, [products]);
  const lowStockCount = lowStockProducts.length;

  const todayOrders = useMemo(() => filteredOrders.filter((order) => inRangeVN(order.created_at, "Hôm nay")), [filteredOrders]);
  const todayRevenue = todayOrders.filter((order) => order.status === "paid").reduce((sum, order) => sum + Number(order.total), 0);
  const todayReturns = todayOrders.filter((order) => order.status === "refunded").reduce((sum, order) => sum + Number(order.total), 0);
  const todayInvoiceCount = todayOrders.filter((order) => order.status === "paid").length;
  const todayNet = todayRevenue - todayReturns;
  const todayCustomerCount = useMemo(() => new Set(todayOrders.filter(o => o.status === "paid" && o.customer_id).map(o => o.customer_id)).size, [todayOrders]);

  const yesterdayNet = useMemo(() => {
    const rows = filteredOrders.filter((order) => inRangeVN(order.created_at, "Hôm qua"));
    return rows.filter((order) => order.status === "paid").reduce((sum, order) => sum + Number(order.total), 0)
      - rows.filter((order) => order.status === "refunded").reduce((sum, order) => sum + Number(order.total), 0);
  }, [filteredOrders]);

  const samePeriodLastMonthNet = useMemo(() => {
    const todayKey = getTodayVNKey();
    const [y, m, d] = todayKey.split("-").map(Number);
    const lastMonthKey = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    // Find orders on same day last month (VN)
    const rows = filteredOrders.filter((order) => toVNDateKey(order.created_at) === lastMonthKey);
    return rows.filter((order) => order.status === "paid").reduce((sum, order) => sum + Number(order.total), 0)
      - rows.filter((order) => order.status === "refunded").reduce((sum, order) => sum + Number(order.total), 0);
  }, [filteredOrders]);

  const pctVsYesterday = yesterdayNet !== 0 ? Math.round(((todayNet - yesterdayNet) / Math.abs(yesterdayNet)) * 100) : (todayNet > 0 ? 100 : 0);
  const pctVsLastMonth = samePeriodLastMonthNet !== 0 ? Math.round(((todayNet - samePeriodLastMonthNet) / Math.abs(samePeriodLastMonthNet)) * 100) : (todayNet > 0 ? 100 : 0);

  const chartOrders = useMemo(() => filteredOrders.filter((order) => inRangeVN(order.created_at, dateRange, customStart, customEnd)), [filteredOrders, dateRange, customStart, customEnd]);
  const chartData = useMemo(() => {
    const revenueOf = (items: Order[]) => items.reduce((sum, order) => sum + (order.status === "paid" ? Number(order.total) : order.status === "refunded" ? -Number(order.total) : 0), 0);
    if (chartMode === "hour") {
      const labels = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
      return { labels, values: labels.map((_, hour) => revenueOf(chartOrders.filter((order) => getVNHour(order.created_at) === hour))) };
    }
    if (chartMode === "weekday") {
      const labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
      return { labels, values: labels.map((_, index) => revenueOf(chartOrders.filter((order) => getVNWeekdayIndex(order.created_at) === index))) };
    }
    const grouped = new Map<string, number>();
    for (const order of chartOrders) {
      const key = toVNDateKey(order.created_at);
      grouped.set(key, (grouped.get(key) || 0) + (order.status === "paid" ? Number(order.total) : order.status === "refunded" ? -Number(order.total) : 0));
    }
    const entries = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
    // Label: dd/MM - unique even across months
    return { labels: entries.map(([key]) => {
      const [, m, d] = key.split("-");
      return `${d}/${m}`;
    }), keys: entries.map(([k]) => k), values: entries.map(([, value]) => value) };
  }, [chartMode, chartOrders]);
  const chartTotal = chartData.values.reduce((sum, value) => sum + value, 0);
  const chartMax = Math.max(1, ...chartData.values.map((value) => Math.abs(value)));
  const hasChartData = chartData.values.some(Boolean);

  const topProducts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sku: string; revenue: number; quantity: number }>();
    const rangeFiltered = filteredOrders.filter((item) => item.status === "paid" && inRangeVN(item.created_at, rankingRange, customStart, customEnd));
    for (const order of rangeFiltered) {
      for (const item of order.order_items || []) {
        const pid = item.products?.id || item.products?.sku || `sku-${item.products?.sku || "unknown"}`;
        if (pid.includes("unknown") && !item.products?.name) continue;
        const current = map.get(pid) || { id: pid, name: item.products?.name || "Hàng hóa", sku: item.products?.sku || "", revenue: 0, quantity: 0 };
        current.revenue += Number(item.line_total || 0);
        current.quantity += Number(item.quantity || 0);
        map.set(pid, current);
      }
    }
    return Array.from(map.values()).sort((a, b) => rankingMetric === "Số lượng" ? b.quantity - a.quantity : b.revenue - a.revenue).slice(0, 10);
  }, [filteredOrders, rankingMetric, rankingRange, customStart, customEnd]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; revenue: number; orders: number }>();
    const rangeFiltered = filteredOrders.filter((item) => item.status === "paid" && inRangeVN(item.created_at, customerRange, customStart, customEnd));
    for (const order of rangeFiltered) {
      if (!order.customer_id) continue;
      const current = map.get(order.customer_id) || { id: order.customer_id, name: order.customers?.name || "Khách lẻ", revenue: 0, orders: 0 };
      current.revenue += Number(order.total || 0);
      current.orders += 1;
      if (order.customers?.name) current.name = order.customers.name;
      map.set(order.customer_id, current);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredOrders, customerRange, customStart, customEnd]);

  const profitToday = useMemo(() => {
    // Estimate profit: total - cost*quantity where cost available
    let costSum = 0;
    for (const order of todayOrders.filter(o => o.status === "paid")) {
      for (const item of order.order_items || []) {
        const c = Number(item.products?.cost || 0);
        costSum += c * Number(item.quantity || 0);
      }
    }
    return todayRevenue - costSum;
  }, [todayOrders, todayRevenue]);

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

  function handleExportTopProducts() {
    if (!topProducts.length) return;
    const rows = [["STT","Tên hàng","SKU", rankingMetric === "Số lượng" ? "Số lượng" : "Doanh thu"], ...topProducts.map((p,i)=>[String(i+1),p.name,p.sku, rankingMetric==="Số lượng"? String(p.quantity): String(p.revenue)])];
    const csv = rows.map(r=> r.map(v=> `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`top-products-${getTodayVNKey()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="kv-shell dashboard-page">
    <ManagementHeader profile={profile} active="dashboard" />
    {(dateRange==="Tùy chỉnh" || rankingRange==="Tùy chỉnh" || customerRange==="Tùy chỉnh") && (
      <div className="kv-dashboard-filters" style={{maxWidth:"none", margin:"0 auto", padding:"10px 16px", display:"flex", gap:"10px", alignItems:"center", justifyContent:"flex-end", flexWrap:"wrap", background:"#fff", borderBottom:"1px solid #e6ebef"}}>
        <div style={{display:"flex", gap:"8px", alignItems:"center"}}>
          <span style={{fontSize:"12px", color:"#344054"}}>Tùy chỉnh:</span>
          <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{height:"32px", border:"1px solid #dfe5e9", borderRadius:"6px", padding:"0 8px"}} />
          <span>—</span>
          <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{height:"32px", border:"1px solid #dfe5e9", borderRadius:"6px", padding:"0 8px"}} />
        </div>
      </div>
    )}

    <main className="kv-main">
      {message && <div className="kv-toast-message" role="status">✓ {message}</div>}
      {truncated && <div style={{background:"#fff4e8", border:"1px solid #ffe2b8", color:"#7a4a00", padding:"8px 12px", borderRadius:"6px", fontSize:"12px", marginBottom:"12px"}}>⚠️ Dữ liệu đã đạt giới hạn 1000 đơn hàng gần nhất. Số liệu có thể bị cắt cụt – vui lòng dùng báo cáo bán hàng để xem đầy đủ.</div>}
      <div className="kv-dashboard-grid">
        <div className="kv-main-column">
          <section className="kv-card kv-today-card kv-enter">
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <h2>Kết quả bán hàng hôm nay</h2>
              <span style={{fontSize:"11px", color:"#6b7a8a", border:"1px solid #e6ebef", padding:"4px 8px", borderRadius:"20px"}}>{getTodayVNKey()}</span>
            </div>
            <div className="kv-today-stats">
              <article role="button" tabIndex={0} aria-label="Xem báo cáo bán hàng" title="Click để xem báo cáo bán hàng" style={{cursor:"pointer"}} onClick={()=> window.location.href="/sale-report"} onKeyDown={(e)=> { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); window.location.href="/sale-report"; }}}>
                <span className="kv-stat-icon blue"><DollarSign size={18} /></span>
                <div><small>Doanh thu</small><strong>{money(todayRevenue)}</strong>{todayInvoiceCount > 0 && <p>{todayInvoiceCount} hóa đơn • {todayCustomerCount} khách</p>}</div>
              </article>
              <article role="button" tabIndex={0} aria-label="Xem trả hàng" title="Click để xem trả hàng" style={{cursor:"pointer"}} onClick={()=> window.location.href="/returns"} onKeyDown={(e)=> { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); window.location.href="/returns"; }}}>
                <span className="kv-stat-icon orange"><RotateCcw size={17} /></span>
                <div><small>Trả hàng</small><strong>{money(todayReturns)}</strong><p>{todayOrders.filter(o=>o.status==="refunded").length} phiếu trả</p></div>
              </article>
              <article role="button" tabIndex={0} aria-label="Xem doanh thu thuần" title="Doanh thu thuần = Doanh thu - Trả hàng" style={{cursor:"pointer"}} onClick={()=> window.location.href="/sale-report"} onKeyDown={(e)=> { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); window.location.href="/sale-report"; }}}>
                <span className="kv-stat-icon green"><DollarSign size={18} /></span>
                <div><small>Doanh thu thuần</small><strong>{money(todayNet)}</strong><p style={{color: profitToday>=0?"#14894d":"#c53434"}}>LN ước tính: {money(profitToday)}</p></div>
              </article>
            </div>
            <div className="kv-today-compare">
              <span>So với hôm qua <b className={pctVsYesterday >= 0 ? "up" : "down"}>{pctVsYesterday >= 0 ? "▲" : "▼"} {Math.abs(pctVsYesterday)}%</b></span>
              <span>So với cùng kỳ tháng trước <b className={pctVsLastMonth >= 0 ? "up" : "down"}>{pctVsLastMonth >= 0 ? "▲" : "▼"} {Math.abs(pctVsLastMonth)}%</b></span>
            </div>
          </section>

          <section className="kv-card kv-chart-card kv-enter delay-1">
            <div className="kv-card-title">
              <h2>Doanh thu thuần <b>{moneyDetailed(chartTotal)}</b> <small style={{marginLeft:"6px", color:"#6b7a8a", fontWeight:400}}>{dateRange}</small></h2>
              <div style={{display:"flex", gap:"8px"}}>
                <select aria-label="Khoảng thời gian" value={dateRange} onChange={(event) => setDateRange(event.target.value as DateRange)}>
                  <option>Hôm nay</option><option>Hôm qua</option><option>7 ngày qua</option><option>Tháng này</option><option>Tháng trước</option><option>Tùy chỉnh</option>
                </select>
                <button onClick={()=> {
                  const rows = chartData.labels.map((l,i)=> `${l}: ${money(chartData.values[i])}`).join("\n");
                  navigator.clipboard?.writeText(rows);
                }} title="Sao chép dữ liệu" style={{height:"30px", padding:"0 10px", border:"1px solid #dfe5e9", borderRadius:"4px", background:"#fff", fontSize:"11px"}}>Copy</button>
              </div>
            </div>
            <div className="kv-tabs" role="tablist">
              <button role="tab" aria-selected={chartMode==="day"} className={chartMode === "day" ? "active" : ""} onClick={() => setChartMode("day")}>Theo ngày</button>
              <button role="tab" aria-selected={chartMode==="hour"} className={chartMode === "hour" ? "active" : ""} onClick={() => setChartMode("hour")}>Theo giờ</button>
              <button role="tab" aria-selected={chartMode==="weekday"} className={chartMode === "weekday" ? "active" : ""} onClick={() => setChartMode("weekday")}>Theo thứ</button>
            </div>
            <div className="kv-chart" role="img" aria-label={`Biểu đồ doanh thu ${dateRange}`}>
              <div className="kv-y-axis">
                {hasChartData ? <><span>{money(chartMax)}</span><span>{money(chartMax * .75)}</span><span>{money(chartMax * .5)}</span><span>{money(chartMax * .25)}</span></> : <><span /><span /><span /><span /></>}<span>0</span>
              </div>
              <div className="kv-bars">
                {chartData.values.map((value, index) => {
                  const label = chartData.labels[index];
                  const isNegative = value < 0;
                  return <i key={`${label}-${index}`} title={`${label}: ${money(value)}`} style={{ height: "92%", transform: `scaleY(${value ? Math.max(0.03, Math.abs(value) / chartMax) : 0.02})`, transformOrigin: "bottom", background: isNegative ? "linear-gradient(#ff7b7b,#d32f2f)" : "linear-gradient(#36afea,#0070f4)", opacity: value===0?0.2:1 }}><span>{label}</span></i>;
                })}
              </div>
              {!hasChartData && <div className="kv-no-chart">Chưa có dữ liệu doanh thu trong {dateRange.toLowerCase()}</div>}
            </div>
          </section>

          <div className="kv-rank-grid">
            <section className="kv-card kv-rank-card kv-enter delay-2">
              <div className="kv-card-title">
                <h2>Top 10 hàng bán chạy</h2>
                <div className="kv-rank-filters">
                  <select aria-label="Tiêu chí xếp hạng" value={rankingMetric} onChange={(event) => setRankingMetric(event.target.value as typeof rankingMetric)}><option>Doanh thu thuần</option><option>Số lượng</option></select>
                  <select aria-label="Khoảng thời gian hàng bán chạy" value={rankingRange} onChange={(event) => setRankingRange(event.target.value as DateRange)}><option>Hôm nay</option><option>Hôm qua</option><option>7 ngày qua</option><option>Tháng này</option><option>Tháng trước</option><option>Tùy chỉnh</option></select>
                </div>
              </div>
              {topProducts.length ? <><div className="kv-top-products">{topProducts.map((product, index) => <div key={product.id}><b>{index + 1}</b><span>{product.name}<small>{product.sku}</small></span><strong>{rankingMetric === "Số lượng" ? `${money(product.quantity)} sp` : money(product.revenue)}</strong></div>)}</div>
              <div style={{padding:"10px 17px", borderTop:"1px solid #f0f2f4", display:"flex", gap:"8px"}}>
                <button onClick={handleExportTopProducts} style={{display:"inline-flex", alignItems:"center", gap:"6px", padding:"6px 10px", border:"1px solid #dfe5e9", borderRadius:"4px", background:"#fff", fontSize:"11px"}}><Download size={14}/> Xuất CSV</button>
                <Link href="/product-report" style={{marginLeft:"auto", fontSize:"11px", color:"#0070f4", textDecoration:"none"}}>Xem báo cáo hàng hóa →</Link>
              </div></>
               : <div className="kv-empty"><PackageOpen size={42} /><p>Chưa có dữ liệu {rankingRange.toLowerCase()}</p><small>Hàng bán chạy sẽ hiện khi có hóa đơn {rankingRange.toLowerCase()}</small><button onClick={() => setModal("product")}>Thêm hàng hóa</button></div>}
            </section>
            <section className="kv-card kv-rank-card kv-enter delay-3">
              <div className="kv-card-title">
                <h2>Top 10 khách mua nhiều nhất</h2>
                <select aria-label="Khoảng thời gian khách hàng" value={customerRange} onChange={(event) => setCustomerRange(event.target.value as DateRange)}><option>Hôm nay</option><option>Hôm qua</option><option>7 ngày qua</option><option>Tháng này</option><option>Tháng trước</option><option>Tùy chỉnh</option></select>
              </div>
              {topCustomers.length ? <><div className="kv-top-products">{topCustomers.map((customer, index) => <div key={customer.id}><b>{index + 1}</b><span>{customer.name}<small>{customer.orders} hóa đơn</small></span><strong>{money(customer.revenue)}</strong></div>)}</div>
              <div style={{padding:"10px 17px", borderTop:"1px solid #f0f2f4"}}><Link href="/customer-report" style={{fontSize:"11px", color:"#0070f4", textDecoration:"none"}}>Xem báo cáo khách hàng →</Link></div></>
               : <div className="kv-empty"><ShoppingBag size={42} /><p>Chưa có dữ liệu {customerRange.toLowerCase()}</p><small>Khách hàng thân thiết sẽ hiện khi có giao dịch</small><Link href="/customers" style={{marginTop:"12px", padding:"7px 16px", border:"1px solid #0070f4", borderRadius:"4px", background:"#fff", color:"#0070f4", fontSize:"10px", textDecoration:"none"}}>Quản lý khách hàng</Link></div>}
            </section>
          </div>
        </div>
        <aside className="kv-side-column">
          {/* Real alerts - not fake */}
          <section className="kv-card kv-alert-card kv-enter delay-1" style={{flexDirection:"column", alignItems:"stretch", gap:"10px"}}>
            <div style={{display:"flex", alignItems:"center", gap:"14px", width:"100%"}}>
              <span style={{background: lowStockCount>0||outOfStockCount>0?"#fff4e8":"#eaf9ef", color: lowStockCount>0?"#ff8b12":"#0a9e3a"}}><ShieldAlert size={20} /></span>
              <div style={{flex:1}}>
                {lowStockCount>0 || outOfStockCount>0 ? <><strong>Có <b>{lowStockCount+outOfStockCount} cảnh báo tồn kho</b> cần xử lý.</strong><p style={{margin:"4px 0 0", color:"#8996a3", fontSize:"10px"}}>{outOfStockCount>0? `${outOfStockCount} hết hàng • `: ""}{lowStockCount>0? `${lowStockCount} sắp hết (≤5)`: "Tồn kho ổn định"}</p></>
                : <><strong>Hàng hóa đầy đủ</strong><p style={{margin:"4px 0 0", color:"#8996a3", fontSize:"10px"}}>Không có sản phẩm nào sắp hết</p></>}
              </div>
              <button aria-label={activityOpen ? "Thu gọn" : "Mở rộng"} onClick={() => setActivityOpen((value) => !value)} style={{border:0, background:"transparent", fontSize:"18px"}}>⌄</button>
            </div>
            {(lowStockCount>0||outOfStockCount>0) && <div style={{display:"flex", gap:"8px", flexWrap:"wrap"}}>
              {lowStockProducts.map(p=> <span key={p.id} style={{padding:"4px 8px", background:"#fff4e8", border:"1px solid #ffe2b8", borderRadius:"20px", fontSize:"11px"}}>{p.name} ({p.stock_quantity})</span>)}
              <Link href="/products" style={{fontSize:"11px", color:"#0070f4", alignSelf:"center"}}>Xem tất cả →</Link>
            </div>}
          </section>

          {activityOpen && <section className="kv-card kv-activity kv-enter delay-2">
            <div className="kv-card-title"><h2>Hoạt động gần đây</h2><span style={{fontSize:"11px", color:"#8895a3"}}>{filteredOrders.length} giao dịch</span></div>
            <div className="kv-activity-list" style={{maxHeight:470, overflow:"auto"}}>
              {paginatedActivities.map((order) => {
                const creatorName = order.creator?.full_name || profile.full_name;
                const isReturn = order.status === "refunded";
                return <article key={order.id}><span>{isReturn ? <RotateCcw size={16} /> : <ShoppingBag size={16} />}</span><p><b>{creatorName}</b> vừa <strong>{isReturn ? "trả hàng" : "bán đơn hàng"}</strong> <Link href={`/invoices?code=HD${String(order.order_number).padStart(6, "0")}`}>HD{String(order.order_number).padStart(6, "0")}</Link> với giá trị <strong>{money(Number(order.total))}</strong><small>{timeAgo(order.created_at)} • {new Intl.DateTimeFormat("vi-VN", {timeZone: VN_TZ, hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit"}).format(new Date(order.created_at))}</small></p></article>;
              })}
              {!filteredOrders.length && <div className="kv-empty activity-empty"><Clock3 size={42} /><p>Chưa có hoạt động gần đây</p><small>Hoạt động bán hàng sẽ hiện ở đây theo thời gian thực (VN)</small><button onClick={() => setModal("product")}>Thêm hàng hóa</button></div>}
            </div>
            {filteredOrders.length>activityPageSize && <div style={{padding:"8px 12px", borderTop:"1px solid #eef2f4", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8}}>
              <button disabled={activityPage===0} onClick={()=> setActivityPage(p=> Math.max(0,p-1))} style={{padding:"6px 10px", border:"1px solid #d0d7de", borderRadius:6, background: activityPage===0?"#f5f6f7":"#fff", cursor: activityPage===0?"not-allowed":"pointer", fontSize:11}}>← Trước</button>
              <span style={{fontSize:11, color:"#6b7a8d"}}>Trang {activityPage+1}/{totalActivityPages} • {filteredOrders.length} giao dịch{truncated ? " (giới hạn 1000)" : ""}</span>
              <button disabled={(activityPage+1)*activityPageSize >= filteredOrders.length} onClick={()=> setActivityPage(p=> p+1)} style={{padding:"6px 10px", border:"1px solid #d0d7de", borderRadius:6, background: (activityPage+1)*activityPageSize >= filteredOrders.length?"#f5f6f7":"#fff", cursor: (activityPage+1)*activityPageSize >= filteredOrders.length?"not-allowed":"pointer", fontSize:11}}>Sau →</button>
            </div>}
            {filteredOrders.length>0 && <div style={{padding:"10px 18px", borderTop:"1px solid #eef2f4", display:"flex", justifyContent:"space-between"}}>
              <Link href="/invoices" style={{fontSize:"11px", color:"#0070f4", textDecoration:"none"}}>Xem tất cả hóa đơn →</Link>
              <span style={{fontSize:"11px", color:"#9aa5ae"}}><Users size={12} style={{verticalAlign:"middle"}}/> {new Set(filteredOrders.map(o=>o.created_by)).size} nhân viên</span>
            </div>}
          </section>}

          {/* Quick shortcuts - KiotViet parity */}
          <section className="kv-card kv-enter delay-3" style={{padding:"14px"}}>
            <h3 style={{margin:"0 0 10px", fontSize:"13px"}}>Thao tác nhanh</h3>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px"}}>
              <Link href="/sales" style={{display:"flex", alignItems:"center", gap:"8px", padding:"10px", border:"1px solid #e6ebef", borderRadius:"8px", textDecoration:"none", color:"#1d2939", fontSize:"12px"}}><ShoppingBag size={16} color="#0070f4"/> Bán hàng</Link>
              <Link href="/products" style={{display:"flex", alignItems:"center", gap:"8px", padding:"10px", border:"1px solid #e6ebef", borderRadius:"8px", textDecoration:"none", color:"#1d2939", fontSize:"12px"}}><PackageOpen size={16} color="#1daf61"/> Hàng hóa</Link>
              <Link href="/invoices" style={{display:"flex", alignItems:"center", gap:"8px", padding:"10px", border:"1px solid #e6ebef", borderRadius:"8px", textDecoration:"none", color:"#1d2939", fontSize:"12px"}}><DollarSign size={16} color="#ff8b12"/> Hóa đơn</Link>
              <Link href="/customers" style={{display:"flex", alignItems:"center", gap:"8px", padding:"10px", border:"1px solid #e6ebef", borderRadius:"8px", textDecoration:"none", color:"#1d2939", fontSize:"12px"}}><Users size={16} color="#6941c6"/> Khách hàng</Link>
            </div>
          </section>
        </aside>
      </div>
    </main>
    <a className="kv-help" href="tel:0704040044" aria-label="Liên hệ 0704 04 0044"><MessageCircle size={18} /><span>0704 04 0044</span></a>
    {modal && <div className="modal open" role="dialog" aria-modal="true"><button className="modal-backdrop" aria-label="Đóng" onClick={() => setModal(null)} /><form className="modal-card" onSubmit={modal === "product" ? addProduct : addStaff}><div className="modal-head"><div><h3>{modal === "product" ? "Thêm hàng hóa" : "Tạo tài khoản nhân viên"}</h3><p>{modal === "product" ? "Hàng hóa được lưu vào cơ sở dữ liệu" : "Cấp quyền Quản lý hoặc Bán hàng"}</p></div><button type="button" className="close-btn" onClick={() => setModal(null)}>×</button></div>{modal === "product" ? <div className="form-grid"><label className="full">Tên hàng hóa<input name="name" required /></label><label>Mã hàng<input name="sku" required /></label><label>Giá bán<input name="price" type="number" min="0" required /></label><label>Tồn kho<input name="stock" type="number" min="0" defaultValue="0" /></label></div> : <div className="form-grid"><label className="full">Tên nhân viên<input name="fullName" required /></label><label>Tên đăng nhập<input name="username" required minLength={3} /></label><label>Mật khẩu<input name="password" type="password" required minLength={8} /></label><label>Vai trò<select name="role"><option value="sales">Bán hàng</option><option value="manager">Quản lý</option></select></label></div>}{message && <p className="form-error" role="alert">{message}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Hủy</button><button className="button primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></div></form></div>}
  </div>;
}
