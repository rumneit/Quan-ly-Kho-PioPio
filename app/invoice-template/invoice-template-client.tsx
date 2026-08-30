"use client";

import { useMemo, useState } from "react";
import { Printer, RotateCcw } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import "./invoice-template.css";

type ProductRef = { sku: string; name: string; dvt: string; price: number; tax: number };
type OrderRef = { code: string; createdAt: string; total: number; customer: string; phone: string; address: string; items: Array<{ sku: string; name: string; dvt: string; tax: number; qty: number; price: number }> };
type Row = { ma: string; ten: string; dvt: string; sl: string; dg: string; ghichu: string; tax: number };
const emptyRow = (): Row => ({ ma: "", ten: "", dvt: "", sl: "", dg: "", ghichu: "", tax: 0 });
const money = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));
const num = (v: string) => Number(String(v).replace(/[^\d]/g, "")) || 0;

function docBlock(x: number, full: boolean): string {
  const d = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const tr = Math.floor(x / 100), ch = Math.floor((x % 100) / 10), dv = x % 10;
  let s = "";
  if (full || tr > 0) {
    s += d[tr] + " trăm";
    if (ch === 0 && dv > 0) s += " lẻ";
  }
  if (ch > 1) {
    s += " " + d[ch] + " mươi";
    if (dv === 1) s += " mốt"; else if (dv === 5) s += " lăm"; else if (dv > 0) s += " " + d[dv];
  } else if (ch === 1) {
    s += " mười";
    if (dv === 5) s += " lăm"; else if (dv > 0) s += " " + d[dv];
  } else if (dv > 0) s += " " + d[dv];
  return s.trim();
}

function docSo(n: number): string {
  if (!n) return "không";
  let result = "", started = false, rest = n;
  const scales: Array<[string, number]> = [["tỷ", 1e9], ["triệu", 1e6], ["nghìn", 1e3]];
  for (const [name, val] of scales) {
    const b = Math.floor(rest / val);
    rest %= val;
    if (b > 0) { result += (result ? " " : "") + docBlock(b, started) + " " + name; started = true; }
  }
  if (rest > 0) result += (result ? " " : "") + docBlock(rest, started);
  const out = result.trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export default function InvoiceTemplateClient({ profile, products, orders }: { profile: Profile; products: ProductRef[]; orders: OrderRef[] }) {
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 24 }, emptyRow));
  const [orderCode, setOrderCode] = useState("");
  const [soHD, setSoHD] = useState("");
  const [noiDung, setNoiDung] = useState("Bán Hàng");
  const [ngay, setNgay] = useState(""); const [thang, setThang] = useState(""); const [nam, setNam] = useState("");
  const [khach, setKhach] = useState(""); const [mst, setMst] = useState("");
  const [nguoiMua, setNguoiMua] = useState(""); const [sdt, setSdt] = useState("");
  const [diaChi, setDiaChi] = useState("");

  const productMap = useMemo(() => new Map(products.map((p) => [p.sku.toUpperCase(), p])), [products]);
  const orderMap = useMemo(() => new Map(orders.map((o) => [o.code.toUpperCase(), o])), [orders]);

  const setRow = (i: number, patch: Partial<Row>) => setRows((cur) => cur.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  function applyOrder(codeRaw: string) {
    const code = codeRaw.trim().toUpperCase();
    setOrderCode(codeRaw);
    const order = orderMap.get(code);
    if (!order) return;
    const d = new Date(order.createdAt);
    const items = order.items.map((it) => ({ ma: it.sku, ten: it.name, dvt: it.dvt, sl: String(it.qty), dg: String(it.price), ghichu: "", tax: it.tax || productMap.get(it.sku.toUpperCase())?.tax || 0 }));
    const next = [...items, ...Array.from({ length: Math.max(0, 24 - items.length) }, emptyRow)].slice(0, Math.max(24, items.length));
    setRows(next);
    setSoHD(code);
    setKhach(order.customer);
    setSdt(order.phone);
    setDiaChi(order.address);
    setNgay(String(d.getDate())); setThang(String(d.getMonth() + 1)); setNam(String(d.getFullYear()));
  }

  function applyProduct(i: number, skuRaw: string) {
    const p = productMap.get(skuRaw.trim().toUpperCase());
    if (p) setRow(i, { ma: p.sku, ten: p.name, dvt: p.dvt, dg: p.price ? String(p.price) : "", tax: p.tax });
    else setRow(i, { ma: skuRaw, tax: 0 });
  }

  const lineTotals = rows.map((r) => num(r.sl) * num(r.dg));
  const lineVats = rows.map((r, i) => (lineTotals[i] * Number(r.tax || 0)) / 100);
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const vat = Math.round(lineVats.reduce((a, b) => a + b, 0));
  const total = subtotal + vat;
  const totalWords = docSo(total) + " đồng";

  function resetAll() {
    if (!window.confirm("Xóa trắng toàn bộ hóa đơn?")) return;
    setRows(Array.from({ length: 24 }, emptyRow));
    setOrderCode(""); setSoHD(""); setNoiDung("Bán Hàng"); setNgay(""); setThang(""); setNam("");
    setKhach(""); setMst(""); setNguoiMua(""); setSdt(""); setDiaChi("");
  }

  return <div className="kv-shell invoice-tpl-page">
    <div className="no-print"><ManagementHeader profile={profile} active="invoices" /></div>
    <div className="inv-toolbar no-print">
      <datalist id="inv-orders">{orders.map((o) => <option key={o.code} value={o.code}>{o.customer} · {money(o.total)}đ</option>)}</datalist>
      <datalist id="inv-products">{products.map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}</datalist>
      <label className="inv-order-pick">Đơn hàng: <input list="inv-orders" value={orderCode} onChange={(e) => applyOrder(e.target.value)} placeholder="HD000001..." /></label>
      <button type="button" className="inv-btn primary" onClick={() => window.print()}><Printer size={16} /> In hóa đơn</button>
      <button type="button" className="inv-btn" onClick={resetAll}><RotateCcw size={16} /> Xóa trắng</button>
      <span className="inv-hint">VAT theo từng mặt hàng = <b>{money(vat)}</b> · Tổng: <b>{money(total)}</b></span>
    </div>
    <main className="inv-main no-print-gap">
      <div className="inv-sheet">
        <div className="inv-company">
          <p><b>Tên đơn vị:</b> <input className="inv-line w-company" defaultValue="CTY TNHH SẢN XUẤT THƯƠNG MẠI DỊCH VỤ PIOPIO" /></p>
          <p><b>Địa chỉ:</b> <input className="inv-line w-company" defaultValue="14 đường 16 KDC Bình Hưng, Xã Bình Hưng, Tp.HCM" /></p>
          <p><b>MST:</b> <input className="inv-line w-mst" defaultValue="0319525530" /></p>
          <p><b>Hotline:</b> <input className="inv-line w-hotline" defaultValue="07 0404 0044" /> <b>- Website:</b> <input className="inv-line w-web" defaultValue="piopio.vn" /></p>
        </div>
        <h1 className="inv-title">HÓA ĐƠN BÁN HÀNG</h1>
        <div className="inv-date">
          <span>Ngày</span> <input className="inv-num" value={ngay} onChange={(e) => setNgay(e.target.value)} />
          <span>Tháng</span> <input className="inv-num" value={thang} onChange={(e) => setThang(e.target.value)} />
          <span>Năm</span> <input className="inv-num inv-num-year" value={nam} onChange={(e) => setNam(e.target.value)} />
        </div>
        <div className="inv-info">
          <p><b>Số:</b> <input className="inv-line w-code" value={soHD} onChange={(e) => setSoHD(e.target.value)} placeholder="PIOX........" /> <b>- Nội dung:</b> <input className="inv-line w-content" value={noiDung} onChange={(e) => setNoiDung(e.target.value)} /></p>
          <p><b>Khách hàng:</b> <input className="inv-line w-kh" value={khach} onChange={(e) => setKhach(e.target.value)} /> <b>- MST:</b> <input className="inv-line w-mst2" value={mst} onChange={(e) => setMst(e.target.value)} /></p>
          <p><b>Người mua hàng:</b> <input className="inv-line w-kh" value={nguoiMua} onChange={(e) => setNguoiMua(e.target.value)} /> <b>- SĐT:</b> <input className="inv-line w-sdt" value={sdt} onChange={(e) => setSdt(e.target.value)} /></p>
          <p><b>Địa chỉ:</b> <input className="inv-line w-kh" value={diaChi} onChange={(e) => setDiaChi(e.target.value)} /></p>
        </div>
        <table className="inv-table">
          <thead>
            <tr><th style={{ width: "4%" }}>STT</th><th style={{ width: "10%" }}>Mã SP</th><th style={{ width: "25%" }}>Tên sản phẩm/hàng hóa</th><th style={{ width: "7%" }}>ĐVT</th><th style={{ width: "9%" }}>Số lượng</th><th style={{ width: "12%" }}>Đơn giá</th><th style={{ width: "13%" }}>Thành tiền</th><th style={{ width: "8%" }}>VAT%</th><th style={{ width: "12%" }}>Ghi chú</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="c">{i + 1}</td>
                <td><input className="inv-cell" list="inv-products" value={r.ma} onChange={(e) => applyProduct(i, e.target.value)} /></td>
                <td><input className="inv-cell" value={r.ten} onChange={(e) => setRow(i, { ten: e.target.value })} /></td>
                <td><input className="inv-cell" value={r.dvt} onChange={(e) => setRow(i, { dvt: e.target.value })} /></td>
                <td><input className="inv-cell right" inputMode="numeric" value={r.sl} onChange={(e) => setRow(i, { sl: e.target.value })} /></td>
                <td><input className="inv-cell right" inputMode="numeric" value={r.dg} onChange={(e) => setRow(i, { dg: e.target.value })} /></td>
                <td className="right">{lineTotals[i] ? money(lineTotals[i]) : ""}</td>
                <td className="c">{r.tax ? `${r.tax}%` : ""}</td>
                <td><input className="inv-cell" value={r.ghichu} onChange={(e) => setRow(i, { ghichu: e.target.value })} /></td>
              </tr>
            ))}
            <tr className="vat-row">
              <td colSpan={6} className="right vat-label"><b>VAT</b> (tự tính theo từng mặt hàng)</td>
              <td className="right">{vat ? money(vat) : ""}</td>
              <td colSpan={2} />
            </tr>
            <tr className="total-row">
              <td colSpan={6} className="right"><b>Tổng cộng:</b></td>
              <td className="right"><b>{total ? money(total) : ""}</b></td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
        <p className="inv-words"><b>Tổng số tiền viết bằng chữ:</b> {total ? <i>{totalWords}</i> : <span className="ph">.......................................................................................</span>}</p>
        <div className="inv-date inv-date-footer">
          <span>Ngày</span> <input className="inv-num" value={ngay} onChange={(e) => setNgay(e.target.value)} />
          <span>Tháng</span> <input className="inv-num" value={thang} onChange={(e) => setThang(e.target.value)} />
          <span>Năm</span> <input className="inv-num inv-num-year" value={nam} onChange={(e) => setNam(e.target.value)} />
        </div>
        <div className="inv-signs">
          <div><p className="sign-title">Người nhận hàng<br />(Ký, Họ tên)</p><div className="sign-space" /></div>
          <div><p className="sign-title">Thủ kho<br />(Ký, Họ tên)</p><div className="sign-space" /></div>
          <div><p className="sign-title">Giám đốc<br />(Ký, Họ tên)</p><div className="sign-space" /></div>
        </div>
      </div>
    </main>
  </div>;
}
