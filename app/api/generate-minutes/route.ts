import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { transcript } = await req.json()

    if (!transcript) {
      return NextResponse.json({ error: "文字起こしデータがありません" }, { status: 400 })
    }

    const prompt = `以下は会議の文字起こしです。この内容をもとに、わかりやすく簡潔な議事録を作成してください。
【出力形式】
・会議名
・日時
・参加者
・議題
・主な発言（箇条書き）
・決定事項
・TODO（可能なら担当者も）
※繰り返しや言い間違いを省略し、要点を整理してください。

文字起こし:
${transcript}`

    // OpenAI APIを直接使用
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "あなたは会議の議事録を作成する専門家です。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const text = result.choices[0].message.content

    // 議事録をパースして構造化
    const meetingName = text.match(/会議名[：:]\s*(.+)/)?.[1] || "会議"
    const date = text.match(/日時[：:]\s*(.+)/)?.[1] || new Date().toLocaleDateString()
    const participants = text.match(/参加者[：:]\s*(.+)/)?.[1] || "不明"
    const agenda = text.match(/議題[：:]\s*(.+)/)?.[1] || "不明"

    // 主な発言を抽出
    const mainPointsMatch = text.match(/主な発言[：:][\s\S]*?(?=決定事項|$)/i)
    const mainPointsText = mainPointsMatch ? mainPointsMatch[0] : ""
    const mainPoints = mainPointsText
      .replace(/主な発言[：:]/i, "")
      .split(/[\n・]/)
      .map((point) => point.trim())
      .filter((point) => point.length > 0)

    // 決定事項を抽出
    const decisionsMatch = text.match(/決定事項[：:][\s\S]*?(?=TODO|$)/i)
    const decisions = decisionsMatch ? decisionsMatch[0].replace(/決定事項[：:]/i, "").trim() : "特になし"

    // TODOを抽出
    const todosMatch = text.match(/TODO[：:][\s\S]*/i)
    const todos = todosMatch ? todosMatch[0].replace(/TODO[：:]/i, "").trim() : "特になし"

    return NextResponse.json({
      minutes: {
        meetingName,
        date,
        participants,
        agenda,
        mainPoints,
        decisions,
        todos,
      },
      rawText: text,
    })
  } catch (error) {
    console.error("Minutes generation error:", error)
    return NextResponse.json({ error: "議事録の生成中にエラーが発生しました" }, { status: 500 })
  }
}
