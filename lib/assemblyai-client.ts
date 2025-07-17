// AssemblyAI API（月5時間無料）を使用した文字起こし機能

interface AssemblyAIOptions {
  language_code?: string
  speaker_labels?: boolean
  auto_chapters?: boolean
  summarization?: boolean
  sentiment_analysis?: boolean
  entity_detection?: boolean
  iab_categories?: boolean
  content_safety?: boolean
  auto_highlights?: boolean
  punctuate?: boolean
  format_text?: boolean
}

interface AssemblyAIResult {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  text?: string
  words?: Array<{
    text: string
    start: number
    end: number
    confidence: number
    speaker?: string
  }>
  chapters?: Array<{
    summary: string
    headline: string
    gist: string
    start: number
    end: number
  }>
  summary?: string
  sentiment_analysis_results?: Array<{
    text: string
    sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
    confidence: number
    start: number
    end: number
  }>
  entities?: Array<{
    text: string
    label: string
    start: number
    end: number
  }>
  iab_categories_result?: {
    summary: Record<string, number>
    results: Array<{
      text: string
      labels: Array<{
        relevance: number
        label: string
      }>
    }>
  }
  content_safety_labels?: {
    summary: Record<string, number>
    results: Array<{
      text: string
      labels: Array<{
        confidence: number
        label: string
      }>
    }>
  }
  auto_highlights_result?: {
    results: Array<{
      count: number
      rank: number
      text: string
      timestamps: Array<{
        start: number
        end: number
      }>
    }>
  }
  error?: string
}

export class AssemblyAITranscriber {
  private apiKey: string
  private baseUrl = 'https://api.assemblyai.com/v2'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  // 音声ファイルをアップロード
  async uploadFile(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.upload_url
  }

  // 文字起こしを開始
  async startTranscription(audioUrl: string, options: AssemblyAIOptions = {}): Promise<string> {
    const requestData = {
      audio_url: audioUrl,
      language_code: options.language_code || 'ja',
      speaker_labels: options.speaker_labels || false,
      auto_chapters: options.auto_chapters || false,
      summarization: options.summarization || false,
      sentiment_analysis: options.sentiment_analysis || false,
      entity_detection: options.entity_detection || false,
      iab_categories: options.iab_categories || false,
      content_safety: options.content_safety || false,
      auto_highlights: options.auto_highlights || false,
      punctuate: options.punctuate || true,
      format_text: options.format_text || true
    }

    const response = await fetch(`${this.baseUrl}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })

    if (!response.ok) {
      throw new Error(`Transcription request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.id
  }

  // 文字起こし結果を取得
  async getTranscriptionResult(transcriptId: string): Promise<AssemblyAIResult> {
    const response = await fetch(`${this.baseUrl}/transcript/${transcriptId}`, {
      headers: {
        'Authorization': this.apiKey
      }
    })

    if (!response.ok) {
      throw new Error(`Get transcription failed: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  // 文字起こしが完了するまで待機
  async waitForCompletion(transcriptId: string, pollInterval: number = 1000): Promise<AssemblyAIResult> {
    while (true) {
      const result = await this.getTranscriptionResult(transcriptId)
      
      if (result.status === 'completed') {
        return result
      } else if (result.status === 'error') {
        throw new Error(`Transcription failed: ${result.error}`)
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  // ファイルから文字起こしを実行（便利メソッド）
  async transcribeFile(file: File, options: AssemblyAIOptions = {}): Promise<AssemblyAIResult> {
    console.log('Uploading file to AssemblyAI...')
    const audioUrl = await this.uploadFile(file)
    
    console.log('Starting transcription...')
    const transcriptId = await this.startTranscription(audioUrl, options)
    
    console.log('Waiting for transcription to complete...')
    const result = await this.waitForCompletion(transcriptId)
    
    return result
  }
}

// 簡単に使用できる関数
export async function transcribeWithAssemblyAI(
  file: File,
  apiKey: string,
  options: AssemblyAIOptions = {}
): Promise<AssemblyAIResult> {
  const transcriber = new AssemblyAITranscriber(apiKey)
  return await transcriber.transcribeFile(file, options)
}

// AssemblyAI APIキーが設定されているかチェック
export function hasAssemblyAIApiKey(): boolean {
  return !!(process.env.ASSEMBLYAI_API_KEY || process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY)
}

// AssemblyAI APIキーを取得
export function getAssemblyAIApiKey(): string {
  const apiKey = process.env.ASSEMBLYAI_API_KEY || process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY
  if (!apiKey) {
    throw new Error('AssemblyAI API keyが設定されていません')
  }
  return apiKey
}
