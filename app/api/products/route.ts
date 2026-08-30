import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { readJsonBody, rowImportError, isUniqueViolation } from "@/lib/api-utils";

function catalogFields(row: Record<string, unknown>) {
  const jsonArray = (value: unknown) => Array.isArray(value) ? value : [];
  const jsonObject = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    barcode: String(row.barcode || "").trim() || null,
    brand_id: row.brand_id || null,
    base_unit: String(row.base_unit || "Cái").trim() || "Cái",
    sold_by: row.sold_by === "weight" ? "weight" : "quantity",
    weight: row.weight === "" || row.weight == null ? null : Number(row.weight),
    warranty_months: Math.max(0, Math.trunc(Number(row.warranty_months || 0))),
    tax_percent: Math.max(0, Number(row.tax_percent || 0)),
    attributes: jsonObject(row.attributes),
    units: jsonArray(row.units),
    price_lists: jsonArray(row.price_lists),
    images: jsonArray(row.images),
    track_inventory: row.track_inventory !== false,
    min_stock: row.min_stock == null || row.min_stock === "" ? null : Math.max(0, Number(row.min_stock)),
    max_stock: row.max_stock == null || row.max_stock === "" ? null : Math.max(0, Number(row.max_stock)),
    location: String(row.location || "").trim() || null,
    note: String(row.note || "").trim() || null,
  };
}

function withoutCatalogFields(payload: Record<string, unknown>) {
  const legacy = { ...payload };
  for (const key of ["barcode", "brand_id", "base_unit", "sold_by", "weight", "warranty_months", "tax_percent", "attributes", "units", "price_lists", "images", "track_inventory", "min_stock", "max_stock", "location", "note"]) delete legacy[key];
  return legacy;
}

async function saveRelatedCatalogData(supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"], profile: Awaited<ReturnType<typeof requireProfile>>["profile"], productId: string, row: Record<string, unknown>, stock: number) {
  const branchId = row.branch_id ? String(row.branch_id) : null;
  const components = Array.isArray(row.components) ? row.components : [];
  if (branchId) {
    await supabase.from("product_branch_inventory").upsert({
      product_id: productId,
      branch_id: branchId,
      quantity: stock,
      min_stock: row.min_stock == null || row.min_stock === "" ? null : Number(row.min_stock),
      max_stock: row.max_stock == null || row.max_stock === "" ? null : Number(row.max_stock),
      location: String(row.location || "").trim() || null,
      updated_at: new Date().toISOString(),
    });
  }
  if (components.length) {
    await supabase.from("product_components").delete().eq("product_id", productId);
    await supabase.from("product_components").insert(components.map((item) => {
      const component = item as Record<string, unknown>;
      return { product_id: productId, component_id: component.product_id, quantity: Number(component.quantity || 1) };
    }));
  }
  if (stock > 0) {
    const { data: movement } = await supabase.from("inventory_movements").select("id").eq("product_id", productId).eq("type", "initial").limit(1).maybeSingle();
    if (!movement) await supabase.from("inventory_movements").insert({ store_id: profile.store_id, product_id: productId, type: "initial", quantity: Math.trunc(stock), note: "Tồn đầu khi tạo/import hàng hóa", created_by: profile.id });
  }
}

export async function GET() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Không thể tải sản phẩm." }, { status: 400 });
  return NextResponse.json({ products: data });
}

export async function POST(request: Request) {
  const { supabase, profile } = await requireProfile("manager");
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu sản phẩm không hợp lệ." }, { status: 400 });

  // Support both single and bulk (import) payloads
  if (Array.isArray(body.items)) {
    const items = body.items as Array<Record<string, unknown>>;
    if (!items.length) return NextResponse.json({ error: "Không có dữ liệu import." }, { status: 400 });
    const mode = body.mode === "update" ? "update" : "skip";
    const updateStock = body.update_stock === true;
    const stopOnConflict = body.stop_on_conflict === true;
    let inserted = 0, updated = 0, skipped = 0;
    const errors: Array<{ row: number; error: string }> = [];
    const products: unknown[] = [];
    const { data: importJob } = await supabase.from("product_import_jobs").insert({ store_id: profile.store_id, file_name: String(body.file_name || "import-hang-hoa.csv"), status: "processing", created_by: profile.id }).select("id").maybeSingle();
    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const name = String(row.name || "").trim();
      const sku = String(row.sku || "").trim().toUpperCase() || `HH-${Date.now().toString().slice(-6)}-${i}`;
      const price = Number(row.price ?? 0);
      const cost = Number(row.cost ?? 0);
      const stock = Number(row.stock ?? row.stock_quantity ?? 0);
      if (!name) { errors.push({ row: i + 2, error: "Thiếu tên hàng" }); skipped++; continue; }
      if (!Number.isFinite(price) || price < 0 || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(stock) || stock < 0) { errors.push({ row: i + 2, error: "Giá/tồn không hợp lệ" }); skipped++; continue; }
      const payload: Record<string, unknown> = {
        store_id: profile.store_id, name, sku, price, cost, stock_quantity: Math.trunc(stock),
        category_id: row.category_id || null, supplier_id: row.supplier_id || null,
        product_type: ["product","service","combo"].includes(String(row.product_type)) ? row.product_type : "product",
        direct_sale: row.direct_sale !== false, linked_sale_channel: Boolean(row.linked_sale_channel),
        description: row.description || null, created_by: profile.id,
        ...catalogFields(row),
      };
      // KiotViet-compatible duplicate handling: match either SKU or barcode.
      const barcode = String(row.barcode || "").trim();
      const duplicateFilter = barcode ? `sku.eq.${sku},barcode.eq.${barcode}` : `sku.eq.${sku}`;
      const { data: existing } = await supabase.from("products").select("id,sku,barcode,name").eq("store_id", profile.store_id).or(duplicateFilter).limit(1).maybeSingle();
      if (existing) {
        const nameConflict = existing.name !== name && existing.sku === sku;
        const barcodeConflict = Boolean(barcode && existing.barcode === barcode && existing.sku !== sku);
        if (stopOnConflict && (nameConflict || barcodeConflict)) {
          errors.push({ row: i + 2, error: nameConflict ? "Trùng mã hàng/mã vạch nhưng khác tên hàng" : "Trùng mã vạch nhưng khác mã hàng" });
          skipped += items.length - i;
          break;
        }
        if (mode === "skip") { skipped++; continue; }
        if (!updateStock) delete payload.stock_quantity;
        let { data, error } = await supabase.from("products").update(payload).eq("id", existing.id).select().single();
        if (error && (error as { code?: string }).code === "42703") {
          const { description: _d, ...fallbackBase } = withoutCatalogFields(payload);
          const fallback = fallbackBase;
          const retry = await supabase.from("products").update(fallback).eq("id", existing.id).select().single();
          data = retry.data; error = retry.error;
        }
        if (error) errors.push({ row: i + 2, error: rowImportError(error) });
        else { updated++; if (data) { products.push(data); await saveRelatedCatalogData(supabase, profile, data.id, row, stock); } }
      } else {
        let { data, error } = await supabase.from("products").insert(payload).select().single();
        if (error && (error as { code?: string }).code === "42703") {
          const { description: _d, ...fallbackBase } = withoutCatalogFields(payload);
          const fallback = fallbackBase;
          const retry = await supabase.from("products").insert(fallback).select().single();
          data = retry.data; error = retry.error;
        }
        if (error) {
          if (isUniqueViolation(error)) { errors.push({ row: i + 2, error: "Mã hàng đã tồn tại" }); skipped++; }
          else { console.error("[api:products:POST:import]", error); errors.push({ row: i + 2, error: rowImportError(error) }); }
        } else { inserted++; if (data) { products.push(data); await saveRelatedCatalogData(supabase, profile, data.id, row, stock); } }
      }
    }
    if (importJob?.id) await supabase.from("product_import_jobs").update({ status: errors.length && !inserted && !updated ? "failed" : "completed", inserted, updated, skipped, errors, completed_at: new Date().toISOString() }).eq("id", importJob.id);
    return NextResponse.json({ inserted, updated, skipped, errors, products }, { status: 200 });
  }

  const name = String(body.name || "").trim();
  const sku = String(body.sku || "").trim().toUpperCase();
  const price = Number(body.price);
  const cost = Number(body.cost ?? 0);
  const stock = Number(body.stock ?? body.stock_quantity ?? 0);
  const category_id = body.category_id ? String(body.category_id) : null;
  const supplier_id = body.supplier_id ? String(body.supplier_id) : null;
  const product_type = ["product","service","combo"].includes(String(body.product_type)) ? body.product_type : "product";
  if (!name || !sku || !Number.isFinite(price) || price < 0 || !Number.isFinite(cost) || cost < 0 || stock < 0) return NextResponse.json({ error: "Dữ liệu sản phẩm không hợp lệ." }, { status: 400 });
  const basePayload: Record<string, unknown> = {
    store_id: profile.store_id, name, sku, price, cost, stock_quantity: Math.trunc(stock),
    category_id, supplier_id, product_type,
    direct_sale: body.direct_sale !== false, linked_sale_channel: Boolean(body.linked_sale_channel),
    description: body.description || body.note || null,
    created_by: profile.id,
    ...catalogFields(body),
  };
  let { data, error } = await supabase.from("products").insert(basePayload).select().single();
  // Fallback nếu DB chưa chạy migration 003 (thiếu cột description)
  if (error && (error as { code?: string }).code === "42703") {
    const { description: _d, ...fallbackPayload } = withoutCatalogFields(basePayload);
    const retry = await supabase.from("products").insert(fallbackPayload).select().single();
    data = retry.data as typeof data; error = retry.error as typeof error;
  }
  if (error) {
    console.error("[api:products:POST]", error);
    return NextResponse.json({ error: isUniqueViolation(error) ? "Mã hàng đã tồn tại." : "Không thể thêm sản phẩm. Vui lòng kiểm tra lại dữ liệu." }, { status: 400 });
  }
  await saveRelatedCatalogData(supabase, profile, data.id, body, stock);
  return NextResponse.json({ product: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase } = await requireProfile("manager");
  const body = await readJsonBody(request);
  if (!body) return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  if (!ids.length || typeof body.active !== "boolean") return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  const { error } = await supabase.from("products").update({ active: body.active }).in("id", ids);
  if (error) { console.error("[api:products:PATCH]", error); return NextResponse.json({ error: "Không thể cập nhật hàng hóa." }, { status: 400 }); }
  return NextResponse.json({ updated: ids.length });
}
