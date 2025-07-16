import { parseMinutesText } from "./parse-minutes"

// APIキーの取得
const getDeepSeekApiKey = (): string => {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.warn("DEEPSEEK_API_KEY is not set. Using demo mode with limited functionality.")
    return ""
  }
  return apiKey
}

// 議事録を生成する関数
export async function generateMinutesWithDeepSeek(
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
    const apiKey = getDeepSeekApiKey()

    // APIキーがない場合はルールベースの生成にフォールバック
    if (!apiKey) {
      console.warn("DeepSeek API key is not set, falling back to rule-based generation")
      throw new Error("DeepSeek APIキーが設定されていません")
    }

    // 長い文字起こしを分割して処理
    const segmentedMinutes = await processLongTranscript(transcript, apiKey, userPrompt)

    // 分割処理した結果がある場合はそれを返す
    if (segmentedMinutes) {
      return segmentedMinutes
    }

    // 分割処理しなかった場合（短い文字起こし）は通常処理
    return await generateMinutesForSegment(transcript, apiKey, userPrompt)
  } catch (error) {
    console.error("Minutes generation error:", error)
    // エラーが発生した場合は上位層でハンドリングするためにエラーを再スロー
    throw error
  }
}

// 長い文字起こしを分割して処理する関数
async function processLongTranscript(
  transcript: string,
  apiKey: string,
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
} | null> {
  // 文字数が一定以上の場合のみ分割処理
  if (transcript.length < 5000) {
    return null // 短い文字起こしは分割せず通常処理
  }

  console.log("Transcript is long, processing in segments...")

  // 文字起こしをセグメントに分割
  const segments = splitTranscriptIntoSegments(transcript)

  if (segments.length <= 1) {
    return null // 分割できなかった場合は通常処理
  }

  // 各セグメントを個別に処理
  const segmentResults = []
  for (let i = 0; i < segments.length; i++) {
    console.log(`Processing segment ${i + 1} of ${segments.length}...`)
    try {
      const segmentResult = await generateMinutesForSegment(segments[i], apiKey, userPrompt, i + 1, segments.length)
      segmentResults.push(segmentResult)
    } catch (error) {
      console.error(`Error processing segment ${i + 1}:`, error)
      // エラーが発生しても処理を続行
    }
  }

  // 結果をマージ
  return mergeSegmentResults(segmentResults)
}

// 文字起こしをセグメントに分割する関数
function splitTranscriptIntoSegments(transcript: string): string[] {
  // 文字起こしを段落や文で分割
  const paragraphs = transcript.split(/\n\s*\n/).filter((p) => p.trim().length > 0)

  // セグメントの最大文字数（約5000文字）
  const maxSegmentLength = 5000

  // セグメントを格納する配列
  const segments: string[] = []

  let currentSegment = ""

  for (const paragraph of paragraphs) {
    // 現在のセグメントに段落を追加した場合の長さをチェック
    if (currentSegment.length + paragraph.length + 1 <= maxSegmentLength) {
      // 追加しても最大長を超えない場合は追加
      currentSegment += (currentSegment ? "\n\n" : "") + paragraph
    } else {
      // 最大長を超える場合は新しいセグメントを開始
      if (currentSegment) {
        segments.push(currentSegment)
      }

      // 段落自体が最大長を超える場合は分割
      if (paragraph.length > maxSegmentLength) {
        // 文単位で分割
        const sentences = paragraph.split(/(?<=[。.！!？?])\s*/).filter((s) => s.trim().length > 0)

        currentSegment = ""
        for (const sentence of sentences) {
          if (currentSegment.length + sentence.length + 1 <= maxSegmentLength) {
            currentSegment += (currentSegment ? " " : "") + sentence
          } else {
            if (currentSegment) {
              segments.push(currentSegment)
            }
            currentSegment = sentence
          }
        }
      } else {
        currentSegment = paragraph
      }
    }
  }

  // 最後のセグメントを追加
  if (currentSegment) {
    segments.push(currentSegment)
  }

  return segments
}

// セグメント結果をマージする関数
function mergeSegmentResults(results: any[]): {
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
  if (results.length === 0) {
    return {
      meetingName: "会議",
      date: "不明",
      participants: "不明",
      agenda: "不明",
      mainPoints: ["議事内容を抽出できませんでした"],
      decisions: "特になし",
      todos: "特になし",
      nextMeeting: "未定",
      meetingDetails: "",
    }
  }

  // 最初のセグメントから基本情報を取得
  const meetingName = results[0].meetingName
  const date = results[0].date

  // 参加者を全セグメントからマージ（重複を除去）
  const allParticipants = new Set<string>()
  results.forEach((result) => {
    const participants = result.participants.split(/[、,、]/).map((p) => p.trim())
    participants.forEach((p) => {
      if (p && p !== "不明") {
        allParticipants.add(p)
      }
    })
  })
  const participants = Array.from(allParticipants).join("、")

  // 議題/目的を最初のセグメントから取得
  const agenda = results[0].agenda

  // 主な議論内容を全セグメントからマージ
  const mainPoints: string[] = []
  results.forEach((result, index) => {
    // セグメント番号を追加（オプション）
    if (results.length > 1) {
      mainPoints.push(`【セグメント ${index + 1}】`)
    }

    // 各セグメントの主要ポイントを追加
    result.mainPoints.forEach((point) => {
      mainPoints.push(point)
    })
  })

  // 決定事項を全セグメントからマージ
  const allDecisions = results.map((r) => r.decisions).filter((d) => d && d !== "特になし" && d !== "継続議論")
  const decisions = allDecisions.length > 0 ? allDecisions.join("\n\n") : "継続議論"

  // TODOを全セグメントからマージ
  const allTodos = results.map((r) => r.todos).filter((t) => t && t !== "特になし")
  const todos = allTodos.length > 0 ? allTodos.join("\n\n") : "特になし"

  // 次回会議情報は最後のセグメントから取得
  const nextMeeting = results[results.length - 1].nextMeeting

  return {
    meetingName,
    date,
    participants,
    agenda,
    mainPoints,
    decisions,
    todos,
    nextMeeting,
    meetingDetails: "",
  }
}

// 単一セグメントの議事録を生成する関数
async function generateMinutesForSegment(
  transcript: string,
  apiKey: string,
  userPrompt: string,
  segmentNumber?: number,
  totalSegments?: number,
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
  // トークン数を概算（日本語の場合、1文字あたり約1.5トークンと仮定）
  const estimatedTokens = Math.ceil(transcript.length * 1.5)
  const maxTokens = 10000 // 安全マージンを取って10000トークンに制限

  let processedTranscript = transcript

  if (estimatedTokens > maxTokens) {
    console.log(
      `Transcript segment is too long (estimated ${estimatedTokens} tokens). Truncating to approximately ${maxTokens} tokens.`,
    )

    // 文字数ベースで切り詰める（日本語の場合、1トークンあたり約0.67文字と仮定）
    const maxChars = Math.floor(maxTokens / 1.5)
    processedTranscript = processedTranscript.substring(0, maxChars)

    // 最後の文が途中で切れないように調整
    const lastSentenceBreak = processedTranscript.lastIndexOf("。")
    if (lastSentenceBreak > 0) {
      processedTranscript = processedTranscript.substring(0, lastSentenceBreak + 1)
    }

    // 切り詰めた旨を追加
    processedTranscript += "\n\n（注：文字起こしが長すぎるため、一部のみを処理しています）"
  }

  // セグメント情報を追加（複数セグメントの場合）
  let segmentInfo = ""
  if (segmentNumber !== undefined && totalSegments !== undefined) {
    segmentInfo = `\n\n【注意】これは長い会議の文字起こしを分割した第${segmentNumber}部分（全${totalSegments}部分）です。`
  }

  // ユーザー指定のプロンプトを使用
  const fullPrompt = userPrompt + processedTranscript + segmentInfo
  console.log("Full prompt for DeepSeek API:", fullPrompt.substring(0, 200) + "...")

  try {
    console.log("Using user-specified prompt for DeepSeek API")

    // DeepSeek APIを呼び出す
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v3", // DeepSeek-V3モデルを指定
        messages: [
          {
            role: "system",
            content: "あなたは会議の議事録を作成する専門家です。プロフェッショナルで実用的な議事録を作成します。",
          },
          {
            role: "user",
            content: fullPrompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`DeepSeek API error: ${response.status} ${JSON.stringify(errorData)}`)
    }

    const result = await response.json()
    const text = result.choices[0].message.content
    console.log("DeepSeek API response:", text.substring(0, 200) + "...")

    // 議事録をパースして構造化
    const parsedMinutes = parseMinutesText(text)
    return parsedMinutes
  } catch (error) {
    console.error("DeepSeek API call error:", error)
    // エラーが発生した場合は上位層でハンドリングするためにエラーを再スロー
    throw new Error(`DeepSeek APIエラー: ${error instanceof Error ? error.message : String(error)}`)
  }
}
