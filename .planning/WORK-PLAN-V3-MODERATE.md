# Work Plan V3: MODERATE Gaps (Tier 3)

**Date**: 2026-02-12
**Priority**: MODERATE — Nice-to-have for production
**Gaps Covered**: 6 gaps from N8N Gap Analysis Tier 3
**Depends On**: Work Plans V1 (CRITICAL) and V2 (HIGH)

---

## GAP 11: AI Guardrails

### Problem
N8N has a Guardrails node that validates AI inputs/outputs against safety rules. No protection against prompt injection or unsafe AI outputs in Vibexe.

### Current State
- No guardrail system exists
- AI Agent has `systemPrompt` but no structured safety validation
- No input sanitization before LLM calls
- No output validation after LLM responses

### Implementation

#### Approach: Guardrail Middleware in AI Agent Execution
Rather than a separate node, implement guardrails as a configurable layer on the AI Agent node.

**New schema field** on `AiAgentContent`:
```typescript
guardrails: {
  enabled: boolean;
  inputRules: GuardrailRule[];  // Applied to user input before LLM
  outputRules: GuardrailRule[]; // Applied to LLM output before passing downstream
}

GuardrailRule = {
  type: "blocklist" | "regex" | "length" | "toxicity" | "pii" | "custom";
  config: Record<string, unknown>;
  action: "block" | "warn" | "redact";
}
```

**Built-in rule types:**
1. **Blocklist**: Block specific words/phrases
2. **Regex**: Block patterns (e.g., SQL injection, code execution)
3. **Length**: Min/max character limits
4. **PII**: Detect and redact personal info (email, phone, SSN patterns)
5. **Custom**: User-defined validation function (JavaScript)

**Execution**: Before sending to LLM, run input rules. After receiving response, run output rules. If any rule triggers "block", fail the generation with a guardrail error.

**UI**: Add "Guardrails" section to AI Agent properties panel with rule builder.

### Effort: MEDIUM (~400 lines new)
### Dependencies: AI Agent execution working (V1)

---

## GAP 12: Fallback Model

### Problem
N8N has "Enable Fallback Model" toggle on AI Agent. If primary model fails, automatically tries backup. Vibexe AI Agent has the `fallbackModel` field in protocol but it's not wired to execution.

### Current State
- `AiAgentContent.fallbackModel` exists:
  ```typescript
  fallbackModel: {
    enabled: boolean;
    provider?: LanguageModelProvider;
    id?: LanguageModelId;
    configuration?: Record<string, any>;
  }
  ```
- The field is stored but never read during generation
- No UI to configure the fallback model

### Implementation

#### Step 12.1: Wire fallback to generation execution
**File**: `packages/vibexe/src/operations/generate-content.ts` or equivalent

In the AI Agent execution path:
1. Try primary model
2. If fails (API error, timeout, rate limit):
   - Check `fallbackModel.enabled`
   - If true: retry with fallback model provider/id
   - Log the fallback event
3. If fallback also fails: original error behavior

#### Step 12.2: UI for fallback model selection
**File**: AI Agent properties panel

Add below the primary model picker:
- Toggle: "Enable Fallback Model"
- When enabled: show second model picker (same component as primary)
- Show fallback status in output panel: "Used fallback model: gpt-4o" when triggered

### Effort: LOW (~100 lines modified)
### Dependencies: AI Agent model execution

---

## GAP 13: Form Trigger

### Problem
N8N has an "n8n Form" node that generates webforms triggering workflows. Vibexe only has Chat Widget for user interaction.

### Current State
- Chat trigger exists at `/chat/<workspaceId>` with embeddable widget
- No form-based data collection
- No form builder UI

### Implementation

#### Step 13.1: Form trigger node type
**New file**: `packages/protocol/src/node/operations/form-trigger-node.ts`

Schema:
```typescript
FormTriggerContent = {
  type: "formTrigger";
  fields: FormField[];
  submitButtonText: string;
  successMessage: string;
}

FormField = {
  name: string;
  label: string;
  type: "text" | "number" | "email" | "textarea" | "select" | "checkbox" | "date";
  required: boolean;
  options?: string[]; // for select type
  placeholder?: string;
  defaultValue?: string;
}
```

#### Step 13.2: Form page
**New route**: `apps/studio.vibexe.ai/app/form/[workspaceId]/page.tsx`

Renders a web form based on the FormTrigger node configuration:
- Auto-generated from field definitions
- Responsive, mobile-friendly
- Submit → triggers workflow with form data as structured input
- Show success message after submission

#### Step 13.3: Form builder in properties panel
UI for configuring form fields: drag-to-reorder, add/remove fields, configure labels/types/validation.

#### Step 13.4: Embed script
Similar to chat widget embed script:
```html
<script src="https://vibexe.online/form-embed.js" data-workspace-id="..."></script>
```

### Effort: MEDIUM-HIGH (~600 lines new)
### Dependencies: Trigger system (V4 deployed), DAG execution for data flow

---

## GAP 14: App Event Triggers

### Problem
N8N supports "On app event" triggers from Telegram, Notion, Airtable, etc. Vibexe only has GitHub App trigger; other services need manual webhook setup.

### Current State
- GitHub App trigger exists and works
- Webhook trigger accepts any incoming HTTP POST
- Activepieces integration layer has 106 pieces installed
- Some pieces have trigger capabilities (Slack events, Google Drive changes, etc.)
- No automatic webhook registration for third-party services

### Implementation

#### Step 14.1: Activepieces trigger support
Many Activepieces pieces have trigger definitions (not just actions). Wire these up:

**File**: `packages/activepieces-adapter/src/`

For each piece with triggers:
1. Load trigger definition from piece
2. Register webhook URL with third-party service (using stored OAuth credentials)
3. When webhook fires: resolve to the correct workflow and trigger execution

#### Step 14.2: Trigger registration UI
In trigger node configuration:
- Select service (from installed Activepieces pieces that have triggers)
- Select specific trigger event (e.g., "New message in channel", "Page updated")
- Authenticate (via existing OAuth flow)
- Show webhook URL and registration status

#### Step 14.3: Webhook receiver
**File**: `apps/studio.vibexe.ai/app/api/webhooks/[provider]/route.ts`

Generic webhook receiver that:
1. Matches incoming webhook to registered trigger
2. Extracts event data using piece's trigger parser
3. Creates and starts task for the associated workflow

### Effort: HIGH (~800 lines new)
### Dependencies: OAuth credentials (30 registered), Activepieces adapter

---

## GAP 15: Persistent Data Table

### Problem
N8N has a "Data table" node for persistent storage across workflow executions. Vibexe has no way to accumulate data across runs.

### Current State
- DataStore node exists in protocol (for Supabase-era data queries)
- PostgreSQL database available on server
- No simple key-value or table storage for workflows

### Implementation

#### Step 15.1: Workflow data table schema
**New DB table** via Drizzle migration:

```sql
CREATE TABLE workflow_data_tables (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(db_id),
  name TEXT NOT NULL,
  schema JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workflow_data_rows (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES workflow_data_tables(id),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Step 15.2: Data table node type
**New file**: `packages/protocol/src/node/operations/data-table-node.ts`

Operations: `query` (read), `insert` (add row), `update` (modify row), `delete` (remove row), `upsert` (insert or update)

```typescript
DataTableContent = {
  type: "dataTable";
  tableId: string;
  operation: "query" | "insert" | "update" | "delete" | "upsert";
  filter?: ConditionGroup;  // for query/update/delete
  fields?: FieldOperation[]; // for insert/update/upsert
}
```

#### Step 15.3: Execution handler
**New file**: `packages/vibexe/src/flow-control/execute-data-table.ts`

CRUD operations on `workflow_data_rows` table via Drizzle ORM.
Output: `StructuredDataOutput` with query results or operation status.

#### Step 15.4: Data table management UI
Settings page: Workspace → Data Tables → Create/View/Delete tables
Table viewer: spreadsheet-like view of rows with search/filter

### Effort: MEDIUM (~500 lines new)
### Dependencies: PostgreSQL (available), Drizzle ORM (configured)

---

## GAP 16: MCP Server Trigger

### Problem
N8N can expose workflows as MCP tools for other AI agents to invoke. Vibexe has MCP Client (consuming external MCP servers) but not MCP Server (exposing workflows).

### Current State
- V3 AI Agent has MCP Client tool type (planned, not fully implemented)
- No MCP Server capability
- Webhook trigger could serve as a basic equivalent

### Implementation

#### Step 16.1: MCP Server protocol
**New route**: `apps/studio.vibexe.ai/app/api/mcp/[workspaceId]/route.ts`

Implement MCP (Model Context Protocol) server endpoints:
- `POST /api/mcp/:workspaceId/tools/list` — return available workflows as tools
- `POST /api/mcp/:workspaceId/tools/call` — execute a workflow with provided arguments

Each workflow with a webhook trigger becomes an MCP tool:
- Tool name: workflow name
- Tool description: workflow description
- Tool parameters: derived from trigger node's expected inputs

#### Step 16.2: MCP tool definition generator
For each published workflow:
- Extract input schema from trigger/appEntry node
- Generate MCP tool definition with JSON Schema parameters
- Include description from workflow metadata

#### Step 16.3: MCP discovery endpoint
Standard MCP server info endpoint for agent discovery:
- Server name, version, capabilities
- Tool list with schemas

### Effort: MEDIUM (~400 lines new)
### Dependencies: Webhook trigger system (V4 deployed)

---

## Implementation Order

```
Phase A (Quick wins):
  ├── GAP 12: Fallback Model — LOW effort, field exists, just wire execution
  └── GAP 15: Data Table — MEDIUM effort, high value for production

Phase B (Medium complexity):
  ├── GAP 11: AI Guardrails — MEDIUM effort
  ├── GAP 13: Form Trigger — MEDIUM-HIGH effort
  └── GAP 16: MCP Server — MEDIUM effort

Phase C (Complex):
  └── GAP 14: App Event Triggers — HIGH effort, depends on OAuth
```

---

## Total Effort Summary

| Gap | New Files | Modified Files | Est. Lines | Priority |
|-----|-----------|----------------|------------|----------|
| 11. AI Guardrails | ~2 | ~3 | ~400 | MEDIUM |
| 12. Fallback Model | 0 | ~3 | ~100 | LOW (quick win) |
| 13. Form Trigger | ~4 | ~3 | ~600 | MEDIUM-HIGH |
| 14. App Event Triggers | ~3 | ~5 | ~800 | HIGH |
| 15. Data Table | ~4 | ~3 | ~500 | MEDIUM |
| 16. MCP Server | ~3 | ~2 | ~400 | MEDIUM |
| **TOTAL** | **~16** | **~19** | **~2,800** |
