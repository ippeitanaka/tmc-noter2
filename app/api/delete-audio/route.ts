import { NextResponse } from "next/server"
import { deleteAudioFile } from "@/lib/process-audio"
import { supabase } from "@/lib/supabase-client"

export async function POST(req: Request) {
  try {
    const { filePath, recordId } = await req.json()

    console.log("Delete request received:", { filePath, recordId })

    // recordId のみの場合はデータベースレコードのみを削除
    if (recordId && !filePath) {
      console.log("Deleting database record only, ID:", recordId)

      try {
        const { error: deleteRecordError } = await supabase.from("audio_files").delete().eq("id", recordId)

        if (deleteRecordError) {
          console.error("Failed to delete record from database:", deleteRecordError)
          return NextResponse.json(
            { error: `データベースレコードの削除に失敗しました: ${deleteRecordError.message}` },
            { status: 500 },
          )
        }

        return NextResponse.json({ success: true, message: "データベースレコードを削除しました" })
      } catch (dbError) {
        console.error("Database deletion error:", dbError)
        // エラーが発生しても成功レスポンスを返す（クライアント側でローカルストレージから削除するため）
        return NextResponse.json({ success: true, message: "ローカルストレージからのみ削除されました" })
      }
    }

    // filePath がある場合は従来通りの処理
    if (!filePath && !recordId) {
      return NextResponse.json({ error: "ファイルパスまたはレコードIDが指定されていません" }, { status: 400 })
    }

    if (filePath) {
      try {
        await deleteAudioFile(filePath, recordId)
      } catch (error) {
        console.error("Error deleting audio file:", error)
        // エラーが発生しても成功レスポンスを返す（クライアント側でローカルストレージから削除するため）
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete error:", error)
    // エラーが発生しても成功レスポンスを返す（クライアント側でローカルストレージから削除するため）
    return NextResponse.json({ success: true, message: "ローカルストレージからのみ削除されました" })
  }
}
