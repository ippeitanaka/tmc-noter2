"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUploadForm } from "./file-upload-form"
import { RealtimeTranscription } from "./realtime-transcription"
import { Mic, Upload } from "lucide-react"

export function TranscriptionTabs() {
  const [activeTab, setActiveTab] = useState("upload")

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            ファイルアップロード
          </TabsTrigger>
          <TabsTrigger value="realtime" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            リアルタイム録音
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card className="backdrop-blur-sm bg-white/10 border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                音声ファイルをアップロード
              </CardTitle>
              <CardDescription>音声ファイルをアップロードして文字起こしと議事録を生成します</CardDescription>
            </CardHeader>
            <CardContent>
              <FileUploadForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="realtime" className="space-y-6">
          <Card className="backdrop-blur-sm bg-white/10 border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                リアルタイム録音
              </CardTitle>
              <CardDescription>マイクを使ってリアルタイムで録音・文字起こしを行います</CardDescription>
            </CardHeader>
            <CardContent>
              <RealtimeTranscription />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TranscriptionTabs
