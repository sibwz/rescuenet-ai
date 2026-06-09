'use client'

import { useState, useRef } from 'react'
import {
  AlertTriangle, CheckCircle, Loader2, Phone, MapPin, Users, FileText,
  ChevronDown, Camera, Brain, Upload, X, Sparkles, TrendingUp,
  Activity, Zap, UserCheck, Package, Flag, AlertCircle,
} from 'lucide-react'
import type { EmergencyType, UrgencyLevel } from '@/types'
import type { DispatchResult, DispatchStepResult } from '@/lib/dispatch'

const EMERGENCY_TYPES: { value: EmergencyType; label: string; icon: string }[] = [
  { value: 'medical', label: 'Medical Emergency', icon: '🏥' },
  { value: 'food', label: 'Food Shortage', icon: '🍱' },
  { value: 'water', label: 'Water Crisis', icon: '💧' },
  { value: 'shelter', label: 'Shelter Needed', icon: '⛺' },
  { value: 'evacuation', label: 'Evacuation Required', icon: '🚨' },
]

const URGENCY_STYLES: Record<UrgencyLevel, { bg: string; border: string; text: string; label: string }> = {
  critical: { bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.3)', text: '#f87171', label: 'CRITICAL' },
  high: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', text: '#fb923c', label: 'HIGH' },
  medium: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#facc15', label: 'MEDIUM' },
  low: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#4ade80', label: 'LOW' },
}

interface ImageAnalysis {
  disasterType: string
  severity: string
  confidence: number
  description: string
  suggestedResources: string[]
  estimatedPeopleAffected: number
  immediateActions: string[]
}

interface SubmitResult {
  success: boolean
  message: string
  emergency?: {
    _id: string
    urgency: UrgencyLevel
    urgency_reason: string
    status: string
  }
  dispatch?: DispatchResult
}

const PIPELINE_META: { step: number; label: string; icon: React.ElementType }[] = [
  { step: 1, label: 'Emergency Received', icon: AlertTriangle },
  { step: 2, label: 'AI Assessing', icon: Brain },
  { step: 3, label: 'Matching Volunteer', icon: UserCheck },
  { step: 4, label: 'Allocating Resources', icon: Package },
  { step: 5, label: 'Mission Created', icon: Flag },
]

export default function ReportPage() {
  const [form, setForm] = useState({
    reporterName: '',
    phone: '',
    location: '',
    emergencyType: '' as EmergencyType | '',
    peopleAffected: '',
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Image analysis state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null)
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pipeline animation state — driven by server result, NOT by SSE
  const [animatedSteps, setAnimatedSteps] = useState<DispatchStepResult[]>([])
  const [animationDone, setAnimationDone] = useState(false)
  const [pipelineStarted, setPipelineStarted] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImageAnalysis(null)
    setAnalysisWarning(null)
    const reader = new FileReader()
    reader.onloadend = () => { setImagePreview(reader.result as string) }
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setImageAnalysis(null)
    setAnalysisWarning(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function analyzeImage() {
    if (!imageFile || !imagePreview) return
    setAnalyzing(true)
    setImageAnalysis(null)
    setAnalysisWarning(null)

    try {
      const base64 = imagePreview.split(',')[1]
      const mimeType = imageFile.type || 'image/jpeg'

      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      })

      const data = await res.json() as { success: boolean; analysis: ImageAnalysis; warning?: string; error?: string }

      if (!res.ok || data.error) { setAnalysisWarning(data.error ?? 'Analysis failed'); return }
      if (data.warning) setAnalysisWarning(data.warning)
      setImageAnalysis(data.analysis)

      setForm((prev) => ({
        ...prev,
        emergencyType: (data.analysis.disasterType as EmergencyType) || prev.emergencyType,
        peopleAffected: data.analysis.estimatedPeopleAffected ? String(data.analysis.estimatedPeopleAffected) : prev.peopleAffected,
        description: data.analysis.description ? `[AI Analysis] ${data.analysis.description} ${prev.description}` : prev.description,
      }))
    } catch (e) {
      setAnalysisWarning(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  // Animate pipeline steps from the pre-computed server result
  async function animatePipeline(steps: DispatchStepResult[]) {
    setPipelineStarted(true)
    setAnimatedSteps([])
    setAnimationDone(false)

    for (const step of steps) {
      await new Promise<void>((resolve) => setTimeout(resolve, 480))
      setAnimatedSteps((prev) => [...prev, step])
    }

    setAnimationDone(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setResult(null)
    setPipelineStarted(false)
    setAnimatedSteps([])
    setAnimationDone(false)

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, peopleAffected: Number(form.peopleAffected) }),
      })
      const data = await res.json() as SubmitResult & { error?: string }

      if (!res.ok || data.error) {
        setError(data.error ?? 'Submission failed')
      } else {
        setResult(data)
        setForm({ reporterName: '', phone: '', location: '', emergencyType: '', peopleAffected: '', description: '' })
        clearImage()

        // Animate steps from the server result (dispatch already ran)
        if (data.dispatch?.steps) {
          void animatePipeline(data.dispatch.steps)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const dispatch = result?.dispatch
  const severityColor = imageAnalysis
    ? URGENCY_STYLES[imageAnalysis.severity as UrgencyLevel] ?? URGENCY_STYLES.medium
    : null

  return (
    <div className="p-6 max-w-2xl mx-auto page-enter">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.25)' }}>
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          Report Emergency
        </h1>
        <p className="text-sm mt-2" style={{ color: '#64748b' }}>
          Submit an emergency report. AI instantly assesses urgency and dispatches resources — fully autonomous.
        </p>
      </div>

      {/* ── Submission success ──────────────────────────── */}
      {result?.success && result.emergency && (
        <div
          className="mb-4 p-5 rounded-2xl"
          style={{ background: URGENCY_STYLES[result.emergency.urgency].bg, border: `1px solid ${URGENCY_STYLES[result.emergency.urgency].border}` }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: URGENCY_STYLES[result.emergency.urgency].text }} />
            <div>
              <p className="text-white font-semibold">Emergency Submitted Successfully</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-lg"
                  style={{ background: URGENCY_STYLES[result.emergency.urgency].bg, border: `1px solid ${URGENCY_STYLES[result.emergency.urgency].border}`, color: URGENCY_STYLES[result.emergency.urgency].text }}
                >
                  {URGENCY_STYLES[result.emergency.urgency].label}
                </span>
                <span className="text-slate-300 text-sm">AI-classified urgency</span>
              </div>
              {result.emergency.urgency_reason && (
                <p className="text-sm mt-2 italic" style={{ color: '#94a3b8' }}>&ldquo;{result.emergency.urgency_reason}&rdquo;</p>
              )}
              <p className="text-xs mt-2" style={{ color: '#475569' }}>
                Ref: <span className="font-mono">{result.emergency._id}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* ── Auto-Dispatch Pipeline ─────────────────────── */}
      {pipelineStarted && (
        <div className="mb-6 rounded-2xl overflow-hidden" style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Auto-Dispatch Pipeline</h2>
              <p className="text-[11px]" style={{ color: '#475569' }}>Server-side multi-agent AI processing</p>
            </div>
            {!animationDone ? (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dot-live" />
                <span className="text-xs text-blue-400 font-medium">Processing</span>
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">Complete</span>
              </div>
            )}
          </div>

          <div className="p-5 space-y-2">
            {PIPELINE_META.map(({ step, label, icon: Icon }) => {
              const stepData = animatedSteps.find((s) => s.step === step)
              const isCurrentlyRunning = !animationDone && animatedSteps.length === step - 1

              const status = stepData?.status ?? (isCurrentlyRunning ? 'in_progress' : 'pending')

              const styleMap: Record<string, { dot: string; text: string; bg: string; border: string }> = {
                pending: { dot: '#334155', text: '#475569', bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.05)' },
                in_progress: { dot: '#60a5fa', text: '#93c5fd', bg: 'rgba(59,130,246,0.05)', border: 'rgba(59,130,246,0.15)' },
                complete: { dot: '#4ade80', text: '#6ee7b7', bg: 'rgba(34,197,94,0.05)', border: 'rgba(34,197,94,0.15)' },
                warning: { dot: '#fb923c', text: '#fdba74', bg: 'rgba(249,115,22,0.05)', border: 'rgba(249,115,22,0.15)' },
                error: { dot: '#f87171', text: '#fca5a5', bg: 'rgba(220,38,38,0.05)', border: 'rgba(220,38,38,0.15)' },
              }
              const style = styleMap[status]

              return (
                <div
                  key={step}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{ background: style.bg, border: `1px solid ${style.border}` }}
                >
                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: style.dot, boxShadow: status === 'in_progress' ? `0 0 8px ${style.dot}` : 'none' }}
                    />
                    <Icon className="w-3.5 h-3.5" style={{ color: style.dot }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: style.text }}>{label}</span>
                      {status === 'in_progress' && <Loader2 className="w-3 h-3 animate-spin" style={{ color: style.dot }} />}
                      {status === 'warning' && <AlertCircle className="w-3 h-3" style={{ color: style.dot }} />}
                    </div>
                    {stepData?.message && (
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: '#64748b' }}>{stepData.message}</p>
                    )}
                    {status === 'in_progress' && !stepData?.message && (
                      <p className="text-[11px] mt-0.5" style={{ color: '#334155' }}>Running...</p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                    style={{ background: `${style.dot}20`, color: style.dot }}
                  >
                    {status === 'in_progress' ? 'running' : status === 'pending' ? 'queue' : status}
                  </span>
                </div>
              )
            })}
          </div>

          {/* ── Mission result summary ─────────────────── */}
          {animationDone && dispatch && (
            <div
              className="mx-5 mb-5 p-4 rounded-xl space-y-3"
              style={{
                background: dispatch.success ? 'rgba(34,197,94,0.06)' : 'rgba(220,38,38,0.06)',
                border: `1px solid ${dispatch.success ? 'rgba(34,197,94,0.15)' : 'rgba(220,38,38,0.15)'}`,
              }}
            >
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${dispatch.success ? 'text-emerald-400' : 'text-red-400'}`} />
                <span className={`text-sm font-semibold ${dispatch.success ? 'text-emerald-300' : 'text-red-300'}`}>
                  {!dispatch.success
                    ? `Dispatch Error — ${dispatch.failureReason ?? 'Unknown'}`
                    : dispatch.missionStatus === 'active'
                      ? 'Mission Active — Team Dispatched'
                      : dispatch.missionStatus === 'awaiting_volunteer'
                        ? 'Mission Created — Awaiting Volunteer'
                        : 'Mission Created — Resource Shortage Flagged'}
                </span>
              </div>

              {dispatch.success && (
                <div className="grid grid-cols-2 gap-2">
                  {dispatch.volunteer ? (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Volunteer</p>
                      <p className="text-white text-xs font-semibold">{dispatch.volunteer.name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>{dispatch.volunteer.skills.join(', ')}</p>
                    </div>
                  ) : (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Volunteer</p>
                      <p className="text-purple-400 text-xs font-semibold">Awaiting Assignment</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>Coordinator notified</p>
                    </div>
                  )}

                  {dispatch.resource ? (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Resources</p>
                      <p className="text-white text-xs font-semibold capitalize">{dispatch.resource.resourceType.replace('_', ' ')}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>{dispatch.resource.quantity} units · {dispatch.resource.location}</p>
                    </div>
                  ) : (
                    <div className="rounded-lg p-3" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
                      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Resources</p>
                      <p className="text-orange-400 text-xs font-semibold">Shortage Flagged</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>Procurement initiated</p>
                    </div>
                  )}
                </div>
              )}

              {dispatch.missionId && (
                <p className="text-[10px]" style={{ color: '#334155' }}>
                  Mission ID: <span className="font-mono text-slate-500">{dispatch.missionId}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── IMAGE UPLOAD ────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.15)' }}>
              <Camera style={{ width: 14, height: 14, color: '#c084fc' }} />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Upload Emergency Photo</h2>
              <p className="text-[11px]" style={{ color: '#475569' }}>Gemini Vision detects disaster type, severity, and suggests resources</p>
            </div>
            <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}>
              AI VISION
            </span>
          </div>

          <div className="p-5">
            {!imagePreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 rounded-xl flex flex-col items-center gap-3 transition-all"
                style={{ background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.08)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(168,85,247,0.3)'; (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.04)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.1)' }}>
                  <Upload style={{ width: 20, height: 20, color: '#c084fc' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-300">Click to upload emergency photo</p>
                  <p className="text-xs mt-1" style={{ color: '#475569' }}>PNG, JPG, WebP up to 10MB</p>
                </div>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden" style={{ maxHeight: 200 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Emergency photo" className="w-full object-cover" style={{ maxHeight: 200 }} />
                  <button type="button" onClick={clearImage} className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>

                {!imageAnalysis && (
                  <button
                    type="button"
                    onClick={analyzeImage}
                    disabled={analyzing}
                    className="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 font-semibold text-sm"
                    style={{ background: analyzing ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}
                  >
                    {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" />Gemini Vision Analyzing...</> : <><Sparkles className="w-4 h-4" />Analyze with Gemini Vision</>}
                  </button>
                )}

                {analysisWarning && <p className="text-xs text-yellow-400 italic">{analysisWarning}</p>}

                {imageAnalysis && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Brain className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Gemini Vision Analysis</span>
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>
                        {imageAnalysis.confidence}% confidence
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Disaster Type</p>
                        <p className="text-sm font-bold text-white capitalize">{imageAnalysis.disasterType}</p>
                      </div>
                      <div className="rounded-lg p-2.5 text-center" style={{ background: severityColor ? severityColor.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${severityColor?.border ?? 'rgba(255,255,255,0.06)'}` }}>
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Severity</p>
                        <p className="text-sm font-bold capitalize" style={{ color: severityColor?.text ?? '#fff' }}>{imageAnalysis.severity}</p>
                      </div>
                      <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Est. Affected</p>
                        <p className="text-sm font-bold text-white">{imageAnalysis.estimatedPeopleAffected}</p>
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: '#94a3b8' }}>{imageAnalysis.description}</p>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Suggested Resources</p>
                      <div className="flex flex-wrap gap-1.5">
                        {imageAnalysis.suggestedResources.map((r) => (
                          <span key={r} className="text-[11px] px-2.5 py-1 rounded-lg font-medium" style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.15)' }}>{r}</span>
                        ))}
                      </div>
                    </div>
                    {imageAnalysis.immediateActions.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Immediate Actions</p>
                        <div className="space-y-1">
                          {imageAnalysis.immediateActions.map((a, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs" style={{ color: '#94a3b8' }}>
                              <span className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>{i + 1}</span>
                              {a}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-300">Form fields auto-populated from AI analysis</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />
          </div>
        </div>

        {/* ── Reporter Information ─────────────────────── */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>Reporter Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Reporter Name" required>
              <input
                name="reporterName"
                value={form.reporterName}
                onChange={handleChange}
                required
                placeholder="Full name"
                className="w-full rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </FormField>
            <FormField label="Phone Number">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#475569' }} />
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  type="tel"
                  placeholder="+92-300-0000000"
                  className="w-full rounded-xl pl-9 pr-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
            </FormField>
          </div>
        </div>

        {/* ── Emergency Details ───────────────────────── */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(13,20,37,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#475569' }}>Emergency Details</h2>

          <FormField label="Location" required>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#475569' }} />
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                required
                placeholder="e.g. Gulberg, Lahore or F-7, Islamabad"
                className="w-full rounded-xl pl-9 pr-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Emergency Type" required>
              <div className="relative">
                <select
                  name="emergencyType"
                  value={form.emergencyType}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none appearance-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <option value="">Select type...</option>
                  {EMERGENCY_TYPES.map(({ value, label, icon }) => (
                    <option key={value} value={value}>{icon} {label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#475569' }} />
              </div>
            </FormField>

            <FormField label="People Affected" required>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#475569' }} />
                <input
                  name="peopleAffected"
                  value={form.peopleAffected}
                  onChange={handleChange}
                  required
                  type="number"
                  min="1"
                  placeholder="Estimated count"
                  className="w-full rounded-xl pl-9 pr-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>
            </FormField>
          </div>

          <FormField label="Description" required>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4" style={{ color: '#475569' }} />
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                required
                rows={4}
                placeholder="Describe the emergency situation in detail..."
                className="w-full rounded-xl pl-9 pr-3.5 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
            </div>
          </FormField>
        </div>

        {/* ── AI notice ───────────────────────────────── */}
        <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(59,130,246,0.2)' }}>
            <Zap style={{ width: 13, height: 13, color: '#60a5fa' }} />
          </div>
          <div>
            <p className="text-blue-300 text-sm font-semibold">Fully Autonomous Server-Side Dispatch</p>
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
              Gemini classifies urgency, then the server immediately assigns a volunteer and resources — guaranteed before this form returns.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2.5 text-sm"
          style={{
            background: submitting ? 'rgba(220,38,38,0.3)' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            color: submitting ? '#9ca3af' : '#fff',
          }}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Submitting &amp; Dispatching...</>
          ) : (
            <><AlertTriangle className="w-4 h-4" />Submit Emergency Report</>
          )}
        </button>
      </form>
    </div>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#64748b' }}>
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
