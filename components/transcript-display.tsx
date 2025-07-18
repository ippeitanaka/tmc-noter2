"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Copy, Download, FileText, MessageSquareText, Trash2, Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { deleteRecord } from "@/lib/local-storage"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useAiConfig } from "@/contexts/ai-config-context"

import { SpeakerProfile, SpeakerSegment } from "@/lib/speaker-identification"

interface TranscriptDisplayProps {
  transcript: string
  speakerSegments?: SpeakerSegment[]
  speakerProfiles?: SpeakerProfile[]
  minutes?: {
    meetingName: string
    date: string
    participants: string
    agenda: string
    mainPoints: string[]
    decisions: string
    todos: string
    nextMeeting?: string
    meetingDetails?: string
  }
  recordId?: string
  onDelete?: () => void
  onClear?: () => void
  onRegenerateMinutes?: (newMinutes: any) => void
}

export default function TranscriptDisplay({
  transcript,
  speakerSegments = [],
  speakerProfiles = [],
  minutes,
  recordId,
  onDelete,
  onClear,
  onRegenerateMinutes,
}: TranscriptDisplayProps) {
  const [activeTab, setActiveTab] = useState("minutes")
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false)
  const [userInstructions, setUserInstructions] = useState("")
  const { toast } = useToast()
  const { aiConfig } = useAiConfig()

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "コピーしました",
      description: "クリップボードにコピーしました。",
    })
  }

  const downloadAsText = (content: string, filename: string) => {
    try {
      // Blobオブジェクトを作成（UTF-8エンコーディングを明示的に指定）
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" })

      // URLを作成
      const url = URL.createObjectURL(blob)

      // ダウンロードリンクを作成
      const link = document.createElement("a")
      link.href = url
      link.download = filename

      // リンクをDOMに追加して自動クリック
      document.body.appendChild(link)
      link.click()

      // クリーンアップ（少し遅延させて確実にダウンロードを開始させる）
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 200)

      toast({
        title: "保存完了",
        description: `${filename} として保存しました。`,
      })
    } catch (error) {
      console.error("Download error:", error)
      toast({
        title: "エラー",
        description: "ファイルの保存に失敗しました。",
        variant: "destructive",
      })
    }
  }

  // formatMinutesAsText関数を改善 - 新しい形式に対応
  const formatMinutesAsText = () => {
    // 新しい議事録フォーマットに変更
    if (!minutes) return "議事録データがありません"
    
    let formattedText = `■会議名：${minutes.meetingName}\n`
    formattedText += `■日時：${minutes.date}\n`
    formattedText += `■参加者：${minutes.participants}\n`
    formattedText += `■会議の目的：${minutes.agenda}\n\n`

    formattedText += `■主な議論内容：\n`
    minutes.mainPoints.forEach((point) => {
      formattedText += `${point}\n`
    })

    formattedText += `\n■決定事項：\n${minutes.decisions}\n`
    formattedText += `\n■今後のアクション：\n${minutes.todos}\n`

    if (minutes.nextMeeting && minutes.nextMeeting !== "未定") {
      formattedText += `\n次回：${minutes.nextMeeting}\n`
    }

    return formattedText
  }

  // 議事録の表示を改善 - 新しい形式に対応
  const renderMinutesContent = () => {
    if (!minutes) {
      return (
        <div className="text-center p-8">
          <p className="text-gray-500">議事録データがありません</p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* 基本情報 */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h3 className="text-lg font-semibold mb-3">基本情報</h3>
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <span className="font-medium text-gray-700 w-24">日時：</span>
              <span>{minutes.date}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center">
              <span className="font-medium text-gray-700 w-24">参加者：</span>
              <span>{minutes.participants}</span>
            </div>
            {minutes.agenda && minutes.agenda !== "不明" && (
              <div className="flex flex-col sm:flex-row sm:items-start">
                <span className="font-medium text-gray-700 w-24">目的：</span>
                <span>{minutes.agenda}</span>
              </div>
            )}
          </div>
        </div>

        {/* 主な議論内容 */}
        <div>
          <h3 className="text-lg font-semibold mb-3">主な議論内容</h3>
          <div className="bg-white border rounded-md p-4">
            {minutes.mainPoints.length > 0 ? (
              <div className="space-y-2">
                {minutes.mainPoints.map((point, index) => {
                  // セグメント見出しかどうかをチェック
                  if (point.startsWith("【セグメント")) {
                    return (
                      <h4 key={`segment-${index}`} className="font-medium text-gray-800 mt-4 border-b pb-1">
                        {point}
                      </h4>
                    )
                  }

                  // 通常の箇条書き項目
                  return (
                    <div key={index} className="ml-0">
                      {point.startsWith("-") ? (
                        <p className="text-gray-700 ml-4">{point}</p>
                      ) : (
                        <p className="text-gray-700">{point}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500 italic">議論内容が抽出されませんでした</p>
            )}
          </div>
        </div>

        {/* 決定事項 */}
        <div>
          <h3 className="text-lg font-semibold mb-3">決定事項</h3>
          <div className="bg-blue-50 p-4 rounded-md">
            {minutes.decisions === "特になし" || minutes.decisions === "継続議論" ? (
              <p className="text-gray-500 italic">明確な決定事項はありませんでした</p>
            ) : (
              <div className="whitespace-pre-line">
                {minutes.decisions.split("\n").map((line, index) => (
                  <p key={index} className="mb-2">
                    {line.startsWith("-") ? line : line}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 今後のアクション */}
        <div>
          <h3 className="text-lg font-semibold mb-3">今後のアクション</h3>
          <div className="bg-green-50 p-4 rounded-md">
            {minutes.todos === "特になし" ? (
              <p className="text-gray-500 italic">明確なアクションアイテムはありませんでした</p>
            ) : (
              <div className="whitespace-pre-line">
                {minutes.todos.split("\n").map((line, index) => (
                  <p key={index} className="mb-2">
                    {line.startsWith("-") ? line : line}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 次回会議 */}
        {minutes.nextMeeting && minutes.nextMeeting !== "未定" && (
          <div>
            <h3 className="text-lg font-semibold mb-3">次回会議</h3>
            <div className="bg-purple-50 p-4 rounded-md">
              <p className="whitespace-pre-line">{minutes.nextMeeting}</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)

      // Supabaseからの削除処理（APIがある場合）
      if (recordId) {
        try {
          // APIを使用して削除
          const response = await fetch("/api/delete-audio", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ recordId }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error("Delete API error:", errorData)
            // APIエラーでも続行（ローカルからは削除する）
          }
        } catch (error) {
          console.error("Delete API error:", error)
        }

        // ローカルストレージからも削除
        deleteRecord(recordId)
      }

      // 親コンポーネントに削除を通知
      if (onDelete) {
        onDelete()
      } else if (onClear) {
        onClear()
      }

      toast({
        title: "削除完了",
        description: "記録が削除されました。",
      })
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "削除エラー",
        description: "削除中にエラーが発生しました。",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // handleRegenerateMinutes関数を修正して、サーバーサイドAPIを使用するようにします
  const handleRegenerateMinutes = async () => {
    try {
      setIsRegenerating(true)
      setRegenerateDialogOpen(false)

      // 選択したAIモデルと追加指示を使用して議事録を再生成
      let enhancedTranscript = transcript

      // ユーザー指示がある場合は追加
      if (userInstructions.trim()) {
        enhancedTranscript = `${transcript}\n\n【追加指示】\n${userInstructions.trim()}`
      }

      console.log("Regenerating minutes with model:", aiConfig.provider)
      console.log("Enhanced transcript length:", enhancedTranscript.length)

      // サーバーサイドAPIを呼び出す（タイムアウト設定付き）
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2分のタイムアウト
      
      try {
        console.log("Starting minutes generation request...")
        
        const response = await fetch("/api/generate-minutes-with-ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transcript: enhancedTranscript,
            model: aiConfig.provider,
          }),
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)

        console.log("API response status:", response.status)
        console.log("API response ok:", response.ok)
        console.log("API response headers:", Object.fromEntries(response.headers.entries()))

        // Content-Typeをチェック
        const contentType = response.headers.get('content-type');
        console.log("Content-Type:", contentType);

        // レスポンステキストを取得
        let responseText: string;
        try {
          responseText = await response.text()
          console.log("API response text length:", responseText.length)
          console.log("API response text preview:", responseText.substring(0, 500))
        } catch (textError) {
          console.error("Failed to read response text:", textError)
          throw new Error(`レスポンステキストの読み取りに失敗しました: ${textError instanceof Error ? textError.message : String(textError)}`)
        }

        // 空のレスポンスチェック
        if (!responseText || responseText.trim() === '') {
          console.error("Empty response received from server")
          throw new Error("サーバーから空のレスポンスが返されました。サーバーログを確認してください。")
        }

        // JSON解析
        let data: any;
        try {
          data = JSON.parse(responseText)
          console.log("JSON parsing successful")
        } catch (parseError) {
          console.error("Failed to parse JSON response:", parseError)
          console.error("Response text:", responseText)
          
          // Content-Typeがapplication/jsonでない場合の追加チェック
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`サーバーが無効なContent-Type (${contentType}) を返しました。HTMLエラーページまたはプロキシエラーの可能性があります。`)
          }
          
          throw new Error(`JSONレスポンスの解析に失敗しました: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
        }

        // HTTPエラーレスポンスの処理
        if (!response.ok) {
          const errorMessage = data.error || "Unknown error"
          const errorDetails = data.details || ""
          const errorTimestamp = data.timestamp || ""
          
          console.error("API error response:", {
            status: response.status,
            statusText: response.statusText,
            error: errorMessage,
            details: errorDetails,
            timestamp: errorTimestamp
          })
          
          throw new Error(
            `API error: ${response.status} ${response.statusText} - ${errorMessage} ${errorDetails}`,
          )
        }
        
        // レスポンスデータの検証
        if (!data.minutes) {
          console.error("No minutes in response:", data)
          throw new Error("サーバーレスポンスに議事録データが含まれていません")
        }
        
        const newMinutes = data.minutes
        const usedModel = data.usedModel
        const fallbackReason = data.fallbackReason
        const success = data.success

        console.log("Regenerated minutes received:", JSON.stringify(newMinutes).substring(0, 200) + "...")
        console.log("Response metadata:", { usedModel, fallbackReason, success })

        // 使用されたモデルが要求したモデルと異なる場合は通知
        if (usedModel && usedModel !== aiConfig.provider) {
          let fallbackMessage = `${aiConfig.provider}モデルの代わりに${usedModel}を使用しました。`

          if (fallbackReason === "RATE_LIMIT") {
            fallbackMessage += "APIのレート制限に達したため、代替モデルを使用しました。"
          } else if (fallbackReason === "API_KEY_MISSING") {
            fallbackMessage += "APIキーが設定されていないため、代替モデルを使用しました。"
          } else if (fallbackReason === "API_ERROR") {
            fallbackMessage += "APIエラーが発生したため、代替モデルを使用しました。"
          } else if (fallbackReason === "JSON_SERIALIZATION_ERROR") {
            fallbackMessage += "レスポンス処理エラーのため、安全なフォールバックレスポンスを使用しました。"
          }

          toast({
            title: "モデル変更通知",
            description: fallbackMessage,
            variant: success === false ? "destructive" : "default",
          })
        } else {
          toast({
            title: "再生成完了",
            description: "議事録が再生成されました。",
          })
        }

        // 親コンポーネントに新しい議事録を渡す
        if (onRegenerateMinutes) {
          onRegenerateMinutes(newMinutes)
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        
        // AbortErrorの場合はタイムアウトメッセージ
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error("議事録生成がタイムアウトしました（2分経過）。文字起こしが長すぎる可能性があります。")
        }
        
        throw fetchError
      }
    } catch (error) {
      console.error("Regeneration error:", error)
      
      let errorMessage = "議事録の再生成中にエラーが発生しました"
      let errorDetails = ""
      
      if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack
        })
        
        // 特定のエラータイプに応じたメッセージ
        if (error.message.includes("Failed to fetch")) {
          errorMessage = "ネットワークエラーが発生しました"
          errorDetails = "インターネット接続を確認してください"
        } else if (error.message.includes("JSON")) {
          errorMessage = "サーバーレスポンスの解析に失敗しました"
          errorDetails = "しばらく時間をおいて再試行してください"
        } else if (error.message.includes("429")) {
          errorMessage = "APIのレート制限に達しました"
          errorDetails = "しばらく時間をおいて再試行してください"
        } else if (error.message.includes("500")) {
          errorMessage = "サーバー内部エラーが発生しました"
          errorDetails = "しばらく時間をおいて再試行してください"
        } else {
          errorDetails = error.message
        }
      }
      
      toast({
        title: "エラー",
        description: `${errorMessage}${errorDetails ? `: ${errorDetails}` : ""}`,
        variant: "destructive",
        duration: 8000, // より長い時間表示
      })
    } finally {
      setIsRegenerating(false)
    }
  }

  return (
    <Card className="mt-8 border-t-4 border-t-purple-500 shadow-lg">
      <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <CardTitle className="text-xl sm:text-2xl font-bold text-gray-800 font-cute">{minutes?.meetingName || "会議記録"}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(activeTab === "minutes" ? formatMinutesAsText() : transcript)}
            >
              <Copy className="h-4 w-4 mr-1" />
              コピー
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadAsText(
                  activeTab === "minutes" ? formatMinutesAsText() : transcript,
                  activeTab === "minutes" ? "議事録.txt" : "文字起こし.txt",
                )
              }
            >
              <Download className="h-4 w-4 mr-1" />
              保存
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRegenerateDialogOpen(true)} disabled={isRegenerating}>
              <RefreshCw className="h-4 w-4 mr-1" />
              再生成
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4 mr-1" />
                  削除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>この操作は元に戻せません。記録が完全に削除されます。</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault()
                      handleDelete()
                    }}
                    className="bg-red-500 hover:bg-red-700"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        削除中...
                      </>
                    ) : (
                      "削除する"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>

      <Tabs defaultValue="minutes" value={activeTab} onValueChange={setActiveTab}>
        <div className="px-4 sm:px-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="minutes" className="flex items-center text-xs sm:text-sm">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              議事録
            </TabsTrigger>
            <TabsTrigger value="transcript" className="flex items-center text-xs sm:text-sm">
              <MessageSquareText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              文字起こし
            </TabsTrigger>
          </TabsList>
        </div>

        <CardContent className="pt-4 px-4 sm:px-6">
          <TabsContent value="minutes" className="mt-0">
            {renderMinutesContent()}
          </TabsContent>

          <TabsContent value="transcript" className="mt-0">
            <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
              <pre className="whitespace-pre-wrap text-xs sm:text-sm text-gray-700 font-mono overflow-x-auto">
                {transcript}
              </pre>
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>

      {/* 議事録再生成ダイアログ */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>議事録を再生成</DialogTitle>
            <DialogDescription>AIモデルを選択し、必要に応じて追加指示を入力してください。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-gray-500">
              選択されたAIプロバイダー: {aiConfig.provider}
            </div>
            <div className="space-y-2">
              <label htmlFor="instructions" className="text-sm font-medium">
                追加指示（オプション）
              </label>
              <Textarea
                id="instructions"
                placeholder="例: 特に〇〇の話題に焦点を当てて、簡潔にまとめてください"
                value={userInstructions}
                onChange={(e) => setUserInstructions(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleRegenerateMinutes} disabled={isRegenerating}>
              {isRegenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                "再生成する"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
