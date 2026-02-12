# Work Plan V2: HIGH/MAJOR Gaps (Tier 2)

**Date**: 2026-02-12
**Updated**: 2026-02-12
**Priority**: HIGH — Limits advanced use cases
**Gaps Covered**: 6 gaps from N8N Gap Analysis Tier 2
**Depends On**: Work Plan V1 (CRITICAL) — DAG executor must be wired first

---

## Completion Summary (2026-02-12)

| Gap | Status | Notes |
|-----|--------|-------|
| GAP 5: AI Agent Sub-Nodes | NOT STARTED | Complex canvas changes needed |
| GAP 6: AI Chain Templates | COMPLETE | `chain-templates.ts` + template selector dropdown in AI Agent panel |
| GAP 7: Vector Stores & RAG | NOT STARTED | Requires external infrastructure |
| GAP 8: Execution History | COMPLETE | RunHistoryTable, API, V2 header tabs, canvas execution indicators (status badges + CSS pulse) |
| GAP 9: Multiple Triggers | NOT STARTED | Requires DAG changes for selective trigger firing |
| GAP 10: 3-Panel All Nodes | PARTIAL (60%) | `isThreePanelNode()` includes flow control. Missing: InputPanel data values, OutputPanel structured data, Execute Step button |

---

## GAP 5: AI Agent Sub-Node Architecture

### Problem
N8N AI Agent has 3 bottom ports (Chat Model*, Memory, Tool) as separate canvas nodes connected via dashed lines. Users can swap models by dragging connections. Vibexe V3 has sub-node types (`chatModel`, `toolNode`, `memoryNode`) as configuration panels inside the agent, not as separate canvas nodes.

### Current State
- Protocol schemas exist: `ChatModelContent`, `ToolNodeContent`, `MemoryNodeContent` in `packages/protocol/`
- These are full operation node types in the `OperationNodeContent` union
- `generation-runner.tsx` returns `null` for these types (lines 61-64: "Sub-nodes are configuration-only; no runner needed")
- V3 AI Agent has inline tool configuration via `tools` array on `AiAgentContent`
- No canvas rendering of sub-nodes, no dashed-line connections

### Implementation Steps

#### Step 5.1: Design sub-node port system
- AI Agent canvas node gets 3 bottom slots:
  - **Chat Model** (required) — small port with red asterisk
  - **Memory** (optional) — small port
  - **Tool** (optional, multiple) — small port with "+" button
- Each slot accepts a connection from a ChatModel/MemoryNode/ToolNode canvas node

**Files**:
- `internal-packages/workflow-designer-ui/src/editor/node/` — canvas node rendering
- Need to add "sub-node ports" (different visual from regular input/output ports)
- Dashed edge style for sub-node connections

#### Step 5.2: Sub-node connection types
**File**: `packages/protocol/src/connection.ts` (or similar)
- Add connection type `"subNode"` alongside existing `"data"` type
- Sub-node connections have: `parentNodeId`, `slotType` ("chatModel"|"memory"|"tool"), `childNodeId`
- These don't carry data — they configure the parent node's behavior

#### Step 5.3: AI Agent resolves sub-nodes at execution time
**File**: `packages/giselle/src/operations/generate-content.ts` (or `execute-ai-agent.ts`)
- When executing an AI Agent:
  1. Find connected Chat Model sub-node → use its provider/model configuration
  2. Find connected Memory sub-node → initialize conversation memory
  3. Find connected Tool sub-nodes → register as available tools
- If no Chat Model connected: fall back to inline `languageModel` config (backward compatible)

#### Step 5.4: Sub-node canvas rendering
**Files**:
- Canvas node component needs to detect sub-node types and render with distinct styling
- Sub-nodes render smaller than regular nodes
- Label shows "Chat Model", "Memory", "Tool"
- Connected via dashed lines instead of solid edges

### Effort: HIGH (~400 lines new, ~200 modified)
### Dependencies: None (parallel with other V2 gaps)

---

## GAP 6: Structured AI Chains

### Problem
N8N has 6 pre-built AI chains: Information Extractor, Sentiment Analysis, Summarization, Text Classifier, AI Transform, Q&A Chain. Vibexe only has generic text generation with custom prompts.

### Current State
- TextGeneration and ContentGeneration nodes handle arbitrary prompts
- AI Agent node has `structuredOutput` field (enabled: boolean, schema: string) — can enforce JSON output
- No pre-built prompt templates or chain types

### Implementation Approach
These are NOT new node types — they are **prompt templates** that configure existing TextGeneration or AiAgent nodes with pre-built system prompts and structured output schemas.

#### Step 6.1: Create chain template registry
**New file**: `packages/giselle/src/chains/chain-templates.ts`

```typescript
interface ChainTemplate {
  id: string;
  name: string;
  description: string;
  category: "extraction" | "analysis" | "transformation";
  systemPrompt: string;
  outputSchema?: object; // JSON Schema for structured output
  inputFields: { name: string; description: string; required: boolean }[];
}
```

Templates:
1. **Information Extractor**: Extract structured fields from text (emails, dates, names, etc.)
2. **Sentiment Analysis**: Classify text as positive/negative/neutral with confidence score
3. **Summarization**: Summarize text with configurable length
4. **Text Classifier**: Classify text into user-defined categories
5. **AI Transform**: Transform data format using natural language instructions

#### Step 6.2: Chain template selector in AI Agent properties
**File**: `internal-packages/workflow-designer-ui/src/editor/properties-panel/ai-agent-node-properties-panel/`

Add "Template" dropdown at the top of AI Agent configuration:
- "Custom" (default — current behavior)
- "Information Extractor"
- "Sentiment Analysis"
- "Summarization"
- "Text Classifier"
- "AI Transform"

Selecting a template auto-fills: system prompt, structured output schema, and adds appropriate input fields.

#### Step 6.3: Node picker category
Show these templates in the node picker under "AI Chains" category alongside "AI Agent" and "Text Generation".

### Effort: MEDIUM (~300 lines new, ~100 modified)
### Dependencies: AI Agent `structuredOutput` execution must work (V1 Gap 1)

---

## GAP 7: Vector Stores & Embeddings (RAG)

### Problem
N8N has full RAG pipeline: Embeddings nodes, Vector Store nodes, Q&A Chain. Vibexe has GitHub/Document vector stores via dedicated VectorStore nodes but no general-purpose embedding or RAG support.

### Current State
- `VectorStoreNode` exists for GitHub repos and uploaded documents
- `QueryNode` searches vector stores with embedding-based similarity
- `packages/giselle/src/operations/execute-query.ts` handles query execution with `queryVectorStore()`
- `@giselles-ai/rag` package exists for embedding metrics
- Missing: general-purpose embedding node, custom vector store support (Pinecone, Weaviate, etc.)

### Implementation Steps

#### Step 7.1: Extend VectorStore to support external providers
**File**: `packages/protocol/src/node/variables/vector-store.ts`

Add provider types:
```typescript
provider: "github" | "document" | "pinecone" | "weaviate" | "qdrant" | "custom"
```

Each provider has its own configuration:
- `pinecone`: `{ apiKey, environment, indexName }`
- `weaviate`: `{ url, apiKey, className }`
- `custom`: `{ baseUrl, apiKey }` (OpenAI-compatible API)

#### Step 7.2: Embeddings configuration
**File**: `packages/protocol/src/node/operations/query-node.ts`

Add embedding model configuration:
- Provider: OpenAI, Cohere, HuggingFace, custom
- Model: text-embedding-3-small, text-embedding-3-large, etc.
- Dimensions: auto-detected from model

#### Step 7.3: Q&A Chain template
Add to chain templates (Gap 6):
- System prompt: "Answer the user's question using the provided context. If the context doesn't contain the answer, say so."
- Input: user question + vector store query results
- Output: answer with source citations

#### Step 7.4: Vector store management UI
**New components**: Upload documents, configure external vector stores, view indexed content
- Settings page: Team settings → Vector Stores → Add/Configure/Delete
- Document upload → automatic chunking → embedding → storage

### Effort: VERY HIGH (~1000+ lines new)
### Dependencies: Requires API keys for embedding providers, external vector store infrastructure

---

## GAP 8: Execution History & Monitoring

### Problem
N8N has an "Executions" tab showing all past runs with data, success/failure, timing. Vibexe has V2HeaderTabs with an Executions tab but the content is empty/placeholder.

### Current State
- `V2HeaderTabs` has "Editor" | "Executions" | "Sharing" tabs
- `V2Footer` has "Run History" button
- Tasks are stored with full metadata: `Task` schema has `status`, `duration`, `usage`, `steps`, `createdAt`, `updatedAt`
- Generation data (inputs, outputs, metrics) is stored in GiselleStorage
- NO execution history UI component exists

### Implementation Steps

#### Step 8.1: Execution history list component
**New file**: `internal-packages/workflow-designer-ui/src/editor/v2/components/execution-history-panel.tsx`

Shows:
```
┌─ Execution History ──────────────────────┐
│                                          │
│  ● Feb 12, 10:32 AM    Completed   4.2s │
│  ● Feb 12, 10:15 AM    Completed   3.8s │
│  ✗ Feb 12, 09:45 AM    Failed      2.1s │
│  ● Feb 12, 09:30 AM    Completed   5.1s │
│                                          │
│  ← Older                                 │
└──────────────────────────────────────────┘
```

Each row shows: status icon (green check / red X / spinner), timestamp, status text, duration, token usage.

#### Step 8.2: Execution detail view
When clicking a past execution:
- Show per-node execution data
- For each node: input data, output data, duration, status
- Canvas overlay: green check / red X / gray circle on each node
- Error details for failed nodes

#### Step 8.3: Wire Executions tab
**File**: `internal-packages/workflow-designer-ui/src/editor/v2/components/v2-header-tabs.tsx`

When "Executions" tab is active:
- Replace canvas area with execution history list
- Or show as a side panel alongside the canvas
- Load task list from storage API

#### Step 8.4: API for listing past executions
**File**: `packages/giselle/src/tasks/` or `apps/studio.giselles.ai/app/api/giselle/`

Endpoint: `GET /api/giselle/tasks?workspaceId=...&limit=50&offset=0`
Returns: List of Task objects with summary data (no full generation outputs — those load on demand)

#### Step 8.5: Canvas execution indicators
**File**: Canvas node rendering components

During execution, show on each canvas node:
- Pending: gray circle
- Running: blue spinner
- Completed: green checkmark
- Failed: red X
- Skipped: dimmed/ghosted

After execution completes, these indicators persist until the user dismisses them.

### Effort: HIGH (~600 lines new, ~100 modified)
### Dependencies: Task storage system (already exists)

---

## GAP 9: Multiple Triggers Per Workflow

### Problem
Vibexe supports only one trigger per workflow. N8N allows multiple triggers ("Add another trigger") so a single workflow can respond to Schedule + Webhook + Chat.

### Current State
- Trigger nodes exist: Manual, GitHub, Schedule, Webhook, Chat
- V4 deployed triggers with DB persistence (scheduled_workflows, webhook_endpoints)
- AppEntry node represents the workflow entry point
- Currently one AppEntry → one trigger chain

### Implementation Steps

#### Step 9.1: Allow multiple trigger nodes on canvas
- Remove restriction that limits to one trigger node per workflow
- Each trigger node connects to the AppEntry node independently
- When any trigger fires, the workflow executes from that trigger's branch

#### Step 9.2: Trigger multiplexing in task creation
**File**: `packages/giselle/src/tasks/create-task.ts`

When creating a task:
- `TaskStarter` already supports different trigger types
- Need to support multiple active triggers per workspace
- Each trigger type registers independently (Schedule cron, Webhook URL, Chat widget)

#### Step 9.3: Multiple trigger registration
**Files**: `apps/studio.giselles.ai/app/api/cron/scheduled-workflows/`, webhook endpoint registration

- Each trigger node in the workflow gets its own registration
- Schedule triggers: multiple cron entries in `scheduled_workflows` table
- Webhook triggers: multiple endpoints in `webhook_endpoints` table
- Chat triggers: multiple chat sessions per workspace

#### Step 9.4: Trigger disambiguation at execution time
When a trigger fires, the DAG executor needs to know which trigger node initiated:
- Start execution from the specific trigger node that fired
- Other trigger nodes in the same workflow are skipped

### Effort: MEDIUM (~200 lines modified)
### Dependencies: V1 Gap 1 (DAG executor must handle selective node firing)

---

## GAP 10: Input/Output Data Visibility (3-Panel for All Nodes)

### Problem
N8N shows INPUT and OUTPUT data for every node in a 3-panel layout. Vibexe has `ThreePanelLayout` but only enables it for generation nodes. Flow control and data transform nodes use single-column panels.

### Current State
- `isThreePanelNode()` in `internal-packages/workflow-designer-ui/src/editor/properties-panel/index.tsx` checks for: TextGeneration, ImageGeneration, ContentGeneration, AiAgent, Integration, DataQuery, Query
- Flow control nodes (if, switch, merge, loop, code, filter, editFields, sort, wait, errorTrigger) all get single-column panel
- `InputPanel` shows upstream connections (just names, not data values)
- `OutputPanel` shows generation results (text/image content)

### Implementation Steps

#### Step 10.1: Extend isThreePanelNode() to include flow control nodes
**File**: `internal-packages/workflow-designer-ui/src/editor/properties-panel/index.tsx`

Add all flow control types to `isThreePanelNode()`:
```typescript
function isThreePanelNode(node: OperationNode): boolean {
  // ... existing generation node checks ...
  // Add:
  if (isIfNode(node) || isSwitchNode(node) || isMergeNode(node) || isLoopNode(node) ||
      isCodeNode(node) || isFilterNode(node) || isEditFieldsNode(node) || isSortNode(node) ||
      isWaitNode(node) || isErrorTriggerNode(node)) {
    return true;
  }
  return false;
}
```

Also update `FloatingPropertiesPanel` to use 900px width for these nodes.

#### Step 10.2: Enhance InputPanel to show data values
**File**: `internal-packages/workflow-designer-ui/src/editor/properties-panel/input-panel.tsx`

Current InputPanel shows connection names. Enhance to show:
- **Schema view**: Field names and types from the last execution's output
- **Table view**: Tabular display of array data
- **JSON view**: Raw JSON of the input data
- View toggle: Schema | Table | JSON (like N8N)

Data source: Load from the upstream node's last completed generation output.

#### Step 10.3: Enhance OutputPanel for structured data
**File**: `internal-packages/workflow-designer-ui/src/editor/properties-panel/output-panel.tsx`

Current OutputPanel shows text generation results. Enhance to show:
- For `StructuredDataOutput`: render JSON tree viewer
- For arrays: render as table with columns from object keys
- Schema/Table/JSON toggle

#### Step 10.4: "Execute step" button
Add to OutputPanel header: a button that executes ONLY this node (after executing all upstream nodes that it depends on).

**File**: Output panel + new API endpoint
- Button: "Execute step" (play icon)
- Flow: Execute all upstream nodes → then execute this node → show output
- Skip downstream nodes

### Effort: HIGH (~500 lines new, ~200 modified)
### Dependencies: V1 Gap 1 (DAG executor with structured data output)

---

## Implementation Order

```
Phase A (Parallel work):
  ├── GAP 8: Execution History (independent, high value)
  ├── GAP 10: 3-Panel for All Nodes (independent, extends existing)
  └── GAP 6: AI Chain Templates (independent, extends AI Agent)

Phase B (After Phase A):
  ├── GAP 5: AI Agent Sub-Nodes (complex, canvas changes)
  └── GAP 9: Multiple Triggers (requires DAG changes)

Phase C (Long-term):
  └── GAP 7: Vector Stores & RAG (external infrastructure needed)
```

---

## Total Effort Summary

| Gap | New Files | Modified Files | Est. Lines | Priority |
|-----|-----------|----------------|------------|----------|
| 5. AI Agent Sub-Nodes | ~3 | ~10 | ~600 | HIGH |
| 6. AI Chain Templates | ~2 | ~5 | ~400 | MEDIUM-HIGH |
| 7. Vector Stores & RAG | ~5 | ~10 | ~1,000+ | HIGH (long) |
| 8. Execution History | ~3 | ~5 | ~700 | HIGH |
| 9. Multiple Triggers | 0 | ~8 | ~200 | MEDIUM |
| 10. 3-Panel All Nodes | ~1 | ~6 | ~700 | HIGH |
| **TOTAL** | **~14** | **~44** | **~3,600** |
