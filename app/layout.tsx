import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import "./menu-overrides.css";
import "./dropdown-menu.css";
import "./sales.css";
import "./products.css";
import "./pricebook.css";
import "./stocktakes.css";
import "./internal-use.css";
import "./damage-items.css";
import "./purchasing.css";
import "./orders.css";
import "./suppliers.css";
import "./business.css";
import "../style.css";
import "./reference-theme.css";
import "./orders-modules.css";
import "./toolbar-unified.css";

export const metadata: Metadata = {
  title: "PioPio | Quản lý bán hàng",
  description: "Nền tảng quản lý bán hàng, kho và nhân viên PioPio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
