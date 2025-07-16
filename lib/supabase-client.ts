import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ★ throw せず警告のみに変更
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase環境変数が設定されていません。ローカル／Preview ではダミークライアントを使用します。本番環境では必ず設定してください。",
  )
}

// Supabaseクライアントを生成（環境変数が無い場合は read-only ダミー）
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "public-anon-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      // ダミーの場合は誤操作防止のため readOnly
      headers: supabaseUrl && supabaseAnonKey ? {} : { "x-read-only": "true" },
    },
  },
)

// ストレージバケット名
export const STORAGE_BUCKET = "tmc-noter"
