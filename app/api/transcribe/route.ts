import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const maxDuration = 300 // 5分に拡張（大きなファイル処理のため）

// 文字起こし設定のインターフェース
interface TranscriptionOptions {
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
    console.log("=== TRANSCRIBE API START ===")
    console.log("Request headers:", Object.fromEntries(request.headers.entries()))

    // リクエストサイズの事前チェック
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength)
      const MAX_REQUEST_SIZE = 50 * 1024 * 1024 // 50MBに拡張（FormData overhead を考慮）
      console.log(`Request size: ${(size / 1024 / 1024).toFixed(2)}MB, Max: ${MAX_REQUEST_SIZE / 1024 / 1024}MB`)
      if (size > MAX_REQUEST_SIZE) {
        console.error("Request size too large:", size)
        return NextResponse.json(
          { error: "リクエストサイズが大きすぎます。50MB以下のファイルを使用してください。" },
          { status: 413 }
        )
      }
    }

    // OpenAI API keyのチェック
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY environment variable is not set")
      return NextResponse.json(
        { error: "OpenAI API keyが設定されていません" }, 
        { status: 500 }
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 120000, // 2分のタイムアウト
    })

    let formData;
    try {
      formData = await request.formData()
    } catch (error) {
      console.error("FormData parsing error:", error)
      return NextResponse.json(
        { error: "リクエストの解析に失敗しました。ファイルサイズを確認してください。" },
        { status: 400 }
      )
    }

    const file = formData.get("file") as File
    
    // オプションの取得
    const options: TranscriptionOptions = {
      speakerDiarization: formData.get("speakerDiarization") === "true",
      generateSummary: formData.get("generateSummary") === "true",
      extractKeywords: formData.get("extractKeywords") === "true",
      includeTimestamps: formData.get("includeTimestamps") === "true",
      sentimentAnalysis: formData.get("sentimentAnalysis") === "true",
      language: (formData.get("language") as string) || "ja",
      model: (formData.get("model") as string) || "whisper-1"
    }

    console.log("Transcription options:", options)

    if (!file) {
      console.error("No file provided")
      return NextResponse.json({ error: "ファイルが提供されていません" }, { status: 400 })
    }

    console.log("File details:", {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2),
    })

    // ファイルサイズチェック（25MB制限を少し緩和）
    const MAX_SIZE = 26 * 1024 * 1024 // 26MBに拡張
    if (file.size > MAX_SIZE) {
      console.error("=== FILE SIZE EXCEEDED ===", {
        fileSize: file.size,
        maxSize: MAX_SIZE,
        sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      })
      return NextResponse.json(
        {
          error: "ファイルサイズが大きすぎます",
          details: `ファイルサイズ: ${(file.size / (1024 * 1024)).toFixed(1)}MB, 制限: ${MAX_SIZE / (1024 * 1024)}MB`,
          debug: {
            fileSize: file.size,
            maxSize: MAX_SIZE,
            exceeded: true,
          },
        },
        { status: 413 },
      )
    }

    // ファイル形式のチェック
    const supportedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 
      'audio/flac', 'audio/ogg', 'audio/webm', 'video/webm'
    ]
    
    if (!supportedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|flac|ogg|webm)$/i)) {
      console.error("Unsupported file type:", file.type, file.name)
      return NextResponse.json(
        { error: "サポートされていないファイル形式です。mp3, wav, m4a, flac, ogg, webm形式を使用してください。" },
        { status: 400 }
      )
    }

    console.log("Calling OpenAI Whisper API...")
    console.log("File size check passed:", (file.size / (1024 * 1024)).toFixed(2) + "MB")

    // 高精度文字起こし用のプロンプト
    const transcriptionPrompt = `
    これは日本語の音声ファイルの文字起こしです。以下の点に注意して、正確で自然な文字起こしを行ってください：

    1. 話し言葉の自然な流れを保ちつつ、読みやすさを重視
    2. 「えー」「あのー」などの言いよどみは適度に整理
    3. 専門用語や固有名詞は正確に表記
    4. 会話の場合は話者の切り替わりを明確に
    5. 重要な情報は見落とさないよう注意
    6. 文章の区切りと段落を適切に
    `

    // OpenAI Whisper APIを呼び出し（タイムスタンプ付き）
    let transcription;
    try {
      transcription = await openai.audio.transcriptions.create({
        file: file,
        model: options.model as "whisper-1",
        language: options.language,
        response_format: options.includeTimestamps ? "verbose_json" : "json",
        prompt: transcriptionPrompt,
        temperature: 0.2, // 一貫性を重視
      })
    } catch (apiError: any) {
      console.error("OpenAI API Error:", apiError)
      
      // より詳細なエラーハンドリング
      if (apiError.status === 413) {
        return NextResponse.json(
          { error: "ファイルサイズが大きすぎます。OpenAI APIの制限（25MB）を超えています。" },
          { status: 413 }
        )
      }
      
      if (apiError.status === 400) {
        return NextResponse.json(
          { error: "ファイル形式が無効です。対応している音声ファイル形式を使用してください。" },
          { status: 400 }
        )
      }
      
      if (apiError.status === 401) {
        return NextResponse.json(
          { error: "OpenAI API認証エラー。APIキーを確認してください。" },
          { status: 401 }
        )
      }
      
      if (apiError.status === 429) {
        return NextResponse.json(
          { error: "OpenAI APIレート制限に達しました。しばらく待ってから再試行してください。" },
          { status: 429 }
        )
      }
      
      // 一般的なAPIエラー
      throw apiError
    }

    console.log("Transcription completed:", {
      textLength: transcription.text?.length || 0,
      hasText: !!transcription.text,
    })

    if (!transcription.text) {
      return NextResponse.json({ error: "文字起こし結果が空です" }, { status: 400 })
    }

    let result: any = {
      transcript: transcription.text,
      success: true,
    }

    // タイムスタンプ情報の追加
    if (options.includeTimestamps && 'segments' in transcription) {
      result.segments = transcription.segments
      if ('duration' in transcription) {
        result.duration = transcription.duration
      }
    }

    // 追加処理の実行
    if (options.speakerDiarization || options.generateSummary || options.extractKeywords || options.sentimentAnalysis) {
      try {
        console.log("Starting enhancement processing...")
        const enhancedResult = await enhanceTranscription(transcription.text, options, openai)
        result = { ...result, ...enhancedResult }
        console.log("Enhancement completed successfully")
      } catch (enhanceError) {
        console.error("Enhancement error:", enhanceError)
        result.enhancementError = "追加機能の処理中にエラーが発生しました"
      }
    }

    console.log("=== TRANSCRIBE API SUCCESS ===")
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("=== TRANSCRIBE API ERROR ===")
    console.error("Error details:", {
      message: error.message,
      status: error.status,
      code: error.code,
      stack: error.stack
    })

    // OpenAI APIエラーの詳細処理
    if (error?.status === 413 || error?.response?.status === 413) {
      return NextResponse.json(
        {
          error: "ファイルサイズが大きすぎます",
          details: "OpenAI APIの制限（25MB）を超えています。ファイルを圧縮してください。",
          debug: { errorType: "size_limit", status: 413 }
        },
        { status: 413 },
      )
    }

    if (error?.status === 400 || error?.response?.status === 400) {
      return NextResponse.json(
        {
          error: "ファイル形式が無効です",
          details: "対応している音声ファイル形式を使用してください。",
          debug: { errorType: "invalid_format", status: 400 }
        },
        { status: 400 },
      )
    }

    if (error?.status === 401 || error?.response?.status === 401) {
      return NextResponse.json(
        {
          error: "認証エラー",
          details: "OpenAI APIキーが無効です。",
          debug: { errorType: "auth_error", status: 401 }
        },
        { status: 401 },
      )
    }

    if (error?.status === 429 || error?.response?.status === 429) {
      return NextResponse.json(
        {
          error: "レート制限",
          details: "API利用制限に達しました。しばらく待ってから再試行してください。",
          debug: { errorType: "rate_limit", status: 429 }
        },
        { status: 429 },
      )
    }

    // ネットワークエラー
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return NextResponse.json(
        {
          error: "ネットワークエラー",
          details: "接続がタイムアウトしました。ファイルサイズを小さくして再試行してください。",
          debug: { errorType: "network_error", code: error.code }
        },
        { status: 408 },
      )
    }

    // その他のエラー
    return NextResponse.json(
      {
        error: "文字起こし処理中にエラーが発生しました",
        details: error.message || "不明なエラー",
        debug: { 
          errorType: "general_error",
          message: error.message,
          status: error.status || 500
        }
      },
      { status: 500 },
    )
  }
}

// 文字起こし結果の拡張処理
async function enhanceTranscription(transcript: string, options: TranscriptionOptions, openai: OpenAI) {
  const enhancements: any = {}

  try {
    // 話者識別の実行
    if (options.speakerDiarization) {
      enhancements.speakers = await identifySpeakers(transcript, openai)
    }

    // 要約の生成
    if (options.generateSummary) {
      enhancements.summary = await generateSummary(transcript, openai)
    }

    // キーワード抽出
    if (options.extractKeywords) {
      enhancements.keywords = await extractKeywords(transcript, openai)
    }

    // 感情分析
    if (options.sentimentAnalysis) {
      enhancements.sentiment = await analyzeSentiment(transcript, openai)
    }

    // 段落分割と構造化
    enhancements.structured = await structureTranscript(transcript, openai)

  } catch (error) {
    console.error("Enhancement error:", error)
    enhancements.enhancementError = "追加機能の処理中にエラーが発生しました"
  }

  return enhancements
}

// 話者識別
async function identifySpeakers(transcript: string, openai: OpenAI) {
  const prompt = `
  以下の文字起こしテキストを分析し、話者を識別してください。
  各話者を「話者A」「話者B」のように区別し、発言内容を整理してください。

  テキスト：
  ${transcript}

  出力形式：
  - 話者の数
  - 各話者の発言内容（時系列順）
  - 話者の特徴（可能であれば）
  `

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  })

  return response.choices[0].message.content
}

// 要約の生成
async function generateSummary(transcript: string, openai: OpenAI) {
  const prompt = `
  以下の文字起こしテキストの要約を作成してください。
  
  要約には以下を含めてください：
  1. 全体の概要（2-3文）
  2. 主要なポイント（3-5つ）
  3. 重要な決定事項や結論
  4. 今後のアクションアイテム（あれば）

  テキスト：
  ${transcript}
  `

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  })

  return response.choices[0].message.content
}

// キーワード抽出
async function extractKeywords(transcript: string, openai: OpenAI) {
  const prompt = `
  以下の文字起こしテキストから重要なキーワードを抽出してください。
  
  以下のカテゴリに分けて抽出してください：
  1. 人名・組織名
  2. 専門用語・技術用語
  3. 重要な概念・トピック
  4. 数値・データ
  5. 日付・時間

  テキスト：
  ${transcript}
  `

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  })

  return response.choices[0].message.content
}

// 感情分析
async function analyzeSentiment(transcript: string, openai: OpenAI) {
  const prompt = `
  以下の文字起こしテキストの感情分析を行ってください。
  
  分析項目：
  1. 全体的な感情的トーン（ポジティブ/ネガティブ/中立）
  2. 話者の感情変化（あれば）
  3. 重要な感情表現
  4. 議論の雰囲気（建設的/対立的/協調的など）

  テキスト：
  ${transcript}
  `

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  })

  return response.choices[0].message.content
}

// 文章構造化
async function structureTranscript(transcript: string, openai: OpenAI) {
  const prompt = `
  以下の文字起こしテキストを読みやすく構造化してください。
  
  構造化の方針：
  1. 適切な段落分割
  2. 文章の整理（冗長な部分の削除）
  3. 話題の区切りを明確に
  4. 見出しの追加（必要に応じて）
  5. 読みやすい文体に調整

  テキスト：
  ${transcript}
  `

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  })

  return response.choices[0].message.content
}
