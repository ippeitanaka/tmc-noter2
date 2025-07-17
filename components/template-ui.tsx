// 議事録テンプレートUIコンポーネント
"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  FileText, 
  Download, 
  Calendar, 
  Users, 
  CheckCircle, 
  Target,
  Eye,
  Settings
} from 'lucide-react'
import { 
  MeetingTemplateManager, 
  MeetingTemplate, 
  FilledTemplate,
  TemplateSettings 
} from '@/lib/meeting-templates'
import { SummaryResult } from '@/lib/rule-based-summarizer'

interface TemplateUIProps {
  transcript: string
  summary: SummaryResult | null
  onTemplateGenerated: (template: FilledTemplate) => void
}

export default function TemplateUI({ transcript, summary, onTemplateGenerated }: TemplateUIProps) {
  const [templateManager] = useState(() => new MeetingTemplateManager())
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedTemplate, setGeneratedTemplate] = useState<FilledTemplate | null>(null)
  const [previewMode, setPreviewMode] = useState<'structured' | 'markdown'>('structured')

  // 利用可能なテンプレートを取得
  const templates = templateManager.getTemplates()

  // テンプレートを生成
  const generateTemplate = async () => {
    if (!selectedTemplateId || !transcript.trim() || !summary) return

    setIsGenerating(true)
    setProgress(0)

    try {
      // プログレスバーのシミュレーション
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 20, 90))
      }, 100)

      // テンプレートを生成
      const filled = templateManager.generateMeetingMinutes(
        selectedTemplateId,
        transcript,
        summary
      )

      clearInterval(progressInterval)
      setProgress(100)

      if (filled) {
        setGeneratedTemplate(filled)
        onTemplateGenerated(filled)
      }

    } catch (error) {
      console.error('Template generation error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  // Markdownをダウンロード
  const downloadMarkdown = () => {
    if (!generatedTemplate) return

    const markdown = templateManager.exportToMarkdown(generatedTemplate)
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${generatedTemplate.templateName}_${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 構造化プレビューを表示
  const renderStructuredPreview = () => {
    if (!generatedTemplate) return null

    const template = templateManager.getTemplate(generatedTemplate.templateId)
    if (!template) return null

    return (
      <div className="space-y-6">
        {template.sections.map(section => {
          const data = generatedTemplate.content[section.id]
          if (!data) return null

          return (
            <div key={section.id} className="border rounded-lg p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                {getSectionIcon(section.type)}
                {section.title}
                {section.required && <Badge variant="secondary" className="text-xs">必須</Badge>}
              </h3>

              <div className="space-y-2">
                {renderSectionContent(section.type, data)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // セクションアイコンを取得
  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'datetime': return <Calendar className="w-4 h-4" />
      case 'participants': return <Users className="w-4 h-4" />
      case 'summary': return <FileText className="w-4 h-4" />
      case 'list': return <CheckCircle className="w-4 h-4" />
      case 'table': return <Target className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  // セクションコンテンツをレンダリング
  const renderSectionContent = (type: string, data: any) => {
    switch (type) {
      case 'datetime':
        if (typeof data === 'object' && data.date) {
          return (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium">日時:</span> {data.date} {data.time}</div>
              {data.duration && <div><span className="font-medium">時間:</span> {data.duration}</div>}
              {data.note && <div className="col-span-2 text-gray-600">{data.note}</div>}
            </div>
          )
        }
        return <div className="text-gray-500 text-sm">日時情報が設定されていません</div>

      case 'participants':
        if (Array.isArray(data) && data.length > 0) {
          return (
            <div className="flex flex-wrap gap-2">
              {data.map((participant: string, index: number) => (
                <Badge key={index} variant="outline">{participant}</Badge>
              ))}
            </div>
          )
        }
        return <div className="text-gray-500 text-sm">参加者情報がありません</div>

      case 'summary':
        if (typeof data === 'object') {
          return (
            <div className="space-y-3">
              {data.summary && (
                <div className="p-3 bg-gray-50 rounded text-sm">
                  {data.summary}
                </div>
              )}
              {data.keyPoints && Array.isArray(data.keyPoints) && data.keyPoints.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">主なポイント</h4>
                  <ul className="space-y-1">
                    {data.keyPoints.map((point: string, index: number) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-blue-600">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        }
        return <div className="text-gray-500 text-sm">要約情報がありません</div>

      case 'list':
        if (Array.isArray(data) && data.length > 0) {
          return (
            <ul className="space-y-2">
              {data.map((item: string, index: number) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-green-600">•</span>
                  {item}
                </li>
              ))}
            </ul>
          )
        }
        return <div className="text-gray-500 text-sm">項目がありません</div>

      case 'table':
        if (Array.isArray(data) && data.length > 0) {
          const keys = Object.keys(data[0])
          return (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {keys.map(key => (
                      <th key={key} className="border border-gray-300 px-3 py-2 text-left">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any, index: number) => (
                    <tr key={index}>
                      {keys.map(key => (
                        <td key={key} className="border border-gray-300 px-3 py-2">
                          {row[key] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return <div className="text-gray-500 text-sm">テーブルデータがありません</div>

      case 'text':
        if (typeof data === 'string' && data.trim()) {
          return <div className="text-sm p-3 bg-gray-50 rounded">{data}</div>
        }
        return <div className="text-gray-500 text-sm">テキストが入力されていません</div>

      default:
        return <div className="text-gray-500 text-sm">データ形式が不明です</div>
    }
  }

  // Markdownプレビューを表示
  const renderMarkdownPreview = () => {
    if (!generatedTemplate) return null

    const markdown = templateManager.exportToMarkdown(generatedTemplate)
    
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <pre className="text-sm whitespace-pre-wrap font-mono">{markdown}</pre>
        </div>
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          議事録テンプレート
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* テンプレート選択 */}
        <div className="flex items-center gap-4">
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger className="w-60">
              <SelectValue placeholder="テンプレートを選択" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(template => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={generateTemplate}
            disabled={!selectedTemplateId || !transcript.trim() || !summary || isGenerating}
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {isGenerating ? '生成中...' : '議事録生成'}
          </Button>
        </div>

        {/* 選択されたテンプレートの説明 */}
        {selectedTemplateId && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-sm">
              <span className="font-medium">
                {templates.find(t => t.id === selectedTemplateId)?.name}
              </span>
              <span className="text-gray-600 ml-2">
                {templates.find(t => t.id === selectedTemplateId)?.description}
              </span>
            </div>
          </div>
        )}

        {/* プログレスバー */}
        {isGenerating && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <div className="text-sm text-gray-600 text-center">
              議事録を生成中... {progress}%
            </div>
          </div>
        )}

        {/* 生成結果 */}
        {generatedTemplate && (
          <div className="space-y-4">
            {/* ツールバー */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant={previewMode === 'structured' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewMode('structured')}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  構造化表示
                </Button>
                <Button
                  variant={previewMode === 'markdown' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewMode('markdown')}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Markdown
                </Button>
              </div>

              <Button
                onClick={downloadMarkdown}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Markdown保存
              </Button>
            </div>

            {/* プレビュー */}
            <ScrollArea className="h-96 border rounded-lg p-4">
              {previewMode === 'structured' ? renderStructuredPreview() : renderMarkdownPreview()}
            </ScrollArea>

            {/* メタ情報 */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>生成日時: {generatedTemplate.generatedAt.toLocaleString('ja-JP')}</span>
              <span>テンプレート: {generatedTemplate.templateName}</span>
            </div>
          </div>
        )}

        {/* 結果が空の場合のメッセージ */}
        {!isGenerating && transcript && summary && !generatedTemplate && (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>テンプレートを選択して議事録を生成してください</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
