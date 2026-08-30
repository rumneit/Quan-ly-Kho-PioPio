import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { isRaisedException } from "@/lib/api-utils";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readBody(parsed: unknown) {
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
}

export async function POST(request: Request) {
  const { supabase } = await requireProfile("manager");
  const body = readBody(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Dữ liệu tài khoản quỹ không hợp lệ." }, { status: 400 });
  const name = String(body.name || "").trim();
  const accountType = body.account_type;
  const openingBalance = Number(body.opening_balance || 0);
  if (!name || name.length > 120) return NextResponse.json({ error: "Tên tài khoản quỹ không hợp lệ." }, { status: 400 });
  if (accountType !== "cash" && accountType !== "bank" && accountType !== "ewallet") return NextResponse.json({ error: "Loại quỹ không hợp lệ." }, { status: 400 });
  if (!Number.isFinite(openingBalance) || openingBalance < 0 || openingBalance > 999999999999.99) return NextResponse.json({ error: "Số dư đầu kỳ không hợp lệ." }, { status: 400 });

  const { data: accountId, error } = await supabase.rpc("cashbook_create_account", {
    p_name: name,
    p_account_type: accountType,
    p_opening_balance: openingBalance,
    p_bank_name: body.bank_name ? String(body.bank_name) : null,
    p_bank_account: body.bank_account ? String(body.bank_account) : null,
  });
  if (error || !accountId) { console.error("[api:cashbook:accounts:POST]", error); return NextResponse.json({ error: isRaisedException(error) ? error.message : "Không thể tạo tài khoản quỹ." }, { status: 400 }); }
  const result = await supabase.from("cash_accounts").select("id,name,account_type,opening_balance,bank_name,bank_account,active").eq("id", accountId).single();
  if (result.error) return NextResponse.json({ error: "Tài khoản đã tạo nhưng không thể tải lại dữ liệu." }, { status: 500 });
  return NextResponse.json({ account: result.data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase } = await requireProfile("manager");
  const body = readBody(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  const id = String(body.id || "");
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Tài khoản quỹ không hợp lệ." }, { status: 400 });
  const { error } = await supabase.rpc("cashbook_update_account", {
    p_account_id: id,
    p_name: body.name != null ? String(body.name) : null,
    p_opening_balance: body.opening_balance != null ? Number(body.opening_balance) : null,
    p_bank_name: body.bank_name != null ? String(body.bank_name) : null,
    p_bank_account: body.bank_account != null ? String(body.bank_account) : null,
    p_active: body.active != null ? body.active === true : null,
  });
  if (error) { console.error("[api:cashbook:accounts:PATCH]", error); return NextResponse.json({ error: isRaisedException(error) ? error.message : "Không thể cập nhật tài khoản quỹ." }, { status: 400 }); }
  const result = await supabase.from("cash_accounts").select("id,name,account_type,opening_balance,bank_name,bank_account,active").eq("id", id).single();
  if (result.error) return NextResponse.json({ error: "Không thể tải lại tài khoản quỹ." }, { status: 500 });
  return NextResponse.json({ account: result.data });
}