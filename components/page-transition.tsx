"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

export const EFFECTS: Array<[string, string]> = [
  ["fade-up", "Trượt lên ⬆"],
  ["fade", "Mờ dần ✨"],
  ["slide-left", "Từ phải ➡"],
  ["slide-right", "Từ trái ⬅"],
  ["slide-up", "Từ dưới ⤴"],
  ["zoom", "Phóng nhẹ 🔍"],
  ["rotate", "Xoay nhẹ 🔄"],
  ["flip-x", "Lật ngang 🃏"],
  ["flip-y", "Lật dọc 🎴"],
  ["blur", "Mờ kính 🌫"],
  ["bounce", "Nảy ♨"],
  ["none", "Tắt hiệu ứng ⛔"],
];
const STORAGE_KEY = "page-transition-effect";
const DEFAULT_EFFECT = "fade-up";

export default function PageTransition({ children }: { children: ReactNode }) {
  const [effect, setEffect] = useState(DEFAULT_EFFECT);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [animating, setAnimating] = useState(true);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && EFFECTS.some(([id]) => id === saved)) setEffect(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const applyEffect = (id: string) => {
    setEffect(id);
    localStorage.setItem(STORAGE_KEY, id);
    setAnimKey((k) => k + 1);
    setAnimating(true);
    setOpen(false);
  };

  const label = EFFECTS.find(([id]) => id === effect)?.[1] || effect;
  const wrapperClass = ready && animating && effect !== "none" ? `pt-anim pt-${effect}` : undefined;

  return <>
    <div key={`${effect}-${animKey}`} className={wrapperClass} onAnimationEnd={() => setAnimating(false)}>{children}</div>
    <div className="pt-switcher no-print" ref={popRef}>
      <button type="button" className="pt-pill" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        <span aria-hidden>✨</span> Hiệu ứng: <b>{label}</b> <span aria-hidden>▾</span>
      </button>
      {open && <div className="pt-pop" role="menu" aria-label="Chọn hiệu ứng chuyển trang">
        <div className="pt-pop-title">Kiểu chuyển trang</div>
        <div className="pt-grid">
          {EFFECTS.map(([id, name]) => (
            <button type="button" key={id} role="menuitemradio" aria-checked={id === effect} className={`pt-chip ${id === effect ? "active" : ""}`} onClick={() => applyEffect(id)}>
              {name}
            </button>
          ))}
        </div>
        <p className="pt-hint">Xem thử ngay — bấm menu bất kỳ để chuyển trang. Lựa chọn được ghi nhớ.</p>
      </div>}
    </div>
  </>;
}
