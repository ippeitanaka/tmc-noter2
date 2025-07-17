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
  const [autoRestart, setAutoRestart] = useState(true) // デフォルトでON
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "error">("disconnected")
  const [errorCount, setErrorCount] = useState(0)
  const [networkError, setNetworkError] = useState(false)
  const [lastActivityTime, setLastActivityTime] = useState(Date.now())

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isUserStoppedRef = useRef(false)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxRetries = 5
  const activityTimeoutDuration = 15000 // 15秒間無活動で再開

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      setError("このブラウザは音声認識をサポートしていません。Chrome、Edge、Safariをお試しください。")
    }

    // ネットワーク状態の監視
    const handleOnline = () => {
      console.log("ネットワーク接続が復旧しました")
      setNetworkError(false)
      if (autoRestart && !isUserStoppedRef.current && !isRecording) {
        setTimeout(() => startRecognition(), 1000)
      }
    }

    const handleOffline = () => {
      console.log("ネットワーク接続が切断されました")
      setNetworkError(true)
      setConnectionStatus("error")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current)
      }
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [autoRestart, isRecording])

  const startRecognition = useCallback(() => {
    if (!isSupported) return

    try {
      // 既存の認識を停止
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }

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
        setLastActivityTime(Date.now())

        // アクティビティタイムアウトの設定
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current)
        }
        activityTimeoutRef.current = setTimeout(() => {
          console.log("アクティビティタイムアウト - 音声認識を再開します")
          if (!isUserStoppedRef.current && autoRestart) {
            recognition.stop() // 現在の認識を停止して再開
          }
        }, activityTimeoutDuration)
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        setLastActivityTime(Date.now())
        
        // アクティビティタイムアウトをリセット
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current)
        }
        activityTimeoutRef.current = setTimeout(() => {
          console.log("アクティビティタイムアウト - 音声認識を再開します")
          if (!isUserStoppedRef.current && autoRestart) {
            recognition.stop() // 現在の認識を停止して再開
          }
        }, activityTimeoutDuration)

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
          setErrorCount(0) // 成功時にエラーカウントをリセット
        }
        setInterimTranscript(interimText)
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("音声認識エラー:", event.error, event.message, new Date().toISOString())
        setConnectionStatus("error")

        // エラーカウントを増加
        setErrorCount((prev) => prev + 1)

        if (event.error === "network") {
          setNetworkError(true)
          setError("ネットワークエラーが発生しました。自動的に再試行します。")
        } else if (event.error === "not-allowed") {
          setError("マイクへのアクセスが拒否されました。ブラウザの設定でマイクの使用を許可してください。")
          setIsRecording(false)
          isUserStoppedRef.current = true
          return
        } else if (event.error === "no-speech") {
          console.log("無音検出 - 自動的に再開します")
          // 無音エラーは通常のエラーとして扱わない
          setErrorCount((prev) => Math.max(0, prev - 1))
        } else {
          setError(`音声認識エラー: ${event.error}`)
        }
      }

      recognition.onend = () => {
        console.log("音声認識終了:", new Date().toISOString())
        setIsRecording(false)
        setConnectionStatus("disconnected")

        // アクティビティタイムアウトをクリア
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current)
        }

        console.log("ユーザーによる停止フラグ:", isUserStoppedRef.current)
        console.log("自動再開フラグ:", autoRestart)
        console.log("エラーカウント:", errorCount)

        if (!isUserStoppedRef.current && autoRestart && errorCount < maxRetries) {
          console.log("音声認識を自動的に再開します...")
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current)
          }

          // エラーの種類に応じて遅延時間を調整
          let delay = 1000 // デフォルト1秒
          if (networkError) {
            delay = 3000 // ネットワークエラーの場合は3秒
          } else if (errorCount > 0) {
            delay = Math.min(2000 * errorCount, 10000) // エラー回数に応じて遅延（最大10秒）
          }

          restartTimeoutRef.current = setTimeout(() => {
            if (!isUserStoppedRef.current) {
              console.log("音声認識を再開します...", new Date().toISOString())
              startRecognition()
            } else {
              console.log("ユーザーによる停止のため、再開しません")
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
      setErrorCount((prev) => prev + 1)
    }
  }, [isSupported, autoRestart, errorCount, maxRetries, networkError, activityTimeoutDuration])

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

    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current)
      activityTimeoutRef.current = null
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        console.error("音声認識の停止に失敗:", err)
      }
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
    setLastActivityTime(Date.now())
  }

  // 強制的に再開する関数
  const forceRestart = () => {
    console.log("強制的に音声認識を再開します")
    setErrorCount(0)
    setError(null)
    setNetworkError(false)
    isUserStoppedRef.current = false
    
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    
    setTimeout(() => {
      startRecognition()
    }, 500)
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
          <Label htmlFor="auto-restart">自動再開を有効にする (推奨)</Label>
        </div>

        {/* 接続状態の詳細情報 */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>最後のアクティビティ: {new Date(lastActivityTime).toLocaleTimeString()}</div>
          {errorCount > 0 && (
            <div className="text-orange-600">
              エラー回数: {errorCount}/{maxRetries}
            </div>
          )}
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
              <li>自動再開機能により、途切れても自動的に再開します</li>
              <li>15秒間無音が続くと自動的に再開されます</li>
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

          {/* 強制再開ボタン */}
          {errorCount > 0 && (
            <Button onClick={forceRestart} variant="outline" className="text-orange-600">
              強制再開
            </Button>
          )}
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
