import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/api-utils";
import { provinceAcceptedNames } from "@/app/lib/vietnam-data";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const customerSelect = "id,customer_number,name,phone,secondary_phone,email,birthday,gender,customer_type,facebook,address,area,ward,note,tax_code,identity_number,organization,buyer_name,invoice_address,invoice_email,bank_name,bank_account,total_spent,active,favorite,group_id,created_at,updated_at,created_by,creator:profiles!customers_created_by_fkey(full_name),customer_groups(id,name),orders(id,order_number,status,total,created_at,shipments(status,cod_amount,collected_cod),sales_returns(id,return_number,status,refund_amount,created_at))";

function escapePostgrestIlike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", "\\,");
}

type CustomerInput = Record<string, unknown>;

async function readBody(request: Request) {
  try {
    const parsed: unknown = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function optionalText(value: unknown, maxLength: number) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function validateInput(input: CustomerInput) {
  const name = String(input.name || "").trim();
  const phone = String(input.phone || "").trim();
  const secondaryPhone = String(input.secondary_phone || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const birthday = input.birthday ? String(input.birthday) : null;
  if (!name || name.length > 160) return "Tên khách hàng phải có từ 1 đến 160 ký tự.";
  if (phone.length > 30 || secondaryPhone.length > 30) return "Số điện thoại không hợp lệ.";
  if (email && (!emailPattern.test(email) || email.length > 180)) return "Email không hợp lệ.";
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return "Ngày sinh không hợp lệ.";
  if (input.gender && input.gender !== "male" && input.gender !== "female") return "Giới tính không hợp lệ.";
  if (input.customer_type && input.customer_type !== "individual" && input.customer_type !== "company") return "Loại khách hàng không hợp lệ.";
  if (input.group_id && (typeof input.group_id !== "string" || !uuidPattern.test(input.group_id))) return "Nhóm khách hàng không hợp lệ.";
  return "";
}

function customerPayload(input: CustomerInput, storeId: string, createdBy?: string) {
  return {
    ...(createdBy ? { store_id: storeId, created_by: createdBy } : {}),
    name: String(input.name || "").trim(),
    phone: optionalText(input.phone, 30),
    secondary_phone: optionalText(input.secondary_phone, 30),
    email: optionalText(input.email, 180)?.toLowerCase() || null,
    birthday: input.birthday ? String(input.birthday) : null,
    gender: input.gender || null,
    customer_type: input.customer_type === "company" ? "company" : "individual",
    facebook: optionalText(input.facebook, 250),
    address: optionalText(input.address, 500),
    area: optionalText(input.area, 160),
    ward: optionalText(input.ward, 160),
    note: optionalText(input.note, 1000),
    tax_code: optionalText(input.tax_code, 60),
    identity_number: optionalText(input.identity_number, 60),
    organization: optionalText(input.organization, 200),
    buyer_name: optionalText(input.buyer_name, 160),
    invoice_address: optionalText(input.invoice_address, 500),
    invoice_email: optionalText(input.invoice_email, 180),
    bank_name: optionalText(input.bank_name, 160),
    bank_account: optionalText(input.bank_account, 80),
    group_id: input.group_id || null,
    active: input.active !== false,
    favorite: input.favorite === true,
    ...(!createdBy ? { updated_at: new Date().toISOString() } : {}),
  };
}

export async function GET(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase, profile } = auth;
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(params.get("export") === "1" ? 5000 : 100, Math.max(1, Number(params.get("pageSize")) || 15));
  const search = (params.get("q") || "").trim();
  let query = supabase.from("customers").select(customerSelect, { count: "exact" }).eq("store_id", profile.store_id);
  if (/^KH\d+$/i.test(search)) query = query.eq("customer_number", Number(search.slice(2)));
  else if (search) {
    const safe = escapePostgrestIlike(search);
    query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const status = params.get("status");
  const type = params.get("type");
  const gender = params.get("gender");
  const groupId = params.get("groupId");
  if (status === "active" || status === "inactive") query = query.eq("active", status === "active");
  if (type === "individual" || type === "company") query = query.eq("customer_type", type);
  if (gender === "male" || gender === "female") query = query.eq("gender", gender);
  if (groupId && uuidPattern.test(groupId)) query = query.eq("group_id", groupId);
  if (params.get("creatorId") && uuidPattern.test(String(params.get("creatorId")))) query = query.eq("created_by", params.get("creatorId"));
  if (params.get("area")) {
    // Chọn tỉnh MỚI cũng phải khớp dữ liệu ghi theo tên tỉnh CŨ (sáp nhập 2025).
    const names = provinceAcceptedNames(String(params.get("area")));
    query = query.in("area", names);
  }
  if (params.get("birthdayFrom")) query = query.gte("birthday", params.get("birthdayFrom"));
  if (params.get("birthdayTo")) query = query.lte("birthday", params.get("birthdayTo"));
  if (params.get("dateFrom")) query = query.gte("created_at", `${params.get("dateFrom")}T00:00:00+07:00`);
  if (params.get("dateTo")) query = query.lte("created_at", `${params.get("dateTo")}T23:59:59.999+07:00`);
  if (params.get("totalMin")) query = query.gte("total_spent", Number(params.get("totalMin")) || 0);
  if (params.get("totalMax")) query = query.lte("total_spent", Number(params.get("totalMax")) || 0);
  if (params.get("transactionFrom") || params.get("transactionTo")) {
    const batchSize = 1000;
    let offset = 0;
    const idsSet = new Set<string>();
    while (true) {
      let orderQuery = supabase
        .from("orders")
        .select("customer_id")
        .not("customer_id", "is", null)
        .eq("store_id", profile.store_id)
        .range(offset, offset + batchSize - 1);
      if (params.get("transactionFrom")) orderQuery = orderQuery.gte("created_at", `${params.get("transactionFrom")}T00:00:00+07:00`);
      if (params.get("transactionTo")) orderQuery = orderQuery.lte("created_at", `${params.get("transactionTo")}T23:59:59.999+07:00`);
      const orderCustomers = await orderQuery;
      if (orderCustomers.error) break;
      const batchIds = (orderCustomers.data || []).map((order) => (order as { customer_id: string | null }).customer_id).filter(Boolean) as string[];
      batchIds.forEach((id) => idsSet.add(id));
      if ((orderCustomers.data || []).length < batchSize) break;
      offset += batchSize;
      if (offset > 20000) break;
    }
    const ids = Array.from(idsSet);
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (params.get("debtMin") || params.get("debtMax")) {
    const rawMin = params.get("debtMin") ? Number(params.get("debtMin")) : null;
    const rawMax = params.get("debtMax") ? Number(params.get("debtMax")) : null;
    const rpcMin = rawMin !== null && Number.isFinite(rawMin) ? rawMin : null;
    const rpcMax = rawMax !== null && Number.isFinite(rawMax) ? rawMax : null;
    let ids: string[] = [];
    const rpcResult = await supabase.rpc("customers_by_debt", { p_min: rpcMin, p_max: rpcMax });
    if (rpcResult.error || !Array.isArray(rpcResult.data)) {
      return NextResponse.json({ error: "Bộ lọc nợ tạm thời lỗi, vui lòng thu hẹp khoảng lọc hoặc thử lại." }, { status: 400 });
    }
    ids = (rpcResult.data as Array<{ customer_id: string }>).map((r) => r.customer_id).filter(Boolean);
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  const from = (page - 1) * pageSize;
  const sortMap: Record<string, string> = { code: "customer_number", name: "name", phone: "phone", totalSpent: "total_spent", createdAt: "created_at", status: "active" };
  const sort = sortMap[params.get("sort") || ""] || "customer_number";
  const result = await query.order(sort, { ascending: params.get("direction") === "asc", nullsFirst: false }).range(from, from + pageSize - 1);
  if (result.error) { console.error("[api:customers:GET]", result.error); return NextResponse.json({ error: "Không thể tải khách hàng." }, { status: 400 }); }
  return NextResponse.json({ customers: result.data || [], count: result.count || 0, page, pageSize });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase, profile } = auth;
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu khách hàng không hợp lệ." }, { status: 400 });
  const rows = Array.isArray(body.rows) ? body.rows : [body];
  if (!rows.length || rows.length > 500 || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) return NextResponse.json({ error: "Danh sách khách hàng không hợp lệ." }, { status: 400 });
  for (const row of rows as CustomerInput[]) {
    const validationError = validateInput(row);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  }
  const payloads = (rows as CustomerInput[]).map((row) => customerPayload(row, profile.store_id, profile.id));
  const result = await supabase.from("customers").insert(payloads).select(customerSelect);
  if (result.error) { console.error("[api:customers:POST]", result.error); return NextResponse.json({ error: isUniqueViolation(result.error) ? "Khách hàng đã tồn tại (trùng số điện thoại hoặc mã)." : "Không thể lưu khách hàng." }, { status: 400 }); }
  return NextResponse.json({ customer: result.data?.[0], customers: result.data || [] }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase, profile } = auth;
  const body = await readBody(request);
  if (!body || typeof body.id !== "string" || !uuidPattern.test(body.id)) return NextResponse.json({ error: "Khách hàng không hợp lệ." }, { status: 400 });
  const validationError = validateInput(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  if (body.group_id) {
    const group = await supabase.from("customer_groups").select("id").eq("id", body.group_id).eq("store_id", profile.store_id).maybeSingle();
    if (!group.data) return NextResponse.json({ error: "Nhóm khách hàng không thuộc cửa hàng." }, { status: 400 });
  }
  const result = await supabase.from("customers").update(customerPayload(body, profile.store_id)).eq("id", body.id).select(customerSelect).single();
  if (result.error) { console.error("[api:customers:PATCH]", result.error); return NextResponse.json({ error: "Không thể cập nhật khách hàng." }, { status: 400 }); }
  return NextResponse.json({ customer: result.data });
}
