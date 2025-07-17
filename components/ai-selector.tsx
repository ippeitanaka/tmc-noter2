"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle, AlertTriangle, Brain, Zap, Bot } from 'lucide-react'

type AiProvider = 'gemini' | 'openai' | 'deepseek'

interface AiStatus {
  available: boolean
  configured: boolean
  freeLimit: string
  features: string[]
  setup: string
}

interface AiConfig {
  provider: AiProvider
  // APIキーは環境変数から取得するため、クライアントサイドでは不要
}

const AI_PROVIDERS: Record<AiProvider, AiStatus> = {
  gemini: {
    available: true,
    configured: false,
    freeLimit: '月15回無料（推奨）',
    features: ['高品質要約', '多言語対応', '構造化議事録', '速度最適化'],
    setup: 'Google Gemini APIキーが環境変数に設定済み'
  },
  openai: {
    available: true,
    configured: false,
    freeLimit: '有料のみ（$0.002/1K tokens）',
    features: ['高精度', '多様な出力形式', '詳細な分析', '安定性'],
    setup: 'OpenAI APIキーが環境変数に設定済み'
  },
  deepseek: {
    available: true,
    configured: false,
    freeLimit: '月500万トークン無料',
    features: ['高性能', '日本語最適化', '長文処理', 'コスト効率'],
    setup: 'DeepSeek APIキーが環境変数に設定済み'
  }
}

interface AiSelectorProps {
  onConfigChange: (config: AiConfig) => void
  currentConfig?: AiConfig
}

export default function AiSelector({ onConfigChange, currentConfig }: AiSelectorProps) {
  const [providers, setProviders] = useState(AI_PROVIDERS)
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>(currentConfig?.provider || 'gemini')
  const [isChecking, setIsChecking] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    // 設定が変更されたら通知（APIキーは環境変数から取得）
    onConfigChange({ provider: selectedProvider })
  }, [selectedProvider, onConfigChange])

  useEffect(() => {
    // 環境変数から設定されたAPIキーをチェック
    checkEnvironmentApiKeys()
  }, [])

  const checkEnvironmentApiKeys = async () => {
    try {
      const response = await fetch('/api/check-env')
      const data = await response.json()
      
      setProviders(prev => ({
        ...prev,
        gemini: {
          ...prev.gemini,
          configured: data.gemini || false
        },
        openai: {
          ...prev.openai,
          configured: data.openai || false
        },
        deepseek: {
          ...prev.deepseek,
          configured: data.deepseek || false
        }
      }))
    } catch (error) {
      console.error('Environment check failed:', error)
    }
  }

  const handleProviderChange = (value: string) => {
    const provider = value as AiProvider
    setSelectedProvider(provider)
    setTestResult(null)
  }

  const handleTest = async () => {
    setIsChecking(true)
    setTestResult(null)

    // 環境変数ベースでのテスト - APIキーは必要なし
    if (!providers[selectedProvider].configured) {
      setTestResult('❌ APIキーが環境変数に設定されていません')
      setIsChecking(false)
      return
    }

    try {
      let response
      switch (selectedProvider) {
        case 'gemini':
          response = await fetch('/api/check-gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: selectedProvider })
          })
          break
        case 'openai':
          response = await fetch('/api/check-openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: selectedProvider })
          })
          break
        case 'deepseek':
          response = await fetch('/api/check-deepseek', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: selectedProvider })
          })
          break
      }

      const result = await response.json()
      setTestResult(result.success ? '✅ 接続成功' : `❌ ${result.error}`)
    } catch (error) {
      setTestResult(`❌ 接続エラー: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsChecking(false)
    }
  }

  const getProviderIcon = (provider: AiProvider) => {
    switch (provider) {
      case 'gemini':
        return <Brain className="w-5 h-5 text-blue-600" />
      case 'openai':
        return <Zap className="w-5 h-5 text-green-600" />
      case 'deepseek':
        return <Bot className="w-5 h-5 text-purple-600" />
      default:
        return <Brain className="w-5 h-5" />
    }
  }

  const getProviderColor = (provider: AiProvider) => {
    switch (provider) {
      case 'gemini':
        return 'blue'
      case 'openai':
        return 'green'
      case 'deepseek':
        return 'purple'
      default:
        return 'gray'
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            AI設定（環境変数ベース）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                AI プロバイダー選択
              </label>
              <Tabs value={selectedProvider} onValueChange={handleProviderChange}>
                <TabsList className="grid w-full grid-cols-3">
                  {Object.entries(providers).map(([key, status]) => (
                    <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                      {getProviderIcon(key as AiProvider)}
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                      {status.configured && <CheckCircle className="w-4 h-4 text-green-500" />}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(providers).map(([key, status]) => (
                  <TabsContent key={key} value={key} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={status.configured ? "default" : "destructive"}>
                            {status.configured ? "設定済み" : "未設定"}
                          </Badge>
                          <Badge variant="outline">
                            {status.freeLimit}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-gray-600">
                          {status.setup}
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-medium">主な機能</h4>
                          <ul className="text-sm space-y-1">
                            {status.features.map((feature, index) => (
                              <li key={index} className="flex items-center gap-2">
                                <CheckCircle className="w-3 h-3 text-green-500" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Button
                          onClick={handleTest}
                          disabled={isChecking || !status.configured}
                          className="w-full"
                        >
                          {isChecking ? '接続テスト中...' : '接続テスト'}
                        </Button>

                        {testResult && (
                          <Alert>
                            <AlertDescription>{testResult}</AlertDescription>
                          </Alert>
                        )}

                        {!status.configured && (
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              {key.toUpperCase()}_API_KEY 環境変数を設定してください
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">現在選択中:</span>
                  <Badge variant="outline" className={`border-${getProviderColor(selectedProvider)}-500`}>
                    {getProviderIcon(selectedProvider)}
                    <span className="ml-1">{selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}</span>
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {providers[selectedProvider].configured ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="text-sm">
                    {providers[selectedProvider].configured ? '準備完了' : '設定が必要'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
