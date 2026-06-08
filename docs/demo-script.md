# Demo Script — RescueNet AI

**Time:** 5–7 minutes  
**Audience:** Hackathon judges  
**Goal:** Demonstrate a functional AI coordination agent with Google Cloud AI + MongoDB

---

## Setup (Before the Demo)

1. Ensure the app is running: `npm run dev`
2. Ensure MongoDB Atlas is connected (check the Integrations page)
3. Have `GEMINI_API_KEY` set in `.env.local` (or be ready to demo fallback mode)
4. Clear old missions if needed: go to Missions page

---

## Act 1 — The Problem (30 seconds)

**Say:** "Imagine a major earthquake has hit three cities simultaneously. Emergency coordinators are overwhelmed. They have 6 different emergencies, 7 volunteers with different skill sets, and 8 resource depots across the region. Manually matching the right volunteer with the right resource for the right emergency takes hours. RescueNet AI solves this in seconds."

**Action:** Show the Dashboard — all stats are zero.

---

## Act 2 — Seed the Crisis (30 seconds)

**Say:** "Let me simulate a real disaster scenario."

**Action:** Click **"Seed Demo Data"** on the Dashboard.

**Point out:**
- "6 emergency requests just came in — some critical, some high urgency"
- "7 volunteers are available with different skills"
- "8 resource depots across the region"
- Dashboard updates in real time

---

## Act 3 — Show the Data (60 seconds)

**Navigate to Emergency Requests:**
- Show the critical flood evacuation in Lahore (500 people)
- Show the medical emergency in Karachi
- "All are pending. No one has been assigned yet."

**Navigate to Volunteers:**
- "Here are our field volunteers. Fatima has medical skills, Ahmed has transport, Bilal is in rescue."
- "They're all available but the coordinator doesn't know who to send where."

**Navigate to Resources:**
- "We have medicine in Karachi, vehicles in Lahore, food in multiple depots."
- "The question is: which resource goes where, matched with which volunteer?"

---

## Act 4 — The AI Agent (2 minutes)

**Navigate to AI Agent:**

**Say:** "This is the coordination agent. It's powered by Gemini AI and MongoDB."

**Click "Generate AI Response Plan":**

**While it loads, explain:**
"The agent is reading all 6 emergencies from MongoDB, all 7 volunteers, all 8 resources. It's scoring each emergency by urgency — critical cases get priority score 100. Then it's matching volunteers by skill relevance and location proximity. Same for resources. All of this reasoning is powered by Gemini."

**When plans appear:**

**Point out (30 seconds each plan):**
1. "This is the flood evacuation — critical, 500 people. Gemini prioritized it first. Ahmed was matched because he has transport skills and is in Lahore."
2. "Look at the reasoning section — Priority Reason, Volunteer Match, Resource Allocation, Risk Level, and the Next Action the field team should take immediately."
3. "The coordinator can select or deselect individual plans. This is the human-in-the-loop — no missions are created until the coordinator approves."

**Click "Approve and Create Missions":**

"The coordinator has reviewed and approved. Watch what happens."

**After confirmation:**
- "6 missions created and saved to MongoDB."
- "Volunteers are now marked as busy."
- "Resources are allocated."
- "Emergency requests are marked as assigned."

---

## Act 5 — Mission Tracking (45 seconds)

**Navigate to Missions:**

**Say:** "All missions are now active in MongoDB. The coordinator can see exactly who is going where, with what, and why."

**Point out:**
- Each mission card shows volunteer, resource, emergency details
- The AI reasoning explains every decision
- The coordinator can mark missions as completed as field reports come in

**Mark one mission as completed:** "Mission complete. The system updates in real time."

---

## Act 6 — Integrations (30 seconds)

**Navigate to Integrations:**

**Say:** "Here's the full integration picture."

**Point out:**
- Gemini AI: Configured ✅
- Google Cloud Agent Builder: Configured ✅ (show project ID)
- MongoDB Atlas: Connected ✅ (show all 5 collections)
- MongoDB MCP Server: Configured ✅
- Human Approval Workflow: Enabled ✅

"Every component of the Google Cloud AI + MongoDB partner track is connected."

---

## Act 7 — Fallback Demo (Optional, if Gemini is unavailable)

**If the yellow banner appears:** "You can see Gemini hit a quota limit — that's a real production concern. Notice the yellow banner: 'Gemini unavailable — fallback planner active.' The plans are still generated using our deterministic rule-based planner. The coordinator sees this immediately and the demo never breaks. This is mission-critical software."

---

## Closing (30 seconds)

**Say:** "RescueNet AI demonstrates what a real AI coordination agent looks like:
- It reads context from MongoDB (not just from a prompt)
- It reasons using Gemini AI with structured, explainable decisions
- It plans and prioritizes (not just responds to questions)
- It creates tasks in the database under human oversight
- And it degrades gracefully — never leaving coordinators without a plan

This is an agent. Not a chatbot."

---

## Backup: Key Talking Points

- **"Functional agent, not chatbot"** — It acts on real data, creates real records
- **"Human oversight"** — Coordinator must approve every mission
- **"MongoDB as the brain"** — Agent reads context from and writes results back to MongoDB Atlas
- **"MongoDB MCP"** — Collections are exposed as MCP tools for agent access
- **"Google Cloud AI"** — Gemini is the reasoning engine, Agent Builder is the integration path
- **"Reliable by design"** — Fallback ensures the demo never breaks in front of judges
