import { NextResponse } from "next/server"

export async function GET() {
  try {
    // サーバーサイドで環境変数をチェック
    const openaiApiKey = process.env.OPENAI_API_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY
    const assemblyaiApiKey = process.env.ASSEMBLYAI_API_KEY
    const azureSpeechKey = process.env.AZURE_SPEECH_KEY

    return NextResponse.json({
      openai: !!openaiApiKey,
      gemini: !!geminiApiKey,
      deepseek: !!deepseekApiKey,
      assemblyai: !!assemblyaiApiKey,
      azure: !!azureSpeechKey,
      // レガシー対応
      openaiAvailable: !!openaiApiKey,
      geminiAvailable: !!geminiApiKey,
      deepseekAvailable: !!deepseekApiKey,
      // DeepSeekが利用できなくても、少なくとも1つのAIモデルが利用可能であればOK
      aiAvailable: !!openaiApiKey || !!geminiApiKey || !!deepseekApiKey,
    })
  } catch (error) {
    console.error("Environment check error:", error)
    return NextResponse.json(
      {
        error: `環境変数のチェック中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}
