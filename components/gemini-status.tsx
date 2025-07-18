"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Clock, Info, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GeminiStatus() {
  const [status, setStatus] = useState<"checking" | "success" | "error" | "temporary" | "warning">("checking")
  const [message, setMessage] = useState<string>("")
  const [details, setDetails] = useState<string>("")
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    async function checkGeminiConnection() {
      try {
        // Gemini APIの接続を確認（標準的なチェック）
        const response = await fetch("/api/check-gemini", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          // エラーレスポンスの安全な処理
          let errorText = ""
          try {
            errorText = await response.text()
          } catch (textError) {
            console.error("Failed to read Gemini error response:", textError)
            errorText = "Failed to read error response"
          }

          let result
          try {
            result = JSON.parse(errorText)
          } catch (parseError) {
            console.error("Failed to parse Gemini error response JSON:", parseError)
            throw new Error(`Gemini API接続エラー (${response.status}): ${errorText.substring(0, 200)}`)
          }

          throw new Error(result.error || "Gemini APIの接続に失敗しました")
        }

        // 成功レスポンスの安全な処理
        const responseText = await response.text()
        if (!responseText) {
          throw new Error("Gemini APIから空のレスポンスが返されました")
        }

        let result
        try {
          result = JSON.parse(responseText)
        } catch (parseError) {
          console.error("Failed to parse Gemini response JSON:", parseError)
          console.error("Response text:", responseText.substring(0, 500))
          throw new Error(`Gemini APIレスポンスの解析に失敗しました: ${parseError}`)
        }

        console.log("Gemini API check result:", result)

        // 利用可能なモデルを保存
        if (result.availableModels) {
          setAvailableModels(result.availableModels)
        }

        if (!result.available) {
          // 一時的な問題かどうかを確認
          if (result.temporary) {
            setStatus("temporary")
            setMessage(result.message || "Gemini APIは一時的に利用できません。しばらく後にお試しください。")
          } else {
            setStatus("error")
            setMessage(result.message || "Gemini APIが利用できません。環境変数を確認してください。")
          }

          // エラーの詳細情報があれば保存
          if (result.error) {
            setDetails(JSON.stringify(result.error, null, 2))
          }
          return
        }

        // APIチェックをスキップした場合でも、重大な警告ではなく軽い注意を表示
        if (result.skipApiCheck) {
          // タイムアウトの場合は特殊なメッセージ
          if (result.timeout) {
            setStatus("warning")
            setMessage("Gemini APIの応答が遅いですが、使用は可能です。処理に時間がかかる場合があります。")
          } else if (result.warning) {
            setStatus("warning")
            setMessage(`Gemini APIは設定されていますが注意が必要です: ${result.warning}`)
          } else {
            // 単にスキップした場合はメッセージを変更
            setStatus("success") // 警告ではなく成功として扱う
          }
          return
        }

        // 接続完全成功時
        setStatus("success")
      } catch (error) {
        console.error("Gemini connection error:", error)
        // エラーがあってもAPIを使用する可能性があることを示す
        setStatus("warning")
        setMessage(
          `Gemini APIへの接続テストでエラーが発生しましたが、実際の使用時には機能する可能性があります: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    checkGeminiConnection()
  }, [])

  // 接続チェック中または成功時は何も表示しない
  if (status === "checking" || status === "success") return null

  // 状態に応じたアラートを表示
  return (
    <Alert
      variant={status === "temporary" ? "default" : status === "warning" ? "default" : "destructive"}
      className="mt-4"
    >
      {status === "temporary" ? (
        <Clock className="h-4 w-4 text-yellow-500" />
      ) : status === "warning" ? (
        <Info className="h-4 w-4 text-blue-500" />
      ) : (
        <AlertCircle className="h-4 w-4" />
      )}
      <AlertTitle>
        {status === "temporary" ? "一時的な接続エラー" : status === "warning" ? "注意" : "接続エラー"}
      </AlertTitle>
      <AlertDescription>
        <p>{message}</p>

        {details && (
          <div className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setShowDetails(!showDetails)} className="text-xs">
              {showDetails ? "詳細を隠す" : "詳細を表示"}
            </Button>

            {showDetails && <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">{details}</pre>}
          </div>
        )}

        {availableModels.length > 0 && (
          <div className="mt-2 text-sm">
            <p>利用可能なモデル:</p>
            <ul className="list-disc pl-5 text-xs">
              {availableModels.map((model, index) => (
                <li key={index}>{model}</li>
              ))}
            </ul>
          </div>
        )}

        {status === "temporary" ? (
          <p className="mt-2 text-sm">
            Gemini APIが一時的に利用できません。この間はDeepSeekまたはルールベースの生成が使用されます。
          </p>
        ) : status === "warning" ? (
          <p className="mt-2 text-sm">
            実際の使用時にGemini
            APIが利用できない場合は、自動的にDeepSeekまたはルールベースの生成にフォールバックします。
          </p>
        ) : (
          <div className="mt-2 text-sm">
            <p>
              Gemini APIキーを設定するには、
              <a
                href="https://ai.google.dev/tutorials/setup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline ml-1 inline-flex items-center"
              >
                Google AI Studioで取得
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
              し、Vercelの環境変数に設定してください。
            </p>
            <p className="mt-1">
              <a
                href="https://ai.google.dev/models/gemini"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center"
              >
                Gemini APIのドキュメントを確認する
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </p>
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}
