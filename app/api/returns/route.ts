import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { isRaisedException } from "@/lib/api-utils";

const returnSelect = "id,return_number,order_id,status,subtotal,refund_amount,note,created_at,updated_at,creator:profiles!sales_returns_created_by_fkey(full_name),orders(id,order_number,customer_id,created_at,customers(id,customer_number,name,phone),creator:profiles!orders_created_by_fkey(full_name),shipments(status)),sales_return_items(id,product_id,quantity,unit_price,line_total,products(sku,name))";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const { supabase } = await requireProfile("manager");
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dữ liệu trả hàng không hợp lệ." }, { status: 400 });
  }
  const orderId = String(body.order_id || "");
  if (!uuidPattern.test(orderId)) return NextResponse.json({ error: "Vui lòng chọn hóa đơn cần trả." }, { status: 400 });
  const { data: returnId, error } = await supabase.rpc("refund_sales_order", { p_order_id: orderId, p_note: String(body.note || "") });
  if (error || !returnId) { console.error("[api:returns:POST]", error); return NextResponse.json({ error: isRaisedException(error) ? error.message : "Không thể hoàn tất trả hàng." }, { status: 400 }); }
  const result = await supabase.from("sales_returns").select(returnSelect).eq("id", returnId).single();
  if (result.error) return NextResponse.json({ error: "Phiếu trả đã lưu nhưng không thể tải lại dữ liệu." }, { status: 500 });
  return NextResponse.json({ salesReturn: result.data }, { status: 201 });
}
