import { requireProfile } from "@/lib/auth";
import CashFlowClient, { type CashAccount, type CashMeta, type CashSummary, type CashVoucher } from "./cashflow-client";

export const dynamic = "force-dynamic";

const voucherSelect = "id,voucher_number,account_id,type,kind,amount,partner_kind,partner_id,partner_name,note,affects_profit,status,occurred_at,created_at,cancelled_at,created_by,creator:profiles!cash_vouchers_created_by_fkey(full_name),cash_accounts(id,name,account_type,bank_name,bank_account)";

export default async function CashFlowPage() {
  const { supabase, profile } = await requireProfile("manager");
  const accountsResult = await supabase.from("cash_accounts").select("id,name,account_type,opening_balance,bank_name,bank_account,active").order("account_type").order("name");
  const accounts = (accountsResult.data || []) as CashAccount[];
  const accountIds = accounts.map((account) => account.id);

  let vouchers: CashVoucher[] = [];
  let count = 0;
  let summary: CashSummary = { opening: 0, total_receipt: 0, total_expense: 0 };
  if (accountIds.length) {
    const [voucherResult, summaryResult] = await Promise.all([
      supabase.from("cash_vouchers").select(voucherSelect, { count: "exact" }).in("account_id", accountIds).in("status", ["completed", "cancelled"]).order("occurred_at", { ascending: false }).order("voucher_number", { ascending: false }).range(0, 14),
      supabase.rpc("cashbook_summary", { p_account_ids: accountIds, p_from: null, p_to: null }),
    ]);
    vouchers = (voucherResult.data || []) as unknown as CashVoucher[];
    count = voucherResult.count || 0;
    if (!summaryResult.error && summaryResult.data) {
      const row = Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data;
      summary = { opening: Number(row?.opening ?? 0), total_receipt: Number(row?.total_receipt ?? 0), total_expense: Number(row?.total_expense ?? 0) };
    }
  }

  const [creators, customers, suppliers] = await Promise.all([
    supabase.from("profiles").select("id,full_name").eq("active", true).order("full_name"),
    supabase.from("customers").select("id,name").order("name").limit(500),
    supabase.from("suppliers").select("id,name").order("name").limit(500),
  ]);
  const meta: CashMeta = { creators: (creators.data || []).filter((creator) => creator.id !== null), customers: customers.data || [], suppliers: suppliers.data || [] };

  return (
    <CashFlowClient
      profile={profile}
      initialAccounts={accounts}
      initialVouchers={vouchers}
      initialCount={count}
      initialSummary={summary}
      initialMeta={meta}
      dataWarning={accountsResult.error ? "Sổ quỹ chưa sẵn sàng. Vui lòng áp dụng migration 008." : ""}
    />
  );
}