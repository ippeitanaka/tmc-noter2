import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  try {
    const { data, error } = await supabase.from('audio_files').select('*')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  try {
    const body = await req.json()
    const { file_path, duration } = body

    const { data, error } = await supabase.from('audio_files').insert([{ file_path, duration }])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const supabase = createClient()
  try {
    const { data, error } = await supabase.from('audio_files').delete().like('file_path', 'test/%')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const deletedCount = Array.isArray(data) ? data.length : 0

    return NextResponse.json({
      success: true,
      message: 'テストデータを削除しました',
      deletedCount,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
