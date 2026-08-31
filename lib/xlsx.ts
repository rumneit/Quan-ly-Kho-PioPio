// Lazy-load SheetJS (~450KB) chỉ khi user bấm Import/Export — không nằm trong bundle tải lần đầu.
type XLSXModule = typeof import("xlsx");
let cached: XLSXModule | null = null;

export async function getXLSX(): Promise<XLSXModule> {
  if (!cached) cached = await import("xlsx");
  return cached;
}
