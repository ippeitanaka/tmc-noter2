import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "TMC Noter - AI議事録作成アプリ",
  description: "音声ファイルやリアルタイム録音から自動で議事録を生成するAIアプリケーション",
  keywords: ["議事録", "AI", "音声認識", "文字起こし", "TMC"],
  authors: [{ name: "TMC Noter Team" }],
  openGraph: {
    title: "TMC Noter - AI議事録作成アプリ",
    description: "音声ファイルやリアルタイム録音から自動で議事録を生成するAIアプリケーション",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
