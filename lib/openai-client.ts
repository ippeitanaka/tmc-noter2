// OpenAI APIを使用するためのクライアント

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

    // 議事録をパースして構造化
    return parseMinutesText(text)
  } catch (error) {
    console.error("Minutes generation error:", error)
    throw error
  }
}

// テキストから議事録の構造を抽出する関数
function parseMinutesText(text: string): {
  meetingName: string
  date: string
  participants: string
  agenda: string
  mainPoints: string[]
  decisions: string
  todos: string
  nextMeeting?: string
  meetingDetails?: string
} {
  // 会議名を抽出
  const meetingNameMatch =
    text.match(/会議名:?\s*(.+?)(?:\n|$)/i) ||
    text.match(/# (.+?)(?:\n|$)/i) ||
    text.match(/## 会議情報[\s\S]*?会議名:?\s*(.+?)(?:\n|$)/i)
  const meetingName = meetingNameMatch ? meetingNameMatch[1].trim() : "会議"

  // 日時を抽出
  const dateMatch = text.match(/開催日時:?\s*(.+?)(?:\n|$)/i) || text.match(/日時:?\s*(.+?)(?:\n|$)/i)
  const date = dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString()

  // 参加者を抽出
  const participantsMatch = text.match(/出席者:?\s*([\s\S]*?)(?=##|場所:|議題:|$)/i)
  const participants = participantsMatch ? participantsMatch[1].trim() : "不明"

  // 議題を抽出
  const agendaMatch = text.match(/## 議題\s*([\s\S]*?)(?=##|$)/i)
  let agenda = ""
  if (agendaMatch) {
    agenda = agendaMatch[1].trim()
  } else {
    const agendaLineMatch = text.match(/議題:?\s*(.+?)(?:\n|$)/i)
    agenda = agendaLineMatch ? agendaLineMatch[1].trim() : "不明"
  }

  // 議事内容から主な発言を抽出
  const contentMatch = text.match(/## 議事内容\s*([\s\S]*?)(?=## 決定事項|## アクション|$)/i)
  let mainPoints: string[] = []
  if (contentMatch) {
    mainPoints = contentMatch[1]
      .split(/\n+/)
      .filter((line) => line.trim().startsWith("-") || line.trim().startsWith("・"))
      .map((point) => point.replace(/^[・-]\s*/, "").trim())
      .filter((point) => point.length > 0)
  }

  // 決定事項を抽出
  const decisionsMatch = text.match(/## 決定事項\s*([\s\S]*?)(?=## アクション|## 次回|$)/i)
  const decisions = decisionsMatch ? decisionsMatch[1].trim() : "特になし"

  // TODOを抽出
  const todosMatch = text.match(/## アクションアイテム\s*([\s\S]*?)(?=## 次回|## 備考|$)/i)
  const todos = todosMatch ? todosMatch[1].trim() : "特になし"

  // 次回の会議日程を抽出
  const nextMeetingMatch = text.match(/## 次回会議\s*([\s\S]*?)(?=## 備考|$)/i)
  const nextMeeting = nextMeetingMatch ? nextMeetingMatch[1].trim() : "未定"

  // 会議詳細を抽出
  const meetingDetailsMatch = text.match(/## 備考\s*([\s\S]*?)$/i)
  const meetingDetails = meetingDetailsMatch ? meetingDetailsMatch[1].trim() : ""

  return {
    meetingName,
    date,
    participants,
    agenda,
    mainPoints,
    decisions,
    todos,
    nextMeeting,
    meetingDetails,
  }
}
