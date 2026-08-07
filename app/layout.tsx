import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f1e8",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://jiangxinsheji.icu"),
  title: "匠心照片墙设计｜婚礼模板与打印定制",
  description: "从照片排版、视觉设计到高清打印，为每一场婚礼定制独一无二的幸福记忆。",
  openGraph: {
    title: "匠心照片墙设计",
    description: "婚礼照片墙｜模板｜定制",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og-champagne-1200.png", width: 1200, height: 630, alt: "匠心照片墙设计" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "匠心照片墙设计",
    description: "婚礼照片墙｜模板｜定制",
    images: ["/og-champagne-1200.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
