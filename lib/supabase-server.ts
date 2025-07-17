import { createClient } from "@supabase/supabase-js"

// 環境変数の取得（デフォルト値なし）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function createServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase環境変数が設定されていません。")
    throw new Error("Supabase環境変数が設定されていません")
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

export function createServerAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Supabase環境変数が設定されていません。")
    throw new Error("Supabase環境変数が設定されていません")
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
