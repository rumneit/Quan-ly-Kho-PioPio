import { getStoreInfo } from "../actions";
import { requireProfile } from "@/lib/auth";

export default async function StoreInfoPage() {
  await requireProfile("manager");
  const store = await getStoreInfo();
  return (
    <div className="settings-section">
      <div className="settings-form">
        <div className="settings-form-row">
          <label>Tên cửa hàng</label>
          <input value={store.name} readOnly />
        </div>
        <div className="settings-form-row">
          <label>Mã cửa hàng</label>
          <input value={store.id} readOnly />
        </div>
        <div className="settings-form-row">
          <label>Ngày tạo</label>
          <input value={store.createdAt ? new Date(store.createdAt).toLocaleDateString("vi-VN") : "—"} readOnly />
        </div>
        <p className="settings-form-note">Thông tin cửa hàng hiện chỉ ở chế độ xem. Chỉnh sửa sẽ được bổ sung khi có yêu cầu.</p>
      </div>
    </div>
  );
}