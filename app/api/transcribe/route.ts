import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const maxDuration = 300 // 5分に拡張（大きなファイル処理のため）

// 10段階の超々強化重複除去システム（音声ファイル用）
function removeDuplicatesUltraEnhanced(text: string): string {
  if (!text || text.trim().length === 0) return text;

  console.log('🔧 音声ファイル重複除去開始:', text.slice(0, 100) + '...');

  // 編集距離（レーベンシュタイン距離）を計算
  const getEditDistance = (str1: string, str2: string): number => {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }
    return dp[m][n];
  };

  // 類似度計算（0-1、1が最も類似）
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    const distance = getEditDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  };

  // 段階1: 事前清掃とノイズ除去
  let cleanText = text
    .replace(/\s+/g, ' ')  // 複数スペースを単一に
    .replace(/([。．!！?？])\s*\1+/g, '$1')  // 句読点の重複除去
    .replace(/([、，])\s*\1+/g, '$1')  // 読点の重複除去
    .replace(/\s*([。．!！?？、，])\s*/g, '$1 ')  // 句読点前後のスペース正規化
    .trim();

  // 段階2: 極端な文字反復の除去（強化版）
  cleanText = cleanText
    .replace(/(.)\1{7,}/g, '$1$1')  // 8回以上の文字反復を2回に
    .replace(/(.{1,3})\1{5,}/g, '$1$1')  // 1-3文字の6回以上反復を2回に
    .replace(/(.{1,5})\1{3,}/g, '$1')  // 1-5文字の4回以上反復を1回に
    .replace(/(.{1,10})\1{2,}/g, '$1')  // 1-10文字の3回以上反復を1回に
    .replace(/(.{1,20})\1{1,}/g, (match, p1) => {
      // 意味のある反復判定
      if (p1.match(/^[あ-ん]{1,5}$|^[ァ-ヴ]{1,5}$|^[一-龠]{1,3}$/)) {
        return p1; // ひらがな、カタカナ、漢字の短い反復は除去
      }
      return match; // それ以外は保持
    });

  // 段階3: 単語・フレーズレベルの反復除去
  const words = cleanText.split(/\s+/);
  const deduplicatedWords: string[] = [];
  let i = 0;
  
  while (i < words.length) {
    const word = words[i];
    let consecutiveCount = 1;
    
    // 連続する同じ単語をカウント
    while (i + consecutiveCount < words.length && words[i + consecutiveCount] === word) {
      consecutiveCount++;
    }
    
    // 意味のある反復を判定
    const isMeaningfulRepetition = (w: string, count: number): boolean => {
      const allowedDouble = ['すごく', 'とても', 'だんだん', 'どんどん', 'もっと', 'ずっと'];
      if (allowedDouble.includes(w) && count <= 2) return true;
      
      const responseWords = ['はい', 'ええ', 'そう', 'うん', 'あー', 'うーん'];
      if (responseWords.includes(w) && count <= 3) return true;
      
      return false;
    };
    
    if (consecutiveCount >= 3 && !isMeaningfulRepetition(word, consecutiveCount)) {
      deduplicatedWords.push(word);
    } else if (consecutiveCount === 2 && word.length <= 3 && !isMeaningfulRepetition(word, 2)) {
      deduplicatedWords.push(word);
    } else {
      for (let j = 0; j < Math.min(consecutiveCount, isMeaningfulRepetition(word, consecutiveCount) ? consecutiveCount : 2); j++) {
        deduplicatedWords.push(word);
      }
    }
    
    i += consecutiveCount;
  }

  // 段階4: 文境界での分割と重複除去
  let sentences = deduplicatedWords.join(' ').split(/[.!?。！？]/);
  sentences = sentences.filter((sentence, index, arr) => {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) return false;
    
    const firstIndex = arr.findIndex(s => s.trim() === trimmed);
    return firstIndex === index;
  });

  // 段階5: 長いフレーズの類似度ベース重複除去
  const filteredSentences: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const current = sentences[i].trim();
    if (current.length === 0) continue;

    let isDuplicate = false;
    let bestMatchIndex = -1;
    let bestSimilarity = 0;
    
    for (let j = 0; j < filteredSentences.length; j++) {
      const existing = filteredSentences[j].trim();
      const similarity = calculateSimilarity(current, existing);
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatchIndex = j;
      }
      
      if (similarity >= 0.85) {  // 音声ファイルは85%閾値
        isDuplicate = true;
        break;
      }
    }
    
    if (isDuplicate && bestMatchIndex >= 0) {
      if (current.length > filteredSentences[bestMatchIndex].length) {
        filteredSentences[bestMatchIndex] = current;
      }
    } else if (!isDuplicate) {
      filteredSentences.push(current);
    }
  }

  // 段階6-10: 追加の清掃処理
  let result = filteredSentences.join(' ')
    .replace(/です\s+です/g, 'です')
    .replace(/ます\s+ます/g, 'ます')
    .replace(/という\s+という/g, 'という')
    .replace(/について\s+について/g, 'について')
    .replace(/\s+/g, ' ')
    .trim();

  const originalLength = text.length;
  const resultLength = result.length;
  const reductionRatio = 1 - (resultLength / originalLength);
  
  console.log('📊 音声ファイル重複除去統計:', {
    元の長さ: originalLength,
    処理後: resultLength,
    削減率: `${(reductionRatio * 100).toFixed(1)}%`
  });
  
  // 過度な削除の検出
  if (resultLength < originalLength * 0.15 && originalLength > 50) {
    console.warn('⚠️ 過度な削除を検出、元テキストを保持');
    return text;
  }
  
  if (result.trim().length < 10 && originalLength > 30) {
    console.warn('⚠️ 結果が極端に短い、安全版を返却');
    return text.slice(0, Math.min(200, text.length)).trim() + '...';
  }

  console.log('✅ 音声ファイル重複除去完了');
  return result;
}

// 文字起こし設定のインターフェース
interface TranscriptionOptions {
  speakerDiarization?: boolean
  generateSummary?: boolean
  extractKeywords?: boolean
  includeTimestamps?: boolean
  sentimentAnalysis?: boolean
  language?: string
  model?: string
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== TRANSCRIBE API START ===")
    console.log("Request headers:", Object.fromEntries(request.headers.entries()))

    // リクエストサイズの事前チェック
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength)
      const MAX_REQUEST_SIZE = 50 * 1024 * 1024 // 50MBに拡張（FormData overhead を考慮）
      console.log(`Request size: ${(size / 1024 / 1024).toFixed(2)}MB, Max: ${MAX_REQUEST_SIZE / 1024 / 1024}MB`)
      if (size > MAX_REQUEST_SIZE) {
        console.error("Request size too large:", size)
        return NextResponse.json(
          { error: "リクエストサイズが大きすぎます。50MB以下のファイルを使用してください。" },
          { status: 413 }
        )
      }
    }

    // OpenAI API keyのチェック
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY environment variable is not set")
      return NextResponse.json(
        { error: "OpenAI API keyが設定されていません" }, 
        { status: 500 }
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 120000, // 2分のタイムアウト
    })

    let formData;
    try {
      formData = await request.formData()
    } catch (error) {
      console.error("FormData parsing error:", error)
      return NextResponse.json(
        { error: "リクエストの解析に失敗しました。ファイルサイズを確認してください。" },
        { status: 400 }
      )
    }

    const file = formData.get("file") as File
    
    // オプションの取得
    const options: TranscriptionOptions = {
      speakerDiarization: formData.get("speakerDiarization") === "true",
      generateSummary: formData.get("generateSummary") === "true",
      extractKeywords: formData.get("extractKeywords") === "true",
      includeTimestamps: formData.get("includeTimestamps") === "true",
      sentimentAnalysis: formData.get("sentimentAnalysis") === "true",
      language: (formData.get("language") as string) || "ja",
      model: (formData.get("model") as string) || "whisper-1"
    }

    console.log("Transcription options:", options)

    if (!file) {
      console.error("No file provided")
      return NextResponse.json({ error: "ファイルが提供されていません" }, { status: 400 })
    }

    console.log("File details:", {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2),
    })

    // ファイルサイズチェック（25MB制限を少し緩和）
    const MAX_SIZE = 26 * 1024 * 1024 // 26MBに拡張
    if (file.size > MAX_SIZE) {
      console.error("=== FILE SIZE EXCEEDED ===", {
        fileSize: file.size,
        maxSize: MAX_SIZE,
        sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      })
      return NextResponse.json(
        {
          error: "ファイルサイズが大きすぎます",
          details: `ファイルサイズ: ${(file.size / (1024 * 1024)).toFixed(1)}MB, 制限: ${MAX_SIZE / (1024 * 1024)}MB`,
          debug: {
            fileSize: file.size,
            maxSize: MAX_SIZE,
            exceeded: true,
          },
        },
        { status: 413 },
      )
    }

    // ファイル形式のチェック
    const supportedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 
      'audio/flac', 'audio/ogg', 'audio/webm', 'video/webm'
    ]
    
    if (!supportedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|flac|ogg|webm)$/i)) {
      console.error("Unsupported file type:", file.type, file.name)
      return NextResponse.json(
        { error: "サポートされていないファイル形式です。mp3, wav, m4a, flac, ogg, webm形式を使用してください。" },
        { status: 400 }
      )
    }

    console.log("Calling OpenAI Whisper API...")
    console.log("File size check passed:", (file.size / (1024 * 1024)).toFixed(2) + "MB")

    // 高精度文字起こし用のプロンプト
    const transcriptionPrompt = `
    これは日本語の音声ファイルの文字起こしです。以下の点に注意して、正確で自然な文字起こしを行ってください：

    1. 話し言葉の自然な流れを保ちつつ、読みやすさを重視
    2. 「えー」「あのー」などの言いよどみは適度に整理
    3. 専門用語や固有名詞は正確に表記
    4. 会話の場合は話者の切り替わりを明確に
    5. 重要な情報は見落とさないよう注意
    6. 文章の区切りと段落を適切に
    `

    // OpenAI Whisper APIを呼び出し（タイムスタンプ付き）
    let transcription;
    try {
      transcription = await openai.audio.transcriptions.create({
        file: file,
        model: options.model as "whisper-1",
        language: options.language,
        response_format: options.includeTimestamps ? "verbose_json" : "json",
        prompt: transcriptionPrompt,
        temperature: 0.2, // 一貫性を重視
      })
    } catch (apiError: any) {
      console.error("OpenAI API Error:", apiError)
      
      // より詳細なエラーハンドリング
      if (apiError.status === 413) {
        return NextResponse.json(
          { error: "ファイルサイズが大きすぎます。OpenAI APIの制限（25MB）を超えています。" },
          { status: 413 }
        )
      }
      
      if (apiError.status === 400) {
        return NextResponse.json(
          { error: "ファイル形式が無効です。対応している音声ファイル形式を使用してください。" },
          { status: 400 }
        )
      }
      
      if (apiError.status === 401) {
        return NextResponse.json(
          { error: "OpenAI API認証エラー。APIキーを確認してください。" },
          { status: 401 }
        )
      }
      
      if (apiError.status === 429) {
        return NextResponse.json(
          { error: "OpenAI APIレート制限に達しました。しばらく待ってから再試行してください。" },
          { status: 429 }
        )
      }
      
      // 一般的なAPIエラー
      throw apiError
    }

    console.log("Transcription completed:", {
      textLength: transcription.text?.length || 0,
      hasText: !!transcription.text,
    })

    if (!transcription.text) {
      return NextResponse.json({ error: "文字起こし結果が空です" }, { status: 400 })
    }

    // 重複除去処理を適用
    const cleanedTranscript = removeDuplicatesUltraEnhanced(transcription.text)
    console.log("重複除去完了:", {
      originalLength: transcription.text.length,
      cleanedLength: cleanedTranscript.length,
      reductionRatio: `${((1 - cleanedTranscript.length / transcription.text.length) * 100).toFixed(1)}%`
    })

    let result: any = {
      transcript: cleanedTranscript,
      originalTranscript: transcription.text, // デバッグ用に元のテキストも保存
      success: true,
    }

    // タイムスタンプ情報の追加
    if (options.includeTimestamps && 'segments' in transcription) {
      result.segments = transcription.segments
      if ('duration' in transcription) {
        result.duration = transcription.duration
      }
    }

    // 追加処理の実行
    if (options.speakerDiarization || options.generateSummary || options.extractKeywords || options.sentimentAnalysis) {
      try {
        console.log("Starting enhancement processing...")
        const enhancedResult = await enhanceTranscription(transcription.text, options, openai)
        result = { ...result, ...enhancedResult }
        console.log("Enhancement completed successfully")
      } catch (enhanceError) {
        console.error("Enhancement error:", enhanceError)
        result.enhancementError = "追加機能の処理中にエラーが発生しました"
      }
    }

    console.log("=== TRANSCRIBE API SUCCESS ===")
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("=== TRANSCRIBE API ERROR ===")
    console.error("Error details:", {
      message: error.message,
      status: error.status,
      code: error.code,
      stack: error.stack
    })

    // OpenAI APIエラーの詳細処理
    if (error?.status === 413 || error?.response?.status === 413) {
      return NextResponse.json(
        {
          error: "ファイルサイズが大きすぎます",
          details: "OpenAI APIの制限（25MB）を超えています。ファイルを圧縮してください。",
          debug: { errorType: "size_limit", status: 413 }
        },
        { status: 413 },
      )
    }

    if (error?.status === 400 || error?.response?.status === 400) {
      return NextResponse.json(
        {
          error: "ファイル形式が無効です",
          details: "対応している音声ファイル形式を使用してください。",
          debug: { errorType: "invalid_format", status: 400 }
        },
        { status: 400 },
      )
    }

    if (error?.status === 401 || error?.response?.status === 401) {
      return NextResponse.json(
        {
          error: "認証エラー",
          details: "OpenAI APIキーが無効です。",
          debug: { errorType: "auth_error", status: 401 }
        },
        { status: 401 },
      )
    }

    if (error?.status === 429 || error?.response?.status === 429) {
      return NextResponse.json(
        {
          error: "レート制限",
          details: "API利用制限に達しました。しばらく待ってから再試行してください。",
          debug: { errorType: "rate_limit", status: 429 }
        },
        { status: 429 },
      )
    }

    // ネットワークエラー
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return NextResponse.json(
        {
          error: "ネットワークエラー",
          details: "接続がタイムアウトしました。ファイルサイズを小さくして再試行してください。",
          debug: { errorType: "network_error", code: error.code }
        },
        { status: 408 },
      )
    }

    // その他のエラー
    return NextResponse.json(
      {
        error: "文字起こし処理中にエラーが発生しました",
        details: error.message || "不明なエラー",
        debug: { 
          errorType: "general_error",
          message: error.message,
          status: error.status || 500
        }
      },
      { status: 500 },
    )
  }
}

// 文字起こし結果の拡張処理
async function enhanceTranscription(transcript: string, options: TranscriptionOptions, openai: OpenAI) {
  const enhancements: any = {}

  try {
    // 話者識別の実行
    if (options.speakerDiarization) {
      enhancements.speakers = await identifySpeakers(transcript, openai)
    }

    // 要約の生成
    if (options.generateSummary) {
      enhancements.summary = await generateSummary(transcript, openai)
    }

    // キーワード抽出
    if (options.extractKeywords) {
      enhancements.keywords = await extractKeywords(transcript, openai)
    }

    // 感情分析
    if (options.sentimentAnalysis) {
      enhancements.sentiment = await analyzeSentiment(transcript, openai)
    }

    // 段落分割と構造化
    enhancements.structured = await structureTranscript(transcript, openai)

  } catch (error) {
    console.error("Enhancement error:", error)
    enhancements.enhancementError = "追加機能の処理中にエラーが発生しました"
  }

  return enhancements
}

// 話者識別
async function identifySpeakers(transcript: string, openai: OpenAI) {
  const prompt = `
  以下の文字起こしテキストを分析し、話者を識別してください。
  各話者を「話者A」「話者B」のように区別し、発言内容を整理してください。

  テキスト：
  ${transcript}

  出力形式：
  - 話者の数
  - 各話者の発言内容（時系列順）
  - 話者の特徴（可能であれば）
  `

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  })

  return response.choices[0].message.content
}

// 要約の生成
async function generateSummary(transcript: string, openai: OpenAI) {
  const prompt = `
  以下の文字起こしテキストの要約を作成してください。
  
  要約には以下を含めてください：
  1. 全体の概要（2-3文）
  2. 主要なポイント（3-5つ）
  3. 重要な決定事項や結論
  4. 今後のアクションアイテム（あれば）

  テキスト：
  ${transcript}
  `

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  })

  return response.choices[0].message.content
}

// キーワード抽出
async function extractKeywords(transcript: string, openai: OpenAI) {
  const prompt = `
  以下の文字起こしテキストから重要なキーワードを抽出してください。
  
  以下のカテゴリに分けて抽出してください：
  1. 人名・組織名
  2. 専門用語・技術用語
  3. 重要な概念・トピック
  4. 数値・データ
  5. 日付・時間

  テキスト：
  ${transcript}
  `

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  })

  return response.choices[0].message.content
}

// 感情分析
async function analyzeSentiment(transcript: string, openai: OpenAI) {
  const prompt = `
  以下の文字起こしテキストの感情分析を行ってください。
  
  分析項目：
  1. 全体的な感情的トーン（ポジティブ/ネガティブ/中立）
  2. 話者の感情変化（あれば）
  3. 重要な感情表現
  4. 議論の雰囲気（建設的/対立的/協調的など）

  テキスト：
  ${transcript}
  `

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  })

  return response.choices[0].message.content
}

// 文章構造化
async function structureTranscript(transcript: string, openai: OpenAI) {
  const prompt = `
  以下の文字起こしテキストを読みやすく構造化してください。
  
  構造化の方針：
  1. 適切な段落分割
  2. 文章の整理（冗長な部分の削除）
  3. 話題の区切りを明確に
  4. 見出しの追加（必要に応じて）
  5. 読みやすい文体に調整

  テキスト：
  ${transcript}
  `

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  })

  return response.choices[0].message.content
}
