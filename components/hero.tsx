"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Mic, FileText, Zap, Shield } from "lucide-react"
import Image from "next/image"

/**
 * SVG dot-grid pattern encoded as a data-URI.
 * Wrapping this in encodeURIComponent keeps the JSX parser happy.
 */
const DOT_GRID =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
       <g fill="none" fillRule="evenodd">
         <g fill="#ffffff" fillOpacity="0.05">
           <circle cx="30" cy="30" r="4" />
         </g>
       </g>
     </svg>`,
  )

function Hero() {
  return (
    <div className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 opacity-90" />

      {/* Dot-grid overlay */}
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url("${DOT_GRID}")` }} aria-hidden />

      <div className="relative container mx-auto px-4 py-16 sm:py-24">
        <div className="text-center space-y-8">
          {/* Logo and title */}
          <div className="space-y-6 animate-fade-in-up">
            <div className="flex justify-center">
              <Image
                src="/images/tmc-noter-logo.png"
                alt="TMC Noter Logo"
                width={400}
                height={200}
                className="w-auto h-32 sm:h-40 lg:h-48"
                priority
              />
            </div>
            <p className="text-xl sm:text-2xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
              AI技術を活用した高精度な音声文字起こしと
              <br className="hidden sm:block" />
              自動議事録生成システム
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 animate-fade-in-up">
            {[
              {
                icon: <Mic className="h-6 w-6 text-white" />,
                title: "高精度音声認識",
                desc: "OpenAI Whisper APIによる正確な文字起こし",
                color: "bg-blue-500",
              },
              {
                icon: <FileText className="h-6 w-6 text-white" />,
                title: "自動議事録生成",
                desc: "AI技術による構造化された議事録の自動作成",
                color: "bg-indigo-500",
              },
              {
                icon: <Zap className="h-6 w-6 text-white" />,
                title: "リアルタイム処理",
                desc: "会議中のリアルタイム文字起こしに対応",
                color: "bg-purple-500",
              },
              {
                icon: <Shield className="h-6 w-6 text-white" />,
                title: "セキュア",
                desc: "企業レベルのセキュリティで安心してご利用",
                color: "bg-green-500",
              },
            ].map(({ icon, title, desc, color }) => (
              <Card
                key={title}
                className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 transition-colors duration-300"
              >
                <CardContent className="p-6 text-center">
                  <div className={`${color} w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4`}>
                    {icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                  <p className="text-blue-100 text-sm">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Supported formats */}
          <div className="mt-12 p-6 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 animate-fade-in-up">
            <h3 className="text-lg font-semibold text-white mb-3">対応ファイル形式</h3>
            <p className="text-blue-100">MP3, WAV, M4A, FLAC, OGG, WEBM (最大10MB)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export { Hero }
export default Hero
