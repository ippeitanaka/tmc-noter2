import { NextResponse } from "next/server"

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI APIキーが設定されていません" }, { status: 500 })
    }

    // APIキーの一部を隠して返す（セキュリティ対策）
    const maskedKey = `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 4)}`

    return NextResponse.json({
      key: apiKey,
      maskedKey: maskedKey,
    })
  } catch (error) {
    console.error("Error getting OpenAI API key:", error)
    return NextResponse.json({ error: "APIキーの取得中にエラーが発生しました" }, { status: 500 })
  }
}
