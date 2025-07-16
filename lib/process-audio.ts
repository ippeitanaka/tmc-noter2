import { supabase, STORAGE_BUCKET } from "@/lib/supabase-client"
import { processAudioWithFFmpeg } from "@/lib/ffmpeg-helper"

// ファイル名を安全な形式に変換する関数
const sanitizeFileName = (fileName: string): string => {
  // 拡張子を取得
  const extension = fileName.split(".").pop() || ""

  // ファイル名から拡張子を除いた部分
  const nameWithoutExtension = fileName.substring(0, fileName.length - extension.length - 1)

  // ファイル名を英数字とハイフン、アンダースコアのみに制限
  const sanitized = nameWithoutExtension
    .replace(/[^\w\s-]/g, "") // 英数字、空白、ハイフン以外を削除
    .replace(/\s+/g, "_") // 空白をアンダースコアに置換
    .replace(/-+/g, "-") // 連続するハイフンを単一のハイフンに置換
    .replace(/^-+/, "") // 先頭のハイフンを削除
    .replace(/-+$/, "") // 末尾のハイフンを削除

  // 日本語などの非ASCII文字が含まれている場合は、タイムスタンプのみの名前にする
  if (/[^\x00-\x7F]/.test(sanitized)) {
    return `file_${Date.now()}.${extension}`
  }

  // 安全な形式のファイル名を返す
  return `${sanitized}.${extension}`
}

// ファイルの準備（必要に応じて圧縮・変換）
const prepareAudioFile = async (file: File): Promise<File> => {
  // サポートされている形式かチェック
  const supportedFormats = [
    "audio/flac",
    "audio/x-m4a",
    "audio/mpeg",
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
  ]
  const needsFormatConversion = !supportedFormats.includes(file.type)

  // サイズチェック（10MBを超える場合は圧縮）- 閾値を下げる
  const needsCompression = file.size > 10 * 1024 * 1024

  // 圧縮または形式変換が必要な場合
  if (needsCompression || needsFormatConversion) {
    console.log(
      `Processing audio file: ${needsCompression ? "compression needed" : ""} ${
        needsFormatConversion ? "format conversion needed" : ""
      }`,
    )

    try {
      const { blob, type } = await processAudioWithFFmpeg(file, {
        compress: needsCompression,
        convertFormat: needsFormatConversion,
      })

      return new File([blob], file.name.replace(/\.[^/.]+$/, ".mp3"), { type })
    } catch (error) {
      console.error("Failed to process audio file:", error)
      // FFmpegの処理に失敗した場合は、元のファイルを返す
      return file
    }
  }

  return file
}

// Supabaseにファイルをアップロード
const uploadToSupabase = async (
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ url: string; path: string }> => {
  try {
    // ファイル名を安全な形式に変換
    const safeName = sanitizeFileName(file.name)
    const fileName = `audio/${Date.now()}-${safeName}`

    console.log(`Uploading file to bucket: ${STORAGE_BUCKET}, path: ${fileName}, type: ${file.type}`)

    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, file, {
      cacheControl: "3600",
      upsert: true, // 同名ファイルが存在する場合は上書き
      contentType: file.type, // MIMEタイプを明示的に設定
    })

    if (error) {
      console.error("Upload error details:", error)
      throw new Error(`ファイルのアップロードに失敗しました: ${error.message}`)
    }

    // ファイルの公開URLを取得
    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName)

    console.log(`File uploaded successfully. Public URL: ${publicUrl}`)
    return {
      url: publicUrl,
      path: fileName,
    }
  } catch (error) {
    console.error("Upload function error:", error)
    throw error
  }
}

// 音声ファイルを文字起こし（OpenAI APIを直接使用）
const transcribeAudio = async (file: File): Promise<string> => {
  try {
    console.log(`Transcribing file directly: ${file.name}, type: ${file.type}, size: ${file.size} bytes`)

    // ファイルサイズが大きすぎる場合は圧縮
    let fileToProcess = file
    if (file.size > 20 * 1024 * 1024) {
      console.log("File size exceeds 20MB, compressing...")
      const { blob, type } = await processAudioWithFFmpeg(file, {
        compress: true,
        convertFormat: true,
      })
      fileToProcess = new File([blob], file.name.replace(/\.[^/.]+$/, ".mp3"), { type })
      console.log(
        `Compressed file: ${fileToProcess.name}, type: ${fileToProcess.type}, size: ${fileToProcess.size} bytes`,
      )
    }

    // FormDataを作成
    const formData = new FormData()
    formData.append("file", fileToProcess)
    formData.append("model", "whisper-1")
    formData.append("language", "ja")

    // OpenAI APIを直接呼び出し
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    console.log("Transcription completed successfully")
    return result.text
  } catch (error) {
    console.error("Transcription error:", error)
    throw new Error(`文字起こしに失敗しました: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// 議事録の生成
const generateMinutes = async (transcript: string) => {
  const prompt = `以下は会議の文字起こしです。この内容をもとに、わかりやすく簡潔な議事録を作成してください。
【出力形式】
・会議名
・日時
・参加者
・議題
・主な発言（箇条書き）
・決定事項
・TODO（可能なら担当者も）
※繰り返しや言い間違いを省略し、要点を整理してください。

文字起こし:
${transcript}`

  try {
    console.log("Starting minutes generation with GPT API")

    // OpenAI APIを直接使用して議事録を生成
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "あなたは会議の議事録を作成する専門家です。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const text = result.choices[0].message.content

    console.log("Minutes generation completed successfully")

    // 議事録をパースして構造化
    const meetingName = text.match(/会議名[：:]\s*(.+)/)?.[1] || "会議"
    const date = text.match(/日時[：:]\s*(.+)/)?.[1] || new Date().toLocaleDateString()
    const participants = text.match(/参加者[：:]\s*(.+)/)?.[1] || "不明"
    const agenda = text.match(/議題[：:]\s*(.+)/)?.[1] || "不明"

    // 主な発言を抽出
    const mainPointsMatch = text.match(/主な発言[：:][\s\S]*?(?=決定事項|$)/i)
    const mainPointsText = mainPointsMatch ? mainPointsMatch[0] : ""
    const mainPoints = mainPointsText
      .replace(/主な発言[：:]/i, "")
      .split(/[\n・]/)
      .map((point) => point.trim())
      .filter((point) => point.length > 0)

    // 決定事項を抽出
    const decisionsMatch = text.match(/決定事項[：:][\s\S]*?(?=TODO|$)/i)
    const decisions = decisionsMatch ? decisionsMatch[0].replace(/決定事項[：:]/i, "").trim() : "特になし"

    // TODOを抽出
    const todosMatch = text.match(/TODO[：:][\s\S]*/i)
    const todos = todosMatch ? todosMatch[0].replace(/TODO[：:]/i, "").trim() : "特になし"

    return {
      meetingName,
      date,
      participants,
      agenda,
      mainPoints,
      decisions,
      todos,
    }
  } catch (error) {
    console.error("Minutes generation error:", error)
    throw new Error(`議事録の生成に失敗しました: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// 音声ファイル処理のメイン関数
export async function processAudioFile(
  file: File,
  callbacks: {
    onUploadProgress?: (progress: number) => void
    onTranscribeStart?: () => void
    onTranscribeProgress?: (progress: number) => void
    onSummarizeStart?: () => void
    onSummarizeProgress?: (progress: number) => void
  } = {},
) {
  try {
    console.log(`Processing audio file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`)

    // ファイルの準備（必要に応じて圧縮・変換）
    const preparedFile = await prepareAudioFile(file)
    console.log(`File prepared: ${preparedFile.name}, size: ${preparedFile.size} bytes, type: ${preparedFile.type}`)

    // Supabaseにアップロード（オプション - エラーが発生しても処理を続行）
    let filePath = ""
    try {
      const uploadResult = await uploadToSupabase(preparedFile, callbacks.onUploadProgress)
      filePath = uploadResult.path
      console.log("File uploaded to Supabase successfully")
    } catch (uploadError) {
      console.warn("Supabase upload failed, continuing without storage:", uploadError)
      // アップロードに失敗してもローカル処理は続行
    }

    // 文字起こし開始
    if (callbacks.onTranscribeStart) callbacks.onTranscribeStart()
    console.log("Starting transcription process")

    // 準備したファイルを直接Whisper APIに渡す
    const transcript = await transcribeAudio(preparedFile)

    console.log(`Transcription completed, length: ${transcript.length} characters`)
    if (callbacks.onTranscribeProgress) callbacks.onTranscribeProgress(100)

    // 議事録生成開始
    if (callbacks.onSummarizeStart) callbacks.onSummarizeStart()
    console.log("Starting minutes generation process")
    const minutes = await generateMinutes(transcript)
    console.log("Minutes generation completed")
    if (callbacks.onSummarizeProgress) callbacks.onSummarizeProgress(100)

    // Supabaseにデータを保存（オプション - エラーが発生しても処理を続行）
    let recordId = null
    try {
      const { data: recordData, error: recordError } = await supabase
        .from("audio_files")
        .insert([
          {
            file_path: filePath || `local/${Date.now()}-${file.name}`,
            file_name: file.name,
            transcript: transcript,
            minutes: minutes,
            created_at: new Date().toISOString(),
          },
        ])
        .select()

      if (recordError) {
        console.warn("Failed to save record to database:", recordError)
      } else {
        recordId = recordData && recordData.length > 0 ? recordData[0].id : null
        console.log("Record saved to database successfully")
      }
    } catch (dbError) {
      console.warn("Database save failed, continuing without persistence:", dbError)
    }

    return {
      transcript,
      minutes,
      filePath,
      recordId,
    }
  } catch (error) {
    console.error("Error processing audio file:", error)
    throw error
  }
}

// ファイルとデータを削除する関数
export async function deleteAudioFile(filePath: string, recordId?: number) {
  try {
    console.log(`Deleting file: ${filePath}, record ID: ${recordId}`)

    // Supabaseからファイルを削除
    if (filePath && !filePath.startsWith("local/")) {
      try {
        const { error: deleteFileError } = await supabase.storage.from(STORAGE_BUCKET).remove([filePath])

        if (deleteFileError) {
          console.warn("Failed to delete file from storage:", deleteFileError)
        }
      } catch (error) {
        console.warn("Storage deletion failed:", error)
      }
    }

    // レコードIDが指定されている場合、データベースからレコードを削除
    if (recordId) {
      try {
        const { error: deleteRecordError } = await supabase.from("audio_files").delete().eq("id", recordId)

        if (deleteRecordError) {
          console.warn("Failed to delete record from database:", deleteRecordError)
        }
      } catch (error) {
        console.warn("Database deletion failed:", error)
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Delete function error:", error)
    throw error
  }
}
