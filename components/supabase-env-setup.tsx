"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Copy, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function SupabaseEnvSetup() {
  const [supabaseUrl, setSupabaseUrl] = useState("")
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("")
  const [supabaseServiceKey, setSupabaseServiceKey] = useState("")
  const [showKeys, setShowKeys] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const { toast } = useToast()

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "コピーしました",
      description: `${label}をクリップボードにコピーしました`,
    })
  }

  const testConnection = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      toast({
        title: "エラー",
        description: "URLとAnon Keyを入力してください",
        variant: "destructive",
      })
      return
    }

    setIsTestingConnection(true)
    setConnectionStatus("idle")

    try {
      // テスト用のSupabaseクライアントを作成
      const { createClient } = await import("@supabase/supabase-js")
      const testClient = createClient(supabaseUrl, supabaseAnonKey)

      // 簡単な接続テスト
      const { data, error } = await testClient.from("audio_files").select("count", { count: "exact", head: true })

      if (error) {
        throw new Error(`接続エラー: ${error.message}`)
      }

      setConnectionStatus("success")
      toast({
        title: "接続成功",
        description: "Supabaseへの接続が確認できました",
      })
    } catch (error) {
      setConnectionStatus("error")
      const message = error instanceof Error ? error.message : "不明なエラーが発生しました"
      setErrorMessage(message)
      toast({
        title: "接続失敗",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const generateEnvFile = () => {
    const envContent = `# Supabase環境変数
NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey}
SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey}

# OpenAI API (文字起こし用)
OPENAI_API_KEY=your_openai_api_key

# Google Gemini API (議事録生成用)
GEMINI_API_KEY=your_gemini_api_key

# DeepSeek API (議事録生成用)
DEEPSEEK_API_KEY=your_deepseek_api_key`

    copyToClipboard(envContent, ".env ファイルの内容")
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Supabase環境変数の設定
          </CardTitle>
          <CardDescription>Supabaseプロジェクトの情報を入力して、環境変数を設定してください。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supabase-url">Supabase URL</Label>
            <Input
              id="supabase-url"
              placeholder="https://your-project.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">Supabaseダッシュボード → Settings → API → Project URL</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabase-anon-key">Supabase Anon Key</Label>
            <div className="relative">
              <Input
                id="supabase-anon-key"
                type={showKeys ? "text" : "password"}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                className="pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowKeys(!showKeys)}>
                  {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                {supabaseAnonKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(supabaseAnonKey, "Anon Key")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Supabaseダッシュボード → Settings → API → Project API keys → anon public
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabase-service-key">Supabase Service Role Key（オプション）</Label>
            <div className="relative">
              <Input
                id="supabase-service-key"
                type={showKeys ? "text" : "password"}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseServiceKey}
                onChange={(e) => setSupabaseServiceKey(e.target.value)}
                className="pr-20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowKeys(!showKeys)}>
                  {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                {supabaseServiceKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(supabaseServiceKey, "Service Role Key")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Supabaseダッシュボード → Settings → API → Project API keys → service_role
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={testConnection} disabled={isTestingConnection || !supabaseUrl || !supabaseAnonKey}>
              {isTestingConnection ? "接続テスト中..." : "接続テスト"}
            </Button>
            <Button variant="outline" onClick={generateEnvFile} disabled={!supabaseUrl || !supabaseAnonKey}>
              .envファイル生成
            </Button>
          </div>

          {connectionStatus === "success" && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>接続成功</AlertTitle>
              <AlertDescription>Supabaseへの接続が確認できました。</AlertDescription>
            </Alert>
          )}

          {connectionStatus === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>接続エラー</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vercelでの環境変数設定手順</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              <a
                href="https://vercel.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Vercelダッシュボード
              </a>
              にアクセスし、プロジェクトを選択
            </li>
            <li>「Settings」タブをクリック</li>
            <li>左サイドバーから「Environment Variables」を選択</li>
            <li>以下の環境変数を追加：</li>
          </ol>
          <div className="bg-gray-50 p-4 rounded-md space-y-2 text-sm font-mono">
            <div>NEXT_PUBLIC_SUPABASE_URL = {supabaseUrl || "（上記で入力）"}</div>
            <div>NEXT_PUBLIC_SUPABASE_ANON_KEY = {supabaseAnonKey ? "●●●●●●●●" : "（上記で入力）"}</div>
            <div>SUPABASE_SERVICE_ROLE_KEY = {supabaseServiceKey ? "●●●●●●●●" : "（上記で入力）"}</div>
          </div>
          <ol start={5} className="list-decimal list-inside space-y-2 text-sm">
            <li>「Save」をクリックして保存</li>
            <li>「Deployments」タブから「Redeploy」を実行</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supabaseプロジェクトの準備</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Supabaseプロジェクトで以下の設定が必要です：</p>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">1. ストレージバケットの作成</h4>
              <p className="text-sm text-muted-foreground">
                Storage → New Bucket → 名前: <code className="bg-gray-100 px-1 py-0.5 rounded">tmc-noter</code>
              </p>
            </div>
            <div>
              <h4 className="font-medium">2. データベーステーブルの作成</h4>
              <p className="text-sm text-muted-foreground">SQL Editor で以下のSQLを実行：</p>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                {`CREATE TABLE IF NOT EXISTS audio_files (
  id SERIAL PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  transcript TEXT,
  minutes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_files_created_at ON audio_files(created_at);`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
