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
  const { compress = false, targetSizeMB = 10 } = options

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

      if (fileSizeMB > 20) {
        sampleRate = Math.min(sampleRate, 16000) // 16kHz
        numberOfChannels = 1 // モノラル
      } else if (fileSizeMB > 10) {
        sampleRate = Math.min(sampleRate, 22050) // 22.05kHz
        numberOfChannels = 1 // モノラル
      } else {
        sampleRate = Math.min(sampleRate, 32000) // 32kHz
        numberOfChannels = Math.min(numberOfChannels, 1) // モノラル
      }
    }

    // 新しいオーディオバッファを作成
    const length = Math.ceil(audioBuffer.duration * sampleRate)
    const offlineContext = new OfflineAudioContext(numberOfChannels, length, sampleRate)
    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(offlineContext.destination)
    source.start(0)

    const renderedBuffer = await offlineContext.startRendering()

    // WAVファイルとして出力
    const wavBlob = audioBufferToWav(renderedBuffer)

    await audioContext.close()

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

// AudioBufferをWAVファイルに変換
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const length = buffer.length
  const numberOfChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
  const view = new DataView(arrayBuffer)

  // WAVヘッダーを書き込み
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + length * numberOfChannels * 2, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numberOfChannels * 2, true)
  view.setUint16(32, numberOfChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, "data")
  view.setUint32(40, length * numberOfChannels * 2, true)

  // 音声データを書き込み
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" })
}

// 互換性のためのエクスポート
export const processAudioWithFFmpeg = processAudioFile
