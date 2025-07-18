"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react"

interface EnvDetails {
  openai: boolean
  gemini: boolean
  deepseek: boolean
  aiAvailable: boolean
  details: any
  environment: any
  recommendations: any
}

export default function EnvStatusDisplay() {
  const [envData, setEnvData] = useState<EnvDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkEnvironment = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/check-env")
      if (!response.ok) {
        throw new Error(`環境チェックAPIエラー: ${response.status}`)
      }

      const responseText = await response.text()
      if (!responseText) {
        throw new Error("環境チェックAPIから空のレスポンス")
      }

      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error("環境チェックレスポンスのパースエラー:", parseError)
        throw new Error("環境チェックレスポンスの解析に失敗")
      }

      if (data.error) {
        throw new Error(data.error)
      }

      setEnvData(data)
    } catch (err) {
      console.error("環境チェックエラー:", err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkEnvironment()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>環境変数を確認中...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>環境チェックエラー</AlertTitle>
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2" 
            onClick={checkEnvironment}
          >
            再試行
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!envData) {
    return null
  }

  const { details, environment, recommendations } = envData

  const StatusIcon = ({ present }: { present: boolean }) => (
    present ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    )
  )

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive'
      case 'high': return 'default'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            環境変数設定状況
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 環境情報 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">実行環境:</span>
              <Badge variant="outline" className="ml-2">
                {environment?.isVercel ? 'Vercel' : 'ローカル'}
              </Badge>
            </div>
            <div>
              <span className="font-medium">デプロイ環境:</span>
              <Badge variant="outline" className="ml-2">
                {environment?.vercelEnv || environment?.nodeEnv || '不明'}
              </Badge>
            </div>
          </div>

          {/* AI API キー */}
          <div>
            <h4 className="font-medium mb-2">AI APIキー</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <StatusIcon present={details?.openai?.present} />
                  <span>OpenAI API Key</span>
                  {details?.openai?.present && (
                    <Badge variant={details.openai.format === 'valid' ? 'default' : 'destructive'}>
                      {details.openai.format}
                    </Badge>
                  )}
                </div>
                {details?.openai?.present && (
                  <span className="text-xs text-gray-500">
                    {details.openai.prefix}... ({details.openai.length}文字)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <StatusIcon present={details?.gemini?.present} />
                  <span>Gemini API Key</span>
                  {details?.gemini?.present && (
                    <Badge variant={details.gemini.format === 'valid' ? 'default' : 'secondary'}>
                      {details.gemini.format}
                    </Badge>
                  )}
                </div>
                {details?.gemini?.present && (
                  <span className="text-xs text-gray-500">
                    {details.gemini.prefix}... ({details.gemini.length}文字)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <StatusIcon present={details?.deepseek?.present} />
                  <span>DeepSeek API Key</span>
                  {details?.deepseek?.present && (
                    <Badge variant={details.deepseek.format === 'valid' ? 'default' : 'secondary'}>
                      {details.deepseek.format}
                    </Badge>
                  )}
                </div>
                {details?.deepseek?.present && (
                  <span className="text-xs text-gray-500">
                    {details.deepseek.prefix}... ({details.deepseek.length}文字)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Supabase設定 */}
          <div>
            <h4 className="font-medium mb-2">Supabase設定</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <StatusIcon present={details?.supabase?.url?.present} />
                  <span>Supabase URL</span>
                  {details?.supabase?.url?.present && (
                    <Badge variant={details.supabase.url.format === 'valid' ? 'default' : 'secondary'}>
                      {details.supabase.url.format}
                    </Badge>
                  )}
                </div>
                {details?.supabase?.url?.present && (
                  <span className="text-xs text-gray-500">
                    {details.supabase.url.value}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <StatusIcon present={details?.supabase?.anonKey?.present} />
                  <span>Supabase Anon Key</span>
                </div>
                {details?.supabase?.anonKey?.present && (
                  <span className="text-xs text-gray-500">
                    {details.supabase.anonKey.prefix}... ({details.supabase.anonKey.length}文字)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <StatusIcon present={details?.supabase?.serviceKey?.present} />
                  <span>Supabase Service Key</span>
                </div>
                {details?.supabase?.serviceKey?.present && (
                  <span className="text-xs text-gray-500">
                    {details.supabase.serviceKey.prefix}... ({details.supabase.serviceKey.length}文字)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 推奨事項 */}
          {recommendations?.missingKeys?.length > 0 && (
            <Alert variant={getPriorityColor(recommendations.priority) as any}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>設定が必要な環境変数</AlertTitle>
              <AlertDescription>
                <div className="mt-2">
                  <p className="mb-2">以下の環境変数が設定されていません：</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {recommendations.missingKeys.map((key: string) => (
                      <li key={key} className="text-sm">
                        <code className="bg-gray-100 px-1 py-0.5 rounded">{key}</code>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={checkEnvironment}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      再確認
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      asChild
                    >
                      <a 
                        href="https://vercel.com/dashboard" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Vercel設定
                      </a>
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 成功メッセージ */}
          {envData.aiAvailable && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>AI機能が利用可能です</AlertTitle>
              <AlertDescription>
                少なくとも1つのAI APIキーが設定されており、議事録生成機能が利用できます。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
