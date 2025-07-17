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
import { useRecording } from '@/contexts/recording-context'
import { EditableTranscript } from './editable-transcript'
import { useToast } from '@/hooks/use-toast'

interface RealtimeRecordingProps {
  onRecordingComplete?: (audioBlob: Blob) => void
}

export default function RealtimeRecording({ 
  onRecordingComplete
}: RealtimeRecordingProps) {
  const { 
    recordingState, 
    chunks, 
    transcript, 
    isRecording,
    startRecording, 
    stopRecording, 
    pauseRecording, 
    resumeRecording,
    saveRecording,
    clearRecording,
    updateTranscript,
    audioBlob
  } = useRecording()
  
  const [recordingName, setRecordingName] = useState("")
  const [autoSave, setAutoSave] = useState(true)
  const [enableTranscription, setEnableTranscription] = useState(true)
  const [enableSpeakerID, setEnableSpeakerID] = useState(false)
  const [chunkDuration, setChunkDuration] = useState(30)
  const [showSettings, setShowSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [speechRecognition, setSpeechRecognition] = useState<any>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // デフォルト録音名を設定
    const now = new Date()
    const defaultName = `録音_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`
    setRecordingName(defaultName)

    // Web Speech APIの初期化
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'ja-JP'
      
      recognition.onresult = (event: any) => {
        let interimTranscript = ''
        let finalTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }
        
        if (finalTranscript) {
          updateTranscript(transcript + (transcript ? ' ' : '') + finalTranscript)
        }
      }
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsTranscribing(false)
      }
      
      recognition.onend = () => {
        setIsTranscribing(false)
      }
      
      setSpeechRecognition(recognition)
    }
  }, [])

  const handleStartRecording = async () => {
    try {
      const config = {
        chunkDuration,
        enableRealTimeTranscription: enableTranscription,
        enableSpeakerIdentification: enableSpeakerID,
        autoSave,
        recordingName: recordingName || undefined
      }

      const success = await startRecording(config)
      if (success) {
        setError(null)
        clearRecording()
        
        // リアルタイム文字起こしを開始
        if (enableTranscription && speechRecognition) {
          try {
            speechRecognition.start()
            setIsTranscribing(true)
          } catch (error) {
            console.error('Speech recognition start error:', error)
          }
        }
        
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
    try {
      setIsSaving(true)
      
      // リアルタイム文字起こしを停止
      if (speechRecognition && isTranscribing) {
        speechRecognition.stop()
        setIsTranscribing(false)
      }
      
      await stopRecording()
      
      // 録音完了時の処理
      if (onRecordingComplete && audioBlob) {
        onRecordingComplete(audioBlob)
      }
      
      toast({
        title: "録音停止",
        description: chunks.length > 0 
          ? (autoSave ? "録音を停止し、データを保存しました" : "録音を停止しました")
          : "録音を停止しました（録音データが検出されませんでした）",
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

  const handlePauseRecording = () => {
    pauseRecording()
  }

  const handleResumeRecording = () => {
    resumeRecording()
  }

  const handleManualSave = async () => {
    if (chunks.length > 0) {
      try {
        setIsSaving(true)
        await saveRecording(recordingName)
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

  // 録音データをダウンロード
  const downloadRecording = async () => {
    if (audioBlob) {
      try {
        const url = URL.createObjectURL(audioBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `recording_${new Date().toISOString().split('T')[0]}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        toast({
          title: "ダウンロード完了",
          description: "録音データをダウンロードしました",
        })
      } catch (error) {
        console.error('Download failed:', error)
        toast({
          title: "ダウンロードエラー",
          description: "録音データのダウンロードに失敗しました",
          variant: "destructive",
        })
      }
    } else {
      toast({
        title: "ダウンロード不可",
        description: "ダウンロード可能な録音データがありません",
        variant: "destructive",
      })
    }
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
        {isRecording && (
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
                
                {enableTranscription && (
                  <Badge variant={isTranscribing ? "default" : "secondary"}>
                    {isTranscribing ? "文字起こし中" : "文字起こし停止中"}
                  </Badge>
                )}
              </div>

              <div className="text-sm text-gray-600">
                {recordingState.isPaused ? '一時停止中' : '録音中'}
              </div>
            </div>

            {/* 音声レベル表示（簡易版） */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                <span className="text-sm">音声レベル</span>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${recordingState.audioLevel}%` }}
                  />
                </div>
                <div className="text-sm text-gray-600">
                  {recordingState.audioLevel.toFixed(0)}%
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
        {enableTranscription && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>文字起こし結果</Label>
              {isTranscribing && (
                <div className="flex items-center gap-1 text-xs text-blue-600">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                  リアルタイム文字起こし中
                </div>
              )}
            </div>
            {transcript ? (
              <EditableTranscript
                initialText={transcript}
                onSave={(text: string) => updateTranscript(text)}
              />
            ) : (
              <div className="p-4 border rounded-lg bg-gray-50 text-gray-500 text-center">
                {enableTranscription ? "音声を検出すると文字起こしが開始されます" : "設定で文字起こしを有効にしてください"}
              </div>
            )}
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
