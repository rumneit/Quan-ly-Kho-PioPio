import type { Metadata } from "next";
import "./globals.css";
import "../style.css";

export const metadata: Metadata = {
  title: "PioPio | Quản lý bán hàng",
  description: "Nền tảng quản lý bán hàng, kho và nhân viên PioPio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
