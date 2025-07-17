"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { 
  Trash2, 
  Download, 
  Play, 
  Pause, 
  Volume2, 
  Clock, 
  HardDrive,
  Upload,
  Settings,
  FileText
} from "lucide-react"
import { RecordingStorage, RecordingMetadata } from "@/lib/recording-storage"
import { useToast } from "@/hooks/use-toast"

interface RecordingManagerProps {
  onRecordingSelect?: (id: string) => void
}

export function RecordingManager({ onRecordingSelect }: RecordingManagerProps) {
  const [recordings, setRecordings] = useState<RecordingMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map())
  const [storageInfo, setStorageInfo] = useState<{
    usedBytes: number
    totalBytes: number
    percentage: number
  } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadRecordings()
    loadStorageInfo()
  }, [])

  const loadRecordings = async () => {
    try {
      setLoading(true)
      const recordingList = RecordingStorage.getRecordingList()
      setRecordings(recordingList)
    } catch (error) {
      console.error('録音リストの読み込みに失敗:', error)
      toast({
        title: "エラー",
        description: "録音リストの読み込みに失敗しました",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadStorageInfo = async () => {
    try {
      const info = await RecordingStorage.getStorageUsage()
      setStorageInfo(info)
    } catch (error) {
      console.error('ストレージ情報の取得に失敗:', error)
    }
  }

  const handlePlay = async (id: string) => {
    try {
      // 他の音声を停止
      audioElements.forEach((audio, audioId) => {
        if (audioId !== id) {
          audio.pause()
        }
      })

      let audio = audioElements.get(id)
      if (!audio) {
        // 録音データを取得
        const recordingData = await RecordingStorage.getRecording(id)
        if (!recordingData) {
          throw new Error('録音データが見つかりません')
        }

        // 新しいAudioElementを作成
        audio = new Audio(URL.createObjectURL(recordingData.audioBlob))
        audio.onended = () => {
          setPlayingId(null)
        }
        audio.onerror = () => {
          toast({
            title: "再生エラー",
            description: "音声の再生に失敗しました",
            variant: "destructive",
          })
          setPlayingId(null)
        }
        
        const newAudioElements = new Map(audioElements)
        newAudioElements.set(id, audio)
        setAudioElements(newAudioElements)
      }

      if (playingId === id) {
        audio.pause()
        setPlayingId(null)
      } else {
        await audio.play()
        setPlayingId(id)
      }
    } catch (error) {
      console.error('再生に失敗:', error)
      toast({
        title: "再生エラー",
        description: "音声の再生に失敗しました",
        variant: "destructive",
      })
    }
  }

  const handleDownload = async (id: string, name: string) => {
    try {
      const recordingData = await RecordingStorage.getRecording(id)
      if (!recordingData) {
        throw new Error('録音データが見つかりません')
      }

      const url = URL.createObjectURL(recordingData.audioBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "ダウンロード完了",
        description: "録音ファイルをダウンロードしました",
      })
    } catch (error) {
      console.error('ダウンロードに失敗:', error)
      toast({
        title: "ダウンロードエラー",
        description: "ファイルのダウンロードに失敗しました",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await RecordingStorage.deleteRecording(id)
      
      // オーディオ要素をクリーンアップ
      const audio = audioElements.get(id)
      if (audio) {
        audio.pause()
        const newAudioElements = new Map(audioElements)
        newAudioElements.delete(id)
        setAudioElements(newAudioElements)
      }

      if (playingId === id) {
        setPlayingId(null)
      }

      await loadRecordings()
      await loadStorageInfo()
      
      toast({
        title: "削除完了",
        description: "録音を削除しました",
      })
    } catch (error) {
      console.error('削除に失敗:', error)
      toast({
        title: "削除エラー",
        description: "録音の削除に失敗しました",
        variant: "destructive",
      })
    }
  }

  const handleExport = async () => {
    try {
      await RecordingStorage.exportRecordings()
      toast({
        title: "エクスポート完了",
        description: "録音データをエクスポートしました",
      })
    } catch (error) {
      console.error('エクスポートに失敗:', error)
      toast({
        title: "エクスポートエラー",
        description: "データのエクスポートに失敗しました",
        variant: "destructive",
      })
    }
  }

  const handleClearAll = async () => {
    try {
      await RecordingStorage.clearAll()
      
      // 全てのオーディオ要素をクリーンアップ
      audioElements.forEach(audio => audio.pause())
      setAudioElements(new Map())
      setPlayingId(null)

      await loadRecordings()
      await loadStorageInfo()
      
      toast({
        title: "クリア完了",
        description: "全ての録音データを削除しました",
      })
    } catch (error) {
      console.error('クリアに失敗:', error)
      toast({
        title: "クリアエラー",
        description: "データのクリアに失敗しました",
        variant: "destructive",
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">読み込み中...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* ストレージ情報 */}
      {storageInfo && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              ストレージ使用量
            </CardTitle>
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-1" />
                  設定
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>録音データ管理</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <Button onClick={handleExport} className="w-full">
                      <Download className="w-4 h-4 mr-2" />
                      全データをエクスポート
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                          <Trash2 className="w-4 h-4 mr-2" />
                          全データを削除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>全データを削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>
                            この操作は元に戻せません。全ての録音データが完全に削除されます。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearAll}>
                            削除する
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>使用量: {formatFileSize(storageInfo.usedBytes)}</span>
                <span>容量: {formatFileSize(storageInfo.totalBytes)}</span>
              </div>
              <Progress value={storageInfo.percentage} className="h-2" />
              <div className="text-xs text-gray-500 text-center">
                {storageInfo.percentage.toFixed(1)}% 使用中
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 録音リスト */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            保存された録音 ({recordings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recordings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              録音データがありません
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{recording.name}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(recording.duration)}
                      </span>
                      <span>{formatFileSize(recording.fileSize)}</span>
                      <span>{recording.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePlay(recording.id)}
                    >
                      {playingId === recording.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    
                    {onRecordingSelect && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRecordingSelect(recording.id)}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(recording.id, recording.name)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>録音を削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>
                            「{recording.name}」を削除します。この操作は元に戻せません。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(recording.id)}>
                            削除する
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default RecordingManager
