import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

type Line = { product_id: string; quantity: number; cost?: number; discount?: number };

export async function GET() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.from("purchase_vouchers").select("*, suppliers(id,name,code), profiles(full_name)").order("created_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Không thể tải phiếu nhập hàng." }, { status: 400 });
  const list = (data || []).map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status,
    supplierCode: (row.suppliers as { code?: string } | null)?.code || "",
    supplier: (row.suppliers as { name?: string } | null)?.name || "",
    branch: row.branch || "",
    handler: row.handler || "",
    invoice: row.invoice_number || "",
    note: row.note || "",
    totalQty: Number(row.total_qty || 0),
    itemCount: Number(row.item_count || 0),
    subtotal: Number(row.subtotal || 0),
    discount: Number(row.discount || 0),
    payable: Number(row.payable || 0),
    paid: Number(row.paid || 0),
    creator: (row.profiles as { full_name?: string } | null)?.full_name || "",
    createdAt: row.created_at,
  }));
  return NextResponse.json({ vouchers: list });
}

export async function POST(request: Request) {
  const { supabase, profile } = await requireProfile("manager");
  const body = await request.json() as Record<string, unknown>;
  const status = body.status === "completed" ? "completed" : "draft";
  const supplierId = String(body.supplier_id || "").trim() || null;
  const invoiceNumber = String(body.invoice_number || "").trim();
  const noteRaw = String(body.note || "").trim();
  const rawCode = String((body.code as string) || (body as Record<string, unknown>).voucher_code || "").trim();
  const voucherCode = rawCode || `PN${String(Date.now()).slice(-9)}`;
  const rawCreatedAt = String((body.created_at as string) || (body as Record<string, unknown>).createdAt || "").trim();
  let createdAtISO: string | null = null;
  if (rawCreatedAt) {
    const d = new Date(rawCreatedAt);
    if (!Number.isNaN(d.getTime())) createdAtISO = d.toISOString();
  }
  const purchaseOrderCode = String(
    (body.purchase_order_code as string) ||
      (body as Record<string, unknown>).purchase_code ||
      (body as Record<string, unknown>).purchaseOrderCode ||
      (body as Record<string, unknown>).source_code ||
      (body as Record<string, unknown>).sourceCode ||
      "",
  ).trim() || null;
  const lines = (Array.isArray(body.lines) ? body.lines : []) as Line[];
  const validLines = lines.filter((line) => Number(line.quantity) > 0);
  if (!validLines.length) return NextResponse.json({ error: "Vui lòng nhập số lượng hàng nhập." }, { status: 400 });

  const productIds = validLines.map((line) => line.product_id);
  const { data: products, error: productError } = await supabase.from("products").select("id,stock_quantity,cost").in("id", productIds);
  if (productError || !products) return NextResponse.json({ error: "Không thể tải hàng hóa." }, { status: 400 });
  const byId = new Map(products.map((product) => [product.id, product]));

  // Resolve branch
  let branchId: string | null = null;
  let branchName = "Chi nhánh trung tâm";
  const { data: branchData } = await supabase
    .from("store_branches")
    .select("id,name")
    .eq("store_id", profile.store_id)
    .eq("active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (branchData && (branchData as { id: string; name: string }).id) {
    branchId = (branchData as { id: string; name: string }).id;
    branchName = (branchData as { name: string }).name || branchName;
  }

  // Pre-fetch branch inventory for validation and avg computation
  const branchInventoryMap = new Map<string, number>();
  if (branchId) {
    const { data: inventories } = await supabase
      .from("product_branch_inventory")
      .select("product_id,quantity")
      .eq("branch_id", branchId)
      .in("product_id", productIds);
    for (const inv of (inventories as Array<{ product_id: string; quantity: number | string }> || [])) {
      branchInventoryMap.set(inv.product_id, Number(inv.quantity || 0));
    }
  }

  let subtotal = 0, discount = 0, totalQty = 0;
  const lineRows = validLines.map((line) => {
    const qty = Math.max(0, Math.trunc(Number(line.quantity) || 0));
    const cost = Math.max(0, Number(line.cost) ?? Number((byId.get(line.product_id) as { cost?: number | string } | undefined)?.cost || 0));
    const lineDiscount = Math.max(0, Number(line.discount || 0));
    const value = Math.round(qty * cost * 100) / 100;
    subtotal += value;
    discount += lineDiscount;
    totalQty += qty;
    return { product_id: line.product_id, quantity: qty, cost, discount: lineDiscount, value };
  });
  const payable = Math.max(0, subtotal - discount);
  const paid = status === "completed" ? payable : 0;

  // Merge purchase_order_code into note if column not exists (fallback)
  let finalNote: string | null = noteRaw || null;
  if (purchaseOrderCode) {
    finalNote = noteRaw ? `[ĐH:${purchaseOrderCode}] ${noteRaw}` : `[ĐH:${purchaseOrderCode}]`;
  }

  const insertPayload: Record<string, unknown> = {
    store_id: profile.store_id,
    code: voucherCode,
    status,
    supplier_id: supplierId,
    branch: branchName,
    handler: profile.full_name,
    invoice_number: invoiceNumber || null,
    note: finalNote,
    total_qty: totalQty,
    item_count: lineRows.length,
    subtotal,
    discount,
    payable,
    paid,
    created_by: profile.id,
    ...(createdAtISO ? { created_at: createdAtISO } : {}),
  };

  // Try to include purchase_order_code if DB supports it (idempotent retry without it)
  let voucher: { id: string } | null = null;
  let insertError: unknown = null;
  {
    const attemptPayload = purchaseOrderCode ? { ...insertPayload, purchase_order_code: purchaseOrderCode } : insertPayload;
    const result = (await supabase.from("purchase_vouchers").insert(attemptPayload).select("id").single()) as unknown as { data: { id: string } | null; error: { message?: string; code?: string } | null };
    voucher = result.data;
    insertError = result.error;
    const errMsg = (insertError as { message?: string } | null)?.message || "";
    if (insertError && purchaseOrderCode && errMsg.toLowerCase().includes("purchase_order_code")) {
      const fallback = (await supabase.from("purchase_vouchers").insert(insertPayload).select("id").single()) as unknown as { data: { id: string } | null; error: { message?: string; code?: string } | null };
      voucher = fallback.data;
      insertError = fallback.error;
    }
    const finalErr = insertError as { message?: string; code?: string } | null;
    if (finalErr && (String(finalErr.message || "").toLowerCase().includes("duplicate") || finalErr.code === "23505")) {
      return NextResponse.json({ error: "Mã phiếu nhập đã tồn tại." }, { status: 400 });
    }
  }
  if (insertError || !voucher) return NextResponse.json({ error: "Không thể lưu phiếu nhập hàng." }, { status: 400 });

  const { error: linesError } = await supabase.from("purchase_lines").insert(lineRows.map((line) => ({ voucher_id: voucher.id, ...line })));
  if (linesError) {
    // transaction-like rollback: remove voucher to avoid orphan
    await supabase.from("purchase_vouchers").delete().eq("id", voucher.id);
    return NextResponse.json({ error: "Không thể lưu chi tiết phiếu." }, { status: 400 });
  }

  if (status === "completed") {
    const productUpdates: Array<{ id: string; stock_quantity: number; cost: number }> = [];
    const branchUpdates: Array<{ product_id: string; branch_id: string; quantity: number }> = [];
    const movements: Array<Record<string, unknown>> = [];
    for (const line of lineRows) {
      const current = byId.get(line.product_id) as { stock_quantity?: number | string; cost?: number | string } | undefined;
      const oldStock = Number(current?.stock_quantity || 0);
      const oldCost = Number(current?.cost || 0);
      const newStock = oldStock + line.quantity;
      let newCost = line.cost;
      if (oldStock + line.quantity > 0) {
        newCost = (oldStock * oldCost + line.quantity * line.cost) / (oldStock + line.quantity);
        newCost = Math.round(newCost * 100) / 100;
      }
      productUpdates.push({ id: line.product_id, stock_quantity: newStock, cost: newCost });
      if (branchId) {
        const oldBranchQty = branchInventoryMap.get(line.product_id) ?? 0;
        const newBranchQty = oldBranchQty + line.quantity;
        branchUpdates.push({ product_id: line.product_id, branch_id: branchId, quantity: newBranchQty });
      }
      movements.push({ store_id: profile.store_id, product_id: line.product_id, type: "purchase", quantity: line.quantity, note: `Phiếu nhập ${voucher.id}`, created_by: profile.id });
    }

    // Batch update products with average cost
    for (const upd of productUpdates) {
      const { error } = await supabase.from("products").update({ stock_quantity: upd.stock_quantity, cost: upd.cost }).eq("id", upd.id);
      if (error) {
        await supabase.from("purchase_lines").delete().eq("voucher_id", voucher.id);
        await supabase.from("purchase_vouchers").delete().eq("id", voucher.id);
        return NextResponse.json({ error: "Không thể cập nhật tồn kho." }, { status: 400 });
      }
    }
    // Upsert branch inventory
    if (branchId && branchUpdates.length) {
      for (const bu of branchUpdates) {
        const { error } = await supabase
          .from("product_branch_inventory")
          .upsert({ product_id: bu.product_id, branch_id: bu.branch_id, quantity: bu.quantity, updated_at: new Date().toISOString() }, { onConflict: "product_id,branch_id" });
        if (error) {
          // try insert fallback if upsert not supported for composite key formatting
          const { error: insertBranchError } = await supabase.from("product_branch_inventory").insert({ product_id: bu.product_id, branch_id: bu.branch_id, quantity: bu.quantity });
          if (insertBranchError) {
            await supabase.from("purchase_lines").delete().eq("voucher_id", voucher.id);
            await supabase.from("purchase_vouchers").delete().eq("id", voucher.id);
            return NextResponse.json({ error: "Không thể cập nhật tồn kho chi nhánh." }, { status: 400 });
          }
        }
      }
    }
    if (movements.length) {
      const { error: moveError } = await supabase.from("inventory_movements").insert(movements);
      if (moveError) {
        return NextResponse.json({ error: "Không thể ghi lịch sử tồn kho." }, { status: 400 });
      }
    }
  }
  return NextResponse.json({ voucher: { id: voucher.id, code: voucherCode, status, payable, paid } }, { status: 201 });
}
