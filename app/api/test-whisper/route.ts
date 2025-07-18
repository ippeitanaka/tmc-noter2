import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    console.log("[TEST] Testing Whisper API with minimal audio...")

    // リクエストボディからAPIキーを取得（オプション）
    let userApiKey: string | undefined
    try {
      const body = await request.json()
      userApiKey = body?.apiKey
    } catch (error) {
      // JSONパースエラーは無視（APIキーが提供されていない場合）
      console.log("[TEST] No API key provided in request body, using environment variable")
    }

    // APIキーの取得: ユーザー提供 > 環境変数
    const apiKey = userApiKey || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ 
        success: false,
        error: userApiKey 
          ? "提供されたAPIキーが空です" 
          : "OpenAI APIキーが設定されていません。APIキーを入力するか、環境変数を設定してください。"
      }, { status: 400 })
    }

    console.log("[TEST] Using API key source:", userApiKey ? "user-provided" : "environment")

    // 最小限のテスト用音声データ（無音の短いWAVファイル）
    // これは1秒間の無音WAVファイルのBase64エンコード
    const testAudioBase64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="

    try {
      const binaryData = Buffer.from(testAudioBase64, "base64")
      console.log("[TEST] Test audio binary size:", binaryData.length)

      const formData = new FormData()
      const fileBlob = new Blob([binaryData], { type: "audio/wav" })
      formData.append("file", fileBlob, "test.wav")
      formData.append("model", "whisper-1")
      formData.append("language", "ja")
      formData.append("response_format", "json")

      console.log("[TEST] Sending test request to OpenAI Whisper API...")

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(30000), // 30秒タイムアウト
      })

      console.log("[TEST] Whisper API response status:", response.status)
      console.log("[TEST] Whisper API response headers:", Object.fromEntries(response.headers.entries()))

      const responseText = await response.text()
      console.log("[TEST] Whisper API response text:", responseText)

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: `Whisper API test failed with status ${response.status}`,
          status: response.status,
          response: responseText,
        })
      }

      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        return NextResponse.json({
          success: false,
          error: "Failed to parse Whisper API response as JSON",
          response: responseText,
        })
      }

      return NextResponse.json({
        success: true,
        message: "Whisper API is working correctly",
        result,
      })
    } catch (error) {
      console.error("[TEST] Whisper API test error:", error)
      return NextResponse.json({
        success: false,
        error: "Whisper API test failed",
        details: error instanceof Error ? error.message : String(error),
      })
    }
  } catch (error) {
    console.error("[TEST] Test error:", error)
    return NextResponse.json({
      success: false,
      error: "Test failed",
      details: error instanceof Error ? error.message : String(error),
    })
  }
}
