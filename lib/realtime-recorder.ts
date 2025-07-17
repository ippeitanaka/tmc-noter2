// リアルタイム録音機能
export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  currentChunk: number
  totalChunks: number
  audioLevel: number
}

export interface RecordingChunk {
  id: string
  blob: Blob
  timestamp: number
  duration: number
  transcription?: string
}

export interface RecordingConfig {
  chunkDuration: number // 秒
  sampleRate: number
  channels: number
  bitDepth: number
  enableRealTimeTranscription: boolean
  enableSpeakerIdentification: boolean
}

export class RealtimeRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private chunks: RecordingChunk[] = []
  private recordingState: RecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    currentChunk: 0,
    totalChunks: 0,
    audioLevel: 0
  }
  private config: RecordingConfig
  private startTime: number = 0
  private pausedTime: number = 0
  private intervalId: number | null = null
  private onStateChange?: (state: RecordingState) => void
  private onChunkComplete?: (chunk: RecordingChunk) => void
  private onError?: (error: Error) => void

  constructor(config: Partial<RecordingConfig> = {}) {
    this.config = {
      chunkDuration: 30, // 30秒ごとにチャンク分割
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
      enableRealTimeTranscription: true,
      enableSpeakerIdentification: true,
      ...config
    }
  }

  // イベントリスナーを設定
  public setEventListeners(listeners: {
    onStateChange?: (state: RecordingState) => void
    onChunkComplete?: (chunk: RecordingChunk) => void
    onError?: (error: Error) => void
  }) {
    this.onStateChange = listeners.onStateChange
    this.onChunkComplete = listeners.onChunkComplete
    this.onError = listeners.onError
  }

  // マイクアクセスを取得
  public async requestMicrophoneAccess(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      
      this.stream = stream
      this.setupAudioAnalyser()
      return true
    } catch (error) {
      console.error('Microphone access denied:', error)
      if (this.onError) {
        this.onError(new Error('マイクアクセスが拒否されました'))
      }
      return false
    }
  }

  // 音声分析器を設定
  private setupAudioAnalyser() {
    if (!this.stream) return

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const source = this.audioContext.createMediaStreamSource(this.stream)
    
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 256
    source.connect(this.analyser)

    // 音声レベルを監視
    this.startAudioLevelMonitoring()
  }

  // 音声レベル監視を開始
  private startAudioLevelMonitoring() {
    if (!this.analyser) return

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const updateAudioLevel = () => {
      if (!this.analyser) return

      this.analyser.getByteFrequencyData(dataArray)
      
      // 平均音声レベルを計算
      const sum = dataArray.reduce((a, b) => a + b, 0)
      const average = sum / bufferLength
      const normalizedLevel = average / 255 * 100

      this.recordingState.audioLevel = normalizedLevel
      
      if (this.onStateChange) {
        this.onStateChange({ ...this.recordingState })
      }

      if (this.recordingState.isRecording && !this.recordingState.isPaused) {
        requestAnimationFrame(updateAudioLevel)
      }
    }

    updateAudioLevel()
  }

  // 録音を開始
  public async startRecording(): Promise<boolean> {
    if (!this.stream) {
      const hasAccess = await this.requestMicrophoneAccess()
      if (!hasAccess) return false
    }

    try {
      // MediaRecorderを初期化
      const options: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus',
        bitsPerSecond: this.config.sampleRate * this.config.channels * this.config.bitDepth
      }

      this.mediaRecorder = new MediaRecorder(this.stream!, options)
      this.chunks = []
      this.startTime = Date.now()
      this.pausedTime = 0

      // イベントリスナーを設定
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.handleChunkComplete(event.data)
        }
      }

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        if (this.onError) {
          this.onError(new Error('録音中にエラーが発生しました'))
        }
      }

      // 録音開始
      this.mediaRecorder.start(this.config.chunkDuration * 1000)
      
      this.recordingState.isRecording = true
      this.recordingState.isPaused = false
      this.recordingState.currentChunk = 0
      
      this.startDurationTimer()
      this.startAudioLevelMonitoring()

      if (this.onStateChange) {
        this.onStateChange({ ...this.recordingState })
      }

      return true
    } catch (error) {
      console.error('Recording start error:', error)
      if (this.onError) {
        this.onError(new Error('録音開始に失敗しました'))
      }
      return false
    }
  }

  // 録音を一時停止
  public pauseRecording(): void {
    if (this.mediaRecorder && this.recordingState.isRecording && !this.recordingState.isPaused) {
      this.mediaRecorder.pause()
      this.recordingState.isPaused = true
      this.pausedTime = Date.now()

      if (this.onStateChange) {
        this.onStateChange({ ...this.recordingState })
      }
    }
  }

  // 録音を再開
  public resumeRecording(): void {
    if (this.mediaRecorder && this.recordingState.isRecording && this.recordingState.isPaused) {
      this.mediaRecorder.resume()
      this.recordingState.isPaused = false
      this.startTime += (Date.now() - this.pausedTime)

      this.startAudioLevelMonitoring()

      if (this.onStateChange) {
        this.onStateChange({ ...this.recordingState })
      }
    }
  }

  // 録音を停止
  public stopRecording(): void {
    if (this.mediaRecorder && this.recordingState.isRecording) {
      this.mediaRecorder.stop()
      this.recordingState.isRecording = false
      this.recordingState.isPaused = false

      this.stopDurationTimer()

      if (this.onStateChange) {
        this.onStateChange({ ...this.recordingState })
      }
    }
  }

  // 録音時間タイマーを開始
  private startDurationTimer(): void {
    this.intervalId = window.setInterval(() => {
      if (this.recordingState.isRecording && !this.recordingState.isPaused) {
        this.recordingState.duration = (Date.now() - this.startTime) / 1000
        
        if (this.onStateChange) {
          this.onStateChange({ ...this.recordingState })
        }
      }
    }, 100)
  }

  // 録音時間タイマーを停止
  private stopDurationTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  // チャンク完了処理
  private handleChunkComplete(data: Blob): void {
    const chunkId = `chunk-${Date.now()}-${this.recordingState.currentChunk}`
    const chunk: RecordingChunk = {
      id: chunkId,
      blob: data,
      timestamp: Date.now(),
      duration: this.config.chunkDuration
    }

    this.chunks.push(chunk)
    this.recordingState.currentChunk++
    this.recordingState.totalChunks = this.chunks.length

    if (this.onChunkComplete) {
      this.onChunkComplete(chunk)
    }

    if (this.onStateChange) {
      this.onStateChange({ ...this.recordingState })
    }
  }

  // 録音データを結合
  public async combineChunks(): Promise<Blob> {
    if (this.chunks.length === 0) {
      throw new Error('録音データがありません')
    }

    // 全チャンクを結合
    const combinedBlob = new Blob(
      this.chunks.map(chunk => chunk.blob),
      { type: 'audio/webm;codecs=opus' }
    )

    return combinedBlob
  }

  // 録音状態を取得
  public getRecordingState(): RecordingState {
    return { ...this.recordingState }
  }

  // 録音チャンクを取得
  public getChunks(): RecordingChunk[] {
    return [...this.chunks]
  }

  // 特定のチャンクを取得
  public getChunk(chunkId: string): RecordingChunk | undefined {
    return this.chunks.find(chunk => chunk.id === chunkId)
  }

  // 録音をクリア
  public clearRecording(): void {
    this.chunks = []
    this.recordingState = {
      isRecording: false,
      isPaused: false,
      duration: 0,
      currentChunk: 0,
      totalChunks: 0,
      audioLevel: 0
    }
  }

  // リソースをクリーンアップ
  public cleanup(): void {
    this.stopRecording()
    this.stopDurationTimer()
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.mediaRecorder = null
    this.analyser = null
    this.clearRecording()
  }

  // 録音時間を文字列でフォーマット
  public formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 音声レベルを視覚的に表示するためのデータを生成
  public getAudioLevelData(): { level: number; bars: number[] } {
    if (!this.analyser) {
      return { level: 0, bars: [] }
    }

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteFrequencyData(dataArray)

    // 8本のバーで表示
    const barCount = 8
    const barWidth = Math.floor(bufferLength / barCount)
    const bars: number[] = []

    for (let i = 0; i < barCount; i++) {
      let sum = 0
      for (let j = 0; j < barWidth; j++) {
        sum += dataArray[i * barWidth + j]
      }
      bars.push((sum / barWidth) / 255 * 100)
    }

    return {
      level: this.recordingState.audioLevel,
      bars
    }
  }
}
