// Web Speech APIを使用した無料の文字起こし機能

interface WebSpeechOptions {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  maxAlternatives?: number
}

interface WebSpeechResult {
  transcript: string
  confidence: number
  isFinal: boolean
  alternatives?: Array<{
    transcript: string
    confidence: number
  }>
}

export class WebSpeechTranscriber {
  private recognition: any
  private isSupported: boolean
  private isListening: boolean = false
  private onResult?: (result: WebSpeechResult) => void
  private onEnd?: () => void
  private onError?: (error: string) => void

  constructor(options: WebSpeechOptions = {}) {
    // ブラウザサポートの確認
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    this.isSupported = !!SpeechRecognition

    if (this.isSupported) {
      this.recognition = new SpeechRecognition()
      this.setupRecognition(options)
    }
  }

  private setupRecognition(options: WebSpeechOptions) {
    this.recognition.continuous = options.continuous ?? true
    this.recognition.interimResults = options.interimResults ?? true
    this.recognition.lang = options.language ?? 'ja-JP'
    this.recognition.maxAlternatives = options.maxAlternatives ?? 3

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      const transcript = result[0].transcript
      const confidence = result[0].confidence
      const isFinal = result.isFinal

      const alternatives = []
      for (let i = 0; i < result.length; i++) {
        alternatives.push({
          transcript: result[i].transcript,
          confidence: result[i].confidence
        })
      }

      this.onResult?.({
        transcript,
        confidence,
        isFinal,
        alternatives
      })
    }

    this.recognition.onerror = (event: any) => {
      this.onError?.(`音声認識エラー: ${event.error}`)
      this.isListening = false
    }

    this.recognition.onend = () => {
      this.isListening = false
      this.onEnd?.()
    }
  }

  public startListening(
    onResult: (result: WebSpeechResult) => void,
    onEnd?: () => void,
    onError?: (error: string) => void
  ) {
    if (!this.isSupported) {
      onError?.('このブラウザはWeb Speech APIをサポートしていません')
      return
    }

    this.onResult = onResult
    this.onEnd = onEnd
    this.onError = onError

    this.recognition.start()
    this.isListening = true
  }

  public stopListening() {
    if (this.isSupported && this.isListening) {
      this.recognition.stop()
    }
  }

  public isListeningActive(): boolean {
    return this.isListening
  }

  public isSupportedBrowser(): boolean {
    return this.isSupported
  }
}

// 音声ファイルをWeb Speech APIで文字起こし
export async function transcribeAudioFile(
  file: File,
  options: WebSpeechOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      reject(new Error('このブラウザはAudio APIをサポートしていません'))
      return
    }

    const transcriber = new WebSpeechTranscriber(options)
    
    if (!transcriber.isSupportedBrowser()) {
      reject(new Error('このブラウザはWeb Speech APIをサポートしていません'))
      return
    }

    // 音声ファイルを再生して文字起こし
    const audio = new Audio(URL.createObjectURL(file))
    let fullTranscript = ''

    transcriber.startListening(
      (result) => {
        if (result.isFinal) {
          fullTranscript += result.transcript + ' '
        }
      },
      () => {
        resolve(fullTranscript.trim())
      },
      (error) => {
        reject(new Error(error))
      }
    )

    // 音声を再生開始
    audio.play().catch(reject)
    
    // 音声終了時にリスニングを停止
    audio.onended = () => {
      setTimeout(() => {
        transcriber.stopListening()
      }, 1000) // 1秒待ってから停止
    }
  })
}

// リアルタイム音声文字起こし
export function startRealtimeTranscription(
  options: WebSpeechOptions = {}
): {
  transcriber: WebSpeechTranscriber
  start: (onResult: (result: WebSpeechResult) => void) => void
  stop: () => void
} {
  const transcriber = new WebSpeechTranscriber(options)
  
  return {
    transcriber,
    start: (onResult: (result: WebSpeechResult) => void) => {
      transcriber.startListening(
        onResult,
        () => console.log('リアルタイム文字起こしが終了しました'),
        (error) => console.error('エラー:', error)
      )
    },
    stop: () => transcriber.stopListening()
  }
}
