import { dispatchEmergency } from '@/lib/dispatch'

export const dynamic = 'force-dynamic'

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

/**
 * Re-dispatch endpoint — for manually re-running dispatch on an already-created emergency.
 * Primary dispatch happens server-side inside POST /api/report.
 * This endpoint is used by the UI for progress streaming during re-dispatch.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const emergencyId = searchParams.get('emergencyId')

  if (!emergencyId) {
    return new Response('emergencyId required', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(sseEvent(data)))
        } catch { /* client disconnected */ }
      }

      try {
        // Emit initial step immediately so the UI shows progress
        send({ type: 'step', step: 1, label: 'Emergency Received', status: 'complete', message: 'Emergency record verified' })
        send({ type: 'step', step: 2, label: 'AI Assessing', status: 'in_progress', message: 'Running dispatch pipeline...' })

        const result = await dispatchEmergency(emergencyId)

        // Replay steps from the dispatch result
        for (const step of result.steps) {
          send({ type: 'step', ...step })
        }

        if (result.success) {
          send({
            type: 'complete',
            missionId: result.missionId,
            missionStatus: result.missionStatus,
            volunteer: result.volunteer,
            resource: result.resource,
            reasoning: result.reasoning,
          })
        } else {
          send({
            type: 'error',
            message: result.failureReason ?? 'Dispatch failed',
            steps: result.steps,
          })
        }

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        send({ type: 'error', message: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
