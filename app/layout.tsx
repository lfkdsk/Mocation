import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Run server rendering in Hong Kong — nearest to the China-hosted API/CDN.
// (Vercel honours this for Edge routes; cascades to nested page segments.)
export const preferredRegion = "hkg1";

export const metadata: Metadata = {
  title: {
    default: "Mocation · 影视取景地",
    template: "%s · Mocation",
  },
  description:
    "在地图上发现电影与剧集的取景地 —— 一个清爽的影视取景地浏览客户端。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
