// 話者識別機能
export interface SpeakerSegment {
  startTime: number
  endTime: number
  speakerId: string
  confidence: number
  text?: string
}

export interface SpeakerProfile {
  id: string
  name: string
  pitch: number
  formant: number[]
  energy: number
  color: string
}

export class SpeakerIdentifier {
  private speakers: Map<string, SpeakerProfile> = new Map()
  private speakerCount = 0

  constructor() {
    // デフォルトの話者色
    this.speakerColors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
    ]
  }

  private speakerColors: string[]

  // 音声の特徴量を抽出
  private extractFeatures(audioBuffer: AudioBuffer, startTime: number, endTime: number): {
    pitch: number
    formant: number[]
    energy: number
  } {
    const sampleRate = audioBuffer.sampleRate
    const startSample = Math.floor(startTime * sampleRate)
    const endSample = Math.floor(endTime * sampleRate)
    const channelData = audioBuffer.getChannelData(0)
    
    // 指定された時間範囲の音声データを抽出
    const segmentData = channelData.slice(startSample, endSample)
    
    // 基本周波数（ピッチ）を推定
    const pitch = this.estimatePitch(segmentData, sampleRate)
    
    // フォルマント周波数を推定
    const formant = this.estimateFormant(segmentData, sampleRate)
    
    // エネルギー（音量）を計算
    const energy = this.calculateEnergy(segmentData)
    
    return { pitch, formant, energy }
  }

  // 基本周波数（ピッチ）推定 - 自己相関関数を使用
  private estimatePitch(data: Float32Array, sampleRate: number): number {
    const minPitch = 50  // 最小ピッチ (Hz)
    const maxPitch = 400 // 最大ピッチ (Hz)
    const minPeriod = Math.floor(sampleRate / maxPitch)
    const maxPeriod = Math.floor(sampleRate / minPitch)
    
    let bestPeriod = minPeriod
    let bestCorrelation = 0
    
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0
      let count = 0
      
      for (let i = 0; i < data.length - period; i++) {
        correlation += data[i] * data[i + period]
        count++
      }
      
      correlation /= count
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation
        bestPeriod = period
      }
    }
    
    return sampleRate / bestPeriod
  }

  // フォルマント周波数推定（簡易版）
  private estimateFormant(data: Float32Array, sampleRate: number): number[] {
    // FFTを使用してスペクトル分析
    const fftSize = 1024
    const spectrum = this.performFFT(data.slice(0, fftSize))
    
    // ピークを検出してフォルマント周波数を推定
    const formants: number[] = []
    const threshold = 0.1
    
    for (let i = 1; i < spectrum.length - 1; i++) {
      if (spectrum[i] > spectrum[i - 1] && 
          spectrum[i] > spectrum[i + 1] && 
          spectrum[i] > threshold) {
        const frequency = (i * sampleRate) / (2 * fftSize)
        if (frequency > 200 && frequency < 3000) {
          formants.push(frequency)
        }
      }
    }
    
    return formants.slice(0, 3) // 最初の3つのフォルマント
  }

  // 簡易FFT実装
  private performFFT(data: Float32Array): Float32Array {
    const N = data.length
    const spectrum = new Float32Array(N / 2)
    
    // 簡易的なスペクトル分析（実際のFFTの代替）
    for (let k = 0; k < N / 2; k++) {
      let real = 0
      let imag = 0
      
      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N
        real += data[n] * Math.cos(angle)
        imag += data[n] * Math.sin(angle)
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag)
    }
    
    return spectrum
  }

  // エネルギー計算
  private calculateEnergy(data: Float32Array): number {
    let energy = 0
    for (let i = 0; i < data.length; i++) {
      energy += data[i] * data[i]
    }
    return energy / data.length
  }

  // 話者を識別
  private identifySpeaker(features: {
    pitch: number
    formant: number[]
    energy: number
  }): { speakerId: string; confidence: number } {
    if (this.speakers.size === 0) {
      // 最初の話者を追加
      const speakerId = `speaker-${this.speakerCount++}`
      const speaker: SpeakerProfile = {
        id: speakerId,
        name: `話者${this.speakerCount}`,
        pitch: features.pitch,
        formant: features.formant,
        energy: features.energy,
        color: this.speakerColors[this.speakerCount - 1] || '#6B7280'
      }
      this.speakers.set(speakerId, speaker)
      return { speakerId, confidence: 1.0 }
    }

    // 既存の話者との類似度を計算
    let bestMatch = ''
    let bestScore = 0
    
    for (const [speakerId, speaker] of this.speakers) {
      const pitchSimilarity = this.calculatePitchSimilarity(features.pitch, speaker.pitch)
      const formantSimilarity = this.calculateFormantSimilarity(features.formant, speaker.formant)
      const energySimilarity = this.calculateEnergySimilarity(features.energy, speaker.energy)
      
      const totalScore = (pitchSimilarity * 0.4) + (formantSimilarity * 0.4) + (energySimilarity * 0.2)
      
      if (totalScore > bestScore) {
        bestScore = totalScore
        bestMatch = speakerId
      }
    }
    
    // 閾値以上の類似度があれば既存の話者、そうでなければ新しい話者
    const threshold = 0.7
    if (bestScore >= threshold) {
      return { speakerId: bestMatch, confidence: bestScore }
    } else {
      // 新しい話者を追加
      const speakerId = `speaker-${this.speakerCount++}`
      const speaker: SpeakerProfile = {
        id: speakerId,
        name: `話者${this.speakerCount}`,
        pitch: features.pitch,
        formant: features.formant,
        energy: features.energy,
        color: this.speakerColors[this.speakerCount - 1] || '#6B7280'
      }
      this.speakers.set(speakerId, speaker)
      return { speakerId, confidence: 1.0 }
    }
  }

  // ピッチ類似度計算
  private calculatePitchSimilarity(pitch1: number, pitch2: number): number {
    const diff = Math.abs(pitch1 - pitch2)
    const maxDiff = 100 // 最大許容差
    return Math.max(0, 1 - (diff / maxDiff))
  }

  // フォルマント類似度計算
  private calculateFormantSimilarity(formant1: number[], formant2: number[]): number {
    if (formant1.length === 0 || formant2.length === 0) return 0
    
    const minLength = Math.min(formant1.length, formant2.length)
    let similarity = 0
    
    for (let i = 0; i < minLength; i++) {
      const diff = Math.abs(formant1[i] - formant2[i])
      const maxDiff = 500 // 最大許容差
      similarity += Math.max(0, 1 - (diff / maxDiff))
    }
    
    return similarity / minLength
  }

  // エネルギー類似度計算
  private calculateEnergySimilarity(energy1: number, energy2: number): number {
    const diff = Math.abs(energy1 - energy2)
    const maxDiff = 0.1 // 最大許容差
    return Math.max(0, 1 - (diff / maxDiff))
  }

  // 音声を話者別に分割
  public async segmentSpeakers(audioBuffer: AudioBuffer): Promise<SpeakerSegment[]> {
    const segments: SpeakerSegment[] = []
    const windowSize = 1.0 // 1秒のウィンドウ
    const hopSize = 0.5 // 0.5秒のホップサイズ
    const duration = audioBuffer.duration
    
    let currentSpeaker = ''
    let segmentStart = 0
    
    for (let time = 0; time < duration; time += hopSize) {
      const endTime = Math.min(time + windowSize, duration)
      
      // 音声特徴量を抽出
      const features = this.extractFeatures(audioBuffer, time, endTime)
      
      // 話者を識別
      const { speakerId, confidence } = this.identifySpeaker(features)
      
      // 話者が変わった場合、新しいセグメントを開始
      if (speakerId !== currentSpeaker) {
        if (currentSpeaker) {
          segments.push({
            startTime: segmentStart,
            endTime: time,
            speakerId: currentSpeaker,
            confidence: 0.8 // 平均的な信頼度
          })
        }
        currentSpeaker = speakerId
        segmentStart = time
      }
    }
    
    // 最後のセグメントを追加
    if (currentSpeaker) {
      segments.push({
        startTime: segmentStart,
        endTime: duration,
        speakerId: currentSpeaker,
        confidence: 0.8
      })
    }
    
    return segments
  }

  // 話者プロファイルを取得
  public getSpeakerProfile(speakerId: string): SpeakerProfile | undefined {
    return this.speakers.get(speakerId)
  }

  // 全話者プロファイルを取得
  public getAllSpeakers(): SpeakerProfile[] {
    return Array.from(this.speakers.values())
  }

  // 話者名を更新
  public updateSpeakerName(speakerId: string, name: string): void {
    const speaker = this.speakers.get(speakerId)
    if (speaker) {
      speaker.name = name
    }
  }
}
