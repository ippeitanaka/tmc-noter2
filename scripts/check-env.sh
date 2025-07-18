#!/bin/bash

# Vercel環境変数設定確認スクリプト
echo "🔧 TMC Noter - Vercel環境変数設定確認"
echo "========================================="
echo ""

# Vercel CLIがインストールされているかチェック
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLIがインストールされていません"
    echo "   以下のコマンドでインストールしてください："
    echo "   npm install -g vercel"
    echo ""
    exit 1
fi

echo "✅ Vercel CLIが利用可能です"
echo ""

# ログイン状態確認
echo "🔍 Vercelログイン状態を確認中..."
if vercel whoami &> /dev/null; then
    USER=$(vercel whoami)
    echo "✅ Vercelにログイン済み: $USER"
else
    echo "❌ Vercelにログインしていません"
    echo "   'vercel login' でログインしてください"
    exit 1
fi

echo ""

# プロジェクト情報取得
echo "📋 プロジェクト情報を取得中..."
PROJECT_INFO=$(vercel ls 2>/dev/null | grep tmc-noter || echo "")

if [ -z "$PROJECT_INFO" ]; then
    echo "❌ tmc-noterプロジェクトが見つかりません"
    echo "   プロジェクトをデプロイしてから再実行してください"
    exit 1
fi

echo "✅ プロジェクトが見つかりました"
echo ""

# 必要な環境変数のリスト
REQUIRED_VARS=(
    "OPENAI_API_KEY"
    "GEMINI_API_KEY"
    "DEEPSEEK_API_KEY"
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
)

# AI APIキー（少なくとも1つ必要）
AI_VARS=(
    "OPENAI_API_KEY"
    "GEMINI_API_KEY"
    "DEEPSEEK_API_KEY"
)

echo "🔑 環境変数設定状況:"
echo "==================="

# 環境変数確認
AI_COUNT=0
TOTAL_COUNT=0

for var in "${REQUIRED_VARS[@]}"; do
    # 環境変数が設定されているかチェック
    if vercel env ls | grep -q "$var"; then
        echo "✅ $var: 設定済み"
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        
        # AI APIキーの場合はカウント
        for ai_var in "${AI_VARS[@]}"; do
            if [ "$var" = "$ai_var" ]; then
                AI_COUNT=$((AI_COUNT + 1))
                break
            fi
        done
    else
        echo "❌ $var: 未設定"
    fi
done

echo ""
echo "📊 設定状況サマリー:"
echo "==================="
echo "設定済み環境変数: $TOTAL_COUNT / ${#REQUIRED_VARS[@]}"
echo "設定済みAI APIキー: $AI_COUNT / ${#AI_VARS[@]}"

if [ $AI_COUNT -eq 0 ]; then
    echo ""
    echo "⚠️  警告: AI APIキーが1つも設定されていません"
    echo "   議事録生成機能を使用するには、以下のいずれか1つ以上が必要です："
    for ai_var in "${AI_VARS[@]}"; do
        echo "   - $ai_var"
    done
fi

echo ""
echo "🛠️  環境変数設定方法:"
echo "==================="
echo "1. Vercelダッシュボード（https://vercel.com/dashboard）にアクセス"
echo "2. プロジェクトを選択"
echo "3. Settings → Environment Variables"
echo "4. 必要な環境変数を追加"
echo "5. 設定後に再デプロイ"

echo ""
echo "📖 詳細なセットアップガイドは以下で確認できます："
echo "   https://your-app-url.vercel.app (アプリ内の環境変数ガイド)"

echo ""
echo "✅ 確認完了"
