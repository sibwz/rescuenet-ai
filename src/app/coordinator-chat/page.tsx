'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, Loader2, Bot, User, Database, Wrench, ChevronDown, ChevronRight } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  toolCallsUsed?: string[]
  dataQueried?: string[]
  timestamp: Date
  loading?: boolean
}

const EXAMPLE_QUESTIONS = [
  'Which emergency should be handled first?',
  'How many volunteers are available?',
  'Show all critical requests.',
  'What resources are running low?',
  'Which areas have the most emergencies?',
  'What is the current mission status?',
]

interface ChatResponse {
  answer: string
  reasoning: string
  toolCallsUsed: string[]
  dataQueried: string[]
  error?: string
}

export default function CoordinatorChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello, Coordinator. I have full visibility into RescueNet\'s live database — emergencies, volunteers, resources, and missions. Ask me anything about the current situation.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    const loadingMsg: ChatMessage = {
      id: Date.now().toString() + '-loading',
      role: 'assistant',
      content: '',
      loading: true,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/coordinator-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json() as ChatResponse

      const assistantMsg: ChatMessage = {
        id: Date.now().toString() + '-reply',
        role: 'assistant',
        content: data.answer ?? 'I could not process that query.',
        reasoning: data.reasoning,
        toolCallsUsed: data.toolCallsUsed,
        dataQueried: data.dataQueried,
        timestamp: new Date(),
      }

      setMessages((prev) => prev.filter((m) => !m.loading).concat(assistantMsg))
    } catch {
      setMessages((prev) =>
        prev.filter((m) => !m.loading).concat({
          id: Date.now().toString() + '-err',
          role: 'assistant',
          content: 'Network error — could not reach the coordinator. Please try again.',
          timestamp: new Date(),
        })
      )
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="p-6 h-[calc(100vh-0px)] flex flex-col gap-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-green-400" />
          AI Coordinator Chat
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Ask the AI coordinator questions grounded in live MongoDB data
        </p>
      </div>

      {/* Example questions */}
      <div className="flex-shrink-0 flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            disabled={loading}
            className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 flex gap-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="Ask about emergencies, volunteers, resources, or missions..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-500 transition-colors disabled:opacity-50"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-3 rounded-xl transition-colors flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const [showDetails, setShowDetails] = useState(false)
  const hasDetails = message.reasoning || (message.toolCallsUsed?.length ?? 0) > 0

  if (message.loading) {
    return (
      <div className="flex gap-3">
        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
          <span className="text-gray-400 text-sm">Querying database and reasoning...</span>
        </div>
      </div>
    )
  }

  if (message.role === 'user') {
    return (
      <div className="flex gap-3 justify-end">
        <div className="bg-blue-600 rounded-xl px-4 py-3 max-w-[75%]">
          <p className="text-white text-sm">{message.content}</p>
        </div>
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 max-w-[85%] space-y-2">
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>

        {hasDetails && (
          <div>
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showDetails ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              View reasoning & tool calls
            </button>

            {showDetails && (
              <div className="mt-2 space-y-2">
                {/* Tool calls */}
                {(message.toolCallsUsed?.length ?? 0) > 0 && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide flex items-center gap-1.5 mb-2">
                      <Wrench className="w-3 h-3" />
                      Tool Calls Used
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {message.toolCallsUsed?.map((tool) => (
                        <span
                          key={tool}
                          className="bg-blue-900/40 border border-blue-700/30 text-blue-300 text-[11px] px-2 py-0.5 rounded font-mono"
                        >
                          {tool}()
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Collections queried */}
                {(message.dataQueried?.length ?? 0) > 0 && (
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide flex items-center gap-1.5 mb-2">
                      <Database className="w-3 h-3" />
                      MongoDB Collections
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {message.dataQueried?.map((col) => (
                        <span
                          key={col}
                          className="bg-purple-900/40 border border-purple-700/30 text-purple-300 text-[11px] px-2 py-0.5 rounded font-mono"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reasoning */}
                {message.reasoning && (
                  <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-3">
                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-1">Reasoning</p>
                    <p className="text-gray-300 text-xs leading-relaxed">{message.reasoning}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-gray-700 text-[10px] pl-1">
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}
