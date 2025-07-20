import { parseMinutesText } from "./parse-minutes"
import { generateMinutesRuleBased } from "./rule-based-minutes"

// 超高精度議事録生成（notta レベル）
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
  console.log("🚀 Starting simplified DeepSeek minutes generation")
  
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      console.error("❌ DeepSeek APIキーが設定されていません")
      throw new Error("DeepSeek APIキーが設定されていません")
    }

    // 事前品質チェック
    if (!transcript || transcript.trim().length < 10) {
      console.error("❌ 文字起こしが短すぎます")
      throw new Error("文字起こしが短すぎます")
    }

    console.log(`📊 DeepSeek transcript length: ${transcript.length} characters`)
    console.log("🔗 Calling DeepSeek API...")

    // 簡単なAPIコール（複雑なセグメント化は後で）
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "あなたは会議の議事録を作成する専門家です。プロフェッショナルで実用的な議事録を作成します。"
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    console.log(`� DeepSeek API response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ DeepSeek API error:", response.status, errorText)
      throw new Error(`DeepSeek API error: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log("📦 DeepSeek API response received")

    if (!result.choices || !result.choices[0] || !result.choices[0].message || !result.choices[0].message.content) {
      console.error("❌ Invalid DeepSeek response structure:", result)
      throw new Error("DeepSeek APIから予期しないレスポンス構造")
    }

    const text = result.choices[0].message.content
    console.log("📝 DeepSeek generated text preview:", text.substring(0, 300) + "...")

    // 議事録をパースして構造化
    const parsedResult = parseMinutesText(text)
    console.log("✅ DeepSeek minutes parsing completed")
    
    return parsedResult
    
  } catch (error) {
    console.error("❌ DeepSeek minutes generation failed:", error)
    throw error // エラーを再投げして上位でハンドリング
  }
}

// スマートなトランスクリプト最適化とセグメント化
function optimizeAndSegmentTranscript(transcript: string): string[] {
  console.log("🔧 Optimizing and segmenting transcript for DeepSeek")
  
  // DeepSeek-V3 の効率的な処理のための最適化
  const maxTokensPerSegment = 12000 // DeepSeek-V3 の効率的な処理範囲
  const estimatedTokens = Math.ceil(transcript.length * 1.3) // 日本語での正確な推定
  
  if (estimatedTokens <= maxTokensPerSegment) {
    console.log("📄 Single segment processing")
    return [transcript]
  }
  
  console.log(`📏 Large transcript detected: ${estimatedTokens} tokens, segmenting...`)
  
  // 意味的分割によるセグメント化
  const segments = performSemanticSegmentation(transcript, maxTokensPerSegment)
  
  console.log(`✂️ Created ${segments.length} semantic segments`)
  return segments
}

// 意味的分割
function performSemanticSegmentation(transcript: string, maxTokensPerSegment: number): string[] {
  const maxCharsPerSegment = Math.floor(maxTokensPerSegment / 1.3)
  
  // まず大きな話題区切りで分割を試行
  let segments = transcript.split(/\n\s*\n/).filter(s => s.trim().length > 10)
  
  // セグメントが長すぎる場合は更に分割
  const finalSegments: string[] = []
  
  for (const segment of segments) {
    if (segment.length <= maxCharsPerSegment) {
      finalSegments.push(segment)
    } else {
      // 長すぎるセグメントを文単位で分割
      const sentences = segment.split(/[。！？\n]/).filter(s => s.trim().length > 3)
      
      let currentSegment = ''
      for (const sentence of sentences) {
        const testSegment = currentSegment + sentence + '。'
        
        if (testSegment.length <= maxCharsPerSegment) {
          currentSegment = testSegment
        } else {
          if (currentSegment) {
            finalSegments.push(currentSegment)
          }
          currentSegment = sentence + '。'
        }
      }
      
      if (currentSegment) {
        finalSegments.push(currentSegment)
      }
    }
  }
  
  // 空のセグメントを除去
  return finalSegments.filter(s => s.trim().length > 10)
}

// マルチセグメント処理
async function processMultipleSegments(
  segments: string[], 
  apiKey: string, 
  userPrompt: string
): Promise<any[]> {
  console.log(`🔄 Processing ${segments.length} segments in parallel`)
  
  const results = []
  
  // 並列処理でパフォーマンス向上（ただしレート制限を考慮）
  const batchSize = 3 // DeepSeek のレート制限を考慮
  
  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize)
    const batchPromises = batch.map((segment, idx) => 
      processSegmentWithRetry(segment, apiKey, userPrompt, i + idx + 1, segments.length)
    )
    
    try {
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // バッチ間の短い待機（レート制限対策）
      if (i + batchSize < segments.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error)
      // エラーが発生したバッチは個別処理
      for (let j = 0; j < batch.length; j++) {
        try {
          const result = await processSegmentWithRetry(batch[j], apiKey, userPrompt, i + j + 1, segments.length)
          results.push(result)
        } catch (segmentError) {
          console.error(`❌ Segment ${i + j + 1} failed:`, segmentError)
          // エラーセグメントはスキップ
        }
      }
    }
  }
  
  return results
}

// セグメント処理（リトライ機能付き）
async function processSegmentWithRetry(
  segment: string, 
  apiKey: string, 
  userPrompt: string,
  segmentNumber: number,
  totalSegments: number
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
  const retryDelays = [1000, 2000, 4000]
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Processing segment ${segmentNumber}/${totalSegments}, attempt ${attempt + 1}`)
      
      // 強化されたプロンプト構築
      const enhancedPrompt = buildEnhancedSegmentPrompt(userPrompt, segment, segmentNumber, totalSegments)
      
      // API呼び出し
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-v3",
          messages: [
            {
              role: "system",
              content: `あなたは議事録作成の専門家です。notta と同等の高品質な議事録を作成します。

## 専門技能
- 会議内容の構造的理解と整理
- 重要ポイントの正確な抽出
- アクションアイテムの明確化
- 決定事項の的確な記録

## 品質基準
- 具体性と明確性を重視
- 曖昧な表現は避ける
- 推測は明示的に記載
- 実行可能なアクションアイテムを作成`
            },
            {
              role: "user",
              content: enhancedPrompt
            }
          ],
          temperature: 0.1, // 一貫性重視
          max_tokens: 4096,
          top_p: 0.8,
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        
        // レート制限の特別処理
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : retryDelays[attempt] || 5000
          
          if (attempt < maxRetries) {
            console.warn(`⏳ Rate limited on segment ${segmentNumber}, waiting ${waitTime}ms`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
        }
        
        throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      
      // レスポンス検証
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new Error("Invalid response structure from DeepSeek API")
      }

      const generatedText = data.choices[0].message.content
      
      if (!generatedText || generatedText.trim().length < 10) {
        throw new Error("Generated text is too short or empty")
      }

      console.log(`📝 Segment ${segmentNumber} processed successfully`)
      
      // 高精度パース処理
      const parsedMinutes = parseMinutesTextEnhanced(generatedText)
      
      // セグメント品質検証
      validateSegmentQuality(parsedMinutes, segmentNumber)
      
      return parsedMinutes
      
    } catch (error) {
      console.error(`❌ Segment ${segmentNumber} attempt ${attempt + 1} failed:`, error)
      
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

// 強化されたセグメントプロンプト構築
function buildEnhancedSegmentPrompt(
  userPrompt: string, 
  segment: string, 
  segmentNumber: number, 
  totalSegments: number
): string {
  let segmentContext = ""
  
  if (totalSegments > 1) {
    segmentContext = `
## セグメント処理情報
- 現在のセグメント: ${segmentNumber}/${totalSegments}
- 処理方針: このセグメントの内容を重点的に分析し、全体の文脈を考慮して議事録を作成

## セグメント特化指示
${segmentNumber === 1 ? "- 会議の開始部分として、基本情報（会議名、参加者、議題）を重点的に抽出" : ""}
${segmentNumber === totalSegments ? "- 会議の終了部分として、決定事項、アクションアイテム、次回予定を重点的に抽出" : ""}
${segmentNumber > 1 && segmentNumber < totalSegments ? "- 会議の中間部分として、議論内容と主要ポイントを重点的に抽出" : ""}
`
  }

  return `${userPrompt}

${segmentContext}

## 出力品質保証
以下の構造化されたフォーマットで返してください：

**会議名**: [具体的で分かりやすい会議名]
**開催日**: [抽出された日付情報]
**参加者**: [特定された参加者名（役職があれば含める）]
**議題**: [主要な討議内容]

**主要ポイント**:
1. [重要ポイント1]
2. [重要ポイント2]
3. [重要ポイント3]

**決定事項**:
[具体的な決定内容。決定されなかった場合は「継続議論」と記載]

**アクションアイテム**:
[実行すべき具体的なタスク。担当者・期限を含む。なければ「特になし」]

**次回予定**:
[次回会議の予定があれば記載]

文字起こしデータ:
${segment}`
}

// 高精度パース処理（DeepSeek用）
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
  try {
    // 基本パーサーでまず試行
    const basicResult = parseMinutesText(text)
    
    // DeepSeek特化の拡張パーシング
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
    enhancedResult = enhanceSegmentResultQuality(enhancedResult)
    
    return enhancedResult
    
  } catch (error) {
    console.warn("⚠️ Enhanced parsing failed, using basic parser:", error)
    return parseMinutesText(text)
  }
}

// セグメント結果品質向上
function enhanceSegmentResultQuality(result: any): any {
  // 空文字列を適切なデフォルト値に置換
  if (!result.meetingName || result.meetingName.trim() === '') {
    result.meetingName = '会議（タイトル未特定）'
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

// セグメント品質検証
function validateSegmentQuality(minutes: any, segmentNumber: number): void {
  console.log(`🔍 Validating segment ${segmentNumber} quality`)
  
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
    console.warn(`⚠️ Segment ${segmentNumber} quality warning: missing fields: ${missingFields.join(', ')}`)
  }
  
  console.log(`✅ Segment ${segmentNumber} quality validation completed`)
}

// セグメント結果マージ（高精度版）
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
  console.log(`🔗 Merging ${results.length} segment results`)
  
  if (results.length === 0) {
    return {
      meetingName: "会議（情報不足）",
      date: "日時未特定",
      participants: "参加者未特定",
      agenda: "議題未特定",
      mainPoints: ["議事内容を抽出できませんでした"],
      decisions: "決定事項なし",
      todos: "アクションアイテムなし",
      nextMeeting: "次回予定なし",
      meetingDetails: "",
    }
  }

  // 最も情報が豊富なセグメントから基本情報を取得
  const bestSegment = results.reduce((best, current) => {
    const bestScore = scoreSegmentCompleteness(best)
    const currentScore = scoreSegmentCompleteness(current)
    return currentScore > bestScore ? current : best
  })

  // 参加者の統合（重複除去と正規化）
  const allParticipants = new Set<string>()
  results.forEach((result) => {
    const participants = extractParticipants(result.participants)
    participants.forEach((p: string) => allParticipants.add(p))
  })

  // 主要ポイントの統合（セグメント情報付き）
  const mainPoints: string[] = []
  results.forEach((result, index) => {
    if (results.length > 1) {
      mainPoints.push(`【第${index + 1}部分】`)
    }
    
    if (Array.isArray(result.mainPoints)) {
      result.mainPoints.forEach((point: string) => {
        if (point && point.trim() !== '主要ポイント未抽出') {
          mainPoints.push(point)
        }
      })
    }
  })

  // 決定事項の統合
  const allDecisions = results
    .map((r) => r.decisions)
    .filter((d) => d && d !== "決定事項なし" && d !== "継続議論" && d.trim() !== '')
  
  // TODOの統合
  const allTodos = results
    .map((r) => r.todos)
    .filter((t) => t && t !== "アクションアイテムなし" && t.trim() !== '')

  // 次回会議情報は最後のセグメントから優先的に取得
  const nextMeeting = results
    .slice()
    .reverse()
    .find(r => r.nextMeeting && r.nextMeeting !== "次回予定なし")?.nextMeeting || "次回予定なし"

  const mergedResult = {
    meetingName: bestSegment.meetingName,
    date: bestSegment.date,
    participants: Array.from(allParticipants).join("、") || "参加者未特定",
    agenda: bestSegment.agenda,
    mainPoints: mainPoints.length > 0 ? mainPoints : ["主要ポイント未抽出"],
    decisions: allDecisions.length > 0 ? allDecisions.join("\n\n") : "決定事項なし",
    todos: allTodos.length > 0 ? allTodos.join("\n\n") : "アクションアイテムなし",
    nextMeeting,
    meetingDetails: `${results.length}セグメントから統合生成`,
  }

  console.log("✅ Segment merging completed successfully")
  return mergedResult
}

// セグメント完成度スコアリング
function scoreSegmentCompleteness(segment: any): number {
  let score = 0
  
  const fields = ['meetingName', 'date', 'participants', 'agenda', 'decisions', 'todos']
  const defaultValues = ['会議（', '未特定', '未特定', '未特定', 'なし', 'なし']
  
  fields.forEach((field, index) => {
    const value = segment[field] || ''
    if (value && !value.includes(defaultValues[index])) {
      score += 10
    }
  })
  
  // 主要ポイントの品質評価
  if (Array.isArray(segment.mainPoints) && segment.mainPoints.length > 0) {
    const validPoints = segment.mainPoints.filter((p: string) => 
      p && p.trim() !== '主要ポイント未抽出'
    )
    score += validPoints.length * 5
  }
  
  return score
}

// 参加者抽出の正規化
function extractParticipants(participantsText: string): string[] {
  if (!participantsText || participantsText === '参加者未特定') {
    return []
  }
  
  return participantsText
    .split(/[、,、]/)
    .map(p => p.trim())
    .filter(p => p.length > 0 && p !== '参加者未特定')
}
