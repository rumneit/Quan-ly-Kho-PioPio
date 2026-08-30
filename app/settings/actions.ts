"use server";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreInfo = { id: string; name: string; createdAt: string };

export async function getStoreInfo(): Promise<StoreInfo> {
  const { requireProfile } = await import("@/lib/auth");
  const { profile } = await requireProfile("manager");
  const admin = createAdminClient();
  const { data } = await admin.from("stores").select("id,name,created_at").eq("id", profile.store_id).single();
  return { id: data?.id || profile.store_id, name: data?.name || "Cửa hàng", createdAt: data?.created_at || "" };
}

export type StoreBranch = { id: string; name: string; address: string | null; phone: string | null; isDefault: boolean; active: boolean };

export async function getStoreBranches(): Promise<StoreBranch[]> {
  const { requireProfile } = await import("@/lib/auth");
  const { profile } = await requireProfile("manager");
  const admin = createAdminClient();
  const { data } = await admin.from("store_branches").select("id,name,address,phone,is_default,active").eq("store_id", profile.store_id).order("is_default", { ascending: false }).order("created_at");
  return (data || []).map((b) => ({
    id: b.id, name: b.name, address: b.address, phone: b.phone, isDefault: b.is_default, active: b.active,
  }));
}

export type StoreUser = { id: string; username: string; fullName: string; role: string; active: boolean };

export async function getStoreUsers(): Promise<StoreUser[]> {
  const { requireProfile } = await import("@/lib/auth");
  const { profile } = await requireProfile("manager");
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id,username,full_name,role,active").eq("store_id", profile.store_id).order("full_name");
  return (data || []).map((u) => ({
    id: u.id, username: u.username, fullName: u.full_name, role: u.role, active: u.active,
  }));
}
export type StoreSettings = {
  costMethod: "fixed" | "average";
  trackLotExpiry: boolean;
  manufacturingEnabled: boolean;
  allowChangeTransactionTime: boolean;
  allowNegativeStock: boolean;
  workingTimeBand: number;
  currency: string;
};

export async function getStoreSettings(): Promise<StoreSettings> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const { data } = await admin.from("store_settings").select("*").eq("store_id", profile.store_id).maybeSingle();
  return {
    costMethod: (data?.cost_method as "fixed" | "average") || "average",
    trackLotExpiry: Boolean(data?.track_lot_expiry),
    manufacturingEnabled: Boolean(data?.manufacturing_enabled),
    allowChangeTransactionTime: Boolean(data?.allow_change_transaction_time),
    allowNegativeStock: Boolean(data?.allow_negative_stock),
    workingTimeBand: Number(data?.working_time_band ?? 1),
    currency: data?.currency || "VND",
  };
}

export async function updateStoreSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: profile.id };
  if (patch.costMethod !== undefined) payload.cost_method = patch.costMethod;
  if (patch.trackLotExpiry !== undefined) payload.track_lot_expiry = patch.trackLotExpiry;
  if (patch.manufacturingEnabled !== undefined) payload.manufacturing_enabled = patch.manufacturingEnabled;
  if (patch.allowChangeTransactionTime !== undefined) payload.allow_change_transaction_time = patch.allowChangeTransactionTime;
  if (patch.allowNegativeStock !== undefined) payload.allow_negative_stock = patch.allowNegativeStock;
  if (patch.workingTimeBand !== undefined) payload.working_time_band = patch.workingTimeBand;
  if (patch.currency !== undefined) payload.currency = patch.currency;
  await admin.from("store_settings").upsert({ store_id: profile.store_id, ...payload }).eq("store_id", profile.store_id);
  await recordAudit("settings.update", "store_settings", profile.store_id, { fields: Object.keys(payload) });
  return getStoreSettings();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const { createClient } = await import("@/lib/supabase/server");
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = await createClient();
  // verify current password
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: `${profile.username}@auth.khopiopio.app`, password: currentPassword });
  if (verifyError) return { ok: false, error: "Mật khẩu hiện tại không đúng." };
  if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return { ok: false, error: "Mật khẩu mới cần ít nhất 10 ký tự, gồm chữ và số." };
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(profile.id, { password: newPassword });
  if (error) return { ok: false, error: "Không thể đổi mật khẩu." };
  await recordAudit("settings.password_change", "profile", profile.id, {});
  return { ok: true };
}

export type ProductGroupPermission = { userId: string; categoryId: string };

export async function getProductGroups() {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const { data } = await admin.from("product_categories").select("id,name").eq("store_id", profile.store_id).order("name");
  return (data || []).map((c) => ({ id: c.id, name: c.name }));
}

export async function getUserProductGroupPermissions(): Promise<ProductGroupPermission[]> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const { data } = await admin.from("user_product_group_permissions").select("user_id,category_id").eq("store_id", profile.store_id);
  return (data || []).map((r) => ({ userId: r.user_id, categoryId: r.category_id }));
}

export async function setUserProductGroupPermissions(userId: string, categoryIds: string[]): Promise<void> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  await admin.from("user_product_group_permissions").delete().eq("store_id", profile.store_id).eq("user_id", userId);
  if (categoryIds.length) {
    await admin.from("user_product_group_permissions").insert(categoryIds.map((categoryId) => ({ store_id: profile.store_id, user_id: userId, category_id: categoryId, granted_by: profile.id })));
  }
  await recordAudit("settings.permissions.update", "user", userId, { categoryIds });
}

export type AuditEntry = { id: string; actor: string | null; action: string; entity: string; details: Record<string, unknown>; createdAt: string };

export async function recordAudit(action: string, entity: string, entityId: string, details: Record<string, unknown> = {}) {
  const admin = createAdminClient();
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  await admin.from("audit_log").insert({ store_id: profile.store_id, actor_id: profile.id, action, entity, entity_id: entityId, details });
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const { data } = await admin.from("audit_log").select("id,action,entity,details,created_at,profiles(full_name)").eq("store_id", profile.store_id).order("created_at", { ascending: false }).limit(200);
  return (data || []).map((r) => {
    const rel = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return { id: r.id, actor: rel?.full_name || null, action: r.action, entity: r.entity, details: r.details || {}, createdAt: r.created_at };
  });
}

export type BookPeriod = { id: string; periodStart: string; periodEnd: string; note: string | null; lockedAt: string; lockedBy: string | null };

export async function getBookPeriods(): Promise<BookPeriod[]> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const { data } = await admin.from("book_periods").select("id,period_start,period_end,note,locked_at,profiles(full_name)").eq("store_id", profile.store_id).order("period_end", { ascending: false });
  return (data || []).map((r) => {
    const rel = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return { id: r.id, periodStart: r.period_start, periodEnd: r.period_end, note: r.note, lockedAt: r.locked_at, lockedBy: rel?.full_name || null };
  });
}

export async function lockBookPeriod(periodStart: string, periodEnd: string, note?: string): Promise<void> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  await admin.from("book_periods").insert({ store_id: profile.store_id, period_start: periodStart, period_end: periodEnd, note: note || null, locked_by: profile.id });
  await recordAudit("settings.book_lock", "book_period", `${periodStart}_${periodEnd}`, {});
}

export async function unlockBookPeriod(id: string): Promise<void> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  await admin.from("book_periods").delete().eq("store_id", profile.store_id).eq("id", id);
  await recordAudit("settings.book_unlock", "book_period", id, {});
}

export type PrintTemplate = { id: string; type: string; name: string; paperSize: string; copies: number; showLogo: boolean; showStoreInfo: boolean; showTax: boolean; footerNote: string | null; active: boolean };

export async function getPrintTemplates(): Promise<PrintTemplate[]> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const { data } = await admin.from("print_templates").select("*").eq("store_id", profile.store_id).order("type").order("name");
  return (data || []).map((r) => ({
    id: r.id, type: r.type, name: r.name, paperSize: r.paper_size, copies: r.copies,
    showLogo: r.show_logo, showStoreInfo: r.show_store_info, showTax: r.show_tax,
    footerNote: r.footer_note, active: r.active,
  }));
}

export async function savePrintTemplate(t: Omit<PrintTemplate, "id"> & { id?: string }): Promise<void> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const payload = {
    store_id: profile.store_id, type: t.type, name: t.name, paper_size: t.paperSize, copies: t.copies,
    show_logo: t.showLogo, show_store_info: t.showStoreInfo, show_tax: t.showTax, footer_note: t.footerNote, active: t.active, updated_at: new Date().toISOString(),
  };
  if (t.id) { await admin.from("print_templates").update(payload).eq("id", t.id).eq("store_id", profile.store_id); }
  else { await admin.from("print_templates").insert(payload); }
  await recordAudit("settings.print_template.save", "print_template", t.id || t.name, {});
}

export type Device = { id: string; name: string; kind: string; identifier: string; lastSeenAt: string | null; active: boolean };

export async function getDevices(): Promise<Device[]> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const { data } = await admin.from("devices").select("id,name,kind,identifier,last_seen_at,active").eq("store_id", profile.store_id).order("paired_at", { ascending: false });
  return (data || []).map((r) => ({ id: r.id, name: r.name, kind: r.kind, identifier: r.identifier, lastSeenAt: r.last_seen_at, active: r.active }));
}

export async function unpairDevice(id: string): Promise<void> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  await admin.from("devices").delete().eq("store_id", profile.store_id).eq("id", id);
  await recordAudit("settings.device.unpair", "device", id, {});
}

export type ApiToken = { id: string; name: string; scopes: string; tokenPrefix: string; createdAt: string; lastUsedAt: string | null; active: boolean };

export async function getApiTokens(): Promise<ApiToken[]> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const { data } = await admin.from("api_tokens").select("id,name,scopes,token_prefix,created_at,last_used_at,active").eq("store_id", profile.store_id).order("created_at", { ascending: false });
  return (data || []).map((r) => ({ id: r.id, name: r.name, scopes: r.scopes, tokenPrefix: r.token_prefix, createdAt: r.created_at, lastUsedAt: r.last_used_at, active: r.active }));
}

export async function createApiToken(name: string, scopes: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  if (!name.trim() || name.length > 80) return { ok: false, error: "Tên token không hợp lệ." };
  if (scopes !== "read" && scopes !== "read_write") return { ok: false, error: "Phạm vi không hợp lệ." };
  const crypto = await import("node:crypto");
  const raw = `pip_${crypto.randomBytes(24).toString("hex")}`;
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const { error } = await admin.from("api_tokens").insert({ store_id: profile.store_id, name: name.trim(), scopes, token_hash: tokenHash, token_prefix: raw.slice(0, 12), created_by: profile.id });
  if (error) return { ok: false, error: "Không thể tạo token." };
  await recordAudit("settings.api_token.create", "api_token", name.trim(), { scopes });
  return { ok: true, token: raw };
}

export async function revokeApiToken(id: string): Promise<void> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  await admin.from("api_tokens").delete().eq("store_id", profile.store_id).eq("id", id);
  await recordAudit("settings.api_token.revoke", "api_token", id, {});
}

export type ExchangeRate = { id: string; currency: string; rate: number };

export async function getExchangeRates(): Promise<ExchangeRate[]> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const { data } = await admin.from("currency_exchange_rates").select("id,currency,rate").eq("store_id", profile.store_id).order("currency");
  return (data || []).map((r) => ({ id: r.id, currency: r.currency, rate: Number(r.rate) }));
}

export async function upsertExchangeRate(currency: string, rate: number): Promise<{ ok: boolean; error?: string }> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  if (!currency.trim() || currency.length > 8) return { ok: false, error: "Mã tiền tệ không hợp lệ." };
  if (!Number.isFinite(rate) || rate <= 0) return { ok: false, error: "Tỷ giá phải lớn hơn 0." };
  const { error } = await admin.from("currency_exchange_rates").upsert({ store_id: profile.store_id, currency: currency.trim().toUpperCase(), rate, updated_by: profile.id, updated_at: new Date().toISOString() }).eq("store_id", profile.store_id);
  if (error) return { ok: false, error: "Không thể lưu tỷ giá." };
  await recordAudit("settings.exchange_rate.upsert", "currency", currency, { rate });
  return { ok: true };
}

export async function deleteExchangeRate(id: string): Promise<void> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  await admin.from("currency_exchange_rates").delete().eq("store_id", profile.store_id).eq("id", id);
  await recordAudit("settings.exchange_rate.delete", "currency", id, {});
}

export async function deleteStoreTransactions(password: string): Promise<{ ok: boolean; error?: string; count?: number }> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  // verify password via the user's real session
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: `${profile.username}@auth.khopiopio.app`, password });
  if (verifyError) return { ok: false, error: "Mật khẩu không đúng. Không thể xóa dữ liệu." };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("delete_store_transactions", { p_store_id: profile.store_id });
  if (error) return { ok: false, error: error.message };
  await recordAudit("data.delete_transactions", "store", profile.store_id, {});
  return { ok: true, count: data ?? 0 };
}

export async function deleteAllStoreData(password: string): Promise<{ ok: boolean; error?: string; count?: number }> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: `${profile.username}@auth.khopiopio.app`, password });
  if (verifyError) return { ok: false, error: "Mật khẩu không đúng. Không thể xóa dữ liệu." };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("delete_store_all_data", { p_store_id: profile.store_id });
  if (error) return { ok: false, error: error.message };
  await recordAudit("data.delete_all", "store", profile.store_id, {});
  return { ok: true, count: data ?? 0 };
}

export async function getProductStats(): Promise<{ categories: number; brands: number; products: number; groups: number }> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const [c, b, p, g] = await Promise.all([
    admin.from("product_categories").select("id", { count: "exact", head: true }).eq("store_id", profile.store_id),
    admin.from("product_brands").select("id", { count: "exact", head: true }).eq("store_id", profile.store_id),
    admin.from("products").select("id", { count: "exact", head: true }).eq("store_id", profile.store_id),
    admin.from("customer_groups").select("id", { count: "exact", head: true }).eq("store_id", profile.store_id),
  ]);
  return { categories: c.count || 0, brands: b.count || 0, products: p.count || 0, groups: g.count || 0 };
}

export type StoreSettingsExtended = StoreSettings & {
  allowChangeTransactionDate: boolean;
  autoSuggestProductInfo: boolean;
  barcodeManagement: boolean;
  productGroupPermissionsEnabled: boolean;
  rewardPointsEnabled: boolean;
  rewardPointRate: number;
  defaultTaxRate: number;
  invoiceTemplate: string;
  enableSms: boolean;
  enableZalo: boolean;
  enableDelivery: boolean;
  enablePaymentGateway: boolean;
  loyaltyProgramEnabled: boolean;
};

export async function getStoreSettingsExtended(): Promise<StoreSettingsExtended> {
  const base = await getStoreSettings();
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const { data } = await admin.from("store_settings").select("*").eq("store_id", profile.store_id).maybeSingle();
  return {
    ...base,
    allowChangeTransactionDate: Boolean(data?.allow_change_transaction_date),
    autoSuggestProductInfo: data?.auto_suggest_product_info !== false,
    barcodeManagement: data?.barcode_management !== false,
    productGroupPermissionsEnabled: Boolean(data?.product_group_permissions_enabled),
    rewardPointsEnabled: Boolean(data?.reward_points_enabled),
    rewardPointRate: Number(data?.reward_point_rate ?? 10000),
    defaultTaxRate: Number(data?.default_tax_rate ?? 0),
    invoiceTemplate: data?.invoice_template || "standard",
    enableSms: Boolean(data?.enable_sms),
    enableZalo: Boolean(data?.enable_zalo),
    enableDelivery: data?.enable_delivery !== false,
    enablePaymentGateway: Boolean(data?.enable_payment_gateway),
    loyaltyProgramEnabled: Boolean(data?.loyalty_program_enabled),
  };
}

export async function updateStoreSettingsExtended(patch: Partial<StoreSettingsExtended>): Promise<StoreSettingsExtended> {
  const { profile } = await import("@/lib/auth").then((m) => m.requireProfile("manager"));
  const admin = createAdminClient();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: profile.id };
  if (patch.allowChangeTransactionDate !== undefined) payload.allow_change_transaction_date = patch.allowChangeTransactionDate;
  if (patch.autoSuggestProductInfo !== undefined) payload.auto_suggest_product_info = patch.autoSuggestProductInfo;
  if (patch.barcodeManagement !== undefined) payload.barcode_management = patch.barcodeManagement;
  if (patch.productGroupPermissionsEnabled !== undefined) payload.product_group_permissions_enabled = patch.productGroupPermissionsEnabled;
  if (patch.rewardPointsEnabled !== undefined) payload.reward_points_enabled = patch.rewardPointsEnabled;
  if (patch.rewardPointRate !== undefined) payload.reward_point_rate = patch.rewardPointRate;
  if (patch.defaultTaxRate !== undefined) payload.default_tax_rate = patch.defaultTaxRate;
  if (patch.invoiceTemplate !== undefined) payload.invoice_template = patch.invoiceTemplate;
  if (patch.enableSms !== undefined) payload.enable_sms = patch.enableSms;
  if (patch.enableZalo !== undefined) payload.enable_zalo = patch.enableZalo;
  if (patch.enableDelivery !== undefined) payload.enable_delivery = patch.enableDelivery;
  if (patch.enablePaymentGateway !== undefined) payload.enable_payment_gateway = patch.enablePaymentGateway;
  if (patch.loyaltyProgramEnabled !== undefined) payload.loyalty_program_enabled = patch.loyaltyProgramEnabled;
  await admin.from("store_settings").upsert({ store_id: profile.store_id, ...payload }).eq("store_id", profile.store_id);
  await recordAudit("settings.extended.update", "store_settings", profile.store_id, { fields: Object.keys(payload) });
  return getStoreSettingsExtended();
}