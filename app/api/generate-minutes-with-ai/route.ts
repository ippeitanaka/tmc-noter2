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
  console.log("[SERVER] Minutes generation request received at:", new Date().toISOString())
  
  try {
    // リクエストボディの安全な解析
    let requestData
    try {
      const body = await req.text()
      console.log("[SERVER] Request body length:", body.length)
      
      if (!body || body.trim() === '') {
        console.error("[SERVER] Empty request body")
        return NextResponse.json(
          { 
            error: "リクエストボディが空です",
            details: "有効なJSONデータを送信してください",
            timestamp: new Date().toISOString()
          }, 
          { status: 400 }
        )
      }
      
      requestData = JSON.parse(body)
    } catch (parseError) {
      console.error("[SERVER] Failed to parse request body:", parseError)
      return NextResponse.json(
        { 
          error: "リクエストデータの解析に失敗しました",
          details: parseError instanceof Error ? parseError.message : String(parseError),
          timestamp: new Date().toISOString()
        }, 
        { status: 400 }
      )
    }

    const { transcript, model } = requestData

    if (!transcript) {
      console.warn("[SERVER] No transcript provided")
      return NextResponse.json({ 
        error: "文字起こしデータがありません",
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    if (typeof transcript !== 'string' || transcript.trim() === '') {
      console.warn("[SERVER] Invalid transcript provided")
      return NextResponse.json({ 
        error: "有効な文字起こしデータがありません",
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    if (!model) {
      console.warn("[SERVER] No model specified, defaulting to gemini")
    }

    console.log(`[SERVER] Generating minutes using ${model || 'gemini'} model`)
    console.log(`[SERVER] Transcript length: ${transcript.length} characters`)

    let minutes
    let usedModel = model || "gemini"
    let fallbackReason = null

    // APIキーの事前チェック
    const hasGeminiKey = !!process.env.GEMINI_API_KEY
    const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY
    
    console.log("[SERVER] API Keys available:", { gemini: hasGeminiKey, deepseek: hasDeepSeekKey })

    // どのAPIキーも利用できない場合は早期にルールベースへ
    if (!hasGeminiKey && !hasDeepSeekKey) {
      console.warn("[SERVER] No API keys available, using rule-based generation")
      usedModel = "rule-based"
      minutes = generateMinutesRuleBased(transcript)
      fallbackReason = "NO_API_KEYS"
    } else {
      try {
        // モデルに基づいて適切なAPIを使用
        if (usedModel === "gemini") {
          // Gemini APIキーが設定されているか確認
          if (!hasGeminiKey) {
            console.warn("[SERVER] Gemini API key is not set, checking if other models are available")
            fallbackReason = "API_KEY_MISSING"

            // Geminiが使えない場合はDeepSeekを試す
            if (hasDeepSeekKey) {
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
              if (hasDeepSeekKey) {
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
        } else if (usedModel === "deepseek") {
          // DeepSeek APIキーが設定されているか確認
          if (!hasDeepSeekKey) {
            console.warn("[SERVER] DeepSeek API key is not set, checking if other models are available")
            fallbackReason = "API_KEY_MISSING"

            // DeepSeekが使えない場合はGeminiを試す
            if (hasGeminiKey) {
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
              if (hasGeminiKey) {
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
          console.warn(`[SERVER] Unknown model: ${usedModel}, using rule-based generation`)
          usedModel = "rule-based"
          minutes = generateMinutesRuleBased(transcript)
        }
      } catch (outerError) {
        console.error("[SERVER] Outer try-catch error:", outerError)
        // 最終的なフォールバック
        usedModel = "rule-based"
        minutes = generateMinutesRuleBased(transcript)
        fallbackReason = "UNEXPECTED_ERROR"
      }
    }    // 結果の検証
    if (!minutes) {
      console.error("[SERVER] Minutes generation returned null or undefined")
      return NextResponse.json(
        {
          error: "議事録の生成に失敗しました",
          details: "生成結果が空です",
          usedModel: "rule-based",
          fallbackReason: "GENERATION_FAILED",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

    // 議事録オブジェクトの構造を検証
    const requiredFields = ['meetingName', 'date', 'participants', 'agenda', 'mainPoints', 'decisions', 'todos'];
    const missingFields = requiredFields.filter(field => !(field in minutes));
    
    if (missingFields.length > 0) {
      console.warn("[SERVER] Minutes object missing required fields:", missingFields);
      // 不足しているフィールドをデフォルト値で補完
      const defaultValues: any = {
        meetingName: "会議",
        date: new Date().toLocaleDateString('ja-JP'),
        participants: "不明",
        agenda: "会議内容",
        mainPoints: [],
        decisions: "継続議論",
        todos: "特になし",
        nextMeeting: "",
        meetingDetails: ""
      };
      
      missingFields.forEach(field => {
        (minutes as any)[field] = defaultValues[field];
      });
    }

    console.log("[SERVER] Minutes generation completed successfully")
    console.log("[SERVER] Used model:", usedModel)
    console.log("[SERVER] Minutes structure validated")
    
    // 安全なレスポンスオブジェクトを作成
    const response = {
      minutes: {
        meetingName: String(minutes.meetingName || "会議"),
        date: String(minutes.date || new Date().toLocaleDateString('ja-JP')),
        participants: String(minutes.participants || "不明"),
        agenda: String(minutes.agenda || "会議内容"),
        mainPoints: Array.isArray(minutes.mainPoints) ? minutes.mainPoints.map(String) : [],
        decisions: String(minutes.decisions || "継続議論"),
        todos: String(minutes.todos || "特になし"),
        nextMeeting: String(minutes.nextMeeting || ""),
        meetingDetails: String(minutes.meetingDetails || "")
      },
      usedModel: String(usedModel || "rule-based"),
      requestedModel: String(model || "gemini"),
      fallbackReason: fallbackReason || null,
      timestamp: new Date().toISOString(),
      success: true
    }
    
    // レスポンスが有効なJSONであることを確認
    try {
      const jsonString = JSON.stringify(response)
      console.log("[SERVER] Response JSON size:", jsonString.length, "bytes")
      
      // JSONが有効かテスト
      JSON.parse(jsonString)
      console.log("[SERVER] Response validation successful")
      
      return NextResponse.json(response)
    } catch (jsonError) {
      console.error("[SERVER] Failed to serialize response:", jsonError)
      console.error("[SERVER] Problematic response object:", response)
      
      // 最小限の安全なレスポンス
      const fallbackResponse = {
        minutes: {
          meetingName: "会議",
          date: new Date().toLocaleDateString('ja-JP'),
          participants: "不明",
          agenda: "会議内容",
          mainPoints: ["議事録の生成中にエラーが発生しました"],
          decisions: "継続議論",
          todos: "特になし",
          nextMeeting: "",
          meetingDetails: ""
        },
        usedModel: "rule-based",
        requestedModel: model || "gemini",
        fallbackReason: "JSON_SERIALIZATION_ERROR",
        timestamp: new Date().toISOString(),
        success: false,
        warning: "レスポンスのシリアライゼーションに失敗したため、フォールバックレスポンスを返しています"
      }
      
      return NextResponse.json(fallbackResponse, { status: 200 })
    }
  } catch (error) {
    console.error("[SERVER] Minutes generation error:", error)
    
    // エラーの詳細ログ
    if (error instanceof Error) {
      console.error("[SERVER] Error name:", error.name)
      console.error("[SERVER] Error message:", error.message)
      console.error("[SERVER] Error stack:", error.stack)
    }
    
    // 安全なエラーレスポンス
    const errorResponse = {
      error: "議事録の生成中にエラーが発生しました",
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      fallbackMessage: "しばらく時間をおいて再試行してください。問題が続く場合はルールベース生成をお試しください。",
    }
    
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
