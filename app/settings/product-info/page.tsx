import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ProductInfoPage() {
  await requireProfile("manager");
  const admin = createAdminClient();
  const [categories, brands, units, groups] = await Promise.all([
    admin.from("product_categories").select("id,name", { count: "exact", head: true }),
    admin.from("product_brands").select("id", { count: "exact", head: true }),
    admin.from("products").select("id", { count: "exact", head: true }),
    admin.from("customer_groups").select("id", { count: "exact", head: true }),
  ]);
  const stats = [
    { label: "Mã vạch hàng hóa", value: "Hỗ trợ mã vạch chuẩn & mã vạch tự tạo", href: "/products" },
    { label: "Tự động gợi ý thông tin hàng hóa", value: "KiotViet tự động gợi ý tên, mã, mô tả, hình ảnh", href: "/products" },
    { label: "Đơn vị tính", value: "Quản lý hàng hóa theo đơn vị tính (chiếc, lốc, thùng)", href: "/products" },
    { label: "Thuộc tính", value: "Quản lý theo đặc điểm (màu sắc, kích cỡ, chất liệu)", href: "/products" },
    { label: "Nhóm hàng", value: `${categories.count || 0} nhóm hàng`, href: "/products" },
    { label: "Thương hiệu", value: `${brands.count || 0} thương hiệu`, href: "/products" },
    { label: "Phương pháp tính giá vốn", value: "Giá vốn cố định / Giá vốn trung bình", href: null },
    { label: "Sản xuất hàng hóa", value: "Thiết lập nguyên liệu thành phần & thành phẩm", href: null },
    { label: "Phân quyền người dùng theo nhóm hàng", value: "Phân quyền chi tiết cho từng nhân viên", href: "/settings/users" },
  ];
  return (
    <div className="settings-section">
      <div className="settings-info-grid">
        {stats.map((s) => (
          <article key={s.label}>
            <h4>{s.label}</h4>
            <p>{s.value}</p>
            {s.href && <Link href={s.href}>Mở trang liên quan</Link>}
          </article>
        ))}
      </div>
    </div>
  );
}