"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Sparkles, Copy, Download, Settings, Bot } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface MinutesGeneratorProps {
  transcript?: string
  onMinutesGenerated?: (minutes: string) => void
}

export function MinutesGenerator({ transcript, onMinutesGenerated }: MinutesGeneratorProps) {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedMinutes, setGeneratedMinutes] = useState("")
  const [selectedModel, setSelectedModel] = useState("gemini-pro")
  const [customPrompt, setCustomPrompt] = useState("")
  const [minutesStyle, setMinutesStyle] = useState("formal")

  const aiModels = [
    { value: "gemini-pro", label: "Gemini Pro (無料)", description: "Google AIモデル - 推奨", badge: "無料" },
    { value: "gpt-4", label: "GPT-4", description: "最高品質の議事録生成", badge: "有料" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", description: "高速で費用効率的", badge: "有料" },
    { value: "deepseek-chat", label: "DeepSeek", description: "高性能なオープンソースモデル", badge: "有料" }
  ]

  const minutesStyles = [
    { value: "formal", label: "正式議事録", description: "企業会議に適した正式な形式" },
    { value: "casual", label: "カジュアル", description: "チームミーティング向けの親しみやすい形式" },
    { value: "detailed", label: "詳細記録", description: "発言内容を詳細に記録" },
    { value: "summary", label: "要約版", description: "重要ポイントのみを簡潔に" },
    { value: "action", label: "アクション重視", description: "決定事項とTodoに焦点" }
  ]

  const generateMinutes = async () => {
    if (!transcript) {
      toast({
        title: "エラー",
        description: "文字起こしデータがありません。まず音声をアップロードしてください。",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    
    try {
      const response = await fetch('/api/generate-minutes-with-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          model: selectedModel,
          style: minutesStyle,
          customPrompt: customPrompt || undefined
        }),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.minutes) {
        setGeneratedMinutes(data.minutes)
        onMinutesGenerated?.(data.minutes)
        toast({
          title: "議事録生成完了",
          description: `${aiModels.find(m => m.value === selectedModel)?.label}で議事録を生成しました。`,
        })
      } else {
        throw new Error(data.error || '議事録の生成に失敗しました')
      }
    } catch (error) {
      console.error('Minutes generation error:', error)
      toast({
        title: "生成エラー",
        description: "議事録の生成中にエラーが発生しました。",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedMinutes)
      toast({
        title: "コピーしました",
        description: "議事録をクリップボードにコピーしました。",
      })
    } catch (error) {
      toast({
        title: "コピーに失敗しました",
        description: "クリップボードへのコピーに失敗しました。",
        variant: "destructive",
      })
    }
  }

  const downloadMinutes = () => {
    const blob = new Blob([generatedMinutes], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `議事録_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* AI設定パネル */}
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200/50 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-white/20 rounded-xl">
              <Settings className="h-6 w-6" />
            </div>
            AI議事録生成設定
          </CardTitle>
          <CardDescription className="text-purple-100">
            🤖 AIモデルと議事録のスタイルを選択してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model-select">AIモデル</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger id="model-select">
                  <SelectValue placeholder="AIモデルを選択" />
                </SelectTrigger>
                <SelectContent>
                  {aiModels.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex flex-col">
                          <span>{model.label}</span>
                          <span className="text-xs text-gray-500">{model.description}</span>
                        </div>
                        <Badge variant={model.badge === "無料" ? "default" : "outline"} className="ml-2 text-xs">
                          {model.badge}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="style-select">議事録スタイル</Label>
              <Select value={minutesStyle} onValueChange={setMinutesStyle}>
                <SelectTrigger id="style-select">
                  <SelectValue placeholder="スタイルを選択" />
                </SelectTrigger>
                <SelectContent>
                  {minutesStyles.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      <div className="flex flex-col">
                        <span>{style.label}</span>
                        <span className="text-xs text-gray-500">{style.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-prompt">カスタムプロンプト（オプション）</Label>
            <Textarea
              id="custom-prompt"
              placeholder="特別な指示があれば記入してください（例：特定の観点での要約、フォーマット指定など）"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="text-xs bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 border-blue-200">
              <Bot className="h-3 w-3 mr-1" />
              🤖 {aiModels.find(m => m.value === selectedModel)?.label}
            </Badge>
            <Badge variant="outline" className="text-xs bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200">
              📝 {minutesStyles.find(s => s.value === minutesStyle)?.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 生成ボタン */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200/50 shadow-xl rounded-2xl overflow-hidden">
        <CardContent className="pt-8 pb-8">
          <Button
            onClick={generateMinutes}
            disabled={isGenerating || !transcript}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg text-lg py-6 rounded-xl"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Sparkles className="h-5 w-5 mr-3 animate-spin" />
                🤖 AIが議事録を生成中...
              </>
            ) : (
              <>
                <FileText className="h-5 w-5 mr-3" />
                ✨ AI議事録を生成する
              </>
            )}
          </Button>
          {!transcript && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              📤 まず音声ファイルをアップロードして文字起こしを行ってください
            </p>
          )}
        </CardContent>
      </Card>

      {/* 生成結果 */}
      {generatedMinutes && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200/50 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-white/20 rounded-xl">
                  <FileText className="h-6 w-6" />
                </div>
                📑 生成された議事録
              </CardTitle>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={copyToClipboard}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  📋 コピー
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadMinutes}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  <Download className="h-4 w-4 mr-2" />
                  💾 ダウンロード
                </Button>
              </div>
            </div>
            <CardDescription className="text-blue-100">
              ✨ {aiModels.find(m => m.value === selectedModel)?.label}で生成された議事録です
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Separator className="mb-6" />
            <ScrollArea className="h-96 w-full">
              <div className="whitespace-pre-wrap text-sm leading-relaxed p-6 bg-gradient-to-br from-white to-blue-50 rounded-xl border-2 border-blue-100 shadow-inner">
                {generatedMinutes}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
