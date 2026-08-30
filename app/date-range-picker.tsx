"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

export type DateValue = { preset: string; from?: string; to?: string };

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const display = (value?: string) => value ? value.split("-").reverse().join("/") : "--/--/----";
const addDays = (date: Date, amount: number) => { const copy = new Date(date); copy.setDate(copy.getDate() + amount); return copy; };
const startOfWeek = (date: Date) => { const copy = new Date(date); copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7)); return copy; };

const presets: Array<[string, Array<{ id: string; label: string; from?: () => string; to?: () => string; disabled?: boolean }>]> = [
  ["Theo ngày", [
    { id: "today", label: "Hôm nay", from: () => iso(new Date()), to: () => iso(new Date()) },
    { id: "yesterday", label: "Hôm qua", from: () => iso(addDays(new Date(), -1)), to: () => iso(addDays(new Date(), -1)) },
  ]],
  ["Theo tuần", [
    { id: "this_week", label: "Tuần này", from: () => iso(startOfWeek(new Date())), to: () => iso(addDays(startOfWeek(new Date()), 6)) },
    { id: "last_week", label: "Tuần trước", from: () => iso(addDays(startOfWeek(new Date()), -7)), to: () => iso(addDays(startOfWeek(new Date()), -1)) },
    { id: "last_7_days", label: "7 ngày qua", from: () => iso(addDays(new Date(), -6)), to: () => iso(new Date()) },
  ]],
  ["Theo tháng", [
    { id: "this_month", label: "Tháng này", from: () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`, to: () => iso(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)) },
    { id: "last_month", label: "Tháng trước", from: () => `${new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getFullYear()}-${String(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getMonth() + 1).padStart(2, "0")}-01`, to: () => iso(new Date(new Date().getFullYear(), new Date().getMonth(), 0)) },
    { id: "last_30_days", label: "30 ngày qua", from: () => iso(addDays(new Date(), -29)), to: () => iso(new Date()) },
  ]],
  ["Theo quý", [
    { id: "this_quarter", label: "Quý này", from: () => { const q = Math.floor(new Date().getMonth() / 3); return `${new Date().getFullYear()}-${String(q * 3 + 1).padStart(2, "0")}-01`; }, to: () => { const q = Math.floor(new Date().getMonth() / 3); return iso(new Date(new Date().getFullYear(), q * 3 + 3, 0)); } },
    { id: "last_quarter", label: "Quý trước", from: () => { const q = Math.floor(new Date().getMonth() / 3) - 1; const y = new Date().getFullYear() + (q < 0 ? -1 : 0); return `${y}-${String(((q + 4) % 4) * 3 + 1).padStart(2, "0")}-01`; }, to: () => { const q = Math.floor(new Date().getMonth() / 3) - 1; const y = new Date().getFullYear() + (q < 0 ? -1 : 0); const m = ((q + 4) % 4) * 3 + 2; return iso(new Date(y, m, 0)); } },
  ]],
  ["Theo năm", [
    { id: "this_year", label: "Năm nay", from: () => `${new Date().getFullYear()}-01-01`, to: () => `${new Date().getFullYear()}-12-31` },
    { id: "last_year", label: "Năm trước", from: () => `${new Date().getFullYear() - 1}-01-01`, to: () => `${new Date().getFullYear() - 1}-12-31` },
  ]],
];

function CalendarMonth({ month, from, to, onPick, onMove }: { month: Date; from?: string; to?: string; onPick: (date: string) => void; onMove: (amount: number) => void }) {
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const firstOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const first = new Date(year, monthIndex, 1 - firstOffset);
  const days = Array.from({ length: 42 }, (_, index) => addDays(first, index));
  return <section className="calendar-month"><header><button type="button" aria-label="Tháng trước" onClick={() => onMove(-1)}><ChevronLeft size={18} /></button><strong>Tháng {monthIndex + 1} {year}</strong><button type="button" aria-label="Tháng sau" onClick={() => onMove(1)}><ChevronRight size={18} /></button></header><div className="calendar-grid calendar-week">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((date) => { const value = iso(date); const selected = value === from || value === to; const between = Boolean(from && to && value > from && value < to); return <button type="button" key={value} className={`${date.getMonth() !== monthIndex ? "muted" : ""} ${selected ? "selected" : ""} ${between ? "between" : ""}`} onClick={() => onPick(value)}>{date.getDate()}</button>; })}</div></section>;
}

export default function DateRangePicker({ value, onChange, compact = false }: { value: DateValue; onChange: (value: DateValue) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"preset" | "range">("preset");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [draft, setDraft] = useState<DateValue>(value);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchor?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [open, anchor]);

  const label = value.preset === "all" ? "Toàn thời gian" : presets.flatMap((g) => g[1]).find((p) => p.id === value.preset)?.label || "Tùy chỉnh";
  const applyPreset = (id: string) => {
    if (id === "all") { onChange({ preset: "all" }); setOpen(false); return; }
    const preset = presets.flatMap((g) => g[1]).find((p) => p.id === id);
    if (!preset || preset.disabled || !preset.from || !preset.to) return;
    onChange({ preset: id, from: preset.from(), to: preset.to() });
    setOpen(false);
  };
  const pickDate = (date: string) => setDraft((current) => !current.from || current.to ? { preset: "custom", from: date } : date < current.from ? { preset: "custom", from: date, to: current.from } : { ...current, to: date });

  const rect = anchor?.getBoundingClientRect();
  const portalContent = open && anchor && rect && typeof document !== "undefined" ? (() => {
    const isMobile = window.innerWidth <= 768;
    const width = tab === "range" ? Math.min(900, window.innerWidth - 32) : Math.min(760, window.innerWidth - 32);
    const left = isMobile ? (window.innerWidth - width) / 2 : Math.min(Math.max(16, rect.right + 12), window.innerWidth - width - 16);
    const top = isMobile ? 16 : Math.min(Math.max(16, rect.top - 8), window.innerHeight - (tab === "range" ? 560 : 420) - 16);
    return createPortal(
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-label="Chọn thời gian" className={`filter-popover date-range ${compact ? "compact" : ""}`} style={{ left, top, width }}>
        <div className="date-filter-tabs"><button type="button" className={tab === "preset" ? "active" : ""} onClick={() => setTab("preset")}>Chọn nhanh</button><button type="button" className={tab === "range" ? "active" : ""} onClick={() => setTab("range")}>Tùy chỉnh</button></div>
        {tab === "preset" ? (
          <div className="preset-panel">{presets.map(([title, items]) => <section key={title}><h4>{title}</h4><div>{items.map((item) => <button type="button" key={item.id} disabled={item.disabled} className={value.preset === item.id ? "selected" : ""} onClick={() => applyPreset(item.id)}>{item.label}</button>)}</div></section>)}<button type="button" className={`all ${value.preset === "all" ? "selected" : ""}`} onClick={() => applyPreset("all")}>Toàn thời gian</button></div>
        ) : (
          <>
            <div className="date-range-header">Từ ngày: <b>{display(draft.from)}</b> – Đến ngày: <b>{display(draft.to)}</b></div>
            <div className="dual-calendar"><CalendarMonth month={month} from={draft.from} to={draft.to} onPick={pickDate} onMove={(amount) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1))} /><CalendarMonth month={new Date(month.getFullYear(), month.getMonth() + 1, 1)} from={draft.from} to={draft.to} onPick={pickDate} onMove={(amount) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount + 1, 1))} /></div>
            <footer><button type="button" className="today" onClick={() => setDraft({ preset: "custom", from: iso(new Date()), to: iso(new Date()) })}>Hôm nay</button><button type="button" onClick={() => setOpen(false)}>Bỏ qua</button><button type="button" className="primary" disabled={!draft.from || !draft.to} onClick={() => { onChange(draft); setOpen(false); }}>Áp dụng</button></footer>
          </>
        )}
      </div>,
      document.body
    );
  })() : null;

  return <div className="date-filter date-range-picker">
    <button type="button" ref={(el) => { if (el && open && !anchor) setAnchor(el); }} className={`filter-select-button ${value.preset !== "custom" && value.preset !== "all" ? "has-value" : ""}`} aria-expanded={open} onClick={(e) => { setDraft(value); setTab("preset"); setAnchor(e.currentTarget); setOpen((v) => !v); }}>
      <span className={value.preset === "all" ? "" : "has-value"}>{value.preset === "all" ? "Toàn thời gian" : value.preset === "custom" ? `Tùy chỉnh: ${display(value.from)} – ${display(value.to)}` : label}</span>
      <CalendarDays size={18} />
    </button>
    {portalContent}
  </div>;
}