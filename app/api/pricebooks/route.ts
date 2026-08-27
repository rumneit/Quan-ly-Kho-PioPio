import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

type PriceListEntry = { id: string; name: string; price: number };
type ProductRow = { id: string; price: number; price_lists: unknown };

function entries(value: unknown): PriceListEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const price = Number(row.price);
    if (typeof row.id !== "string" || typeof row.name !== "string" || !Number.isFinite(price)) return [];
    return [{ id: row.id, name: row.name, price }];
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
    const name = String(body.name || "").trim();
    const adjustment = Number(body.adjustment || 0);
    if (body.action !== "create" || !name) return NextResponse.json({ error: "Tên bảng giá là bắt buộc." }, { status: 400 });
    if (!Number.isFinite(adjustment)) return NextResponse.json({ error: "Mức điều chỉnh không hợp lệ." }, { status: 400 });
    const duplicate = products.some((product) => entries(product.price_lists).some((entry) => entry.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi")));
    if (duplicate || name.toLocaleLowerCase("vi") === "bảng giá chung") return NextResponse.json({ error: "Tên bảng giá đã tồn tại." }, { status: 409 });

    const id = crypto.randomUUID();
    const prices: Record<string, number> = {};
    const updates = products.map((product) => {
      const price = Math.max(0, Math.round(Number(product.price || 0) * (1 + adjustment / 100)));
      prices[product.id] = price;
      return { id: product.id, price_lists: [...entries(product.price_lists), { id, name, price }] };
    });
    await applyUpdates(supabase, updates);
    return NextResponse.json({ book: { id, name, prices } }, { status: 201 });
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
        const bookName = products.flatMap((product) => entries(product.price_lists)).find((entry) => entry.id === bookId)?.name;
        if (!bookName) return NextResponse.json({ error: "Bảng giá không tồn tại." }, { status: 404 });
        const byId = new Map(products.map((product) => [product.id, product]));
        await applyUpdates(supabase, validPrices.map(([id, price]) => {
          const product = byId.get(id)!;
          const list = entries(product.price_lists);
          const found = list.some((entry) => entry.id === bookId);
          return { id, price_lists: found ? list.map((entry) => entry.id === bookId ? { ...entry, price } : entry) : [...list, { id: bookId, name: bookName, price }] };
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
