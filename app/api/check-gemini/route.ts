import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    console.log("[CHECK-GEMINI] Starting Gemini API check")
    
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      console.log("[CHECK-GEMINI] Gemini API key is not set")
      return NextResponse.json({ 
        available: false, 
        message: "APIキーが設定されていません",
        timestamp: new Date().toISOString()
      })
    }

    const url = new URL(req.url)
    const skipCheck = url.searchParams.get("skipCheck") === "true"

    if (skipCheck) {
      console.log("[CHECK-GEMINI] Skipping API test as requested, assuming API is available")
      return NextResponse.json({
        available: true,
        message: "Gemini APIキーが設定されています",
        skipApiCheck: true,
        timestamp: new Date().toISOString()
      })
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), 3000)
    })

    try {
      console.log("[CHECK-GEMINI] Testing API connection...")
      
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
      console.log("[CHECK-GEMINI] Models API response status:", modelsResponse.status)

      if (!modelsResponse.ok) {
        let errorData = {}
        let errorText = ""
        
        try {
          errorText = await modelsResponse.text()
          console.log("[CHECK-GEMINI] Error response text:", errorText.substring(0, 200))
          
          if (errorText.trim()) {
            try {
              errorData = JSON.parse(errorText)
            } catch (parseError) {
              console.error("[CHECK-GEMINI] Failed to parse error response JSON:", parseError)
              errorData = { parseError: "Failed to parse response as JSON", rawText: errorText.substring(0, 200) }
            }
          } else {
            errorData = { error: "Empty response from server" }
          }
        } catch (textError) {
          console.error("[CHECK-GEMINI] Failed to read error response text:", textError)
          errorData = { textError: "Failed to read response text" }
        }
        
        console.error("[CHECK-GEMINI] Failed to list models:", modelsResponse.status, errorData)

        if (modelsResponse.status === 401 || modelsResponse.status === 403) {
          return NextResponse.json({
            available: false,
            message: "Gemini APIキーが無効です",
            error: errorData,
            timestamp: new Date().toISOString()
          })
        }

        return NextResponse.json({
          available: true,
          message: "Gemini APIキーは設定されていますが、モデルリストの取得に失敗しました",
          warning: JSON.stringify(errorData),
          skipApiCheck: true,
          timestamp: new Date().toISOString()
        })
      }

      // 成功時のレスポンス処理
      let modelsData
      let modelsText = ""
      
      try {
        modelsText = await modelsResponse.text()
        console.log("[CHECK-GEMINI] Models response text length:", modelsText.length)
        
        if (!modelsText || modelsText.trim() === '') {
          console.warn("[CHECK-GEMINI] Empty response from Gemini models API")
          return NextResponse.json({
            available: true,
            message: "Gemini APIキーは設定されていますが、空のレスポンスが返されました",
            skipApiCheck: true,
            timestamp: new Date().toISOString()
          })
        }
        
        try {
          modelsData = JSON.parse(modelsText)
        } catch (parseError) {
          console.error("[CHECK-GEMINI] Failed to parse models response JSON:", parseError)
          console.error("[CHECK-GEMINI] Models response text:", modelsText.substring(0, 500))
          return NextResponse.json({
            available: true,
            message: "Gemini APIキーは設定されていますが、レスポンスの解析に失敗しました",
            skipApiCheck: true,
            timestamp: new Date().toISOString()
          })
        }
      } catch (textError) {
        console.error("[CHECK-GEMINI] Failed to read models response text:", textError)
        return NextResponse.json({
          available: true,
          message: "Gemini APIキーは設定されていますが、レスポンスの読み取りに失敗しました",
          skipApiCheck: true,
          timestamp: new Date().toISOString()
        })
      }
      
      console.log("[CHECK-GEMINI] Available models:", modelsData.models?.length || 0)

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
          timestamp: new Date().toISOString()
        })
      }

      console.log("[CHECK-GEMINI] Using model for test:", modelToUse)

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
      console.log("[CHECK-GEMINI] Content generation response status:", response.status)

      if (response.ok) {
        console.log("[CHECK-GEMINI] Gemini API connection successful")
        return NextResponse.json({
          available: true,
          message: "Gemini APIは利用可能です",
          testedConnection: true,
          modelUsed: modelToUse,
          availableModels: modelNames,
          timestamp: new Date().toISOString()
        })
      } else {
        let errorData = {}
        try {
          errorData = await response.json()
        } catch (parseError) {
          console.error("[CHECK-GEMINI] Failed to parse content generation error response:", parseError)
          errorData = { parseError: "Failed to parse response as JSON" }
        }
        
        console.error("[CHECK-GEMINI] Gemini API error:", response.status, errorData)

        if (response.status === 503) {
          return NextResponse.json({
            available: false,
            temporary: true,
            message: "Gemini APIは一時的に利用できません。しばらく後にお試しください。",
            error: errorData,
            timestamp: new Date().toISOString()
          })
        }

        return NextResponse.json({
          available: false,
          message: `Gemini APIエラー: ${response.status}`,
          error: errorData,
          timestamp: new Date().toISOString()
        })
      }
    } catch (apiError: any) {
      console.error("[CHECK-GEMINI] Gemini API request failed:", apiError)

      if (apiError.message === "Request timeout" || String(apiError).includes("timeout")) {
        return NextResponse.json({
          available: true,
          message: "Gemini APIキーが設定されていますが、応答が遅いです",
          skipApiCheck: true,
          timeout: true,
          timestamp: new Date().toISOString()
        })
      }

      return NextResponse.json({
        available: true,
        message: "Gemini APIへの接続に問題がありますが、キーは設定されています",
        warning: String(apiError),
        skipApiCheck: true,
        timestamp: new Date().toISOString()
      })
    }
  } catch (error: any) {
    console.error("[CHECK-GEMINI] Gemini API check error:", error)
    
    // 安全なエラーレスポンス
    const errorResponse = {
      available: true,
      message: "Gemini APIキーは設定されていますが、チェック中にエラーが発生しました",
      warning: error instanceof Error ? error.message : String(error),
      skipApiCheck: true,
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(errorResponse)
  }
}
