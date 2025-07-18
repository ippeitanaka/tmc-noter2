"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle, AlertTriangle, Key, Globe, Mic, Zap, Settings } from 'lucide-react'

type ApiProvider = 'openai' | 'assemblyai' | 'azure' | 'webspeech' | 'offline'

interface ApiStatus {
  available: boolean
  configured: boolean
  freeLimit: string
  features: string[]
  setup: string
}

interface ApiConfig {
  provider: ApiProvider
  apiKey?: string
  region?: string
}

const API_PROVIDERS: Record<ApiProvider, ApiStatus> = {
  openai: {
    available: true,
    configured: false,
    freeLimit: '有料のみ（$0.006/分）',
    features: ['高精度', '多言語対応', 'タイムスタンプ', '話者識別'],
    setup: 'OpenAI APIキーが必要'
  },
  assemblyai: {
    available: true,
    configured: false,
    freeLimit: '月5時間無料',
    features: ['高精度', '話者識別', '要約', '感情分析', 'キーワード抽出'],
    setup: 'AssemblyAI APIキーが必要（無料登録可能）'
  },
  azure: {
    available: true,
    configured: false,
    freeLimit: '月5時間無料',
    features: ['高精度', '多言語対応', 'バッチ処理', '話者識別'],
    setup: 'Azure Speech APIキーが必要（無料登録可能）'
  },
  webspeech: {
    available: false,
    configured: false,
    freeLimit: '完全無料（推奨）',
    features: ['リアルタイム', 'ブラウザ内処理', 'プライベート', 'APIキー不要'],
    setup: 'ChromeまたはEdgeブラウザが必要（設定不要）'
  },
  offline: {
    available: false,
    configured: false,
    freeLimit: '完全無料',
    features: ['オフライン', 'プライベート', '無制限'],
    setup: 'WebAssembly版Whisperを読み込み中...'
  }
}

interface ApiSelectorProps {
  onConfigChange: (config: ApiConfig) => void
  currentConfig?: ApiConfig
}

export default function ApiSelector({ onConfigChange, currentConfig }: ApiSelectorProps) {
  const [providers, setProviders] = useState(API_PROVIDERS)
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider>(currentConfig?.provider || 'webspeech')
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '')
  const [region, setRegion] = useState(currentConfig?.region || 'eastus')
  const [isChecking, setIsChecking] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    // 設定が変更されたら通知
    onConfigChange({ provider: selectedProvider, apiKey, region })
  }, [selectedProvider, apiKey, region, onConfigChange])

  useEffect(() => {
    // ブラウザのWeb Speech APIサポートをチェック
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      setProviders(prev => ({
        ...prev,
        webspeech: {
          ...prev.webspeech,
          available: true,
          configured: true
        }
      }))
    }

    // 環境変数から設定されたAPIキーをチェック
    checkEnvironmentApiKeys()
  }, [])

  const checkEnvironmentApiKeys = async () => {
    try {
      // 個別のAPI接続チェックを実行
      const [openaiCheck, geminiCheck, deepseekCheck] = await Promise.all([
        fetch('/api/check-openai').then(res => res.json()).catch(() => ({ available: false })),
        fetch('/api/check-gemini').then(res => res.json()).catch(() => ({ available: false })),
        fetch('/api/check-deepseek').then(res => res.json()).catch(() => ({ available: false }))
      ])
      
      setProviders(prev => ({
        ...prev,
        openai: {
          ...prev.openai,
          configured: openaiCheck.available || false
        },
        assemblyai: {
          ...prev.assemblyai,
          configured: false // AssemblyAIは現在未実装
        },
        azure: {
          ...prev.azure,
          configured: false // Azureは現在未実装
        }
      }))

      console.log('API Status Check:', {
        openai: openaiCheck.available,
        gemini: geminiCheck.available,
        deepseek: deepseekCheck.available
      })
    } catch (error) {
      console.error('Environment check failed:', error)
    }
  }

  const handleProviderChange = (value: string) => {
    const provider = value as ApiProvider
    setSelectedProvider(provider)
    setTestResult(null)
    
    const config: ApiConfig = {
      provider,
      apiKey: provider === 'webspeech' || provider === 'offline' ? undefined : apiKey,
      region: provider === 'azure' ? region : undefined
    }
    
    onConfigChange(config)
  }

  const handleApiKeyChange = (value: string) => {
    setApiKey(value)
    setTestResult(null)
    
    const config: ApiConfig = {
      provider: selectedProvider,
      apiKey: value,
      region: selectedProvider === 'azure' ? region : undefined
    }
    
    onConfigChange(config)
  }

  const handleRegionChange = (value: string) => {
    setRegion(value)
    
    const config: ApiConfig = {
      provider: selectedProvider,
      apiKey: apiKey,
      region: value
    }
    
    onConfigChange(config)
  }

  const testApiConnection = async () => {
    setIsChecking(true)
    setTestResult(null)
    
    try {
      let endpoint = ''
      let requestBody: any = {}
      
      switch (selectedProvider) {
        case 'openai':
          endpoint = '/api/check-openai'
          if (apiKey) requestBody.apiKey = apiKey
          break
        case 'assemblyai':
          endpoint = '/api/check-assemblyai'
          if (apiKey) requestBody.apiKey = apiKey
          break
        case 'azure':
          endpoint = '/api/check-azure'
          if (apiKey) requestBody.apiKey = apiKey
          if (region) requestBody.region = region
          break
        case 'webspeech':
          setTestResult('✅ Web Speech APIは利用可能です')
          setIsChecking(false)
          return
        case 'offline':
          setTestResult('⚠️ オフライン機能は開発中です')
          setIsChecking(false)
          return
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      if (!response.ok) {
        // エラーレスポンスの安全な処理
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
          console.error("Failed to parse error response JSON:", parseError)
          setTestResult(`❌ 接続失敗 (${response.status}): ${errorText.substring(0, 200)}`)
          return
        }

        setTestResult(`❌ 接続失敗: ${data.error || '不明なエラー'}`)
        return
      }

      // 成功レスポンスの安全な処理
      const responseText = await response.text()
      if (!responseText) {
        setTestResult(`❌ 接続失敗: 空のレスポンス`)
        return
      }

      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error("Failed to parse API response JSON:", parseError)
        console.error("Response text:", responseText.substring(0, 500))
        setTestResult(`❌ レスポンス解析エラー: ${parseError}`)
        return
      }
      
      setTestResult('✅ API接続成功！')
      setProviders(prev => ({
        ...prev,
        [selectedProvider]: {
          ...prev[selectedProvider],
          configured: true
        }
      }))
    } catch (error) {
      setTestResult(`❌ 接続エラー: ${error}`)
    } finally {
      setIsChecking(false)
    }
  }

  const getProviderIcon = (provider: ApiProvider) => {
    switch (provider) {
      case 'openai': return <Key className="h-4 w-4" />
      case 'assemblyai': return <Zap className="h-4 w-4" />
      case 'azure': return <Globe className="h-4 w-4" />
      case 'webspeech': return <Mic className="h-4 w-4" />
      case 'offline': return <Settings className="h-4 w-4" />
      default: return <Key className="h-4 w-4" />
    }
  }

  const getProviderName = (provider: ApiProvider) => {
    switch (provider) {
      case 'openai': return 'OpenAI Whisper'
      case 'assemblyai': return 'AssemblyAI'
      case 'azure': return 'Azure Speech'
      case 'webspeech': return 'Web Speech API'
      case 'offline': return 'オフライン（開発中）'
      default: return provider
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          音声認識API設定（オプション）
        </CardTitle>
        <p className="text-sm text-gray-600">
          デフォルトで Web Speech API を使用します。より高度な機能が必要な場合は、他のAPIを選択してください。
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedProvider} onValueChange={handleProviderChange}>
          <TabsList className="grid w-full grid-cols-5">
            {Object.entries(providers).map(([key, provider]) => (
              <TabsTrigger 
                key={key} 
                value={key}
                disabled={!provider.available}
                className="flex items-center gap-1"
              >
                {getProviderIcon(key as ApiProvider)}
                {getProviderName(key as ApiProvider).split(' ')[0]}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(providers).map(([key, provider]) => (
            <TabsContent key={key} value={key} className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{getProviderName(key as ApiProvider)}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant={provider.configured ? 'default' : 'secondary'}>
                      {provider.configured ? '設定済み' : '未設定'}
                    </Badge>
                    {provider.available && (
                      <Badge variant="outline" className="text-green-600">
                        {provider.freeLimit}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {provider.features.map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {provider.setup}
                  </AlertDescription>
                </Alert>

                {/* API設定フォーム */}
                {key !== 'webspeech' && key !== 'offline' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`${key}-apikey`}>APIキー</Label>
                      <Input
                        id={`${key}-apikey`}
                        type="password"
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        placeholder="APIキーを入力してください"
                        className="mt-1"
                      />
                    </div>

                    {key === 'azure' && (
                      <div>
                        <Label htmlFor="azure-region">リージョン</Label>
                        <Select value={region} onValueChange={handleRegionChange}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="リージョンを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eastus">East US</SelectItem>
                            <SelectItem value="westus">West US</SelectItem>
                            <SelectItem value="japaneast">Japan East</SelectItem>
                            <SelectItem value="japanwest">Japan West</SelectItem>
                            <SelectItem value="westeurope">West Europe</SelectItem>
                            <SelectItem value="southeastasia">Southeast Asia</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <Button
                      onClick={testApiConnection}
                      disabled={!apiKey || isChecking}
                      className="w-full"
                    >
                      {isChecking ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          接続テスト中...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          接続をテスト
                        </>
                      )}
                    </Button>

                    {testResult && (
                      <Alert className={testResult.includes('✅') ? 'border-green-200' : 'border-red-200'}>
                        <AlertDescription>{testResult}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Web Speech API専用の説明 */}
                {key === 'webspeech' && (
                  <div className="space-y-3">
                    <Alert>
                      <Mic className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Web Speech API</strong>はブラウザ内で動作し、完全に無料です。
                        音声データは外部サーバーに送信されません。
                      </AlertDescription>
                    </Alert>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">制限事項:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• ChromeまたはEdgeブラウザが必要</li>
                        <li>• ファイル再生中のリアルタイム認識のみ</li>
                        <li>• 日本語認識精度は中程度</li>
                        <li>• 長時間の音声には向かない</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* オフライン機能の説明 */}
                {key === 'offline' && (
                  <div className="space-y-3">
                    <Alert>
                      <Settings className="h-4 w-4" />
                      <AlertDescription>
                        <strong>オフライン機能</strong>は開発中です。
                        WebAssembly版のWhisperを使用してブラウザ内で文字起こしを行います。
                      </AlertDescription>
                    </Alert>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">予定機能:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• 完全オフライン動作</li>
                        <li>• プライベート処理</li>
                        <li>• 無制限利用</li>
                        <li>• 高精度認識</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* 推奨API */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">🚀 推奨API</h3>
          <div className="space-y-2 text-sm">
            <p><strong>初回利用者:</strong> Web Speech API（完全無料、すぐに使える）</p>
            <p><strong>高精度が必要:</strong> AssemblyAI（月5時間無料、高機能）</p>
            <p><strong>大量処理:</strong> Azure Speech（月5時間無料、バッチ処理対応）</p>
            <p><strong>予算がある:</strong> OpenAI Whisper（最高精度、有料）</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
