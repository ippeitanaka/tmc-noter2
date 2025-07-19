import { NextResponse } from "next/server"

export async function GET() {
  try {
    console.log("[CHECK-ENV] Starting comprehensive environment check")

    // すべてのAPI設定を確認
    const environments = {
      openai: {
        keySet: !!process.env.OPENAI_API_KEY,
        keyLength: process.env.OPENAI_API_KEY?.length || 0,
        keyPrefix: process.env.OPENAI_API_KEY?.substring(0, 7) || 'none',
        hasValidFormat: process.env.OPENAI_API_KEY?.startsWith('sk-') || false
      },
      gemini: {
        keySet: !!process.env.GEMINI_API_KEY,
        keyLength: process.env.GEMINI_API_KEY?.length || 0,
        keyPrefix: process.env.GEMINI_API_KEY?.substring(0, 10) || 'none',
        hasValidFormat: (process.env.GEMINI_API_KEY?.length || 0) > 20
      },
      deepseek: {
        keySet: !!process.env.DEEPSEEK_API_KEY,
        keyLength: process.env.DEEPSEEK_API_KEY?.length || 0,
        keyPrefix: process.env.DEEPSEEK_API_KEY?.substring(0, 7) || 'none',
        hasValidFormat: process.env.DEEPSEEK_API_KEY?.startsWith('sk-') || false
      }
    }

    // 全体的な状況サマリー
    const summary = {
      totalConfigured: Object.values(environments).filter(env => env.keySet).length,
      validFormatCount: Object.values(environments).filter(env => env.hasValidFormat).length,
      allConfigured: Object.values(environments).every(env => env.keySet),
      anyConfigured: Object.values(environments).some(env => env.keySet)
    }

    // システム情報
    const systemInfo = {
      isVercel: !!process.env.VERCEL,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      timestamp: new Date().toISOString()
    }

    console.log("[CHECK-ENV] Environment check completed:", summary)

    return NextResponse.json({
      success: true,
      summary,
      environments,
      system: systemInfo,
      message: summary.allConfigured 
        ? "すべてのAPIキーが設定されています" 
        : summary.anyConfigured 
        ? `${summary.totalConfigured}/3のAPIキーが設定されています`
        : "APIキーが設定されていません"
    })

  } catch (error) {
    console.error("[CHECK-ENV] Environment check error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    console.log("[CHECK-ENV] Starting detailed API connectivity test")

    // 各APIの実際の接続テストを実行
    const results = await Promise.allSettled([
      // OpenAI APIテスト
      fetch('/api/check-openai').then(res => res.json()),
      // Gemini APIテスト  
      fetch('/api/check-gemini').then(res => res.json()),
      // DeepSeek APIテスト
      fetch('/api/check-deepseek').then(res => res.json())
    ])

    const connectivityResults = {
      openai: results[0].status === 'fulfilled' ? results[0].value : { available: false, error: results[0].reason },
      gemini: results[1].status === 'fulfilled' ? results[1].value : { available: false, error: results[1].reason },
      deepseek: results[2].status === 'fulfilled' ? results[2].value : { available: false, error: results[2].reason }
    }

    const workingApis = Object.entries(connectivityResults).filter(([_, result]) => result.available).length

    return NextResponse.json({
      success: true,
      connectivity: connectivityResults,
      summary: {
        workingApis,
        totalApis: 3,
        allWorking: workingApis === 3,
        anyWorking: workingApis > 0
      },
      timestamp: new Date().toISOString(),
      message: workingApis === 3 
        ? "すべてのAPIが正常に動作しています" 
        : workingApis > 0 
        ? `${workingApis}/3のAPIが動作しています`
        : "すべてのAPIで問題が発生しています"
    })

  } catch (error) {
    console.error("[CHECK-ENV] Connectivity test error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
