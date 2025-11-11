import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/app-header";
import { MUIThemeProvider } from "@/components/providers/mui-theme-provider";
import { PageTransition } from "@/components/providers/page-transition";
import { EmotionCacheProvider } from "@/components/providers/emotion-cache";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AI 旅行规划助手 | 语音一键生成行程",
    template: "%s · AI 旅行规划助手",
  },
  description:
    "用语音或文字描述，自动生成含景点/餐饮/住宿/交通的完整行程；支持预算、偏好、地图预览与登录保存。",
  applicationName: "AI 旅行规划助手",
  keywords: [
    "AI 旅行",
    "行程规划",
    "语音生成",
    "旅游攻略",
    "地图预览",
    "百炼",
    "高德",
  ],
  openGraph: {
    type: "website",
    title: "AI 旅行规划助手 | 语音一键生成行程",
    description:
      "用语音或文字描述，自动生成含景点/餐饮/住宿/交通的完整行程；支持预算、偏好、地图预览与登录保存。",
    siteName: "AI 旅行规划助手",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI 旅行规划助手 | 语音一键生成行程",
    description:
      "用语音或文字描述，自动生成含景点/餐饮/住宿/交通的完整行程；支持预算、偏好、地图预览与登录保存。",
  },
  robots: {
    index: true,
    follow: true,
  },
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="zh-CN">
      <head>
        <meta name="emotion-insertion-point" content="" />
      </head>
          <body
              className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <EmotionCacheProvider>
          <MUIThemeProvider>
            <div className="mx-auto max-w-6xl px-4 py-6">
              <AppHeader />
              <PageTransition>{children}</PageTransition>
            </div>
          </MUIThemeProvider>
        </EmotionCacheProvider>
          </body>
      </html>
  );
}
