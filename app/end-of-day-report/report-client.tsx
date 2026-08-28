"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Download, Printer } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";

type SourceOrder = { id: string; order_number: number; status: string; subtotal: number; discount: number; total: number; created_at: string; created_by?: string; customers?: { name?: string; phone?: string } | null; order_items?: { quantity: number }[] };
type CashVoucher = { id: string; voucher_number: number; type: "receipt" | "expense"; kind: string; amount: number; status: string; occurred_at: string; partner_name: string | null; note: string | null };

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const date = (value: Date) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
const dateTime = (value: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const qty = (row: SourceOrder) => (row.order_items || []).reduce((sum, item) => sum + Number(item.quantity), 0);
const voucherCode = (type: "receipt" | "expense", number: number) => `${type === "receipt" ? "PT" : "PC"}${String(number).padStart(6, "0")}`;
const kindLabels: Record<string, string> = { sale_payment: "Thu bán hàng", debt_collection: "Thu công nợ", other_income: "Thu khác", transfer_in: "Thu chuyển khoản", purchase_payment: "Chi mua hàng", debt_payment: "Trả công nợ", other_expense: "Chi khác", transfer_out: "Chi chuyển khoản" };

export default function EndOfDayReportClient({ profile, orders, vouchers }: { profile: Profile; orders: SourceOrder[]; vouchers: CashVoucher[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [display, setDisplay] = useState("Hiển thị dọc");
  const [interest, setInterest] = useState("Bán hàng");
  const [status, setStatus] = useState("paid");
  const [seller, setSeller] = useState("all");
  const [creator, setCreator] = useState("all");
  const [payment, setPayment] = useState("all");
  const [saleMethod, setSaleMethod] = useState("all");

  const rows = useMemo(() => orders.filter((order) => order.created_at.slice(0, 10) === selectedDate && (status === "all" || order.status === status)), [orders, selectedDate, status]);
  const cashRows = useMemo(() => vouchers.filter((voucher) => voucher.occurred_at.slice(0, 10) === selectedDate), [vouchers, selectedDate]);
  const paid = rows.filter((row) => row.status === "paid");
  const revenue = paid.reduce((sum, row) => sum + Number(row.total), 0);
  const gross = paid.reduce((sum, row) => sum + Number(row.subtotal), 0);
  const discount = paid.reduce((sum, row) => sum + Number(row.discount), 0);
  const totalIn = cashRows.filter((voucher) => voucher.type === "receipt" && voucher.status === "completed").reduce((sum, voucher) => sum + Number(voucher.amount), 0);
  const totalOut = cashRows.filter((voucher) => voucher.type === "expense" && voucher.status === "completed").reduce((sum, voucher) => sum + Number(voucher.amount), 0);
  const totalQty = rows.reduce((sum, row) => sum + qty(row), 0);

  function exportCsv() {
    const lines = interest === "Thu chi"
      ? [["Mã phiếu", "Thời gian", "Loại thu chi", "Người nộp/nhận", "Giá trị", "Trạng thái"], ...cashRows.map((voucher) => [voucherCode(voucher.type, voucher.voucher_number), dateTime(voucher.occurred_at), kindLabels[voucher.kind] || voucher.kind, voucher.partner_name || "---", voucher.type === "expense" ? -Number(voucher.amount) : Number(voucher.amount), voucher.status === "cancelled" ? "Đã hủy" : "Hoàn thành"])]
      : [["Mã giao dịch", "Thời gian", "Khách hàng", "Doanh thu", "Thực thu", "SL", "Thu khác", "Làm tròn", "Phí trả hàng", "VAT"], ...rows.map((row) => [`HD${String(row.order_number).padStart(6, "0")}`, dateTime(row.created_at), row.customers?.name || "Khách lẻ", row.total, row.status === "paid" ? row.total : 0, qty(row), 0, 0, 0, 0])];
    const csv = lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `bao-cao-cuoi-ngay-${selectedDate}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const selected = new Date(`${selectedDate}T12:00:00`);

  return (
    <div className={`kv-shell product-page business-page report-page ${display === "Hiển thị ngang" ? "landscape" : ""}`}>
      <ManagementHeader profile={profile} active="end-of-day-report" />
      <div className="report-toolbar">
        <h1>Báo cáo cuối ngày</h1>
        <label>Kiểu hiển thị<select value={display} onChange={(event) => setDisplay(event.target.value)}><option>Hiển thị dọc</option><option>Hiển thị ngang</option></select></label>
        <button onClick={() => window.print()}><Printer size={18} />In báo cáo</button>
        <button onClick={exportCsv}><Download size={18} />Xuất file</button>
      </div>
      <main className="report-workspace">
        <aside className="report-sidebar">
          <section><h2>Mối quan tâm</h2>{["Bán hàng", "Thu chi", "Hàng hóa"].map((value) => <label className="stock-radio" key={value}><input type="radio" name="report-interest" checked={interest === value} onChange={() => setInterest(value)} /><span>{value}</span></label>)}</section>
          <section><h2>Thời gian</h2><label className="report-date"><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /><CalendarDays size={17} /></label></section>
          <section><h2>Trạng thái</h2><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="paid">Đã thanh toán</option><option value="draft">Phiếu tạm</option><option value="cancelled">Đã hủy</option><option value="all">Tất cả</option></select></section>
          <section><h2>Nhân viên</h2><select value={seller} onChange={(event) => setSeller(event.target.value)}><option value="all">Chọn nhân viên</option></select></section>
          <section><h2>Người tạo</h2><select value={creator} onChange={(event) => setCreator(event.target.value)}><option value="all">Chọn người tạo</option><option>{profile.full_name}</option></select></section>
          <section><h2>Phương thức thanh toán</h2><select value={payment} onChange={(event) => setPayment(event.target.value)}><option value="all">Chọn phương thức thanh toán</option><option>Tiền mặt</option><option>Chuyển khoản</option></select></section>
          <section><h2>Phương thức bán hàng</h2><select value={saleMethod} onChange={(event) => setSaleMethod(event.target.value)}><option value="all">Chọn phương thức bán hàng</option><option>Bán trực tiếp</option><option>Giao hàng</option></select></section>
        </aside>
        <section className="report-preview">
          <div className="report-sheet">
            <header><div><h2>Báo cáo cuối ngày về {interest.toLowerCase()}</h2><p>Ngày lập: {date(new Date())}</p></div><strong>PioPio</strong></header>
            <div className="report-meta"><p>Ngày bán: <b>{date(selected)}</b></p><p>Chi nhánh: <b>Chi nhánh trung tâm</b></p><p>Ngày thanh toán: <b>{date(selected)}</b></p></div>
            {interest === "Thu chi" ? (
              <>
                <div className="report-kpis"><article><span>Tổng thu</span><b className="cash-income">{money(totalIn)}</b></article><article><span>Tổng chi</span><b className="cash-expense">{money(totalOut)}</b></article><article><span>Tồn quỹ</span><b>{money(totalIn - totalOut)}</b></article><article><span>Số phiếu</span><b>{cashRows.length}</b></article></div>
                <table>
                  <thead><tr><th>Mã phiếu</th><th>Thời gian</th><th>Loại thu chi</th><th>Người nộp/nhận</th><th>Giá trị</th><th>Trạng thái</th></tr></thead>
                  <tbody>{cashRows.map((voucher) => <tr key={voucher.id}><td>{voucherCode(voucher.type, voucher.voucher_number)}</td><td>{dateTime(voucher.occurred_at)}</td><td>{kindLabels[voucher.kind] || voucher.kind}</td><td>{voucher.partner_name || "---"}</td><td className={voucher.type === "expense" ? "cash-expense" : "cash-income"}>{voucher.type === "expense" ? "-" : "+"}{money(Number(voucher.amount))}</td><td>{voucher.status === "cancelled" ? "Đã hủy" : "Hoàn thành"}</td></tr>)}{!cashRows.length && <tr><td colSpan={6}><div className="report-empty">Báo cáo không có dữ liệu</div></td></tr>}</tbody>
                  <tfoot><tr><th colSpan={4}>Tổng cộng:</th><th>{money(totalIn - totalOut)}</th><th /></tr></tfoot>
                </table>
              </>
            ) : (
              <>
                <div className="report-kpis"><article><span>Doanh thu</span><b>{money(revenue)}</b></article><article><span>Thực thu</span><b>{money(revenue)}</b></article><article><span>Số giao dịch</span><b>{paid.length}</b></article><article><span>Giảm giá</span><b>{money(discount)}</b></article></div>
                <table>
                  <thead><tr><th>Mã giao dịch</th><th>Thời gian</th><th>Khách hàng</th><th>Doanh thu</th><th>Thực thu</th><th>SL</th><th>Thu khác</th><th>Làm tròn</th><th>Phí trả hàng</th><th>VAT</th></tr></thead>
                  <tbody>{rows.map((row) => <tr key={row.id}><td>HD{String(row.order_number).padStart(6, "0")}</td><td>{dateTime(row.created_at)}</td><td>{row.customers?.name || "Khách lẻ"}</td><td>{money(Number(row.total))}</td><td>{row.status === "paid" ? money(Number(row.total)) : 0}</td><td>{qty(row)}</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>)}{!rows.length && <tr><td colSpan={10}><div className="report-empty">Báo cáo không có dữ liệu</div></td></tr>}</tbody>
                  <tfoot><tr><th colSpan={3}>Chi nhánh trung tâm:</th><th>{money(gross)}</th><th>{money(revenue)}</th><th>{totalQty}</th><th>0</th><th>0</th><th>0</th><th>0</th></tr></tfoot>
                </table>
              </>
            )}
            <footer>Trang 1 / 1</footer>
          </div>
        </section>
      </main>
      <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>
    </div>
  );
}