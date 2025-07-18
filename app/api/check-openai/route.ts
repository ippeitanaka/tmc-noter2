import { NextResponse } from "next/server"

export async function GET() {
  return checkOpenAIConnection()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const userApiKey = body?.apiKey
    
    return checkOpenAIConnection(userApiKey)
  } catch (error) {
    console.error("[CHECK] Failed to parse request body:", error)
    return NextResponse.json(
      {
        error: "リクエストの解析に失敗しました",
        available: false,
      },
      { status: 400 },
    )
  }
}

async function checkOpenAIConnection(userApiKey?: string) {
  try {
    // APIキーの取得: ユーザー提供 > 環境変数
    const apiKey = userApiKey || process.env.OPENAI_API_KEY
    
    if (!apiKey) {
      return NextResponse.json(
        {
          error: userApiKey 
            ? "提供されたAPIキーが空です" 
            : "OpenAI APIキーが設定されていません。Vercelダッシュボードで環境変数を確認するか、APIキーを入力してください。",
          available: false,
        },
        { status: 400 },
      )
    }

    // APIキーの形式を簡易チェック
    if (!apiKey.startsWith("sk-")) {
      return NextResponse.json(
        {
          error: "OpenAI APIキーの形式が正しくありません（sk-で始まる必要があります）",
          available: false,
        },
        { status: 400 },
      )
    }

    console.log("[CHECK] OpenAI API key source:", userApiKey ? "user-provided" : "environment")
    console.log("[CHECK] OpenAI API key present:", !!apiKey)
    console.log("[CHECK] OpenAI API key length:", apiKey.length)
    console.log("[CHECK] OpenAI API key prefix:", apiKey.substring(0, 7))

    console.log("[CHECK] OpenAI API key source:", userApiKey ? "user-provided" : "environment")
    console.log("[CHECK] OpenAI API key present:", !!apiKey)
    console.log("[CHECK] OpenAI API key length:", apiKey.length)
    console.log("[CHECK] OpenAI API key prefix:", apiKey.substring(0, 7))

    // 実際のAPIリクエストを試行
    try {
      console.log("[CHECK] Testing OpenAI API connection...")

      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "User-Agent": "TMC-Noter/1.0",
        },
        signal: AbortSignal.timeout(10000), // 10秒タイムアウト
      })

      console.log("[CHECK] OpenAI API response status:", response.status)
      console.log("[CHECK] OpenAI API response headers:", Object.fromEntries(response.headers.entries()))

      const responseText = await response.text()
      console.log("[CHECK] OpenAI API response text (first 200 chars):", responseText.substring(0, 200))

      if (!responseText) {
        console.error("[CHECK] OpenAI API returned empty response")
        return NextResponse.json(
          {
            error: "OpenAI APIから空のレスポンスが返されました",
            available: false,
            details: "Empty response received",
          },
          { status: 500 },
        )
      }

      if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}`

        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.error?.message || errorMessage
          
          // 具体的なエラーメッセージを提供
          if (response.status === 401) {
            errorMessage = "APIキーが無効です。正しいOpenAI APIキーを入力してください。"
          } else if (response.status === 429) {
            errorMessage = "APIの利用制限に達しています。後でもう一度お試しください。"
          } else if (response.status === 403) {
            errorMessage = "APIアクセスが拒否されました。アカウントの状態を確認してください。"
          }
        } catch (parseError) {
          console.log("[CHECK] Failed to parse error response as JSON")
          errorMessage = `${errorMessage}: ${responseText.substring(0, 100)}`
        }

        return NextResponse.json(
          {
            error: `OpenAI APIへの接続に失敗しました: ${errorMessage}`,
            available: false,
            status: response.status,
            details: responseText.substring(0, 200),
          },
          { status: response.status },
        )
      }

      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error("[CHECK] Failed to parse success response as JSON:", parseError)
        return NextResponse.json(
          {
            error: "OpenAI APIからの応答の解析に失敗しました",
            available: false,
            details: responseText.substring(0, 200),
          },
          { status: 500 },
        )
      }

      // Whisper APIの利用可能性を確認
      const whisperAvailable = data.data?.some((model: any) => model.id === "whisper-1")

      return NextResponse.json({
        success: true,
        message: userApiKey ? "提供されたAPIキーが有効です" : "OpenAI APIキーが有効です",
        models: data.data?.length || 0,
        whisperAvailable,
        available: true,
      })
    } catch (apiError) {
      console.error("[CHECK] OpenAI API connection error:", apiError)

      let errorMessage = "OpenAI APIへの接続に失敗しました"
      if (apiError instanceof Error) {
        if (apiError.name === "AbortError") {
          errorMessage = "OpenAI APIの応答がタイムアウトしました"
        } else if (apiError.message.includes("ENOTFOUND")) {
          errorMessage = "OpenAI APIサーバーが見つかりません（ネットワーク接続を確認してください）"
        } else {
          errorMessage = `OpenAI APIエラー: ${apiError.message}`
        }
      }

      return NextResponse.json(
        {
          error: errorMessage,
          available: false,
          details: apiError instanceof Error ? apiError.message : String(apiError),
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("[CHECK] OpenAI API check error:", error)
    return NextResponse.json(
      {
        error: `OpenAI APIの確認中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        available: false,
      },
      { status: 500 },
    )
  }
}
