# Google Cloud Agent Builder — RescueNet AI Integration

## Overview

RescueNet AI uses **Google Cloud Agent Builder (Vertex AI)** as the intended production orchestration layer for the AI agent. In the current implementation, Gemini API is called directly from `src/lib/gemini.ts`. The architecture is designed so that the Gemini call can be replaced with a full Agent Builder agent session.

---

## Architecture: How RescueNet Fits Into Agent Builder

```
Coordinator clicks "Generate AI Response Plan"
        ↓
src/app/api/agent/route.ts (Next.js API Route)
        ↓
[Option A — Current]           [Option B — Agent Builder]
generatePlanWithGemini()       Agent Builder Agent Session
Gemini REST API call           ↳ Tool: emergency_lookup
Returns structured JSON        ↳ Tool: volunteer_finder
        ↓                      ↳ Tool: resource_allocator
Deterministic fallback         ↳ Tool: mission_writer
if Gemini unavailable          Returns structured response
        ↓                               ↓
Mission plans returned to coordinator (both paths)
        ↓
Coordinator approves → POST /api/agent → MongoDB
```

---

## Intended Agent Builder Configuration

### Agent Name
`RescueNet Coordination Agent`

### Agent Goal
Analyze pending disaster emergency requests, prioritize by urgency and people affected, match available volunteers by skill and location, allocate resources by type, and generate a human-reviewable mission plan.

### Agent Instructions (System Prompt)
```
You are the RescueNet AI Coordination Agent. Your task is to generate optimized disaster response mission plans.

Steps:
1. Fetch all pending emergency requests using the emergency_lookup tool.
2. Fetch all available volunteers using the volunteer_finder tool.
3. Fetch all available resources using the resource_allocator tool.
4. For each request (highest urgency first), select the best volunteer and resource match.
5. Return a structured mission plan for coordinator review.

Rules:
- Critical urgency requests are processed first (score 100), then high (75), medium (50), low (25).
- Only assign volunteers with status=available and resources with status=available.
- Each volunteer and resource may only be assigned to one mission.
- Include reasoning for every decision: why this priority, why this volunteer, why this resource.
- Assess risk level (critical/high/medium/low) for each mission.
- Provide a concrete "next action" for the field team.
```

### Tools

#### Tool 1: `emergency_lookup`
- **Description**: Retrieves all pending emergency requests from MongoDB
- **Method**: GET `/api/emergency?status=pending`
- **Returns**: Array of emergency requests with type, urgency, location, people affected

#### Tool 2: `volunteer_finder`
- **Description**: Retrieves all available volunteers from MongoDB
- **Method**: GET `/api/volunteers?status=available`
- **Returns**: Array of volunteers with skills, location, vehicle availability

#### Tool 3: `resource_allocator`
- **Description**: Retrieves all available resources from MongoDB
- **Method**: GET `/api/resources?status=available`
- **Returns**: Array of resources with type, quantity, location

#### Tool 4: `mission_writer`
- **Description**: Creates a confirmed mission in MongoDB after coordinator approval
- **Method**: POST `/api/agent`
- **Body**: `{ plans: [...approvedPlans] }`
- **Effect**: Creates missions, marks volunteers busy, marks requests assigned, marks resources assigned

---

## Setting Up Agent Builder

### Prerequisites
- Google Cloud project with billing enabled
- Vertex AI API enabled
- Agent Builder API enabled

### Steps

1. **Create a new Agent** in [Google Cloud Console → Agent Builder](https://console.cloud.google.com/gen-app-builder)

2. **Configure the agent**:
   - Display name: `RescueNet Coordination Agent`
   - Agent goal: See above
   - Instructions: See above

3. **Add Tools** (as OpenAPI or webhook tools):
   - Point each tool to your deployed RescueNet API endpoints
   - For local development, use a tunnel (ngrok, Cloud Run preview)

4. **Set environment variable**:
   ```env
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   ```

5. **Wire the agent session** in `src/app/api/agent/route.ts`:
   - Replace `generatePlanWithGemini()` with an Agent Builder agent session call
   - The API contract (input/output shape) is already defined and compatible

---

## Current Integration Status

| Component | Status | File |
|---|---|---|
| Gemini API direct call | Active | `src/lib/gemini.ts` |
| Deterministic fallback | Active | `src/app/api/agent/route.ts` |
| Agent Builder session | Placeholder | `src/app/api/agent/route.ts` |
| GOOGLE_CLOUD_PROJECT_ID | Set via env | `.env.local` |

The `GOOGLE_CLOUD_PROJECT_ID` environment variable is already read by the Integrations page to show Agent Builder status. The integration point is clearly marked in `src/app/api/agent/route.ts`.

---

## Why Gemini Direct + Agent Builder Compatibility

RescueNet intentionally uses Gemini API directly (not just Agent Builder) because:
1. It works without a full Cloud project setup for hackathon demos
2. The deterministic fallback ensures the demo always works
3. The output format (JSON plans with structured reasoning) is identical whether generated by Gemini direct, Agent Builder, or the deterministic planner — making the swap seamless
