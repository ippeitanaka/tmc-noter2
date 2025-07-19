import { NextRequest, NextResponse } from 'next/server'
import { generateMinutesWithOpenAI } from '@/lib/openai-client'
import { generateMinutesWithGemini } from '@/lib/gemini-client'
import { generateMinutesWithDeepSeek } from '@/lib/deepseek-client'
import { generateMinutesRuleBased } from '@/lib/rule-based-minutes'

export async function POST(request: NextRequest) {
  console.log("🚀 高品質AI議事録生成を開始")
  
  try {
    const { transcript, userPrompt, provider = "gemini", language = "ja", model } = await request.json()
    
    if (!transcript || transcript.trim().length < 10) {
      return NextResponse.json(
        { error: "有効な文字起こしデータが必要です（10文字以上）" },
        { status: 400 }
      )
    }

    console.log(`📊 文字起こし処理開始: ${transcript.length}文字、言語: ${language}、優先プロバイダー: ${provider}`)

    // 高品質な議事録生成のための強化プロンプト
    const professionalPrompt = userPrompt || (language === 'ja' ? `
あなたは経験豊富な秘書として、以下の会議文字起こしからプロフェッショナルな議事録を作成してください。

## 品質要件
1. 会話の流れから重要な情報を正確に抽出
2. 決定事項と検討事項を明確に区別  
3. 具体的な数値・日程・担当者を漏れなく記録
4. 読み手が理解しやすい構造化された形式
5. あいまいな表現は避け、明確で簡潔な記述
6. 推測部分は明示的に「（推測）」と記載

## 必須出力形式
以下の構造で必ず出力してください：

**会議名**: [会議内容から推測される具体的で分かりやすい名称]
**開催日**: [特定できた日時情報または「日時未特定」]
**参加者**: [発言者から特定された参加者名（役職があれば含める）]
**議題**: [討議された主要なテーマを簡潔に]

**主要ポイント**:
1. [重要な議論・情報・課題1]
2. [重要な議論・情報・課題2]
3. [重要な議論・情報・課題3]
（最低3つ以上の重要ポイントを抽出）

**決定事項**:
[確定した内容。何も決定されなかった場合は「継続検討」と記載]

**アクションアイテム**:
[具体的なタスクと担当者・期限。なければ「特になし」と記載]

**次回予定**:
[次回会議予定があれば記載。なければ「未定」]

文字起こしデータ:
${transcript}

上記の文字起こしから、指定された形式で高品質な議事録を作成してください。
` : `
As an experienced secretary, please create professional meeting minutes from the following transcript.

## Quality Requirements
1. Accurately extract important information from conversation flow
2. Clearly distinguish between decisions and discussion points
3. Record specific numbers, dates, and responsible persons without omission
4. Use a structured format that is easy for readers to understand
5. Avoid ambiguous expressions, use clear and concise descriptions
6. Explicitly mark speculative parts as "(estimated)"

## Required Output Format
Please output in the following structure:

**Meeting Name**: [Specific and understandable name inferred from meeting content]
**Date**: [Identified date/time information or "Date not specified"]
**Participants**: [Participant names identified from speakers (include titles if available)]
**Agenda**: [Main themes discussed concisely]

**Key Points**:
1. [Important discussion/information/issue 1]
2. [Important discussion/information/issue 2]
3. [Important discussion/information/issue 3]
(Extract at least 3 or more important points)

**Decisions Made**:
[Confirmed content. If nothing was decided, write "Continued discussion"]

**Action Items**:
[Specific tasks with responsible persons and deadlines. If none, write "None"]

**Next Meeting**:
[Next meeting schedule if mentioned. If not, write "TBD"]

Transcript Data:
${transcript}

Please create high-quality meeting minutes from the above transcript in the specified format.
`)

    // スマートプロバイダー選択（優先順位付きフォールバック）
    const providerPriority = getProviderPriority(provider)
    let result = null
    let lastError = null

    console.log(`🔄 プロバイダー試行順序: ${providerPriority.join(' → ')}`)

    // 各プロバイダーを順番に試行
    for (const currentProvider of providerPriority) {
      try {
        console.log(`🤖 ${currentProvider}で議事録生成を試行中...`)
        
        switch (currentProvider) {
          case 'gemini':
            result = await generateMinutesWithGemini(transcript, professionalPrompt)
            break
          case 'deepseek':
            result = await generateMinutesWithDeepSeek(transcript, professionalPrompt)
            break
          case 'openai':
            result = await generateMinutesWithOpenAI(transcript, professionalPrompt, model)
            break
        }
        
        if (result && isValidMinutesResult(result)) {
          console.log(`✅ ${currentProvider}で高品質議事録生成成功`)
          return NextResponse.json({
            ...result,
            provider: currentProvider,
            generatedAt: new Date().toISOString(),
            quality: 'professional'
          })
        }
      } catch (error) {
        console.warn(`⚠️ ${currentProvider}での生成に失敗:`, error)
        lastError = error
        
        // 次のプロバイダーに続行
        continue
      }
    }

    // 全てのAIプロバイダーが失敗した場合、高品質なルールベース生成にフォールバック
    console.warn("🔄 全AIプロバイダーが失敗、強化ルールベース生成にフォールバック")
    
    try {
      result = generateMinutesRuleBased(transcript)
      console.log("✅ 強化ルールベース議事録生成成功")
      
      return NextResponse.json({
        ...result,
        provider: 'rule-based-enhanced',
        generatedAt: new Date().toISOString(),
        quality: 'standard',
        fallbackReason: 'AI providers unavailable'
      })
    } catch (fallbackError) {
      console.error("❌ フォールバック生成も失敗:", fallbackError)
      
      return NextResponse.json(
        { 
          error: "議事録生成に失敗しました",
          details: lastError instanceof Error ? lastError.message : "不明なエラー",
          fallbackError: fallbackError instanceof Error ? fallbackError.message : "フォールバック失敗"
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error("❌ 議事録生成API重大エラー:", error)
    return NextResponse.json(
      { 
        error: "議事録生成サービスでエラーが発生しました",
        details: error instanceof Error ? error.message : "不明なエラー"
      },
      { status: 500 }
    )
  }
}

// スマートプロバイダー優先順位決定
function getProviderPriority(preferredProvider: string): string[] {
  const allProviders = ['gemini', 'deepseek', 'openai']
  
  if (!allProviders.includes(preferredProvider)) {
    console.warn(`⚠️ 不明なプロバイダー: ${preferredProvider}、Geminiを優先に設定`)
    return ['gemini', 'deepseek', 'openai']
  }
  
  // 優先プロバイダーを最初に、残りは品質順
  const priority = [preferredProvider]
  const remaining = allProviders.filter(p => p !== preferredProvider)
  
  // Gemini > DeepSeek > OpenAI の順で品質を評価
  const qualityOrder = ['gemini', 'deepseek', 'openai']
  remaining.sort((a, b) => qualityOrder.indexOf(a) - qualityOrder.indexOf(b))
  
  return priority.concat(remaining)
}

// 議事録結果の品質検証
function isValidMinutesResult(result: any): boolean {
  if (!result || typeof result !== 'object') {
    return false
  }
  
  const requiredFields = ['meetingName', 'date', 'participants', 'agenda', 'mainPoints', 'decisions', 'todos']
  
  for (const field of requiredFields) {
    if (!result[field]) {
      console.warn(`⚠️ 品質チェック失敗: ${field}が不足`)
      return false
    }
    
    if (typeof result[field] === 'string' && result[field].trim().length < 2) {
      console.warn(`⚠️ 品質チェック失敗: ${field}が短すぎる`)
      return false
    }
    
    if (field === 'mainPoints' && (!Array.isArray(result[field]) || result[field].length < 1)) {
      console.warn(`⚠️ 品質チェック失敗: mainPointsが不適切`)
      return false
    }
  }
  
  console.log("✅ 議事録品質チェック合格")
  return true
}
