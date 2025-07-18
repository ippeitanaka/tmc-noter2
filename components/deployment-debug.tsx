"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react"

export default function DeploymentDebug() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDebugInfo = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/debug")
      
      if (!response.ok) {
        let errorText = ""
        try {
          errorText = await response.text()
        } catch (textError) {
          console.error("Failed to read error response:", textError)
          errorText = "Failed to read error response"
        }

        let data
        try {
          data = JSON.parse(errorText)
        } catch (parseError) {
          throw new Error(`デバッグ情報の取得に失敗しました (${response.status}): ${errorText.substring(0, 200)}`)
        }

        throw new Error(data.error || "デバッグ情報の取得に失敗しました")
      }

      // 成功レスポンスの安全な処理
      const responseText = await response.text()
      if (!responseText) {
        throw new Error("デバッグAPIから空のレスポンスが返されました")
      }

      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error("Failed to parse debug response JSON:", parseError)
        console.error("Response text:", responseText.substring(0, 500))
        throw new Error(`デバッグレスポンスの解析に失敗しました: ${parseError}`)
      }

      setDebugInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "不明なエラー")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDebugInfo()
  }, [])

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">デプロイメント診断</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchDebugInfo} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            更新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center text-red-600 mb-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>エラー: {error}</span>
          </div>
        )}

        {debugInfo && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">環境変数の状態</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {Object.entries(debugInfo.environment).map(([key, value]) => (
                  <div key={key} className="flex items-center">
                    {value ? (
                      <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-500 mr-2" />
                    )}
                    <span className={value ? "text-green-700" : "text-red-700"}>
                      {key}: {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-gray-500">最終更新: {new Date(debugInfo.timestamp).toLocaleString()}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
