import { NextResponse } from "next/server"

export async function GET() {
  try {
    // サーバーサイドで環境変数をチェック
    const openaiApiKey = process.env.OPENAI_API_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY
    const assemblyaiApiKey = process.env.ASSEMBLYAI_API_KEY
    const azureSpeechKey = process.env.AZURE_SPEECH_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // 環境情報
    const environmentInfo = {
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV,
      vercelUrl: process.env.VERCEL_URL,
      vercelRegion: process.env.VERCEL_REGION,
    }

    // APIキーの詳細チェック（最初の数文字のみ表示）
    const keyDetails = {
      openai: openaiApiKey ? {
        present: true,
        prefix: openaiApiKey.substring(0, 7),
        length: openaiApiKey.length,
        format: openaiApiKey.startsWith('sk-') ? 'valid' : 'invalid'
      } : { present: false },
      gemini: geminiApiKey ? {
        present: true,
        prefix: geminiApiKey.substring(0, 7),
        length: geminiApiKey.length,
        format: geminiApiKey.startsWith('AIza') ? 'valid' : 'unknown'
      } : { present: false },
      deepseek: deepseekApiKey ? {
        present: true,
        prefix: deepseekApiKey.substring(0, 7),
        length: deepseekApiKey.length,
        format: deepseekApiKey.startsWith('sk-') ? 'valid' : 'unknown'
      } : { present: false },
      supabase: {
        url: supabaseUrl ? {
          present: true,
          value: supabaseUrl,
          format: supabaseUrl.includes('supabase.co') ? 'valid' : 'unknown'
        } : { present: false },
        anonKey: supabaseAnonKey ? {
          present: true,
          prefix: supabaseAnonKey.substring(0, 10),
          length: supabaseAnonKey.length
        } : { present: false },
        serviceKey: supabaseServiceKey ? {
          present: true,
          prefix: supabaseServiceKey.substring(0, 10),
          length: supabaseServiceKey.length
        } : { present: false }
      }
    }

    return NextResponse.json({
      // シンプルなブール値（レガシー対応）
      openai: !!openaiApiKey,
      gemini: !!geminiApiKey,
      deepseek: !!deepseekApiKey,
      assemblyai: !!assemblyaiApiKey,
      azure: !!azureSpeechKey,
      openaiAvailable: !!openaiApiKey,
      geminiAvailable: !!geminiApiKey,
      deepseekAvailable: !!deepseekApiKey,
      aiAvailable: !!openaiApiKey || !!geminiApiKey || !!deepseekApiKey,
      
      // 詳細情報
      details: keyDetails,
      environment: environmentInfo,
      
      // 設定の推奨事項
      recommendations: {
        missingKeys: [
          !openaiApiKey && 'OPENAI_API_KEY',
          !geminiApiKey && 'GEMINI_API_KEY', 
          !deepseekApiKey && 'DEEPSEEK_API_KEY',
          !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
          !supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          !supabaseServiceKey && 'SUPABASE_SERVICE_ROLE_KEY'
        ].filter(Boolean),
        
        setupNeeded: !openaiApiKey && !geminiApiKey && !deepseekApiKey,
        
        priority: (() => {
          if (!openaiApiKey && !geminiApiKey && !deepseekApiKey) return 'critical'
          if (!supabaseUrl || !supabaseAnonKey) return 'high'
          return 'low'
        })()
      }
    })
  } catch (error) {
    console.error("Environment check error:", error)
    return NextResponse.json(
      {
        error: `環境変数のチェック中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          isVercel: !!process.env.VERCEL,
        }
      },
      { status: 500 },
    )
  }
}
