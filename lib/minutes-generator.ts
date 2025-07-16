import type { AIModel } from "@/components/ai-model-selector"

// 議事録の型定義
export interface Minutes {
  meetingName: string
  date: string
  participants: string
  agenda: string
  mainPoints: string[]
  decisions: string
  todos: string
  nextMeeting?: string
  meetingDetails?: string
}

// クライアント側で使用する議事録生成関数
export async function generateMinutes(transcript: string, model: AIModel = "gemini"): Promise<Minutes> {
  try {
    console.log(`Generating minutes using ${model} model`)
    console.log(`Transcript length: ${transcript.length} characters`)

    // サーバーサイドAPIを呼び出す
    const response = await fetch("/api/generate-minutes-with-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transcript,
        model,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        `API error: ${response.status} ${response.statusText} - ${
          errorData.error || "Unknown error"
        } ${errorData.details || ""}`,
      )
    }

    const data = await response.json()
    return data.minutes
  } catch (error) {
    console.error("Minutes generation error:", error)
    throw error
  }
}

// ルールベースの議事録生成（APIキーがない場合やAPIエラー時のフォールバック）
function generateMinutesRuleBased(transcript: string): Minutes {
  // スピーカー分離を含む前処理
  const processedTranscript = preprocessTranscriptWithSpeakerDiarization(transcript)

  // 日付を抽出
  const dateMatch = processedTranscript.match(
    /(\d{4}年\d{1,2}月\d{1,2}日|令和\d{1,2}年\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/,
  )
  const date = dateMatch ? dateMatch[1] : "不明"

  // 参加者を抽出（スピーカー分離の結果を利用）
  const speakerMatches = processedTranscript.match(/【([^】]+)】/g)
  let participants = "不明"

  if (speakerMatches && speakerMatches.length > 0) {
    // 重複を除去して参加者リストを作成
    const uniqueSpeakers = [...new Set(speakerMatches.map((s) => s.replace(/【|】/g, "")))].filter((s) => s.length > 0)
    participants = uniqueSpeakers.join("、")
  }

  // 会議名を生成
  const meetingName = "会議メモ"

  // 主な発言を抽出（重要そうな文を選択）
  const sentences = processedTranscript.split(/。|\n/).filter((s) => s.trim().length > 10)

  // トピックを時系列で抽出（会話の流れに沿って）
  const mainPoints = extractTopicsChronologically(sentences)

  // 決定事項を抽出
  const decisionKeywords = ["決定", "決まり", "合意", "承認", "了承", "確認", "わかりました"]
  const decisionSentences = sentences.filter((sentence) =>
    decisionKeywords.some((keyword) => sentence.includes(keyword)),
  )
  const decisions = decisionSentences.length > 0 ? decisionSentences.join("\n") : "継続議論"

  // TODOを抽出
  const todoKeywords = [
    "必要",
    "べき",
    "予定",
    "今後",
    "次回",
    "確認する",
    "調査する",
    "検討する",
    "やります",
    "します",
  ]
  const todoSentences = sentences.filter((sentence) => todoKeywords.some((keyword) => sentence.includes(keyword)))
  const todos = todoSentences.length > 0 ? todoSentences.join("\n") : "特になし"

  // 次回の会議日程を抽出
  const nextMeeting = extractNextMeetingDate(processedTranscript)

  return {
    meetingName,
    date,
    participants,
    agenda: "会話の要約",
    mainPoints,
    decisions,
    todos,
    nextMeeting,
    meetingDetails: "",
  }
}

// スピーカー分離を含む文字起こしの前処理
function preprocessTranscriptWithSpeakerDiarization(transcript: string): string {
  // フィラーや無意味な表現を削除
  let processed = transcript
    .replace(
      /えー+と|えー+|あー+|うー+|んー+|あの+|その+|えっと+|まぁ+|ですね+|あのー|そのー|ええと|うーん|そうですね|なるほど|はいはい/g,
      " ",
    )
    .replace(/\s+/g, " ") // 連続する空白を1つにまとめる

  // スピーカー分離のパターンを検出して強調
  // 1. 名前+敬称のパターン
  processed = processed.replace(
    /([A-Za-z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{1,10})(さん|様|氏)[:：]?\s*/g,
    "\n【$1$2】 ",
  )

  // 2. 「〇〇です」のパターン
  processed = processed.replace(/([A-Za-z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{1,10})です[。、,.]/g, "\n【$1】 $&")

  // 3. 話者の交代を示す可能性のあるパターン
  const speakerChangePatterns = [
    /はい[、。]/g,
    /そうですね[、。]/g,
    /わかりました[、。]/g,
    /ありがとうございます[、。]/g,
    /すみません[、。]/g,
    /失礼します[、。]/g,
    /では[、。]/g,
    /じゃあ[、。]/g,
  ]

  speakerChangePatterns.forEach((pattern) => {
    processed = processed.replace(pattern, "\n$&")
  })

  // 4. 質問と回答のパターン
  processed = processed.replace(/([?？])\s*/g, "$1\n")

  // 文の区切りを明確にする
  processed = processed.replace(/([。．！？])\s*/g, "$1\n")

  // カッコ内の注釈を削除
  processed = processed.replace(/（.*?）|$$.*?$$/g, "")

  // 重複表現の削除（「〜〜、〜〜」のような繰り返し）
  const repeatedPhrasePattern = /(.{3,10})[、,](\s*\1)/g
  processed = processed.replace(repeatedPhrasePattern, "$1")

  return processed.trim()
}

// 時系列でトピックを抽出する関数
function extractTopicsChronologically(sentences: string[]): string[] {
  if (sentences.length === 0) return ["特に重要なトピックは検出されませんでした"]

  // 会話を5つ程度のセグメントに分割
  const segmentSize = Math.max(1, Math.ceil(sentences.length / 5))
  const segments: string[][] = []

  for (let i = 0; i < sentences.length; i += segmentSize) {
    segments.push(sentences.slice(i, i + segmentSize))
  }

  // 各セグメントから代表的な文を選択
  return segments
    .map((segment, index) => {
      // 最も長い文を選択（通常は情報量が多い）
      const representativeSentence = segment.reduce(
        (longest, current) => (current.length > longest.length ? current : longest),
        "",
      )

      if (representativeSentence.length > 0) {
        return `${index + 1}. ${representativeSentence.trim()}${representativeSentence.endsWith("。") ? "" : "。"}`
      }
      return ""
    })
    .filter((s) => s.length > 0)
}

// 次回の会議日程を抽出する関数
function extractNextMeetingDate(transcript: string): string {
  // 次回の会議に関する表現を探す
  const nextMeetingPatterns = [
    /次回[はの]([^。]+)に(開催|実施|予定|行[いう])/,
    /次回[はの]([^。]+)(に|で)(会議|ミーティング|打ち合わせ)/,
    /次回[はの]([0-9０-９]+)月([0-9０-９]+)日/,
    /次(の|は|回)([^。]*?)(予定|開催|実施|会議|ミーティング)/,
    /([0-9０-９]+)月([0-9０-９]+)日[にはが](次回|次の|次)/,
    /次回の日程[はが]([^。]+)/,
  ]

  for (const pattern of nextMeetingPatterns) {
    const match = transcript.match(pattern)
    if (match) {
      // マッチした部分の前後の文脈を取得
      const contextStart = Math.max(0, transcript.indexOf(match[0]) - 30)
      const contextEnd = Math.min(transcript.length, transcript.indexOf(match[0]) + match[0].length + 30)
      const context = transcript.substring(contextStart, contextEnd)

      // 日付らしき表現を抽出
      const datePattern =
        /(\d{1,4}年)?(\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2})([\s(（]?(\d{1,2}[:.：]\d{1,2}|午前|午後|[AP]M))?/g
      const dateMatches = [...context.matchAll(datePattern)]

      if (dateMatches.length > 0) {
        return dateMatches[0][0]
      }

      // 日付が見つからない場合は、マッチした文脈を返す
      return context.replace(/^[^次]+/, "").trim()
    }
  }

  return "未定"
}
