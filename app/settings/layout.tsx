import { ReactNode } from "react";
import ManagementHeader from "@/app/management-header";
import type { Profile } from "@/lib/auth";
import { getStoreBranches, getStoreInfo } from "./actions";
import SettingsTitle from "./settings-title";
import SettingsSidebar from "./settings-sidebar";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const profile = await getActiveProfile();
  const [store, branchCount, userCount] = await Promise.all([
    getStoreInfo(),
    getStoreBranches().then((b) => b.length),
    getUserCount(),
  ]);
  const sidebarHeader = (
    <div className="settings-sidebar-header">
      <h2>Cài đặt</h2>
      <p>{store.name} · {branchCount} chi nhánh · {userCount} người dùng</p>
    </div>
  );

  return (
    <div className="kv-shell product-page business-page">
      <ManagementHeader profile={profile} active="settings" />
      <div className="settings-shell">
        <SettingsSidebar header={sidebarHeader} />
        <main className="settings-main">
          <SettingsTitle />
          <div className="settings-content">{children}</div>
        </main>
      </div>
    </div>
  );
}

async function getActiveProfile(): Promise<Profile> {
  const { requireProfile } = await import("@/lib/auth");
  const { profile } = await requireProfile("manager");
  return profile;
}

async function getUserCount(): Promise<number> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const store = await getStoreInfo();
  const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("store_id", store.id);
  return count || 0;
}