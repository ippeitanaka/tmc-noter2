"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Copy, Download, Share2, FileText, Users, Hash, Heart, ScrollText, Sparkles } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"

interface TranscriptionData {
  transcript: string
  speakers?: string
  summary?: string
  keywords?: string
  sentiment?: string
  structured?: string
  minutes?: string
  originalTranscript?: string
  duration?: number
  fileName?: string
  fileSize?: number
  timestamp?: string
}

interface TranscriptionResultsProps {
  data: TranscriptionData | null
  activeSection?: "transcript" | "speakers" | "summary" | "keywords" | "sentiment" | "structured" | "minutes"
}

export function TranscriptionResults({ data, activeSection = "transcript" }: TranscriptionResultsProps) {
  const { toast } = useToast()
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  if (!data) {
    return (
      <Card className="bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-gray-200/50 shadow-xl rounded-2xl overflow-hidden">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <p className="text-gray-600 mb-2 font-medium">まだ結果がありません</p>
            <p className="text-sm text-gray-500">「アップロード」タブで音声ファイルをアップロードしてください 🎵</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedSection(section)
      toast({
        title: "コピーしました",
        description: `${section}をクリップボードにコピーしました。`,
      })
      setTimeout(() => setCopiedSection(null), 2000)
    } catch (error) {
      toast({
        title: "コピーに失敗しました",
        description: "クリップボードへのコピーに失敗しました。",
        variant: "destructive",
      })
    }
  }

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const renderFileInfo = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      {data.fileName && (
        <Badge variant="secondary" className="text-xs bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 border-blue-200">
          📁 {data.fileName}
        </Badge>
      )}
      {data.fileSize && (
        <Badge variant="secondary" className="text-xs bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200">
          📊 {formatFileSize(data.fileSize)}
        </Badge>
      )}
      {data.duration && (
        <Badge variant="secondary" className="text-xs bg-gradient-to-r from-orange-100 to-red-100 text-orange-800 border-orange-200">
          ⏱️ {Math.round(data.duration)}秒
        </Badge>
      )}
      {data.timestamp && (
        <Badge variant="secondary" className="text-xs bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border-purple-200">
          🕒 {new Date(data.timestamp).toLocaleString('ja-JP')}
        </Badge>
      )}
    </div>
  )

  const renderContent = () => {
    const sections = [
      { key: "transcript", title: "📝 文字起こし", content: data.transcript, filename: "transcript.txt" },
      { key: "speakers", title: "👥 話者識別", content: data.speakers, filename: "speakers.txt" },
      { key: "summary", title: "📋 要約", content: data.summary, filename: "summary.txt" },
      { key: "minutes", title: "📑 議事録", content: data.minutes, filename: "minutes.txt" },
      { key: "keywords", title: "🏷️ キーワード", content: data.keywords, filename: "keywords.txt" },
      { key: "sentiment", title: "🎭 感情分析", content: data.sentiment, filename: "sentiment.txt" },
      { key: "structured", title: "📑 構造化", content: data.structured, filename: "structured.txt" }
    ]

    const activeContent = sections.find(s => s.key === activeSection)
    
    if (!activeContent) {
      return <div className="text-center text-gray-500">セクションが見つかりません</div>
    }

    if (!activeContent.content) {
      return (
        <div className="text-center text-gray-500 py-12">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
            <FileText className="h-10 w-10 text-gray-400" />
          </div>
          <p className="mb-2 font-medium text-gray-600">{activeContent.title}の結果がありません</p>
          <p className="text-sm text-gray-500">📋 ファイルアップロード時に該当オプションを有効にしてください</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{activeContent.title}</h3>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(activeContent.content!, activeContent.key)}
              disabled={copiedSection === activeContent.key}
              className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 hover:from-blue-100 hover:to-blue-200 text-blue-700 shadow-md"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copiedSection === activeContent.key ? "✅ コピー済み" : "📋 コピー"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadText(activeContent.content!, activeContent.filename)}
              className="bg-gradient-to-r from-green-50 to-green-100 border-green-200 hover:from-green-100 hover:to-green-200 text-green-700 shadow-md"
            >
              <Download className="h-4 w-4 mr-2" />
              💾 ダウンロード
            </Button>
          </div>
        </div>
        
        <Separator />
        
        <ScrollArea className="h-96 w-full">
          <div className="whitespace-pre-wrap text-sm leading-relaxed p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-gray-100 shadow-inner">
            {activeContent.content}
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200/50 shadow-xl rounded-2xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-gray-100 to-blue-100 border-b-2 border-gray-200/50">
        <div className="space-y-3">
          {renderFileInfo()}
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl text-white">
              {activeSection === "transcript" && <FileText className="h-5 w-5" />}
              {activeSection === "speakers" && <Users className="h-5 w-5" />}
              {activeSection === "summary" && <Sparkles className="h-5 w-5" />}
              {activeSection === "minutes" && <ScrollText className="h-5 w-5" />}
              {activeSection === "keywords" && <Hash className="h-5 w-5" />}
              {activeSection === "sentiment" && <Heart className="h-5 w-5" />}
              {activeSection === "structured" && <FileText className="h-5 w-5" />}
            </div>
            {activeSection === "transcript" && "📝 文字起こし結果"}
            {activeSection === "speakers" && "👥 話者識別結果"}
            {activeSection === "summary" && "📋 要約結果"}
            {activeSection === "minutes" && "📑 議事録結果"}
            {activeSection === "keywords" && "🏷️ キーワード抽出結果"}
            {activeSection === "sentiment" && "🎭 感情分析結果"}
            {activeSection === "structured" && "📑 構造化結果"}
          </CardTitle>
          <CardDescription className="text-gray-600">
            ✨ 生成された{activeSection === "transcript" && "文字起こし"}
            {activeSection === "speakers" && "話者識別"}
            {activeSection === "summary" && "要約"}
            {activeSection === "minutes" && "議事録"}
            {activeSection === "keywords" && "キーワード"}
            {activeSection === "sentiment" && "感情分析"}
            {activeSection === "structured" && "構造化"}結果を確認できます
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {renderContent()}
      </CardContent>
    </Card>
  )
}
