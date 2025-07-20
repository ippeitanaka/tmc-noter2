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

    // 最高品質な議事録生成のための詳細プロンプト
    const professionalPrompt = userPrompt || (language === 'ja' ? `
あなたは20年以上の経験を持つプロフェッショナルな会議秘書です。以下の音声文字起こしから、企業レベルの高品質な議事録を作成してください。

## 重要な作業指針
1. **情報の精査**: 音声認識エラーや不明瞭な部分は文脈から合理的に推測し、明確に記述
2. **内容の構造化**: 散発的な発言を論理的にまとめ、意味のある議題として整理
3. **具体性の確保**: あいまいな表現（「それ」「あれ」など）は具体的な内容に置き換え
4. **重要度の判断**: 雑談と重要な議論を区別し、核心的な内容に焦点
5. **行動指向**: 決定事項と今後のアクションを明確に分離

## 出力フォーマット（厳密に従ってください）

**会議名**: [内容から適切な会議名を推定。「○○学科会議」「○○プロジェクト会議」など具体的に]

**開催日**: [文字起こしから特定できる日付。不明な場合は「記載なし」]

**参加者**: [発言から特定される人物名と役職。「○○先生」「○○課長」など。複数名は改行で区切る]

**議題**: [討議された主要テーマを3つ以内で簡潔に。例：「学生指導、行事運営、人事案件」]

**主要ポイント**:
1. [具体的な議論内容1 - 数値や固有名詞を含む詳細な記述]
2. [具体的な議論内容2 - 課題や問題点を明確に]  
3. [具体的な議論内容3 - 今後の方向性や計画]
4. [具体的な議論内容4 - その他重要な事項]
（重要度順に4-6個程度、各項目は1-2行で簡潔に）

**決定事項**:
[明確に合意・決定された内容のみ。推測や議論中の内容は含めない。決定がない場合は「継続審議」]

**アクションアイテム**:
1. [具体的なタスク] (担当: [担当者名])
2. [具体的なタスク] (担当: [担当者名])
（実際に割り当てられたタスクのみ。推測は避ける）

**次回会議予定**: [明確に言及された場合のみ記載。不明な場合は「未定」]

## 品質チェックポイント
- 人名や固有名詞は音声認識エラーを修正して正確に記載
- 数値情報（日付、人数、時間など）は漏れなく記録
- 抽象的表現は避け、具体的で分かりやすい表現を使用
- 議論の流れを論理的に整理し、読み手が理解しやすい構成

文字起こしデータ:
${transcript}

上記の音声文字起こしから、企業の正式文書として使用できる高品質な議事録を作成してください。
` : `
You are a professional meeting secretary with over 20 years of experience. Please create enterprise-level high-quality meeting minutes from the following audio transcript.

## Important Guidelines
1. **Information Verification**: Reasonably infer from context for speech recognition errors or unclear parts, describe clearly
2. **Content Structuring**: Organize sporadic remarks logically and arrange as meaningful agenda items
3. **Ensure Specificity**: Replace vague expressions ("it", "that", etc.) with specific content
4. **Importance Assessment**: Distinguish between casual conversation and important discussions, focus on core content
5. **Action-Oriented**: Clearly separate decisions from future actions

## Output Format (Follow strictly)

**Meeting Name**: [Estimate appropriate meeting name from content. Be specific like "XX Department Meeting", "XX Project Meeting"]

**Date**: [Date identifiable from transcript. If unknown, write "Not specified"]

**Participants**: [Names and titles identified from speakers. "Mr. XX", "Manager XX", etc. Separate multiple names with line breaks]

**Agenda**: [Main themes discussed in 3 or fewer items concisely. Example: "Student guidance, event management, personnel matters"]

**Key Points**:
1. [Specific discussion content 1 - detailed description including numbers and proper nouns]
2. [Specific discussion content 2 - clearly state issues and problems]
3. [Specific discussion content 3 - future directions and plans]
4. [Specific discussion content 4 - other important matters]
(4-6 items in order of importance, each item concise in 1-2 lines)

**Decisions Made**:
[Only clearly agreed and decided content. Do not include speculation or discussion in progress. If no decisions, write "Continued discussion"]

**Action Items**:
1. [Specific task] (Responsible: [Person's name])
2. [Specific task] (Responsible: [Person's name])
(Only actually assigned tasks. Avoid speculation)

**Next Meeting**: [Only record if clearly mentioned. If unknown, write "TBD"]

## Quality Checkpoints
- Correct speech recognition errors for names and proper nouns, record accurately
- Record all numerical information (dates, numbers, times) without omission
- Avoid abstract expressions, use specific and understandable expressions
- Organize discussion flow logically with reader-friendly structure

Transcript Data:
${transcript}

Please create high-quality meeting minutes from the above audio transcript that can be used as official corporate documentation.
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
