// リアルタイム録音UIコンポーネント
"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  Settings,
  Download,
  AlertCircle,
  Save
} from 'lucide-react'
import { 
  RealtimeRecorder, 
  RecordingState, 
  RecordingChunk, 
  RecordingConfig 
} from '@/lib/realtime-recorder'
import { EditableTranscript } from './editable-transcript'
import { useToast } from '@/hooks/use-toast'

interface RealtimeRecordingProps {
  onRecordingComplete?: (audioBlob: Blob) => void
  onChunkTranscribed?: (chunk: RecordingChunk, transcription: string) => void
}

export default function RealtimeRecording({ 
  onRecordingComplete, 
  onChunkTranscribed 
}: RealtimeRecordingProps) {
  const [recorder, setRecorder] = useState<RealtimeRecorder | null>(null)
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    currentChunk: 0,
    totalChunks: 0,
    audioLevel: 0
  })
  const [transcript, setTranscript] = useState("")
  const [recordingName, setRecordingName] = useState("")
  const [autoSave, setAutoSave] = useState(true)
  const [enableTranscription, setEnableTranscription] = useState(true)
  const [enableSpeakerID, setEnableSpeakerID] = useState(false)
  const [chunkDuration, setChunkDuration] = useState(30)
  const [showSettings, setShowSettings] = useState(false)
  const [chunks, setChunks] = useState<RecordingChunk[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [audioLevelData, setAudioLevelData] = useState({ level: 0, bars: Array(10).fill(0) })
  const animationRef = useRef<number>(0)
  const { toast } = useToast()

  useEffect(() => {
    // デフォルト録音名を設定
    const now = new Date()
    const defaultName = `録音_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`
    setRecordingName(defaultName)

    return () => {
      if (recorder) {
        recorder.cleanup()
      }
    }
  }, [recorder])

  const handleStartRecording = async () => {
    try {
      const newRecorder = new RealtimeRecorder({
        chunkDuration,
        enableRealTimeTranscription: enableTranscription,
        enableSpeakerIdentification: enableSpeakerID,
        autoSave,
        recordingName: recordingName || undefined
      })

      newRecorder.setEventListeners({
        onStateChange: (state) => {
          setRecordingState(state)
        },
        onChunkComplete: (chunk) => {
          setChunks(prev => [...prev, chunk])
          if (chunk.transcription) {
            setTranscript(prev => prev + (prev ? '\n' : '') + chunk.transcription)
          }
          if (onChunkTranscribed) {
            onChunkTranscribed(chunk, chunk.transcription || '')
          }
        },
        onError: (error) => {
          setError(error.message)
          toast({
            title: "録音エラー",
            description: error.message,
            variant: "destructive",
          })
        }
      })

      const success = await newRecorder.startRecording()
      if (success) {
        setRecorder(newRecorder)
        setError(null)
        setTranscript("")
        setChunks([])
        toast({
          title: "録音開始",
          description: "録音を開始しました",
        })
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "録音開始に失敗しました")
      toast({
        title: "録音エラー",
        description: "録音を開始できませんでした",
        variant: "destructive",
      })
    }
  }

  const handleStopRecording = async () => {
    if (recorder) {
      try {
        setIsSaving(true)
        await recorder.stopRecording()
        
        if (onRecordingComplete) {
          const combinedBlob = await recorder.combineChunks()
          onRecordingComplete(combinedBlob)
        }
        
        toast({
          title: "録音停止",
          description: autoSave ? "録音を停止し、データを保存しました" : "録音を停止しました",
        })
      } catch (error) {
        console.error("録音停止エラー:", error)
        toast({
          title: "録音停止エラー",
          description: "録音の停止に失敗しました",
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handlePauseRecording = () => {
    if (recorder) {
      recorder.pauseRecording()
    }
  }

  const handleResumeRecording = () => {
    if (recorder) {
      recorder.resumeRecording()
    }
  }

  const handleManualSave = async () => {
    if (recorder && chunks.length > 0) {
      try {
        setIsSaving(true)
        await recorder.saveRecording(recordingName)
        toast({
          title: "保存完了",
          description: "録音データを保存しました",
        })
      } catch (error) {
        console.error("手動保存エラー:", error)
        toast({
          title: "保存エラー",
          description: "録音データの保存に失敗しました",
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
      }
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 音声レベルのアニメーション
  useEffect(() => {
    if (recordingState.isRecording && !recordingState.isPaused && recorder) {
      const updateAudioLevel = () => {
        const levelData = recorder.getAudioLevelData()
        setAudioLevelData(levelData)
        animationRef.current = requestAnimationFrame(updateAudioLevel)
      }
      animationRef.current = requestAnimationFrame(updateAudioLevel)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [recordingState.isRecording, recordingState.isPaused, recorder])

  // マイク権限を確認
  const checkMicrophonePermission = async () => {
    try {
      if (recorder) {
        const hasAccess = await recorder.requestMicrophoneAccess()
        setMicrophonePermission(hasAccess ? 'granted' : 'denied')
        return hasAccess
      }
      return false
    } catch (error) {
      setMicrophonePermission('denied')
      return false
    }
  }

  // 録音データをダウンロード
  const downloadRecording = async () => {
    if (recorder) {
      try {
        const combinedBlob = await recorder.combineChunks()
        const url = URL.createObjectURL(combinedBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `recording_${new Date().toISOString().split('T')[0]}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error('Download failed:', error)
      }
    }
  }

  // 音声レベルバーを表示
  const renderAudioLevelBars = () => {
    return (
      <div className="flex items-end gap-1 h-12">
        {audioLevelData.bars.map((level, index) => (
          <div
            key={index}
            className={`w-2 bg-gradient-to-t transition-all duration-100 ${
              level > 60 ? 'from-green-400 to-red-500' :
              level > 30 ? 'from-green-400 to-yellow-500' :
              'from-green-400 to-green-600'
            }`}
            style={{ height: `${Math.max(2, (level / 100) * 48)}px` }}
          />
        ))}
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          リアルタイム録音
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* マイク権限の確認 */}
        {microphonePermission === 'denied' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              マイクへのアクセスが拒否されました。ブラウザの設定でマイクのアクセスを許可してください。
            </AlertDescription>
          </Alert>
        )}

        {/* 録音設定 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="recordingName">録音名</Label>
            <Input
              id="recordingName"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              disabled={recordingState.isRecording}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="autoSave"
                checked={autoSave}
                onCheckedChange={setAutoSave}
                disabled={recordingState.isRecording}
              />
              <Label htmlFor="autoSave">自動保存</Label>
            </div>
            <Button
              onClick={() => setShowSettings(!showSettings)}
              variant="outline"
              size="sm"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 録音コントロール */}
        <div className="flex items-center gap-4">
          {!recordingState.isRecording ? (
            <Button
              onClick={handleStartRecording}
              disabled={microphonePermission === 'denied'}
              className="flex items-center gap-2"
            >
              <Mic className="w-4 h-4" />
              録音開始
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              {recordingState.isPaused ? (
                <Button
                  onClick={handleResumeRecording}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  再開
                </Button>
              ) : (
                <Button
                  onClick={handlePauseRecording}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Pause className="w-4 h-4" />
                  一時停止
                </Button>
              )}
              
              <Button
                onClick={handleStopRecording}
                variant="destructive"
                className="flex items-center gap-2"
                disabled={isSaving}
              >
                <Square className="w-4 h-4" />
                {isSaving ? "保存中..." : "停止"}
              </Button>

              {!autoSave && (
                <Button
                  onClick={handleManualSave}
                  variant="outline"
                  className="flex items-center gap-2"
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4" />
                  保存
                </Button>
              )}
            </div>
          )}
        </div>

        {/* 録音状態表示 */}
        {recordingState.isRecording && (
          <div className="space-y-4">
            {/* 録音時間とステータス */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    recordingState.isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'
                  }`} />
                  <span className="font-mono text-lg">
                    {formatDuration(recordingState.duration)}
                  </span>
                </div>
                
                <Badge variant="outline">
                  チャンク {recordingState.currentChunk + 1}
                </Badge>
              </div>

              <div className="text-sm text-gray-600">
                {recordingState.isPaused ? '一時停止中' : '録音中'}
              </div>
            </div>

            {/* 音声レベル可視化 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                <span className="text-sm">音声レベル</span>
              </div>
              
              <div className="flex items-center gap-4">
                {renderAudioLevelBars()}
                <div className="text-sm text-gray-600">
                  {audioLevelData.level.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 設定パネル */}
        {showSettings && (
          <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
            <h4 className="font-medium">録音設定</h4>
            
            <div className="space-y-3">
              <div>
                <Label>チャンク時間: {chunkDuration}秒</Label>
                <Slider
                  value={[chunkDuration]}
                  onValueChange={([value]) => setChunkDuration(value)}
                  min={10}
                  max={60}
                  step={5}
                  className="w-full"
                  disabled={recordingState.isRecording}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableTranscription"
                    checked={enableTranscription}
                    onCheckedChange={setEnableTranscription}
                    disabled={recordingState.isRecording}
                  />
                  <Label htmlFor="enableTranscription">リアルタイム文字起こし</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableSpeakerID"
                    checked={enableSpeakerID}
                    onCheckedChange={setEnableSpeakerID}
                    disabled={recordingState.isRecording}
                  />
                  <Label htmlFor="enableSpeakerID">話者識別</Label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 文字起こし結果 */}
        {enableTranscription && transcript && (
          <div className="space-y-2">
            <Label>文字起こし結果</Label>
            <EditableTranscript
              initialText={transcript}
              onSave={(text: string) => setTranscript(text)}
            />
          </div>
        )}

        {/* チャンク一覧 */}
        {chunks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">録音チャンク ({chunks.length})</h4>
              <Button
                onClick={downloadRecording}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                ダウンロード
              </Button>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-2">
              {chunks.map((chunk, index) => (
                <div 
                  key={chunk.id}
                  className="flex items-center justify-between p-2 border rounded text-sm"
                >
                  <div>
                    <span className="font-medium">チャンク {index + 1}</span>
                    <span className="text-gray-600 ml-2">
                      {new Date(chunk.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {(chunk.blob.size / 1024).toFixed(1)}KB
                    </Badge>
                    {chunk.transcription && (
                      <Badge variant="secondary" className="text-xs">
                        文字起こし済み
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 結果が空の場合のメッセージ */}
        {!recordingState.isRecording && chunks.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>録音を開始するには「録音開始」ボタンをクリックしてください</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
