import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const maxDuration = 300 // 5分に拡張（大きなファイル処理のため）

export async function POST(request: NextRequest) {
  try {
    console.log("=== TRANSCRIBE API START ===")

    // リクエストサイズの事前チェック
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength)
      const MAX_REQUEST_SIZE = 30 * 1024 * 1024 // 30MB (FormData overhead を考慮)
      if (size > MAX_REQUEST_SIZE) {
        console.error("Request size too large:", size)
        return NextResponse.json(
          { error: "ファイルサイズが大きすぎます。25MB以下のファイルを使用してください。" },
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
    })

    const formData = await request.formData()
    const file = formData.get("file") as File

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

    // ファイルサイズチェック（25MB制限）
    const MAX_SIZE = 25 * 1024 * 1024 // 25MB
    if (file.size > MAX_SIZE) {
      console.error("=== CRITICAL: FILE SIZE EXCEEDED ===", {
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

    console.log("Calling OpenAI Whisper API...")

    // OpenAI Whisper APIを呼び出し
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "ja",
      response_format: "json",
    })

    console.log("Transcription completed:", {
      textLength: transcription.text?.length || 0,
    })

    if (!transcription.text) {
      return NextResponse.json({ error: "文字起こし結果が空です" }, { status: 400 })
    }

    return NextResponse.json({
      transcript: transcription.text,
      success: true,
    })
  } catch (error: any) {
    console.error("Transcription error:", error)

    // OpenAI APIエラーの詳細処理
    if (error?.response?.status === 413) {
      return NextResponse.json(
        {
          error: "ファイルサイズが大きすぎます",
          details: "OpenAI APIの制限を超えています。25MB以下のファイルを使用してください。",
        },
        { status: 413 },
      )
    }

    if (error?.response?.status === 400) {
      return NextResponse.json(
        {
          error: "ファイル形式が無効です",
          details: "対応している音声ファイル形式を使用してください。",
        },
        { status: 400 },
      )
    }

    if (error?.response?.status === 401) {
      return NextResponse.json(
        {
          error: "認証エラー",
          details: "OpenAI APIキーが無効です。",
        },
        { status: 401 },
      )
    }

    if (error?.response?.status === 429) {
      return NextResponse.json(
        {
          error: "レート制限",
          details: "API利用制限に達しました。しばらく待ってから再試行してください。",
        },
        { status: 429 },
      )
    }

    // その他のエラー
    return NextResponse.json(
      {
        error: "文字起こし処理中にエラーが発生しました",
        details: error.message || "不明なエラー",
      },
      { status: 500 },
    )
  }
}
