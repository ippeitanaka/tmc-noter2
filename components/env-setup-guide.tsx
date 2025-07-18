"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export default function EnvSetupGuide() {
  const [showGuide, setShowGuide] = useState(false)

  return (
    <>
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>環境変数が設定されていません</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            アプリケーションを正常に動作させるには、Vercelダッシュボードで環境変数を設定する必要があります。
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowGuide(!showGuide)}>
            {showGuide ? "ガイドを隠す" : "セットアップガイドを表示"}
          </Button>
        </AlertDescription>
      </Alert>

      {showGuide && (
        <div className="mt-4 p-4 border rounded-md bg-gray-50">
          <h3 className="text-lg font-medium mb-2">環境変数セットアップガイド</h3>

          <div className="mb-4">
            <h4 className="font-medium">1. Vercelダッシュボードにアクセス</h4>
            <p className="text-sm text-gray-600">
              <a
                href="https://vercel.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Vercelダッシュボード
              </a>
              にログインし、このプロジェクトを選択します。
            </p>
          </div>

          <div className="mb-4">
            <h4 className="font-medium">2. 環境変数の設定</h4>
            <p className="text-sm text-gray-600 mb-2">
              「Settings」→「Environment Variables」を選択し、以下の環境変数を追加します：
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
              <li>
                <code className="bg-gray-100 px-1 py-0.5 rounded">OPENAI_API_KEY</code>:
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline ml-1"
                >
                  OpenAI API Keys
                </a>
                から取得したAPIキー (sk- で始まる文字列)
              </li>
              <li>
                <code className="bg-gray-100 px-1 py-0.5 rounded">GEMINI_API_KEY</code>:
                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline ml-1"
                >
                  Google AI Studio
                </a>
                から取得したAPIキー (AIza で始まる文字列)
              </li>
              <li>
                <code className="bg-gray-100 px-1 py-0.5 rounded">DEEPSEEK_API_KEY</code>:
                <a
                  href="https://platform.deepseek.com/api_keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline ml-1"
                >
                  DeepSeek API Keys
                </a>
                から取得したAPIキー (sk- で始まる文字列)
              </li>
              <li>
                <code className="bg-gray-100 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code>:
                SupabaseプロジェクトのURL (https://xxx.supabase.co 形式)
              </li>
              <li>
                <code className="bg-gray-100 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>:
                Supabaseの匿名キー
              </li>
              <li>
                <code className="bg-gray-100 px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code>:
                Supabaseのサービスロールキー
              </li>
            </ul>
            <div className="mt-3 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
              <p className="text-sm text-blue-800">
                <strong>重要:</strong> 少なくとも1つのAI APIキー（OpenAI、Gemini、またはDeepSeek）を設定する必要があります。
                議事録生成機能を使用するには、これらのAPIキーが必要です。
              </p>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="font-medium">3. Vercelでの環境変数設定手順</h4>
            <div className="text-sm text-gray-600 space-y-2">
              <div className="p-3 bg-gray-50 rounded border">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Vercelダッシュボードでプロジェクトを選択</li>
                  <li>「Settings」タブをクリック</li>
                  <li>左側メニューから「Environment Variables」を選択</li>
                  <li>「Add New」ボタンをクリック</li>
                  <li>Name欄に環境変数名（例：OPENAI_API_KEY）を入力</li>
                  <li>Value欄にAPIキーを入力</li>
                  <li>Environment で「Production」「Preview」「Development」すべてを選択</li>
                  <li>「Save」ボタンをクリック</li>
                  <li>すべての必要な環境変数について手順4-8を繰り返す</li>
                  <li>設定完了後、「Deployments」タブから最新デプロイメントを「Redeploy」</li>
                </ol>
              </div>
              <div className="mt-3 p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                <p className="text-sm text-yellow-800">
                  <strong>注意:</strong> 環境変数を追加または変更した後は、必ずアプリケーションを再デプロイしてください。
                  環境変数の変更は次のデプロイメント時に反映されます。
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="font-medium">4. Supabaseの設定</h4>
            <p className="text-sm text-gray-600 mb-2">Supabaseダッシュボードで以下の設定を行います：</p>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-2">
              <li>
                「Storage」→「New Bucket」で<code className="bg-gray-100 px-1 py-0.5 rounded">tmc-noter</code>
                という名前のバケットを作成
              </li>
              <li>
                「SQL Editor」で以下のSQLを実行して必要なテーブルを作成：
                <pre className="bg-gray-100 p-2 rounded mt-1 text-xs overflow-x-auto">
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
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium">5. 再デプロイ</h4>
            <p className="text-sm text-gray-600">
              環境変数を設定した後、Vercelダッシュボードから「Redeploy」を実行して変更を適用します。
            </p>
          </div>
        </div>
      )}
    </>
  )
}
