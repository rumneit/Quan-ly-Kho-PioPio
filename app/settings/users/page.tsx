import { getStoreUsers } from "../actions";
import { requireProfile } from "@/lib/auth";

export default async function UsersPage() {
  await requireProfile("manager");
  const users = await getStoreUsers();
  return (
    <div className="settings-section">
      <table className="settings-table">
        <thead><tr><th>Tên đăng nhập</th><th>Họ và tên</th><th>Vai trò</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.fullName}</td>
              <td>{u.role === "manager" ? "Quản lý" : "Bán hàng"}</td>
              <td>{u.active ? "Đang hoạt động" : "Ngừng hoạt động"}</td>
            </tr>
          ))}
          {!users.length && <tr><td colSpan={4} className="settings-empty">Chưa có người dùng nào.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}