// ブラウザのWeb Speech APIを使用した文字起こし機能

// Web Speech APIのタイプ定義
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: ((event: Event) => void) | null
}

// ブラウザ環境かどうかを安全にチェック
const isBrowser = typeof window !== "undefined"

// Web Speech APIのサポートチェック
export function isSpeechRecognitionSupported(): boolean {
  if (!isBrowser) return false
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window
}

// 音声ファイルから文字起こしを行う関数
export async function transcribeAudioFile(
  audioFile: File,
  progressCallback?: (progress: number) => void,
): Promise<string> {
  // ブラウザ環境でなければエラー
  if (!isBrowser) {
    throw new Error("この機能はブラウザでのみ利用可能です")
  }

  return new Promise<string>((resolve, reject) => {
    try {
      if (progressCallback) progressCallback(10)

      // 音声認識の初期化
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      if (!SpeechRecognition) {
        throw new Error("このブラウザは音声認識をサポートしていません")
      }

      // ユーザーに説明を表示
      alert(
        "音声認識を開始します。\n\n" +
          "注意: この方法では、音声ファイルを再生し、その音をマイクで拾って認識します。\n" +
          "音声を聞き取れる環境で、スピーカーとマイクを適切に設定してください。\n\n" +
          "OKをクリックすると音声が再生されます。",
      )

      // 音声ファイルのURLを作成
      const audioUrl = URL.createObjectURL(audioFile)
      const audio = new Audio(audioUrl)
      audio.volume = 1.0 // 最大音量で再生

      const recognition = new SpeechRecognition() as SpeechRecognition
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "ja-JP"

      let transcript = ""
      let lastActivityTime = Date.now()
      let noSpeechTimeout: NodeJS.Timeout | null = null

      // 無音検出タイマーをリセットする関数
      const resetNoSpeechTimer = () => {
        lastActivityTime = Date.now()
        if (noSpeechTimeout) {
          clearTimeout(noSpeechTimeout)
        }

        // 10秒間音声が検出されなければタイムアウト
        noSpeechTimeout = setTimeout(() => {
          console.log("No speech detected for 10 seconds, stopping recognition")
          recognition.stop()
        }, 10000)
      }

      if (progressCallback) progressCallback(30)

      // 結果ハンドラ
      recognition.onresult = (event) => {
        resetNoSpeechTimer()

        let interimTranscript = ""
        let finalTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript + " "
          } else {
            interimTranscript += result[0].transcript + " "
          }
        }

        if (finalTranscript) {
          transcript += finalTranscript
          console.log("認識結果（確定）:", finalTranscript)
        }

        if (interimTranscript) {
          console.log("認識結果（暫定）:", interimTranscript)
        }

        if (progressCallback) progressCallback(50)
      }

      // エラーハンドラ
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event)

        // no-speech エラーの場合は無視して継続
        if (event.error === "no-speech") {
          console.log("No speech detected, continuing...")
          return
        }

        audio.pause()
        URL.revokeObjectURL(audioUrl)
        if (noSpeechTimeout) clearTimeout(noSpeechTimeout)

        // 既に文字起こしが得られている場合は成功とみなす
        if (transcript.trim()) {
          if (progressCallback) progressCallback(100)
          resolve(transcript.trim())
        } else {
          reject(new Error(`音声認識中にエラーが発生しました: ${event.error || "unknown error"}`))
        }
      }

      // 終了ハンドラ
      recognition.onend = () => {
        if (progressCallback) progressCallback(90)
        audio.pause()
        URL.revokeObjectURL(audioUrl)
        if (noSpeechTimeout) clearTimeout(noSpeechTimeout)

        // 文字起こし結果を返す
        if (transcript.trim()) {
          if (progressCallback) progressCallback(100)
          resolve(transcript.trim())
        } else {
          // 音声ファイルが短すぎるか、認識できなかった場合
          reject(new Error("文字起こしに失敗しました。結果が空です。手動入力をお試しください。"))
        }
      }

      // 音声の再生が終了したら認識も終了
      audio.onended = () => {
        // 音声が終了しても少し待ってから認識を終了（遅延認識のため）
        setTimeout(() => {
          recognition.stop()
        }, 2000)
      }

      // 音声の再生開始と同時に認識開始
      audio.onplay = () => {
        recognition.start()
        resetNoSpeechTimer()
        if (progressCallback) progressCallback(40)
      }

      // 音声再生開始
      audio.play().catch((error) => {
        console.error("Audio playback error", error)
        URL.revokeObjectURL(audioUrl)
        reject(new Error("音声ファイルの再生に失敗しました"))
      })
    } catch (error) {
      console.error("Transcription error:", error)
      reject(error)
    }
  })
}

// プログレスバーのアニメーション用
export async function simulateTranscription(progressCallback?: (progress: number) => void): Promise<void> {
  if (!progressCallback) return

  progressCallback(10)
  await new Promise((resolve) => setTimeout(resolve, 500))
  progressCallback(30)
  await new Promise((resolve) => setTimeout(resolve, 500))
  progressCallback(50)
  await new Promise((resolve) => setTimeout(resolve, 500))
  progressCallback(70)
  await new Promise((resolve) => setTimeout(resolve, 500))
  progressCallback(90)
  await new Promise((resolve) => setTimeout(resolve, 500))
  progressCallback(100)
}
