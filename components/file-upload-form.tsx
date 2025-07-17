"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileAudio, X, CheckCircle, AlertTriangle } from "lucide-react"
import { processAudioFile } from "@/lib/ffmpeg-helper"

const SUPPORTED_FORMATS = ["mp3", "wav", "m4a", "flac", "ogg", "webm"]
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB (最終的なアップロード制限)
const MAX_INPUT_FILE_SIZE = 50 * 1024 * 1024 // 50MB (入力ファイル制限 - 自動圧縮あり)
const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB chunks (Vercel制限を考慮)
const COMPRESSION_THRESHOLD = 3 * 1024 * 1024 // 3MB以上で圧縮を推奨

interface FileUploadFormProps {
  onTranscriptionComplete?: (transcript: string) => void
  onAudioProcessed?: (buffer: AudioBuffer) => void
}

export default function FileUploadForm({ onTranscriptionComplete, onAudioProcessed }: FileUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    const extension = file.name.split(".").pop()?.toLowerCase()

    if (!extension || !SUPPORTED_FORMATS.includes(extension)) {
      return `サポートされていないファイル形式です。対応形式: ${SUPPORTED_FORMATS.join(", ")}`
    }

    if (file.size > MAX_INPUT_FILE_SIZE) {
      return `ファイルサイズが大きすぎます。最大50MBまでです。現在のサイズ: ${(file.size / 1024 / 1024).toFixed(1)}MB`
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
    setTranscript("")
    setUploadProgress(0)
    setCompressionInfo(null)

    // ファイルサイズが制限を超えている場合は自動圧縮を試行
    if (selectedFile.size > MAX_FILE_SIZE) {
      setIsCompressing(true)
      try {
        console.log(`Starting compression for ${selectedFile.name}, size: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`)
        
        const { blob, type } = await processAudioFile(selectedFile, {
          compress: true,
          targetSizeMB: 3, // 3MB以下に圧縮
        })

        const compressedFile = new File([blob], selectedFile.name.replace(/\.[^/.]+$/, ".wav"), {
          type: type,
        })

        console.log(`Compression completed: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)

        // 圧縮後のサイズをチェック
        if (compressedFile.size > MAX_FILE_SIZE) {
          // 圧縮が十分でない場合は、より積極的な圧縮を試行
          console.log("First compression not sufficient, trying more aggressive compression")
          
          const { blob: blob2, type: type2 } = await processAudioFile(selectedFile, {
            compress: true,
            targetSizeMB: 2, // 2MB以下に圧縮
          })
          
          const compressedFile2 = new File([blob2], selectedFile.name.replace(/\.[^/.]+$/, ".wav"), {
            type: type2,
          })
          
          if (compressedFile2.size > MAX_FILE_SIZE) {
            setError(`ファイルサイズが大きすぎます。最大圧縮後も${(compressedFile2.size / 1024 / 1024).toFixed(1)}MBです。より小さなファイルを使用してください。`)
            setIsCompressing(false)
            return
          }
          
          setFile(compressedFile2)
          setCompressionInfo(
            `自動圧縮完了: ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB → ${(compressedFile2.size / 1024 / 1024).toFixed(1)}MB`
          )
        } else {
          setFile(compressedFile)
          setCompressionInfo(
            `自動圧縮完了: ${(selectedFile.size / 1024 / 1024).toFixed(1)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB`
          )
        }
        
        setIsCompressing(false)
      } catch (error) {
        console.error("Compression error:", error)
        setError("ファイル圧縮中にエラーが発生しました。より小さなファイルを使用してください。")
        setIsCompressing(false)
        return
      }
    } else {
      setFile(selectedFile)
    }
  }, [])

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
      const formData = new FormData()
      formData.append("file", file)  // APIルートで期待されているキー名に修正

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
            setTranscript(response.transcript)
            onTranscriptionComplete?.(response.transcript)
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
            // JSONパースエラーの場合
            setError(`サーバーエラーが発生しました。(ステータス: ${xhr.status})`)
          }
        }
        setIsUploading(false)
      }

      xhr.onerror = () => {
        setError("ネットワークエラーが発生しました。")
        setIsUploading(false)
      }

      xhr.open("POST", "/api/transcribe")
      xhr.send(formData)
    } catch (err) {
      console.error("Upload error:", err)
      setError("アップロードに失敗しました。")
      setIsUploading(false)
    }
  }

  const removeFile = () => {
    setFile(null)
    setOriginalFile(null)
    setTranscript("")
    setError(null)
    setUploadProgress(0)
    setCompressionInfo(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
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
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 文字起こし結果 */}
        {transcript && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-700">文字起こし完了</span>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{transcript}</p>
            </div>
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
