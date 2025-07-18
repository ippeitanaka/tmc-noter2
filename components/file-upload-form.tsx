"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileAudio, X, CheckCircle, AlertTriangle } from "lucide-react"
import { processAudioFile } from "@/lib/ffmpeg-helper"
import { EditableTranscript } from "./editable-transcript"
import { useApiConfig } from "@/contexts/api-config-context"

const SUPPORTED_FORMATS = ["mp3", "wav", "m4a", "flac", "ogg", "webm"]
const MAX_FILE_SIZE = 24 * 1024 * 1024 // 24MB (制限を少し下げて安全性を向上)
const MAX_INPUT_FILE_SIZE = 100 * 1024 * 1024 // 100MB (入力ファイル制限を維持)
const CHUNK_SIZE = 15 * 1024 * 1024 // 15MB chunks (分割サイズをさらに小さく)
const SAFE_CHUNK_SIZE = 1.5 * 1024 * 1024 // 1.5MB chunks (安全な分割サイズ)
const COMPRESSION_THRESHOLD = 10 * 1024 * 1024 // 10MB以上で圧縮を推奨
const MAX_RETRIES = 3 // チャンクごとの最大再試行回数

interface TranscriptionOptions {
  speakerDiarization: boolean
  generateSummary: boolean
  extractKeywords: boolean
  includeTimestamps: boolean
  sentimentAnalysis: boolean
  language: string
  model: string
}

interface ApiConfig {
  provider: 'openai' | 'assemblyai' | 'azure' | 'webspeech' | 'offline'
  apiKey?: string
  region?: string
}

interface TranscriptionResult {
  transcript: string
  speakers?: string
  summary?: string
  keywords?: string
  sentiment?: string
  structured?: string
  segments?: any[]
  duration?: number
  success: boolean
}

interface FileUploadFormProps {
  onTranscriptionComplete?: (result: TranscriptionResult) => void
  onAudioProcessed?: (buffer: AudioBuffer) => void
  onTranscriptionClear?: () => void
}

export default function FileUploadForm({ onTranscriptionComplete, onAudioProcessed, onTranscriptionClear }: FileUploadFormProps) {
  const { apiConfig } = useApiConfig()
  const [file, setFile] = useState<File | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null)
  
  // 新しい高度な設定
  const [options, setOptions] = useState<TranscriptionOptions>({
    speakerDiarization: false,
    generateSummary: true,
    extractKeywords: true,
    includeTimestamps: false,
    sentimentAnalysis: false,
    language: "ja",
    model: "whisper-1"
  })
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    const extension = file.name.split(".").pop()?.toLowerCase()

    if (!extension || !SUPPORTED_FORMATS.includes(extension)) {
      return `サポートされていないファイル形式です。対応形式: ${SUPPORTED_FORMATS.join(", ")}`
    }

    if (file.size > MAX_INPUT_FILE_SIZE) {
      return `ファイルサイズが大きすぎます。最大100MBまでです。現在のサイズ: ${(file.size / 1024 / 1024).toFixed(1)}MB`
    }

    return null
  }

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const validationError = validateFile(selectedFile)
    if (validationError) {
      setError(validationError)
      return
    }

    setOriginalFile(selectedFile)
    setError(null)
    setTranscriptionResult(null)
    setUploadProgress(0)
    setCompressionInfo(null)

    // ファイルサイズが制限を超えている場合は自動圧縮を試行
    if (selectedFile.size > MAX_FILE_SIZE) {
      setIsCompressing(true)
      try {
        const fileSizeMB = selectedFile.size / (1024 * 1024)
        console.log(`Starting compression for ${selectedFile.name}, size: ${fileSizeMB.toFixed(2)}MB`)
        
        // 段階的な圧縮処理
        let compressedFile = selectedFile
        
        // 1. 最初に16kHz、16bit圧縮を試行
        if (fileSizeMB > 5) {
          const compressed = await compressAudioFile(selectedFile, 16000, 16)
          if (compressed.size <= MAX_FILE_SIZE) {
            compressedFile = new File([compressed], selectedFile.name.replace(/\.[^/.]+$/, ".wav"), {
              type: "audio/wav",
            })
          }
        }
        
        // 2. まだ大きすぎる場合、12kHz、8bit圧縮を試行
        if (compressedFile.size > MAX_FILE_SIZE && fileSizeMB > 10) {
          const compressed = await compressAudioFile(selectedFile, 12000, 8)
          if (compressed.size <= MAX_FILE_SIZE) {
            compressedFile = new File([compressed], selectedFile.name.replace(/\.[^/.]+$/, ".wav"), {
              type: "audio/wav",
            })
          }
        }
        
        // 3. まだ大きすぎる場合、8kHz、8bit圧縮を試行
        if (compressedFile.size > MAX_FILE_SIZE) {
          const compressed = await compressAudioFile(selectedFile, 8000, 8)
          if (compressed.size <= MAX_FILE_SIZE) {
            compressedFile = new File([compressed], selectedFile.name.replace(/\.[^/.]+$/, ".wav"), {
              type: "audio/wav",
            })
          }
        }
        
        // 圧縮結果の確認
        if (compressedFile.size <= MAX_FILE_SIZE && compressedFile !== selectedFile) {
          setFile(compressedFile)
          setCompressionInfo(
            `圧縮完了: ${fileSizeMB.toFixed(1)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB`
          )
        } else {
          // 圧縮に失敗した場合、元のファイルを保持して分割処理
          setFile(selectedFile)
          setCompressionInfo(
            `大きなファイルは自動的に分割して処理されます: ${fileSizeMB.toFixed(1)}MB`
          )
        }
        
        setIsCompressing(false)
      } catch (error) {
        console.error("Compression error:", error)
        
        // 圧縮に失敗した場合は元のファイルを保持してチャンク処理
        const fileSizeMB = selectedFile.size / (1024 * 1024)
        setFile(selectedFile)
        setCompressionInfo(
          `圧縮に失敗しました。大きなファイルは自動的に分割して処理されます: ${fileSizeMB.toFixed(1)}MB`
        )
        setIsCompressing(false)
      }
    } else {
      setFile(selectedFile)
    }
  }, [])

  const compressAudioFile = async (file: File, targetSampleRate: number, bitsPerSample: number): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const arrayBuffer = await file.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        console.log(`Compressing: ${(file.size / 1024 / 1024).toFixed(2)}MB -> target ${targetSampleRate}Hz, ${bitsPerSample}bit`)
        
        // リサンプリング用のオフラインコンテキスト（モノラル）
        const offlineContext = new OfflineAudioContext(
          1, // モノラル
          Math.ceil(audioBuffer.length * targetSampleRate / audioBuffer.sampleRate),
          targetSampleRate
        )
        
        const source = offlineContext.createBufferSource()
        source.buffer = audioBuffer
        source.connect(offlineContext.destination)
        source.start()
        
        const resampledBuffer = await offlineContext.startRendering()
        const compressed = await audioBufferToCompressedWav(resampledBuffer, bitsPerSample)
        
        await audioContext.close()
        
        console.log(`Compression result: ${(compressed.size / 1024 / 1024).toFixed(2)}MB`)
        resolve(compressed)
      } catch (error) {
        console.error("Compression failed:", error)
        reject(error)
      }
    })
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const uploadFile = async () => {
    if (!file) return

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // 大きなファイルの場合は分割処理
      if (file.size > CHUNK_SIZE) {
        await uploadLargeFile(file)
      } else {
        await uploadSingleFile(file)
      }
    } catch (error) {
      console.error("Upload error:", error)
      setError("アップロード中にエラーが発生しました。")
      setIsUploading(false)
    }
  }

  const uploadSingleFile = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    
    // API設定を追加
    formData.append("provider", apiConfig.provider)
    if (apiConfig.apiKey) {
      formData.append("apiKey", apiConfig.apiKey)
    }
    if (apiConfig.region) {
      formData.append("region", apiConfig.region)
    }
    
    // 高度な設定を追加
    formData.append("speakerDiarization", options.speakerDiarization.toString())
    formData.append("generateSummary", options.generateSummary.toString())
    formData.append("extractKeywords", options.extractKeywords.toString())
    formData.append("includeTimestamps", options.includeTimestamps.toString())
    formData.append("sentimentAnalysis", options.sentimentAnalysis.toString())
    formData.append("language", options.language)
    formData.append("model", options.model)

    // Web Speech APIの場合はクライアントサイドで処理
    if (apiConfig.provider === 'webspeech') {
      await handleWebSpeechTranscription(file)
      return
    }

    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100
        setUploadProgress(progress)
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText)
        if (response.transcript) {
          setTranscriptionResult(response)
          onTranscriptionComplete?.(response)
        } else {
          setError("文字起こしに失敗しました。")
        }
      } else if (xhr.status === 413) {
        setError("ファイルサイズが大きすぎます。自動圧縮に失敗しました。")
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText)
          setError(errorResponse.error || "文字起こしに失敗しました。")
        } catch (e) {
          setError(`サーバーエラーが発生しました。(ステータス: ${xhr.status})`)
        }
      }
      setIsUploading(false)
    }

    xhr.onerror = () => {
      setError("ネットワークエラーが発生しました。")
      setIsUploading(false)
    }

    xhr.open("POST", "/api/transcribe-multi")
    xhr.send(formData)
  }

  // Web Speech APIを使用した文字起こし
  const handleWebSpeechTranscription = async (file: File) => {
    try {
      // Web Speech APIのサポートをチェック
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        throw new Error('このブラウザはWeb Speech APIをサポートしていません。ChromeまたはEdgeをご使用ください。')
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = options.language === 'ja' ? 'ja-JP' : 'en-US'
      recognition.maxAlternatives = 3

      let fullTranscript = ''
      let isRecognitionActive = false

      const audio = new Audio(URL.createObjectURL(file))

      recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1]
        if (result.isFinal) {
          fullTranscript += result[0].transcript + ' '
          setUploadProgress(Math.min((audio.currentTime / audio.duration) * 100, 100))
        }
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setError(`音声認識エラー: ${event.error}`)
        setIsUploading(false)
      }

      recognition.onend = () => {
        isRecognitionActive = false
        if (fullTranscript.trim()) {
          const result: TranscriptionResult = {
            transcript: fullTranscript.trim(),
            success: true
          }
          setTranscriptionResult(result)
          onTranscriptionComplete?.(result)
        } else {
          setError('音声を認識できませんでした。音声が明瞭で雑音が少ないファイルを使用してください。')
        }
        setIsUploading(false)
      }

      // 音声再生開始
      audio.onloadedmetadata = () => {
        recognition.start()
        isRecognitionActive = true
        audio.play()
      }

      audio.onended = () => {
        setTimeout(() => {
          if (isRecognitionActive) {
            recognition.stop()
          }
        }, 1000) // 1秒待ってから認識を停止
      }

      audio.onerror = () => {
        setError('音声ファイルの再生に失敗しました。')
        setIsUploading(false)
      }

    } catch (error) {
      console.error('Web Speech transcription error:', error)
      setError(error instanceof Error ? error.message : '音声認識に失敗しました。')
      setIsUploading(false)
    }
  }

  const uploadLargeFile = async (file: File) => {
    // 大きなファイルを分割して処理
    try {
      console.log("Starting large file upload processing...")
      const chunks = await splitAudioFile(file)
      const transcripts: string[] = []
      const errors: string[] = []
      
      console.log(`Processing ${chunks.length} chunks...`)
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const progress = ((i + 1) / chunks.length) * 100
        setUploadProgress(progress)

        let transcript = ""
        let lastError = null
        
        // チャンクごとに最大3回まで再試行
        for (let retry = 0; retry < MAX_RETRIES; retry++) {
          try {
            console.log(`Processing chunk ${i + 1}/${chunks.length} (attempt ${retry + 1}/${MAX_RETRIES})...`)
            transcript = await transcribeChunk(chunk, i)
            
            if (transcript && transcript.trim().length > 0) {
              console.log(`Chunk ${i + 1} completed successfully (${transcript.length} chars)`)
              break // 成功したのでretryループを抜ける
            } else {
              throw new Error("Empty transcript returned")
            }
          } catch (error) {
            lastError = error
            console.error(`Error transcribing chunk ${i + 1} (attempt ${retry + 1}):`, error)
            
            if (retry < MAX_RETRIES - 1) {
              // 再試行前に待機（指数バックオフ）
              const waitTime = Math.pow(2, retry) * 1000 // 1秒、2秒、4秒
              console.log(`Retrying chunk ${i + 1} in ${waitTime}ms...`)
              await new Promise(resolve => setTimeout(resolve, waitTime))
            }
          }
        }

        if (transcript && transcript.trim().length > 0) {
          transcripts.push(transcript)
        } else {
          // 全ての再試行が失敗した場合
          const errorMsg = `チャンク ${i + 1}: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`
          errors.push(errorMsg)
          transcripts.push("") // 空文字列を追加して位置を保持
          console.log(`Chunk ${i + 1} failed after ${MAX_RETRIES} attempts, continuing...`)
        }
        
        // API制限を避けるため、チャンク間の待機時間を調整
        if (i < chunks.length - 1) {
          const waitTime = errors.length > 0 ? 2000 : 1500 // エラーがある場合は長めに待機
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }

      // 結果の処理
      const validTranscripts = transcripts.filter(t => t.trim().length > 0)
      
      if (validTranscripts.length === 0) {
        throw new Error("すべてのチャンクの処理に失敗しました。ファイルを小さく分割して再試行してください。")
      }
      
      const finalTranscript = validTranscripts.join(' ')
      console.log(`Large file processing completed. Valid chunks: ${validTranscripts.length}/${chunks.length}, Final transcript length: ${finalTranscript.length}`)
      
      const finalResult: TranscriptionResult = {
        transcript: finalTranscript,
        success: true
      }
      
      // エラーサマリーの作成
      if (errors.length > 0) {
        const successRate = ((validTranscripts.length / chunks.length) * 100).toFixed(0)
        let errorMessage = `${errors.length}個のチャンクでエラーが発生しましたが、残りの処理は完了しました。\n`
        errorMessage += `成功率: ${successRate}% (${validTranscripts.length}/${chunks.length})\n\n`
        
        if (errors.length <= 3) {
          errorMessage += "エラー詳細:\n" + errors.join('\n')
        } else {
          errorMessage += `エラー例 (最初の3件):\n${errors.slice(0, 3).join('\n')}\n...他${errors.length - 3}件`
        }
        
        errorMessage += "\n\n改善方法:\n• ファイルサイズを小さくして再試行\n• 音声編集ソフトで圧縮\n• 複数の小さなファイルに分割"
        
        setError(errorMessage)
      }
      
      setTranscriptionResult(finalResult)
      onTranscriptionComplete?.(finalResult)
      setIsUploading(false)
    } catch (error) {
      console.error("Large file upload error:", error)
      setError(error instanceof Error ? error.message : "大きなファイルの処理中にエラーが発生しました。")
      setIsUploading(false)
    }
  }

  const splitAudioFile = async (file: File): Promise<Blob[]> => {
    // より効率的な音声ファイル分割（3分ごと）
    const chunks: Blob[] = []
    const chunkDuration = 180 // 3分 = 180秒（より小さなチャンク）
    
    try {
      const fileSizeMB = file.size / (1024 * 1024)
      console.log(`Splitting large file: ${fileSizeMB.toFixed(2)}MB`)

      // 大きなファイルの場合、より短い間隔で分割
      if (fileSizeMB > 50) {
        // 50MB以上の場合は2分間隔
        const chunkDurationAdjusted = 120 // 2分
        return await splitAudioBySize(file, chunkDurationAdjusted)
      } else if (fileSizeMB > 20) {
        // 20MB以上の場合は2.5分間隔
        const chunkDurationAdjusted = 150 // 2.5分
        return await splitAudioBySize(file, chunkDurationAdjusted)
      }

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      const sampleRate = audioBuffer.sampleRate
      const chunkSamples = chunkDuration * sampleRate
      const totalChunks = Math.ceil(audioBuffer.length / chunkSamples)
      
      console.log(`Creating ${totalChunks} chunks of ${chunkDuration}s each`)

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSamples
        const end = Math.min(start + chunkSamples, audioBuffer.length)
        
        const chunkBuffer = audioContext.createBuffer(
          1, // 常にモノラル
          end - start,
          Math.min(sampleRate, 16000) // 16kHzに制限
        )
        
        // モノラルに変換して音声データをコピー
        const chunkData = chunkBuffer.getChannelData(0)
        for (let j = 0; j < end - start; j++) {
          let sample = 0
          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            sample += audioBuffer.getChannelData(channel)[start + j]
          }
          chunkData[j] = sample / audioBuffer.numberOfChannels
        }
        
        // AudioBufferをWAVファイルに変換（8bit圧縮）
        const wavBlob = await audioBufferToCompressedWav(chunkBuffer, 8)
        chunks.push(wavBlob)
      }
      
      await audioContext.close()
      console.log(`Split complete: ${chunks.length} chunks created`)
      return chunks
    } catch (error) {
      console.error("Error splitting audio file:", error)
      // フォールバック: バイナリレベルでの分割
      return await splitAudioBySize(file, 60) // 1分間隔
    }
  }

  // バイナリレベルでの音声分割（メモリ効率的）
  const splitAudioBySize = async (file: File, chunkDurationSeconds: number): Promise<Blob[]> => {
    const chunks: Blob[] = []
    const chunkSize = SAFE_CHUNK_SIZE // 1.5MBずつ分割（安全なサイズ）
    
    console.log(`Binary split: splitting ${(file.size / 1024 / 1024).toFixed(2)}MB file into ${(chunkSize / 1024 / 1024).toFixed(1)}MB chunks`)
    
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, file.size)
      const chunk = file.slice(offset, end)
      
      // チャンクが小さすぎる場合（100KB未満）はスキップ
      if (chunk.size < 100 * 1024) {
        console.log(`Skipping small chunk: ${(chunk.size / 1024).toFixed(1)}KB`)
        continue
      }
      
      chunks.push(chunk)
    }
    
    console.log(`Binary split: ${chunks.length} chunks of ~${(chunkSize / 1024 / 1024).toFixed(1)}MB each`)
    
    // あまりに多くのチャンクができた場合は警告
    if (chunks.length > 20) {
      console.warn(`Warning: Created ${chunks.length} chunks, which may hit API rate limits`)
    }
    
    return chunks
  }

  // 圧縮されたWAVファイルを生成
  const audioBufferToCompressedWav = (buffer: AudioBuffer, bitsPerSample: number = 8): Promise<Blob> => {
    return new Promise((resolve) => {
      const length = buffer.length
      const numberOfChannels = buffer.numberOfChannels
      const sampleRate = buffer.sampleRate
      
      const bytesPerSample = bitsPerSample / 8
      const dataSize = length * numberOfChannels * bytesPerSample
      
      const arrayBuffer = new ArrayBuffer(44 + dataSize)
      const view = new DataView(arrayBuffer)
      
      // WAVヘッダーを作成
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i))
        }
      }
      
      writeString(0, "RIFF")
      view.setUint32(4, 36 + dataSize, true)
      writeString(8, "WAVE")
      writeString(12, "fmt ")
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true)
      view.setUint16(22, numberOfChannels, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true)
      view.setUint16(32, numberOfChannels * bytesPerSample, true)
      view.setUint16(34, bitsPerSample, true)
      writeString(36, "data")
      view.setUint32(40, dataSize, true)
      
      // 音声データを書き込み
      let offset = 44
      for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
          
          if (bitsPerSample === 8) {
            const unsignedSample = Math.round((sample + 1) * 127.5)
            view.setUint8(offset, unsignedSample)
            offset += 1
          } else {
            const signedSample = Math.round(sample * 32767)
            view.setInt16(offset, signedSample, true)
            offset += 2
          }
        }
      }
      
      resolve(new Blob([arrayBuffer], { type: "audio/wav" }))
    })
  }

  const audioBufferToWav = (buffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve) => {
      const length = buffer.length
      const numberOfChannels = buffer.numberOfChannels
      const sampleRate = buffer.sampleRate
      const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
      const view = new DataView(arrayBuffer)
      
      // WAVヘッダーを書き込み
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i))
        }
      }
      
      writeString(0, 'RIFF')
      view.setUint32(4, 36 + length * numberOfChannels * 2, true)
      writeString(8, 'WAVE')
      writeString(12, 'fmt ')
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true)
      view.setUint16(22, numberOfChannels, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * numberOfChannels * 2, true)
      view.setUint16(32, numberOfChannels * 2, true)
      view.setUint16(34, 16, true)
      writeString(36, 'data')
      view.setUint32(40, length * numberOfChannels * 2, true)
      
      // 音声データを書き込み
      let offset = 44
      for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
          offset += 2
        }
      }
      
      resolve(new Blob([arrayBuffer], { type: 'audio/wav' }))
    })
  }

  const transcribeChunk = async (chunk: Blob, index: number): Promise<string> => {
    const formData = new FormData()
    
    // チャンクのファイル名を適切に設定
    const extension = chunk.type.includes('webm') ? 'webm' : 'wav'
    formData.append("file", chunk, `chunk_${index}.${extension}`)
    
    // API設定を追加
    formData.append("provider", apiConfig.provider)
    if (apiConfig.apiKey) {
      formData.append("apiKey", apiConfig.apiKey)
    }
    if (apiConfig.region) {
      formData.append("region", apiConfig.region)
    }
    
    // 高度な設定を追加（チャンクでは簡略化）
    formData.append("speakerDiarization", "false") // チャンクでは無効
    formData.append("generateSummary", "false") // チャンクでは無効
    formData.append("extractKeywords", "false") // チャンクでは無効
    formData.append("includeTimestamps", "false") // チャンクでは無効
    formData.append("sentimentAnalysis", "false") // チャンクでは無効
    formData.append("language", options.language)
    formData.append("model", options.model)

    console.log(`Transcribing chunk ${index + 1}, size: ${(chunk.size / 1024 / 1024).toFixed(2)}MB, type: ${chunk.type}`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000) // 90秒タイムアウト

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP error! status: ${response.status}`
        
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorMessage
          
          // 詳細なエラー情報があれば追加
          if (errorData.details) {
            errorMessage += ` - ${errorData.details}`
          }
        } catch (e) {
          // JSON解析に失敗した場合は元のエラーメッセージを使用
          if (errorText.length > 0) {
            errorMessage = errorText.substring(0, 200) // 長すぎる場合は切り詰め
          }
        }
        
        console.error(`Chunk ${index + 1} error:`, errorMessage)
        throw new Error(errorMessage)
      }

      // 成功レスポンスの安全な処理
      const responseText = await response.text()
      if (!responseText) {
        throw new Error(`Chunk ${index + 1}: Empty response from API`)
      }

      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error(`Chunk ${index + 1} JSON parse error:`, parseError)
        console.error("Response text:", responseText.substring(0, 500))
        throw new Error(`Chunk ${index + 1}: Failed to parse response - ${parseError}`)
      }
      
      if (!result.transcript || result.transcript.trim().length === 0) {
        throw new Error("Empty transcript returned from API")
      }
      
      console.log(`Chunk ${index + 1} completed, transcript length: ${result.transcript.length}`)
      return result.transcript || ""
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Chunk ${index + 1} timed out after 90 seconds`)
      }
      
      throw error
    }
  }

  const removeFile = () => {
    setFile(null)
    setOriginalFile(null)
    setTranscriptionResult(null)
    setError(null)
    setUploadProgress(0)
    setCompressionInfo(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    // 親コンポーネントの削除ハンドラーを呼び出す
    if (onTranscriptionClear) {
      onTranscriptionClear()
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileAudio className="h-5 w-5" />
          音声ファイルアップロード
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ファイル選択エリア */}
        {!file && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">ファイルをタップ</p>
            <p className="text-sm text-gray-500 mb-4">または、ドラッグ&ドロップ</p>
            <p className="text-xs text-gray-400">対応形式: {SUPPORTED_FORMATS.join(", ").toUpperCase()} (最大50MB・自動圧縮)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={SUPPORTED_FORMATS.map((format) => `.${format}`).join(",")}
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        )}

        {/* 圧縮処理中の表示 */}
        {isCompressing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
              <span className="text-sm">ファイルを圧縮中...</span>
            </div>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {/* 圧縮情報の表示 */}
        {compressionInfo && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-sm text-green-700">
              {compressionInfo}
            </AlertDescription>
          </Alert>
        )}

        {/* 選択されたファイル情報 */}
        {file && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileAudio className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium text-gray-800">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                  {originalFile && originalFile.size !== file.size && (
                    <p className="text-xs text-green-600 mt-1">
                      🗜️ 圧縮済み (元: {formatFileSize(originalFile.size)})
                    </p>
                  )}
                  {file.size > COMPRESSION_THRESHOLD && (
                    <p className="text-xs text-blue-600 mt-1">
                      💡 大きなファイルのため、自動圧縮して処理します
                    </p>
                  )}
                  {file.size > MAX_FILE_SIZE && (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ ファイルサイズが制限を超えています。音声編集ソフトで圧縮してください。
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={removeFile} className="text-gray-500 hover:text-red-500">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* アップロード進行状況 */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>アップロード中...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <div className="whitespace-pre-line">{error}</div>
                
                {/* チャンクエラーの詳細説明 */}
                {error.includes("チャンク") && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                    <h4 className="font-medium text-orange-800 mb-2">🔧 改善方法</h4>
                    <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
                      <li>音声ファイルのサイズを10MB以下に圧縮</li>
                      <li>音声編集ソフト（Audacity等）で品質を下げる</li>
                      <li>長い音声を5分程度の短いファイルに分割</li>
                      <li>モノラル音声に変換して容量を削減</li>
                      <li>サンプリングレートを22kHzに下げる</li>
                    </ul>
                  </div>
                )}
                
                {/* ネットワークエラーの詳細説明 */}
                {error.includes("ネットワーク") && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="font-medium text-blue-800 mb-2">🌐 ネットワーク対策</h4>
                    <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                      <li>安定したWi-Fi接続を使用</li>
                      <li>モバイルデータの場合は電波状況を確認</li>
                      <li>他のダウンロード/アップロードを停止</li>
                      <li>ファイルサイズを5MB以下に圧縮</li>
                    </ul>
                  </div>
                )}
                
                {/* API制限エラーの詳細説明 */}
                {(error.includes("429") || error.includes("レート制限")) && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                    <h4 className="font-medium text-purple-800 mb-2">⏰ API制限対策</h4>
                    <ul className="text-sm text-purple-700 space-y-1 list-disc list-inside">
                      <li>5〜10分待ってから再試行</li>
                      <li>より小さなファイルで処理</li>
                      <li>時間をおいて複数回に分けて処理</li>
                    </ul>
                  </div>
                )}
                
                {/* 一般的な対策 */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <h4 className="font-medium text-gray-800 mb-2">💡 推奨設定</h4>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    <li>ファイル形式: MP3, WAV, M4A</li>
                    <li>推奨サイズ: 10MB以下</li>
                    <li>推奨時間: 10分以下</li>
                    <li>音質: 64kbps〜128kbps程度</li>
                  </ul>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 高度な設定 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">文字起こし設定</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            >
              {showAdvancedSettings ? "設定を非表示" : "詳細設定"}
            </Button>
          </div>

          {showAdvancedSettings && (
            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={options.speakerDiarization}
                      onChange={(e) => setOptions({...options, speakerDiarization: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">話者識別</span>
                  </label>
                  <p className="text-xs text-gray-600">複数の話者を自動的に識別</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={options.generateSummary}
                      onChange={(e) => setOptions({...options, generateSummary: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">要約生成</span>
                  </label>
                  <p className="text-xs text-gray-600">自動的に要約を生成</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={options.extractKeywords}
                      onChange={(e) => setOptions({...options, extractKeywords: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">キーワード抽出</span>
                  </label>
                  <p className="text-xs text-gray-600">重要なキーワードを抽出</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={options.includeTimestamps}
                      onChange={(e) => setOptions({...options, includeTimestamps: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">タイムスタンプ</span>
                  </label>
                  <p className="text-xs text-gray-600">時間情報を含める</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={options.sentimentAnalysis}
                      onChange={(e) => setOptions({...options, sentimentAnalysis: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">感情分析</span>
                  </label>
                  <p className="text-xs text-gray-600">感情やトーンを分析</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">言語</label>
                  <select
                    value={options.language}
                    onChange={(e) => setOptions({...options, language: e.target.value})}
                    className="w-full p-2 border rounded"
                  >
                    <option value="ja">日本語</option>
                    <option value="en">英語</option>
                    <option value="zh">中国語</option>
                    <option value="ko">韓国語</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 文字起こし結果 */}
        {transcriptionResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-700">文字起こし完了</span>
            </div>
            
            {/* 基本文字起こし */}
            <div className="space-y-2">
              <h3 className="font-medium">文字起こし結果</h3>
              <EditableTranscript
                initialText={transcriptionResult.transcript}
                onSave={(text: string) => {
                  setTranscriptionResult({
                    ...transcriptionResult,
                    transcript: text
                  })
                }}
              />
            </div>
            
            {/* 構造化された文字起こし */}
            {transcriptionResult.structured && (
              <div className="space-y-2">
                <h3 className="font-medium">構造化された文字起こし</h3>
                <div className="p-4 border rounded-lg bg-gray-50">
                  <pre className="whitespace-pre-wrap text-sm">{transcriptionResult.structured}</pre>
                </div>
              </div>
            )}
            
            {/* 話者識別結果 */}
            {transcriptionResult.speakers && (
              <div className="space-y-2">
                <h3 className="font-medium">話者識別</h3>
                <div className="p-4 border rounded-lg bg-blue-50">
                  <pre className="whitespace-pre-wrap text-sm">{transcriptionResult.speakers}</pre>
                </div>
              </div>
            )}
            
            {/* 要約 */}
            {transcriptionResult.summary && (
              <div className="space-y-2">
                <h3 className="font-medium">要約</h3>
                <div className="p-4 border rounded-lg bg-green-50">
                  <pre className="whitespace-pre-wrap text-sm">{transcriptionResult.summary}</pre>
                </div>
              </div>
            )}
            
            {/* キーワード */}
            {transcriptionResult.keywords && (
              <div className="space-y-2">
                <h3 className="font-medium">キーワード</h3>
                <div className="p-4 border rounded-lg bg-yellow-50">
                  <pre className="whitespace-pre-wrap text-sm">{transcriptionResult.keywords}</pre>
                </div>
              </div>
            )}
            
            {/* 感情分析 */}
            {transcriptionResult.sentiment && (
              <div className="space-y-2">
                <h3 className="font-medium">感情分析</h3>
                <div className="p-4 border rounded-lg bg-purple-50">
                  <pre className="whitespace-pre-wrap text-sm">{transcriptionResult.sentiment}</pre>
                </div>
              </div>
            )}
            
            {/* タイムスタンプ情報 */}
            {transcriptionResult.segments && (
              <div className="space-y-2">
                <h3 className="font-medium">タイムスタンプ</h3>
                <div className="max-h-60 overflow-y-auto p-4 border rounded-lg bg-gray-50">
                  {transcriptionResult.segments.map((segment: any, index: number) => (
                    <div key={index} className="flex items-start gap-2 mb-2">
                      <span className="text-xs text-gray-500 min-w-[60px]">
                        {Math.floor(segment.start / 60)}:{String(Math.floor(segment.start % 60)).padStart(2, '0')}
                      </span>
                      <span className="text-sm">{segment.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* アップロードボタン */}
        <Button onClick={uploadFile} disabled={!file || isUploading || isCompressing} className="w-full">
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              処理中...
            </>
          ) : isCompressing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              圧縮中...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              文字起こしを開始
            </>
          )}
        </Button>

        {/* 使用上の注意 */}
        <Alert>
          <AlertDescription className="text-sm">
            <strong>使用上の注意:</strong>
            <ul className="mt-1 ml-4 list-disc text-xs space-y-1">
              <li>音声が明瞭で雑音の少ないファイルほど精度が向上します</li>
              <li>日本語の音声に最適化されています</li>
              <li>処理時間はファイルサイズによって異なります</li>
              <li>アップロードされたファイルは処理後に自動削除されます</li>
              <li><strong>自動圧縮:</strong> 4MB以上のファイルは自動的に圧縮されます</li>
              <li><strong>最大50MB:</strong> 入力ファイルは最大50MBまで対応</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

// Provide a named export so it can be imported with
// `import { FileUploadForm } from "@/components/file-upload-form"`
export { FileUploadForm }
