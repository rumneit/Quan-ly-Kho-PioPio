export const VN_PROVINCES = [
  "An Giang","Bà Rịa - Vũng Tàu","Bắc Giang","Bắc Kạn","Bạc Liêu","Bắc Ninh","Bến Tre",
  "Bình Định","Bình Dương","Bình Phước","Bình Thuận","Cà Mau","Cần Thơ","Cao Bằng",
  "Đà Nẵng","Đắk Lắk","Đắk Nông","Điện Biên","Đồng Nai","Đồng Tháp","Gia Lai",
  "Hà Giang","Hà Nam","Hà Nội","Hà Tĩnh","Hải Dương","Hải Phòng","Hậu Giang",
  "Hòa Bình","TP. Hồ Chí Minh","Hưng Yên","Khánh Hòa","Kiên Giang","Kon Tum",
  "Lai Châu","Lâm Đồng","Lạng Sơn","Lào Cai","Long An","Nam Định","Nghệ An",
  "Ninh Bình","Ninh Thuận","Phú Thọ","Phú Yên","Quảng Bình","Quảng Nam",
  "Quảng Ngãi","Quảng Ninh","Quảng Trị","Sóc Trăng","Sơn La","Tây Ninh",
  "Thái Bình","Thái Nguyên","Thanh Hóa","Thừa Thiên Huế","Tiền Giang",
  "Trà Vinh","Tuyên Quang","Vĩnh Long","Vĩnh Phúc","Yên Bái"
] as const;

// Sample wards for major provinces — extended via API or manual entry
export const VN_WARDS: Record<string, string[]> = {
  "TP. Hồ Chí Minh": ["Phường Bến Nghé","Phường Bến Thành","Phường Cầu Ông Lãnh","Phường Cô Giang","Phường Đa Kao","Phường Nguyễn Thái Bình","Phường Phạm Ngũ Lão","Phường Tân Định","Phường Bùi Viện","Phường Cầu Kho","Phường Cầu Muối","Phường Phạm Ngũ Lão","Phường Tân Định","Phường Võ Thị Sáu","Phường 1","Phường 2","Phường 3","Phường 4","Phường 5","Phường 6","Phường 7","Phường 8","Phường 9","Phường 10","Phường 11","Phường 12","Phường 13","Phường 14","Phường 15","Phường 16"],
  "Hà Nội": ["Phường Bách Khoa","Phường Bạch Mai","Phường Bùi Xương Trạch","Phường Cầu Dền","Phường Đống Mác","Phường Đồng Xuân","Phường Hàng Bài","Phường Hàng Bông","Phường Hàng Bạc","Phường Hàng Buồm","Phường Hàng Gai","Phường Hàng Mã","Phường Hai Bà Trưng","Phường Lê Đại Hành","Phường Lý Thái Tổ","Phường Ngọc Hà","Phường Nguyễn Du","Phường Nguyễn Trung Trực","Phường Phan Chu Trinh","Phường Phố Huế","Phường Quang Trung","Phường Tràng Tiền","Phường Trần Hưng Đạo","Phường Trúc Bạch","Phường Vĩnh Phúc"],
  "Đà Nẵng": ["Phường An Hải Bắc","Phường An Hải Đông","Phường An Hải Nam","Phường An Hải Tây","Phường Bình Hiên","Phường Bình Thuận","Phường Hòa Cường Bắc","Phường Hòa Cường Nam","Phường Hòa Thuận Đông","Phường Hòa Thuận Tây","Phường Mân Thái","Phường Nại Hiên Đông","Phường Phước Mỹ","Phường Thạch Thang","Phường Thanh Bình","Phường Thuận Phước","Phường Xương Huân"],
  "Hải Phòng": ["Phường Cầu Đất","Phường Cầu Tre","Phường Đông Khê","Phường Dư Hàng","Phường Hàng Kênh","Phường Lạch Tray","Phường Lương Khánh Thiện","Phường Máy Tơ","Phường Ngô Quyền","Phường Phú Thợ","Phường Quán Toan","Phường Sở Dầu","Phường Trần Nguyên Hãn","Phường Vạn Cao","Phường An Biên","Phường An Dương"],
  "Cần Thơ": ["Phường An Bình","Phường An Cư","Phường An Hòa","Phường An Nghiệp","Phường An Thới","Phường Bằng Lăng","Phường Bình Thủy","Phường Cái Khế","Phường Hưng Lợi","Phường Lê Bình","Phường Phú Thứ","Phường Tân An","Phường Thới Bình","Phường Trà An","Phường Xuân Khánh"],
};

export function getWardsForProvince(province: string): string[] {
  return VN_WARDS[province] || [];
}