"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import FilterPopover from "./filter-popover";

type DateValue = { preset: string; from?: string; to?: string };
type Props = { mode: "future" | "past"; value: DateValue; onChange: (value: DateValue) => void };
type Preset = { id: string; label: string; days?: number; disabled?: boolean };

const futureGroups: Array<[string, Preset[]]> = [
  ["Theo ngày", [{ id: "tomorrow", label: "Ngày mai", days: 1 }, { id: "day_after", label: "Ngày kia", days: 2 }, { id: "next_3_days", label: "3 ngày tới", days: 3 }, { id: "next_5_days", label: "5 ngày tới", days: 5 }, { id: "next_7_days", label: "7 ngày tới", days: 7 }]],
  ["Theo tuần", [{ id: "this_week", label: "Tuần này" }, { id: "next_week", label: "Tuần tới" }, { id: "next_2_weeks", label: "2 tuần tới", days: 14 }]],
  ["Theo tháng", [{ id: "this_month", label: "Tháng này" }, { id: "next_month", label: "Tháng tới" }, { id: "next_30_days", label: "30 ngày tới", days: 30 }, { id: "next_2_months", label: "2 tháng tới", days: 60 }, { id: "next_3_months", label: "3 tháng tới", days: 90 }]],
];
const pastGroups: Array<[string, Preset[]]> = [
  ["Theo ngày", [{ id: "today", label: "Hôm nay", days: 0 }, { id: "yesterday", label: "Hôm qua", days: 1 }]],
  ["Theo tuần", [{ id: "this_week", label: "Tuần này" }, { id: "last_week", label: "Tuần trước" }, { id: "last_7_days", label: "7 ngày qua", days: 7 }]],
  ["Theo tháng", [{ id: "this_month", label: "Tháng này" }, { id: "last_month", label: "Tháng trước" }, { id: "lunar_this_month", label: "Tháng này (âm lịch)", disabled: true }, { id: "lunar_last_month", label: "Tháng trước (âm lịch)", disabled: true }, { id: "last_30_days", label: "30 ngày qua", days: 30 }]],
  ["Theo quý", [{ id: "this_quarter", label: "Quý này" }, { id: "last_quarter", label: "Quý trước" }]],
  ["Theo năm", [{ id: "this_year", label: "Năm nay" }, { id: "last_year", label: "Năm trước" }, { id: "lunar_this_year", label: "Năm nay (âm lịch)", disabled: true }, { id: "lunar_last_year", label: "Năm trước (âm lịch)", disabled: true }]],
];

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const display = (value?: string) => value ? value.split("-").reverse().join("/") : "--/--/----";
const addDays = (date: Date, amount: number) => { const copy = new Date(date); copy.setDate(copy.getDate() + amount); return copy; };
const startOfWeek = (date: Date) => { const copy = new Date(date); const day = (copy.getDay() + 6) % 7; copy.setDate(copy.getDate() - day); return copy; };
const endOfWeek = (date: Date) => addDays(startOfWeek(date), 6);

function presetRange(mode: "future" | "past", id: string): DateValue {
  const now = new Date();
  if (id === "all") return { preset: "all" };
  const direction = mode === "future" ? 1 : -1;
  const groups = mode === "future" ? futureGroups : pastGroups;
  const preset = groups.flatMap((group) => group[1]).find((item) => item.id === id);
  if (preset?.days !== undefined) {
    if (id === "today") return { preset: id, from: iso(now), to: iso(now) };
    const target = addDays(now, preset.days * direction);
    return { preset: id, from: iso(mode === "future" ? now : target), to: iso(mode === "future" ? target : now) };
  }
  if (id.includes("week")) {
    const offset = id.includes("next_2") ? 7 : id.includes("next") ? 7 : id.includes("last") ? -7 : 0;
    const start = addDays(startOfWeek(now), offset);
    return { preset: id, from: iso(start), to: iso(endOfWeek(start)) };
  }
  if (id.includes("month")) {
    const offset = id.includes("next") ? 1 : id.includes("last") ? -1 : 0;
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return { preset: id, from: iso(start), to: iso(end) };
  }
  if (id.includes("quarter")) {
    const quarter = Math.floor(now.getMonth() / 3) + (id.includes("last") ? -1 : 0);
    const start = new Date(now.getFullYear(), quarter * 3, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    return { preset: id, from: iso(start), to: iso(end) };
  }
  if (id.includes("year")) {
    const year = now.getFullYear() + (id.includes("last") ? -1 : 0);
    return { preset: id, from: `${year}-01-01`, to: `${year}-12-31` };
  }
  return { preset: id };
}

function CalendarMonth({ month, from, to, onPick, onMove }: { month: Date; from?: string; to?: string; onPick: (date: string) => void; onMove: (amount: number) => void }) {
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const firstOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const first = new Date(year, monthIndex, 1 - firstOffset);
  const days = Array.from({ length: 42 }, (_, index) => addDays(first, index));
  return <section className="calendar-month"><header><button type="button" aria-label="Tháng trước" onClick={() => onMove(-1)}><ChevronLeft size={19} /></button><strong>Tháng {monthIndex + 1} {year}</strong><button type="button" aria-label="Tháng sau" onClick={() => onMove(1)}><ChevronRight size={19} /></button></header><div className="calendar-grid calendar-week">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map((date) => { const value = iso(date); const selected = value === from || value === to; const between = Boolean(from && to && value > from && value < to); return <button type="button" key={value} className={`${date.getMonth() !== monthIndex ? "muted" : ""} ${selected ? "selected" : ""} ${between ? "between" : ""}`} onClick={() => onPick(value)}>{date.getDate()}</button>; })}</div></section>;
}

export default function DateFilter({ mode, value, onChange }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [panel, setPanel] = useState<"preset" | "range" | null>(null);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [draft, setDraft] = useState<DateValue>(value);
  const groups = mode === "future" ? futureGroups : pastGroups;
  const label = value.preset === "all" ? "Toàn thời gian" : groups.flatMap((group) => group[1]).find((item) => item.id === value.preset)?.label || "Tùy chỉnh";
  const open = (next: "preset" | "range", element: HTMLElement) => { setDraft(value); setAnchor(element); setPanel(next); };
  const pickDate = (date: string) => setDraft((current) => !current.from || current.to ? { preset: "custom", from: date } : date < current.from ? { preset: "custom", from: date, to: current.from } : { ...current, to: date });
  return <div className="date-filter">
    <button type="button" className={`radio-row ${panel === "preset" ? "active" : ""}`} aria-expanded={panel === "preset"} onClick={(event) => open("preset", event.currentTarget)}><i className={value.preset !== "custom" ? "checked" : ""} /><span>{value.preset === "custom" ? "Toàn thời gian" : label}</span><ChevronRight size={20} /></button>
    <button type="button" className={`radio-row ${panel === "range" ? "active" : ""}`} aria-expanded={panel === "range"} onClick={(event) => open("range", event.currentTarget)}><i className={value.preset === "custom" ? "checked" : ""} /><span>Tùy chỉnh{value.preset === "custom" && value.from ? `: ${display(value.from)} – ${display(value.to)}` : ""}</span><CalendarDays size={20} /></button>
    <FilterPopover open={panel === "preset"} anchor={anchor} onClose={() => setPanel(null)} ariaLabel="Chọn khoảng thời gian"><div className="preset-panel">{groups.map(([title, items]) => <section key={title}><h4>{title}</h4><div>{items.map((item) => <button type="button" key={item.id} disabled={item.disabled} title={item.disabled ? "Đang phát triển" : undefined} className={value.preset === item.id ? "selected" : ""} onClick={() => { onChange(presetRange(mode, item.id)); setPanel(null); }}>{item.label}</button>)}</div></section>)}<button type="button" className={value.preset === "all" ? "all selected" : "all"} onClick={() => { onChange({ preset: "all" }); setPanel(null); }}>Toàn thời gian</button></div></FilterPopover>
    <FilterPopover open={panel === "range"} anchor={anchor} onClose={() => setPanel(null)} ariaLabel="Chọn ngày tùy chỉnh" className="date-range"><div className="date-range-header">Từ ngày: <b>{display(draft.from)}</b> - Đến ngày: <b>{display(draft.to)}</b></div><div className="dual-calendar"><CalendarMonth month={month} from={draft.from} to={draft.to} onPick={pickDate} onMove={(amount) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1))} /><CalendarMonth month={new Date(month.getFullYear(), month.getMonth() + 1, 1)} from={draft.from} to={draft.to} onPick={pickDate} onMove={(amount) => setMonth(new Date(month.getFullYear(), month.getMonth() + amount + 1, 1))} /></div><footer><button type="button" className="today" onClick={() => setDraft({ preset: "custom", from: iso(new Date()), to: iso(new Date()) })}>Hôm nay</button><button type="button" onClick={() => setPanel(null)}>Bỏ qua</button><button type="button" className="primary" disabled={!draft.from || !draft.to} onClick={() => { onChange(draft); setPanel(null); }}>Áp dụng</button></footer></FilterPopover>
  </div>;
}

