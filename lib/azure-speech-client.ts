// Azure Cognitive Services Speech-to-Text（月5時間無料）

interface AzureSpeechOptions {
  language?: string
  outputFormat?: 'simple' | 'detailed'
  profanityOption?: 'Masked' | 'Removed' | 'Raw'
  enableWordLevelTimestamps?: boolean
  enableSentiment?: boolean
  enableSpeakerDiarization?: boolean
  maxSpeakerCount?: number
}

interface AzureSpeechResult {
  RecognitionStatus: 'Success' | 'NoMatch' | 'InitialSilenceTimeout' | 'BabbleTimeout' | 'Error'
  DisplayText?: string
  Duration?: number
  Offset?: number
  NBest?: Array<{
    Confidence: number
    Lexical: string
    ITN: string
    MaskedITN: string
    Display: string
    Sentiment?: {
      Negative: number
      Neutral: number
      Positive: number
    }
    Words?: Array<{
      Word: string
      Offset: number
      Duration: number
      Confidence?: number
    }>
  }>
  Speaker?: {
    Id: number
    Channel: number
  }
}

export class AzureSpeechTranscriber {
  private subscriptionKey: string
  private region: string
  private baseUrl: string

  constructor(subscriptionKey: string, region: string) {
    this.subscriptionKey = subscriptionKey
    this.region = region
    this.baseUrl = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`
  }

  // 音声ファイルを文字起こし
  async transcribeFile(file: File, options: AzureSpeechOptions = {}): Promise<AzureSpeechResult> {
    const url = new URL(this.baseUrl)
    url.searchParams.append('language', options.language || 'ja-JP')
    url.searchParams.append('format', options.outputFormat || 'detailed')
    
    if (options.profanityOption) {
      url.searchParams.append('profanity', options.profanityOption)
    }
    
    if (options.enableWordLevelTimestamps) {
      url.searchParams.append('wordLevelTimestamps', 'true')
    }
    
    if (options.enableSentiment) {
      url.searchParams.append('sentiment', 'true')
    }
    
    if (options.enableSpeakerDiarization) {
      url.searchParams.append('diarization', 'true')
      if (options.maxSpeakerCount) {
        url.searchParams.append('maxSpeakerCount', options.maxSpeakerCount.toString())
      }
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        'Accept': 'application/json'
      },
      body: file
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Azure Speech API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return await response.json()
  }

  // 長い音声ファイル用のバッチ文字起こし
  async startBatchTranscription(
    audioUrl: string,
    options: AzureSpeechOptions & { name?: string; description?: string } = {}
  ): Promise<string> {
    const requestBody = {
      contentUrls: [audioUrl],
      properties: {
        diarizationEnabled: options.enableSpeakerDiarization || false,
        wordLevelTimestampsEnabled: options.enableWordLevelTimestamps || false,
        punctuationMode: 'DictatedAndAutomatic',
        profanityFilterMode: options.profanityOption || 'Masked'
      },
      locale: options.language || 'ja-JP',
      displayName: options.name || 'Transcription Job',
      description: options.description || 'Batch transcription job'
    }

    const response = await fetch(`https://${this.region}.api.cognitive.microsoft.com/speechtotext/v3.0/transcriptions`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Azure Batch API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    return result.self.split('/').pop() // Extract transcription ID
  }

  // バッチ文字起こしの結果を取得
  async getBatchTranscriptionResult(transcriptionId: string): Promise<any> {
    const response = await fetch(`https://${this.region}.api.cognitive.microsoft.com/speechtotext/v3.0/transcriptions/${transcriptionId}`, {
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Azure Batch API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return await response.json()
  }

  // バッチ文字起こしが完了するまで待機
  async waitForBatchCompletion(transcriptionId: string, pollInterval: number = 5000): Promise<any> {
    while (true) {
      const result = await this.getBatchTranscriptionResult(transcriptionId)
      
      if (result.status === 'Succeeded') {
        // 結果ファイルのURLを取得
        const filesResponse = await fetch(result.links.files, {
          headers: {
            'Ocp-Apim-Subscription-Key': this.subscriptionKey
          }
        })
        
        const files = await filesResponse.json()
        const resultFile = files.values.find((f: any) => f.kind === 'Transcription')
        
        if (resultFile) {
          const transcriptResponse = await fetch(resultFile.links.contentUrl, {
            headers: {
              'Ocp-Apim-Subscription-Key': this.subscriptionKey
            }
          })
          return await transcriptResponse.json()
        }
        
        return result
      } else if (result.status === 'Failed') {
        throw new Error(`Batch transcription failed: ${result.statusMessage}`)
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }
}

// 簡単に使用できる関数
export async function transcribeWithAzure(
  file: File,
  subscriptionKey: string,
  region: string,
  options: AzureSpeechOptions = {}
): Promise<AzureSpeechResult> {
  const transcriber = new AzureSpeechTranscriber(subscriptionKey, region)
  return await transcriber.transcribeFile(file, options)
}

// Azure Speech APIキーが設定されているかチェック
export function hasAzureSpeechApiKey(): boolean {
  return !!(process.env.AZURE_SPEECH_KEY || process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY)
}

// Azure Speech APIキーを取得
export function getAzureSpeechApiKey(): string {
  const apiKey = process.env.AZURE_SPEECH_KEY || process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY
  if (!apiKey) {
    throw new Error('Azure Speech API keyが設定されていません')
  }
  return apiKey
}

// Azure Speech regionを取得
export function getAzureSpeechRegion(): string {
  const region = process.env.AZURE_SPEECH_REGION || process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION || 'eastus'
  return region
}
