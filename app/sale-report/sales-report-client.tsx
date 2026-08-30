"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Download } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import { getTodayVnKey, toVnDateKey, VN_TZ } from "@/lib/vn-time";

type OrderItem = {
  quantity: number;
  line_total: number;
  products?: { cost?: number | null } | null;
};

type Order = {
  id: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  created_at: string;
  branch_id?: string | null;
  channel?: string | null;
  payment_method?: string | null;
  created_by?: string | null;
  order_items?: OrderItem[];
};
type Branch = { id: string; name: string; is_default: boolean };
type Seller = { id: string; full_name: string };

type SaleRow = {
  id: string;
  label: string;
  orders: number;
  quantity: number;
  gross: number;
  discount: number;
  returns: number;
  net: number;
  cost: number;
  profit: number;
};

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const formatDay = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: VN_TZ, day: "2-digit", month: "2-digit" }).format(new Date(value));
function monthKeyVn(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "2-digit" }).format(new Date(iso));
}

function totalsOf(rows: SaleRow[]) {
  return rows.reduce(
    (sum, row) => ({
      orders: sum.orders + row.orders,
      quantity: sum.quantity + row.quantity,
      gross: sum.gross + row.gross,
      discount: sum.discount + row.discount,
      returns: sum.returns + row.returns,
      net: sum.net + row.net,
      cost: sum.cost + row.cost,
      profit: sum.profit + row.profit,
    }),
    { orders: 0, quantity: 0, gross: 0, discount: 0, returns: 0, net: 0, cost: 0, profit: 0 },
  );
}

export default function SalesReportClient({ profile, orders, branches, sellers, truncated }: { profile: Profile; orders: Order[]; branches: Branch[]; sellers: Seller[]; truncated?: boolean }) {
  const [view, setView] = useState<"chart" | "data">("chart");
  const [interest, setInterest] = useState("Thời gian");
  const [range, setRange] = useState("Tuần này");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [priceBook, setPriceBook] = useState("all");
  const [branchId, setBranchId] = useState("all");
  const [saleMethod, setSaleMethod] = useState("all");
  const [channel, setChannel] = useState("all");
  const [seller, setSeller] = useState("all");
  const [vat, setVat] = useState<"excluded" | "included">("excluded");

  const filteredOrders = useMemo(() => {
    const todayKey = getTodayVnKey();
    const curMonthKey = new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "2-digit" }).format(new Date());
    // compute yesterday key
    const [y, m, d] = todayKey.split("-").map(Number);
    const yestDate = new Date(Date.UTC(y, m - 1, d - 1));
    const yestKey = `${yestDate.getUTCFullYear()}-${String(yestDate.getUTCMonth() + 1).padStart(2, "0")}-${String(yestDate.getUTCDate()).padStart(2, "0")}`;
    const weekStart = (() => {
      // VN week starts Monday; compute start of week for todayKey
      const base = new Date(Date.UTC(y, m - 1, d));
      // get VN weekday: Monday=1 .. Sunday=7
      const vnWeekday = new Intl.DateTimeFormat("en-US", { timeZone: VN_TZ, weekday: "short" }).format(new Date());
      const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
      const offset = map[vnWeekday] ?? 0;
      const startUTC = Date.UTC(y, m - 1, d - offset);
      const sd = new Date(startUTC);
      return `${sd.getUTCFullYear()}-${String(sd.getUTCMonth() + 1).padStart(2, "0")}-${String(sd.getUTCDate()).padStart(2, "0")}`;
    })();
    return orders.filter((order) => {
      const key = toVnDateKey(order.created_at);
      const inRange =
        range === "Toàn thời gian" ||
        range === "Tùy chỉnh" ||
        (range === "Hôm nay" && key === todayKey) ||
        (range === "Hôm qua" && key === yestKey) ||
        (range === "7 ngày qua" && (() => {
          const start = new Date(Date.UTC(y, m - 1, d - 6));
          const sKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
          return key >= sKey && key <= todayKey;
        })()) ||
        (range === "Tuần này" && key >= weekStart && key <= todayKey) ||
        (range === "Tháng này" && monthKeyVn(order.created_at) === curMonthKey);
      const customOk =
        range !== "Tùy chỉnh" ||
        ((!from || key >= from) && (!to || key <= to));
      const branchOk = branchId === "all" || order.branch_id === branchId;
      const sellerOk = seller === "all" || order.created_by === seller;
      const channelOk = channel === "all" || (order.channel || "direct") === channel;
      const saleMethodOk = saleMethod === "all" || (order.channel || "direct") === saleMethod;
      // priceBook and vat are display-only; keep filter pass but noted as not filtering data (P0: avoid fake filtering)
      void priceBook; void vat;
      return inRange && customOk && branchOk && sellerOk && channelOk && saleMethodOk;
    });
  }, [orders, range, from, to, branchId, seller, channel, saleMethod, priceBook, vat]);

  const rows = useMemo<SaleRow[]>(() => {
    const groups = new Map<string, SaleRow>();
    for (const order of filteredOrders) {
      const key = toVnDateKey(order.created_at);
      const row = groups.get(key) || {
        id: key,
        label: formatDay(order.created_at),
        orders: 0,
        quantity: 0,
        gross: 0,
        discount: 0,
        returns: 0,
        net: 0,
        cost: 0,
        profit: 0,
      };
      const quantity = (order.order_items || []).reduce((sum, item) => sum + Number(item.quantity), 0);
      const cost = (order.order_items || []).reduce(
        (sum, item) => sum + Number(item.quantity) * Number(item.products?.cost || 0),
        0,
      );
      row.orders += 1;
      row.quantity += quantity;
      row.gross += Number(order.subtotal || 0);
      row.discount += Number(order.discount || 0);
      if (order.status === "refunded") row.returns += Number(order.total || 0);
      if (order.status === "paid") {
        row.net += Number(order.total || 0);
        row.cost += cost;
      }
      row.profit = row.net - row.cost;
      groups.set(key, row);
    }
    return Array.from(groups.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [filteredOrders]);

  const totals = totalsOf(rows);
  const metric: keyof Pick<SaleRow, "gross" | "net" | "profit" | "discount" | "returns"> =
    interest === "Lợi nhuận"
      ? "profit"
      : interest === "Giảm giá hóa đơn"
        ? "discount"
        : interest === "Trả hàng"
          ? "returns"
          : "net";
  const max = Math.max(1, ...rows.map((row) => Math.abs(row[metric])));

  function exportCsv() {
    const lines = [
      ["Thời gian", "Số hóa đơn", "Số lượng", "Doanh thu", "Giảm giá", "Trả hàng", "Doanh thu thuần", "Giá vốn", "Lợi nhuận"],
      ...rows.map((row) => [row.label, row.orders, row.quantity, row.gross, row.discount, row.returns, row.net, row.cost, row.profit]),
    ];
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "bao-cao-ban-hang.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="kv-shell sale-report-page">
      <ManagementHeader profile={profile} active="sale-report" />
      <header className="sale-report-heading">
        <h1>Báo cáo bán hàng</h1>
        <button type="button" onClick={exportCsv}><Download size={17} /> Xuất file</button>
      </header>
      <main className="sale-report-layout">
        <aside className="sale-report-sidebar">
          <section>
            <h2>Kiểu hiển thị</h2>
            <div className="sale-report-chips" role="group" aria-label="Kiểu hiển thị">
              <button className={view === "chart" ? "active" : ""} onClick={() => setView("chart")}>Biểu đồ</button>
              <button className={view === "data" ? "active" : ""} onClick={() => setView("data")}>Báo cáo</button>
            </div>
          </section>
          <section>
            <h2>Mối quan tâm</h2>
            <select value={interest} onChange={(event) => setInterest(event.target.value)}>
              <option>Thời gian</option>
              <option>Lợi nhuận</option>
              <option>Giảm giá hóa đơn</option>
              <option>Trả hàng</option>
              <option>Nhân viên</option>
              <option>Khách hàng</option>
            </select>
          </section>
          <section>
            <h2>Bảng giá</h2>
            <select value={priceBook} onChange={(event) => setPriceBook(event.target.value)}>
              <option value="all">Chọn bảng giá</option>
              <option value="general">Bảng giá chung</option>
            </select>
            <p style={{fontSize:"11px", color:"#8895a3", marginTop:"4px"}}>Áp dụng 1 bảng giá chung (chưa tách theo chi nhánh).</p>
          </section>
          <section>
            <h2>Chi nhánh</h2>
            <select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="all">Tất cả chi nhánh</option>{branches.map(b=> <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </section>
          <section>
            <h2>Thời gian</h2>
            <label className="sale-report-radio">
              <input type="radio" checked={range !== "Tùy chỉnh"} onChange={() => setRange("Tuần này")} />
              <select value={range === "Tùy chỉnh" ? "Tuần này" : range} onChange={(event) => setRange(event.target.value)}>
                <option>Hôm nay</option><option>Hôm qua</option><option>7 ngày qua</option><option>Tuần này</option><option>Tháng này</option><option>Toàn thời gian</option>
              </select>
            </label>
            <label className="sale-report-radio">
              <input type="radio" checked={range === "Tùy chỉnh"} onChange={() => setRange("Tùy chỉnh")} />
              <span>Tùy chỉnh</span><CalendarDays size={17} />
            </label>
            {range === "Tùy chỉnh" && <div className="sale-report-dates"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>}
          </section>
          <section>
            <h2>Phương thức bán hàng</h2>
            <select value={saleMethod} onChange={(event) => setSaleMethod(event.target.value)}><option value="all">Tất cả phương thức</option><option value="direct">Bán trực tiếp</option><option value="delivery">Giao hàng</option></select>
          </section>
          <section>
            <h2>Kênh bán</h2>
            <select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="all">Tất cả kênh bán</option><option value="direct">Bán trực tiếp</option><option value="delivery">Giao hàng</option><option value="facebook">Facebook</option><option value="website">Website</option></select>
          </section>
          <section>
            <h2>Nhân viên</h2>
            <select value={seller} onChange={(event) => setSeller(event.target.value)}><option value="all">Tất cả nhân viên</option>{sellers.map(s=> <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
          </section>
          <section>
            <h2>Thuế</h2>
            <div className="sale-report-chips" role="group" aria-label="Thuế">
              <button className={vat === "excluded" ? "active" : ""} onClick={() => setVat("excluded")}>Chưa bao gồm thuế</button>
              <button className={vat === "included" ? "active" : ""} onClick={() => setVat("included")}>Đã bao gồm thuế</button>
            </div>
          </section>
        </aside>

        <section className="sale-report-content">
          {truncated && <div style={{background:"#fff4e8", border:"1px solid #ffe2b8", color:"#7a4a00", padding:"8px 12px", borderRadius:"6px", fontSize:"12px", marginBottom:"12px"}}>⚠️ Dữ liệu đã đạt giới hạn 1.000 đơn. Hãy thu hẹp khoảng thời gian để tránh thiếu dữ liệu.</div>}
          {view === "chart" ? (
            <div className="sale-report-chart-card">
              <h2>{interest === "Thời gian" ? `Doanh thu thuần ${range.toLowerCase()}` : `${interest} ${range.toLowerCase()}`}</h2>
              <div className="sale-chart-area">
                <div className="sale-chart-y"><span>{money(max)}</span><span>{money(max / 2)}</span><span>0</span></div>
                <div className="sale-chart-grid">
                  <i /><i /><i />
                  <div className="sale-chart-bars">
                    {rows.map((row) => <div className="sale-chart-column" key={row.id}><span>{row[metric] ? money(row[metric]) : ""}</span><b style={{ height: `${Math.max(1, Math.abs(row[metric]) / max * 100)}%` }} /><em>{row.label}</em></div>)}
                  </div>
                </div>
              </div>
              {!rows.length && <div className="sale-chart-empty">Không có dữ liệu trong khoảng thời gian này</div>}
            </div>
          ) : (
            <div className="sale-report-table-card">
              <table><thead><tr><th>Thời gian</th><th>Số hóa đơn</th><th>Doanh thu</th><th>Giảm giá</th><th>Trả hàng</th><th>Doanh thu thuần</th><th>Giá vốn</th><th>Lợi nhuận</th></tr></thead>
                <tbody>{rows.map((row) => <tr key={row.id}><td>{row.label}</td><td>{row.orders}</td><td>{money(row.gross)}</td><td>{money(row.discount)}</td><td>{money(row.returns)}</td><td>{money(row.net)}</td><td>{money(row.cost)}</td><td>{money(row.profit)}</td></tr>)}</tbody>
                <tfoot><tr><th>Tổng cộng</th><th>{totals.orders}</th><th>{money(totals.gross)}</th><th>{money(totals.discount)}</th><th>{money(totals.returns)}</th><th>{money(totals.net)}</th><th>{money(totals.cost)}</th><th>{money(totals.profit)}</th></tr></tfoot>
              </table>
              {!rows.length && <div className="sale-report-table-empty">Báo cáo không có dữ liệu</div>}
            </div>
          )}
        </section>
      </main>
      <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>
    </div>
  );
}
