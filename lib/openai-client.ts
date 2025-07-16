// OpenAI APIを使用するためのクライアント

// 議事録を生成する関数
export async function generateMinutesWithOpenAI(
  transcript: string,
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

    const prompt = `あなたは会議の議事録作成の専門家です。以下の文字起こしから、プロフェッショナルな議事録を作成してください。

【出力形式】
# 議事録

## 会議情報
- 会議名: [会議の名称を明確に]
- 開催日時: [日付と時間を正確に。言及がなければ現在の日付]
- 場所: [会議の場所。オンラインか対面か、言及があれば具体的な場所]
- 出席者: [参加者の氏名と役職/所属（わかる場合）]

## 議題
1. [議題1]
2. [議題2]
3. [議題3]
※議題は箇条書きで、明確に番号付けしてください

## 議事内容
### 議題1: [議題名]
- [重要な発言や議論の要点]
- [決定事項や合意点]

### 議題2: [議題名]
- [重要な発言や議論の要点]
- [決定事項や合意点]

## 決定事項
- [決定事項1]
- [決定事項2]
※決定した内容を明確に箇条書きで記載

## アクションアイテム
- [担当者名]: [タスク内容] (期限: [完了予定日])
- [担当者名]: [タスク内容]
※担当者と期限が明確な形で記載

## 次回会議
- 日時: [次回会議の日時。言及がなければ「未定」と記載]
- 場所: [次回会議の場所。言及がなければ「未定」と記載]
- 議題: [次回会議の予定議題。言及があれば記載]

## 備考
[特記事項や補足情報があれば記載]

【作成の際の注意点】
1. 議事録は第三者視点で客観的に記述してください
2. 「えー」「あの」などの無意味な発語、繰り返し、言い間違いは省略してください
3. 専門用語や略語は正確に記載してください
4. 決定事項とアクションアイテムは明確に区別してください
5. 会議の流れに沿って論理的に整理してください
6. 重要な数字や日付は正確に記載してください
7. 議論の結論や合意点を明確にしてください
8. 箇条書きを効果的に使用して読みやすくしてください
9. 必要に応じて見出しを追加して構造化してください
10. 議事録は簡潔かつ完全であるべきです

文字起こし:
${processedTranscript}`

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
            content: prompt,
          },
        ],
        temperature: 0.3, // より一貫性のある出力のために温度を下げる
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`OpenAI API error: ${response.status} ${JSON.stringify(errorData)}`)
    }

    const result = await response.json()
    const text = result.choices[0].message.content

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
