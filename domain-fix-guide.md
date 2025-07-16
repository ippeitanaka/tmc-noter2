# TMC Noter ドメイン修正ガイド

## 現在の状況
- 現在のドメイン: tmcnoter-ippeitanakas-projects-355f8a27.vercel.app
- 希望のドメイン: tmc-noter.vercel.app

## 修正手順

### Step 1: プロジェクト名を変更
1. Vercel Dashboard → 現在のプロジェクト
2. Settings → General
3. Project Name を "tmc-noter" に変更
4. Save をクリック

### Step 2: ドメイン設定確認
1. Settings → Domains
2. 自動的に tmc-noter.vercel.app が生成されることを確認
3. 古いドメインは自動的に無効になる

### Step 3: 強制再デプロイ
\`\`\`bash
git commit --allow-empty -m "Update project name and domain"
git push origin main
\`\`\`

### Step 4: 動作確認
- https://tmc-noter.vercel.app にアクセス
- 全機能をテスト
