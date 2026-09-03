import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/auth";
import { isRaisedException } from "@/lib/api-utils";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const receiptKinds = ["sale_payment", "debt_collection", "other_income", "transfer_in"];
const expenseKinds = ["purchase_payment", "debt_payment", "other_expense", "transfer_out"];
const voucherSelect = "id,voucher_number,account_id,type,kind,amount,partner_kind,partner_id,partner_name,note,affects_profit,status,occurred_at,created_at,cancelled_at,created_by,creator:profiles!cash_vouchers_created_by_fkey(full_name),cash_accounts(id,name,account_type,bank_name,bank_account)";

function escapePostgrestIlike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", "\\,");
}

function readBody(parsed: unknown) {
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
}

export async function GET(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase } = auth;
  const params = new URL(request.url).searchParams;
  const rawFund = params.get("fund") || "all";
  const fund = (["all", "cash", "bank", "ewallet"] as const).includes(rawFund as never) ? rawFund : "all";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 15));
  const search = (params.get("q") || "").trim();
  const type = params.get("type");
  const kind = params.get("kind");
  const creatorId = params.get("creatorId");
  const partnerKind = params.get("partnerKind");
  const partnerId = params.get("partnerId");
  const partnerQuery = (params.get("partnerQuery") || "").trim();
  const profit = params.get("profit");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const statusValues = (params.get("status") || "completed,cancelled").split(",").filter((value) => value === "completed" || value === "cancelled");

  const accountsResult = await supabase.from("cash_accounts").select("id,name,account_type,opening_balance,bank_name,bank_account,active").order("account_type").order("name");
  const accounts = (accountsResult.data || []) as Array<{ id: string; name: string; account_type: string; opening_balance: number; bank_name: string | null; bank_account: string | null; active: boolean }>;
  const fundAccounts = fund === "all" ? accounts : accounts.filter((account) => account.account_type === fund);
  const accountIds = fundAccounts.map((account) => account.id);

  let query = supabase.from("cash_vouchers").select(voucherSelect, { count: "exact" });
  // Fund isolation: always lock to selected fund's account_ids (or empty sentinel)
  query = query.in("account_id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"]);
  if (statusValues.length) query = query.in("status", statusValues);
  if (type === "receipt" || type === "expense") query = query.eq("type", type);
  if (kind && [...receiptKinds, ...expenseKinds].includes(kind)) query = query.eq("kind", kind);
  if (creatorId && uuidPattern.test(creatorId)) query = query.eq("created_by", creatorId);
  if (partnerKind === "customer" || partnerKind === "supplier") query = query.eq("partner_kind", partnerKind);
  if (partnerId && uuidPattern.test(partnerId)) query = query.eq("partner_id", partnerId);
  if (partnerQuery) {
    const safe = escapePostgrestIlike(partnerQuery);
    query = query.ilike("partner_name", `%${safe}%`);
  }
  if (profit === "1") query = query.eq("affects_profit", true);
  if (profit === "0") query = query.eq("affects_profit", false);
  if (/^P[TC]\d+$/i.test(search)) query = query.eq("voucher_number", Number(search.slice(2)));
  else if (search) {
    const safe = escapePostgrestIlike(search);
    query = query.or(`partner_name.ilike.%${safe}%,note.ilike.%${safe}%`);
  }
  if (dateFrom) query = query.gte("occurred_at", `${dateFrom}T00:00:00+07:00`);
  if (dateTo) query = query.lte("occurred_at", `${dateTo}T23:59:59.999+07:00`);

  const from = (page - 1) * pageSize;
  const result = await query.order("occurred_at", { ascending: false, nullsFirst: false }).order("voucher_number", { ascending: false }).range(from, from + pageSize - 1);
  if (result.error) { console.error("[api:cashbook:GET]", result.error); return NextResponse.json({ error: "Không thể tải sổ quỹ." }, { status: 400 }); }

  let summary = { opening: 0, total_receipt: 0, total_expense: 0 };
  if (accountIds.length) {
    const summaryResult = await supabase.rpc("cashbook_summary", {
      p_account_ids: accountIds,
      p_from: dateFrom ? `${dateFrom}T00:00:00+07:00` : null,
      p_to: dateTo ? `${dateTo}T23:59:59.999+07:00` : null,
    });
    if (!summaryResult.error && summaryResult.data) {
      const row = Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data;
      summary = { opening: Number(row?.opening ?? 0), total_receipt: Number(row?.total_receipt ?? 0), total_expense: Number(row?.total_expense ?? 0) };
    }
  }

  const [creatorsResult, customersResult, suppliersResult] = await Promise.all([
    supabase.from("profiles").select("id,full_name").order("full_name"),
    supabase.from("customers").select("id,name").order("name").limit(500),
    supabase.from("suppliers").select("id,name").order("name").limit(500),
  ]);

  return NextResponse.json({
    vouchers: result.data || [],
    count: result.count || 0,
    accounts,
    summary,
    creators: (creatorsResult.data || []).filter((creator) => creator.id !== null),
    customers: customersResult.data || [],
    suppliers: suppliersResult.data || [],
    page,
    pageSize,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase } = auth;
  const body = readBody(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Dữ liệu phiếu không hợp lệ." }, { status: 400 });
  const accountId = String(body.account_id || "");
  const type = body.type;
  const kind = String(body.kind || "");
  const amount = Number(body.amount || 0);
  const occurredAt = body.occurred_at ? String(body.occurred_at) : new Date().toISOString();
  const affectsProfit = body.affects_profit !== false;
  if (!uuidPattern.test(accountId) || (type !== "receipt" && type !== "expense")) return NextResponse.json({ error: "Dữ liệu phiếu không hợp lệ." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99) return NextResponse.json({ error: "Số tiền giao dịch không hợp lệ." }, { status: 400 });
  if (type === "receipt" && !receiptKinds.includes(kind)) return NextResponse.json({ error: "Loại thu không hợp lệ." }, { status: 400 });
  if (type === "expense" && !expenseKinds.includes(kind)) return NextResponse.json({ error: "Loại chi không hợp lệ." }, { status: 400 });
  if (Number.isNaN(new Date(occurredAt).getTime())) return NextResponse.json({ error: "Thời gian giao dịch không hợp lệ." }, { status: 400 });

  const partnerKind = body.partner_kind ? String(body.partner_kind) : null;
  const partnerId = body.partner_id ? String(body.partner_id) : null;
  if (partnerKind && partnerId && !uuidPattern.test(partnerId)) return NextResponse.json({ error: "Đối tượng giao dịch không hợp lệ." }, { status: 400 });

  const { data: voucherId, error } = await supabase.rpc("cashbook_create_voucher", {
    p_account_id: accountId,
    p_type: type,
    p_kind: kind,
    p_amount: amount,
    p_partner_kind: partnerKind,
    p_partner_id: partnerId,
    p_partner_name: body.partner_name ? String(body.partner_name) : null,
    p_note: body.note ? String(body.note) : null,
    p_occurred_at: occurredAt,
    p_affects_profit: affectsProfit,
  });
  if (error || !voucherId) { console.error("[api:cashbook:POST]", error); return NextResponse.json({ error: isRaisedException(error) ? error.message : "Không thể lưu phiếu." }, { status: 400 }); }
  
  // Tự động gạch nợ vận đơn khi thu nợ khách hàng nếu có shipment_id
  if (type === "receipt" && kind === "debt_collection") {
    const shipmentId = String(body.shipment_id || "").trim();
    if (shipmentId && uuidPattern.test(shipmentId)) {
      await supabase.rpc("link_debt_collection_to_shipment", {
        p_voucher_id: voucherId,
        p_shipment_id: shipmentId,
      });
    }
  }

  const result = await supabase.from("cash_vouchers").select(voucherSelect).eq("id", voucherId).single();
  if (result.error) return NextResponse.json({ error: "Phiếu đã lưu nhưng không thể tải lại dữ liệu." }, { status: 500 });
  return NextResponse.json({ voucher: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase } = auth;
  const body = readBody(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  const id = String(body.id || "");
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Phiếu không hợp lệ." }, { status: 400 });
  const { error } = await supabase.rpc("cashbook_cancel_voucher", { p_voucher_id: id });
  if (error) { console.error("[api:cashbook:PATCH]", error); return NextResponse.json({ error: isRaisedException(error) ? error.message : "Không thể hủy phiếu." }, { status: 400 }); }
  const result = await supabase.from("cash_vouchers").select(voucherSelect).eq("id", id).single();
  if (result.error) return NextResponse.json({ error: "Không thể tải lại phiếu." }, { status: 500 });
  return NextResponse.json({ voucher: result.data });
}