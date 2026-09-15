"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Printer, RotateCcw } from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import "./invoice-template.css";

type ProductRef = { sku: string; name: string; dvt: string; price: number; tax: number };
type OrderRef = { code: string; createdAt: string; total: number; discount: number; vatPercent: number; vatAmount: number; shipFee: number; customer: string; phone: string; address: string; items: Array<{ sku: string; name: string; dvt: string; tax: number; qty: number; price: number }> };
type CustomerRef = { name: string; phone: string; taxCode: string; debt: number };
type Row = { ma: string; ten: string; dvt: string; sl: string; dg: string; ghichu: string; tax: number };
const emptyRow = (): Row => ({ ma: "", ten: "", dvt: "", sl: "", dg: "", ghichu: "", tax: 0 });

// Định dạng số theo file mẫu: 4,000.00 · 2,320,000 · 185,600 · 2,505,600
// GIỮ en-US theo mẫu 02-VT — không đổi sang vi-VN
const moneyUS = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
const qtyUS = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
// Số lượng: số nguyên thì không hiện .00
const fmtQty = (n: number) => Number.isInteger(n) ? moneyUS(n) : qtyUS(n);
// Tiền luôn có chữ đ sau để khách dễ nhận diện
const moneyVnd = (n: number) => `${moneyUS(n)}đ`;
// Tên SP: càng ngắn càng to, càng dài càng nhỏ — luôn 1 dòng
const nameFontPx = (ten: string, paper: string) => {
  const len = ten.trim().length;
  const base = len <= 14 ? 20 : len <= 22 ? 18 : len <= 32 ? 16 : len <= 45 ? 14 : 12.5;
  return `${(paper === "a5-p" ? base * 0.72 : base).toFixed(1)}px`;
};
// Nhận cả kiểu VN "1.000.000" lẫn kiểu US "1,000,000" — không âm thầm thành 1
const parseNum = (v: string) => {
  let s = String(v).replace(/\s/g, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/[.,]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

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
  if (!Number.isFinite(n) || Math.abs(n) >= 1e15) return moneyUS(Math.round(n)) + " đồng (viết bằng số)";
  let result = "", started = false, rest = Math.round(n);
  const scales: Array<[string, number]> = [["nghìn tỷ", 1e12], ["tỷ", 1e9], ["triệu", 1e6], ["ngàn", 1e3]];
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
  const [feeDiscount, setFeeDiscount] = useState(0);
  const [feeVatPercent, setFeeVatPercent] = useState(0);
  const [feeVatAmount, setFeeVatAmount] = useState(0);
  const [feeShip, setFeeShip] = useState(0);
  const [paper, setPaper] = useState("a5-l");
  const [debt, setDebt] = useState(0);
  const [orderMissing, setOrderMissing] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);

  // Tự co tỷ lệ để TOÀN BỘ bill luôn gọn trong 1 mặt giấy (chỉ dùng như an toàn cuối, min 0.85)
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const printableMm = paper === "a5-p" ? 198 : 138; // A5 dọc 210-12 / A5 ngang 148-10
    const availPx = (printableMm / 25.4) * 96;
    // Bỏ min-height 280mm của khung xem trước khi đo, nếu không scrollHeight luôn phình to -> zoom luôn 0.85 -> chữ in ra bị nhỏ/mờ
    const prevMin = el.style.minHeight;
    el.style.minHeight = "0px";
    const contentPx = el.scrollHeight;
    el.style.minHeight = prevMin;
    const scale = Math.min(1, availPx / Math.max(1, contentPx));
    const rounded = Math.max(0.85, Math.floor(scale * 100) / 100);
    setFitScale((prev) => (Math.abs(prev - rounded) > 0.01 ? rounded : prev));
  });
  const filledCount = rows.filter((r) => r.ma.trim() || r.ten.trim() || r.sl.trim() || r.dg.trim()).length;

  // Khổ giấy + chiều in: @page động theo lựa chọn, lưu lại cho lần sau
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("piopio-inv-paper") : null;
    if (saved === "a5-l" || saved === "a5-p") setPaper(saved);
    else {
      try {
        const pos = JSON.parse(window.localStorage.getItem("piopio-print-settings") || "{}");
        setPaper(pos.paper === "a5-p" || pos.paper === "A5-doc" ? "a5-p" : "a5-l");
      } catch {}
    }
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      const found = orders.some((o) => o.code.toUpperCase() === code.toUpperCase());
      if (found) applyOrder(code);
      else setOrderMissing(code);
    }
  }, []);
  useEffect(() => {
    let tag = document.getElementById("inv-page-size") as HTMLStyleElement | null;
    if (!tag) { tag = document.createElement("style"); tag.id = "inv-page-size"; document.head.appendChild(tag); }
    const size = paper === "a5-p" ? "A5 portrait; margin:6mm" : "A5 landscape; margin:5mm";
    tag.textContent = `@media print{ @page{ size:${size} } .inv-sheet{ zoom:${fitScale} !important } }`;
    window.localStorage.setItem("piopio-inv-paper", paper);
  }, [paper, fitScale]);

  const orderMap = useMemo(() => new Map(orders.map((o) => [o.code.toUpperCase(), o])), [orders]);
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.name.trim().toUpperCase(), c])), [customers]);

  const setRow = (i: number, patch: Partial<Row>) => setRows((cur) => cur.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  function applyOrder(codeRaw: string) {
    const code = codeRaw.trim().toUpperCase();
    setOrderCode(codeRaw);
    const order = orderMap.get(code);
    if (!order) return;
    const d = new Date(order.createdAt);
    const items = order.items.map((it) => ({ ma: it.sku, ten: it.name, dvt: it.dvt, sl: String(it.qty), dg: String(it.price), ghichu: "", tax: it.tax || 0 }));
    const next = [...items, ...Array.from({ length: Math.max(0, 24 - items.length) }, emptyRow)].slice(0, Math.max(24, items.length));
    setRows(next);
    setSoHD(code);
    setKhach(order.customer);
    setMst(customerMap.get(order.customer.trim().toUpperCase())?.taxCode || "");
    setSdt(order.phone);
    setDiaChi(order.address);
    setDebt(customerMap.get(order.customer.trim().toUpperCase())?.debt || 0);
    setFeeDiscount(order.discount || 0);
    setFeeVatPercent(order.vatPercent || 0);
    setFeeVatAmount(order.vatAmount || 0);
    setFeeShip(order.shipFee || 0);
    setNgay(String(d.getDate())); setThang(String(d.getMonth() + 1)); setNam(String(d.getFullYear()));
  }

  function applyKhach(v: string) {
    setKhach(v);
    const c = customerMap.get(v.trim().toUpperCase());
    if (c?.taxCode) setMst(c.taxCode);
    setDebt(c?.debt || 0);
  }

  function applyNguoiMua(v: string) {
    setNguoiMua(v);
    const c = customerMap.get(v.trim().toUpperCase());
    if (c?.phone) setSdt(c.phone);
  }

  const lineTotals = rows.map((r) => parseNum(r.sl) * parseNum(r.dg));
  const totalQty = rows.reduce((sum, r) => sum + (parseNum(r.sl) || 0), 0);
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const total = Math.max(0, Math.round(subtotal + feeVatAmount + feeShip - feeDiscount));
  const totalWords = docSo(total) + " đồng";

  // STT chỉ đánh cho dòng có nội dung (y chang file)
  const sttMap = useMemo(() => {
    const m = new Map<number, number>();
    let n = 0;
    rows.forEach((r, i) => { if (r.ma.trim() || r.ten.trim() || r.sl.trim() || r.dg.trim()) { n += 1; m.set(i, n); } });
    return m;
  }, [rows]);

  // Chỉ hiện dòng có hàng — hóa đơn đã chốt không có dòng trống
  const visibleRows = useMemo(() => rows.map((r, i) => ({ r, i })).filter(({ r }) => Boolean(r.ma.trim() || r.ten.trim() || r.sl.trim() || r.dg.trim())).map(({ i }) => i), [rows]);

  function resetAll() {
    if (!window.confirm("Xóa trắng toàn bộ hóa đơn?")) return;
    setRows(Array.from({ length: 24 }, emptyRow));
    setOrderCode("");
    setSoHD(`PIOX${todayMM}${todayYY}001`);
    setNoiDung("Bán Hàng");
    setNgay(String(todayD.getDate())); setThang(todayMM); setNam(String(todayD.getFullYear()));
    setKhach(""); setMst(""); setNguoiMua(""); setSdt(""); setDiaChi("");
    setDebt(0);
    setFeeDiscount(0); setFeeVatPercent(0); setFeeVatAmount(0); setFeeShip(0);
  }

  return <div className={`kv-shell invoice-tpl-page inv-paper-a5 ${paper === "a5-l" ? "inv-landscape" : ""} ${filledCount > 10 ? "inv-dense" : ""}`}>
    <div className="no-print"><ManagementHeader profile={profile} active="invoices" /></div>
    {orderMissing && <div className="no-print" style={{ margin: "8px 16px 0", padding: "10px 14px", border: "1px solid #f0c3c3", borderRadius: 8, background: "#fff0f0", color: "#a33131", fontSize: 13 }}>Không tìm thấy hóa đơn <b>{orderMissing}</b> trong 200 hóa đơn đã thanh toán gần nhất. Hãy chọn lại mã ở ô "Đơn hàng" bên dưới rồi bấm In.</div>}
    <div className="inv-toolbar no-print">
      <datalist id="inv-orders">{orders.map((o) => <option key={o.code} value={o.code}>{o.customer} · {moneyUS(o.total)}</option>)}</datalist>
      <datalist id="inv-products">{products.map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}</datalist>
      <datalist id="inv-customers">{customers.map((c) => <option key={c.name} value={c.name}>{c.phone}{c.taxCode ? ` · MST ${c.taxCode}` : ""}</option>)}</datalist>
      <label className="inv-order-pick">Đơn hàng: <input list="inv-orders" value={orderCode} onChange={(e) => applyOrder(e.target.value)} placeholder="HD000001..." /></label>
      <label className="inv-order-pick">Khổ giấy: <select value={paper} onChange={(e) => setPaper(e.target.value)} style={{ height: 34, border: "1px solid #cfd6de", borderRadius: 6, background: "#fff", padding: "0 6px" }}><option value="a5-l">A5 ngang</option><option value="a5-p">A5 dọc</option></select></label>
      <button type="button" className="inv-btn primary" onClick={() => window.print()}><Printer size={16} /> In hóa đơn</button>
      <button type="button" className="inv-btn" onClick={resetAll}><RotateCcw size={16} /> Xóa trắng</button>
      <span className="inv-hint">{feeVatAmount > 0 && <span>VAT: <b>{moneyVnd(feeVatAmount)}</b> · </span>}{feeShip > 0 && <span>Ship: <b>{moneyVnd(feeShip)}</b> · </span>}{feeDiscount > 0 && <span>Chiết khấu: <b>{moneyVnd(feeDiscount)}</b> · </span>}Tổng: <b>{moneyVnd(total)}</b></span>
    </div>
    <main className="inv-main no-print-gap">
      <div className="inv-sheet" ref={sheetRef}>
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
          <p><b>Số:</b> <input className="inv-line w-code" value={soHD} onChange={(e) => setSoHD(e.target.value)} placeholder="PIOX........" /><span className="print-value">{soHD}</span> <b>- Nội dung:</b> <input className="inv-line w-content" value={noiDung} onChange={(e) => setNoiDung(e.target.value)} /><span className="print-value"> {noiDung}</span></p>
          <p><b>Khách hàng:</b> <input className="inv-line w-kh" list="inv-customers" value={khach} onChange={(e) => applyKhach(e.target.value)} /><span className="print-value">{khach}</span> <b>- MST:</b> <input className="inv-line w-mst2" value={mst} onChange={(e) => setMst(e.target.value)} /><span className="print-value">{mst}</span></p>
          <p><b>Người mua hàng:</b> <input className="inv-line w-kh" list="inv-customers" value={nguoiMua} onChange={(e) => applyNguoiMua(e.target.value)} /><span className="print-value">{nguoiMua}</span> <b>- SĐT:</b> <input className="inv-line w-sdt" value={sdt} onChange={(e) => setSdt(e.target.value)} /><span className="print-value">{sdt}</span></p>
          <p><b>Địa chỉ:</b> <input className="inv-line w-kh" value={diaChi} onChange={(e) => setDiaChi(e.target.value)} /><span className="print-value">{diaChi}</span></p>
        </div>
        <table className="inv-table">
          <thead>
            <tr><th scope="col" style={{ width: "5%" }}>STT</th><th scope="col" style={{ width: "40%" }}>Tên sản phẩm/hàng hóa</th><th scope="col" style={{ width: "11%" }}>ĐVT</th><th scope="col" style={{ width: "9%" }}>Số lượng</th><th scope="col" style={{ width: "15%" }}>Đơn giá</th><th scope="col" style={{ width: "20%" }}>Thành tiền</th></tr>
          </thead>
          <tbody>
            {visibleRows.map((i) => {
              const r = rows[i];
              const slRaw = r.sl.trim();
              return (
                <tr key={i}>
                  <td className="c">{sttMap.get(i) ?? ""}</td>
                  <td style={{ fontSize: nameFontPx(r.ten, paper) }}><input className="inv-cell" aria-label={`Tên SP dòng ${i + 1}`} value={r.ten} onChange={(e) => setRow(i, { ten: e.target.value })} /><span className="print-value">{r.ten}</span></td>
                  <td><input className="inv-cell" aria-label={`ĐVT dòng ${i + 1}`} value={r.dvt} onChange={(e) => setRow(i, { dvt: e.target.value })} /><span className="print-value">{r.dvt}</span></td>
                  <td className={slRaw ? "right" : "c"}>
                    <input className="inv-cell" inputMode="decimal" aria-label={`Số lượng dòng ${i + 1}`}
                      style={{ textAlign: "center", color: slRaw ? undefined : "#9aa4b0" }}
                      value={focusKey === `sl${i}` ? r.sl : (slRaw ? fmtQty(parseNum(r.sl)) : "")}
                      onFocus={() => { setFocusKey(`sl${i}`); if (!slRaw) setRow(i, { sl: "" }); }}
                      onBlur={() => { setFocusKey(""); if (!parseNum(r.sl)) setRow(i, { sl: "" }); }}
                      onChange={(e) => setRow(i, { sl: e.target.value.replace(/[^\d.,]/g, "") })} />
                    <span className="print-value">{slRaw ? fmtQty(parseNum(r.sl)) : ""}</span>
                  </td>
                  <td className="right"><input className="inv-cell right" inputMode="decimal" aria-label={`Đơn giá dòng ${i + 1}`} value={r.dg} onChange={(e) => setRow(i, { dg: e.target.value.replace(/[^\d.,]/g, "") })} /><span className="print-value">{r.dg ? moneyVnd(parseNum(r.dg)) : ""}</span></td>
                  <td className="right">{lineTotals[i] ? moneyVnd(lineTotals[i]) : ""}</td>
                </tr>
              );
            })}
            {feeVatAmount > 0 && <tr className="vat-row">
              <td colSpan={2} /><td className="c">VAT{feeVatPercent ? ` (${feeVatPercent}%)` : ""}</td><td /><td /><td>{moneyVnd(feeVatAmount)}</td>
            </tr>}
            {feeShip > 0 && <tr className="vat-row">
              <td colSpan={2} /><td className="c">Phí ship</td><td /><td /><td>{moneyVnd(feeShip)}</td>
            </tr>}
            {feeDiscount > 0 && <tr className="vat-row">
              <td colSpan={2} /><td className="c">Chiết khấu</td><td /><td /><td>-{moneyVnd(feeDiscount)}</td>
            </tr>}
            {debt > 0 && <tr className="vat-row debt-row">
              <td colSpan={2} /><td className="c">Công nợ</td><td /><td /><td>{moneyVnd(debt)}</td>
            </tr>}
            <tr className="total-row">
              <td colSpan={2} style={{ whiteSpace: "nowrap" }}><b>Tổng cộng:</b></td>
              <td /><td><b>{totalQty ? fmtQty(totalQty) : ""}</b></td><td />
              <td><b style={{ whiteSpace: "nowrap" }}>{total ? moneyVnd(total) : ""}</b></td>
            </tr>
          </tbody>
        </table>
        <p className="inv-words"><b>Tổng số tiền viết bằng chữ:</b> {total ? <i>{totalWords}</i> : <span className="ph">.......................................................................................</span>}</p>
        <div className="inv-signs">
          <div><p className="sign-title">Người nhận hàng<br />(Ký, Họ tên)</p><div className="sign-space" /></div>
          <div><p className="sign-title">Người giao hàng<br />(Ký, Họ tên)</p><div className="sign-space" /></div>
        </div>
      </div>
    </main>
  </div>;
}
