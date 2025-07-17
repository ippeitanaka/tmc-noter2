import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { apiKey, region } = await request.json()
    
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが必要です' }, { status: 400 })
    }

    const regionToUse = region || 'eastus'

    // Azure Speech APIの簡単なテスト
    const response = await fetch(`https://${regionToUse}.api.cognitive.microsoft.com/speechtotext/v3.0/transcriptions`, {
      method: 'GET',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      }
    })

    if (response.ok) {
      return NextResponse.json({ success: true, message: 'Azure Speech API接続成功' })
    } else {
      const error = await response.text()
      return NextResponse.json({ error: `Azure Speech API接続失敗: ${error}` }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Azure Speech API接続エラー' }, { status: 500 })
  }
}
