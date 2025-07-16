# TMC Noter 本番ドメイン復旧手順

## 1. 現在の状況確認
- 動作中: tmcnoter-git-main-*.vercel.app
- 動作中: tmcnoter-8l0hknn6m-*.vercel.app  
- 問題: tmc-noter.vercel.app

## 2. 安全な復旧手順

### Step 1: バックアップ確認
- 環境変数をメモ帳にコピー
- 現在のGitHub連携設定を確認

### Step 2: ドメイン再設定
1. Vercel Dashboard → tmc-noter → Settings → Domains
2. tmc-noter.vercel.app を削除
3. 同じドメインを再追加

### Step 3: 強制デプロイ
\`\`\`bash
git commit --allow-empty -m "Force production redeploy"
git push origin main
\`\`\`

### Step 4: 動作確認
- tmc-noter.vercel.app にアクセス
- 全機能をテスト

## 3. 緊急時の代替案
もし上記で解決しない場合：
1. プロジェクト全体を削除
2. GitHubから再インポート
3. 環境変数を再設定
