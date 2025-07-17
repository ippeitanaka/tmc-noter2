"use client"

import { Badge } from "@/components/ui/badge"
import { Brain, Zap, Bot } from "lucide-react"
import { useAiConfig } from "@/contexts/ai-config-context"

const AI_INFO = {
  gemini: {
    name: "Google Gemini",
    icon: Brain,
    color: "bg-blue-100 text-blue-800",
    description: "月15回無料・推奨"
  },
  openai: {
    name: "OpenAI GPT",
    icon: Zap,
    color: "bg-green-100 text-green-800",
    description: "高精度・有料"
  },
  deepseek: {
    name: "DeepSeek",
    icon: Bot,
    color: "bg-purple-100 text-purple-800",
    description: "月500万トークン無料"
  }
}

export default function AiStatusBadge() {
  const { aiConfig } = useAiConfig()
  const aiInfo = AI_INFO[aiConfig.provider]
  const Icon = aiInfo.icon

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={`${aiInfo.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {aiInfo.name}
      </Badge>
      <span className="text-xs text-gray-500">{aiInfo.description}</span>
    </div>
  )
}
