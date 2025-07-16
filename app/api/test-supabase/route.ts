import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase-client"
import { createServerAdminClient } from "@/lib/supabase-server"

export async function GET() {
  try {
    console.log("=== Supabase接続テスト開始 ===")

    // 環境変数の確認
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
    }

    console.log("環境変数チェック:", envCheck)

    // 1. クライアント接続テスト
    const clientTest = { success: false, error: null, data: null }
    try {
      const { data, error } = await supabase.from("audio_files").select("count", { count: "exact" }).limit(0)

      if (error) {
        clientTest.error = error.message
      } else {
        clientTest.success = true
        clientTest.data = data
      }
    } catch (error) {
      clientTest.error = error instanceof Error ? error.message : String(error)
    }

    // 2. サーバー管理者接続テスト
    const adminTest = { success: false, error: null, data: null }
    try {
      const adminClient = createServerAdminClient()
      const { data, error } = await adminClient.from("audio_files").select("count", { count: "exact" }).limit(0)

      if (error) {
        adminTest.error = error.message
      } else {
        adminTest.success = true
        adminTest.data = data
      }
    } catch (error) {
      adminTest.error = error instanceof Error ? error.message : String(error)
    }

    // 3. ストレージバケットテスト
    const storageTest = { success: false, error: null, buckets: [] }
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets()

      if (error) {
        storageTest.error = error.message
      } else {
        storageTest.success = true
        storageTest.buckets = buckets?.map((b) => b.name) || []
      }
    } catch (error) {
      storageTest.error = error instanceof Error ? error.message : String(error)
    }

    // 4. テストデータの挿入試行
    const insertTest = { success: false, error: null, data: null }
    try {
      const testRecord = {
        file_path: `test/${Date.now()}-test.mp3`,
        file_name: "test-file.mp3",
        transcript: "これはテストの文字起こしです。",
        minutes: {
          meetingName: "テスト会議",
          date: new Date().toLocaleDateString(),
          participants: "テストユーザー",
          agenda: "テスト議題",
          mainPoints: ["テストポイント1", "テストポイント2"],
          decisions: "テスト決定事項",
          todos: "テストTODO",
        },
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase.from("audio_files").insert([testRecord]).select()

      if (error) {
        insertTest.error = error.message
      } else {
        insertTest.success = true
        insertTest.data = data
      }
    } catch (error) {
      insertTest.error = error instanceof Error ? error.message : String(error)
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envCheck,
      tests: {
        client: clientTest,
        admin: adminTest,
        storage: storageTest,
        insert: insertTest,
      },
    })
  } catch (error) {
    console.error("Supabaseテストエラー:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  try {
    // テストデータの削除
    const { data, error } = await supabase.from("audio_files").delete().like("file_path", "test/%")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "テストデータを削除しました",
      deletedCount: data?.length || 0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
