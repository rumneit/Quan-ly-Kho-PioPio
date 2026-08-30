export type PostgresLikeError = { code?: string; message?: string } | null | undefined;

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function isRaisedException(error: PostgresLikeError): error is { code: string; message: string } {
  return Boolean(error && error.code === "P0001" && error.message);
}

export function isUniqueViolation(error: PostgresLikeError): boolean {
  return Boolean(error && error.code === "23505");
}

export function rowImportError(error: PostgresLikeError): string {
  if (isUniqueViolation(error)) return "Mã hàng đã tồn tại";
  if (error?.code === "23503") return "Dữ liệu liên kết (nhóm hàng/nhà cung cấp) không hợp lệ";
  if (error?.code === "42703") return "Cấu trúc dữ liệu chưa hỗ trợ cột này (cần migration)";
  return "Không thể lưu dòng này";
}
