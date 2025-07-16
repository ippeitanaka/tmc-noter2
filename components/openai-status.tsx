"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react"

export default function OpenAIStatus() {
  const [status, setStatus] = useState<"checking" | "success" | "error" | "testing">("checking")
  const [message, setMessage] = useState<string>("")
  const [details, setDetails] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const checkOpenAIConnection = async () => {
    try {
      setStatus("checking")

      // OpenAI APIの接続を確認
      const response = await fetch("/api/check-openai", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error || "OpenAI APIの接続に失敗しました")
      }

      setStatus("success")
      setDetails(result)
      setMessage(`OpenAI API接続成功 (${result.models}個のモデルが利用可能)`)
    } catch (error) {
      console.error("OpenAI API connection error:", error)
      setStatus("error")
      setMessage(
        `OpenAI APIへの接続中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const testWhisperAPI = async () => {
    try {
      setStatus("testing")
      setMessage("Whisper APIをテスト中...")

      const response = await fetch("/api/test-whisper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (result.success) {
        setStatus("success")
        setMessage("Whisper APIのテストが成功しました")
        setDetails(result)
      } else {
        setStatus("error")
        setMessage(`Whisper APIのテストが失敗しました: ${result.error}`)
        setDetails(result)
      }
    } catch (error) {
      console.error("Whisper API test error:", error)
      setStatus("error")
      setMessage(
        `Whisper APIのテスト中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await checkOpenAIConnection()
    setIsRefreshing(false)
  }

  useEffect(() => {
    checkOpenAIConnection()
  }, [])

  // 接続チェック中は何も表示しない
  if (status === "checking") {
    return (
      <Alert className="mt-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>接続確認中</AlertTitle>
        <AlertDescription>OpenAI APIの接続を確認しています...</AlertDescription>
      </Alert>
    )
  }

  // 成功時は簡潔な表示
  if (status === "success") {
    return (
      <Alert className="mt-4 border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">OpenAI API接続成功</AlertTitle>
        <AlertDescription className="text-green-700">
          {message}
          {details?.whisperAvailable && " (Whisper-1モデル利用可能)"}
        </AlertDescription>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            再確認
          </Button>
          <Button variant="outline" size="sm" onClick={testWhisperAPI}>
            Whisperテスト
          </Button>
        </div>
      </Alert>
    )
  }

  // テスト中
  if (status === "testing") {
    return (
      <Alert className="mt-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Whisper APIテスト中</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    )
  }

  // エラー時の詳細表示
  return (
    <Alert variant="destructive" className="mt-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>OpenAI API接続エラー</AlertTitle>
      <AlertDescription>
        <div className="space-y-2">
          <p>{message}</p>
          {details && (
            <details className="text-xs">
              <summary className="cursor-pointer">詳細情報</summary>
              <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">
                {JSON.stringify(details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </AlertDescription>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          再試行
        </Button>
        <Button variant="outline" size="sm" onClick={testWhisperAPI}>
          Whisperテスト
        </Button>
      </div>
    </Alert>
  )
}
