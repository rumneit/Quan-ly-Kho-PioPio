"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Printer, RefreshCw } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";

type Order = {
  id: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  created_at: string;
  order_items?: { quantity: number; products?: { cost?: number | null } | null }[];
};

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(Math.round(value));
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const displayDate = (value: string) => value ? value.split("-").reverse().join("/") : "---";
const months = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

export default function FinancialReportClient({ profile, orders }: { profile: Profile; orders: Order[] }) {
  const today = useMemo(() => new Date(), []);
  const [timeMode, setTimeMode] = useState<"month" | "custom">("custom");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [from, setFrom] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`);
  const [to, setTo] = useState(isoDate(today));
  const [zoom, setZoom] = useState(100);
  const [refreshing, setRefreshing] = useState(false);

  const bounds = useMemo(() => {
    if (timeMode === "custom") return { from, to };
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { from: isoDate(start), to: isoDate(end) };
  }, [timeMode, from, to, year, month]);

  const totals = useMemo(() => {
    const filtered = orders.filter((order) => {
      const day = order.created_at.slice(0, 10);
      return day >= bounds.from && day <= bounds.to;
    });
    const paid = filtered.filter((order) => order.status === "paid");
    const refunded = filtered.filter((order) => order.status === "refunded");
    const sales = paid.reduce((sum, order) => sum + Number(order.subtotal || 0), 0);
    const discount = paid.reduce((sum, order) => sum + Number(order.discount || 0), 0);
    const returns = refunded.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const net = sales - discount - returns;
    const cost = paid.reduce((sum, order) => sum + (order.order_items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0) * Number(item.products?.cost || 0), 0), 0);
    return { sales, discount, returns, net, cost, grossProfit: net - cost };
  }, [orders, bounds]);

  const rows = [
    ["Doanh thu bán hàng (1)", totals.sales, "major"],
    ["Giảm trừ Doanh thu (2 = 2.1 + 2.2)", totals.discount + totals.returns, "major"],
    ["Chiết khấu hóa đơn (2.1)", totals.discount, "child"],
    ["Giá trị hàng bán bị trả lại (2.2)", totals.returns, "child"],
    ["Doanh thu thuần (3 = 1 - 2)", totals.net, "total"],
    ["Giá vốn hàng bán (4)", totals.cost, "major"],
    ["Lợi nhuận gộp về bán hàng (5 = 3 - 4)", totals.grossProfit, "total"],
    ["Chi phí (6)", 0, "major"],
    ["Chi phí voucher", 0, "child"], ["Phí trả ĐTGH", 0, "child"], ["Hoàn tiền cho khách", 0, "child"],
    ["Xuất hủy hàng hóa", 0, "child"], ["Giá trị thanh toán bằng điểm", 0, "child"],
    ["Chiết khấu thanh toán cho khách", 0, "child"], ["Chi trả lương NV", 0, "child"],
    ["Chênh lệch làm tròn nhập hàng", 0, "child"],
    ["Lợi nhuận từ hoạt động kinh doanh (7 = 5 - 6)", totals.grossProfit, "total"],
    ["Thu nhập khác (8)", 0, "major"],
    ["Phí trả hàng", 0, "child"], ["Chênh lệch làm tròn nhập hàng", 0, "child"],
    ["Chênh lệch làm tròn bán hàng", 0, "child"], ["Chiết khấu thanh toán từ NCC", 0, "child"],
    ["Chi phí khác (9)", 0, "major"],
    ["Lợi nhuận thuần (10 = (7 + 8) - 9)", totals.grossProfit, "grand"],
  ] as const;

  function exportCsv() {
    const lines = [["Chỉ tiêu", "Tổng"], ...rows.map(([label, value]) => [label, value])];
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `bao-cao-tai-chinh-${bounds.from}-${bounds.to}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <div className="kv-shell financial-report-page">
    <ManagementHeader profile={profile} active="financial-report" />
    <header className="financial-heading"><h1>Báo cáo tài chính</h1></header>
    <main className="financial-layout">
      <aside className="financial-sidebar">
        <section><h2>Kiểu hiển thị</h2><button className="financial-chip active">Báo cáo</button></section>
        <section><h2>Thời gian</h2>
          <select aria-label="Năm" value={year} onChange={(event) => setYear(Number(event.target.value))}>{Array.from({ length: 5 }, (_, index) => today.getFullYear() - index).map((value) => <option key={value}>{value}</option>)}</select>
          <label className="financial-radio"><input type="radio" checked={timeMode === "month"} onChange={() => setTimeMode("month")} /><select aria-label="Theo tháng" value={month} onChange={(event) => { setMonth(Number(event.target.value)); setTimeMode("month"); }}>{months.map((label, index) => <option value={index} key={label}>{label}</option>)}</select></label>
          <label className="financial-radio"><input type="radio" checked={timeMode === "custom"} onChange={() => setTimeMode("custom")} /><span>Tùy chỉnh</span><CalendarDays size={17} /></label>
          {timeMode === "custom" && <div className="financial-dates"><input aria-label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><span>đến</span><input aria-label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>}
        </section>
      </aside>
      <section className="financial-viewer">
        <div className="financial-viewer-toolbar">
          <div className="financial-toolbar-group"><button disabled title="Trang đầu"><ChevronsLeft size={17} /></button><button disabled title="Trang trước"><ChevronLeft size={17} /></button><span>1 / 1</span><button disabled title="Trang sau"><ChevronRight size={17} /></button><button disabled title="Trang cuối"><ChevronsRight size={17} /></button></div>
          <button title="Làm mới" className={refreshing ? "spin" : ""} onClick={() => { setRefreshing(true); window.setTimeout(() => setRefreshing(false), 450); }}><RefreshCw size={17} /></button>
          <span className="financial-toolbar-spacer" />
          <select aria-label="Thu phóng" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}><option value="75">75%</option><option value="100">100%</option><option value="125">125%</option></select>
          <button onClick={exportCsv}><Download size={17} /> Xuất file</button><button onClick={() => window.print()}><Printer size={17} /> In</button>
        </div>
        <div className="financial-canvas"><article className="financial-paper" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", marginBottom: `${(zoom / 100 - 1) * 1093}px` }}>
          <header><h2>Báo cáo kết quả hoạt động kinh doanh</h2><p>Ngày lập: {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(today)}</p><strong>Chi nhánh trung tâm</strong><p>Từ ngày {displayDate(bounds.from)} đến ngày {displayDate(bounds.to)}</p></header>
          <table><thead><tr><th>Chỉ tiêu</th><th>Tổng</th></tr></thead><tbody>{rows.map(([label, value, kind], index) => <tr className={kind} key={`${label}-${index}`}><td>{label}</td><td>{money(value)}</td></tr>)}</tbody></table>
          <footer>Trang 1 / 1</footer>
        </article></div>
      </section>
    </main>
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>
  </div>;
}
