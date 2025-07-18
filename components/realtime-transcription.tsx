"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, AlertTriangle, Wifi, WifiOff, FileText, Brain, Loader2 } from "lucide-react"
import { TranscriptEditor } from "./editable-transcript"
import { AIModelSelector } from "./ai-model-selector"

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message?: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
    webkitSpeechGrammarList: any
    webkitSpeechRecognitionEvent: any
  }
}

const RealtimeTranscription = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  const [autoRestart, setAutoRestart] = useState(true) // デフォルトでON
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "error">("disconnected")
  const [errorCount, setErrorCount] = useState(0)
  const [networkError, setNetworkError] = useState(false)
  const [lastActivityTime, setLastActivityTime] = useState(Date.now())
  const [isIntentionallyRunning, setIsIntentionallyRunning] = useState(false)
  const [consecutiveErrors, setConsecutiveErrors] = useState(0)
  
  // 議事録生成関連の状態
  const [minutes, setMinutes] = useState("")
  const [isGeneratingMinutes, setIsGeneratingMinutes] = useState(false)
  const [minutesError, setMinutesError] = useState<string | null>(null)
  const [selectedAiModel, setSelectedAiModel] = useState<"gemini" | "deepseek">("gemini")

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isUserStoppedRef = useRef(false)
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const maxRetries = 10 // 再試行回数を増加
  const activityTimeoutDuration = 10000 // 10秒に短縮
  const healthCheckInterval = 5000 // 5秒ごとにヘルスチェック

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSupported(false)
      setError("このブラウザは音声認識をサポートしていません。Chrome、Edge、Safariをお試しください。")
    }

    // ネットワーク状態の監視
    const handleOnline = () => {
      console.log("ネットワーク接続が復旧しました")
      setNetworkError(false)
      setConsecutiveErrors(0)
      if (autoRestart && !isUserStoppedRef.current && isIntentionallyRunning && !isRecording) {
        setTimeout(() => startRecognition(), 1000)
      }
    }

    const handleOffline = () => {
      console.log("ネットワーク接続が切断されました")
      setNetworkError(true)
      setConnectionStatus("error")
    }

    // ヘルスチェック機能
    const startHealthCheck = () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
      
      healthCheckIntervalRef.current = setInterval(() => {
        // 意図的に実行中で、自動再開が有効で、ユーザーが停止していない場合
        if (isIntentionallyRunning && autoRestart && !isUserStoppedRef.current) {
          // 録音中でない場合は再開を試行
          if (!isRecording) {
            console.log("ヘルスチェック: 録音が停止しているため再開を試行します")
            startRecognition()
          }
          // 最後のアクティビティから長時間経過している場合
          else if (Date.now() - lastActivityTime > activityTimeoutDuration * 2) {
            console.log("ヘルスチェック: 長時間無活動のため再開を試行します")
            if (recognitionRef.current) {
              recognitionRef.current.stop()
            }
          }
        }
      }, healthCheckInterval)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current)
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [autoRestart, isRecording, isIntentionallyRunning, lastActivityTime, activityTimeoutDuration, healthCheckInterval])

  // ヘルスチェックの開始/停止
  useEffect(() => {
    if (isIntentionallyRunning && autoRestart) {
      const startHealthCheck = () => {
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current)
        }
        
        healthCheckIntervalRef.current = setInterval(() => {
          if (isIntentionallyRunning && autoRestart && !isUserStoppedRef.current) {
            if (!isRecording) {
              console.log("ヘルスチェック: 録音が停止しているため再開を試行します")
              startRecognition()
            } else if (Date.now() - lastActivityTime > activityTimeoutDuration * 2) {
              console.log("ヘルスチェック: 長時間無活動のため再開を試行します")
              if (recognitionRef.current) {
                recognitionRef.current.stop()
              }
            }
          }
        }, healthCheckInterval)
      }
      startHealthCheck()
    } else {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
    }
  }, [isIntentionallyRunning, autoRestart, isRecording, lastActivityTime, activityTimeoutDuration, healthCheckInterval])

  const startRecognition = useCallback(() => {
    if (!isSupported) return

    console.log("音声認識開始を試行します:", new Date().toISOString())

    try {
      // 既存の認識を安全に停止
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
          recognitionRef.current.abort()
        } catch (err) {
          console.warn("既存の認識停止時にエラー:", err)
        }
        recognitionRef.current = null
      }

      // タイムアウトをクリア
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current)
        restartTimeoutRef.current = null
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()

      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "ja-JP"
      
      // 音声認識の品質向上設定
      if ('grammars' in recognition) {
        // 文法設定があれば日本語に最適化
        recognition.grammars = null
      }

      recognition.onstart = () => {
        console.log("音声認識開始:", new Date().toISOString())
        setIsRecording(true)
        setError(null)
        setConnectionStatus("connected")
        setNetworkError(false)
        setLastActivityTime(Date.now())
        setConsecutiveErrors(0)

        // アクティビティタイムアウトの設定
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current)
        }
        activityTimeoutRef.current = setTimeout(() => {
          console.log("アクティビティタイムアウト - 音声認識を再開します")
          if (!isUserStoppedRef.current && autoRestart && isIntentionallyRunning) {
            try {
              recognition.stop()
            } catch (err) {
              console.warn("タイムアウト時の停止エラー:", err)
              // 強制的に再開
              setTimeout(() => startRecognition(), 1000)
            }
          }
        }, activityTimeoutDuration)
      }

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        setLastActivityTime(Date.now())
        
        // アクティビティタイムアウトをリセット
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current)
        }
        activityTimeoutRef.current = setTimeout(() => {
          console.log("アクティビティタイムアウト - 音声認識を再開します")
          if (!isUserStoppedRef.current && autoRestart && isIntentionallyRunning) {
            try {
              recognition.stop()
            } catch (err) {
              console.warn("タイムアウト時の停止エラー:", err)
              setTimeout(() => startRecognition(), 1000)
            }
          }
        }, activityTimeoutDuration)

        let finalTranscript = ""
        let interimText = ""

        // 結果の品質チェックを強化
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0].transcript
          const confidence = result[0].confidence || 1
          
          // 信頼度が低い結果や異常に短い/長い結果を除外
          if (confidence < 0.3) {
            console.log("低信頼度結果をスキップ:", transcript, "信頼度:", confidence)
            continue
          }
          
          if (transcript.trim().length < 1 || transcript.trim().length > 200) {
            console.log("異常な長さの結果をスキップ:", transcript.length, "文字")
            continue
          }
          
          if (result.isFinal) {
            finalTranscript += transcript
          } else {
            interimText += transcript
          }
        }

        if (finalTranscript) {
          // 超強化された重複チェック: 同じ内容が連続していないか確認
          setTranscript((prev) => {
            const trimmedNew = finalTranscript.trim()
            const trimmedPrev = prev.trim()
            
            // 空の入力は無視
            if (!trimmedNew) {
              console.log("空のテキスト: スキップします")
              return prev
            }
            
            // 1. 完全一致チェック: 既に同じ内容が末尾にある場合は追加しない
            if (trimmedPrev.endsWith(trimmedNew)) {
              console.log("完全一致重複検出: スキップします", trimmedNew)
              return prev
            }
            
            // 2. 部分一致チェック: 新しいテキストが既存の末尾部分と重複している場合
            const lastPart = trimmedPrev.slice(-trimmedNew.length * 2)
            if (lastPart.includes(trimmedNew) && trimmedNew.length > 5) {
              console.log("部分一致重複検出: スキップします", trimmedNew)
              return prev
            }
            
            // 3. 短いフレーズの超厳密チェック
            if (trimmedNew.length < 15) {
              const lastWords = trimmedPrev.split(/\s+/).slice(-10).join(' ')
              if (lastWords.includes(trimmedNew)) {
                console.log("短いフレーズ重複検出: スキップします", trimmedNew)
                return prev
              }
            }
            
            // 4. 単語レベルでの反復検出（強化版）
            const newWords = trimmedNew.split(/\s+/)
            const prevWords = trimmedPrev.split(/\s+/)
            
            // 同じ単語が連続で出現する回数をチェック
            for (let i = 0; i < newWords.length; i++) {
              const word = newWords[i]
              if (word.length > 1) { // 1文字の単語も除外
                let count = 0
                
                // 新しいテキスト内での出現回数
                for (let j = 0; j < newWords.length; j++) {
                  if (newWords[j] === word) count++
                }
                
                // 既存テキストの末尾20単語での出現回数
                const recentWords = prevWords.slice(-20)
                for (let k = 0; k < recentWords.length; k++) {
                  if (recentWords[k] === word) count++
                }
                
                if (count >= 3) {
                  console.log("単語反復検出: スキップします", trimmedNew, "単語:", word, "出現回数:", count)
                  return prev
                }
              }
            }
            
            // 5. フレーズレベルでの反復検出
            if (newWords.length >= 2) {
              for (let i = 0; i < newWords.length - 1; i++) {
                const phrase = newWords.slice(i, i + 2).join(' ')
                const phraseCount = (trimmedPrev + ' ' + trimmedNew).split(phrase).length - 1
                
                if (phraseCount >= 3 && phrase.length > 4) {
                  console.log("フレーズ反復検出: スキップします", trimmedNew, "フレーズ:", phrase, "出現回数:", phraseCount)
                  return prev
                }
              }
            }
            
            // 6. 文字レベルでの類似度チェック（閾値を下げて厳格化）
            if (trimmedNew.length > 3) {
              const recent = trimmedPrev.slice(-Math.max(100, trimmedNew.length * 2))
              
              // より厳格な重複チェック：単純な文字列包含
              if (recent.includes(trimmedNew) && trimmedNew.length > 5) {
                console.log("高類似度重複検出: スキップします", trimmedNew)
                return prev
              }
            }
            
            // 7. 正規表現による反復パターン検出（強化版）
            const patterns = [
              /(.{3,}?)\1{2,}/g,  // 3文字以上の反復
              /(\w+\s+){3,}\1/g,  // 単語の反復
              /([あ-ん]{2,})\1{2,}/g,  // ひらがなの反復
              /([ア-ン]{2,})\1{2,}/g,  // カタカナの反復
            ]
            
            for (const pattern of patterns) {
              if (pattern.test(trimmedNew)) {
                console.log("正規表現パターン検出: スキップします", trimmedNew)
                return prev
              }
            }
            
            // 8. 文脈チェック: 直前の文との論理的な繋がりをチェック
            const lastSentence = trimmedPrev.split(/[。．！？\n]/).pop()?.trim()
            if (lastSentence && lastSentence.length > 0) {
              // 同じ文の開始部分が繰り返されている場合
              const commonStart = getCommonPrefix(lastSentence, trimmedNew)
              if (commonStart.length > Math.min(lastSentence.length, trimmedNew.length) * 0.5) {
                console.log("文脈重複検出: スキップします", trimmedNew, "共通部分:", commonStart)
                return prev
              }
            }
            
            return prev + removeDuplicatesUltraEnhanced(finalTranscript)
          })
          
          // 10段階の超々強化重複除去システム（最終版）
          const removeDuplicatesUltraEnhanced = (text: string): string => {
            if (!text || text.trim().length === 0) return text;

            console.log('🔧 重複除去開始:', text.slice(0, 100) + '...');

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
            const calculateSimilarityAdvanced = (str1: string, str2: string): number => {
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
              .replace(/(.{1,15})\1{1,}/g, (match, p1) => {
                // 15文字以下の2回反復は、意味のある反復でない限り除去
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
                // 「すごく」「とても」「だんだん」「どんどん」「もっと」「ずっと」などは2回まで許可
                const allowedDouble = ['すごく', 'とても', 'だんだん', 'どんどん', 'もっと', 'ずっと', 'どんなに', 'なかなか'];
                if (allowedDouble.includes(w) && count <= 2) return true;
                
                // 「はい」「ええ」「そう」「うん」などの相槌は3回まで許可
                const responseWords = ['はい', 'ええ', 'そう', 'うん', 'あー', 'うーん'];
                if (responseWords.includes(w) && count <= 3) return true;
                
                return false;
              };
              
              if (consecutiveCount >= 3 && !isMeaningfulRepetition(word, consecutiveCount)) {
                // 3回以上の反復は1回に削減（意味のある反復以外）
                deduplicatedWords.push(word);
              } else if (consecutiveCount === 2 && word.length <= 3 && !isMeaningfulRepetition(word, 2)) {
                // 短い単語の2回反復も1回に削減
                deduplicatedWords.push(word);
              } else {
                // 通常の反復は許可
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
              
              // 完全一致の除去
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
                const similarity = calculateSimilarityAdvanced(current, existing);
                
                if (similarity > bestSimilarity) {
                  bestSimilarity = similarity;
                  bestMatchIndex = j;
                }
                
                // 80%以上の類似度なら重複とみなす（閾値を下げて厳格化）
                if (similarity >= 0.80) {
                  isDuplicate = true;
                  break;
                }
              }
              
              if (isDuplicate && bestMatchIndex >= 0) {
                // より長く、より完全な文を保持
                if (current.length > filteredSentences[bestMatchIndex].length) {
                  filteredSentences[bestMatchIndex] = current;
                }
              } else if (!isDuplicate) {
                filteredSentences.push(current);
              }
            }

            // 段階6: 連続文の類似度チェック（文脈考慮）
            const contextFiltered: string[] = [];
            for (let i = 0; i < filteredSentences.length; i++) {
              const current = filteredSentences[i];
              
              if (contextFiltered.length === 0) {
                contextFiltered.push(current);
                continue;
              }

              const previous = contextFiltered[contextFiltered.length - 1];
              const similarity = calculateSimilarityAdvanced(current, previous);
              
              // 連続する文の類似度が85%以上なら重複とみなす（厳格化）
              if (similarity < 0.85) {
                contextFiltered.push(current);
              } else {
                console.log('🔍 連続文重複除去:', previous.slice(0, 30), '→', current.slice(0, 30));
              }
            }

            // 段階7: 高度なフレーズパターン検出
            let result = contextFiltered.join(' ');
            
            // 2-8語のフレーズの反復を検出・除去
            const resultWords = result.split(/\s+/);
            const removeIndices = new Set<number>();
            
            for (let phraseLen = 2; phraseLen <= 8; phraseLen++) {
              const phraseMap = new Map<string, number[]>();
              
              for (let i = 0; i <= resultWords.length - phraseLen; i++) {
                if (removeIndices.has(i)) continue;
                
                const phrase = resultWords.slice(i, i + phraseLen).join(' ').toLowerCase();
                if (!phraseMap.has(phrase)) {
                  phraseMap.set(phrase, []);
                }
                phraseMap.get(phrase)!.push(i);
              }
              
              // 重複フレーズの除去
              phraseMap.forEach((indices, phrase) => {
                if (indices.length >= 2 && phrase.trim().length > 0) {
                  // 最初の出現以外を除去対象に
                  for (let i = 1; i < indices.length; i++) {
                    for (let j = 0; j < phraseLen; j++) {
                      removeIndices.add(indices[i] + j);
                    }
                  }
                  console.log('🔍 フレーズ重複除去:', phrase);
                }
              });
            }
            
            // 除去対象のワードを削除
            const finalWords = resultWords.filter((_, index) => !removeIndices.has(index));

            // 段階8: 特殊な日本語パターンの処理
            result = finalWords.join(' ')
              .replace(/です\s+です/g, 'です')
              .replace(/ます\s+ます/g, 'ます')
              .replace(/でし\s+でし/g, 'でし')
              .replace(/として\s+として/g, 'として')
              .replace(/という\s+という/g, 'という')
              .replace(/について\s+について/g, 'について')
              .replace(/に関して\s+に関して/g, 'に関して')
              .replace(/けれども\s+けれども/g, 'けれども');

            // 段階9: 最終的なクリーンアップ
            result = result
              .replace(/\s+/g, ' ')  // 複数スペースを単一に
              .replace(/^\s+|\s+$/g, '')  // 前後の空白除去
              .replace(/([。．!！?？])\s*\1+/g, '$1')  // 句読点の重複
              .replace(/(.)\1{5,}/g, '$1$1')  // 6回以上の文字反復を2回に
              .trim();

            // 段階10: 品質保証チェック
            const originalLength = text.length;
            const resultLength = result.length;
            const reductionRatio = 1 - (resultLength / originalLength);
            
            console.log('📊 重複除去統計:', {
              元の長さ: originalLength,
              処理後: resultLength,
              削減率: `${(reductionRatio * 100).toFixed(1)}%`
            });
            
            // 過度な削除の検出（元テキストの15%未満は危険）
            if (resultLength < originalLength * 0.15 && originalLength > 50) {
              console.warn('⚠️ 過度な削除を検出、安全版にフォールバック');
              return text; // 元のテキストを保持
            }
            
            // 空文字や極端に短い結果の検出
            if (result.trim().length < 10 && originalLength > 30) {
              console.warn('⚠️ 結果が極端に短い、元テキストの一部を保持');
              return text.slice(0, Math.min(100, text.length)).trim() + '...';
            }

            console.log('✅ 重複除去完了:', result.slice(0, 100) + '...');
            return result;
          };

          // 共通プレフィックスの長さを取得する関数
          function getCommonPrefix(str1: string, str2: string): string {
            let i = 0;
            while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
              i++;
            }
            return str1.slice(0, i);
          }
          setErrorCount(0) // 成功時にエラーカウントをリセット
          setConsecutiveErrors(0)
        }
        setInterimTranscript(interimText)
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("音声認識エラー:", event.error, event.message, new Date().toISOString())
        setConnectionStatus("error")
        setConsecutiveErrors(prev => prev + 1)

        // 致命的でないエラーの場合は積極的に再開
        if (event.error === "no-speech" || event.error === "audio-capture") {
          console.log("非致命的エラー - 即座に再開します:", event.error)
          // エラーカウントを増加させない
          return
        }

        // エラーカウントを増加
        setErrorCount((prev) => prev + 1)

        if (event.error === "network") {
          setNetworkError(true)
          setError("ネットワークエラーが発生しました。自動的に再試行します。")
        } else if (event.error === "not-allowed") {
          setError("マイクへのアクセスが拒否されました。ブラウザの設定でマイクの使用を許可してください。")
          setIsRecording(false)
          setIsIntentionallyRunning(false)
          isUserStoppedRef.current = true
          return
        } else if (event.error === "aborted") {
          console.log("音声認識が中止されました - 正常な動作として処理")
          return
        } else {
          setError(`音声認識エラー: ${event.error}`)
        }
      }

      recognition.onend = () => {
        console.log("音声認識終了:", new Date().toISOString())
        setIsRecording(false)
        setConnectionStatus("disconnected")

        // アクティビティタイムアウトをクリア
        if (activityTimeoutRef.current) {
          clearTimeout(activityTimeoutRef.current)
        }

        console.log("ユーザーによる停止フラグ:", isUserStoppedRef.current)
        console.log("自動再開フラグ:", autoRestart)
        console.log("意図的実行フラグ:", isIntentionallyRunning)
        console.log("エラーカウント:", errorCount)
        console.log("連続エラー:", consecutiveErrors)

        // 意図的に実行中で、ユーザーが停止していない場合は常に再開を試行
        if (isIntentionallyRunning && !isUserStoppedRef.current && autoRestart) {
          console.log("音声認識を自動的に再開します...")
          
          // 連続エラーが多い場合は少し長めに待機
          let delay = 500 // デフォルト0.5秒
          if (consecutiveErrors > 5) {
            delay = 2000 // 2秒
          } else if (consecutiveErrors > 3) {
            delay = 1000 // 1秒
          } else if (networkError) {
            delay = 1500 // ネットワークエラーの場合は1.5秒
          }

          // 最大再試行回数に達していても、連続エラーをリセットして再試行
          if (errorCount >= maxRetries) {
            console.log("最大再試行回数に達しましたが、連続エラーをリセットして再試行します")
            setErrorCount(0)
            delay = 3000 // 3秒待機
          }

          restartTimeoutRef.current = setTimeout(() => {
            if (isIntentionallyRunning && !isUserStoppedRef.current) {
              console.log("音声認識を再開します...", new Date().toISOString())
              startRecognition()
            } else {
              console.log("停止条件のため、再開しません")
            }
          }, delay)
        }
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error("音声認識の開始に失敗:", err)
      setError("音声認識の開始に失敗しました。")
      setIsRecording(false)
      setErrorCount((prev) => prev + 1)
      setConsecutiveErrors(prev => prev + 1)
      
      // 失敗してもしつこく再試行
      if (isIntentionallyRunning && !isUserStoppedRef.current && autoRestart) {
        setTimeout(() => startRecognition(), 2000)
      }
    }
  }, [isSupported, autoRestart, errorCount, maxRetries, networkError, activityTimeoutDuration, isIntentionallyRunning, consecutiveErrors])

  const stopRecognition = useCallback(() => {
    console.log("ユーザーによる録音停止", new Date().toISOString())
    isUserStoppedRef.current = true
    setIsIntentionallyRunning(false)
    setIsRecording(false)
    setConnectionStatus("disconnected")
    setErrorCount(0)
    setConsecutiveErrors(0)
    setNetworkError(false)

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }

    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current)
      activityTimeoutRef.current = null
    }

    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current)
      healthCheckIntervalRef.current = null
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        recognitionRef.current.abort()
      } catch (err) {
        console.error("音声認識の停止に失敗:", err)
      }
      recognitionRef.current = null
    }
  }, [])

  const handleToggleRecording = () => {
    if (isRecording || isIntentionallyRunning) {
      stopRecognition()
    } else {
      isUserStoppedRef.current = false
      setIsIntentionallyRunning(true)
      setErrorCount(0)
      setConsecutiveErrors(0)
      setError(null)
      startRecognition()
    }
  }

  const clearTranscript = () => {
    setTranscript("")
    setInterimTranscript("")
    setError(null)
    setErrorCount(0)
    setConsecutiveErrors(0)
    setNetworkError(false)
    setLastActivityTime(Date.now())
    setMinutes("")
    setMinutesError(null)
  }

  // 議事録生成関数
  const generateMinutes = async () => {
    if (!transcript.trim()) {
      setMinutesError("文字起こしテキストがありません")
      return
    }

    setIsGeneratingMinutes(true)
    setMinutesError(null)

    try {
      const response = await fetch("/api/generate-minutes-with-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: transcript,
          model: selectedAiModel,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setMinutes(data.minutes)
    } catch (error) {
      console.error("議事録生成エラー:", error)
      setMinutesError(error instanceof Error ? error.message : "議事録の生成に失敗しました")
    } finally {
      setIsGeneratingMinutes(false)
    }
  }

  // 強制的に再開する関数
  const forceRestart = () => {
    console.log("強制的に音声認識を再開します")
    setErrorCount(0)
    setConsecutiveErrors(0)
    setError(null)
    setNetworkError(false)
    isUserStoppedRef.current = false
    setIsIntentionallyRunning(true)
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        recognitionRef.current.abort()
      } catch (err) {
        console.warn("強制再開時の停止エラー:", err)
      }
    }
    
    setTimeout(() => {
      startRecognition()
    }, 500)
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            リアルタイム音声認識
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              このブラウザは音声認識をサポートしていません。Chrome、Edge、Safariをお試しください。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          リアルタイム音声認識
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 接続状態表示 */}
        <div className="flex items-center gap-2 text-sm">
          <span>接続状態:</span>
          {connectionStatus === "connected" && (
            <div className="flex items-center gap-1 text-green-600">
              <Wifi className="h-4 w-4" />
              <span>接続中</span>
            </div>
          )}
          {connectionStatus === "disconnected" && (
            <div className="flex items-center gap-1 text-gray-500">
              <WifiOff className="h-4 w-4" />
              <span>切断</span>
            </div>
          )}
          {connectionStatus === "error" && (
            <div className="flex items-center gap-1 text-red-600">
              <WifiOff className="h-4 w-4" />
              <span>
                エラー ({errorCount}/{maxRetries})
              </span>
            </div>
          )}
        </div>

        {/* 自動再開設定 */}
        <div className="flex items-center space-x-2">
          <Switch id="auto-restart" checked={autoRestart} onCheckedChange={setAutoRestart} />
          <Label htmlFor="auto-restart">自動再開を有効にする (推奨)</Label>
        </div>

        {/* 接続状態の詳細情報 */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>実行状態: {isIntentionallyRunning ? "実行中" : "停止中"}</div>
          <div>最後のアクティビティ: {new Date(lastActivityTime).toLocaleTimeString()}</div>
          {errorCount > 0 && (
            <div className="text-orange-600">
              エラー回数: {errorCount}/{maxRetries}
            </div>
          )}
          {consecutiveErrors > 0 && (
            <div className="text-red-600">
              連続エラー: {consecutiveErrors}
            </div>
          )}
        </div>

        {/* エラー表示 */}
        {error && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* ネットワークエラー警告 */}
        {networkError && (
          <Alert>
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              ネットワーク接続に問題があります。Wi-Fiまたはモバイルデータの接続を確認してください。
            </AlertDescription>
          </Alert>
        )}

        {/* 使用上の注意 */}
        <Alert>
          <AlertDescription className="text-sm">
            <strong>使用上の注意:</strong>
            <ul className="mt-1 ml-4 list-disc text-xs space-y-1">
              <li>マイクへのアクセス許可が必要です</li>
              <li>安定したインターネット接続が必要です</li>
              <li>強力な自動再開機能により、途切れても確実に再開します</li>
              <li>10秒間無音が続くと自動的に再開されます</li>
              <li>5秒ごとのヘルスチェックで状態を監視します</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* 録音ボタン */}
        <div className="flex gap-2">
          <Button
            onClick={handleToggleRecording}
            className={`flex items-center gap-2 ${
              isRecording || isIntentionallyRunning ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {isRecording || isIntentionallyRunning ? (
              <>
                <MicOff className="h-4 w-4" />
                録音停止
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                録音開始
              </>
            )}
          </Button>

          <Button onClick={clearTranscript} variant="outline" disabled={!transcript && !interimTranscript}>
            クリア
          </Button>

          {/* 強制再開ボタン */}
          {(errorCount > 0 || consecutiveErrors > 0 || (!isRecording && isIntentionallyRunning)) && (
            <Button onClick={forceRestart} variant="outline" className="text-orange-600">
              強制再開
            </Button>
          )}
        </div>

        {/* 文字起こし結果と議事録 */}
        <Tabs defaultValue="transcript" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transcript" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              文字起こし
            </TabsTrigger>
            <TabsTrigger value="minutes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              議事録
              {minutes && <Badge variant="secondary" className="ml-1">生成済み</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transcript" className="space-y-4">
            <div className="min-h-[200px] p-3 border rounded-md bg-gray-50">
              <div className="whitespace-pre-wrap">
                {transcript}
                {interimTranscript && <span className="text-gray-500 italic">{interimTranscript}</span>}
              </div>
              {!transcript && !interimTranscript && (
                <div className="text-gray-400 text-center py-8">録音ボタンを押して音声認識を開始してください</div>
              )}
            </div>
            
            {/* 編集可能な文字起こし結果 */}
            {transcript && (
              <TranscriptEditor
                transcript={transcript}
                onTranscriptChange={setTranscript}
                isRealtime={true}
              />
            )}
          </TabsContent>

          <TabsContent value="minutes" className="space-y-4">
            {/* AIモデル選択 */}
            <div className="space-y-2">
              <Label>AIモデル選択</Label>
              <AIModelSelector 
                value={selectedAiModel}
                onChange={setSelectedAiModel}
              />
            </div>

            {/* 議事録生成ボタン */}
            <Button
              onClick={generateMinutes}
              disabled={!transcript.trim() || isGeneratingMinutes}
              className="w-full"
            >
              {isGeneratingMinutes ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  議事録生成中...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  議事録を生成
                </>
              )}
            </Button>

            {/* 議事録生成エラー */}
            {minutesError && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{minutesError}</AlertDescription>
              </Alert>
            )}

            {/* 生成された議事録 */}
            {minutes && (
              <div className="space-y-2">
                <Label>生成された議事録</Label>
                <div className="min-h-[300px] p-3 border rounded-md bg-white whitespace-pre-wrap">
                  {minutes}
                </div>
              </div>
            )}

            {!minutes && !minutesError && !isGeneratingMinutes && (
              <div className="text-gray-400 text-center py-8">
                文字起こしテキストから議事録を生成できます
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default RealtimeTranscription
export { RealtimeTranscription }
