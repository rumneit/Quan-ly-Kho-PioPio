import { requireProfile } from "@/lib/auth";

export default async function DataDangerPage() {
  await requireProfile("manager");
  return (
    <div className="settings-section settings-danger">
      <div className="settings-danger-warning">
        <strong>⚠ Khu vực nguy hiểm</strong>
        <p>Các thao tác dưới đây sẽ xóa dữ liệu thật. Hãy sao lưu trước khi thực hiện.</p>
      </div>
      <article>
        <h3>Xóa toàn bộ dữ liệu</h3>
        <p>Xóa toàn bộ dữ liệu Giao dịch, Thu chi, Hàng hóa, Đối tác và các dữ liệu khác ngoại trừ Người dùng, Chi nhánh.</p>
        <div className="settings-form">
          <label className="settings-check"><input type="checkbox" /> Tôi đã đọc kỹ và hiểu rõ các tác động của việc xóa dữ liệu.</label>
          <div className="settings-form-row">
            <label>Số điện thoại trên hợp đồng</label>
            <input type="text" placeholder="Nhập số điện thoại trên hợp đồng" />
          </div>
          <div className="settings-form-row">
            <label>Mật khẩu</label>
            <input type="password" placeholder="Nhập mật khẩu" />
          </div>
          <div className="settings-form-row">
            <label>Mật khẩu mở file</label>
            <input type="password" placeholder="Nhập mật khẩu" />
          </div>
          <div className="settings-form-actions">
            <button type="button" disabled className="settings-btn-danger">Xóa một lần</button>
            <button type="button" disabled>Xóa định kỳ</button>
          </div>
        </div>
      </article>
      <article>
        <h3>Nhận file tổng hợp dữ liệu</h3>
        <p>KiotViet sẽ gửi email tổng hợp dữ liệu khi hoàn tất xóa.</p>
        <div className="settings-form-row">
          <label>Email</label>
          <input type="email" placeholder="Nhập email" />
        </div>
        <label className="settings-check"><input type="checkbox" defaultChecked /> Nhận thông báo qua email</label>
      </article>
      <p className="settings-danger-note">Lưu ý: Các thao tác xóa hiện đang được tắt theo mặc định. Bật chỉ khi đã sao lưu và sẵn sàng.</p>
    </div>
  );
}