import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      console.log("Gemini API key is not set")
      return NextResponse.json({ available: false, message: "APIキーが設定されていません" })
    }

    const url = new URL(req.url)
    const skipCheck = url.searchParams.get("skipCheck") === "true"

    if (skipCheck) {
      console.log("Skipping API test as requested, assuming API is available")
      return NextResponse.json({
        available: true,
        message: "Gemini APIキーが設定されています",
        skipApiCheck: true,
      })
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), 3000)
    })

    try {
      const result = await Promise.race([
        fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        timeoutPromise,
      ])

      if (!(result instanceof Response)) {
        throw new Error("Fetch failed or timed out unexpectedly")
      }

      const modelsResponse = result

      if (!modelsResponse.ok) {
        const errorData = await modelsResponse.json().catch(() => ({}))
        console.error("Failed to list models:", modelsResponse.status, errorData)

        if (modelsResponse.status === 401 || modelsResponse.status === 403) {
          return NextResponse.json({
            available: false,
            message: "Gemini APIキーが無効です",
            error: errorData,
          })
        }

        return NextResponse.json({
          available: true,
          message: "Gemini APIキーは設定されていますが、モデルリストの取得に失敗しました",
          warning: JSON.stringify(errorData),
          skipApiCheck: true,
        })
      }

      const modelsData = await modelsResponse.json()
      console.log("Available models:", modelsData)

      const availableModels = modelsData.models || []
      const modelNames = availableModels.map((model: any) => model.name)

      let modelToUse = ""
      for (const model of availableModels) {
        const modelName = model.name.split("/").pop()
        if (modelName === "gemini-1.5-flash") {
          modelToUse = model.name
          break
        }
      }

      if (!modelToUse) {
        for (const model of availableModels) {
          if (model.name.includes("gemini-1.5")) {
            modelToUse = model.name
            break
          }
        }
      }

      if (!modelToUse && availableModels.length > 0) {
        modelToUse = availableModels[0].name
      }

      if (!modelToUse) {
        return NextResponse.json({
          available: false,
          message: "利用可能なGeminiモデルが見つかりません",
        })
      }

      console.log("Using model:", modelToUse)

      const contentResult = await Promise.race([
        fetch(`https://generativelanguage.googleapis.com/v1/${modelToUse}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: "Hello",
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 5,
            },
          }),
        }),
        timeoutPromise,
      ])

      if (!(contentResult instanceof Response)) {
        throw new Error("Content generation failed or timed out")
      }

      const response = contentResult

      if (response.ok) {
        console.log("Gemini API connection successful")
        return NextResponse.json({
          available: true,
          message: "Gemini APIは利用可能です",
          testedConnection: true,
          modelUsed: modelToUse,
          availableModels: modelNames,
        })
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Gemini API error:", response.status, errorData)

        if (response.status === 503) {
          return NextResponse.json({
            available: false,
            temporary: true,
            message: "Gemini APIは一時的に利用できません。しばらく後にお試しください。",
            error: errorData,
          })
        }

        return NextResponse.json({
          available: false,
          message: `Gemini APIエラー: ${response.status}`,
          error: errorData,
        })
      }
    } catch (apiError: any) {
      console.error("Gemini API request failed:", apiError)

      if (apiError.message === "Request timeout" || String(apiError).includes("timeout")) {
        return NextResponse.json({
          available: true,
          message: "Gemini APIキーが設定されていますが、応答が遅いです",
          skipApiCheck: true,
          timeout: true,
        })
      }

      return NextResponse.json({
        available: true,
        message: "Gemini APIへの接続に問題がありますが、キーは設定されています",
        warning: String(apiError),
        skipApiCheck: true,
      })
    }
  } catch (error: any) {
    console.error("Gemini API check error:", error)
    return NextResponse.json({
      available: true,
      message: "Gemini APIキーは設定されていますが、チェック中にエラーが発生しました",
      warning: String(error),
      skipApiCheck: true,
    })
  }
}
