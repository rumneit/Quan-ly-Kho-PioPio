import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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
import "./business.css";
import "./reference-theme.css";
import "./orders-modules.css";
import "./toolbar-unified.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "700"], display: "swap", variable: "--font-mono" });

export const metadata: Metadata = {
  title: "PioPio | Quản lý bán hàng",
  description: "Nền tảng quản lý bán hàng, kho và nhân viên PioPio.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className={inter.className}>
        <a href="#main" className="skip-link">
          Bỏ qua đến nội dung
        </a>
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
