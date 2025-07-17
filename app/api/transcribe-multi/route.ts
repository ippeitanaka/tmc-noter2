import { NextRequest, NextResponse } from 'next/server'
import { transcribeWithAssemblyAI } from '@/lib/assemblyai-client'
import { transcribeWithAzure } from '@/lib/azure-speech-client'

export const maxDuration = 300

interface TranscriptionOptions {
  provider: 'openai' | 'assemblyai' | 'azure' | 'webspeech'
  apiKey?: string
  region?: string
  speakerDiarization?: boolean
  generateSummary?: boolean
  extractKeywords?: boolean
  includeTimestamps?: boolean
  sentimentAnalysis?: boolean
  language?: string
  model?: string
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== MULTI-PROVIDER TRANSCRIBE API START ===")

    const formData = await request.formData()
    const file = formData.get("file") as File
    const provider = (formData.get("provider") as string) || 'openai'
    const apiKey = formData.get("apiKey") as string
    const region = formData.get("region") as string

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 })
    }

    // ファイルサイズチェック
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "ファイルサイズが大きすぎます。25MB以下のファイルを使用してください。" },
        { status: 413 }
      )
    }

    console.log(`Using provider: ${provider}`)
    console.log(`File: ${file.name}, Size: ${file.size} bytes`)

    // 文字起こしオプション
    const options: TranscriptionOptions = {
      provider: provider as any,
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      region: region || process.env.AZURE_SPEECH_REGION,
      speakerDiarization: formData.get("speakerDiarization") === "true",
      generateSummary: formData.get("generateSummary") === "true",
      extractKeywords: formData.get("extractKeywords") === "true",
      includeTimestamps: formData.get("includeTimestamps") === "true",
      sentimentAnalysis: formData.get("sentimentAnalysis") === "true",
      language: (formData.get("language") as string) || "ja",
      model: (formData.get("model") as string) || "whisper-1"
    }

    let result: any = {}

    switch (provider) {
      case 'openai':
        // OpenAI Whisperを使用
        const openaiResult = await transcribeWithOpenAI(file, options)
        result = openaiResult
        break

      case 'assemblyai':
        // AssemblyAIを使用
        if (!options.apiKey) {
          return NextResponse.json({ error: "AssemblyAI APIキーが必要です" }, { status: 400 })
        }
        
        const assemblyaiResult = await transcribeWithAssemblyAI(file, options.apiKey, {
          language_code: options.language === 'ja' ? 'ja' : 'en',
          speaker_labels: options.speakerDiarization,
          summarization: options.generateSummary,
          sentiment_analysis: options.sentimentAnalysis,
          entity_detection: options.extractKeywords,
          auto_highlights: options.extractKeywords,
          punctuate: true,
          format_text: true
        })
        
        result = {
          transcript: assemblyaiResult.text || '',
          speakers: assemblyaiResult.words?.map(w => `[${w.speaker}] ${w.text}`).join(' ') || '',
          summary: assemblyaiResult.summary || '',
          keywords: assemblyaiResult.auto_highlights_result?.results?.map(h => h.text).join(', ') || '',
          sentiment: assemblyaiResult.sentiment_analysis_results?.map(s => 
            `${s.text} (${s.sentiment}: ${s.confidence})`
          ).join('; ') || '',
          segments: assemblyaiResult.words || [],
          success: true
        }
        break

      case 'azure':
        // Azure Speech Serviceを使用
        if (!options.apiKey) {
          return NextResponse.json({ error: "Azure Speech APIキーが必要です" }, { status: 400 })
        }
        
        const azureResult = await transcribeWithAzure(file, options.apiKey, options.region || 'eastus', {
          language: options.language === 'ja' ? 'ja-JP' : 'en-US',
          outputFormat: 'detailed',
          enableWordLevelTimestamps: options.includeTimestamps,
          enableSentiment: options.sentimentAnalysis,
          enableSpeakerDiarization: options.speakerDiarization,
          maxSpeakerCount: 10
        })
        
        result = {
          transcript: azureResult.DisplayText || '',
          speakers: azureResult.NBest?.[0]?.Words?.map(w => `[Speaker] ${w.Word}`).join(' ') || '',
          segments: azureResult.NBest?.[0]?.Words || [],
          success: true
        }
        break

      case 'webspeech':
        // Web Speech APIはクライアントサイドで処理
        return NextResponse.json({ 
          error: "Web Speech APIはクライアントサイドで処理してください" 
        }, { status: 400 })

      default:
        return NextResponse.json({ error: "サポートされていないプロバイダーです" }, { status: 400 })
    }

    console.log("Transcription completed successfully")
    return NextResponse.json(result)

  } catch (error) {
    console.error("Transcription error:", error)
    
    if (error instanceof Error) {
      if (error.message.includes('413') || error.message.includes('too large')) {
        return NextResponse.json(
          { error: "ファイルサイズが大きすぎます。25MB以下のファイルを使用してください。" },
          { status: 413 }
        )
      }
      
      if (error.message.includes('quota') || error.message.includes('limit')) {
        return NextResponse.json(
          { error: "APIの利用制限に達しました。しばらく待ってから再試行してください。" },
          { status: 429 }
        )
      }
      
      if (error.message.includes('unauthorized') || error.message.includes('invalid')) {
        return NextResponse.json(
          { error: "APIキーが無効です。正しいAPIキーを設定してください。" },
          { status: 401 }
        )
      }
    }

    return NextResponse.json(
      { error: "文字起こし処理中にエラーが発生しました。" },
      { status: 500 }
    )
  }
}

// OpenAI Whisperを使用した文字起こし（既存のコードを使用）
async function transcribeWithOpenAI(file: File, options: TranscriptionOptions) {
  const OpenAI = require('openai')
  
  if (!options.apiKey) {
    throw new Error("OpenAI APIキーが設定されていません")
  }

  const openai = new OpenAI({
    apiKey: options.apiKey,
  })

  const transcription = await openai.audio.transcriptions.create({
    file: file,
    model: options.model as "whisper-1",
    language: options.language || 'ja',
    response_format: options.includeTimestamps ? 'verbose_json' : 'json',
    timestamp_granularities: options.includeTimestamps ? ['word'] : undefined
  })

  return {
    transcript: transcription.text,
    segments: transcription.words || [],
    success: true
  }
}
