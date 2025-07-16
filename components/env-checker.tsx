"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function EnvChecker() {
  const [status, setStatus] = useState<"checking" | "success" | "warning" | "error">("checking")
  const [message, setMessage] = useState("")
  const [openaiStatus, setOpenaiStatus] = useState<"available" | "unavailable" | "unknown">("unknown")
  const [geminiStatus, setGeminiStatus] = useState<"available" | "unavailable" | "unknown">("unknown")
  // 状態変数を追加
  const [deepseekStatus, setDeepseekStatus] = useState<"available" | "unavailable" | "unknown">("unknown")

  // useEffect内のAPIチェック部分を更新
  useEffect(() => {
    // クライアントサイドでは環境変数のチェックを行わず、APIリクエストでチェックする
    async function checkApiKeys() {
      try {
        // APIを呼び出して環境変数の状態を確認
        const response = await fetch("/api/check-env", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || "API環境変数のチェックに失敗しました")
        }

        const result = await response.json()

        setOpenaiStatus(result.openaiAvailable ? "available" : "unavailable")
        setGeminiStatus(result.geminiAvailable ? "available" : "unavailable")
        setDeepseekStatus(result.deepseekAvailable ? "available" : "unavailable")

        // 少なくとも1つのAPIが利用可能であれば成功とみなす
        if (result.openaiAvailable || result.geminiAvailable) {
          setStatus("success")
          return
        }

        // すべてのAPIが利用できない場合のみエラーを表示
        setStatus("error")
        setMessage("OpenAI、Google Gemini APIキーのいずれも設定されていません。少なくとも一つが必要です。")
      } catch (error) {
        console.error("API key check error:", error)
        setStatus("warning")
        setMessage("API環境変数のチェックに失敗しました。一部の機能が制限される可能性があります。")
      }
    }

    checkApiKeys()
  }, [])

  // 接続チェック中または成功時は何も表示しない
  if (status === "checking" || status === "success") return null

  return (
    <Alert variant={status === "warning" ? "default" : "destructive"} className="mt-4">
      <AlertCircle className={`h-4 w-4 ${status === "warning" ? "text-yellow-500" : ""}`} />
      <AlertTitle>{status === "warning" ? "注意" : "エラー"}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {openaiStatus === "unavailable" && (
          <p className="mt-2 text-sm">
            OpenAI APIキーを設定するには、
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              OpenAI Platform
            </a>
            でAPIキーを取得し、Vercelの環境変数に設定してください。
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}
