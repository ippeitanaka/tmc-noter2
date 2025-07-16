"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Heart, Github, Mail } from "lucide-react"

export function Footer() {
  return (
    <footer className="mt-16 border-t bg-gradient-to-r from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-white/50 backdrop-blur-sm border-white/60">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* ブランド情報 */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800">TMC Noter</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  AI技術を活用した高精度な音声文字起こしと自動議事録生成システム。
                  会議の効率化と記録の品質向上をサポートします。
                </p>
              </div>

              {/* 技術情報 */}
              <div className="space-y-3">
                <h4 className="text-md font-medium text-gray-800">技術スタック</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Next.js 14 (App Router)</li>
                  <li>• OpenAI Whisper API</li>
                  <li>• Gemini AI / DeepSeek AI</li>
                  <li>• Supabase Database</li>
                  <li>• Tailwind CSS</li>
                </ul>
              </div>

              {/* 連絡先・リンク */}
              <div className="space-y-3">
                <h4 className="text-md font-medium text-gray-800">サポート</h4>
                <div className="flex flex-col space-y-2">
                  <a
                    href="mailto:support@tmc-noter.com"
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    サポートに連絡
                  </a>
                  <a
                    href="https://github.com/tmc-dx/noter"
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="h-4 w-4" />
                    GitHub
                  </a>
                </div>
              </div>
            </div>

            {/* 区切り線 */}
            <div className="border-t border-gray-200 mt-6 pt-6">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Made with</span>
                  <Heart className="h-4 w-4 text-red-500" />
                  <span>by TMC DX Committee</span>
                </div>

                <div className="text-sm text-gray-500">© 2025 TMC DX Committee. All rights reserved.</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </footer>
  )
}

export default Footer
