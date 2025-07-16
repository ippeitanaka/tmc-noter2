"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, RefreshCw, Database, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function SupabaseDebug() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchDebugInfo = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/test-supabase")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Supabaseテストに失敗しました")
      }

      setDebugInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "不明なエラー")
    } finally {
      setLoading(false)
    }
  }

  const cleanupTestData = async () => {
    try {
      const response = await fetch("/api/test-supabase", { method: "DELETE" })
      const data = await response.json()

      if (response.ok) {
        toast({
          title: "クリーンアップ完了",
          description: data.message,
        })
        fetchDebugInfo() // 再取得
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      toast({
        title: "エラー",
        description: err instanceof Error ? err.message : "クリーンアップに失敗しました",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    fetchDebugInfo()
  }, [])

  const renderTestResult = (test: any, name: string) => {
    return (
      <div className="border rounded p-3">
        <div className="flex items-center mb-2">
          {test.success ? (
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
          )}
          <span className="font-medium">{name}</span>
        </div>
        {test.error && <div className="text-sm text-red-600 mb-2">エラー: {test.error}</div>}
        {test.data && <div className="text-sm text-gray-600">データ: {JSON.stringify(test.data, null, 2)}</div>}
        {test.buckets && <div className="text-sm text-gray-600">バケット: {test.buckets.join(", ") || "なし"}</div>}
      </div>
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Supabase接続診断
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDebugInfo} disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              更新
            </Button>
            <Button variant="outline" size="sm" onClick={cleanupTestData}>
              <Trash2 className="h-4 w-4" />
              テストデータ削除
            </Button>
          </div>
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
            {/* 環境変数の状態 */}
            <div>
              <h3 className="font-medium mb-2">環境変数</h3>
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

            {/* テスト結果 */}
            <div>
              <h3 className="font-medium mb-2">接続テスト結果</h3>
              <div className="space-y-3">
                {renderTestResult(debugInfo.tests.client, "クライアント接続")}
                {renderTestResult(debugInfo.tests.admin, "管理者接続")}
                {renderTestResult(debugInfo.tests.storage, "ストレージ接続")}
                {renderTestResult(debugInfo.tests.insert, "データ挿入テスト")}
              </div>
            </div>

            <div className="text-xs text-gray-500">最終更新: {new Date(debugInfo.timestamp).toLocaleString()}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
