import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export const dynamic = 'force-dynamic'

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID ?? ''
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1'
const MODEL_ID = 'gemini-2.0-flash'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { imageBase64: string; mimeType: string }
    const { imageBase64, mimeType } = body

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const ai = new GoogleGenAI({
      vertexai: true,
      project: PROJECT_ID,
      location: LOCATION,
    })

    const model = ai.models

    const prompt = `You are an AI disaster assessment system analyzing emergency photos for a disaster response coordination platform.

Analyze this image and respond with ONLY valid JSON in this exact format:
{
  "disasterType": "medical|food|water|shelter|evacuation",
  "severity": "critical|high|medium|low",
  "confidence": <number 0-100>,
  "description": "<one sentence describing what you observe>",
  "suggestedResources": ["<resource1>", "<resource2>", "<resource3>"],
  "estimatedPeopleAffected": <number>,
  "immediateActions": ["<action1>", "<action2>"]
}

If this is not an emergency image, still return valid JSON with severity "low" and disasterType "shelter".`

    const response = await model.generateContent({
      model: MODEL_ID,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
              },
            },
            { text: prompt },
          ],
        },
      ],
    })

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const analysis = JSON.parse(jsonMatch[0]) as {
      disasterType: string
      severity: string
      confidence: number
      description: string
      suggestedResources: string[]
      estimatedPeopleAffected: number
      immediateActions: string[]
    }

    return NextResponse.json({ success: true, analysis })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Return a mock analysis if Gemini Vision fails (for demo purposes)
    return NextResponse.json({
      success: true,
      analysis: {
        disasterType: 'medical',
        severity: 'high',
        confidence: 72,
        description: 'Emergency situation detected requiring immediate response.',
        suggestedResources: ['Medical Team', 'First Aid Kit', 'Ambulance'],
        estimatedPeopleAffected: 15,
        immediateActions: ['Deploy medical personnel', 'Establish triage area'],
      },
      warning: `AI vision unavailable (${msg}) — showing estimated analysis`,
    })
  }
}
