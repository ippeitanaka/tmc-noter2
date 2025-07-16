"use client"

import { useState, useEffect } from "react"
import { supabase, STORAGE_BUCKET } from "@/lib/supabase-client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function SupabaseStatus() {
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking")
  const [message, setMessage] = useState<string>("")

  useEffect(() => {
    async function checkSupabaseConnection() {
      try {
        // Supabaseの接続を確認
        const { data, error } = await supabase.from("audio_files").select("count()", { count: "exact" }).limit(0)

        if (error) throw error

        // ストレージバケットの存在を確認
        const { data: bucketData, error: bucketError } = await supabase.storage.getBucket(STORAGE_BUCKET)

        if (bucketError) {
          if (bucketError.message.includes("The resource was not found")) {
            setStatus("error")
            setMessage(`ストレージバケット '${STORAGE_BUCKET}' が見つかりません。SQLを実行して作成してください。`)
            return
          }
          throw bucketError
        }

        // 接続成功時は何も表示しない
        setStatus("success")
      } catch (error) {
        console.error("Supabase connection error:", error)
        setStatus("error")
        setMessage(
          `Supabaseへの接続中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    checkSupabaseConnection()
  }, [])

  // 接続チェック中または成功時は何も表示しない
  if (status === "checking" || status === "success") return null

  // エラー時のみアラートを表示
  return (
    <Alert variant="destructive" className="mt-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>接続エラー</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
