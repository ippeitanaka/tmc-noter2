"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function EmergencyDebug() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = async () => {
    setLoading(true)
    setError(null)

    try {
      // 基本的な環境チェック
      const envCheck = {
        hasWindow: typeof window !== "undefined",
        hasDocument: typeof document !== "undefined",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
        url: typeof window !== "undefined" ? window.location.href : "N/A",
      }

      // API接続テスト
      let apiTest: { status: string; error: string | null; data?: any } = { status: "未テスト", error: null }
      try {
        const response = await fetch("/api/debug", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })
        if (response.ok) {
          const data = await response.json()
          apiTest = { status: "成功", error: null, data }
        } else {
          apiTest = { status: "失敗", error: `${response.status} ${response.statusText}` }
        }
      } catch (err) {
        apiTest = { status: "エラー", error: err instanceof Error ? err.message : String(err) }
      }

      // CSS/スタイル読み込みチェック
      const styleCheck = {
        tailwindLoaded: false,
        customStylesLoaded: false,
      }

      if (typeof document !== "undefined") {
        const testElement = document.createElement("div")
        testElement.className = "bg-red-500 text-white p-4"
        document.body.appendChild(testElement)
        const styles = window.getComputedStyle(testElement)
        styleCheck.tailwindLoaded = styles.backgroundColor === "rgb(239, 68, 68)" // bg-red-500
        document.body.removeChild(testElement)
      }

      setDebugInfo({
        environment: envCheck,
        api: apiTest,
        styles: styleCheck,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  if (loading) {
    return (
      <Card className="mt-4 border-yellow-500">
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>診断中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-4 border-red-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          緊急診断結果
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>診断エラー: {error}</AlertDescription>
          </Alert>
        )}

        {debugInfo && (
          <div className="space-y-4">
            {/* 環境情報 */}
            <div>
              <h4 className="font-medium mb-2">環境情報</h4>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  {debugInfo.environment.hasWindow ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>ブラウザ環境: {debugInfo.environment.hasWindow ? "正常" : "異常"}</span>
                </div>
                <div className="text-xs text-gray-600">URL: {debugInfo.environment.url}</div>
                <div className="text-xs text-gray-600">UA: {debugInfo.environment.userAgent}</div>
              </div>
            </div>

            {/* API接続 */}
            <div>
              <h4 className="font-medium mb-2">API接続</h4>
              <div className="flex items-center gap-2 text-sm">
                {debugInfo.api.status === "成功" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>ステータス: {debugInfo.api.status}</span>
              </div>
              {debugInfo.api.error && <div className="text-xs text-red-600 mt-1">エラー: {debugInfo.api.error}</div>}
            </div>

            {/* スタイル */}
            <div>
              <h4 className="font-medium mb-2">スタイル読み込み</h4>
              <div className="flex items-center gap-2 text-sm">
                {debugInfo.styles.tailwindLoaded ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Tailwind CSS: {debugInfo.styles.tailwindLoaded ? "読み込み済み" : "読み込み失敗"}</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={checkStatus} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                再診断
              </Button>
            </div>

            <div className="text-xs text-gray-500">診断時刻: {new Date(debugInfo.timestamp).toLocaleString()}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
