"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Edit3, Save, X, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface EditableTranscriptProps {
  initialText: string
  title?: string
  onSave?: (text: string) => void
  readOnly?: boolean
}

export function EditableTranscript({ 
  initialText, 
  title = "文字起こし", 
  onSave,
  readOnly = false 
}: EditableTranscriptProps) {
  const [text, setText] = useState(initialText)
  const [isEditing, setIsEditing] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    setText(initialText)
    setHasChanges(false)
  }, [initialText])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      // カーソルを最後に移動
      const length = text.length
      textareaRef.current.setSelectionRange(length, length)
    }
  }, [isEditing, text])

  const handleTextChange = (value: string) => {
    setText(value)
    setHasChanges(value !== initialText)
  }

  const handleSave = () => {
    if (onSave) {
      onSave(text)
    }
    setIsEditing(false)
    setHasChanges(false)
    toast({
      title: "保存完了",
      description: "テキストが保存されました",
    })
  }

  const handleCancel = () => {
    setText(initialText)
    setIsEditing(false)
    setHasChanges(false)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "コピー完了",
        description: "テキストをクリップボードにコピーしました",
      })
    } catch (error) {
      toast({
        title: "コピー失敗",
        description: "クリップボードへのアクセスに失敗しました",
        variant: "destructive",
      })
    }
  }

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast({
      title: "ダウンロード完了",
      description: "テキストファイルをダウンロードしました",
    })
  }

  const wordCount = text.length
  const lineCount = text.split('\n').length

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="flex items-center gap-1"
            >
              <Copy className="w-4 h-4" />
              コピー
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="flex items-center gap-1"
            >
              <Download className="w-4 h-4" />
              ダウンロード
            </Button>
            {!readOnly && (
              <>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1"
                  >
                    <Edit3 className="w-4 h-4" />
                    編集
                  </Button>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSave}
                      disabled={!hasChanges}
                      className="flex items-center gap-1"
                    >
                      <Save className="w-4 h-4" />
                      保存
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      className="flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      キャンセル
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex text-sm text-gray-500 gap-4">
          <span>{wordCount}文字</span>
          <span>{lineCount}行</span>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              placeholder="テキストを入力してください..."
            />
            {hasChanges && (
              <p className="text-sm text-amber-600">
                未保存の変更があります
              </p>
            )}
          </div>
        ) : (
          <div className="border rounded-md p-4 bg-gray-50">
            <pre className="whitespace-pre-wrap text-sm font-mono text-gray-700 leading-relaxed">
              {text || "テキストがありません"}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface TranscriptEditorProps {
  transcript: string
  onTranscriptChange: (text: string) => void
  isRealtime?: boolean
}

export function TranscriptEditor({ 
  transcript, 
  onTranscriptChange, 
  isRealtime = false 
}: TranscriptEditorProps) {
  const [savedTranscript, setSavedTranscript] = useState(transcript)

  const handleSave = (text: string) => {
    setSavedTranscript(text)
    onTranscriptChange(text)
  }

  return (
    <EditableTranscript
      initialText={transcript}
      title={isRealtime ? "リアルタイム文字起こし" : "文字起こし"}
      onSave={handleSave}
      readOnly={isRealtime}
    />
  )
}

export default EditableTranscript
