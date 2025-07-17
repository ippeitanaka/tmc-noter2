"use client"

// Web Audio APIを使用した音声処理
export const isAudioProcessingAvailable = (): boolean => {
  if (typeof window === "undefined") return false
  return !!(window.AudioContext || (window as any).webkitAudioContext)
}

export interface AudioProcessingOptions {
  compress?: boolean
  convertFormat?: boolean
  targetSizeMB?: number
}

export const processAudioFile = async (
  file: File,
  options: AudioProcessingOptions = {},
): Promise<{ blob: Blob; type: string }> => {
  const { compress = false, targetSizeMB = 3 } = options

  if (!isAudioProcessingAvailable()) {
    console.warn("Audio processing is not available in this browser")
    return {
      blob: file,
      type: file.type,
    }
  }

  try {
    const fileSizeMB = file.size / (1024 * 1024)
    console.log(`Processing file: ${fileSizeMB.toFixed(2)}MB, Target: ${targetSizeMB}MB`)

    // 大きなファイルの場合、チャンク処理を使用
    if (fileSizeMB > 10) {
      return await processLargeAudioFile(file, options)
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // 圧縮設定
    let sampleRate = audioBuffer.sampleRate
    let numberOfChannels = audioBuffer.numberOfChannels
    let duration = audioBuffer.duration
    let maxDuration = null

    if (compress) {
      console.log(`Original file: ${fileSizeMB.toFixed(2)}MB, Target: ${targetSizeMB}MB, Duration: ${duration.toFixed(2)}s`)

      // 音声を分割して処理する（10分以上の場合）
      if (duration > 600) { // 10分以上の場合
        maxDuration = 600 // 10分に制限
        console.log(`Duration limited to ${maxDuration}s`)
      }

      // ターゲットサイズに基づいて圧縮レベルを決定
      numberOfChannels = 1 // 常にモノラル
      
      // より積極的な圧縮設定
      if (fileSizeMB > targetSizeMB * 8) {
        sampleRate = 8000 // 8kHz (電話品質)
      } else if (fileSizeMB > targetSizeMB * 4) {
        sampleRate = 11025 // 11kHz 
      } else if (fileSizeMB > targetSizeMB * 2) {
        sampleRate = 16000 // 16kHz
      } else {
        sampleRate = 22050 // 22kHz
      }

      // 元のサンプリングレートより高くしない
      sampleRate = Math.min(sampleRate, audioBuffer.sampleRate)

      console.log(`Compression settings: ${sampleRate}Hz, ${numberOfChannels} channels`)
    }

    // 処理する音声の長さを決定
    const processingDuration = maxDuration ? Math.min(maxDuration, duration) : duration
    const newLength = Math.floor(processingDuration * sampleRate)
    
    // 新しいオーディオバッファを作成
    const offlineContext = new OfflineAudioContext(numberOfChannels, newLength, sampleRate)
    
    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(offlineContext.destination)
    source.start(0)

    const renderedBuffer = await offlineContext.startRendering()
    await audioContext.close()

    // 圧縮されたWAVファイルを生成（8bitで最大圧縮）
    const wavBlob = audioBufferToCompressedWav(renderedBuffer, 8)

    const compressionRatio = wavBlob.size / file.size
    console.log(`Compression result: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(wavBlob.size / 1024 / 1024).toFixed(2)}MB (${(compressionRatio * 100).toFixed(1)}%)`)

    // 圧縮結果が元のファイルより大きい場合や圧縮効果が低い場合は元のファイルを返す
    if (wavBlob.size > file.size || compressionRatio > 0.9) {
      console.warn("Compression not effective, using original file")
      return {
        blob: file,
        type: file.type,
      }
    }

    return {
      blob: wavBlob,
      type: "audio/wav",
    }
  } catch (error) {
    console.error("Audio processing error:", error)
    // エラーが発生した場合は元のファイルを返す
    return {
      blob: file,
      type: file.type,
    }
  }
}

// 大きなファイルを効率的に処理する関数
const processLargeAudioFile = async (
  file: File,
  options: AudioProcessingOptions = {},
): Promise<{ blob: Blob; type: string }> => {
  const { compress = false, targetSizeMB = 3 } = options
  const fileSizeMB = file.size / (1024 * 1024)
  
  console.log(`Processing large file: ${fileSizeMB.toFixed(2)}MB`)

  try {
    // より小さなチャンクで処理
    const chunkSize = 2 * 1024 * 1024 // 2MB chunks
    const chunks: Blob[] = []
    
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const chunk = file.slice(offset, offset + chunkSize)
      chunks.push(chunk)
    }

    console.log(`Split into ${chunks.length} chunks`)

    // 最初のチャンクのみを使用して圧縮テスト
    const firstChunk = chunks[0]
    const testFile = new File([firstChunk], "test.wav", { type: file.type })
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const arrayBuffer = await testFile.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // 圧縮設定を決定
    let sampleRate = 8000 // 大きなファイルは常に8kHz
    let numberOfChannels = 1 // モノラル
    
    if (compress) {
      // 非常に積極的な圧縮
      if (fileSizeMB > targetSizeMB * 20) {
        sampleRate = 6000 // 6kHz (最低品質)
      } else if (fileSizeMB > targetSizeMB * 10) {
        sampleRate = 8000 // 8kHz
      } else {
        sampleRate = 11025 // 11kHz
      }
    }

    console.log(`Large file compression settings: ${sampleRate}Hz, ${numberOfChannels} channels`)

    // 全体の音声を短時間で処理
    const maxDuration = 300 // 5分に制限
    const processingDuration = Math.min(maxDuration, audioBuffer.duration)
    const newLength = Math.floor(processingDuration * sampleRate)
    
    const offlineContext = new OfflineAudioContext(numberOfChannels, newLength, sampleRate)
    
    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(offlineContext.destination)
    source.start(0)

    const renderedBuffer = await offlineContext.startRendering()
    await audioContext.close()

    // 最大圧縮でWAVファイルを生成
    const wavBlob = audioBufferToCompressedWav(renderedBuffer, 8)

    console.log(`Large file compression result: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(wavBlob.size / 1024 / 1024).toFixed(2)}MB`)

    return {
      blob: wavBlob,
      type: "audio/wav",
    }
  } catch (error) {
    console.error("Large file processing error:", error)
    
    // フォールバック: 元のファイルを大幅に短縮
    try {
      const truncatedFile = file.slice(0, 2 * 1024 * 1024) // 最初の2MBのみ
      return {
        blob: truncatedFile,
        type: file.type,
      }
    } catch (fallbackError) {
      console.error("Fallback processing error:", fallbackError)
      return {
        blob: file,
        type: file.type,
      }
    }
  }
}

// AudioBufferを圧縮WAVファイルに変換
const audioBufferToCompressedWav = (buffer: AudioBuffer, bitsPerSample: number = 8): Blob => {
  const length = buffer.length
  const numberOfChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  
  // 正確なバイト数を計算
  const bytesPerSample = bitsPerSample / 8
  const dataSize = length * numberOfChannels * bytesPerSample
  
  // WAVファイルヘッダー
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)
  
  // WAVファイルヘッダーを書き込み
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  const byteRate = sampleRate * numberOfChannels * bytesPerSample
  const blockAlign = numberOfChannels * bytesPerSample
  
  writeString(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, "data")
  view.setUint32(40, dataSize, true)
  
  // 音声データを書き込み
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i]
      
      if (bitsPerSample === 8) {
        // 8bit: 0-255の範囲に変換（unsigned）
        const intSample = Math.max(-1, Math.min(1, sample))
        const unsignedSample = Math.round((intSample + 1) * 127.5)
        view.setUint8(offset, unsignedSample)
        offset += 1
      } else {
        // 16bit: -32768 to 32767の範囲に変換
        const intSample = Math.max(-1, Math.min(1, sample))
        const signedSample = Math.round(intSample * 32767)
        view.setInt16(offset, signedSample, true)
        offset += 2
      }
    }
  }
  
  return new Blob([arrayBuffer], { type: "audio/wav" })
}

// AudioBufferをWAVファイルに変換（従来の関数）
function audioBufferToWav(buffer: AudioBuffer): Blob {
  return audioBufferToCompressedWav(buffer, 16)
}

// 互換性のためのエクスポート
export const processAudioWithFFmpeg = processAudioFile
