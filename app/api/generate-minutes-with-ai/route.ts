import { NextResponse } from "next/server"
import { generateMinutesWithGemini } from "@/lib/gemini-client"
import { generateMinutesWithDeepSeek } from "@/lib/deepseek-client"
import { generateMinutesRuleBased } from "@/lib/rule-based-minutes"

// ユーザー指定のプロンプト
const USER_SPECIFIED_PROMPT = `あなたは会議の内容を正確かつ簡潔にまとめるプロの議事録作成者です。
以下の文字起こしは雑談や感情的な発言も多く含まれていますが、それらを整理・取捨選択し、重要な議論の流れ、争点、合意点をわかりやすくまとめてください。

【出力形式】
■会議名（わからなければ「不明」などでOK）
■日時（不明なら「不明」でOK）
■参加者（発言から読み取れる人物を重複なく簡潔に記載）
■会議の目的（会話の流れから意図を推測してもOK）
■主な議論内容（時系列順に、箇条書きで重要な話題と争点をまとめる）
■決定事項（明確な合意があれば記載。なければ「継続議論」などでもOK）
■今後のアクション（担当者を明記できる場合は書く）

【ルール】
・話が混乱していても、できるだけ構造的に要点を再構成してください。
・繰り返し、言い間違い、雑談、感情的な表現は省いてください。
・人名のゆらぎは統一してください。
・結論が曖昧な場合でも「何が争点だったか」を明確に書いてください。

文字起こし:
`

export async function POST(req: Request) {
  try {
    const { transcript, model } = await req.json()

    if (!transcript) {
      return NextResponse.json({ error: "文字起こしデータがありません" }, { status: 400 })
    }

    console.log(`[SERVER] Generating minutes using ${model} model`)
    console.log(`[SERVER] Transcript length: ${transcript.length} characters`)

    let minutes
    let usedModel = model
    let fallbackReason = null

    // モデルに基づいて適切なAPIを使用
    if (model === "gemini") {
      // Gemini APIキーが設定されているか確認
      if (!process.env.GEMINI_API_KEY) {
        console.warn("[SERVER] Gemini API key is not set, checking if other models are available")
        fallbackReason = "API_KEY_MISSING"

        // Geminiが使えない場合はDeepSeekを試す
        if (process.env.DEEPSEEK_API_KEY) {
          console.log("[SERVER] Falling back to DeepSeek API")
          usedModel = "deepseek"
          minutes = await generateMinutesWithDeepSeek(transcript, USER_SPECIFIED_PROMPT)
        } else {
          // どれも使えない場合はルールベースにフォールバック
          console.log("[SERVER] Falling back to rule-based generation")
          usedModel = "rule-based"
          minutes = generateMinutesRuleBased(transcript)
        }
      } else {
        try {
          // Gemini APIを使用
          console.log("[SERVER] Using Gemini API for minutes generation")
          minutes = await generateMinutesWithGemini(transcript, USER_SPECIFIED_PROMPT)
        } catch (error) {
          console.error("[SERVER] Gemini minutes generation failed:", error)
          fallbackReason = "API_ERROR"

          // エラーメッセージからレート制限を検出
          const errorMsg = error instanceof Error ? error.message : String(error)
          if (errorMsg.includes("429") || errorMsg.includes("rate limit") || errorMsg.includes("quota")) {
            fallbackReason = "RATE_LIMIT"
          }

          // Geminiが失敗した場合はDeepSeekを試す
          if (process.env.DEEPSEEK_API_KEY) {
            console.log("[SERVER] Falling back to DeepSeek API due to Gemini error")
            try {
              usedModel = "deepseek"
              minutes = await generateMinutesWithDeepSeek(transcript, USER_SPECIFIED_PROMPT)
            } catch (deepseekError) {
              console.error("[SERVER] DeepSeek fallback failed:", deepseekError)
              // DeepSeekも失敗した場合はルールベースにフォールバック
              console.log("[SERVER] Falling back to rule-based generation")
              usedModel = "rule-based"
              minutes = generateMinutesRuleBased(transcript)
            }
          } else {
            // どれも使えない場合はルールベースにフォールバック
            console.log("[SERVER] Falling back to rule-based generation")
            usedModel = "rule-based"
            minutes = generateMinutesRuleBased(transcript)
          }
        }
      }
    } else if (model === "deepseek") {
      // DeepSeek APIキーが設定されているか確認
      if (!process.env.DEEPSEEK_API_KEY) {
        console.warn("[SERVER] DeepSeek API key is not set, checking if other models are available")
        fallbackReason = "API_KEY_MISSING"

        // DeepSeekが使えない場合はGeminiを試す
        if (process.env.GEMINI_API_KEY) {
          console.log("[SERVER] Falling back to Gemini API")
          usedModel = "gemini"
          minutes = await generateMinutesWithGemini(transcript, USER_SPECIFIED_PROMPT)
        } else {
          // どれも使えない場合はルールベースにフォールバック
          console.log("[SERVER] Falling back to rule-based generation")
          usedModel = "rule-based"
          minutes = generateMinutesRuleBased(transcript)
        }
      } else {
        try {
          // DeepSeek APIを使用
          console.log("[SERVER] Using DeepSeek API for minutes generation")
          minutes = await generateMinutesWithDeepSeek(transcript, USER_SPECIFIED_PROMPT)
        } catch (error) {
          console.error("[SERVER] DeepSeek minutes generation failed:", error)
          fallbackReason = "API_ERROR"

          // DeepSeekが失敗した場合はGeminiを試す
          if (process.env.GEMINI_API_KEY) {
            console.log("[SERVER] Falling back to Gemini API due to DeepSeek error")
            try {
              usedModel = "gemini"
              minutes = await generateMinutesWithGemini(transcript, USER_SPECIFIED_PROMPT)
            } catch (geminiError) {
              console.error("[SERVER] Gemini fallback failed:", geminiError)
              // Geminiも失敗した場合はルールベースにフォールバック
              console.log("[SERVER] Falling back to rule-based generation")
              usedModel = "rule-based"
              minutes = generateMinutesRuleBased(transcript)
            }
          } else {
            // どれも使えない場合はルールベースにフォールバック
            console.log("[SERVER] Falling back to rule-based generation")
            usedModel = "rule-based"
            minutes = generateMinutesRuleBased(transcript)
          }
        }
      }
    } else {
      // 未知のモデルの場合はルールベースを使用
      console.warn(`[SERVER] Unknown model: ${model}, using rule-based generation`)
      usedModel = "rule-based"
      minutes = generateMinutesRuleBased(transcript)
    }

    console.log("[SERVER] Minutes generation completed")
    return NextResponse.json({
      minutes,
      usedModel,
      requestedModel: model,
      fallbackReason,
    })
  } catch (error) {
    console.error("[SERVER] Minutes generation error:", error)
    return NextResponse.json(
      {
        error: "議事録の生成中にエラーが発生しました",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
