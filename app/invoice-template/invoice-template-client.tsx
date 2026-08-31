"use client";

import { useMemo, useState } from "react";
import { Printer, RotateCcw } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import "./invoice-template.css";

type ProductRef = { sku: string; name: string; dvt: string; price: number; tax: number };
type OrderRef = { code: string; createdAt: string; total: number; customer: string; phone: string; address: string; items: Array<{ sku: string; name: string; dvt: string; tax: number; qty: number; price: number }> };
type CustomerRef = { name: string; phone: string; taxCode: string };
type Row = { ma: string; ten: string; dvt: string; sl: string; dg: string; ghichu: string; tax: number };
const emptyRow = (): Row => ({ ma: "", ten: "", dvt: "", sl: "", dg: "", ghichu: "", tax: 0 });

// Định dạng số theo file mẫu: 4,000.00 · 2,320,000 · 185,600 · 2,505,600
const moneyUS = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
const qtyUS = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const parseNum = (v: string) => { const n = Number(String(v).replace(/[,\s]/g, "")); return Number.isFinite(n) ? n : 0; };

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
  const scales: Array<[string, number]> = [["tỷ", 1e9], ["triệu", 1e6], ["ngàn", 1e3]];
  for (const [name, val] of scales) {
    const b = Math.floor(rest / val);
    rest %= val;
    if (b > 0) { result += (result ? " " : "") + docBlock(b, started) + " " + name; started = true; }
  }
  if (rest > 0) result += (result ? " " : "") + docBlock(rest, started);
  const out = result.trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export default function InvoiceTemplateClient({ profile, products, orders, customers }: { profile: Profile; products: ProductRef[]; orders: OrderRef[]; customers: CustomerRef[] }) {
  const todayD = new Date();
  const todayMM = String(todayD.getMonth() + 1).padStart(2, "0");
  const todayYY = String(todayD.getFullYear()).slice(2);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 24 }, emptyRow));
  const [orderCode, setOrderCode] = useState("");
  const [soHD, setSoHD] = useState(`PIOX${todayMM}${todayYY}001`);
  const [noiDung, setNoiDung] = useState("Bán Hàng");
  const [ngay, setNgay] = useState(String(todayD.getDate()));
  const [thang, setThang] = useState(todayMM);
  const [nam, setNam] = useState(String(todayD.getFullYear()));
  const [khach, setKhach] = useState(""); const [mst, setMst] = useState("");
  const [nguoiMua, setNguoiMua] = useState(""); const [sdt, setSdt] = useState("");
  const [diaChi, setDiaChi] = useState("");
  const [focusKey, setFocusKey] = useState("");

  const productMap = useMemo(() => new Map(products.map((p) => [p.sku.toUpperCase(), p])), [products]);
  const orderMap = useMemo(() => new Map(orders.map((o) => [o.code.toUpperCase(), o])), [orders]);
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.name.trim().toUpperCase(), c])), [customers]);

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
    setMst(customerMap.get(order.customer.trim().toUpperCase())?.taxCode || "");
    setSdt(order.phone);
    setDiaChi(order.address);
    setNgay(String(d.getDate())); setThang(String(d.getMonth() + 1)); setNam(String(d.getFullYear()));
  }

  function applyKhach(v: string) {
    setKhach(v);
    const c = customerMap.get(v.trim().toUpperCase());
    if (c?.taxCode) setMst(c.taxCode);
  }

  function applyNguoiMua(v: string) {
    setNguoiMua(v);
    const c = customerMap.get(v.trim().toUpperCase());
    if (c?.phone) setSdt(c.phone);
  }

  function applyProduct(i: number, skuRaw: string) {
    const p = productMap.get(skuRaw.trim().toUpperCase());
    if (p) setRow(i, { ma: p.sku, ten: p.name, dvt: p.dvt, dg: p.price ? String(p.price) : "", tax: p.tax });
    else setRow(i, { ma: skuRaw, tax: 0 });
  }

  const lineTotals = rows.map((r) => parseNum(r.sl) * parseNum(r.dg));
  const lineVats = rows.map((r, i) => (lineTotals[i] * Number(r.tax || 0)) / 100);
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const vat = Math.round(lineVats.reduce((a, b) => a + b, 0));
  const total = subtotal + vat;
  const totalWords = docSo(total) + " đồng";
  const vatBreakdown = useMemo(() => {
    const m = new Map<number, number>();
    rows.forEach((r, i) => { const t = Number(r.tax || 0); if (t && lineTotals[i]) m.set(t, (m.get(t) || 0) + lineVats[i]); });
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]).map(([t, v]) => `VAT ${t}%: ${moneyUS(Math.round(v))}`).join("  ·  ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, lineTotals.join("|")]);

  // STT chỉ đánh cho dòng có nội dung (y chang file)
  const sttMap = useMemo(() => {
    const m = new Map<number, number>();
    let n = 0;
    rows.forEach((r, i) => { if (r.ma.trim() || r.ten.trim() || r.sl.trim() || r.dg.trim()) { n += 1; m.set(i, n); } });
    return m;
  }, [rows]);

  function resetAll() {
    if (!window.confirm("Xóa trắng toàn bộ hóa đơn?")) return;
    setRows(Array.from({ length: 24 }, emptyRow));
    setOrderCode("");
    setSoHD(`PIOX${todayMM}${todayYY}001`);
    setNoiDung("Bán Hàng");
    setNgay(String(todayD.getDate())); setThang(todayMM); setNam(String(todayD.getFullYear()));
    setKhach(""); setMst(""); setNguoiMua(""); setSdt(""); setDiaChi("");
  }

  return <div className="kv-shell invoice-tpl-page">
    <div className="no-print"><ManagementHeader profile={profile} active="invoices" /></div>
    <div className="inv-toolbar no-print">
      <datalist id="inv-orders">{orders.map((o) => <option key={o.code} value={o.code}>{o.customer} · {moneyUS(o.total)}</option>)}</datalist>
      <datalist id="inv-products">{products.map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}</datalist>
      <datalist id="inv-customers">{customers.map((c) => <option key={c.name} value={c.name}>{c.phone}{c.taxCode ? ` · MST ${c.taxCode}` : ""}</option>)}</datalist>
      <label className="inv-order-pick">Đơn hàng: <input list="inv-orders" value={orderCode} onChange={(e) => applyOrder(e.target.value)} placeholder="HD000001..." /></label>
      <button type="button" className="inv-btn primary" onClick={() => window.print()}><Printer size={16} /> In hóa đơn</button>
      <button type="button" className="inv-btn" onClick={resetAll}><RotateCcw size={16} /> Xóa trắng</button>
      <span className="inv-hint" title={vatBreakdown}>VAT = <b>{moneyUS(vat)}</b> · Tổng: <b>{moneyUS(total)}</b></span>
    </div>
    <main className="inv-main no-print-gap">
      <div className="inv-sheet">
        <div className="inv-header">
          <div className="inv-header-left">
            <p><b>Tên đơn vị:</b> CTY TNHH SẢN XUẤT THƯƠNG MẠI DỊCH VỤ PIOPIO</p>
            <p><b>Địa chỉ:</b> 14 đường 16 KDC Bình Hưng, Xã Bình Hưng, Tp.HCM</p>
            <p><b>Hotline:</b> 07 0404 0044 - <b>Website:</b> piopio.vn</p>
          </div>
          <div className="inv-header-right">
            <p className="inv-mau-so"><b>Mẫu số : 02 - VT</b></p>
            <p className="inv-qd-note">(Ban hành theo QĐ 15/2006/QĐ-BTC ngày 20/03/2006<br />của Bộ Trưởng Bộ Tài Chính)</p>
          </div>
        </div>
        <h1 className="inv-title">HÓA ĐƠN BÁN HÀNG</h1>
        <div className="inv-date">
          <span>Ngày</span> <input className="inv-num" value={ngay} onChange={(e) => setNgay(e.target.value)} />
          <span>Tháng</span> <input className="inv-num" value={thang} onChange={(e) => setThang(e.target.value)} />
          <span>Năm</span> <input className="inv-num inv-num-year" value={nam} onChange={(e) => setNam(e.target.value)} />
        </div>
        <div className="inv-info">
          <p><b>Số:</b> <input className="inv-line w-code" value={soHD} onChange={(e) => setSoHD(e.target.value)} placeholder="PIOX........" /> <b>- Nội dung:</b> <input className="inv-line w-content" value={noiDung} onChange={(e) => setNoiDung(e.target.value)} /></p>
          <p><b>Khách hàng:</b> <input className="inv-line w-kh" list="inv-customers" value={khach} onChange={(e) => applyKhach(e.target.value)} /> <b>- MST:</b> <input className="inv-line w-mst2" value={mst} onChange={(e) => setMst(e.target.value)} /></p>
          <p><b>Người mua hàng:</b> <input className="inv-line w-kh" list="inv-customers" value={nguoiMua} onChange={(e) => applyNguoiMua(e.target.value)} /> <b>- SĐT:</b> <input className="inv-line w-sdt" value={sdt} onChange={(e) => setSdt(e.target.value)} /></p>
          <p><b>Địa chỉ:</b> <input className="inv-line w-kh" value={diaChi} onChange={(e) => setDiaChi(e.target.value)} /></p>
        </div>
        <table className="inv-table">
          <thead>
            <tr><th style={{ width: "5%" }}>STT</th><th style={{ width: "11%" }}>Mã SP</th><th style={{ width: "26%" }}>Tên sản phẩm/hàng hóa</th><th style={{ width: "8%" }}>ĐVT</th><th style={{ width: "12%" }}>Số lượng</th><th style={{ width: "12%" }}>Đơn giá</th><th style={{ width: "14%" }}>Thành tiền</th><th style={{ width: "12%" }}>Ghi chú</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const filled = Boolean(r.ma.trim() || r.ten.trim() || r.sl.trim() || r.dg.trim());
              const slRaw = r.sl.trim();
              return (
                <tr key={i}>
                  <td className="c">{sttMap.get(i) ?? ""}</td>
                  <td><input className="inv-cell" list="inv-products" value={r.ma} onChange={(e) => applyProduct(i, e.target.value)} /></td>
                  <td><input className="inv-cell" value={r.ten} onChange={(e) => setRow(i, { ten: e.target.value })} /></td>
                  <td><input className="inv-cell" value={r.dvt} onChange={(e) => setRow(i, { dvt: e.target.value })} /></td>
                  <td className={slRaw ? "right" : "c"}>
                    <input className="inv-cell" inputMode="decimal"
                      style={{ textAlign: slRaw ? "right" : "center", color: slRaw ? undefined : "#9aa4b0" }}
                      title={Number(r.tax) ? `VAT ${r.tax}%: ${moneyUS(Math.round(lineVats[i]))}` : undefined}
                      value={focusKey === `sl${i}` ? r.sl : (slRaw ? qtyUS(parseNum(r.sl)) : "-")}
                      onFocus={() => { setFocusKey(`sl${i}`); if (!slRaw) setRow(i, { sl: "" }); }}
                      onBlur={() => { setFocusKey(""); if (!parseNum(r.sl)) setRow(i, { sl: "" }); }}
                      onChange={(e) => setRow(i, { sl: e.target.value.replace(/[^\d.,]/g, "") })} />
                  </td>
                  <td><input className="inv-cell right" inputMode="decimal" value={r.dg} onChange={(e) => setRow(i, { dg: e.target.value.replace(/[^\d.,]/g, "") })} /></td>
                  <td className="right" title={Number(r.tax) ? `VAT ${r.tax}%` : undefined}>{lineTotals[i] ? moneyUS(lineTotals[i]) : ""}</td>
                  <td><input className="inv-cell" value={r.ghichu} onChange={(e) => setRow(i, { ghichu: e.target.value })} /></td>
                </tr>
              );
            })}
            <tr className="vat-row">
              <td colSpan={3} />
              <td className="c"><b>VAT</b></td>
              <td colSpan={2} />
              <td className="right" title={vatBreakdown}>{vat ? moneyUS(vat) : ""}</td>
              <td />
            </tr>
            <tr className="total-row">
              <td><b>Tổng cộng:</b></td>
              <td colSpan={5} />
              <td className="right"><b>{total ? moneyUS(total) : ""}</b></td>
              <td />
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
