"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUploadForm } from "./file-upload-form"
import { RealtimeTranscription } from "./realtime-transcription"
import { RecordingManager } from "./recording-manager"
import { Mic, Upload, Radio, HardDrive } from "lucide-react"

export function TranscriptionTabs() {
  const [activeTab, setActiveTab] = useState("upload")

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            ファイルアップロード
          </TabsTrigger>
          <TabsTrigger value="realtime" className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            リアルタイム文字起こし
          </TabsTrigger>
          <TabsTrigger value="recording" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            リアルタイム録音
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            録音データ管理
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
                <Radio className="h-5 w-5" />
                リアルタイム文字起こし
              </CardTitle>
              <CardDescription>マイクを使ってリアルタイムで音声を文字起こしします</CardDescription>
            </CardHeader>
            <CardContent>
              <RealtimeTranscription />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recording" className="space-y-6">
          <Card className="backdrop-blur-sm bg-white/10 border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                リアルタイム録音
              </CardTitle>
              <CardDescription>マイクを使ってリアルタイムで録音・保存・文字起こしを行います</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-2">リアルタイム録音機能</p>
                  <p className="text-sm text-gray-500">
                    録音と同時にチャンク処理と文字起こしを行い、<br />
                    IndexedDBに自動保存されます。
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">主な機能</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• リアルタイム録音</li>
                      <li>• チャンク分割処理</li>
                      <li>• 自動データ保存</li>
                      <li>• 文字起こし対応</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">データ保存</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• IndexedDB使用</li>
                      <li>• ブラウザ内保存</li>
                      <li>• エクスポート可能</li>
                      <li>• 管理画面あり</li>
                    </ul>
                  </div>
                </div>
                
                <div className="text-center">
                  <p className="text-sm text-blue-600">
                    「録音データ管理」タブで過去の録音を確認できます
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <RecordingManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TranscriptionTabs
