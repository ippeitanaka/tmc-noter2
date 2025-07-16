"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoIcon, ChevronDown, ChevronUp } from "lucide-react"

export default function WhisperGuide() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Card className="mt-4 border-l-4 border-l-blue-500">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <InfoIcon className="h-5 w-5 text-blue-500 mr-2" />
            <CardTitle className="text-lg">WhisperAPIを使った文字起こしについて</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription>OpenAI WhisperAPIを使用した高精度な文字起こしが利用可能です</CardDescription>
      </CardHeader>

      {isOpen && (
        <>
          <CardContent className="pt-0">
            <div className="space-y-2 text-sm">
              <p>
                このアプリはOpenAIのWhisperAPIを使用して高精度な文字起こしを提供しています。
                以下の点に注意してご利用ください：
              </p>

              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>ファイルサイズ制限：</strong> WhisperAPIは25MBまでのファイルを処理できます。
                  それ以上のサイズのファイルは自動的に圧縮されます。
                </li>
                <li>
                  <strong>対応形式：</strong> mp3, wav, m4a, flac, ogg, webm形式の音声ファイルに対応しています。
                </li>
                <li>
                  <strong>処理時間：</strong> ファイルサイズによって処理時間が変わります。
                  大きなファイルほど時間がかかります。
                </li>
                <li>
                  <strong>APIクレジット：</strong> 文字起こしにはOpenAIのAPIクレジットが消費されます。
                  使用量はファイルサイズに比例します。
                </li>
              </ul>

              <p className="text-blue-600">
                最良の結果を得るためには、ノイズの少ない明瞭な音声ファイルを使用してください。
                また、OPENAI_API_KEYが正しく設定されていることを確認してください。
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <p className="text-xs text-gray-500">
              詳細は
              <a
                href="https://platform.openai.com/docs/guides/speech-to-text"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                OpenAIのドキュメント
              </a>
              をご参照ください。
            </p>
          </CardFooter>
        </>
      )}
    </Card>
  )
}
