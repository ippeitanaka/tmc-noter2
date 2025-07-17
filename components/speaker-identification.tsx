// 話者識別UIコンポーネント
"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Users, Edit2, Check, X, Volume2 } from 'lucide-react'
import { SpeakerProfile, SpeakerSegment, SpeakerIdentifier } from '@/lib/speaker-identification'

interface SpeakerIdentificationProps {
  audioBuffer: AudioBuffer | null
  transcript: string
  onSpeakerSegments: (segments: SpeakerSegment[]) => void
  onSpeakerProfiles: (profiles: SpeakerProfile[]) => void
}

export default function SpeakerIdentification({
  audioBuffer,
  transcript,
  onSpeakerSegments,
  onSpeakerProfiles
}: SpeakerIdentificationProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [speakers, setSpeakers] = useState<SpeakerProfile[]>([])
  const [segments, setSegments] = useState<SpeakerSegment[]>([])
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [identifier] = useState(() => new SpeakerIdentifier())

  // 話者識別を実行
  const analyzeSpeakers = async () => {
    if (!audioBuffer) return

    setIsAnalyzing(true)
    setProgress(0)

    try {
      // プログレスバーのシミュレーション
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      // 話者分割を実行
      const speakerSegments = await identifier.segmentSpeakers(audioBuffer)
      
      clearInterval(progressInterval)
      setProgress(100)

      // 結果を設定
      setSegments(speakerSegments)
      const speakerProfiles = identifier.getAllSpeakers()
      setSpeakers(speakerProfiles)

      // 親コンポーネントに結果を通知
      onSpeakerSegments(speakerSegments)
      onSpeakerProfiles(speakerProfiles)

    } catch (error) {
      console.error('Speaker analysis error:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 話者名を編集
  const startEditingSpeaker = (speakerId: string, currentName: string) => {
    setEditingSpeaker(speakerId)
    setEditingName(currentName)
  }

  // 話者名を保存
  const saveSpeakerName = () => {
    if (editingSpeaker && editingName.trim()) {
      identifier.updateSpeakerName(editingSpeaker, editingName.trim())
      
      // 状態を更新
      setSpeakers(prev => 
        prev.map(speaker => 
          speaker.id === editingSpeaker 
            ? { ...speaker, name: editingName.trim() }
            : speaker
        )
      )
      
      // 親コンポーネントに更新を通知
      onSpeakerProfiles(identifier.getAllSpeakers())
    }
    
    setEditingSpeaker(null)
    setEditingName('')
  }

  // 編集をキャンセル
  const cancelEditing = () => {
    setEditingSpeaker(null)
    setEditingName('')
  }

  // 話者別のセグメント統計を計算
  const getSpeakerStats = (speakerId: string) => {
    const speakerSegments = segments.filter(seg => seg.speakerId === speakerId)
    const totalDuration = speakerSegments.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0)
    const segmentCount = speakerSegments.length
    
    return {
      duration: totalDuration,
      segments: segmentCount,
      percentage: segments.length > 0 ? (totalDuration / audioBuffer!.duration) * 100 : 0
    }
  }

  // 時間をフォーマット
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          話者識別
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 分析開始ボタン */}
        <div className="flex items-center gap-4">
          <Button 
            onClick={analyzeSpeakers}
            disabled={!audioBuffer || isAnalyzing}
            className="flex items-center gap-2"
          >
            <Volume2 className="w-4 h-4" />
            {isAnalyzing ? '分析中...' : '話者を分析'}
          </Button>
          
          {audioBuffer && (
            <div className="text-sm text-gray-600">
              音声時間: {formatTime(audioBuffer.duration)}
            </div>
          )}
        </div>

        {/* プログレスバー */}
        {isAnalyzing && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <div className="text-sm text-gray-600 text-center">
              音声を分析中... {progress}%
            </div>
          </div>
        )}

        {/* 話者一覧 */}
        {speakers.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">
              識別された話者 ({speakers.length}人)
            </div>
            
            {speakers.map(speaker => {
              const stats = getSpeakerStats(speaker.id)
              
              return (
                <div 
                  key={speaker.id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  {/* 話者カラー */}
                  <div 
                    className="w-4 h-4 rounded-full border border-gray-300"
                    style={{ backgroundColor: speaker.color }}
                  />
                  
                  {/* 話者名 */}
                  <div className="flex-1">
                    {editingSpeaker === speaker.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="話者名を入力"
                          className="w-32"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') saveSpeakerName()
                            if (e.key === 'Escape') cancelEditing()
                          }}
                        />
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={saveSpeakerName}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={cancelEditing}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{speaker.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditingSpeaker(speaker.id, speaker.name)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* 統計情報 */}
                  <div className="text-right space-y-1">
                    <div className="text-sm text-gray-600">
                      {formatTime(stats.duration)} ({stats.percentage.toFixed(1)}%)
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {stats.segments} セグメント
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* セグメント一覧（詳細表示） */}
        {segments.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">
              話者セグメント ({segments.length}件)
            </div>
            
            <div className="max-h-60 overflow-y-auto space-y-2">
              {segments.map((segment, index) => {
                const speaker = speakers.find(s => s.id === segment.speakerId)
                
                return (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-2 border rounded text-sm"
                  >
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: speaker?.color || '#6B7280' }}
                    />
                    
                    <div className="flex-1">
                      <div className="font-medium">{speaker?.name || 'Unknown'}</div>
                      <div className="text-gray-600">
                        {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                      </div>
                    </div>
                    
                    <Badge variant="outline" className="text-xs">
                      {(segment.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 結果が空の場合のメッセージ */}
        {!isAnalyzing && audioBuffer && speakers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>話者を分析するには「話者を分析」ボタンをクリックしてください</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
