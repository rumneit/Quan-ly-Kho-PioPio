export const VN_TZ = "Asia/Ho_Chi_Minh";

export function toVnDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function toVnDateTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: VN_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function getTodayVnKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDaysVnKey(baseKey: string, offset: number): string {
  const [y, m, d] = baseKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const shifted = new Date(utc + offset * 86400000);
  const y2 = shifted.getUTCFullYear();
  const m2 = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d2 = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
}
