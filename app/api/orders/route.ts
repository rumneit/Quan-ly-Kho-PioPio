import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

const orderSelect = "id,order_number,customer_id,branch_id,status,subtotal,discount,total,note,channel,payment_method,created_at,updated_at,customers(id,customer_number,name,phone),creator:profiles!orders_created_by_fkey(full_name),store_branches(name),order_items(id,product_id,quantity,unit_price,line_total,products(sku,name)),shipments(id,shipment_number,status,partner_id,area,cod_amount,collected_cod,shipping_fee,partner_fee,delivery_at,delivery_partners(name)),sales_returns(id,return_number)";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { supabase } = await requireProfile();
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 15));
  const from = (page - 1) * pageSize;
  let query = supabase.from("orders").select(orderSelect, { count: "exact" });
  const search = (params.get("q") || "").trim();
  if (search) {
    if (/^DH\d+$/i.test(search) || /^HD\d+$/i.test(search)) query = query.eq("order_number", Number(search.slice(2)));
    else query = query.or(`note.ilike.%${search.replaceAll(",", "")}%`);
  }
  const status = params.get("status");
  if (status) query = query.in("status", status.split(",").filter(Boolean));
  const branchId = params.get("branchId");
  if (branchId && uuidPattern.test(branchId)) query = query.eq("branch_id", branchId);
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00+07:00`);
  if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999+07:00`);
  const result = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ orders: result.data || [], count: result.count || 0, page, pageSize });
}

export async function POST(request: Request) {
  const { supabase } = await requireProfile();
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dữ liệu đơn hàng không hợp lệ." }, { status: 400 });
  }
  if (body.status !== "draft" && body.status !== "paid") return NextResponse.json({ error: "Trạng thái đơn hàng không hợp lệ." }, { status: 400 });
  if (body.customer_id != null && body.customer_id !== "" && (typeof body.customer_id !== "string" || !uuidPattern.test(body.customer_id))) return NextResponse.json({ error: "Khách hàng không hợp lệ." }, { status: 400 });
  const items = Array.isArray(body.items) ? body.items : [];
  const validItems = items.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const value = item as Record<string, unknown>;
    const quantity = Number(value.quantity);
    const unitPrice = Number(value.unit_price);
    return typeof value.product_id === "string" && uuidPattern.test(value.product_id) && Number.isInteger(quantity) && quantity > 0 && quantity <= 1_000_000 && Number.isFinite(unitPrice) && unitPrice >= 0 && unitPrice <= 999_999_999_999.99;
  });
  if (!items.length || !validItems) return NextResponse.json({ error: "Chi tiết hàng hóa không hợp lệ." }, { status: 400 });
  const discount = Number(body.discount ?? 0);
  if (!Number.isFinite(discount) || discount < 0 || discount > 999_999_999_999.99) return NextResponse.json({ error: "Giảm giá không hợp lệ." }, { status: 400 });
  const subtotal = items.reduce((sum: number, item: unknown) => {
    const v = item as Record<string, unknown>;
    return sum + Number(v.quantity) * Number(v.unit_price);
  }, 0);
  if (discount > subtotal) return NextResponse.json({ error: "Giảm giá vượt quá tổng tiền hàng." }, { status: 400 });
  const status = body.status;
  const { data: orderId, error } = await supabase.rpc("create_sales_order", {
    p_customer_id: body.customer_id || null,
    p_status: status,
    p_note: String(body.note || ""),
    p_items: items,
    p_discount: discount,
  });
  if (error || !orderId) return NextResponse.json({ error: error?.message || "Không thể lưu đơn hàng." }, { status: 400 });
  const result = await supabase.from("orders").select(orderSelect).eq("id", orderId).single();
  if (result.error) return NextResponse.json({ error: "Đơn hàng đã lưu nhưng không thể tải lại dữ liệu." }, { status: 500 });
  return NextResponse.json({ order: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase } = await requireProfile();
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  }
  const id = String(body.id || "");
  const status = body.status;
  if (!uuidPattern.test(id) || (status !== "paid" && status !== "cancelled")) return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  const { error } = await supabase.rpc("transition_sales_order", { p_order_id: id, p_status: status });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const result = await supabase.from("orders").select(orderSelect).eq("id", id).single();
  if (result.error) return NextResponse.json({ error: "Không thể tải lại đơn hàng." }, { status: 500 });
  return NextResponse.json({ order: result.data });
}
