"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Columns3,
  Copy,
  Download,
  HelpCircle,
  Inbox,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  Truck,
  X,
} from "lucide-react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import { VN_PROVINCES } from "@/app/lib/vietnam-data";
import FilterPopover from "@/app/products/filter-popover";

export type Mode = "orders" | "invoices" | "returns" | "delivery-partners" | "waybills";
type Product = { id: string; sku: string; name: string; price: number; stock_quantity: number };
type Customer = { id: string; customer_number?: number | null; name: string; phone?: string | null };
type OrderItem = { id: string; product_id: string; quantity: number; unit_price: number; line_total: number; products?: { sku?: string; name?: string } | null };
type ShipmentSummary = { id: string; shipment_number: number; status: string; partner_id?: string | null; area?: string | null; cod_amount?: number; collected_cod?: number; shipping_fee?: number; partner_fee?: number; delivery_at?: string | null; delivery_partners?: { name?: string } | null };

export type SourceOrder = {
  id: string;
  order_number: number;
  customer_id?: string | null;
  branch_id?: string | null;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  note?: string | null;
  channel?: string | null;
  payment_method?: string | null;
  created_at: string;
  updated_at?: string;
  customers?: Customer | null;
  creator?: { full_name?: string } | null;
  store_branches?: { name?: string } | null;
  order_items?: OrderItem[];
  shipments?: ShipmentSummary[];
  sales_returns?: Array<{ id: string; return_number: number }>;
};

export type SourceReturn = {
  id: string;
  return_number: number;
  order_id: string;
  status: string;
  subtotal: number;
  refund_amount: number;
  note?: string | null;
  created_at: string;
  updated_at?: string;
  creator?: { full_name?: string } | null;
  orders?: { id: string; order_number: number; customer_id?: string | null; created_at: string; customers?: Customer | null; creator?: { full_name?: string } | null; shipments?: Array<{ status: string }> } | null;
  sales_return_items?: OrderItem[];
};

export type DeliveryPartner = {
  id: string;
  partner_number: number;
  name: string;
  phone?: string | null;
  active: boolean;
  shipments?: Array<{ status: string; cod_amount?: number; collected_cod?: number; shipping_fee?: number; partner_fee?: number }>;
};

export type SourceShipment = {
  id: string;
  shipment_number: number;
  order_id: string;
  partner_id?: string | null;
  status: string;
  receiver_name: string;
  receiver_phone?: string | null;
  address?: string | null;
  area?: string | null;
  service?: string | null;
  cod_amount: number;
  collected_cod: number;
  shipping_fee: number;
  partner_fee: number;
  note?: string | null;
  created_at: string;
  delivery_at?: string | null;
  completed_at?: string | null;
  updated_at?: string;
  delivery_partners?: { id: string; name: string } | null;
  orders?: { id: string; order_number: number; customer_id?: string | null; total: number; customers?: Customer | null } | null;
  creator?: { full_name?: string } | null;
  shipment_status_history?: Array<{ id: string; status: string; note?: string | null; created_at: string }>;
};

type GridRow = {
  id: string;
  status: string;
  values: Record<string, string | number>;
  raw: SourceOrder | SourceReturn | DeliveryPartner | SourceShipment;
};
type Column = { key: string; label: string };
type Config = {
  title: string;
  placeholder: string;
  columns: Column[];
  visible: string[];
  filters: string[];
  statusLabels: Record<string, string>;
};
type DateCriterion = { preset: "month" | "custom" | "all"; from: string; to: string };

const columns = (pairs: Array<[string, string]>): Column[] => pairs.map(([key, label]) => ({ key, label }));
const configs: Record<Mode, Config> = {
  orders: {
    title: "Đặt hàng",
    placeholder: "Theo mã phiếu đặt",
    columns: columns([["waybill", "Mã vận đơn"], ["code", "Mã đặt hàng"], ["invoice", "Mã hóa đơn"], ["time", "Thời gian"], ["createdAt", "Thời gian tạo"], ["updatedAt", "Ngày cập nhật"], ["deliveryAt", "Thời gian giao hàng"], ["customerCode", "Mã KH"], ["customer", "Khách hàng"], ["phone", "Điện thoại"], ["partner", "Đối tác giao hàng"], ["creator", "Người tạo"], ["channel", "Kênh bán"], ["note", "Ghi chú"], ["subtotal", "Tổng tiền hàng"], ["discount", "Giảm giá"], ["payable", "Khách cần trả"], ["paid", "Khách đã trả"], ["status", "Trạng thái"]]),
    visible: ["code", "time", "customerCode", "customer", "payable", "paid", "status"],
    filters: ["Thời gian", "Trạng thái", "Đối tác giao hàng", "Thời gian giao hàng", "Khu vực giao hàng", "Phương thức thanh toán", "Người tạo", "Người nhận đặt", "Kênh bán"],
    statusLabels: { draft: "Phiếu tạm", paid: "Hoàn thành", cancelled: "Đã hủy", refunded: "Đã trả hàng" },
  },
  invoices: {
    title: "Hóa đơn",
    placeholder: "Theo mã hóa đơn",
    columns: columns([["code", "Mã hóa đơn"], ["waybill", "Mã vận đơn"], ["deliveryStatus", "Trạng thái giao hàng"], ["time", "Thời gian"], ["returnCode", "Mã trả hàng"], ["customerCode", "Mã KH"], ["customer", "Khách hàng"], ["phone", "Điện thoại"], ["creator", "Người tạo"], ["partner", "Đối tác giao hàng"], ["note", "Ghi chú"], ["subtotal", "Tổng tiền hàng"], ["discount", "Giảm giá"], ["payable", "Khách cần trả"], ["paid", "Khách đã trả"], ["cod", "Còn cần thu (COD)"], ["shippingFee", "Phí trả ĐTGH"], ["status", "Trạng thái"]]),
    visible: ["code", "time", "returnCode", "customerCode", "customer", "subtotal", "discount", "paid"],
    filters: ["Thời gian", "Giao hàng", "Trạng thái hóa đơn", "Trạng thái giao hàng", "Đối tác giao hàng", "Thời gian giao hàng", "Khu vực giao hàng", "Phương thức thanh toán", "Người tạo", "Người bán", "Kênh bán"],
    statusLabels: { paid: "Hoàn thành", refunded: "Đã trả hàng" },
  },
  returns: {
    title: "Trả hàng",
    placeholder: "Theo mã phiếu trả",
    columns: columns([["code", "Mã trả hàng"], ["invoice", "Mã hóa đơn"], ["seller", "Người bán"], ["time", "Thời gian"], ["customerCode", "Mã KH"], ["customer", "Khách hàng"], ["creator", "Người tạo"], ["note", "Ghi chú"], ["subtotal", "Tổng tiền hàng"], ["payable", "Cần trả khách"], ["paid", "Đã trả khách"], ["status", "Trạng thái"], ["deliveryStatus", "Trạng thái giao hàng"]]),
    visible: ["code", "seller", "time", "customerCode", "customer", "subtotal", "payable", "paid", "status", "deliveryStatus"],
    filters: ["Loại trả hàng", "Trạng thái", "Thời gian", "Người tạo", "Người nhận trả", "Kênh bán"],
    statusLabels: { completed: "Đã trả", cancelled: "Đã hủy" },
  },
  "delivery-partners": {
    title: "Đối tác giao hàng",
    placeholder: "",
    columns: columns([["code", "Mã đối tác"], ["partner", "Tên đối tác"], ["orders", "Tổng đơn hàng"], ["cod", "Cần thu hộ (COD)"], ["remainingCod", "Còn cần thu (COD)"], ["shippingFee", "Tổng phí giao hàng"], ["payable", "Còn cần trả ĐTGH"]]),
    visible: ["code", "partner", "orders", "cod", "remainingCod", "shippingFee", "payable"],
    filters: [],
    statusLabels: { active: "Đang hoạt động", inactive: "Ngừng hoạt động" },
  },
  waybills: {
    title: "Vận đơn",
    placeholder: "Theo mã vận đơn",
    columns: columns([["code", "Mã vận đơn"], ["createdAt", "Thời gian tạo"], ["completedAt", "Thời gian hoàn thành"], ["creator", "Người tạo"], ["invoice", "Mã hóa đơn"], ["customerCode", "Mã KH"], ["customer", "Khách hàng"], ["receiver", "Người nhận"], ["phone", "Điện thoại"], ["address", "Địa chỉ"], ["area", "Khu vực"], ["partner", "Đối tác giao hàng"], ["deliveryNote", "Ghi chú giao hàng"], ["deliveryStatus", "Trạng thái giao"], ["deliveryAt", "Thời gian giao hàng"], ["cod", "Cần thu hộ (COD)"], ["shippingFee", "Tổng cước phí"], ["partnerFee", "Phí trả ĐTGH"]]),
    visible: ["code", "createdAt", "invoice", "customerCode", "customer", "partner", "deliveryStatus", "deliveryAt", "cod"],
    filters: ["Trạng thái giao hàng", "Đối tác giao hàng", "Thời gian tạo", "Thời gian hoàn thành", "Khu vực giao hàng", "Thu hộ tiền (COD)"],
    statusLabels: { pending_pickup: "Chờ lấy hàng", picked_up: "Đã lấy hàng", delivering: "Đang giao", delivered: "Giao thành công", failed: "Giao thất bại", returning: "Đang hoàn hàng", returned: "Đã hoàn hàng", cancelled: "Đã hủy" },
  },
};

const moneyKeys = new Set(["subtotal", "discount", "payable", "paid", "cod", "remainingCod", "shippingFee", "partnerFee"]);
const dateKeys = new Set(["time", "createdAt", "updatedAt", "completedAt", "deliveryAt"]);
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const vnDateString = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const isSameVnMonth = (a: Date, b: Date) => {
  const fa = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(a);
  const fb = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(b);
  return fa === fb;
};
const dateTime = (value: unknown) => {
  if (!value || value === "---") return "---";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "---" : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(parsed);
};
const documentCode = (prefix: string, value: number | undefined) => value == null ? "---" : `${prefix}${String(value).padStart(6, "0")}`;
const customerCode = (customer?: Customer | null) => customer?.customer_number ? `KH${String(customer.customer_number).padStart(6, "0")}` : "---";

function orderRow(order: SourceOrder, mode: "orders" | "invoices"): GridRow {
  const shipment = order.shipments?.[0];
  const code = documentCode(mode === "orders" ? "DH" : "HD", order.order_number);
  const isPaid = order.status === "paid" || order.status === "refunded";
  const branchName = order.store_branches?.name || "---";
  return {
    id: order.id,
    status: order.status,
    raw: order,
    values: {
      code,
      invoice: isPaid ? documentCode("HD", order.order_number) : "---",
      waybill: shipment ? documentCode("VD", shipment.shipment_number) : "---",
      returnCode: order.sales_returns?.[0] ? documentCode("TH", order.sales_returns[0].return_number) : "---",
      time: order.created_at,
      createdAt: order.created_at,
      updatedAt: order.updated_at || order.created_at,
      deliveryAt: shipment?.delivery_at || "---",
      customerCode: customerCode(order.customers),
      customer: order.customers?.name || "Khách lẻ",
      branch: branchName,
      phone: order.customers?.phone || "---",
      partner: shipment?.delivery_partners?.name || "---",
      area: shipment?.area || "---",
      creator: order.creator?.full_name || "---",
      channel: order.channel === "direct" ? "Bán trực tiếp" : order.channel || "---",
      paymentMethod: order.payment_method || "---",
      note: order.note || "---",
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      payable: Number(order.total),
      paid: isPaid ? Number(order.total) : 0,
      cod: Math.max(0, Number(shipment?.cod_amount || 0) - Number(shipment?.collected_cod || 0)),
      shippingFee: Number(shipment?.partner_fee || 0),
      deliveryStatus: shipment?.status || "---",
      status: order.status,
    },
  };
}

function returnRow(item: SourceReturn): GridRow {
  const order = item.orders;
  return {
    id: item.id,
    status: item.status,
    raw: item,
    values: {
      code: documentCode("TH", item.return_number),
      invoice: order ? documentCode("HD", order.order_number) : "---",
      seller: order?.creator?.full_name || "---",
      time: item.created_at,
      customerCode: customerCode(order?.customers),
      customer: order?.customers?.name || "Khách lẻ",
      creator: item.creator?.full_name || "---",
      note: item.note || "---",
      subtotal: Number(item.subtotal),
      payable: Number(item.refund_amount),
      paid: item.status === "completed" ? Number(item.refund_amount) : 0,
      status: item.status,
      deliveryStatus: order?.shipments?.[0]?.status || "---",
    },
  };
}

function partnerRow(partner: DeliveryPartner): GridRow {
  const shipments = partner.shipments || [];
  const collectable = shipments.filter((item) => item.status !== "cancelled" && item.status !== "returned");
  const cod = collectable.reduce((sum, item) => sum + Number(item.cod_amount || 0), 0);
  const collected = collectable.reduce((sum, item) => sum + Number(item.collected_cod || 0), 0);
  const shippingFee = collectable.reduce((sum, item) => sum + Number(item.shipping_fee || 0), 0);
  const partnerFee = collectable.reduce((sum, item) => sum + Number(item.partner_fee || 0), 0);
  return { id: partner.id, status: partner.active ? "active" : "inactive", raw: partner, values: { code: documentCode("DTGH", partner.partner_number), partner: partner.name, orders: shipments.length, cod, remainingCod: Math.max(0, cod - collected), shippingFee, payable: Math.max(0, partnerFee) } };
}

function shipmentRow(shipment: SourceShipment): GridRow {
  const order = shipment.orders;
  return {
    id: shipment.id,
    status: shipment.status,
    raw: shipment,
    values: {
      code: documentCode("VD", shipment.shipment_number),
      createdAt: shipment.created_at,
      completedAt: shipment.completed_at || "---",
      creator: shipment.creator?.full_name || "---",
      invoice: order ? documentCode("HD", order.order_number) : "---",
      customerCode: customerCode(order?.customers),
      customer: order?.customers?.name || shipment.receiver_name,
      receiver: shipment.receiver_name,
      phone: shipment.receiver_phone || order?.customers?.phone || "---",
      address: shipment.address || "---",
      area: shipment.area || "---",
      partner: shipment.delivery_partners?.name || "---",
      deliveryNote: shipment.note || "---",
      deliveryStatus: shipment.status,
      deliveryAt: shipment.delivery_at || "---",
      cod: Math.max(0, Number(shipment.cod_amount) - Number(shipment.collected_cod)),
      shippingFee: Number(shipment.shipping_fee),
      partnerFee: Number(shipment.partner_fee),
    },
  };
}

function DetailPanel({ row, mode, statusLabel }: { row: GridRow; mode: Mode; statusLabel: string }) {
  const items = "order_items" in row.raw ? row.raw.order_items : "sales_return_items" in row.raw ? row.raw.sales_return_items : undefined;
  const history = "shipment_status_history" in row.raw ? row.raw.shipment_status_history : undefined;
  const shipment = "shipment_status_history" in row.raw ? row.raw : null;
  const order = "order_items" in row.raw ? row.raw : null;
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState("");
  const [collectedCod, setCollectedCod] = useState(() => String(shipment?.cod_amount || 0));
  const nextStatuses: Record<string, string[]> = { pending_pickup: ["picked_up", "cancelled"], picked_up: ["delivering", "returning"], delivering: ["delivered", "failed", "returning"], failed: ["delivering", "returning"], returning: ["returned"] };
  async function transitionShipment(status: string) {
    if (!shipment) return;
    setTransitioning(true); setTransitionError("");
    try {
      const response = await fetch("/api/waybills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: shipment.id, status, collected_cod: status === "delivered" ? Number(collectedCod) : null }) });
      const result = await response.json();
      if (!response.ok) { setTransitionError(result.error || "Không thể cập nhật vận đơn."); return; }
      window.location.reload();
    } catch {
      setTransitionError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setTransitioning(false);
    }
  }
  async function transitionOrder(status: "paid" | "cancelled") {
    if (!order) return;
    setTransitioning(true); setTransitionError("");
    try {
      const response = await fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, status }) });
      const result = await response.json();
      if (!response.ok) { setTransitionError(result.error || "Không thể cập nhật đơn hàng."); return; }
      window.location.reload();
    } catch {
      setTransitionError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setTransitioning(false);
    }
  }
  return <div className="order-detail-panel">
    <div className="order-detail-summary"><strong>{String(row.values.code)}</strong><span>{statusLabel}</span><span>Thời gian: {dateTime(row.values.time || row.values.createdAt)}</span><span>Khách hàng: {String(row.values.customer || row.values.partner || "---")}</span><span>Tổng tiền: {money(Number(row.values.payable || row.values.cod || 0))}</span></div>
    {items?.length ? <table className="order-detail-items"><thead><tr><th>Mã hàng</th><th>Tên hàng</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.products?.sku || "---"}</td><td>{item.products?.name || "---"}</td><td>{item.quantity}</td><td>{money(Number(item.unit_price))}</td><td>{money(Number(item.line_total))}</td></tr>)}</tbody></table> : null}
    {history?.length ? <div className="shipment-timeline">{history.map((item) => <p key={item.id}><b>{configs.waybills.statusLabels[item.status] || item.status}</b><span>{dateTime(item.created_at)}</span>{item.note && <small>{item.note}</small>}</p>)}</div> : null}
    {shipment?.status === "delivering" ? <label className="shipment-cod-field">COD thực thu<input type="number" min="0" max={shipment.cod_amount} value={collectedCod} onChange={(event) => setCollectedCod(event.target.value)} /></label> : null}
    {order?.status === "draft" ? <div className="shipment-actions"><button type="button" disabled={transitioning} onClick={() => transitionOrder("paid")}>Hoàn thành</button><button type="button" disabled={transitioning} onClick={() => transitionOrder("cancelled")}>Hủy phiếu</button></div> : null}
    {shipment && nextStatuses[shipment.status]?.length ? <div className="shipment-actions">{nextStatuses[shipment.status].map((status) => <button type="button" key={status} disabled={transitioning} onClick={() => transitionShipment(status)}>{configs.waybills.statusLabels[status]}</button>)}</div> : null}
    {transitionError && <p className="order-form-error" role="alert">{transitionError}</p>}
    {!items?.length && !history?.length && mode !== "delivery-partners" && <p className="order-detail-empty">Chứng từ chưa có dữ liệu chi tiết bổ sung.</p>}
  </div>;
}

export default function OrderListClient({
  mode,
  profile,
  products,
  customers,
  initialOrders,
  initialReturns = [],
  initialPartners = [],
  initialShipments = [],
  dataWarning = "",
  serverPage,
  serverPageSize,
  serverTotal,
}: {
  mode: Mode;
  profile: Profile;
  products: Product[];
  customers: Customer[];
  initialOrders: SourceOrder[];
  initialReturns?: SourceReturn[];
  initialPartners?: DeliveryPartner[];
  initialShipments?: SourceShipment[];
  dataWarning?: string;
  serverPage?: number;
  serverPageSize?: number;
  serverTotal?: number;
}) {
  const config = configs[mode];
  const seeded = useMemo(() => {
    if (mode === "orders") return initialOrders.map((item) => orderRow(item, "orders"));
    if (mode === "invoices") return initialOrders.filter((item) => item.status === "paid" || item.status === "refunded").map((item) => orderRow(item, "invoices"));
    if (mode === "returns") return initialReturns.map(returnRow);
    if (mode === "delivery-partners") return initialPartners.map(partnerRow);
    return initialShipments.map(shipmentRow);
  }, [initialOrders, initialPartners, initialReturns, initialShipments, mode]);
  const [rows, setRows] = useState<GridRow[]>(seeded);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(serverPage || 1);
  const [pageSize, setPageSize] = useState(serverPageSize || 15);
  const [dateFilters, setDateFilters] = useState<Record<string, DateCriterion>>(() => Object.fromEntries(config.filters.filter((label) => label.includes("Thời gian")).map((label, index) => [label, { preset: index === 0 ? "month" : "all", from: "", to: "" }])));
  const [statuses, setStatuses] = useState<string[]>(Object.keys(config.statusLabels));
  const [deliveryStatuses, setDeliveryStatuses] = useState<string[]>([...Object.keys(configs.waybills.statusLabels), "---"]);
  const [deliveryPresence, setDeliveryPresence] = useState<"all" | "yes" | "no">("all");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [codFilter, setCodFilter] = useState<"all" | "yes" | "no">("all");
  const [areaAnchor, setAreaAnchor] = useState<HTMLElement | null>(null);
  const [areaSearch, setAreaSearch] = useState("");
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(config.columns.map((column) => [column.key, config.visible.includes(column.key)])));
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({ key: mode === "delivery-partners" ? "partner" : "time", direction: "desc" });
  const [showColumns, setShowColumns] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState(dataWarning);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [availableProducts, setAvailableProducts] = useState(products);
  const [returnedOrderIds, setReturnedOrderIds] = useState(() => new Set(initialOrders.filter((order) => order.sales_returns?.length).map((order) => order.id)));
  const [shippedOrderIds, setShippedOrderIds] = useState(() => new Set(initialOrders.filter((order) => order.shipments?.length).map((order) => order.id)));
  const [customerId, setCustomerId] = useState("");
  const [note, setNote] = useState("");
  const [discountInput, setDiscountInput] = useState("0");
  const [productQuery, setProductQuery] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>(() => Object.fromEntries(products.map((product) => [product.id, Number(product.price)])));
  const [returnOrderId, setReturnOrderId] = useState("");
  const [partnerTab, setPartnerTab] = useState<"integrated" | "other">("integrated");
  const [partnerForm, setPartnerForm] = useState({ name: "", phone: "" });
  const [shipmentForm, setShipmentForm] = useState({ order_id: "", partner_id: "", receiver_name: "", receiver_phone: "", address: "", area: "", cod_amount: "0", shipping_fee: "0", partner_fee: "0", note: "" });
  const firstSearch = useRef(false);

  useEffect(() => {
    if (firstSearch.current) return;
    firstSearch.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) setQuery(code);
    const invoice = params.get("invoice");
    if (mode === "returns" && invoice && initialOrders.some((order) => order.id === invoice && order.status === "paid" && !order.sales_returns?.length)) {
      setReturnOrderId(invoice);
      setShowCreate(true);
    }
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowColumns(false); setShowSettings(false); setShowHelp(false); setShowMore(false); setShowCreate(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = Object.values(row.values).join(" ").toLocaleLowerCase("vi");
    if (!haystack.includes(query.trim().toLocaleLowerCase("vi"))) return false;
    if (!statuses.includes(row.status)) return false;
    if (config.filters.includes("Trạng thái giao hàng") && !deliveryStatuses.includes(String(row.values.deliveryStatus || "---"))) return false;
    const hasDelivery = String(row.values.deliveryStatus || "---") !== "---";
    if (deliveryPresence !== "all" && hasDelivery !== (deliveryPresence === "yes")) return false;
    for (const [label, criterion] of Object.entries(dateFilters)) {
      if (criterion.preset === "all") continue;
      const key = label === "Thời gian giao hàng" ? "deliveryAt" : label === "Thời gian hoàn thành" ? "completedAt" : label === "Thời gian tạo" ? "createdAt" : "time";
      const rawDate = String(row.values[key] || "");
      if (!rawDate || rawDate === "---") return false;
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return false;
      if (criterion.preset === "month" && !isSameVnMonth(date, new Date())) return false;
      const iso = vnDateString(date);
      if (criterion.preset === "custom" && ((!criterion.from && !criterion.to) || (criterion.from && iso < criterion.from) || (criterion.to && iso > criterion.to))) return false;
    }
    if (codFilter !== "all") {
      const hasCod = Number(row.values.cod || 0) > 0;
      if (hasCod !== (codFilter === "yes")) return false;
    }
    return Object.entries(filters).every(([key, value]) => {
      if (!value) return true;
      const cell = String(row.values[key] || "");
      if (key === "area") {
        const selected = value.split(",").map((v) => v.trim()).filter(Boolean);
        return selected.length ? selected.includes(cell) : true;
      }
      return cell === value;
    });
  }).sort((a, b) => {
    const left = a.values[sort.key] ?? "";
    const right = b.values[sort.key] ?? "";
    const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "vi");
    return sort.direction === "asc" ? result : -result;
  }), [codFilter, config.filters, dateFilters, deliveryPresence, deliveryStatuses, filters, query, rows, sort, statuses]);
  const datePreset = Object.values(dateFilters).some((criterion) => criterion.preset !== "all") ? "month" as const : "all" as const;
  const setDatePreset = (preset: "month" | "custom" | "all") => setDateFilters((current) => Object.fromEntries(Object.keys(current).map((label) => [label, { preset, from: "", to: "" }])));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const displayedColumns = config.columns.filter((column) => visible[column.key]);
  const modalProducts = availableProducts.filter((product) => `${product.sku} ${product.name}`.toLocaleLowerCase("vi").includes(productQuery.toLocaleLowerCase("vi"))).slice(0, 80);
  const selectedCount = Object.values(quantities).filter((value) => value > 0).length;
  const paidOrders = initialOrders.filter((order) => order.status === "paid" && !returnedOrderIds.has(order.id));
  const shippableOrders = initialOrders.filter((order) => !shippedOrderIds.has(order.id) && order.status === "paid");

  const resetResults = () => { setPage(1); setSelected([]); };
  const toggleStatus = (status: string) => { setStatuses((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status]); resetResults(); };
  const toggleSort = (key: string) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const canManage = profile.role === "manager";
  async function saveOrder(status: "draft" | "paid") {
    if (!canManage) { setError("Bạn không có quyền tạo đơn hàng."); return; }
    const items = availableProducts.flatMap((product) => {
      const quantity = Math.trunc(Number(quantities[product.id] || 0));
      return quantity > 0 ? [{ product_id: product.id, quantity, unit_price: Number(prices[product.id] || 0) }] : [];
    });
    if (!items.length) { setError("Nhập số lượng cho ít nhất một hàng hóa."); return; }
    const discount = Math.max(0, Number(discountInput) || 0);
    const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
    if (discount > subtotal) { setError("Giảm giá vượt quá tổng tiền hàng."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_id: customerId || null, status, note, items, discount }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể lưu đơn hàng."); return; }
      const raw = result.order as SourceOrder;
      setRows((current) => [orderRow(raw, mode === "invoices" ? "invoices" : "orders"), ...current]);
      if (status === "paid") {
        const sold = new Map(items.map((item) => [item.product_id, item.quantity]));
        setAvailableProducts((current) => current.map((product) => ({ ...product, stock_quantity: Math.max(0, product.stock_quantity - (sold.get(product.id) || 0)) })));
      }
      setShowCreate(false); setQuantities({}); setCustomerId(""); setNote(""); setDiscountInput("0"); setProductQuery(""); setPage(1);
      setNotice(status === "paid" ? "Đã hoàn thành hóa đơn và cập nhật tồn kho." : "Đã lưu phiếu đặt hàng.");
    } catch {
      setError("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function saveReturn() {
    if (!returnOrderId) { setError("Vui lòng chọn hóa đơn cần trả."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: returnOrderId, note }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể hoàn tất trả hàng."); return; }
      setRows((current) => [returnRow(result.salesReturn as SourceReturn), ...current]);
      setReturnedOrderIds((current) => new Set(current).add(returnOrderId));
      setShowCreate(false); setReturnOrderId(""); setNote(""); setNotice("Đã hoàn tất trả hàng và nhập lại tồn kho.");
    } catch { setError("Không thể kết nối máy chủ. Vui lòng thử lại."); }
    finally { setSaving(false); }
  }

  async function savePartner(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/delivery-partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(partnerForm) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể tạo đối tác."); return; }
      setRows((current) => [partnerRow(result.partner as DeliveryPartner), ...current]);
      setShowCreate(false); setPartnerForm({ name: "", phone: "" }); setNotice("Đã tạo đối tác giao hàng.");
    } catch { setError("Không thể kết nối máy chủ. Vui lòng thử lại."); }
    finally { setSaving(false); }
  }

  async function saveShipment(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/waybills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(shipmentForm) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Không thể tạo vận đơn."); return; }
      setRows((current) => [shipmentRow(result.shipment as SourceShipment), ...current]);
      setShippedOrderIds((current) => new Set(current).add(shipmentForm.order_id));
      setShowCreate(false); setShipmentForm({ order_id: "", partner_id: "", receiver_name: "", receiver_phone: "", address: "", area: "", cod_amount: "0", shipping_fee: "0", partner_fee: "0", note: "" }); setNotice("Đã tạo vận đơn.");
    } catch { setError("Không thể kết nối máy chủ. Vui lòng thử lại."); }
    finally { setSaving(false); }
  }

  function duplicateSelected() {
    const row = rows.find((item) => item.id === selected[0]);
    const raw = row?.raw;
    if (!raw || !("order_items" in raw)) { setNotice("Chọn một phiếu đặt hàng để sao chép."); return; }
    const items = raw.order_items || [];
    setQuantities(Object.fromEntries(items.map((item) => [item.product_id, item.quantity])));
    setPrices((current) => ({ ...current, ...Object.fromEntries(items.map((item) => [item.product_id, Number(item.unit_price)])) }));
    const src = raw as SourceOrder;
    setCustomerId(src.customer_id || ""); setNote(src.note || ""); setDiscountInput(String(src.discount ?? 0)); setShowCreate(true);
  }

  function exportCsv() {
    if (!filtered.length) { setNotice("Không có dữ liệu để xuất."); return; }
    const lines = [displayedColumns.map((column) => column.label), ...filtered.map((row) => displayedColumns.map((column) => column.key === "status" ? (config.statusLabels[row.status] || row.status) : row.values[column.key] ?? "---"))];
    const csv = lines.map((line) => line.map((cell) => {
      const text = String(cell);
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replaceAll("\"", "\"\"")}"`;
    }).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${mode}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  function renderCell(row: GridRow, key: string) {
    if (["code", "invoice", "waybill", "returnCode"].includes(key)) return <button type="button" className="order-link" aria-expanded={expanded === row.id} onClick={() => setExpanded((current) => current === row.id ? null : row.id)}>{row.values[key] ?? "---"}</button>;
    if (dateKeys.has(key)) return dateTime(row.values[key]);
    if (moneyKeys.has(key)) return money(Number(row.values[key] || 0));
    if (key === "status" || key === "deliveryStatus") {
      const status = key === "status" ? row.status : String(row.values[key] || "");
      const label = key === "status" ? config.statusLabels[status] || status : configs.waybills.statusLabels[status] || (status === "---" ? "---" : status);
      return <span className={`order-status status-${status}`}>{label}</span>;
    }
    return String(row.values[key] ?? "---");
  }

  const filterKey = (label: string) => label.includes("Đối tác") ? "partner" : label.includes("Khu vực") ? "area" : label.includes("Phương thức") ? "paymentMethod" : label.includes("Người") ? (label === "Người bán" ? "seller" : "creator") : label.includes("Kênh") ? "channel" : "";
  const renderFilter = (label: string, index: number) => {
    if (label.includes("Thời gian")) {
      const criterion = dateFilters[label] || { preset: "all", from: "", to: "" };
      return <DateFilter key={`${label}-${index}`} label={label} preset={criterion.preset} from={criterion.from} to={criterion.to} onChange={(preset, from, to) => { setDateFilters((current) => ({ ...current, [label]: { preset, from, to } })); resetResults(); }} />;
    }
    if (label === "Loại trả hàng") return <section key={label}><h2>{label}</h2><label className="stock-check"><input type="checkbox" checked readOnly />Theo hóa đơn</label><label className="stock-check disabled"><input type="checkbox" disabled />Trả nhanh</label><label className="stock-check disabled"><input type="checkbox" disabled />Chuyển hoàn</label></section>;
    if (label === "Giao hàng") return <section key={label}><h2>{label}</h2><div className="order-segmented">{(["all", "yes", "no"] as const).map((value) => <button type="button" key={value} className={deliveryPresence === value ? "selected" : ""} onClick={() => { setDeliveryPresence(value); resetResults(); }}>{value === "all" ? "Tất cả" : value === "yes" ? "Giao hàng" : "Không giao"}</button>)}</div></section>;
    if (label === "Thu hộ tiền (COD)") return <section key={label}><h2>{label}</h2><div className="order-segmented">{(["all", "yes", "no"] as const).map((value) => <button type="button" key={value} className={codFilter === value ? "selected" : ""} onClick={() => { setCodFilter(value); resetResults(); }}>{value === "all" ? "Tất cả" : value === "yes" ? "Có" : "Không"}</button>)}</div></section>;
    if (label === "Trạng thái giao hàng") return <section key={label}><h2>{label}</h2>{[["---", "Chưa giao hàng"], ...Object.entries(configs.waybills.statusLabels)].map(([status, text]) => <label className="stock-check" key={status}><input type="checkbox" checked={deliveryStatuses.includes(status)} onChange={() => { setDeliveryStatuses((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status]); resetResults(); }} />{text}</label>)}</section>;
    if (label.includes("Trạng thái")) return <section key={label}><h2>{label}</h2>{Object.entries(config.statusLabels).map(([status, text]) => <label className="stock-check" key={status}><input type="checkbox" checked={statuses.includes(status)} onChange={() => toggleStatus(status)} />{text}</label>)}</section>;
    if (label.includes("Khu vực")) {
      const selectedAreas = (filters["area"] || "").split(",").filter(Boolean);
      const filteredProvinces = VN_PROVINCES.filter((p) => p.toLowerCase().includes(areaSearch.toLowerCase()));
      const toggleArea = (province: string) => {
        const next = selectedAreas.includes(province) ? selectedAreas.filter((v) => v !== province) : [...selectedAreas, province];
        setFilters((current) => ({ ...current, area: next.join(",") }));
        resetResults();
      };
      const clearArea = () => { setFilters((current) => { const n = { ...current }; delete n["area"]; return n; }); setAreaSearch(""); resetResults(); };
      return <section key={label}><h2>{label}</h2><button type="button" className="filter-select-button" aria-expanded={!!areaAnchor} onClick={(event) => setAreaAnchor(event.currentTarget)}><span className={selectedAreas.length ? "has-value" : ""}>{selectedAreas.length ? `${selectedAreas.length} tỉnh đã chọn` : `Chọn khu vực`}</span></button><FilterPopover open={!!areaAnchor} anchor={areaAnchor} onClose={() => { setAreaAnchor(null); setAreaSearch(""); }} ariaLabel={label} className="area"><div className="picker-panel"><header><h3>Khu vực giao hàng</h3><span style={{fontSize:"12px", color:"#6b7a8d"}}>{selectedAreas.length} đã chọn</span></header><label className="picker-search"><Search size={14} /><input autoFocus value={areaSearch} onChange={(event) => setAreaSearch(event.target.value)} placeholder="Tìm tỉnh/thành" /></label><div className="picker-list" style={{maxHeight:"280px", overflow:"auto"}}>{filteredProvinces.map((p) => <label key={p} style={{display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px"}}><input type="checkbox" checked={selectedAreas.includes(p)} onChange={() => toggleArea(p)} /><span>{p}</span></label>)}{!filteredProvinces.length && <p style={{padding:"12px", color:"#8a96a7", textAlign:"center"}}>Không tìm thấy</p>}</div><footer style={{display:"flex", justifyContent:"space-between", padding:"10px 12px", borderTop:"1px solid #e6ebf0"}}><button type="button" onClick={clearArea}>Xóa lọc</button><button type="button" className="primary" onClick={() => { setAreaAnchor(null); setAreaSearch(""); }}>Áp dụng</button></footer></div></FilterPopover></section>;
    }
    const key = filterKey(label);
    const options = key ? Array.from(new Set(rows.map((row) => String(row.values[key] || "")).filter((value) => value && value !== "---"))) : [];
    return <section key={label}><h2>{label}</h2><select aria-label={label} disabled={!key || !options.length} value={filters[key] || ""} onChange={(event) => { setFilters((current) => ({ ...current, [key]: event.target.value })); resetResults(); }}><option value="">Chọn {label.toLocaleLowerCase("vi")}</option>{options.map((option) => <option key={option}>{option}</option>)}</select></section>;
  };

  const toolbar = <div className="product-toolbar order-toolbar">
    {config.placeholder && <label className="product-query"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); resetResults(); }} placeholder={config.placeholder} /><SlidersHorizontal size={16} /></label>}
    {canManage && (mode === "orders" || mode === "invoices" || mode === "returns" || mode === "waybills" || (mode === "delivery-partners" && partnerTab === "other")) && <button type="button" className="order-tool primary" title="Tạo mới" aria-label="Tạo mới" onClick={() => { setError(""); setShowCreate(true); }}><Plus /></button>}
    {mode === "orders" && <button type="button" className="order-tool" title="Sao chép phiếu đặt" aria-label="Sao chép phiếu đặt" disabled={selected.length !== 1} onClick={duplicateSelected}><Copy /></button>}
    <button type="button" className="order-tool" title="Xuất file" aria-label="Xuất file" disabled={!filtered.length} onClick={exportCsv}><Download /></button>
    {mode === "invoices" && <div className="order-more"><button type="button" className="order-tool" title="Khác" aria-label="Khác" aria-expanded={showMore} onClick={() => setShowMore((value) => !value)}><MoreHorizontal /></button>{showMore && <div className="order-more-menu"><button type="button" disabled={selected.length !== 1} onClick={() => { const row = rows.find((item) => item.id === selected[0]); if (row) window.location.href = `/returns?invoice=${row.id}`; }}>Tạo phiếu trả</button></div>}</div>}
    <div className="column-control"><button type="button" className="order-tool" title="Chọn cột" aria-label="Chọn cột" aria-expanded={showColumns} onClick={() => setShowColumns((value) => !value)}><Columns3 /></button>{showColumns && <div className="columns-popover order-columns">{config.columns.map((column) => <label key={column.key}><input type="checkbox" checked={visible[column.key]} onChange={() => setVisible((current) => ({ ...current, [column.key]: !current[column.key] }))} />{column.label}</label>)}</div>}</div>
    <button type="button" className="order-tool" title="Thiết lập" aria-label="Thiết lập" onClick={() => setShowSettings(true)}><Settings /></button>
    <button type="button" className="order-tool" title="Hướng dẫn sử dụng" aria-label="Hướng dẫn sử dụng" onClick={() => setShowHelp(true)}><HelpCircle /></button>
  </div>;

  const table = <><div className="product-table order-table"><table><thead><tr><th className="row-select"><input type="checkbox" aria-label="Chọn tất cả trên trang" checked={pageRows.length > 0 && pageRows.every((row) => selected.includes(row.id))} ref={(input) => { if (input) input.indeterminate = pageRows.some((row) => selected.includes(row.id)) && !pageRows.every((row) => selected.includes(row.id)); }} onChange={(event) => setSelected((current) => event.target.checked ? Array.from(new Set([...current, ...pageRows.map((row) => row.id)])) : current.filter((id) => !pageRows.some((row) => row.id === id)))} /></th>{mode !== "waybills" && mode !== "delivery-partners" && <th className="row-star"><Star size={17} /></th>}{displayedColumns.map((column) => <th key={column.key}><button type="button" onClick={() => toggleSort(column.key)}>{column.label}{sort.key === column.key ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}</button></th>)}</tr></thead><tbody>{pageRows.map((row) => <OrderTableRows key={row.id} row={row} mode={mode} columns={displayedColumns} selected={selected.includes(row.id)} expanded={expanded === row.id} statusLabel={config.statusLabels[row.status] || row.status} onSelect={() => toggleSelected(row.id)} renderCell={renderCell} />)}{!pageRows.length && <tr><td colSpan={displayedColumns.length + (mode === "waybills" || mode === "delivery-partners" ? 1 : 2)}><div className="product-empty order-empty"><Inbox /><strong>Không tìm thấy kết quả</strong><p>{mode === "waybills" ? "Không tìm thấy vận đơn nào phù hợp trong tháng này." : mode === "delivery-partners" ? "Không tìm thấy kết quả nào phù hợp." : "Không tìm thấy giao dịch nào phù hợp trong tháng này."}</p>{datePreset !== "all" && <button type="button" onClick={() => setDatePreset("all")}>Nhấn vào đây để tiếp tục tìm kiếm</button>}</div></td></tr>}</tbody></table></div><footer className="product-pager"><span>Hiển thị {filtered.length ? (safePage - 1) * pageSize + 1 : 0} - {Math.min(safePage * pageSize, filtered.length)} trong {filtered.length} {mode === "waybills" ? "vận đơn" : mode === "delivery-partners" ? "đối tác" : "giao dịch"}</span><div><button type="button" aria-label="Trang trước" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>‹</button><button type="button" className="current" aria-current="page">{safePage}</button><button type="button" aria-label="Trang sau" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>›</button></div></footer></>;

  return <div className={`kv-shell product-page order-management-page mode-${mode}`}>
    <ManagementHeader profile={profile} active={mode} />
    <div className="product-actions order-actions"><h1>{config.title}</h1>{toolbar}</div>
    {mode === "delivery-partners" ? <main className="partner-workspace"><aside className="partner-sidebar"><nav><button type="button" className={partnerTab === "integrated" ? "active" : ""} onClick={() => setPartnerTab("integrated")}>Tích hợp</button><button type="button" className={partnerTab === "other" ? "active" : ""} onClick={() => setPartnerTab("other")}>Khác</button></nav><div className="partner-illustration"><Truck /><strong>{partnerTab === "integrated" ? "Kết nối đối tác vận chuyển" : "Đối tác giao hàng riêng"}</strong><p>{partnerTab === "integrated" ? "Theo dõi đơn giao, COD và phí vận chuyển trên cùng một màn hình." : "Quản lý đối tác giao hàng do cửa hàng tự vận hành."}</p></div></aside><section className="order-content partner-content">{notice && <Notice text={notice} onClose={() => setNotice("")} />}<nav className="partner-detail-tabs"><button className="active">Thông tin</button><button>Lịch sử giao hàng</button><button>Lịch sử đối soát</button></nav>{table}</section></main> : <main className="product-workspace order-workspace"><aside className="product-filter-sidebar order-sidebar">{config.filters.map(renderFilter)}</aside><section className="product-content order-content">{notice && <Notice text={notice} onClose={() => setNotice("")} />}{table}</section></main>}
    <a className="kv-help" href="tel:0704040044">💬 <span>0704 04 0044</span></a>
    {showCreate && <CreateDialog mode={mode} products={modalProducts} customers={customers} paidOrders={paidOrders} shippableOrders={shippableOrders} partners={initialPartners} customerId={customerId} note={note} discount={discountInput} productQuery={productQuery} quantities={quantities} prices={prices} selectedCount={selectedCount} returnOrderId={returnOrderId} partnerForm={partnerForm} shipmentForm={shipmentForm} saving={saving} error={error} onClose={() => setShowCreate(false)} onCustomer={setCustomerId} onNote={setNote} onDiscount={setDiscountInput} onProductQuery={setProductQuery} onQuantity={(id, value) => setQuantities((current) => ({ ...current, [id]: Math.max(0, Math.trunc(value)) }))} onPrice={(id, value) => setPrices((current) => ({ ...current, [id]: Math.max(0, value) }))} onReturnOrder={setReturnOrderId} onPartnerForm={setPartnerForm} onShipmentForm={setShipmentForm} onSaveDraft={() => saveOrder("draft")} onSavePaid={() => saveOrder("paid")} onSaveReturn={saveReturn} onSavePartner={savePartner} onSaveShipment={saveShipment} />}
    {showSettings && <SimpleDialog title="Thiết lập danh sách" onClose={() => setShowSettings(false)}><label className="dialog-field">Số dòng mỗi trang<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="15">15 dòng</option><option value="30">30 dòng</option><option value="50">50 dòng</option></select></label></SimpleDialog>}
    {showHelp && <SimpleDialog title={`Hướng dẫn ${config.title}`} onClose={() => setShowHelp(false)}><p>Tìm kiếm theo mã hoặc thông tin hiển thị, dùng bộ lọc bên trái và bấm mã chứng từ để xem chi tiết. Các thao tác lưu, trả hàng và vận đơn đều được kiểm tra lại ở máy chủ.</p></SimpleDialog>}
  </div>;
}

function DateFilter({ label, preset, from, to, onChange }: { label: string; preset: "month" | "custom" | "all"; from: string; to: string; onChange: (preset: "month" | "custom" | "all", from: string, to: string) => void }) {
  return <section><h2>{label}</h2><label className="stock-radio"><input type="radio" checked={preset === "month"} onChange={() => onChange("month", "", "")} /><span>Tháng này</span></label><label className="stock-radio"><input type="radio" checked={preset === "custom"} onChange={() => onChange("custom", from, to)} /><span>Tùy chỉnh</span><CalendarDays size={17} /></label>{preset === "custom" && <div className="order-date-range"><input type="date" aria-label="Từ ngày" value={from} onChange={(event) => onChange("custom", event.target.value, to)} /><input type="date" aria-label="Đến ngày" value={to} onChange={(event) => onChange("custom", from, event.target.value)} /></div>}<label className="stock-radio"><input type="radio" checked={preset === "all"} onChange={() => onChange("all", "", "")} /><span>Toàn thời gian</span></label></section>;
}

function OrderTableRows({ row, mode, columns, selected, expanded, statusLabel, onSelect, renderCell }: { row: GridRow; mode: Mode; columns: Column[]; selected: boolean; expanded: boolean; statusLabel: string; onSelect: () => void; renderCell: (row: GridRow, key: string) => React.ReactNode }) {
  const extra = mode === "waybills" || mode === "delivery-partners" ? 1 : 2;
  return <><tr className={selected ? "selected" : ""}><td className="row-select"><input type="checkbox" aria-label={`Chọn ${row.values.code}`} checked={selected} onChange={onSelect} /></td>{mode !== "waybills" && mode !== "delivery-partners" && <td className="row-star"><Star size={17} /></td>}{columns.map((column) => <td className={moneyKeys.has(column.key) ? "number-cell" : ""} key={column.key}>{renderCell(row, column.key)}</td>)}</tr>{expanded && <tr className="order-detail-row"><td colSpan={columns.length + extra}><DetailPanel row={row} mode={mode} statusLabel={statusLabel} /></td></tr>}</>;
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  return <div className="product-notice" role="status"><span>{text}</span><button type="button" aria-label="Đóng thông báo" onClick={onClose}>×</button></div>;
}

function SimpleDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop order-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="small-modal order-small-dialog" role="dialog" aria-modal="true" aria-label={title}><header><h3>{title}</h3><button type="button" aria-label="Đóng" onClick={onClose}><X /></button></header><div>{children}</div><footer><button type="button" className="primary" onClick={onClose}>Đóng</button></footer></section></div>;
}

function CreateDialog(props: {
  mode: Mode;
  products: Product[];
  customers: Customer[];
  paidOrders: SourceOrder[];
  shippableOrders: SourceOrder[];
  partners: DeliveryPartner[];
  customerId: string;
  note: string;
  discount: string;
  productQuery: string;
  quantities: Record<string, number>;
  prices: Record<string, number>;
  selectedCount: number;
  returnOrderId: string;
  partnerForm: { name: string; phone: string };
  shipmentForm: { order_id: string; partner_id: string; receiver_name: string; receiver_phone: string; address: string; area: string; cod_amount: string; shipping_fee: string; partner_fee: string; note: string };
  saving: boolean;
  error: string;
  onClose: () => void;
  onCustomer: (value: string) => void;
  onNote: (value: string) => void;
  onDiscount: (value: string) => void;
  onProductQuery: (value: string) => void;
  onQuantity: (id: string, value: number) => void;
  onPrice: (id: string, value: number) => void;
  onReturnOrder: (value: string) => void;
  onPartnerForm: (value: { name: string; phone: string }) => void;
  onShipmentForm: (value: CreateDialogProps["shipmentForm"]) => void;
  onSaveDraft: () => void;
  onSavePaid: () => void;
  onSaveReturn: () => void;
  onSavePartner: (event: FormEvent) => void;
  onSaveShipment: (event: FormEvent) => void;
}) {
  const title = props.mode === "orders" ? "Đặt hàng" : props.mode === "invoices" ? "Tạo hóa đơn" : props.mode === "returns" ? "Trả hàng theo hóa đơn" : props.mode === "delivery-partners" ? "Tạo đối tác giao hàng" : "Tạo vận đơn";
  if (props.mode === "delivery-partners") return <DialogShell title={title} onClose={props.onClose}><form className="order-compact-form" onSubmit={props.onSavePartner}><label>Tên đối tác *<input autoFocus required value={props.partnerForm.name} onChange={(event) => props.onPartnerForm({ ...props.partnerForm, name: event.target.value })} /></label><label>Điện thoại<input value={props.partnerForm.phone} onChange={(event) => props.onPartnerForm({ ...props.partnerForm, phone: event.target.value })} /></label>{props.error && <p className="order-form-error" role="alert">{props.error}</p>}<footer><button type="button" onClick={props.onClose}>Bỏ qua</button><button className="primary" disabled={props.saving}>{props.saving ? "Đang lưu..." : "Lưu"}</button></footer></form></DialogShell>;
  if (props.mode === "returns") return <DialogShell title={title} onClose={props.onClose}><div className="order-compact-form"><label>Hóa đơn *<select autoFocus value={props.returnOrderId} onChange={(event) => props.onReturnOrder(event.target.value)}><option value="">Chọn hóa đơn hoàn thành</option>{props.paidOrders.map((order) => <option key={order.id} value={order.id}>{documentCode("HD", order.order_number)} - {order.customers?.name || "Khách lẻ"} - {money(Number(order.total))}</option>)}</select></label><label>Ghi chú<textarea rows={3} value={props.note} onChange={(event) => props.onNote(event.target.value)} /></label><p className="order-return-note">Hệ thống hiện hỗ trợ trả toàn bộ hóa đơn. Tồn kho và tổng mua của khách sẽ được hoàn lại trong cùng giao dịch.</p>{props.error && <p className="order-form-error" role="alert">{props.error}</p>}<footer><button type="button" onClick={props.onClose}>Bỏ qua</button><button type="button" className="primary" disabled={props.saving || !props.returnOrderId} onClick={props.onSaveReturn}>{props.saving ? "Đang xử lý..." : "Hoàn thành"}</button></footer></div></DialogShell>;
  if (props.mode === "waybills") return <DialogShell title={title} onClose={props.onClose}><form className="order-compact-form shipment-form" onSubmit={props.onSaveShipment}><label>Đơn hàng / hóa đơn *<select required value={props.shipmentForm.order_id} onChange={(event) => props.onShipmentForm({ ...props.shipmentForm, order_id: event.target.value })}><option value="">Chọn chứng từ</option>{props.shippableOrders.map((order) => <option key={order.id} value={order.id}>{documentCode(order.status === "paid" ? "HD" : "DH", order.order_number)} - {order.customers?.name || "Khách lẻ"}</option>)}</select></label><label>Đối tác giao hàng<select value={props.shipmentForm.partner_id} onChange={(event) => props.onShipmentForm({ ...props.shipmentForm, partner_id: event.target.value })}><option value="">Cửa hàng tự giao</option>{props.partners.filter((partner) => partner.active).map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></label><label>Người nhận *<input required value={props.shipmentForm.receiver_name} onChange={(event) => props.onShipmentForm({ ...props.shipmentForm, receiver_name: event.target.value })} /></label><label>Điện thoại<input value={props.shipmentForm.receiver_phone} onChange={(event) => props.onShipmentForm({ ...props.shipmentForm, receiver_phone: event.target.value })} /></label><label>Địa chỉ<input value={props.shipmentForm.address} onChange={(event) => props.onShipmentForm({ ...props.shipmentForm, address: event.target.value })} /></label><label>Khu vực<input value={props.shipmentForm.area} onChange={(event) => props.onShipmentForm({ ...props.shipmentForm, area: event.target.value })} /></label><label>Thu hộ (COD)<input type="number" min="0" value={props.shipmentForm.cod_amount} onChange={(event) => props.onShipmentForm({ ...props.shipmentForm, cod_amount: event.target.value })} /></label><label>Phí giao hàng<input type="number" min="0" value={props.shipmentForm.shipping_fee} onChange={(event) => props.onShipmentForm({ ...props.shipmentForm, shipping_fee: event.target.value })} /></label>{props.error && <p className="order-form-error" role="alert">{props.error}</p>}<footer><button type="button" onClick={props.onClose}>Bỏ qua</button><button className="primary" disabled={props.saving}>{props.saving ? "Đang lưu..." : "Lưu vận đơn"}</button></footer></form></DialogShell>;
  return <DialogShell title={title} onClose={props.onClose} large><div className="order-form-head"><label>Khách hàng<select value={props.customerId} onChange={(event) => props.onCustomer(event.target.value)}><option value="">Khách lẻ</option>{props.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} {customer.phone || ""}</option>)}</select></label><label>Ghi chú<input value={props.note} onChange={(event) => props.onNote(event.target.value)} /></label><label>Giảm giá<input type="number" min="0" value={props.discount} onChange={(event) => props.onDiscount(event.target.value)} /></label></div><label className="product-query order-product-search"><Search size={18} /><input autoFocus value={props.productQuery} onChange={(event) => props.onProductQuery(event.target.value)} placeholder="Theo mã, tên hàng" /></label><div className="order-lines"><table><thead><tr><th>Mã hàng</th><th>Tên hàng</th><th>Tồn kho</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{props.products.map((product) => { const quantity = Number(props.quantities[product.id] || 0); const price = Number(props.prices[product.id] || 0); return <tr key={product.id}><td>{product.sku}</td><td>{product.name}</td><td>{product.stock_quantity}</td><td><input type="number" min="0" max={props.mode === "invoices" ? product.stock_quantity : undefined} value={quantity} onChange={(event) => props.onQuantity(product.id, Number(event.target.value))} /></td><td><input type="number" min="0" value={price} onChange={(event) => props.onPrice(product.id, Number(event.target.value))} /></td><td>{money(quantity * price)}</td></tr>})}</tbody></table></div><div className="order-totals" style={{ display: "flex", gap: 12, justifyContent: "flex-end", padding: "8px 0", fontSize: 13 }}>{(() => { const subtotal = props.products.reduce((sum, product) => sum + Number(props.quantities[product.id] || 0) * Number(props.prices[product.id] || 0), 0); const discount = Math.min(subtotal, Math.max(0, Number(props.discount) || 0)); const payable = Math.max(0, subtotal - discount); return <><span>Tổng tiền hàng: <b>{money(subtotal)}</b></span><span>Giảm giá: <b>{money(discount)}</b></span><span>Khách cần trả: <b>{money(payable)}</b></span></>; })()}</div>{props.error && <p className="order-form-error" role="alert">{props.error}</p>}<footer className="order-create-footer"><span>{props.selectedCount} hàng hóa được chọn</span><div><button type="button" onClick={props.onClose}>Bỏ qua</button>{props.mode === "orders" && <button type="button" disabled={props.saving || !props.selectedCount} onClick={props.onSaveDraft}>Lưu tạm</button>}<button type="button" className="primary" disabled={props.saving || !props.selectedCount} onClick={props.onSavePaid}>{props.saving ? "Đang lưu..." : "Hoàn thành"}</button></div></footer></DialogShell>;
}

type CreateDialogProps = Parameters<typeof CreateDialog>[0];

function DialogShell({ title, onClose, large = false, children }: { title: string; onClose: () => void; large?: boolean; children: React.ReactNode }) {
  return <div className="modal-backdrop order-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={large ? "product-modal order-modal" : "product-modal order-form-modal"} role="dialog" aria-modal="true" aria-label={title}><header><div><h2>{title}</h2></div><button type="button" aria-label="Đóng" onClick={onClose}><X /></button></header>{children}</section></div>;
}
