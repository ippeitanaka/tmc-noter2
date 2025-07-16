import { NextResponse } from "next/server"

export async function GET() {
  try {
    // 環境変数の存在確認（値は表示しない）
    const envStatus = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: !!process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
    }

    // 基本的なNext.js機能テスト
    const nextjsTest = {
      serverComponents: true,
      apiRoutes: true,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      environment: envStatus,
      nextjs: nextjsTest,
      message: "デバッグAPIが正常に動作しています",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
