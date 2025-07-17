import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()
    
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが必要です' }, { status: 400 })
    }

    // AssemblyAI APIの簡単なテスト
    const response = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': apiKey
      },
      body: new Blob(['test'], { type: 'text/plain' })
    })

    if (response.ok) {
      return NextResponse.json({ success: true, message: 'AssemblyAI API接続成功' })
    } else {
      const error = await response.text()
      return NextResponse.json({ error: `AssemblyAI API接続失敗: ${error}` }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'AssemblyAI API接続エラー' }, { status: 500 })
  }
}
