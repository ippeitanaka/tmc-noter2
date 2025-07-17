import { createClient } from "@supabase/supabase-js"

// Supabase設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// 環境変数が設定されていない場合の警告
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    "Supabase環境変数が設定されていません。デフォルト値を使用します。本番環境では必ず環境変数を設定してください。",
  )
}

// Supabaseクライアントの初期化
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ストレージバケット名
export const STORAGE_BUCKET = "tmc-noter"
