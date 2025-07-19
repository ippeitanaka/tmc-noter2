import { NextRequest, NextResponse } from "next/server"

// パブリックアクセス可能なAPIキー状況チェッカー
export async function GET(request: NextRequest) {
  try {
    console.log("[PUBLIC-CHECK] Starting public API key status check")

    // 基本的な環境情報（機密情報は含まない）
    const apiStatus = {
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        keyLength: process.env.OPENAI_API_KEY?.length || 0,
        validFormat: process.env.OPENAI_API_KEY?.startsWith('sk-') || false,
        status: process.env.OPENAI_API_KEY ? '設定済み' : '未設定'
      },
      gemini: {
        configured: !!process.env.GEMINI_API_KEY,
        keyLength: process.env.GEMINI_API_KEY?.length || 0,
        validFormat: (process.env.GEMINI_API_KEY?.length || 0) > 20,
        status: process.env.GEMINI_API_KEY ? '設定済み' : '未設定'
      },
      deepseek: {
        configured: !!process.env.DEEPSEEK_API_KEY,
        keyLength: process.env.DEEPSEEK_API_KEY?.length || 0,
        validFormat: process.env.DEEPSEEK_API_KEY?.startsWith('sk-') || false,
        status: process.env.DEEPSEEK_API_KEY ? '設定済み' : '未設定'
      }
    }

    // サマリー情報
    const summary = {
      totalConfigured: Object.values(apiStatus).filter(api => api.configured).length,
      totalApis: 3,
      allConfigured: Object.values(apiStatus).every(api => api.configured),
      validFormats: Object.values(apiStatus).filter(api => api.validFormat).length
    }

    // システム情報（非機密）
    const systemInfo = {
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      isVercel: !!process.env.VERCEL,
      timestamp: new Date().toISOString(),
      region: process.env.VERCEL_REGION || 'unknown'
    }

    const responseData = {
      success: true,
      message: summary.allConfigured 
        ? `✅ すべてのAPIキー（${summary.totalConfigured}/3）が設定されています` 
        : `⚠️ 一部のAPIキー（${summary.totalConfigured}/3）のみ設定されています`,
      apiStatus,
      summary,
      system: systemInfo
    }

    console.log("[PUBLIC-CHECK] API key check completed:", summary)

    // CORS対応
    const response = NextResponse.json(responseData)
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')

    return response

  } catch (error) {
    console.error("[PUBLIC-CHECK] Error during API key check:", error)
    
    const errorResponse = NextResponse.json(
      {
        success: false,
        error: "APIキー状況の確認中にエラーが発生しました",
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )

    // CORS対応
    errorResponse.headers.set('Access-Control-Allow-Origin', '*')
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET')
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type')

    return errorResponse
  }
}

// OPTIONSメソッドでプリフライトリクエストに対応
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
