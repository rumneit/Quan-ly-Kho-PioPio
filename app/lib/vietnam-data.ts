// Danh mục đơn vị hành chính cấp tỉnh theo Nghị quyết 202/2025/QH15 (hiệu lực 01/07/2025): 34 tỉnh/thành mới.
export const VN_PROVINCES = [
  "Hà Nội",
  "Tuyên Quang",
  "Cao Bằng",
  "Lạng Sơn",
  "Bắc Ninh",
  "Thái Nguyên",
  "Lào Cai",
  "Phú Thọ",
  "Điện Biên",
  "Lai Châu",
  "Sơn La",
  "Quảng Ninh",
  "Hải Phòng",
  "Hưng Yên",
  "Ninh Bình",
  "Thanh Hóa",
  "Nghệ An",
  "Hà Tĩnh",
  "Quảng Trị",
  "Huế",
  "Đà Nẵng",
  "Quảng Ngãi",
  "Gia Lai",
  "Đắk Lắk",
  "Khánh Hòa",
  "Lâm Đồng",
  "TP. Hồ Chí Minh",
  "Đồng Nai",
  "Tây Ninh",
  "Cần Thơ",
  "Vĩnh Long",
  "Đồng Tháp",
  "An Giang",
  "Cà Mau",
] as const;

// 63 tỉnh cũ (trước 01/07/2025) — dùng để đối chiếu dữ liệu nhập từ trước khi sáp nhập.
export const VN_PROVINCES_LEGACY = [
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh", "Bến Tre",
  "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau", "Cần Thơ", "Cao Bằng",
  "Đà Nẵng", "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp", "Gia Lai",
  "Hà Giang", "Hà Nam", "Hà Nội", "Hà Tĩnh", "Hải Dương", "Hải Phòng", "Hậu Giang",
  "Hòa Bình", "TP. Hồ Chí Minh", "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum",
  "Lai Châu", "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An",
  "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam",
  "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng", "Sơn La", "Tây Ninh",
  "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang",
  "Trà Vinh", "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái",
] as const;

// Tỉnh mới -> các tỉnh cũ đã sáp nhập vào (để lọc dữ liệu cũ vẫn ra đúng khi chọn tỉnh mới).
export const VN_PROVINCE_MERGE: Record<string, string[]> = {
  "Tuyên Quang": ["Hà Giang"],
  "Thái Nguyên": ["Bắc Kạn"],
  "Bắc Ninh": ["Bắc Giang"],
  "Lào Cai": ["Yên Bái"],
  "Phú Thọ": ["Hòa Bình", "Vĩnh Phúc"],
  "Hải Phòng": ["Hải Dương"],
  "Hưng Yên": ["Thái Bình"],
  "Ninh Bình": ["Hà Nam", "Nam Định"],
  "Quảng Trị": ["Quảng Bình"],
  "Huế": ["Thừa Thiên Huế"],
  "Đà Nẵng": ["Quảng Nam"],
  "Quảng Ngãi": ["Kon Tum"],
  "Gia Lai": ["Bình Định"],
  "Đắk Lắk": ["Phú Yên"],
  "Khánh Hòa": ["Ninh Thuận"],
  "Lâm Đồng": ["Đắk Nông", "Bình Thuận"],
  "TP. Hồ Chí Minh": ["Bình Dương", "Bà Rịa - Vũng Tàu"],
  "Đồng Nai": ["Bình Phước"],
  "Tây Ninh": ["Long An"],
  "Cần Thơ": ["Hậu Giang", "Sóc Trăng"],
  "Vĩnh Long": ["Bến Tre", "Trà Vinh"],
  "Đồng Tháp": ["Tiền Giang"],
  "An Giang": ["Kiên Giang"],
  "Cà Mau": ["Bạc Liêu"],
};

function normalizeProvince(value: string): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

// True nếu giá trị lưu trong dữ liệu (có thể là tên tỉnh cũ) thuộc về tỉnh mới đã chọn.
export function provinceMatches(storedArea: string, selectedNew: string): boolean {
  const a = normalizeProvince(storedArea);
  const b = normalizeProvince(selectedNew);
  if (!a || !b) return false;
  if (a === b) return true;
  const legacy = VN_PROVINCE_MERGE[b] || [];
  return legacy.some((old) => a === normalizeProvince(old));
}

// Danh sách tên (mới + cũ) chấp nhận cho một tỉnh mới — dùng cho lọc nhiều giá trị.
export function provinceAcceptedNames(selectedNew: string): string[] {
  return [normalizeProvince(selectedNew), ...(VN_PROVINCE_MERGE[selectedNew] || []).map(normalizeProvince)];
}

// Ảnh phường/xã mẫu cho các thành phố lớn (theo tên tỉnh MỚI).
export const VN_WARDS: Record<string, string[]> = {
  "TP. Hồ Chí Minh": ["Phường Bến Nghé", "Phường Bến Thành", "Phường Cầu Ông Lãnh", "Phường Cô Giang", "Phường Đa Kao", "Phường Nguyễn Thái Bình", "Phường Phạm Ngũ Lão", "Phường Tân Định", "Phường Bùi Viện", "Phường Cầu Kho", "Phường Cầu Muối", "Phường Võ Thị Sáu", "Phường 1", "Phường 2", "Phường 3", "Phường 4", "Phường 5", "Phường 6", "Phường 7", "Phường 8", "Phường 9", "Phường 10", "Phường 11", "Phường 12"],
  "Hà Nội": ["Phường Bách Khoa", "Phường Bạch Mai", "Phường Bùi Xương Trạch", "Phường Cầu Dền", "Phường Đống Mác", "Phường Đồng Xuân", "Phường Hàng Bài", "Phường Hàng Bông", "Phường Hàng Bạc", "Phường Hàng Buồm", "Phường Hàng Gai", "Phường Hàng Mã", "Phường Hai Bà Trưng", "Phường Lê Đại Hành", "Phường Lý Thái Tổ", "Phường Ngọc Hà", "Phường Nguyễn Du", "Phường Nguyễn Trung Trực", "Phường Phan Chu Trinh", "Phường Phố Huế", "Phường Quang Trung", "Phường Tràng Tiền", "Phường Trần Hưng Đạo", "Phường Trúc Bạch", "Phường Vĩnh Phúc"],
  "Đà Nẵng": ["Phường An Hải Bắc", "Phường An Hải Đông", "Phường An Hải Nam", "Phường An Hải Tây", "Phường Bình Hiên", "Phường Bình Thuận", "Phường Hòa Cường Bắc", "Phường Hòa Cường Nam", "Phường Hòa Thuận Đông", "Phường Hòa Thuận Tây", "Phường Mân Thái", "Phường Nại Hiên Đông", "Phường Phước Mỹ", "Phường Thạch Thang", "Phường Thanh Bình", "Phường Thuận Phước", "Phường Xương Huân"],
  "Hải Phòng": ["Phường Cầu Đất", "Phường Cầu Tre", "Phường Đông Khê", "Phường Dư Hàng", "Phường Hàng Kênh", "Phường Lạch Tray", "Phường Lương Khánh Thiện", "Phường Máy Tơ", "Phường Ngô Quyền", "Phường Phú Thợ", "Phường Quán Toan", "Phường Sở Dầu", "Phường Trần Nguyên Hãn", "Phường Vạn Cao"],
  "Cần Thơ": ["Phường An Bình", "Phường An Cư", "Phường An Hòa", "Phường An Nghiệp", "Phường An Thới", "Phường Bằng Lăng", "Phường Bình Thủy", "Phường Cái Khế", "Phường Hưng Lợi", "Phường Lê Bình", "Phường Phú Thứ", "Phường Tân An", "Phường Thới Bình", "Phường Trà An", "Phường Xuân Khánh"],
  "Huế": ["Phường Phú Hội", "Phường Phú Hậu", "Phường Xuân Phú", "Phường Vỹ Dạ", "Phường Thủy Xuân", "Phường Trường An", "Phường An Đông", "Phường An Hòa", "Phường Tây Lộc", "Phường Thuận Lộc"],
};

export function getWardsForProvince(province: string): string[] {
  const key = normalizeProvince(province);
  if (VN_WARDS[key]) return VN_WARDS[key];
  // Dữ liệu phường cũ theo tên tỉnh trước sáp nhập: tìm qua bảng gộp.
  const merged = VN_PROVINCE_MERGE[key] || [];
  for (const old of merged) {
    if (VN_WARDS[normalizeProvince(old)]) return VN_WARDS[normalizeProvince(old)];
  }
  return [];
}
