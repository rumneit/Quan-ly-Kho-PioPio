import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/auth";
import { isRaisedException } from "@/lib/api-utils";

const shipmentSelect = "id,shipment_number,order_id,partner_id,status,receiver_name,receiver_phone,address,area,service,cod_amount,collected_cod,shipping_fee,partner_fee,note,created_at,delivery_at,completed_at,updated_at,delivery_partners(id,name),orders(id,order_number,customer_id,total,customers(id,customer_number,name,phone)),creator:profiles!shipments_created_by_fkey(full_name),shipment_status_history(id,status,note,created_at)";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const shipmentStatuses = new Set(["pending_pickup", "picked_up", "delivering", "delivered", "failed", "returning", "returned", "cancelled"]);

async function readBody(request: Request) {
  try {
    const parsed: unknown = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase } = auth;
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu vận đơn không hợp lệ." }, { status: 400 });
  const orderId = String(body.order_id || "");
  const partnerId = String(body.partner_id || "");
  const receiverName = String(body.receiver_name || "").trim();
  const receiverPhone = String(body.receiver_phone || "").trim();
  const address = String(body.address || "").trim();
  const area = String(body.area || "").trim();
  const amounts = [body.cod_amount, body.shipping_fee, body.partner_fee].map(Number);
  if (!uuidPattern.test(orderId) || (partnerId && !uuidPattern.test(partnerId)) || !receiverName || receiverName.length > 120 || receiverPhone.length > 30 || address.length > 500 || area.length > 120 || amounts.some((value) => !Number.isFinite(value) || value < 0 || value > 999_999_999_999.99)) return NextResponse.json({ error: "Dữ liệu vận đơn không hợp lệ." }, { status: 400 });
  const { data: shipmentId, error } = await supabase.rpc("create_shipment", {
    p_order_id: orderId,
    p_partner_id: partnerId || null,
    p_receiver_name: receiverName,
    p_receiver_phone: receiverPhone,
    p_address: address,
    p_area: area,
    p_cod_amount: amounts[0],
    p_shipping_fee: amounts[1],
    p_partner_fee: amounts[2],
    p_note: String(body.note || ""),
  });
  if (error || !shipmentId) { console.error("[api:waybills:POST]", error); return NextResponse.json({ error: isRaisedException(error) ? error.message : "Không thể tạo vận đơn." }, { status: 400 }); }
  const result = await supabase.from("shipments").select(shipmentSelect).eq("id", shipmentId).single();
  if (result.error) return NextResponse.json({ error: "Vận đơn đã lưu nhưng không thể tải lại dữ liệu." }, { status: 500 });
  return NextResponse.json({ shipment: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase } = auth;
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  const id = String(body.id || "");
  const status = String(body.status || "");
  const collectedCod = body.collected_cod == null ? null : Number(body.collected_cod);
  if (!uuidPattern.test(id) || !shipmentStatuses.has(status) || (status === "delivered" && (collectedCod == null || !Number.isFinite(collectedCod) || collectedCod < 0)) || (status !== "delivered" && collectedCod != null)) return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  const { error } = await supabase.rpc("transition_shipment", { p_shipment_id: id, p_status: status, p_note: String(body.note || ""), p_collected_cod: collectedCod });
  if (error) { console.error("[api:waybills:PATCH]", error); return NextResponse.json({ error: isRaisedException(error) ? error.message : "Không thể cập nhật vận đơn." }, { status: 400 }); }
  const result = await supabase.from("shipments").select(shipmentSelect).eq("id", id).single();
  if (result.error) return NextResponse.json({ error: "Không thể tải lại vận đơn." }, { status: 500 });
  return NextResponse.json({ shipment: result.data });
}
