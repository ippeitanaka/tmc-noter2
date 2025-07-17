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
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // 圧縮設定
    let sampleRate = audioBuffer.sampleRate
    let numberOfChannels = audioBuffer.numberOfChannels

    if (compress) {
      // より積極的な圧縮設定
      const fileSizeMB = file.size / (1024 * 1024)
      
      console.log(`Original file: ${fileSizeMB.toFixed(2)}MB, Target: ${targetSizeMB}MB`)

      // ターゲットサイズに基づいて圧縮レベルを決定
      if (fileSizeMB > targetSizeMB * 8) {
        // 非常に大きなファイル
        sampleRate = 8000 // 8kHz (電話品質)
        numberOfChannels = 1 // モノラル
      } else if (fileSizeMB > targetSizeMB * 4) {
        // 大きなファイル
        sampleRate = 16000 // 16kHz (音声認識用)
        numberOfChannels = 1 // モノラル
      } else if (fileSizeMB > targetSizeMB * 2) {
        // 中程度のファイル
        sampleRate = 22050 // 22.05kHz
        numberOfChannels = 1 // モノラル
      } else {
        // 小さなファイル
        sampleRate = Math.min(sampleRate, 32000) // 32kHz
        numberOfChannels = 1 // モノラル
      }

      console.log(`Compression settings: ${sampleRate}Hz, ${numberOfChannels} channels`)
    }

    // 新しいオーディオバッファを作成
    const length = Math.ceil(audioBuffer.duration * sampleRate)
    const offlineContext = new OfflineAudioContext(numberOfChannels, length, sampleRate)
    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(offlineContext.destination)
    source.start(0)

    const renderedBuffer = await offlineContext.startRendering()

    // MP3エンコーディングを模倣した圧縮WAVファイルとして出力
    const wavBlob = audioBufferToCompressedWav(renderedBuffer)

    await audioContext.close()

    const compressionRatio = wavBlob.size / file.size
    console.log(`Compression result: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(wavBlob.size / 1024 / 1024).toFixed(2)}MB (${(compressionRatio * 100).toFixed(1)}%)`)

    // 圧縮結果が十分でない場合は、さらに量子化レベルを下げる
    if (wavBlob.size > file.size * 0.8) {
      console.warn("Compression not effective enough, applying additional compression")
      const furtherCompressed = audioBufferToCompressedWav(renderedBuffer, 8) // 8bit量子化
      
      if (furtherCompressed.size < wavBlob.size) {
        return {
          blob: furtherCompressed,
          type: "audio/wav",
        }
      }
    }

    // 圧縮結果が元のファイルより大きい場合は元のファイルを返す
    if (wavBlob.size > file.size) {
      console.warn("Compression resulted in larger file, using original")
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

// AudioBufferを圧縮WAVファイルに変換
function audioBufferToCompressedWav(buffer: AudioBuffer, bitDepth: number = 16): Blob {
  const length = buffer.length
  const numberOfChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bytesPerSample = bitDepth / 8
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * bytesPerSample)
  const view = new DataView(arrayBuffer)

  // WAVヘッダーを書き込み
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + length * numberOfChannels * bytesPerSample, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true)
  view.setUint16(32, numberOfChannels * bytesPerSample, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, "data")
  view.setUint32(40, length * numberOfChannels * bytesPerSample, true)

  // 音声データを書き込み（量子化レベルを調整）
  let offset = 44
  const maxValue = Math.pow(2, bitDepth - 1) - 1
  const minValue = -Math.pow(2, bitDepth - 1)
  
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      let sample = buffer.getChannelData(channel)[i]
      
      // 量子化レベルを下げてファイルサイズを削減
      if (bitDepth === 8) {
        sample = Math.round(sample * 127) / 127
        const quantized = Math.max(minValue, Math.min(maxValue, sample * maxValue))
        view.setInt8(offset, quantized)
        offset += 1
      } else {
        // 16bit
        sample = Math.round(sample * 32767) / 32767
        const quantized = Math.max(minValue, Math.min(maxValue, sample * maxValue))
        view.setInt16(offset, quantized, true)
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
