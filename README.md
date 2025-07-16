# TMC Noter - 音声から議事録を自動生成するアプリ

TMC Noterは、音声ファイルをアップロードするだけで、AIが文字起こしと議事録を自動生成するアプリケーションです。

## 機能

- 音声ファイル（mp3, wav, m4a）のアップロード（ドラッグ&ドロップ対応）
- 大きなファイルの自動圧縮
- OpenAI Whisper APIによる高精度な文字起こし
- OpenAI GPT-4oによる議事録生成
- 議事録と文字起こし結果の表示、コピー、保存

## セットアップ方法

### 1. 必要な環境変数の設定

プロジェクトのルートディレクトリに`.env.local`ファイルを作成し、以下の環境変数を設定します：

\`\`\`
# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
\`\`\`

**重要**: 環境変数を設定した後、開発サーバーを再起動してください。

### 2. Supabaseの設定

1. Supabaseプロジェクトを作成します
2. SQLエディタで`create-tables.sql`を実行して必要なテーブルとストレージバケットを作成します
3. ストレージバケット`tmc-noter`が作成されていることを確認します

### 3. 依存関係のインストール

\`\`\`bash
npm install
# または
yarn
# または
pnpm install
\`\`\`

### 4. 開発サーバーの起動

\`\`\`bash
npm run dev
# または
yarn dev
# または
pnpm dev
\`\`\`

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションを確認できます。

## 使い方

1. ホーム画面で音声ファイルをドラッグ&ドロップするか、クリックしてファイルを選択します
2. 「議事録を生成する」ボタンをクリックして処理を開始します
3. 処理の進行状況がプログレスバーに表示されます
4. 処理が完了すると、議事録と文字起こし結果が表示されます
5. 「コピー」または「保存」ボタンを使って結果を保存できます

## 技術スタック

- Next.js + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Storage, Database)
- OpenAI API (Whisper, GPT-4o)
- ffmpeg.wasm
\`\`\`

次に、`process-audio.ts`ファイルを更新して、新しいSupabaseクライアント初期化方法を使用するようにします：
