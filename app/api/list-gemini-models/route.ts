import { NextResponse } from "next/server"

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is not set" }, { status: 400 })
    }

    // モデルリストを取得するエンドポイントを呼び出す
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        {
          error: `Failed to list models: ${response.status}`,
          details: errorData,
        },
        { status: response.status },
      )
    }

    const data = await response.json()

    // 利用可能なモデルの情報を追加
    const availableModels = data.models || []
    const modelNames = availableModels.map((model: any) => model.name)

    // gemini-1.5モデルを優先的に表示
    const gemini15Models = modelNames.filter((name: string) => name.includes("gemini-1.5"))
    const otherModels = modelNames.filter((name: string) => !name.includes("gemini-1.5"))

    return NextResponse.json({
      ...data,
      recommendedModels: gemini15Models,
      otherModels: otherModels,
    })
  } catch (error) {
    console.error("Error listing Gemini models:", error)
    return NextResponse.json(
      {
        error: "Failed to list models",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
