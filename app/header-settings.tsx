"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Settings as SettingsIcon, X, ChevronRight, Store, Users, Shield, Coins, Plug, Printer, Package, Lock, History, Smartphone, FolderKanban, Trash2, ScanBarcode } from "lucide-react";
import type { Profile } from "@/lib/auth";
import { getStoreInfo, getStoreBranches, getStoreUsers } from "@/app/settings/actions";

const NAV: Array<{ id: string; label: string; icon: React.ReactNode; items: Array<{ id: string; label: string; icon: React.ReactNode }> }> = [
  {
    id: "manage", label: "Quản lý", icon: <Store size={15} />,
    items: [
      { id: "store", label: "Cửa hàng & Hàng hóa", icon: <Store size={14} /> },
      { id: "users", label: "Người dùng & Phân quyền", icon: <Users size={14} /> },
      { id: "security", label: "Bảo mật", icon: <Shield size={14} /> },
      { id: "currency", label: "Tiền tệ", icon: <Coins size={14} /> },
      { id: "api", label: "Kết nối API", icon: <Plug size={14} /> },
      { id: "print", label: "Mẫu in", icon: <Printer size={14} /> },
    ],
  },
  {
    id: "product", label: "Hàng hóa", icon: <Package size={15} />,
    items: [
      { id: "product-info", label: "Thông tin hàng hóa", icon: <ScanBarcode size={14} /> },
      { id: "categories", label: "Nhóm hàng", icon: <FolderKanban size={14} /> },
    ],
  },
  {
    id: "data", label: "Dữ liệu", icon: <History size={15} />,
    items: [
      { id: "book-closing", label: "Khóa sổ", icon: <Lock size={14} /> },
      { id: "audit-log", label: "Lịch sử thao tác", icon: <History size={14} /> },
      { id: "devices", label: "Thiết bị", icon: <Smartphone size={14} /> },
      { id: "data", label: "Xóa dữ liệu", icon: <Trash2 size={14} /> },
    ],
  },
];

export default function HeaderSettings({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState("store");
  const [stats, setStats] = useState({ branch: 0, user: 0 });

  useEffect(() => {
    if (!open) return;
    Promise.all([getStoreInfo(), getStoreBranches(), getStoreUsers()]).then(([store, branches, users]) => setStats({ branch: branches.length, user: users.length }));
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  const activeLabel = useMemo(() => {
    for (const group of NAV) { const item = group.items.find((i) => i.id === section); if (item) return item.label; }
    return "Cài đặt";
  }, [section]);

  return (
    <>
      <button className="kv-round header-settings-btn" aria-label="Cài đặt" aria-expanded={open} onClick={() => setOpen(true)}><SettingsIcon size={20} /></button>
      {open && (
        <div className="settings-drawer-root">
          <div className="settings-drawer-backdrop" onClick={() => setOpen(false)} />
          <aside className="settings-drawer" role="dialog" aria-modal="true" aria-label="Cài đặt">
            <header className="settings-drawer-head">
              <div><h3>Cài đặt</h3><p>{profile.full_name} · {stats.branch} chi nhánh · {stats.user} người dùng</p></div>
              <button aria-label="Đóng" onClick={() => setOpen(false)}><X size={20} /></button>
            </header>
            <div className="settings-drawer-body">
              <nav className="settings-drawer-nav">
                {NAV.map((group) => (
                  <section key={group.id}>
                    <h4>{group.label}</h4>
                    {group.items.map((item) => (
                      <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}>{item.icon}<span>{item.label}</span><ChevronRight size={14} /></button>
                    ))}
                  </section>
                ))}
              </nav>
              <div className="settings-drawer-content">
                <div className="settings-drawer-title"><h5>{activeLabel}</h5></div>
                <SettingsPanel section={section} profile={profile} />
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

const Panels: Record<string, React.ComponentType<{ profile?: Profile }>> = {
  store: dynamic(() => import("@/app/settings/panels/store").then((m) => m.StorePanel)),
  security: dynamic(() => import("@/app/settings/panels/security").then((m) => m.SecurityPanel)),
  currency: dynamic(() => import("@/app/settings/panels/currency").then((m) => m.CurrencyPanel)),
  api: dynamic(() => import("@/app/settings/panels/api").then((m) => m.ApiPanel)),
  print: dynamic(() => import("@/app/settings/panels/print").then((m) => m.PrintPanel)),
  "book-closing": dynamic(() => import("@/app/settings/panels/book-closing").then((m) => m.BookClosingPanel)),
  "audit-log": dynamic(() => import("@/app/settings/panels/audit-log").then((m) => m.AuditLogPanel)),
  devices: dynamic(() => import("@/app/settings/panels/devices").then((m) => m.DevicesPanel)),
  users: dynamic(() => import("@/app/settings/panels/users").then((m) => m.UsersPanel)),
  "product-info": dynamic(() => import("@/app/settings/panels/product-info").then((m) => m.ProductInfoPanel)),
  categories: dynamic(() => import("@/app/settings/panels/categories").then((m) => m.CategoriesPanel)),
  data: dynamic(() => import("@/app/settings/panels/data").then((m) => m.DataPanel)),
};

function SettingsPanel({ section, profile }: { section: string; profile: Profile }) {
  const Panel = Panels[section];
  if (!Panel) return <div className="settings-loading">Chọn một mục bên trái.</div>;
  return <Panel profile={profile} />;
}