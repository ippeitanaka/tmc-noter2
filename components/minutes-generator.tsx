"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Copy, Download, Sparkles, FileText, CheckCircle, Users, Calendar, Target, ClipboardList, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import AIModelSelector, { AIModel } from "./ai-model-selector"

interface MinutesGeneratorProps {
  transcript: string
  onMinutesGenerated?: (minutes: any) => void
}

export function MinutesGenerator({ transcript, onMinutesGenerated }: MinutesGeneratorProps) {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedMinutes, setGeneratedMinutes] = useState<any>(null)
  const [selectedModel, setSelectedModel] = useState<AIModel>("gemini")
  const [customPrompt, setCustomPrompt] = useState("")
  const [minutesStyle, setMinutesStyle] = useState("professional")

  const minutesStyles = [
    { 
      value: "professional", 
      label: "プロフェッショナル", 
      description: "企業会議に適した正式な形式",
      icon: <FileText className="w-4 h-4" />
    },
    { 
      value: "detailed", 
      label: "詳細記録", 
      description: "発言内容を詳細に記録",
      icon: <ClipboardList className="w-4 h-4" />
    },
    { 
      value: "summary", 
      label: "要約版", 
      description: "重要ポイントのみを簡潔に",
      icon: <Target className="w-4 h-4" />
    },
    { 
      value: "action", 
      label: "アクション重視", 
      description: "決定事項とTodoに焦点",
      icon: <CheckCircle className="w-4 h-4" />
    }
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
      console.log("🚀 高品質議事録生成開始...")
      
      // 強化されたプロンプトを構築
      let enhancedPrompt = customPrompt
      
      if (!customPrompt) {
        switch (minutesStyle) {
          case "professional":
            enhancedPrompt = "企業の正式会議として、プロフェッショナルで構造化された議事録を作成してください。役職・責任者・具体的な決定事項を重視し、第三者が読んでも理解できる明確な記録にしてください。"
            break
          case "detailed":
            enhancedPrompt = "発言の詳細と文脈を保持しながら、誰が何を発言したかを明確に記録した詳細な議事録を作成してください。重要な議論の流れと背景情報も含めてください。"
            break
          case "summary":
            enhancedPrompt = "重要なポイントのみを抽出した簡潔で分かりやすい議事録を作成してください。決定事項・アクションアイテム・次のステップを中心に整理してください。"
            break
          case "action":
            enhancedPrompt = "決定事項・アクションアイテム・責任者・期限に焦点を当てた実行重視の議事録を作成してください。具体的なタスクと担当者を明確に特定してください。"
            break
        }
      }

      const response = await fetch('/api/generate-minutes-with-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          provider: selectedModel,
          userPrompt: enhancedPrompt,
          language: "ja"
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `API request failed: ${response.status}`)
      }

      const data = await response.json()
      console.log("✅ 議事録生成成功:", data)
      
      if (data.meetingName) {
        setGeneratedMinutes(data)
        onMinutesGenerated?.(data)
        
        toast({
          title: "🎉 高品質議事録生成完了",
          description: `${data.provider}で${data.quality === 'professional' ? 'プロフェッショナル' : 'スタンダード'}品質の議事録を生成しました。`,
        })
      } else {
        throw new Error(data.error || '議事録の生成に失敗しました')
      }
    } catch (error) {
      console.error('❌ Minutes generation error:', error)
      toast({
        title: "生成エラー",
        description: "議事録の生成中にエラーが発生しました。" + (error instanceof Error ? error.message : ''),
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    if (!generatedMinutes) return
    
    try {
      const formattedMinutes = formatMinutesForCopy(generatedMinutes)
      await navigator.clipboard.writeText(formattedMinutes)
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
    if (!generatedMinutes) return
    
    const formattedMinutes = formatMinutesForCopy(generatedMinutes)
    const blob = new Blob([formattedMinutes], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `議事録_${generatedMinutes.meetingName || '会議'}_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    toast({
      title: "ダウンロード完了",
      description: "議事録ファイルをダウンロードしました。",
    })
  }

  const formatMinutesForCopy = (minutes: any): string => {
    if (!minutes) return ""
    
    let formatted = `# ${minutes.meetingName}\n\n`
    formatted += `**開催日**: ${minutes.date}\n`
    formatted += `**参加者**: ${minutes.participants}\n`
    formatted += `**議題**: ${minutes.agenda}\n\n`
    
    formatted += `## 主要ポイント\n`
    if (Array.isArray(minutes.mainPoints)) {
      minutes.mainPoints.forEach((point: string, index: number) => {
        formatted += `${index + 1}. ${point}\n`
      })
    }
    formatted += '\n'
    
    formatted += `## 決定事項\n${minutes.decisions}\n\n`
    formatted += `## アクションアイテム\n${minutes.todos}\n\n`
    
    if (minutes.nextMeeting) {
      formatted += `## 次回予定\n${minutes.nextMeeting}\n\n`
    }
    
    if (minutes.generatedAt) {
      formatted += `---\n生成日時: ${new Date(minutes.generatedAt).toLocaleString('ja-JP')}\n`
    }
    if (minutes.provider) {
      formatted += `使用AI: ${minutes.provider}\n`
    }
    
    return formatted
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          高品質AI議事録生成
          <Badge variant="secondary" className="ml-auto">NEW</Badge>
        </CardTitle>
        <CardDescription>
          最新のAI技術で、プロフェッショナルな議事録を自動生成します
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI モデル選択 */}
        <AIModelSelector
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={isGenerating}
        />
        
        {/* 議事録スタイル選択 */}
        <div className="space-y-2">
          <Label htmlFor="minutes-style" className="text-sm font-semibold">議事録スタイル</Label>
          <Select value={minutesStyle} onValueChange={setMinutesStyle} disabled={isGenerating}>
            <SelectTrigger id="minutes-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {minutesStyles.map((style) => (
                <SelectItem key={style.value} value={style.value}>
                  <div className="flex items-center gap-2">
                    {style.icon}
                    <div>
                      <div className="font-medium">{style.label}</div>
                      <div className="text-xs text-gray-500">{style.description}</div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* カスタムプロンプト */}
        <div className="space-y-2">
          <Label htmlFor="custom-prompt">カスタムプロンプト（オプション）</Label>
          <Textarea
            id="custom-prompt"
            placeholder="特別な要件や形式があれば、ここに詳しく記入してください..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            disabled={isGenerating}
            rows={3}
          />
        </div>

        {/* 生成ボタン */}
        <Button 
          onClick={generateMinutes} 
          disabled={!transcript || isGenerating}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              高品質議事録を生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              プロフェッショナル議事録を生成
            </>
          )}
        </Button>

        {/* 生成された議事録の表示 */}
        {generatedMinutes && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-green-800">✅ 議事録生成完了</h3>
              <div className="flex gap-2">
                <Button onClick={copyToClipboard} variant="outline" size="sm">
                  <Copy className="w-4 h-4 mr-1" />
                  コピー
                </Button>
                <Button onClick={downloadMinutes} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  ダウンロード
                </Button>
              </div>
            </div>
            
            {/* 品質バッジ */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                {generatedMinutes.quality === 'professional' ? 'プロフェッショナル品質' : 'スタンダード品質'}
              </Badge>
              <Badge variant="outline">
                使用AI: {generatedMinutes.provider}
              </Badge>
              {generatedMinutes.generatedAt && (
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(generatedMinutes.generatedAt).toLocaleTimeString('ja-JP')}
                </Badge>
              )}
            </div>

            {/* 構造化された議事録表示 */}
            <Card className="bg-gray-50 border-2 border-green-200">
              <CardContent className="p-6 space-y-4">
                {/* 基本情報 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-blue-800 flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      会議名
                    </h4>
                    <p className="text-gray-800">{generatedMinutes.meetingName}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-800 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      開催日
                    </h4>
                    <p className="text-gray-800">{generatedMinutes.date}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-800 flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      参加者
                    </h4>
                    <p className="text-gray-800">{generatedMinutes.participants}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-800 flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      議題
                    </h4>
                    <p className="text-gray-800">{generatedMinutes.agenda}</p>
                  </div>
                </div>

                {/* 主要ポイント */}
                <div>
                  <h4 className="font-semibold text-blue-800 mb-2">主要ポイント</h4>
                  <ul className="space-y-1">
                    {Array.isArray(generatedMinutes.mainPoints) 
                      ? generatedMinutes.mainPoints.map((point: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-blue-600 font-semibold">{index + 1}.</span>
                            <span className="text-gray-800">{point}</span>
                          </li>
                        ))
                      : <li className="text-gray-800">{generatedMinutes.mainPoints}</li>
                    }
                  </ul>
                </div>

                {/* 決定事項 */}
                <div>
                  <h4 className="font-semibold text-blue-800 mb-2">決定事項</h4>
                  <p className="text-gray-800 bg-yellow-50 p-3 rounded border border-yellow-200">
                    {generatedMinutes.decisions}
                  </p>
                </div>

                {/* アクションアイテム */}
                <div>
                  <h4 className="font-semibold text-blue-800 mb-2">アクションアイテム</h4>
                  <p className="text-gray-800 bg-blue-50 p-3 rounded border border-blue-200">
                    {generatedMinutes.todos}
                  </p>
                </div>

                {/* 次回予定 */}
                {generatedMinutes.nextMeeting && (
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-2">次回予定</h4>
                    <p className="text-gray-800 bg-green-50 p-3 rounded border border-green-200">
                      {generatedMinutes.nextMeeting}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default MinutesGenerator
