"use client"

import { Badge } from "@/components/ui/badge"
import { Mic, Globe, Key, Zap } from "lucide-react"
import { useApiConfig } from "@/contexts/api-config-context"

const API_INFO = {
  webspeech: {
    name: "Web Speech API",
    icon: Mic,
    color: "bg-green-100 text-green-800",
    description: "ブラウザ内蔵・無料"
  },
  openai: {
    name: "OpenAI Whisper",
    icon: Key,
    color: "bg-blue-100 text-blue-800",
    description: "高精度・有料"
  },
  assemblyai: {
    name: "AssemblyAI",
    icon: Zap,
    color: "bg-purple-100 text-purple-800",
    description: "月5時間無料"
  },
  azure: {
    name: "Azure Speech",
    icon: Globe,
    color: "bg-orange-100 text-orange-800",
    description: "月5時間無料"
  },
  offline: {
    name: "オフライン処理",
    icon: Globe,
    color: "bg-gray-100 text-gray-800",
    description: "完全無料・オフライン"
  }
}

export default function ApiStatusBadge() {
  const { apiConfig } = useApiConfig()
  const apiInfo = API_INFO[apiConfig.provider]
  const Icon = apiInfo.icon

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={`${apiInfo.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {apiInfo.name}
      </Badge>
      <span className="text-xs text-gray-500">{apiInfo.description}</span>
    </div>
  )
}
