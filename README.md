# RescueNet AI — Disaster Response Coordination Platform

A **functional AI coordination agent** built for the **Google Cloud AI Hackathon** with the **MongoDB Partner Track**. RescueNet AI is not a chatbot — it reads real data, plans with Gemini AI, matches volunteers and resources with structured reasoning, and creates missions in MongoDB under human oversight.

---

## Features

| Module | Description |
|---|---|
| **Dashboard** | Live stats: total requests, critical alerts, active volunteers/resources, active missions |
| **Emergency Requests** | Submit, filter, and manage disaster reports with urgency classification |
| **Volunteers** | Register and manage field volunteers with skills and availability tracking |
| **Resources** | Track food, water, medicine, shelter kits, and vehicles across locations |
| **AI Agent** | Generates prioritized mission plans — Gemini primary, deterministic fallback, visible error banner |
| **Missions** | View, approve, complete, or cancel coordinator-approved missions |
| **Integrations** | Live status dashboard for Gemini, Agent Builder, MongoDB, MCP, and workflow |

---

## Tech Stack

| Technology | Role |
|---|---|
| **Next.js 14** (App Router) | Full-stack framework |
| **TypeScript** | Type safety across the entire codebase |
| **Tailwind CSS** | Styling |
| **MongoDB Atlas** | Primary database (partner track) |
| **Mongoose** | MongoDB ODM |
| **Gemini API** (`@google/generative-ai`) | Primary AI planning engine |
| **Google Cloud Agent Builder** | Agent orchestration integration point |
| **MongoDB MCP Server** | AI tool access to MongoDB collections |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Coordinator Browser                │
│  Dashboard · Emergency · Volunteers · Resources     │
│  AI Agent · Missions · Integrations                 │
└────────────────────┬────────────────────────────────┘
                     │ Next.js App Router
┌────────────────────▼────────────────────────────────┐
│               API Routes (Next.js)                  │
│  /api/agent    → AI planning + mission creation     │
│  /api/emergency → CRUD emergency requests           │
│  /api/volunteers → CRUD volunteers                  │
│  /api/resources  → CRUD resources                   │
│  /api/missions   → CRUD + status cascade            │
│  /api/integrations → Live integration status        │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
┌──────────▼──────┐    ┌──────────▼──────────────────┐
│   Gemini API    │    │        MongoDB Atlas         │
│  (primary AI)   │    │  emergency_requests          │
│                 │    │  volunteers                  │
│  Falls back to  │    │  resources                   │
│  deterministic  │    │  missions                    │
│  planner on     │    │  agent_logs                  │
│  quota/error    │    │                              │
└─────────────────┘    │  Exposed via MongoDB MCP     │
                       └──────────────────────────────┘
```

### AI Agent Workflow

```
Coordinator clicks "Generate AI Response Plan"
        ↓
Read MongoDB: pending requests, available volunteers, available resources
        ↓
[Gemini API] ──→ Prioritized plans with structured reasoning
      ↓ (if Gemini fails: quota / billing / timeout)
[Deterministic Fallback] → Rule-based scoring (always works)
      ↓ (visible yellow banner shown to coordinator)
Display plans: priority reason, volunteer match, resource allocation, risk level, next action
        ↓
Coordinator reviews and selects plans (human oversight)
        ↓
Click "Approve and Create Missions"
        ↓
Write to MongoDB: missions created, volunteers → busy, resources → assigned, requests → assigned
        ↓
Missions page shows active missions; mark as completed when done
```

---

## Environment Variables

```env
# Required
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/rescuenet?retryWrites=true&w=majority

# Optional — enables Gemini AI (falls back to deterministic planner if absent or on error)
GEMINI_API_KEY=your_gemini_api_key_here

# Supported: gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro, gemini-2.5-pro
GEMINI_MODEL=gemini-2.0-flash

# Optional — shows Agent Builder as configured in the Integrations page
GOOGLE_CLOUD_PROJECT_ID=your_google_cloud_project_id_here

NEXT_PUBLIC_APP_NAME=RescueNet AI
```

---

## Setup Instructions

### 1. Prerequisites

- Node.js 18+
- MongoDB Atlas account (free tier works)
- Google Cloud account with Gemini API key (optional — app works without it)

### 2. Clone & Install

```bash
git clone <your-repo>
cd rescuenet-ai
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your MongoDB URI and Gemini API key.

> **Without a Gemini key**: The app runs in deterministic mode — the AI agent still works using rule-based scoring. The coordinator sees `(set GEMINI_API_KEY to enable Gemini)` in the UI.

> **With a Gemini key that hits quota**: A yellow banner appears: "Gemini unavailable — fallback planner active." Plans are still generated. The demo never breaks.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Seed Demo Data

On the Dashboard, click **"Seed Demo Data"** to populate:
- 6 emergency requests (critical → low urgency, multiple cities)
- 7 volunteers with varied skills and locations
- 8 resource entries across depots

---

## Demo Flow

1. **Dashboard** → Seed demo data → see live counts
2. **Emergency Requests** → filter by critical → see flood, medical, fire emergencies
3. **Volunteers** → see skill diversity (medical, rescue, transport, logistics)
4. **Resources** → see supply depots by location
5. **AI Agent** → Generate Plan → review structured reasoning → Approve and Create Missions
6. **Missions** → see active missions → mark one as Completed
7. **Integrations** → show all systems green

Full narrated script: `docs/demo-script.md`

---

## Hackathon Compliance

| Requirement | Status |
|---|---|
| Google Cloud AI (Gemini) | ✅ Primary planner |
| No OpenAI / other AI providers | ✅ Only `@google/generative-ai` |
| Google Cloud Agent Builder | ✅ Integration point + docs |
| Functional agent (not chatbot) | ✅ Reads data, reasons, plans, creates tasks |
| Human oversight | ✅ Coordinator approves before any write |
| MongoDB Atlas (partner track) | ✅ All 5 collections |
| MongoDB MCP Server | ✅ Configured, all collections exposed |
| Agent reasoning visible | ✅ Priority, volunteer, resource, risk, next action |
| Reliable demo | ✅ Fallback planner + visible error banner |

Detailed checklist: `docs/hackathon-compliance.md`

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── emergency/page.tsx          # Emergency requests
│   ├── volunteers/page.tsx         # Volunteer management
│   ├── resources/page.tsx          # Resource tracking
│   ├── agent/page.tsx              # AI Agent panel
│   ├── missions/page.tsx           # Mission tracking
│   ├── integrations/page.tsx       # Integration status
│   └── api/
│       ├── dashboard/route.ts      # Stats aggregation
│       ├── emergency/route.ts      # CRUD
│       ├── volunteers/route.ts     # CRUD
│       ├── resources/route.ts      # CRUD
│       ├── missions/route.ts       # CRUD + status cascade
│       ├── agent/route.ts          # AI planning engine (Gemini + fallback)
│       ├── integrations/route.ts   # Integration status checker
│       └── seed/route.ts           # Demo data seeder
├── components/
│   ├── layout/Sidebar.tsx
│   └── ui/Badge.tsx, Button.tsx, Modal.tsx
├── lib/
│   ├── mongodb.ts                  # Connection pooling
│   └── gemini.ts                   # Gemini integration (returns null + error on failure)
├── models/                         # Mongoose schemas
└── types/index.ts                  # TypeScript interfaces (AgentPlan, AgentPlanReasoning, etc.)

docs/
├── google-cloud-agent-builder-setup.md
├── mongodb-mcp-setup.md
├── hackathon-compliance.md
└── demo-script.md
```

---

## MongoDB Collections

| Collection | Description |
|---|---|
| `emergency_requests` | Disaster reports with type, urgency, location, affected count |
| `volunteers` | Field volunteers with skills, location, vehicle, status |
| `resources` | Supply inventory with type, quantity, location, status |
| `missions` | Coordinator-approved assignments linking request + volunteer + resource |
| `agent_logs` | Audit log of all agent actions and decisions |

All collections are exposed via MongoDB MCP Server for AI agent tool access.

---

## Google Cloud AI Integration Points

### 1. Gemini API (Active)
- File: `src/lib/gemini.ts`
- Set `GEMINI_API_KEY` to activate
- Defaults to `gemini-2.0-flash` model (configurable via `GEMINI_MODEL`)
- Returns `{ result, geminiError }` — never throws; fallback is always available
- Logs: `"Using Gemini planner"`, `"Gemini success"`, `"Gemini failed, fallback active"`

### 2. Vertex AI Agent Builder (Integration Point)
- File: `src/app/api/agent/route.ts`
- Replace `generatePlanWithGemini()` with a Vertex AI Agent session
- Configured tools: `emergency_lookup`, `volunteer_finder`, `resource_allocator`, `mission_writer`
- Full setup: `docs/google-cloud-agent-builder-setup.md`

### 3. MongoDB MCP Server
- All 5 collections ready for MCP tool access
- Full setup: `docs/mongodb-mcp-setup.md`

---

## License

MIT — see [LICENSE](./LICENSE)
