// 要約機能UIコンポーネント
"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  Clock, 
  BarChart3,
  Target,
  ListChecks
} from 'lucide-react'
import { RuleBasedSummarizer, SummaryResult, KeywordScore } from '@/lib/rule-based-summarizer'

interface SummaryUIProps {
  transcript: string
  onSummaryComplete: (summary: SummaryResult) => void
}

export default function SummaryUI({ transcript, onSummaryComplete }: SummaryUIProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<SummaryResult | null>(null)
  const [keywords, setKeywords] = useState<KeywordScore[]>([])
  const [summarizer] = useState(() => new RuleBasedSummarizer())

  // 要約を実行
  const generateSummary = async () => {
    if (!transcript.trim()) return

    setIsAnalyzing(true)
    setProgress(0)

    try {
      // プログレスバーのシミュレーション
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 15, 90))
      }, 100)

      // 要約処理を実行
      const summaryResult = summarizer.summarize(transcript)
      const keywordAnalysis = summarizer.analyzeKeywords(transcript, 15)
      
      clearInterval(progressInterval)
      setProgress(100)

      // 結果を設定
      setSummary(summaryResult)
      setKeywords(keywordAnalysis)

      // 親コンポーネントに結果を通知
      onSummaryComplete(summaryResult)

    } catch (error) {
      console.error('Summary generation error:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 自動要約（transcriptが変更された時）
  useEffect(() => {
    if (transcript.trim()) {
      generateSummary()
    }
  }, [transcript])

  // キーワードの重要度に基づく色分け
  const getKeywordColor = (score: number, maxScore: number) => {
    const ratio = score / maxScore
    if (ratio > 0.7) return 'bg-red-100 text-red-800'
    if (ratio > 0.4) return 'bg-orange-100 text-orange-800'
    if (ratio > 0.2) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          AI要約分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 分析開始ボタン */}
        <div className="flex items-center gap-4">
          <Button 
            onClick={generateSummary}
            disabled={!transcript.trim() || isAnalyzing}
            className="flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            {isAnalyzing ? '分析中...' : '要約を生成'}
          </Button>
          
          {transcript && (
            <div className="text-sm text-gray-600">
              文字数: {transcript.length}文字
            </div>
          )}
        </div>

        {/* プログレスバー */}
        {isAnalyzing && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <div className="text-sm text-gray-600 text-center">
              テキストを分析中... {progress}%
            </div>
          </div>
        )}

        {/* 要約結果 */}
        {summary && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">概要</TabsTrigger>
              <TabsTrigger value="keypoints">要点</TabsTrigger>
              <TabsTrigger value="decisions">決定</TabsTrigger>
              <TabsTrigger value="actions">アクション</TabsTrigger>
              <TabsTrigger value="keywords">キーワード</TabsTrigger>
            </TabsList>

            {/* 概要タブ */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                  <div className="text-sm text-gray-600">会議時間</div>
                  <div className="font-semibold">{summary.meetingDuration}</div>
                </div>
                
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <Users className="w-6 h-6 mx-auto mb-2 text-green-600" />
                  <div className="text-sm text-gray-600">参加者</div>
                  <div className="font-semibold">{summary.participants.length}人</div>
                </div>
                
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 mx-auto mb-2 text-orange-600" />
                  <div className="text-sm text-gray-600">決定事項</div>
                  <div className="font-semibold">{summary.decisions.length}件</div>
                </div>
                
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <Target className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                  <div className="text-sm text-gray-600">アクション</div>
                  <div className="font-semibold">{summary.actionItems.length}件</div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">会議サマリー</h4>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm">{summary.summary}</p>
                </div>
              </div>

              {summary.participants.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">参加者</h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.participants.map((participant, index) => (
                      <Badge key={index} variant="outline">
                        {participant}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* 要点タブ */}
            <TabsContent value="keypoints" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">重要ポイント</h4>
                {summary.keyPoints.length > 0 ? (
                  <div className="space-y-2">
                    {summary.keyPoints.map((point, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium mt-0.5">
                          {index + 1}
                        </div>
                        <div className="flex-1 text-sm">{point}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>重要ポイントが見つかりませんでした</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 決定事項タブ */}
            <TabsContent value="decisions" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">決定事項</h4>
                {summary.decisions.length > 0 ? (
                  <div className="space-y-2">
                    {summary.decisions.map((decision, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-green-50">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 text-sm">{decision}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>決定事項が見つかりませんでした</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* アクションアイテムタブ */}
            <TabsContent value="actions" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">アクションアイテム</h4>
                {summary.actionItems.length > 0 ? (
                  <div className="space-y-2">
                    {summary.actionItems.map((action, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-orange-50">
                        <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 text-sm">{action}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>アクションアイテムが見つかりませんでした</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* キーワードタブ */}
            <TabsContent value="keywords" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">重要キーワード</h4>
                {keywords.length > 0 ? (
                  <div className="space-y-4">
                    {/* キーワードクラウド */}
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((keyword, index) => (
                        <Badge 
                          key={index} 
                          className={`${getKeywordColor(keyword.score, keywords[0]?.score || 1)} text-xs`}
                          variant="secondary"
                        >
                          {keyword.word} ({keyword.frequency})
                        </Badge>
                      ))}
                    </div>

                    {/* キーワードランキング */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium">キーワードランキング</h5>
                      {keywords.slice(0, 10).map((keyword, index) => (
                        <div key={index} className="flex items-center gap-3 p-2 border rounded">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{keyword.word}</div>
                            <div className="text-xs text-gray-600">
                              出現回数: {keyword.frequency} | スコア: {keyword.score.toFixed(1)}
                            </div>
                          </div>
                          <div className="text-right">
                            <Progress 
                              value={(keyword.score / keywords[0].score) * 100} 
                              className="w-16 h-2"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>キーワードを分析中...</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* 結果が空の場合のメッセージ */}
        {!isAnalyzing && transcript && !summary && (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>要約を生成するには「要約を生成」ボタンをクリックしてください</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
