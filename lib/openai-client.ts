// OpenAI APIを使用するためのクライアント
import { parseMinutesText } from "./parse-minutes"

// 議事録を生成する関数
export async function generateMinutesWithOpenAI(
  transcript: string,
  prompt: string,
  model = "gpt-4o",
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
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OpenAI APIキーが設定されていません")
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

    // 受け取ったプロンプトを使用（文字起こしデータが既に含まれている）
    const finalPrompt = prompt

    console.log("Calling OpenAI API for minutes generation")
    console.log(`Processed transcript length: ${processedTranscript.length} characters`)
    console.log(`Using model: ${model}`)
    console.log("Prompt preview:", finalPrompt.substring(0, 300) + "...")
    console.log("Transcript preview:", processedTranscript.substring(0, 200) + "...")

    // OpenAI APIを呼び出す
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model, // 指定されたモデルを使用
        messages: [
          {
            role: "system",
            content: "あなたは会議の議事録を作成する専門家です。プロフェッショナルで実用的な議事録を作成します。",
          },
          {
            role: "user",
            content: finalPrompt,
          },
        ],
        temperature: 0.1, // 議事録の精度向上のため、より低い温度設定
        max_tokens: 4096, // より詳細な議事録に対応
      }),
    })

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json()
      } catch (parseError) {
        console.error("Failed to parse OpenAI error response:", parseError)
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} (エラー詳細の取得に失敗)`)
      }
      throw new Error(`OpenAI API error: ${response.status} ${JSON.stringify(errorData)}`)
    }

    // レスポンステキストの安全な取得
    let responseText: string;
    try {
      responseText = await response.text()
      console.log("OpenAI API response text length:", responseText.length)
    } catch (textError) {
      console.error("Failed to read OpenAI response text:", textError)
      throw new Error(`OpenAI APIレスポンステキストの読み取りに失敗: ${textError}`)
    }

    // 空のレスポンスチェック
    if (!responseText || responseText.trim() === '') {
      console.error("Empty response from OpenAI API")
      throw new Error("OpenAI APIから空のレスポンスが返されました")
    }

    // JSON解析
    let result: any;
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error("Failed to parse OpenAI JSON response:", parseError)
      console.error("OpenAI response text:", responseText.substring(0, 1000))
      throw new Error(`OpenAI APIレスポンスのJSON解析に失敗: ${parseError}`)
    }

    // レスポンス構造の検証
    if (!result.choices || !result.choices[0] || !result.choices[0].message || !result.choices[0].message.content) {
      console.error("Unexpected OpenAI API response structure:", result)
      throw new Error("OpenAI APIから予期しないレスポンス構造が返されました")
    }

    const text = result.choices[0].message.content
    if (!text || typeof text !== 'string') {
      console.error("Invalid text content in OpenAI response:", text)
      throw new Error("OpenAI APIレスポンスに有効なテキストが含まれていません")
    }

    console.log("OpenAI API response received successfully")
    console.log("Generated text preview:", text.substring(0, 500) + "...")

    // 議事録をパースして構造化
    return parseMinutesText(text)
  } catch (error) {
    console.error("Minutes generation error:", error)
    throw error
  }
}
