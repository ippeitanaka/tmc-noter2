// 議事録テンプレート機能
export interface MeetingTemplate {
  id: string
  name: string
  description: string
  sections: TemplateSection[]
  defaultSettings: TemplateSettings
}

export interface TemplateSection {
  id: string
  title: string
  type: 'text' | 'list' | 'table' | 'participants' | 'datetime' | 'summary'
  required: boolean
  placeholder?: string
  options?: string[]
}

export interface TemplateSettings {
  includeSpeakerNames: boolean
  includeTimestamps: boolean
  includeActionItems: boolean
  includeDecisions: boolean
  includeParticipants: boolean
  autoSummarize: boolean
}

export interface FilledTemplate {
  templateId: string
  templateName: string
  generatedAt: Date
  content: Record<string, any>
  rawTranscript: string
  summary?: any
}

export class MeetingTemplateManager {
  private templates: Map<string, MeetingTemplate> = new Map()

  constructor() {
    this.initializeDefaultTemplates()
  }

  // デフォルトテンプレートを初期化
  private initializeDefaultTemplates(): void {
    // 定例会議テンプレート
    const regularMeeting: MeetingTemplate = {
      id: 'regular-meeting',
      name: '定例会議',
      description: '週次・月次の定例会議用テンプレート',
      sections: [
        {
          id: 'meeting-info',
          title: '会議情報',
          type: 'datetime',
          required: true
        },
        {
          id: 'participants',
          title: '参加者',
          type: 'participants',
          required: true
        },
        {
          id: 'agenda',
          title: '議題',
          type: 'list',
          required: true,
          placeholder: '議題を入力してください'
        },
        {
          id: 'discussion',
          title: '議論内容',
          type: 'summary',
          required: true
        },
        {
          id: 'decisions',
          title: '決定事項',
          type: 'list',
          required: true
        },
        {
          id: 'action-items',
          title: 'アクションアイテム',
          type: 'table',
          required: true
        },
        {
          id: 'next-meeting',
          title: '次回会議',
          type: 'datetime',
          required: false
        }
      ],
      defaultSettings: {
        includeSpeakerNames: true,
        includeTimestamps: false,
        includeActionItems: true,
        includeDecisions: true,
        includeParticipants: true,
        autoSummarize: true
      }
    }

    // 企画会議テンプレート
    const planningMeeting: MeetingTemplate = {
      id: 'planning-meeting',
      name: '企画会議',
      description: '新規企画・プロジェクト企画用テンプレート',
      sections: [
        {
          id: 'meeting-info',
          title: '会議情報',
          type: 'datetime',
          required: true
        },
        {
          id: 'participants',
          title: '参加者',
          type: 'participants',
          required: true
        },
        {
          id: 'project-overview',
          title: '企画概要',
          type: 'text',
          required: true,
          placeholder: '企画の概要を記載してください'
        },
        {
          id: 'objectives',
          title: '目的・目標',
          type: 'list',
          required: true
        },
        {
          id: 'discussion-points',
          title: '検討事項',
          type: 'summary',
          required: true
        },
        {
          id: 'decisions',
          title: '決定事項',
          type: 'list',
          required: true
        },
        {
          id: 'risks',
          title: 'リスク・課題',
          type: 'list',
          required: false
        },
        {
          id: 'timeline',
          title: 'スケジュール',
          type: 'table',
          required: false
        },
        {
          id: 'action-items',
          title: 'アクションアイテム',
          type: 'table',
          required: true
        }
      ],
      defaultSettings: {
        includeSpeakerNames: true,
        includeTimestamps: false,
        includeActionItems: true,
        includeDecisions: true,
        includeParticipants: true,
        autoSummarize: true
      }
    }

    // 報告会議テンプレート
    const reportMeeting: MeetingTemplate = {
      id: 'report-meeting',
      name: '報告会議',
      description: '進捗報告・結果報告用テンプレート',
      sections: [
        {
          id: 'meeting-info',
          title: '会議情報',
          type: 'datetime',
          required: true
        },
        {
          id: 'participants',
          title: '参加者',
          type: 'participants',
          required: true
        },
        {
          id: 'reports',
          title: '報告内容',
          type: 'summary',
          required: true
        },
        {
          id: 'achievements',
          title: '成果・達成事項',
          type: 'list',
          required: false
        },
        {
          id: 'issues',
          title: '課題・問題点',
          type: 'list',
          required: false
        },
        {
          id: 'feedback',
          title: 'フィードバック',
          type: 'text',
          required: false
        },
        {
          id: 'next-actions',
          title: '今後の対応',
          type: 'list',
          required: false
        }
      ],
      defaultSettings: {
        includeSpeakerNames: true,
        includeTimestamps: false,
        includeActionItems: false,
        includeDecisions: false,
        includeParticipants: true,
        autoSummarize: true
      }
    }

    // 基本テンプレート
    const basicMeeting: MeetingTemplate = {
      id: 'basic-meeting',
      name: '基本テンプレート',
      description: 'シンプルな議事録テンプレート',
      sections: [
        {
          id: 'meeting-info',
          title: '会議情報',
          type: 'datetime',
          required: true
        },
        {
          id: 'participants',
          title: '参加者',
          type: 'participants',
          required: true
        },
        {
          id: 'content',
          title: '議事内容',
          type: 'summary',
          required: true
        },
        {
          id: 'conclusions',
          title: '結論・決定事項',
          type: 'list',
          required: false
        }
      ],
      defaultSettings: {
        includeSpeakerNames: false,
        includeTimestamps: false,
        includeActionItems: false,
        includeDecisions: true,
        includeParticipants: true,
        autoSummarize: true
      }
    }

    // テンプレートを登録
    this.templates.set(regularMeeting.id, regularMeeting)
    this.templates.set(planningMeeting.id, planningMeeting)
    this.templates.set(reportMeeting.id, reportMeeting)
    this.templates.set(basicMeeting.id, basicMeeting)
  }

  // テンプレート一覧を取得
  public getTemplates(): MeetingTemplate[] {
    return Array.from(this.templates.values())
  }

  // 特定のテンプレートを取得
  public getTemplate(templateId: string): MeetingTemplate | undefined {
    return this.templates.get(templateId)
  }

  // カスタムテンプレートを追加
  public addTemplate(template: MeetingTemplate): void {
    this.templates.set(template.id, template)
  }

  // テンプレートを削除
  public deleteTemplate(templateId: string): boolean {
    return this.templates.delete(templateId)
  }

  // テンプレートに基づいて議事録を生成
  public generateMeetingMinutes(
    templateId: string,
    transcript: string,
    summary: any,
    speakerData?: any
  ): FilledTemplate | null {
    const template = this.getTemplate(templateId)
    if (!template) return null

    const content: Record<string, any> = {}
    const now = new Date()

    // 各セクションを処理
    template.sections.forEach(section => {
      switch (section.type) {
        case 'datetime':
          if (section.id === 'meeting-info') {
            content[section.id] = {
              date: now.toLocaleDateString('ja-JP'),
              time: now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
              duration: summary.meetingDuration || '不明'
            }
          } else if (section.id === 'next-meeting') {
            content[section.id] = {
              date: '',
              time: '',
              note: '次回会議の日時を設定してください'
            }
          }
          break

        case 'participants':
          content[section.id] = summary.participants || []
          break

        case 'summary':
          if (section.id === 'discussion' || section.id === 'content' || section.id === 'reports') {
            content[section.id] = {
              keyPoints: summary.keyPoints || [],
              fullText: transcript,
              summary: summary.summary || ''
            }
          } else if (section.id === 'discussion-points') {
            content[section.id] = {
              keyPoints: summary.keyPoints || [],
              summary: summary.summary || ''
            }
          }
          break

        case 'list':
          if (section.id === 'decisions') {
            content[section.id] = summary.decisions || []
          } else if (section.id === 'agenda') {
            content[section.id] = this.extractAgenda(transcript)
          } else if (section.id === 'objectives') {
            content[section.id] = this.extractObjectives(transcript)
          } else if (section.id === 'achievements') {
            content[section.id] = this.extractAchievements(transcript)
          } else if (section.id === 'issues') {
            content[section.id] = this.extractIssues(transcript)
          } else if (section.id === 'next-actions') {
            content[section.id] = summary.actionItems || []
          } else if (section.id === 'risks') {
            content[section.id] = this.extractRisks(transcript)
          } else if (section.id === 'conclusions') {
            content[section.id] = summary.decisions || []
          }
          break

        case 'table':
          if (section.id === 'action-items') {
            content[section.id] = this.formatActionItems(summary.actionItems || [])
          } else if (section.id === 'timeline') {
            content[section.id] = this.extractTimeline(transcript)
          }
          break

        case 'text':
          if (section.id === 'project-overview') {
            content[section.id] = this.extractProjectOverview(transcript)
          } else if (section.id === 'feedback') {
            content[section.id] = this.extractFeedback(transcript)
          }
          break

        default:
          content[section.id] = ''
      }
    })

    return {
      templateId,
      templateName: template.name,
      generatedAt: now,
      content,
      rawTranscript: transcript,
      summary
    }
  }

  // 議題を抽出
  private extractAgenda(transcript: string): string[] {
    const agendaKeywords = ['議題', 'アジェンダ', '議論', '話し合い', '検討']
    const sentences = transcript.split(/[。！？\n]/)
    const agenda: string[] = []

    sentences.forEach(sentence => {
      const hasAgendaKeyword = agendaKeywords.some(keyword => 
        sentence.includes(keyword)
      )
      if (hasAgendaKeyword && sentence.length > 10) {
        agenda.push(sentence.trim())
      }
    })

    return agenda.slice(0, 5) // 最大5件
  }

  // 目的・目標を抽出
  private extractObjectives(transcript: string): string[] {
    const objectiveKeywords = ['目的', '目標', 'ゴール', '狙い', '達成']
    const sentences = transcript.split(/[。！？\n]/)
    const objectives: string[] = []

    sentences.forEach(sentence => {
      const hasObjectiveKeyword = objectiveKeywords.some(keyword => 
        sentence.includes(keyword)
      )
      if (hasObjectiveKeyword && sentence.length > 10) {
        objectives.push(sentence.trim())
      }
    })

    return objectives.slice(0, 3) // 最大3件
  }

  // 成果・達成事項を抽出
  private extractAchievements(transcript: string): string[] {
    const achievementKeywords = ['成果', '達成', '完了', '成功', '実現']
    const sentences = transcript.split(/[。！？\n]/)
    const achievements: string[] = []

    sentences.forEach(sentence => {
      const hasAchievementKeyword = achievementKeywords.some(keyword => 
        sentence.includes(keyword)
      )
      if (hasAchievementKeyword && sentence.length > 10) {
        achievements.push(sentence.trim())
      }
    })

    return achievements.slice(0, 5) // 最大5件
  }

  // 課題・問題点を抽出
  private extractIssues(transcript: string): string[] {
    const issueKeywords = ['課題', '問題', 'リスク', '懸念', '困難', '障害']
    const sentences = transcript.split(/[。！？\n]/)
    const issues: string[] = []

    sentences.forEach(sentence => {
      const hasIssueKeyword = issueKeywords.some(keyword => 
        sentence.includes(keyword)
      )
      if (hasIssueKeyword && sentence.length > 10) {
        issues.push(sentence.trim())
      }
    })

    return issues.slice(0, 5) // 最大5件
  }

  // リスクを抽出
  private extractRisks(transcript: string): string[] {
    const riskKeywords = ['リスク', '危険', '懸念', '不安', '問題', '障害']
    const sentences = transcript.split(/[。！？\n]/)
    const risks: string[] = []

    sentences.forEach(sentence => {
      const hasRiskKeyword = riskKeywords.some(keyword => 
        sentence.includes(keyword)
      )
      if (hasRiskKeyword && sentence.length > 10) {
        risks.push(sentence.trim())
      }
    })

    return risks.slice(0, 3) // 最大3件
  }

  // プロジェクト概要を抽出
  private extractProjectOverview(transcript: string): string {
    const overviewKeywords = ['概要', '企画', 'プロジェクト', '計画', '提案']
    const sentences = transcript.split(/[。！？\n]/)
    
    for (const sentence of sentences) {
      const hasOverviewKeyword = overviewKeywords.some(keyword => 
        sentence.includes(keyword)
      )
      if (hasOverviewKeyword && sentence.length > 20) {
        return sentence.trim()
      }
    }
    
    return ''
  }

  // フィードバックを抽出
  private extractFeedback(transcript: string): string {
    const feedbackKeywords = ['フィードバック', '感想', '意見', '評価', 'コメント']
    const sentences = transcript.split(/[。！？\n]/)
    
    for (const sentence of sentences) {
      const hasFeedbackKeyword = feedbackKeywords.some(keyword => 
        sentence.includes(keyword)
      )
      if (hasFeedbackKeyword && sentence.length > 15) {
        return sentence.trim()
      }
    }
    
    return ''
  }

  // タイムラインを抽出
  private extractTimeline(transcript: string): Array<{ task: string; deadline: string; assignee: string }> {
    const timeKeywords = ['期限', '締切', 'までに', '予定', 'スケジュール']
    const sentences = transcript.split(/[。！？\n]/)
    const timeline: Array<{ task: string; deadline: string; assignee: string }> = []

    sentences.forEach(sentence => {
      const hasTimeKeyword = timeKeywords.some(keyword => 
        sentence.includes(keyword)
      )
      if (hasTimeKeyword && sentence.length > 10) {
        timeline.push({
          task: sentence.trim(),
          deadline: '',
          assignee: ''
        })
      }
    })

    return timeline.slice(0, 5) // 最大5件
  }

  // アクションアイテムをテーブル形式にフォーマット
  private formatActionItems(actionItems: string[]): Array<{ task: string; assignee: string; deadline: string; status: string }> {
    return actionItems.map(item => ({
      task: item,
      assignee: '',
      deadline: '',
      status: '未着手'
    }))
  }

  // 議事録をMarkdown形式でエクスポート
  public exportToMarkdown(filledTemplate: FilledTemplate): string {
    const template = this.getTemplate(filledTemplate.templateId)
    if (!template) return ''

    let markdown = `# ${template.name}\n\n`
    markdown += `**生成日時:** ${filledTemplate.generatedAt.toLocaleString('ja-JP')}\n\n`

    template.sections.forEach(section => {
      const data = filledTemplate.content[section.id]
      if (!data) return

      markdown += `## ${section.title}\n\n`

      switch (section.type) {
        case 'datetime':
          if (typeof data === 'object' && data.date) {
            markdown += `- **日時:** ${data.date} ${data.time}\n`
            if (data.duration) markdown += `- **時間:** ${data.duration}\n`
          }
          break

        case 'participants':
          if (Array.isArray(data)) {
            data.forEach(participant => {
              markdown += `- ${participant}\n`
            })
          }
          break

        case 'summary':
          if (typeof data === 'object') {
            if (data.summary) markdown += `${data.summary}\n\n`
            if (data.keyPoints && Array.isArray(data.keyPoints)) {
              markdown += `### 主なポイント\n\n`
              data.keyPoints.forEach((point: string) => {
                markdown += `- ${point}\n`
              })
            }
          }
          break

        case 'list':
          if (Array.isArray(data)) {
            data.forEach((item: string) => {
              markdown += `- ${item}\n`
            })
          }
          break

        case 'table':
          if (Array.isArray(data) && data.length > 0) {
            const keys = Object.keys(data[0])
            markdown += `| ${keys.join(' | ')} |\n`
            markdown += `| ${keys.map(() => '---').join(' | ')} |\n`
            data.forEach((row: any) => {
              markdown += `| ${keys.map(key => row[key] || '').join(' | ')} |\n`
            })
          }
          break

        case 'text':
          if (typeof data === 'string') {
            markdown += `${data}\n`
          }
          break
      }

      markdown += '\n'
    })

    return markdown
  }
}
