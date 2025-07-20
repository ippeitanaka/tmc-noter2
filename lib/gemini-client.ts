import { generateMinutesRuleBased } from "./rule-based-minutes"
import { parseMinutesText } from "./parse-minutes"

// 超高精度議事録生成（notta レベル）
export async function generateMinutesWithGemini(
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
  console.log("🚀 Starting enhanced Gemini minutes generation")
  
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error("❌ Gemini APIキーが設定されていません")
      throw new Error("Gemini APIキーが設定されていません")
    }

    // 事前品質チェック
    if (!transcript || transcript.trim().length < 10) {
      console.error("❌ 文字起こしが短すぎます")
      throw new Error("文字起こしが短すぎます")
    }

    console.log(`📊 Gemini transcript length: ${transcript.length} characters`)

    // スマートなトークン制限処理
    let processedTranscript = optimizeTranscriptForGemini(transcript)

    console.log(`📊 Transcript optimized: ${transcript.length} → ${processedTranscript.length} chars`)

    // 改善されたプロンプト構成
    const enhancedPrompt = buildEnhancedPrompt(userPrompt, processedTranscript)
    
    console.log("🔗 Calling Gemini API...")
    
    // ロバストな API 呼び出し
    const result = await executeGeminiAPIWithRetry(processedTranscript, apiKey, enhancedPrompt)
    
    console.log("✅ Gemini minutes generation successful")
    return result
  } catch (error) {
    console.error("❌ Gemini minutes generation failed:", error)
    throw error // エラーを再投げして上位でハンドリング
  }
}

// スマートなトランスクリプト最適化
function optimizeTranscriptForGemini(transcript: string): string {
  console.log("🔧 Optimizing transcript for Gemini")
  
  // トークン推定（日本語特化）
  const estimatedTokens = Math.ceil(transcript.length * 1.2) // 日本語のより正確な推定
  const maxTokens = 15000 // Gemini-1.5-flash の制限に基づく
  
  if (estimatedTokens <= maxTokens) {
    return transcript
  }
  
  console.log(`📏 Transcript too long: ${estimatedTokens} tokens, max: ${maxTokens}`)
  
  // 重要度ベースの切り詰め
  const sentences = transcript.split(/[。！？\n]/).filter(s => s.trim().length > 3)
  
  // 重要度スコアリング
  const scoredSentences = sentences.map(sentence => {
    let score = sentence.length * 0.1 // 基本スコア
    
    // 重要語彙によるスコア加算
    const importantKeywords = [
      '決定', '決まり', '合意', '承認', '了承',
      '必要', 'べき', '予定', '今後', '次回',
      'さん', '様', '氏', // 人名指示
      '予算', '費用', 'コスト', '金額',
      'スケジュール', '日程', '期限'
    ]
    
    importantKeywords.forEach(keyword => {
      if (sentence.includes(keyword)) {
        score += 10
      }
    })
    
    // フィラーによるスコア減算
    const fillers = ['えー', 'あのー', 'そうですね', 'はいはい']
    fillers.forEach(filler => {
      if (sentence.includes(filler)) {
        score -= 5
      }
    })
    
    return { sentence, score }
  })
  
  // スコア順にソートして重要な部分を選択
  scoredSentences.sort((a, b) => b.score - a.score)
  
  let result = ''
  let tokenCount = 0
  
  for (const item of scoredSentences) {
    const sentenceTokens = item.sentence.length * 1.2
    if (tokenCount + sentenceTokens > maxTokens * 0.9) break // 90%で制限
    
    result += item.sentence + '。'
    tokenCount += sentenceTokens
  }
  
  console.log(`✂️ Smart truncation completed: ${tokenCount} estimated tokens`)
  
  return result + '\n\n（注：重要度に基づいて内容を選択・整理しています）'
}

// 強化されたプロンプト構築
function buildEnhancedPrompt(userPrompt: string, transcript: string): string {
  const enhancedUserPrompt = `${userPrompt}

## 追加品質要件（重要）
- 音声認識エラーを文脈から修正し、正確な内容を記録
- 曖昧な表現（「それ」「あれ」など）は具体的な内容に置き換え
- 人名・組織名・日程・数値は正確に抽出・記録
- 散発的な発言を論理的にまとめ、読みやすい構造で整理
- 重要な議論と雑談を区別し、核心的な内容に焦点
- 推測部分は明示的に「（推測）」と記載
- アクションアイテムには可能な限り担当者と期限を明記

## 品質保証チェック
1. 各セクションが具体的で有意義な内容になっているか
2. 音声認識エラーや不明瞭な部分が修正されているか
3. 読み手が会議の全体像を理解できる構成になっているか
4. 企業の正式文書として使用できる品質レベルに達しているか

## 必須出力構造（この形式を厳密に守ってください）

**会議名**: [内容から推測される具体的で分かりやすい会議名]
**開催日**: [特定された日付情報または「日時未特定」]
**参加者**: [発言者から特定される参加者名（役職があれば含める）]
**議題**: [討議された主要テーマを簡潔に]

**主要ポイント**:
1. [重要な議論・課題・報告事項1 - 具体的で詳細に]
2. [重要な議論・課題・報告事項2 - 数値や固有名詞を含む]
3. [重要な議論・課題・報告事項3 - 今後の方向性や計画]
4. [重要な議論・課題・報告事項4 - その他重要事項]
（重要度順に4-6個程度、各項目は簡潔だが具体的に）

**決定事項**:
[明確に合意・決定された内容のみ記載。推測や議論中の内容は含めない。決定がない場合は「継続審議」]

**アクションアイテム**:
1. [具体的なタスク] (担当: [担当者名])
2. [具体的なタスク] (担当: [担当者名])
（実際に割り当てられたタスクのみ記載。なければ「特になし」）

**次回会議予定**: [明確に言及された場合のみ記載。不明な場合は「未定」]

文字起こしデータ:
${transcript}`

  return enhancedUserPrompt
}

// ロバストなAPI実行（リトライ機能強化）
async function executeGeminiAPIWithRetry(
  transcript: string,
  apiKey: string,
  prompt: string,
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
  const maxRetries = 3
  const retryDelays = [1000, 2000, 4000] // 指数バックオフ
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Gemini API attempt ${attempt + 1}/${maxRetries + 1}`)
      
      // モデル選択の最適化
      const modelName = await selectOptimalGeminiModel(apiKey)
      console.log(`🤖 Using model: ${modelName}`)
      
      // API リクエスト実行
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/${modelName}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1, // 一貫性重視
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        
        // レート制限の特別処理
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : retryDelays[attempt] || 5000
          
          if (attempt < maxRetries) {
            console.warn(`⏳ Rate limited, waiting ${waitTime}ms before retry`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
        }
        
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      
      // レスポンス検証
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error("Invalid response structure from Gemini API")
      }

      const generatedText = data.candidates[0].content.parts[0].text
      
      if (!generatedText || generatedText.trim().length < 10) {
        throw new Error("Generated text is too short or empty")
      }

      console.log("📝 Gemini response received, parsing...")
      
      // 高精度パース処理
      const parsedMinutes = parseMinutesTextEnhanced(generatedText)
      
      // 品質検証
      validateMinutesQuality(parsedMinutes)
      
      return parsedMinutes
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt + 1} failed:`, error)
      
      if (attempt === maxRetries) {
        throw error
      }
      
      // リトライ前の待機
      const waitTime = retryDelays[attempt] || 2000
      console.log(`⏳ Waiting ${waitTime}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  throw new Error("Max retries exceeded")
}

// 最適なGeminiモデル選択
async function selectOptimalGeminiModel(apiKey: string): Promise<string> {
  try {
    console.log("🔍 Selecting optimal Gemini model")
    
    // モデルリストを取得
    const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`)
    
    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json()
      const availableModels = modelsData.models || []
      
      console.log(`📋 Found ${availableModels.length} available models`)
      
      // 優先順位: 高性能 → 軽量 → フォールバック
      const preferredModels = [
        'models/gemini-1.5-pro',     // 最高品質
        'models/gemini-1.5-flash',   // バランス
        'models/gemini-pro',         // 標準
      ]
      
      for (const preferred of preferredModels) {
        const found = availableModels.find((model: any) => 
          model.name === preferred && 
          model.supportedGenerationMethods?.includes('generateContent')
        )
        
        if (found) {
          console.log(`✅ Selected preferred model: ${preferred}`)
          return preferred
        }
      }
      
      // フォールバック：利用可能な最初のモデル
      for (const model of availableModels) {
        if (model.supportedGenerationMethods?.includes('generateContent')) {
          console.log(`⚠️ Fallback to available model: ${model.name}`)
          return model.name
        }
      }
    }
    
    // 最終フォールバック
    console.warn("⚠️ Using default fallback model")
    return 'models/gemini-pro'
    
  } catch (error) {
    console.warn("❌ Model selection failed, using default:", error)
    return 'models/gemini-pro'
  }
}

// 高精度パース処理
function parseMinutesTextEnhanced(text: string): {
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
  console.log("🔧 Enhanced parsing of Gemini response")
  
  try {
    // 基本パーサーでまず試行
    const basicResult = parseMinutesText(text)
    
    // 拡張パーシング処理
    const lines = text.split('\n')
    let enhancedResult = { ...basicResult }
    
    // より詳細なパターンマッチング
    const patterns = {
      meetingName: [/\*\*会議名\*\*[：:]\s*(.+)/i, /会議名[：:]\s*(.+)/i, /Meeting[：:]?\s*(.+)/i],
      date: [/\*\*開催日\*\*[：:]\s*(.+)/i, /開催日[：:]\s*(.+)/i, /日時[：:]\s*(.+)/i],
      participants: [/\*\*参加者\*\*[：:]\s*(.+)/i, /参加者[：:]\s*(.+)/i],
      agenda: [/\*\*議題\*\*[：:]\s*(.+)/i, /議題[：:]\s*(.+)/i],
      decisions: [/\*\*決定事項\*\*[：:]\s*(.+)/i, /決定事項[：:]\s*(.+)/i],
      todos: [/\*\*アクションアイテム\*\*[：:]\s*(.+)/i, /アクションアイテム[：:]\s*(.+)/i, /TODO[：:]\s*(.+)/i],
      nextMeeting: [/\*\*次回予定\*\*[：:]\s*(.+)/i, /次回[：:]\s*(.+)/i]
    }
    
    // パターンマッチングによる抽出
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue
      
      // 各フィールドのパターンチェック
      for (const [field, fieldPatterns] of Object.entries(patterns)) {
        for (const pattern of fieldPatterns) {
          const match = trimmedLine.match(pattern)
          if (match && match[1]?.trim()) {
            (enhancedResult as any)[field] = match[1].trim()
            break
          }
        }
      }
    }
    
    // 主要ポイントの抽出改善
    const mainPointsSection = text.match(/\*\*主要ポイント\*\*[：:]?\s*([\s\S]*?)(?:\*\*|$)/i)
    if (mainPointsSection) {
      const pointsText = mainPointsSection[1]
      const points = pointsText
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => line.match(/^\d+\.\s*/) || line.match(/^[-•]\s*/))
        .map(line => line.replace(/^\d+\.\s*|^[-•]\s*/, '').trim())
        .filter(line => line.length > 0)
      
      if (points.length > 0) {
        enhancedResult.mainPoints = points
      }
    }
    
    // 品質向上のための後処理
    enhancedResult = enhanceResultQuality(enhancedResult)
    
    console.log("✅ Enhanced parsing completed")
    return enhancedResult
    
  } catch (error) {
    console.warn("⚠️ Enhanced parsing failed, using basic parser:", error)
    return parseMinutesText(text)
  }
}

// 結果品質向上処理
function enhanceResultQuality(result: any): any {
  // 空文字列を適切なデフォルト値に置換
  if (!result.meetingName || result.meetingName.trim() === '') {
    result.meetingName = '会議（日時未特定）'
  }
  
  if (!result.date || result.date.trim() === '') {
    result.date = '日時未特定'
  }
  
  if (!result.participants || result.participants.trim() === '') {
    result.participants = '参加者未特定'
  }
  
  if (!result.agenda || result.agenda.trim() === '') {
    result.agenda = '議題未特定'
  }
  
  if (!result.decisions || result.decisions.trim() === '') {
    result.decisions = '決定事項なし'
  }
  
  if (!result.todos || result.todos.trim() === '') {
    result.todos = 'アクションアイテムなし'
  }
  
  // 主要ポイントの品質チェック
  if (!result.mainPoints || !Array.isArray(result.mainPoints) || result.mainPoints.length === 0) {
    result.mainPoints = ['主要ポイント未抽出']
  }
  
  return result
}

// 品質検証
function validateMinutesQuality(minutes: any): void {
  console.log("🔍 Validating minutes quality")
  
  const requiredFields = ['meetingName', 'date', 'participants', 'agenda', 'mainPoints', 'decisions', 'todos']
  const missingFields = []
  
  for (const field of requiredFields) {
    if (!minutes[field] || 
        (typeof minutes[field] === 'string' && minutes[field].trim() === '') ||
        (Array.isArray(minutes[field]) && minutes[field].length === 0)) {
      missingFields.push(field)
    }
  }
  
  if (missingFields.length > 0) {
    console.warn(`⚠️ Quality warning: missing or empty fields: ${missingFields.join(', ')}`)
  }
  
  // 主要ポイントの数チェック
  if (minutes.mainPoints && minutes.mainPoints.length < 2) {
    console.warn("⚠️ Quality warning: fewer than 2 main points extracted")
  }
  
  console.log("✅ Quality validation completed")
}
