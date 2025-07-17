"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Mic, MicOff, AlertTriangle, Wifi, WifiOff } from "lucide-react"
import { TranscriptEditor } from "./editable-transcript"

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message?: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
    webkitSpeechGrammarList: any
    webkitSpeechRecognitionEvent: any
  }
}

const RealtimeTranscription = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  const [autoRestart, setAutoRestart] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "error">("disconnected")
  const [errorCount, setErrorCount] = useState(0)
  const [networkError, setNetworkError] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isUserStoppedRef = useRef(false)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxRetries = 3

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      setError("このブラウザは音声認識をサポートしていません。Chrome、Edge、Safariをお試しください。")
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
      }
    }
  }, [])

  const startRecognition = useCallback(() => {
    if (!isSupported) return

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()

      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "ja-JP"

      recognition.onstart = () => {
        console.log("音声認識開始:", new Date().toISOString())
        setIsRecording(true)
        setError(null)
        setConnectionStatus("connected")
        setNetworkError(false)
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = ""
        let interimText = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimText += result[0].transcript
          }
        }

        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript)
        }
        setInterimTranscript(interimText)
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("音声認識エラー:", event.error, new Date().toISOString())
        setConnectionStatus("error")

        if (event.error === "network") {
          setNetworkError(true)
          setError("ネットワークエラーが発生しました。インターネット接続を確認してください。")
        } else if (event.error === "not-allowed") {
          setError("マイクへのアクセスが拒否されました。ブラウザの設定でマイクの使用を許可してください。")
          setIsRecording(false)
          isUserStoppedRef.current = true
          return
        } else {
          setError(`音声認識エラー: ${event.error}`)
        }

        setErrorCount((prev) => prev + 1)
      }

      recognition.onend = () => {
        console.log("音声認識終了:", new Date().toISOString())
        setIsRecording(false)
        setConnectionStatus("disconnected")

        console.log("ユーザーによる停止フラグ:", isUserStoppedRef.current)

        if (!isUserStoppedRef.current && autoRestart && errorCount < maxRetries) {
          console.log("音声認識を自動的に再開します...")
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current)
          }

          const delay = networkError ? 5000 : 2000 // ネットワークエラーの場合は5秒待機
          restartTimeoutRef.current = setTimeout(() => {
            if (!isUserStoppedRef.current && isRecording) {
              console.log("音声認識を再開します...", new Date().toISOString())
              startRecognition()
            } else {
              console.log("ユーザーによる停止または録音状態ではないため、再開しません")
            }
          }, delay)
        } else if (errorCount >= maxRetries) {
          setError(`最大再試行回数(${maxRetries}回)に達しました。手動で再開してください。`)
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error("音声認識の開始に失敗:", err)
      setError("音声認識の開始に失敗しました。")
      setIsRecording(false)
    }
  }, [isSupported, autoRestart, errorCount, maxRetries, networkError, isRecording])

  const stopRecognition = useCallback(() => {
    console.log("ユーザーによる録音停止", new Date().toISOString())
    isUserStoppedRef.current = true
    setIsRecording(false)
    setConnectionStatus("disconnected")
    setErrorCount(0)
    setNetworkError(false)

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }, [])

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecognition()
    } else {
      isUserStoppedRef.current = false
      setErrorCount(0)
      setError(null)
      startRecognition()
    }
  }

  const clearTranscript = () => {
    setTranscript("")
    setInterimTranscript("")
    setError(null)
    setErrorCount(0)
    setNetworkError(false)
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            リアルタイム音声認識
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              このブラウザは音声認識をサポートしていません。Chrome、Edge、Safariをお試しください。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          リアルタイム音声認識
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 接続状態表示 */}
        <div className="flex items-center gap-2 text-sm">
          <span>接続状態:</span>
          {connectionStatus === "connected" && (
            <div className="flex items-center gap-1 text-green-600">
              <Wifi className="h-4 w-4" />
              <span>接続中</span>
            </div>
          )}
          {connectionStatus === "disconnected" && (
            <div className="flex items-center gap-1 text-gray-500">
              <WifiOff className="h-4 w-4" />
              <span>切断</span>
            </div>
          )}
          {connectionStatus === "error" && (
            <div className="flex items-center gap-1 text-red-600">
              <WifiOff className="h-4 w-4" />
              <span>
                エラー ({errorCount}/{maxRetries})
              </span>
            </div>
          )}
        </div>

        {/* 自動再開設定 */}
        <div className="flex items-center space-x-2">
          <Switch id="auto-restart" checked={autoRestart} onCheckedChange={setAutoRestart} />
          <Label htmlFor="auto-restart">自動再開を有効にする</Label>
        </div>

        {/* エラー表示 */}
        {error && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* ネットワークエラー警告 */}
        {networkError && (
          <Alert>
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              ネットワーク接続に問題があります。Wi-Fiまたはモバイルデータの接続を確認してください。
            </AlertDescription>
          </Alert>
        )}

        {/* 使用上の注意 */}
        <Alert>
          <AlertDescription className="text-sm">
            <strong>使用上の注意:</strong>
            <ul className="mt-1 ml-4 list-disc text-xs space-y-1">
              <li>マイクへのアクセス許可が必要です</li>
              <li>安定したインターネット接続が必要です</li>
              <li>ブラウザによっては一定時間で自動停止する場合があります</li>
              <li>自動再開機能は不安定な場合があります</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* 録音ボタン */}
        <div className="flex gap-2">
          <Button
            onClick={handleToggleRecording}
            className={`flex items-center gap-2 ${
              isRecording ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {isRecording ? (
              <>
                <MicOff className="h-4 w-4" />
                録音停止
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                録音開始
              </>
            )}
          </Button>

          <Button onClick={clearTranscript} variant="outline" disabled={!transcript && !interimTranscript}>
            クリア
          </Button>
        </div>

        {/* 文字起こし結果 */}
        <div className="space-y-4">
          <div className="min-h-[200px] p-3 border rounded-md bg-gray-50">
            <div className="whitespace-pre-wrap">
              {transcript}
              {interimTranscript && <span className="text-gray-500 italic">{interimTranscript}</span>}
            </div>
            {!transcript && !interimTranscript && (
              <div className="text-gray-400 text-center py-8">録音ボタンを押して音声認識を開始してください</div>
            )}
          </div>
          
          {/* 編集可能な文字起こし結果 */}
          {transcript && (
            <TranscriptEditor
              transcript={transcript}
              onTranscriptChange={setTranscript}
              isRealtime={true}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default RealtimeTranscription
export { RealtimeTranscription }
