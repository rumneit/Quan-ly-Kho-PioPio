import Link from "next/link";
import ManagementHeader, { type ManagementSection } from "@/app/management-header";
import { getStoreInfo, getStoreBranches, getStoreUsers } from "./actions";
import { requireProfile } from "@/lib/auth";

export default async function SettingsOverview() {
  await requireProfile("manager");
  const [store, branches, users] = await Promise.all([getStoreInfo(), getStoreBranches(), getStoreUsers()]);
  const activeUser = users.filter((u) => u.active).length;
  return (
    <div className="settings-overview">
      <section className="settings-cards">
        <article>
          <h4>Cửa hàng</h4>
          <strong>{store.name}</strong>
          <p>ID: {store.id.slice(0, 8)}…</p>
        </article>
        <article>
          <h4>Chi nhánh</h4>
          <strong>{branches.length}</strong>
          <p>{branches.filter((b) => b.isDefault)[0]?.name || "—"} (mặc định)</p>
        </article>
        <article>
          <h4>Người dùng</h4>
          <strong>{users.length}</strong>
          <p>{activeUser} đang hoạt động</p>
        </article>
      </section>
      <section className="settings-quicklinks">
        <h3>Quản lý nhanh</h3>
        <ul>
          <li><Link href="/settings/store-info">Thông tin cửa hàng</Link></li>
          <li><Link href="/settings/branches">Quản lý chi nhánh ({branches.length})</Link></li>
          <li><Link href="/settings/users">Quản lý người dùng ({users.length})</Link></li>
          <li><Link href="/settings/product-info">Thông tin hàng hóa</Link></li>
          <li><Link href="/settings/data" className="danger">Xóa dữ liệu</Link></li>
        </ul>
      </section>
    </div>
  );
}