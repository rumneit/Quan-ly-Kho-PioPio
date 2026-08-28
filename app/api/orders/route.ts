import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

const orderSelect = "id,order_number,customer_id,status,subtotal,discount,total,note,channel,payment_method,created_at,updated_at,customers(id,customer_number,name,phone),creator:profiles!orders_created_by_fkey(full_name),order_items(id,product_id,quantity,unit_price,line_total,products(sku,name)),shipments(id,shipment_number,status,partner_id,area,cod_amount,collected_cod,shipping_fee,partner_fee,delivery_at,delivery_partners(name)),sales_returns(id,return_number)";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const { supabase } = await requireProfile("manager");
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
  const status = body.status;
  const { data: orderId, error } = await supabase.rpc("create_sales_order", {
    p_customer_id: body.customer_id || null,
    p_status: status,
    p_note: String(body.note || ""),
    p_items: items,
  });
  if (error || !orderId) return NextResponse.json({ error: error?.message || "Không thể lưu đơn hàng." }, { status: 400 });
  const result = await supabase.from("orders").select(orderSelect).eq("id", orderId).single();
  if (result.error) return NextResponse.json({ error: "Đơn hàng đã lưu nhưng không thể tải lại dữ liệu." }, { status: 500 });
  return NextResponse.json({ order: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase } = await requireProfile("manager");
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
