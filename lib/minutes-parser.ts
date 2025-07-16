// テキストから議事録の構造を抽出する関数
export function parseMinutesText(text: string): {
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
  console.log("Parsing minutes text:", text.substring(0, 200) + "...")

  // 会議名を抽出（複数のパターンに対応）
  const meetingNamePatterns = [
    /■会議名[：:]*\s*(.+?)(?:\n|$)/i,
    /会議名[：:]*\s*(.+?)(?:\n|$)/i,
    /^#\s*(.+?)(?:\n|$)/i,
    /^【(.+?)】(?:\n|$)/i,
    /^(.+?)(?:会議|ミーティング)(?:\n|$)/i,
  ]

  let meetingName = "会議"
  for (const pattern of meetingNamePatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 0) {
      meetingName = match[1].trim()
      break
    }
  }

  // 日時を抽出（複数のパターンに対応）
  const datePatterns = [
    /■日時[：:]*\s*(.+?)(?:\n|$)/i,
    /日時[：:]*\s*(.+?)(?:\n|$)/i,
    /開催日時[：:]*\s*(.+?)(?:\n|$)/i,
    /(\d{4}年\d{1,2}月\d{1,2}日\s*(?:\d{1,2}時\d{1,2}分)?)/,
    /(\d{1,2}月\d{1,2}日\s*(?:\d{1,2}時\d{1,2}分)?)/,
  ]

  let date = "不明"
  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 0) {
      date = match[1].trim()
      break
    }
  }

  // 参加者を抽出（複数のパターンに対応）
  const participantsPatterns = [
    /■参加者[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /参加者[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /出席者[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /メンバー[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
  ]

  let participants = "不明"
  for (const pattern of participantsPatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 0) {
      participants = match[1].trim()
      break
    }
  }

  // 会議の目的を抽出（複数のパターンに対応）
  const agendaPatterns = [
    /■会議の目的[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /会議の目的[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /議題[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /アジェンダ[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /目的[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
  ]

  let agenda = "不明"
  for (const pattern of agendaPatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 0) {
      agenda = match[1].trim()
      break
    }
  }

  // 主な議論内容を抽出（複数のパターンに対応）
  const mainPointsPatterns = [
    /■主な議論内容[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /主な議論内容[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /議事内容[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /議論内容[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /主な内容[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
  ]

  let mainPointsText = ""
  for (const pattern of mainPointsPatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 0) {
      mainPointsText = match[1].trim()
      break
    }
  }

  // 箇条書きを抽出
  let mainPoints: string[] = []
  if (mainPointsText) {
    // 箇条書きのパターンを検出
    const bulletPoints = mainPointsText.split(/\n+/).map((line) => line.trim())

    // 箇条書きの記号を統一
    mainPoints = bulletPoints
      .filter((line) => line.length > 0)
      .map((line) => {
        // 箇条書きの記号を削除して統一
        return line.replace(/^[・\-*\d+.\s]+/, "").trim()
      })
      .filter((line) => line.length > 0)
  }

  // 決定事項を抽出（複数のパターンに対応）
  const decisionsPatterns = [
    /■決定事項[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /決定事項[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /合意事項[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /結論[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
  ]

  let decisions = "継続議論"
  for (const pattern of decisionsPatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 0) {
      decisions = match[1].trim()
      break
    }
  }

  // 今後のアクションを抽出（複数のパターンに対応）
  const todosPatterns = [
    /■今後のアクション[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /今後のアクション[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /アクションアイテム[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /TODO[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /タスク[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
  ]

  let todos = "特になし"
  for (const pattern of todosPatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 0) {
      todos = match[1].trim()
      break
    }
  }

  // 次回会議の情報を抽出（複数のパターンに対応）
  const nextMeetingPatterns = [
    /■次回会議[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /次回会議[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /次回[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /次回予定[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
  ]

  let nextMeeting = "未定"
  for (const pattern of nextMeetingPatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 0) {
      nextMeeting = match[1].trim()
      break
    }
  }

  // 会議詳細を抽出（オプション）
  const meetingDetailsPatterns = [
    /■備考[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /備考[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /その他[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
    /補足[：:]*\s*([\s\S]*?)(?=\n■|$)/i,
  ]

  let meetingDetails = ""
  for (const pattern of meetingDetailsPatterns) {
    const match = text.match(pattern)
    if (match && match[1] && match[1].trim().length > 0) {
      meetingDetails = match[1].trim()
      break
    }
  }

  // 結果をログ出力
  console.log("Parsed minutes:", {
    meetingName,
    date,
    participants,
    agenda,
    mainPointsCount: mainPoints.length,
    decisions: decisions.substring(0, 50) + (decisions.length > 50 ? "..." : ""),
    todos: todos.substring(0, 50) + (todos.length > 50 ? "..." : ""),
  })

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
