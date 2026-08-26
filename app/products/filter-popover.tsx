"use client";

import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel: string;
};

export default function FilterPopover({ anchor, open, onClose, children, className = "", ariaLabel }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const rect = anchor?.getBoundingClientRect();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !anchor?.contains(target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    const timer = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); window.clearTimeout(timer); };
  }, [anchor, onClose, open]);

  if (!open || !anchor || !rect || typeof document === "undefined") return null;
  const width = className.includes("date-range") ? Math.min(900, window.innerWidth - 32) : className.includes("date-preset") ? Math.min(className.includes("future") ? 570 : 760, window.innerWidth - 32) : className.includes("category") ? Math.min(600, window.innerWidth - 32) : Math.min(370, window.innerWidth - 32);
  const leftPreferred = rect.right + 12;
  const left = Math.min(Math.max(16, leftPreferred), window.innerWidth - width - 16);
  const top = className.includes("date-range") ? 16 : Math.min(Math.max(16, rect.top), window.innerHeight - 360);
  return createPortal(<div ref={panelRef} tabIndex={-1} role="dialog" aria-label={ariaLabel} className={`filter-popover ${className}`} style={{ left, top, width }}>{children}</div>, document.body);
}
