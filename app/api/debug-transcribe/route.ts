import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("=== TRANSCRIBE DEBUG API ===")
    
    // 環境変数の確認
    const envApiKey = process.env.OPENAI_API_KEY
    console.log("Environment API key exists:", !!envApiKey)
    console.log("Environment API key (first 10 chars):", envApiKey ? envApiKey.substring(0, 10) + "..." : "none")
    
    const formData = await request.formData()
    
    // FormDataの内容を確認
    console.log("=== FormData Debug ===")
    for (const [key, value] of formData.entries()) {
      if (key === "file") {
        const file = value as File
        console.log(`${key}: File(name: ${file.name}, size: ${file.size}, type: ${file.type})`)
      } else {
        console.log(`${key}: ${value}`)
      }
    }
    
    // ユーザー提供のAPIキーをチェック
    const userApiKey = formData.get("apiKey") as string
    console.log("User provided API key:", !!userApiKey)
    console.log("User API key (first 10 chars):", userApiKey ? userApiKey.substring(0, 10) + "..." : "none")
    
    // オプションの確認
    const options = {
      speakerDiarization: formData.get("speakerDiarization") === "true",
      generateSummary: formData.get("generateSummary") === "true",
      extractKeywords: formData.get("extractKeywords") === "true",
      includeTimestamps: formData.get("includeTimestamps") === "true",
      sentimentAnalysis: formData.get("sentimentAnalysis") === "true",
      language: (formData.get("language") as string) || "ja",
      model: (formData.get("model") as string) || "whisper-1"
    }
    
    console.log("=== Options Debug ===")
    console.log("Options:", options)
    
    // APIキーの有効性チェック
    const apiKeyToUse = userApiKey || envApiKey
    
    if (!apiKeyToUse) {
      return NextResponse.json({
        error: "No API key available",
        debug: {
          envKeyExists: !!envApiKey,
          userKeyExists: !!userApiKey,
          options: options,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 })
    }
    
    // 成功レスポンス（実際の処理は行わない）
    return NextResponse.json({
      debug: true,
      message: "Debug information collected successfully",
      apiKeySource: userApiKey ? "user-provided" : "environment",
      apiKeyExists: !!apiKeyToUse,
      options: options,
      envCheck: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error("Debug API error:", error)
    return NextResponse.json({
      error: "Debug API failed",
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
