// 環境変数のチェックと取得のためのユーティリティ関数

export function getEnvVariable(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`環境変数 ${key} が設定されていません`)
  }
  return value
}

// OpenAI API Key
export function getOpenAIApiKey(): string {
  return getEnvVariable("OPENAI_API_KEY")
}

// Supabase URL
export function getSupabaseUrl(): string {
  return getEnvVariable("NEXT_PUBLIC_SUPABASE_URL")
}

// Supabase Anon Key
export function getSupabaseAnonKey(): string {
  return getEnvVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

// Supabase Service Role Key
export function getSupabaseServiceRoleKey(): string {
  return getEnvVariable("SUPABASE_SERVICE_ROLE_KEY")
}
