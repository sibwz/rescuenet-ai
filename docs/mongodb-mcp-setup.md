# MongoDB MCP Server — RescueNet AI Integration

## Overview

RescueNet AI exposes its MongoDB Atlas collections to AI agents via the **MongoDB MCP (Model Context Protocol) Server**. This enables AI agents (Gemini, Claude, Agent Builder) to read emergency data, volunteer status, and resource availability directly from the database using natural language tool calls.

---

## What is MongoDB MCP?

The MongoDB MCP Server is an open-source Model Context Protocol server that wraps MongoDB Atlas as a set of queryable AI tools. When connected to an MCP-compatible AI agent, it allows:

- **Reading** documents from any collection via structured queries
- **Writing** documents (creating missions, updating statuses)
- **Aggregating** statistics (dashboard metrics, availability counts)

---

## RescueNet Collections Exposed via MCP

| Collection | Mongoose Model | Purpose |
|---|---|---|
| `emergency_requests` | `EmergencyRequest` | Disaster reports with urgency, location, type |
| `volunteers` | `Volunteer` | Field volunteers with skills and availability |
| `resources` | `Resource` | Supply inventory with type, quantity, location |
| `missions` | `Mission` | Coordinator-approved assignments |
| `agent_logs` | `AgentLog` | Audit log of all agent actions |

---

## How the Agent Uses MCP

```
AI Agent (Gemini / Agent Builder)
        ↓ MCP Tool Call
MongoDB MCP Server
        ↓ MongoDB Query
MongoDB Atlas (rescuenet database)
        ↓ Documents
AI Agent receives structured data
        ↓ Reasoning
Agent generates mission plan
        ↓ MCP Tool Call (write)
Mission saved to missions collection
```

### Example MCP Tool Calls

**Read pending emergencies:**
```json
{
  "tool": "mongodb_find",
  "collection": "emergency_requests",
  "filter": { "status": "pending" },
  "sort": { "urgency": -1 }
}
```

**Read available volunteers:**
```json
{
  "tool": "mongodb_find",
  "collection": "volunteers",
  "filter": { "status": "available" }
}
```

**Create a mission:**
```json
{
  "tool": "mongodb_insert_one",
  "collection": "missions",
  "document": {
    "emergencyRequestId": "...",
    "volunteerId": "...",
    "resourceId": "...",
    "reasoning": "...",
    "status": "active",
    "coordinatorConfirmed": true
  }
}
```

---

## Setup Instructions

### 1. Install MongoDB MCP Server

```bash
npm install -g @mongodb-js/mongodb-mcp-server
```

Or use `npx`:
```bash
npx @mongodb-js/mongodb-mcp-server
```

### 2. Configure Connection

Create an MCP config file (e.g., `mcp.json`):
```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": ["-y", "@mongodb-js/mongodb-mcp-server"],
      "env": {
        "MONGODB_URI": "mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/rescuenet"
      }
    }
  }
}
```

### 3. Connect to Claude Code / Agent Builder

For **Claude Code** (local development):
```json
// .claude/mcp.json
{
  "mcpServers": {
    "mongodb-rescuenet": {
      "command": "npx",
      "args": ["-y", "@mongodb-js/mongodb-mcp-server"],
      "env": {
        "MONGODB_URI": "your-atlas-connection-string"
      }
    }
  }
}
```

For **Google Cloud Agent Builder**, add as a webhook tool pointing to an MCP-to-HTTP bridge, or use the Agent Builder native MongoDB data store connector.

### 4. Verify Collections

After connecting, the agent can list available collections:
```
> list collections in rescuenet database
emergency_requests, volunteers, resources, missions, agent_logs
```

---

## Schema Reference for Agent Tool Use

### emergency_requests
```typescript
{
  reporterName: string
  location: string
  emergencyType: 'medical' | 'food' | 'water' | 'shelter' | 'evacuation'
  description: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  peopleAffected: number
  status: 'pending' | 'assigned' | 'completed'
  createdAt: Date
}
```

### volunteers
```typescript
{
  name: string
  phone: string
  email: string
  location: string
  skills: Array<'medical' | 'transport' | 'food_distribution' | 'rescue' | 'logistics'>
  hasVehicle: boolean
  status: 'available' | 'busy' | 'offline'
}
```

### resources
```typescript
{
  resourceType: 'food' | 'water' | 'medicine' | 'shelter_kits' | 'vehicles'
  quantity: number
  location: string
  status: 'available' | 'assigned' | 'depleted'
}
```

### missions
```typescript
{
  emergencyRequestId: ObjectId  // ref: emergency_requests
  volunteerId: ObjectId         // ref: volunteers
  resourceId: ObjectId          // ref: resources
  status: 'active' | 'completed' | 'cancelled'
  reasoning: string
  coordinatorConfirmed: boolean
  createdAt: Date
}
```

---

## Current Status

The Integrations page at `/integrations` shows the live MongoDB MCP server status. The collections are always ready for MCP access whenever the MongoDB Atlas connection is established. No additional configuration is needed beyond the `MONGODB_URI` environment variable.
