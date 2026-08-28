import { getStoreBranches } from "../actions";
import { requireProfile } from "@/lib/auth";

export default async function BranchesPage() {
  await requireProfile("manager");
  const branches = await getStoreBranches();
  return (
    <div className="settings-section">
      <table className="settings-table">
        <thead><tr><th>Tên chi nhánh</th><th>Địa chỉ</th><th>Điện thoại</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {branches.map((b) => (
            <tr key={b.id}>
              <td>{b.name} {b.isDefault && <span className="settings-badge">Mặc định</span>}</td>
              <td>{b.address || "—"}</td>
              <td>{b.phone || "—"}</td>
              <td>{b.active ? "Đang hoạt động" : "Ngừng hoạt động"}</td>
            </tr>
          ))}
          {!branches.length && <tr><td colSpan={4} className="settings-empty">Chưa có chi nhánh nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}