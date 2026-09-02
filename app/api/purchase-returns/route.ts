import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/auth";
import { readJsonBody } from "@/lib/api-utils";

type Line = { product_id: string; quantity: number; return_price?: number };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const auth = await requireApiProfile(); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase } = auth;
  const { data, error } = await supabase.from("purchase_return_vouchers").select("*, suppliers(id,name,code), profiles(full_name)").order("created_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Không thể tải phiếu trả hàng nhập." }, { status: 400 });
  const list = (data || []).map((row) => ({
    id: row.id,
    code: row.code,
    purchaseCode: "",
    status: row.status,
    supplier: (row.suppliers as { name?: string } | null)?.name || "",
    branch: row.branch || "",
    handler: row.handler || "",
    note: row.note || "",
    totalQty: Number(row.total_qty || 0),
    itemCount: Number(row.item_count || 0),
    subtotal: Number(row.subtotal || 0),
    discount: Number(row.discount || 0),
    payable: Number(row.payable || 0),
    paid: Number(row.paid || 0),
    refund_type: row.refund_type || "debt",
    creator: (row.profiles as { full_name?: string } | null)?.full_name || "",
    createdAt: row.created_at,
  }));
  return NextResponse.json({ vouchers: list, truncated: (data || []).length === 500 });
}

export async function POST(request: Request) {
  const auth = await requireApiProfile("manager"); if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status }); const { supabase, profile } = auth;
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu phiếu trả hàng không hợp lệ." }, { status: 400 });
  const status = body.status === "completed" ? "completed" : "draft";
  const supplierId = String(body.supplier_id || "").trim() || null;
  let purchaseId: string | null = String(body.purchase_id || "").trim() || null;
  const purchaseCodeRaw = String(
    (body.purchase_code as string) ||
      (body as Record<string, unknown>).purchaseCode ||
      (body as Record<string, unknown>).source_code ||
      (body as Record<string, unknown>).sourceCode ||
      (body as Record<string, unknown>).purchase_id_code ||
      "",
  ).trim() || null;
  const refundType = body.refund_type === "cash" ? "cash" : "debt";
  const rawRefundAmount = Number((body.refund_amount as number) ?? (body as Record<string, unknown>).refundAmount ?? (body as Record<string, unknown>).paid ?? 0);
  const refundAmount = Number.isFinite(rawRefundAmount) ? Math.max(0, rawRefundAmount) : 0;
  const rawCode = String((body.code as string) || (body as Record<string, unknown>).voucher_code || "").trim();
  const voucherCode = rawCode || `THN${String(Date.now()).slice(-9)}`;
  const rawCreatedAt = String((body.created_at as string) || (body as Record<string, unknown>).createdAt || "").trim();
  let createdAtISO: string | null = null;
  if (rawCreatedAt) {
    const d = new Date(rawCreatedAt);
    if (!Number.isNaN(d.getTime())) createdAtISO = d.toISOString();
  }
  const note = String(body.note || "").trim();
  const lines = (Array.isArray(body.lines) ? body.lines : []) as Line[];
  const validLines = lines.filter((line) => Number(line.quantity) > 0);
  if (!validLines.length) return NextResponse.json({ error: "Vui lòng nhập số lượng hàng trả." }, { status: 400 });

  // Resolve purchase_id from code if needed (Map sourceCode -> purchase_id)
  if (!purchaseId || !uuidPattern.test(purchaseId)) {
    const candidate = purchaseId || purchaseCodeRaw;
    if (candidate && !uuidPattern.test(candidate)) {
      const { data: purchaseVoucher } = await supabase
        .from("purchase_vouchers")
        .select("id")
        .eq("store_id", profile.store_id)
        .eq("code", candidate)
        .maybeSingle();
      if (purchaseVoucher && (purchaseVoucher as { id: string }).id) {
        purchaseId = (purchaseVoucher as { id: string }).id;
      } else if (candidate && purchaseId === candidate) {
        // if candidate was provided as purchase_id but not UUID and not found, keep null instead of invalid FK
        purchaseId = null;
      }
    } else if (purchaseCodeRaw && !purchaseId) {
      const { data: pv2 } = await supabase.from("purchase_vouchers").select("id").eq("store_id", profile.store_id).eq("code", purchaseCodeRaw).maybeSingle();
      if (pv2 && (pv2 as { id: string }).id) purchaseId = (pv2 as { id: string }).id;
    }
  }

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

  // Pre-fetch branch inventory for stock check (PR-P0-2)
  const branchInventoryMap = new Map<string, number>();
  if (branchId) {
    const { data: inventories } = await supabase
      .from("product_branch_inventory")
      .select("product_id,quantity,reserved")
      .eq("branch_id", branchId)
      .in("product_id", productIds);
    for (const inv of (inventories as Array<{ product_id: string; quantity: number | string; reserved?: number | string }> || [])) {
      branchInventoryMap.set(inv.product_id, Number(inv.quantity || 0));
    }
  }

  let subtotal = 0, discount = 0, totalQty = 0;
  const lineRows = validLines.map((line) => {
    const qty = Math.max(0, Math.trunc(Number(line.quantity) || 0));
    const cost = Math.max(0, Number((byId.get(line.product_id) as { cost?: number | string } | undefined)?.cost || 0));
    const returnPrice = Math.max(0, Number(line.return_price ?? cost));
    const value = Math.round(qty * returnPrice * 100) / 100;
    subtotal += value;
    totalQty += qty;
    return { product_id: line.product_id, quantity: qty, cost, return_price: returnPrice, value };
  });
  const payable = Math.max(0, subtotal - discount);
  let paid = 0;
  if (status === "completed") {
    if (refundType === "cash") {
      paid = Math.min(payable, refundAmount);
      // if refundAmount not provided but cash, default to payable (full cash refund)
      if (!refundAmount && payable > 0) paid = payable;
    } else {
      paid = 0;
    }
  }

  // Check stock availability before any write (PR-P0-2)
  if (status === "completed") {
    for (const line of lineRows) {
      const globalStock = Number((byId.get(line.product_id) as { stock_quantity?: number | string } | undefined)?.stock_quantity || 0);
      if (branchId) {
        const available = branchInventoryMap.has(line.product_id) ? Number(branchInventoryMap.get(line.product_id) || 0) : globalStock;
        if (line.quantity > available) {
          return NextResponse.json({ error: `Tồn kho chi nhánh không đủ cho sản phẩm ${line.product_id}. Tồn: ${available}, trả: ${line.quantity}.` }, { status: 400 });
        }
      } else if (line.quantity > globalStock) {
        return NextResponse.json({ error: `Tồn kho không đủ cho sản phẩm ${line.product_id}. Tồn: ${globalStock}, trả: ${line.quantity}.` }, { status: 400 });
      }
    }
    // also check global stock not hiding negative via Math.max
    for (const line of lineRows) {
      const globalStock = Number((byId.get(line.product_id) as { stock_quantity?: number | string } | undefined)?.stock_quantity || 0);
      if (line.quantity > globalStock) {
        return NextResponse.json({ error: `Tồn kho không đủ cho sản phẩm ${line.product_id}. Tồn: ${globalStock}, trả: ${line.quantity}.` }, { status: 400 });
      }
    }
  }

  const insertPayload: Record<string, unknown> = {
    store_id: profile.store_id,
    code: voucherCode,
    status,
    purchase_id: purchaseId,
    supplier_id: supplierId,
    branch: branchName,
    handler: profile.full_name,
    note: note || null,
    total_qty: totalQty,
    item_count: lineRows.length,
    subtotal,
    discount,
    payable,
    paid,
    refund_type: refundType,
    created_by: profile.id,
    ...(createdAtISO ? { created_at: createdAtISO } : {}),
  };

  let voucher: { id: string } | null = null;
  let insertError: unknown = null;
  {
    const result = (await supabase.from("purchase_return_vouchers").insert(insertPayload).select("id").single()) as unknown as { data: { id: string } | null; error: { message?: string; code?: string } | null };
    voucher = result.data;
    insertError = result.error;
    const finalErr = insertError as { message?: string; code?: string } | null;
    if (finalErr && (String(finalErr.message || "").toLowerCase().includes("duplicate") || finalErr.code === "23505")) {
      return NextResponse.json({ error: "Mã phiếu trả hàng đã tồn tại." }, { status: 400 });
    }
  }
  if (insertError || !voucher) return NextResponse.json({ error: "Không thể lưu phiếu trả hàng nhập." }, { status: 400 });

  const { error: linesError } = await supabase.from("purchase_return_lines").insert(lineRows.map((line) => ({ voucher_id: voucher.id, ...line })));
  if (linesError) {
    await supabase.from("purchase_return_vouchers").delete().eq("id", voucher.id);
    return NextResponse.json({ error: "Không thể lưu chi tiết phiếu." }, { status: 400 });
  }

  if (status === "completed") {
    const movements: Array<Record<string, unknown>> = [];
    for (const line of lineRows) {
      const current = Number((byId.get(line.product_id) as { stock_quantity?: number | string } | undefined)?.stock_quantity || 0);
      const next = current - line.quantity;
      if (next < 0) {
        await supabase.from("purchase_return_lines").delete().eq("voucher_id", voucher.id);
        await supabase.from("purchase_return_vouchers").delete().eq("id", voucher.id);
        return NextResponse.json({ error: "Tồn kho không đủ để trả hàng." }, { status: 400 });
      }
      const { error: updError } = await supabase.from("products").update({ stock_quantity: next }).eq("id", line.product_id);
      if (updError) {
        await supabase.from("purchase_return_lines").delete().eq("voucher_id", voucher.id);
        await supabase.from("purchase_return_vouchers").delete().eq("id", voucher.id);
        return NextResponse.json({ error: "Không thể cập nhật tồn kho." }, { status: 400 });
      }
      if (branchId) {
        const oldBranchQty = branchInventoryMap.get(line.product_id) ?? current;
        const nextBranch = oldBranchQty - line.quantity;
        if (nextBranch < 0) {
          await supabase.from("purchase_return_lines").delete().eq("voucher_id", voucher.id);
          await supabase.from("purchase_return_vouchers").delete().eq("id", voucher.id);
          return NextResponse.json({ error: "Tồn kho chi nhánh không đủ." }, { status: 400 });
        }
        const { error: branchError } = await supabase
          .from("product_branch_inventory")
          .upsert({ product_id: line.product_id, branch_id: branchId, quantity: nextBranch, updated_at: new Date().toISOString() }, { onConflict: "product_id,branch_id" });
        if (branchError) {
          const { error: insertBranchError } = await supabase.from("product_branch_inventory").insert({ product_id: line.product_id, branch_id: branchId, quantity: nextBranch });
          if (insertBranchError) {
            await supabase.from("purchase_return_lines").delete().eq("voucher_id", voucher.id);
            await supabase.from("purchase_return_vouchers").delete().eq("id", voucher.id);
            return NextResponse.json({ error: "Không thể cập nhật tồn kho chi nhánh." }, { status: 400 });
          }
        }
      }
      movements.push({ store_id: profile.store_id, product_id: line.product_id, type: "purchase_return", quantity: -line.quantity, note: `Phiếu trả hàng nhập ${voucher.id}`, created_by: profile.id });
    }
    if (movements.length) {
      const { error: moveError } = await supabase.from("inventory_movements").insert(movements);
      if (moveError) {
        console.error("[api:purchase-returns:POST:movements]", moveError);
        return NextResponse.json({ error: "Không thể ghi lịch sử tồn kho." }, { status: 400 });
      }
    }
  }
  return NextResponse.json({ voucher: { id: voucher.id, code: voucherCode, status, payable, paid, refund_type: refundType } }, { status: 201 });
}
