import { generateMinutesRuleBased } from "./rule-based-minutes"
import { parseMinutesText } from "./parse-minutes"

// 議事録を生成する関数
export async function generateMinutesWithGemini(
  transcript: string,
  userPrompt: string,
): Promise<{
  meetingName: string
  date: string
  participants: string
  agenda: string
  mainPoints: string[]
  decisions: string
  todos: string
  nextMeeting?: string
  meetingDetails?: string
}> {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error("Gemini APIキーが設定されていません")
    }

    // 文字起こしが長すぎる場合は要約または短縮する
    let processedTranscript = transcript

    // トークン数を概算（日本語の場合、1文字あたり約1.5トークンと仮定）
    const estimatedTokens = Math.ceil(transcript.length * 1.5)
    const maxTokens = 10000 // 安全マージンを取って10000トークンに制限

    if (estimatedTokens > maxTokens) {
      console.log(
        `Transcript is too long (estimated ${estimatedTokens} tokens). Truncating to approximately ${maxTokens} tokens.`,
      )

      // 文字数ベースで切り詰める（日本語の場合、1トークンあたり約0.67文字と仮定）
      const maxChars = Math.floor(maxTokens / 1.5)
      processedTranscript = transcript.substring(0, maxChars)

      // 最後の文が途中で切れないように調整
      const lastSentenceBreak = processedTranscript.lastIndexOf("。")
      if (lastSentenceBreak > 0) {
        processedTranscript = processedTranscript.substring(0, lastSentenceBreak + 1)
      }

      // 切り詰めた旨を追加
      processedTranscript += "\n\n（注：文字起こしが長すぎるため、一部のみを処理しています）"
    }

    // ユーザー指定のプロンプトを使用
    const fullPrompt = userPrompt + processedTranscript
    console.log("Full prompt for Gemini API:", fullPrompt.substring(0, 200) + "...")

    const result = await generateMinutesWithUserPrompt(processedTranscript, apiKey, fullPrompt)
    return result
  } catch (error) {
    console.error("Minutes generation error:", error)
    // エラーが発生した場合はルールベースの生成にフォールバック
    console.warn("Falling back to rule-based minutes generation due to error")
    return generateMinutesRuleBased(transcript)
  }
}

// ユーザー指定のプロンプトを使用して議事録を生成する関数
async function generateMinutesWithUserPrompt(
  transcript: string,
  apiKey: string,
  fullPrompt: string,
): Promise<{
  meetingName: string
  date: string
  participants: string
  agenda: string
  mainPoints: string[]
  decisions: string
  todos: string
  nextMeeting?: string
  meetingDetails?: string
}> {
  console.log("Using user-specified prompt for Gemini API")

  // リトライ機能を追加
  const maxRetries = 2
  let retryCount = 0
  let lastError = null

  while (retryCount <= maxRetries) {
    try {
      // 利用可能なモデルを確認
      let modelName = "models/gemini-1.5-flash" // より軽量なモデルを優先（レート制限対策）

      try {
        // モデルリストを取得
        const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json()
          const availableModels = modelsData.models || []

          // 適切なモデルを選択（優先順位: gemini-1.5-flash > gemini-1.5-pro > その他）
          let foundFlash = false

          for (const model of availableModels) {
            if (model.name.includes("gemini-1.5-flash")) {
              modelName = model.name
              foundFlash = true
              break
            }
          }

          // flashが見つからない場合は、proを探す
          if (!foundFlash) {
            for (const model of availableModels) {
              if (model.name.includes("gemini-1.5-pro")) {
                modelName = model.name
                break
              }
            }
          }

          // 適切なモデルが見つからない場合は他のgemini-1.5モデルを探す
          if (!modelName) {
            for (const model of availableModels) {
              if (model.name.includes("gemini-1.5")) {
                modelName = model.name
                break
              }
            }
          }

          // 適切なモデルが見つからない場合は最初のモデルを使用
          if (!modelName && availableModels.length > 0) {
            modelName = availableModels[0].name
          }
        }
      } catch (error) {
        console.warn("Failed to get models list, using default model name:", error)
        // エラーが発生した場合はデフォルトのモデル名を使用
      }

      console.log(`Using model: ${modelName}`)

      // リトライ間の遅延を追加（レート制限対策）
      if (retryCount > 0) {
        const delayMs = Math.pow(2, retryCount) * 1000 // 指数バックオフ: 2秒、4秒、...
        console.log(`Retry ${retryCount}/${maxRetries}: Waiting ${delayMs}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }

      // Google Gemini APIを呼び出す
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: fullPrompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1, // 議事録の精度向上のため、より低い温度設定
              topK: 1, // 最も確率の高い選択肢を重視
              topP: 0.8, // ある程度の多様性を保持
              maxOutputTokens: 4096, // より長い議事録に対応
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE",
              },
            ],
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // レート制限エラーの場合は特別な処理
        if (response.status === 429) {
          console.warn("Rate limit exceeded for Gemini API")

          // レスポンスからリトライ遅延情報を取得
          let retryDelay = 0
          try {
            const retryInfo = errorData.error?.details?.find((d: any) => d["@type"]?.includes("RetryInfo"))
            if (retryInfo && retryInfo.retryDelay) {
              // "5s" のような形式から数値を抽出
              const delayStr = retryInfo.retryDelay
              retryDelay = Number.parseInt(delayStr.replace(/[^0-9]/g, "")) * 1000
              console.log(`API suggested retry delay: ${retryDelay}ms`)
            }
          } catch (e) {
            console.error("Error parsing retry delay:", e)
          }

          // リトライ回数が上限に達していない場合は、次のリトライで使用する遅延を設定
          if (retryCount < maxRetries) {
            retryCount++
            // APIが提案する遅延があればそれを使用、なければデフォルトの遅延
            const delayToUse = retryDelay > 0 ? retryDelay : Math.pow(2, retryCount) * 1000
            console.log(`Will retry in ${delayToUse}ms (retry ${retryCount}/${maxRetries})`)
            await new Promise((resolve) => setTimeout(resolve, delayToUse))
            continue
          }
        }

        // 503エラーの場合は即座にルールベースにフォールバック
        if (response.status === 503) {
          console.warn("Gemini API is temporarily unavailable (503 error), falling back to rule-based generation")
          return generateMinutesRuleBased(transcript)
        }

        throw new Error(`Gemini API error: ${response.status} ${JSON.stringify(errorData)}`)
      }

      // レスポンステキストの安全な取得
      let responseText: string;
      try {
        responseText = await response.text()
        console.log("Gemini API response text length:", responseText.length)
      } catch (textError) {
        console.error("Failed to read Gemini response text:", textError)
        throw new Error(`Gemini APIレスポンステキストの読み取りに失敗: ${textError}`)
      }

      // 空のレスポンスチェック
      if (!responseText || responseText.trim() === '') {
        console.error("Empty response from Gemini API")
        throw new Error("Gemini APIから空のレスポンスが返されました")
      }

      // JSON解析
      let result: any;
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error("Failed to parse Gemini JSON response:", parseError)
        console.error("Gemini response text:", responseText.substring(0, 1000))
        throw new Error(`Gemini APIレスポンスのJSON解析に失敗: ${parseError}`)
      }

      // レスポンスの構造を確認
      if (
        !result.candidates ||
        !result.candidates[0] ||
        !result.candidates[0].content ||
        !result.candidates[0].content.parts ||
        !result.candidates[0].content.parts[0]
      ) {
        console.error("Unexpected Gemini API response structure:", result)
        throw new Error("Gemini APIから予期しないレスポンス構造が返されました")
      }

      const text = result.candidates[0].content.parts[0].text
      if (!text || typeof text !== 'string') {
        console.error("Invalid text content in Gemini response:", text)
        throw new Error("Gemini APIレスポンスに有効なテキストが含まれていません")
      }

      console.log("Gemini API response:", text.substring(0, 200) + "...")

      // 議事録をパースして構造化
      return parseMinutesText(text)
    } catch (error) {
      lastError = error
      retryCount++
      console.warn(`API call failed, retry ${retryCount}/${maxRetries}:`, error)

      // 最後のリトライでも失敗した場合はルールベースにフォールバック
      if (retryCount > maxRetries) {
        console.warn("All retries failed, falling back to rule-based generation")
        return generateMinutesRuleBased(transcript)
      }

      // リトライ前に少し待機（指数バックオフ）
      const delayMs = Math.pow(2, retryCount) * 1000
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  // ここには到達しないはずだが、念のため
  throw lastError
}
