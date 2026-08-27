import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

type PriceListEntry = {
  id: string;
  name: string;
  price: number;
  start_date?: string | null;
  end_date?: string | null;
  active?: boolean;
  base_book_id?: string;
  adjustment_type?: "vnd" | "percent";
  adjustment_value?: number;
  pos_rule?: string;
  scope?: Record<string, string>;
};
type ProductRow = { id: string; price: number; price_lists: unknown };

function entries(value: unknown): PriceListEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const price = Number(row.price);
    if (typeof row.id !== "string" || typeof row.name !== "string" || !Number.isFinite(price)) return [];
    const entry: PriceListEntry = { id: row.id, name: row.name, price };
    if (typeof row.start_date === "string") entry.start_date = row.start_date;
    if (typeof row.end_date === "string") entry.end_date = row.end_date;
    if (typeof row.active === "boolean") entry.active = row.active;
    if (typeof row.base_book_id === "string") entry.base_book_id = row.base_book_id;
    if (row.adjustment_type === "vnd" || row.adjustment_type === "percent") entry.adjustment_type = row.adjustment_type;
    if (typeof row.adjustment_value === "number") entry.adjustment_value = row.adjustment_value;
    if (typeof row.pos_rule === "string") entry.pos_rule = row.pos_rule;
    if (row.scope && typeof row.scope === "object") entry.scope = row.scope as Record<string, string>;
    return [entry];
  });
}

async function productsForStore() {
  const auth = await requireProfile("manager");
  const result = await auth.supabase.from("products").select("id,price,price_lists").order("created_at");
  if (result.error) throw new Error("Không thể tải dữ liệu bảng giá.");
  return { ...auth, products: (result.data || []) as ProductRow[] };
}

async function applyUpdates(
  supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"],
  updates: Array<{ id: string; price?: number; price_lists?: PriceListEntry[] }>,
) {
  const errors = await Promise.all(updates.map(async ({ id, ...values }) => {
    const result = await supabase.from("products").update(values).eq("id", id);
    return result.error;
  }));
  if (errors.some(Boolean)) throw new Error("Không thể lưu đầy đủ bảng giá. Vui lòng thử lại.");
}

export async function POST(request: Request) {
  try {
    const { supabase, products } = await productsForStore();
    const body = await request.json() as Record<string, unknown>;
    if (body.action !== "create") return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Tên bảng giá là bắt buộc." }, { status: 400 });
    const baseBookId = String(body.base_book_id || "base");
    const adjustmentType = body.adjustment_type === "vnd" ? "vnd" : "percent";
    const adjustmentValue = Number(body.adjustment_value || 0);
    if (!Number.isFinite(adjustmentValue)) return NextResponse.json({ error: "Mức điều chỉnh không hợp lệ." }, { status: 400 });
    const duplicate = products.some((product) => entries(product.price_lists).some((entry) => entry.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi")));
    if (duplicate || name.toLocaleLowerCase("vi") === "bảng giá chung") return NextResponse.json({ error: "Tên bảng giá đã tồn tại." }, { status: 409 });

    const id = crypto.randomUUID();
    const prices: Record<string, number> = {};
    const meta: PriceListEntry = {
      id,
      name,
      price: 0,
      start_date: typeof body.start_date === "string" && body.start_date ? body.start_date : null,
      end_date: typeof body.end_date === "string" && body.end_date ? body.end_date : null,
      active: body.active === false ? false : true,
      base_book_id: baseBookId,
      adjustment_type: adjustmentType,
      adjustment_value: adjustmentValue,
      pos_rule: typeof body.pos_rule === "string" ? body.pos_rule : "allow",
      scope: {
        branch: String(body.branch_scope || "all"),
        customer: String(body.customer_scope || "all"),
        creator: String(body.creator_scope || "all"),
      },
    };
    const updates = products.map((product) => {
      const list = entries(product.price_lists);
      const base = baseBookId === "base" ? Number(product.price || 0) : (list.find((entry) => entry.id === baseBookId)?.price ?? Number(product.price || 0));
      const price = Math.max(0, Math.round(adjustmentType === "vnd" ? base + adjustmentValue : base * (1 + adjustmentValue / 100)));
      prices[product.id] = price;
      const newEntry = { ...meta, price };
      return { id: product.id, price_lists: [...list, newEntry] };
    });
    await applyUpdates(supabase, updates);
    return NextResponse.json({ book: { id, name, prices, start_date: meta.start_date, end_date: meta.end_date, active: meta.active } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể tạo bảng giá." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, products } = await productsForStore();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const bookId = String(body.book_id || "");
    if (!bookId) return NextResponse.json({ error: "Thiếu bảng giá cần cập nhật." }, { status: 400 });

    if (action === "save") {
      const prices = body.prices && typeof body.prices === "object" && !Array.isArray(body.prices) ? body.prices as Record<string, unknown> : {};
      const productIds = new Set(products.map((product) => product.id));
      const validPrices = Object.entries(prices).flatMap(([id, raw]) => {
        const price = Number(raw);
        return productIds.has(id) && Number.isFinite(price) && price >= 0 ? [[id, price] as const] : [];
      });
      if (!validPrices.length) return NextResponse.json({ error: "Không có mức giá hợp lệ để lưu." }, { status: 400 });

      if (bookId === "base") {
        await applyUpdates(supabase, validPrices.map(([id, price]) => ({ id, price })));
      } else {
        const bookEntry = products.flatMap((product) => entries(product.price_lists)).find((entry) => entry.id === bookId);
        if (!bookEntry) return NextResponse.json({ error: "Bảng giá không tồn tại." }, { status: 404 });
        const byId = new Map(products.map((product) => [product.id, product]));
        await applyUpdates(supabase, validPrices.map(([id, price]) => {
          const product = byId.get(id)!;
          const list = entries(product.price_lists);
          const found = list.some((entry) => entry.id === bookId);
          return { id, price_lists: found ? list.map((entry) => entry.id === bookId ? { ...entry, price } : entry) : [...list, { ...bookEntry, price }] };
        }));
      }
      return NextResponse.json({ saved: validPrices.length });
    }

    if (action === "rename") {
      const name = String(body.name || "").trim();
      if (bookId === "base") return NextResponse.json({ error: "Không thể đổi tên Bảng giá chung." }, { status: 400 });
      if (!name) return NextResponse.json({ error: "Tên bảng giá là bắt buộc." }, { status: 400 });
      const duplicate = products.some((product) => entries(product.price_lists).some((entry) => entry.id !== bookId && entry.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi")));
      if (duplicate) return NextResponse.json({ error: "Tên bảng giá đã tồn tại." }, { status: 409 });
      const updates = products.flatMap((product) => {
        const list = entries(product.price_lists);
        return list.some((entry) => entry.id === bookId) ? [{ id: product.id, price_lists: list.map((entry) => entry.id === bookId ? { ...entry, name } : entry) }] : [];
      });
      if (!updates.length) return NextResponse.json({ error: "Bảng giá không tồn tại." }, { status: 404 });
      await applyUpdates(supabase, updates);
      return NextResponse.json({ renamed: true });
    }

    return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể cập nhật bảng giá." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, products } = await productsForStore();
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id || id === "base") return NextResponse.json({ error: "Không thể xóa Bảng giá chung." }, { status: 400 });
    const updates = products.flatMap((product) => {
      const list = entries(product.price_lists);
      return list.some((entry) => entry.id === id) ? [{ id: product.id, price_lists: list.filter((entry) => entry.id !== id) }] : [];
    });
    if (!updates.length) return NextResponse.json({ error: "Bảng giá không tồn tại." }, { status: 404 });
    await applyUpdates(supabase, updates);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể xóa bảng giá." }, { status: 400 });
  }
}
