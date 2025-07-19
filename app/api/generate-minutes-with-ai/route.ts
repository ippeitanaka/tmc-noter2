import { NextRequest, NextResponse } from 'next/server'
import { generateMinutesWithOpenAI } from '@/lib/openai-client'
import { generateMinutesWithGemini } from '@/lib/gemini-client'
import { generateMinutesWithDeepSeek } from '@/lib/deepseek-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transcript, provider, apiKey, model, language = 'ja' } = body

    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      )
    }

    console.log(`🔄 Generating minutes using ${provider}...`)

    let result: any

    // プロンプトを言語に応じて設定
    const prompt = language === 'ja' 
      ? `以下の文字起こしテキストから議事録を生成してください。

文字起こしテキスト:
${transcript}

以下の形式で議事録を作成してください：

## 会議議事録

### 基本情報
- 日時: [推測される会議日時]
- 参加者: [話者から推測]

### 主要議題
[主要な議題を箇条書きで]

### 討議内容
[重要な議論内容を整理]

### 決定事項
[決定された事項があれば]

### アクションアイテム
[今後の行動項目があれば]

### その他
[その他重要な事項]`
      : `Please generate meeting minutes from the following transcript.

Transcript:
${transcript}

Please create meeting minutes in the following format:

## Meeting Minutes

### Basic Information
- Date/Time: [Estimated meeting time]
- Participants: [Inferred from speakers]

### Main Topics
[List main topics discussed]

### Discussion Points
[Organize important discussion content]

### Decisions Made
[Any decisions made during the meeting]

### Action Items
[Future action items if any]

### Other Notes
[Other important matters]`

    switch (provider) {
      case 'openai':
        try {
          result = await generateMinutesWithOpenAI(transcript, prompt, model)
        } catch (error) {
          console.error('OpenAI minutes generation failed:', error)
          return NextResponse.json(
            { error: 'OpenAI API error: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
          )
        }
        break

      case 'gemini':
        try {
          result = await generateMinutesWithGemini(transcript, prompt)
        } catch (error) {
          console.error('Gemini minutes generation failed:', error)
          return NextResponse.json(
            { error: 'Gemini API error: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
          )
        }
        break

      case 'deepseek':
        try {
          result = await generateMinutesWithDeepSeek(transcript, prompt)
        } catch (error) {
          console.error('DeepSeek minutes generation failed:', error)
          return NextResponse.json(
            { error: 'DeepSeek API error: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
          )
        }
        break

      default:
        // デフォルトの議事録生成（ルールベース）
        result = generateBasicMinutes(transcript, language)
        break
    }

    return NextResponse.json({
      success: true,
      minutes: result,
      provider,
      model
    })

  } catch (error) {
    console.error('Minutes generation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate minutes', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// ルールベースの基本的な議事録生成
function generateBasicMinutes(transcript: string, language: string = 'ja'): string {
  const lines = transcript.split('\n').filter(line => line.trim().length > 0)
  const wordCount = transcript.split(' ').length
  const estimatedDuration = Math.ceil(wordCount / 150) // 1分間に約150語

  if (language === 'ja') {
    return `## 会議議事録

### 基本情報
- 推定時間: 約${estimatedDuration}分
- 文字数: ${transcript.length}文字

### 内容概要
${lines.slice(0, 5).map(line => `- ${line.trim()}`).join('\n')}

### 全文
${transcript}

---
*この議事録は自動生成されました。より詳細な議事録を作成するには、AI APIキーを設定してください。*`
  } else {
    return `## Meeting Minutes

### Basic Information
- Estimated Duration: About ${estimatedDuration} minutes
- Character Count: ${transcript.length} characters

### Content Overview
${lines.slice(0, 5).map(line => `- ${line.trim()}`).join('\n')}

### Full Transcript
${transcript}

---
*This meeting minutes was automatically generated. For more detailed minutes, please configure AI API keys.*`
  }
}
