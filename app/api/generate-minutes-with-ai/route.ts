import { NextResponse } from "next/server"
import { generateMinutesWithGemini } from "@/lib/gemini-client"
import { generateMinutesWithDeepSeek } from "@/lib/deepseek-client"
import { generateMinutesRuleBased } from "@/lib/rule-based-minutes"

// ユーザー指定のプロンプト - 超高精度議事録生成のための最適化プロンプト
const USER_SPECIFIED_PROMPT = `あなたは世界トップクラスの議事録作成の専門家です。20年以上の経験を持ち、Fortune 500企業の重要会議から学術会議まで、あらゆる種類の議事録を作成してきました。以下の文字起こしデータから、最高品質のプロフェッショナル議事録を作成してください。

## 🎯 ミッション: 完璧な議事録作成
**目標**: 読み手が会議の全体像を完全に理解し、次のアクションを明確に把握できる議事録

## 📋 必須出力フォーマット
**━━━ 会議情報 ━━━**
**会議名**: [会議の性質・目的を分析して適切に命名]
**開催日時**: [文中の日時情報を正確に抽出・整理]
**参加者**: [発言者・言及された人物を階層別に整理]
**会議目的**: [会議開催の背景・目的を2-3文で明確に記述]

**━━━ 議事内容 ━━━**
**1. [議題名]**
   📌 **現状・背景**
   - [現在の状況説明]
   
   💬 **主要発言・意見**
   - [発言者]: [発言内容の要点]
   - [発言者]: [発言内容の要点]
   
   ⚡ **論点・課題**
   - [争点となった内容]
   - [解決すべき課題]
   
   ✅ **方向性・合意内容**
   - [決定事項や方向性]

**2. [議題名]**
   [同様のフォーマットで継続]

**━━━ 決定・合意事項 ━━━**
✅ **確定事項**
- [番号] [具体的な決定内容] (関係者: [名前])

🔄 **継続検討事項**  
- [番号] [検討継続する内容] (担当: [名前], 期限: [日時])

**━━━ アクションプラン ━━━**
🎯 **実行項目**
- [ ] [具体的なタスク] (担当: [名前], 期限: [日時])
- [ ] [具体的なタスク] (担当: [名前], 期限: [日時])

📅 **今後の予定**
- [次回会議日程や重要な期限]

**━━━ 補足・特記事項 ━━━**
- [重要な背景情報や会議の雰囲気等]

## 🛠️ 高度処理アルゴリズム

### 1. **完全ノイズ除去**
- フィラー除去: 「えー」「あのー」「そうですね」「まあ」「ちょっと」
- 重複発言の統合・整理
- 不完全な発言の補完・修正

### 2. **人物・発言者の正規化**
- 呼び方の統一: 「田中さん」「田中先生」→「田中氏」
- 役職・立場の明確化
- 発言の重要度による重み付け

### 3. **文脈の完全理解**
- 前後の発言から意図を推測・補完
- 暗黙の前提条件を明示化
- 専門用語・略語の統一

### 4. **論理構造の再構築**
- 時系列と重要度のバランシング
- 因果関係の明確化
- 議論の流れの可視化

### 5. **実務価値の最大化**
- アクションアイテムの明確な抽出
- 責任者・期限の特定
- 優先順位の設定

## ⚠️ 品質保証基準
- **正確性**: 推測は最小限、事実ベース記録
- **完全性**: 重要情報の漏れなし
- **明確性**: 曖昧さの完全排除
- **実用性**: 即座に活用可能な形式

## 📊 特別処理指針
- 数値・日時は正確に記録
- 専門用語は文脈に応じて説明
- 感情的な発言も客観的に記録
- 複雑な議論は図式的に整理

以下が文字起こしデータです。最高品質の議事録を作成してください:`

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
