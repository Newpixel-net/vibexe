# N8N vs Vibexe: Comprehensive Gap Analysis

**Date**: 2026-02-12
**Method**: Hands-on exploration of N8N cloud instance (all menus, categories, node configs)

---

## N8N Feature Inventory (Complete)

### "What happens next?" — 7 Categories

| Category | N8N Nodes | Vibexe Equivalent |
|----------|-----------|-------------------|
| AI | 16 nodes | 3 nodes (TextGen, ContentGen, AI Agent) |
| Action in an app | 500+ integrations | ~106 Activepieces integrations |
| Data transformation | 22 nodes | 0 nodes |
| Flow control | 9 nodes | 0 nodes |
| Core | 10 nodes | 0 nodes (HTTP via Activepieces only) |
| Human review | 10 send-and-wait channels | 1 (basic Human Review tool) |
| Triggers | 9 types + 5 "other" | 5 types (GitHub, Manual, Schedule, Webhook, Chat) |

### Trigger Types

| N8N Trigger | Vibexe Status |
|-------------|--------------|
| Trigger manually | YES (Manual trigger) |
| On app event (Telegram, Notion, etc.) | NO |
| On a schedule | YES (Schedule trigger) |
| On webhook call | YES (Webhook trigger) |
| On form submission | NO |
| When executed by another workflow | NO |
| On chat message | YES (Chat trigger) |
| When running evaluation | NO |
| Email Trigger (IMAP) | NO |
| Error Trigger | NO |
| SSE Trigger | NO |
| MCP Server Trigger | NO (has MCP Client only) |

### AI Nodes

| N8N AI Node | Vibexe Status |
|-------------|--------------|
| AI Agent (with Chat Model/Memory/Tool sub-nodes) | PARTIAL (V2 basic, no sub-nodes) |
| Anthropic / OpenAI / Google Gemini / Ollama | YES (as model providers, not nodes) |
| Basic LLM Chain | YES (TextGeneration node) |
| Information Extractor | NO |
| Question and Answer Chain (RAG) | NO |
| Sentiment Analysis | NO |
| Summarization Chain | NO |
| Text Classifier | NO |
| AI Transform | NO |
| Guardrails | NO |
| Evaluation | NO |
| Embeddings | NO |
| Vector Stores | NO |

### Data Transformation Nodes

| N8N Node | Vibexe Status |
|----------|--------------|
| Code (JS/Python) | NO |
| Edit Fields (Set) | NO |
| Date & Time | NO |
| Filter | NO |
| Limit | NO |
| Remove Duplicates | NO |
| Split Out | NO |
| Aggregate | NO |
| Merge | NO |
| Summarize | NO |
| Compression | NO |
| Convert to File | NO |
| Crypto | NO |
| Edit Image | NO |
| Extract from File | NO |
| HTML / Markdown / XML converters | NO |
| Rename Keys | NO |
| Sort | NO |
| AI Transform | NO |

### Flow Control Nodes

| N8N Node | Vibexe Status |
|----------|--------------|
| If (true/false branch) | NO |
| Switch (multi-branch routing) | NO |
| Loop Over Items | NO |
| Filter | NO |
| Merge | NO |
| Compare Datasets | NO |
| Execute Sub-workflow | PARTIAL (tool type only) |
| Stop and Error | NO |
| Wait | NO |

### Core Nodes

| N8N Node | Vibexe Status |
|----------|--------------|
| Code (JS/Python) | NO |
| Data table (persistent) | NO |
| HTTP Request | VIA Activepieces HTTP piece |
| Webhook | YES (trigger only) |
| Execute Sub-workflow | PARTIAL |
| Execution Data | NO |
| FTP/SFTP | NO |
| n8n Form | NO |
| Respond to Webhook | NO |
| Wait | NO |

---

## Gap Analysis — Prioritized

### TIER 1: CRITICAL (Blocks real workflow building)

#### 1. Flow Control Nodes (If, Switch, Loop)
- **N8N**: If node (true/false), Switch (N-way routing with rules), Loop Over Items, Merge
- **Vibexe**: Only linear A→B→C connections. No branching.
- **Impact**: Users literally cannot build conditional workflows. "If sentiment is negative, send to human; otherwise auto-reply" — impossible in Vibexe.
- **Effort**: HIGH — requires new node types, protocol changes, execution engine changes

#### 2. Data Transformation Nodes
- **N8N**: 22 nodes for manipulating data between steps
- **Vibexe**: Zero. Only AI text generation.
- **Impact**: Can't filter, sort, merge, convert, or edit data. Every step must be an AI call or integration.
- **Effort**: HIGH — need at minimum: Code, Edit Fields, Filter, Merge

#### 3. Expression System / Dynamic Data Mapping
- **N8N**: Full expression language (`{{ $json.field }}`, `{{ $now }}`, `{{ $vars }}`), Fixed/Expression toggle on every parameter
- **Vibexe**: Only `{{nodeId:outputId}}` in text prompts. No expressions in integration config fields.
- **Impact**: Can't dynamically reference specific fields from previous nodes. Can only pass entire text blobs.
- **Effort**: VERY HIGH — fundamental architecture change

#### 4. Per-Node Error Handling
- **N8N**: Every node has: Retry On Fail, On Error (Stop/Continue/Ignore), Error Trigger workflow
- **Vibexe**: Errors crash the workflow silently
- **Impact**: No resilience. Production workflows need error recovery.
- **Effort**: MEDIUM

### TIER 2: MAJOR (Limits advanced use cases)

#### 5. AI Agent Sub-Node Architecture
- **N8N**: AI Agent has 3 bottom ports — Chat Model* (required), Memory, Tool. Each is a separate node on the canvas connected via dashed lines. You can swap models by connecting a different Chat Model node.
- **Vibexe**: V2 AI Agent has inline model picker. No sub-node system despite V3 plan.
- **Impact**: Can't visually compose AI agents from reusable parts. Model is locked per agent.
- **Effort**: HIGH — V3 plan exists but was never fully implemented

#### 6. Structured AI Chains
- **N8N**: 6 pre-built AI chains: Information Extractor, Q&A Chain, Sentiment Analysis, Summarization, Text Classifier, AI Transform
- **Vibexe**: Only generic text generation with custom prompts
- **Impact**: Users must write complex prompts from scratch for common AI tasks
- **Effort**: MEDIUM — could be prompt templates or specialized node types

#### 7. Vector Stores & Embeddings (RAG)
- **N8N**: Full RAG pipeline support — Embeddings nodes, Vector Store nodes, Q&A Chain
- **Vibexe**: None
- **Impact**: Can't build "chat with your documents" workflows
- **Effort**: VERY HIGH — needs vector DB integration, embedding pipeline

#### 8. Execution History & Monitoring
- **N8N**: Executions tab shows all past runs, their data, success/failure, timing
- **Vibexe**: No execution history visible in UI
- **Impact**: Can't debug past failures or understand workflow performance
- **Effort**: MEDIUM

#### 9. Multiple Triggers Per Workflow
- **N8N**: "Add another trigger" — workflows can have Schedule + Webhook + Chat triggers
- **Vibexe**: One trigger per workflow
- **Impact**: Users must duplicate workflows for different trigger methods
- **Effort**: MEDIUM

#### 10. Input/Output Data Visibility
- **N8N**: Every node shows its INPUT data (from previous nodes) and OUTPUT data (after execution) in the 3-panel layout. Can toggle Schema/Table/JSON views.
- **Vibexe**: 3-panel layout exists but no live data display
- **Impact**: Can't see what data flows through the pipeline for debugging
- **Effort**: MEDIUM-HIGH

### TIER 3: MODERATE (Nice-to-have for production)

#### 11. AI Guardrails
- **N8N**: Guardrails node — validates AI inputs/outputs against safety rules
- **Vibexe**: None
- **Impact**: No protection against prompt injection or unsafe AI outputs
- **Effort**: MEDIUM

#### 12. Fallback Model
- **N8N**: "Enable Fallback Model" toggle on AI Agent — auto-switches to backup model
- **Vibexe**: Single model per node
- **Impact**: Workflows break if primary model has outage
- **Effort**: LOW-MEDIUM

#### 13. Form Trigger
- **N8N**: n8n Form node generates webforms that trigger workflows
- **Vibexe**: Only Chat Widget for user interaction
- **Impact**: Can't create data collection forms
- **Effort**: MEDIUM

#### 14. App Event Triggers
- **N8N**: "On app event" — triggers from Telegram messages, Notion page updates, Airtable changes, etc.
- **Vibexe**: Only GitHub App trigger; other services need manual webhook setup
- **Impact**: Tedious integration setup
- **Effort**: HIGH (needs webhook registrations per service)

#### 15. Persistent Data Table
- **N8N**: Data table node stores data across executions
- **Vibexe**: None
- **Impact**: Can't accumulate or track data across workflow runs
- **Effort**: LOW (simple DB table + CRUD node)

#### 16. MCP Server Trigger
- **N8N**: Expose workflow as MCP tool for other AI agents
- **Vibexe**: Has MCP Client only
- **Impact**: Can't participate in MCP ecosystem as a server
- **Effort**: MEDIUM

### TIER 4: MINOR (Polish & UX)

| Gap | N8N Feature | Effort |
|-----|------------|--------|
| Sticky Notes | Canvas annotations | LOW |
| Node Versioning | "version 3.1 (Latest)" display | LOW |
| Feedback Button | "I wish this node would..." per node | LOW |
| Code Tool (JS/Python) | Write custom code as AI agent tool | MEDIUM |
| HTTP Request (native) | Dedicated HTTP node with auth | LOW (have Activepieces HTTP) |
| Batch Processing | Process items in batches | MEDIUM |
| Binary Image Passthrough | Auto-pass images through AI chain | LOW |
| Return Intermediate Steps | Show agent's reasoning chain | LOW-MEDIUM |

---

## Summary: What to Build Next (V5 Roadmap Recommendation)

### Phase 1: Flow Control (CRITICAL)
- **If Node** — true/false branching based on conditions
- **Switch Node** — multi-way routing with rules
- **Merge Node** — combine multiple branches back together
- This unlocks: conditional workflows, error routing, A/B testing

### Phase 2: Data Transformation (CRITICAL)
- **Code Node** — Run JavaScript (use isolated VM like vm2)
- **Edit Fields Node** — Add/remove/rename fields
- **Filter Node** — Remove items matching conditions
- This unlocks: data processing between AI steps

### Phase 3: Expression System (CRITICAL)
- **`{{ }}`expression support** in all node parameters, not just prompts
- **Field references**: `{{ nodes["AI Agent"].output.text }}`
- **Built-in variables**: `$now`, `$execution`, `$vars`
- This unlocks: dynamic configuration, data mapping

### Phase 4: AI Agent Sub-Nodes (MAJOR)
- Implement the V3 plan properly: Chat Model, Memory, Tool as canvas sub-nodes
- Bottom ports, dashed edges, separate model picker nodes
- This unlocks: visual AI agent composition, model swapping

### Phase 5: Error Handling & Monitoring (MAJOR)
- Retry on fail per node
- On Error behavior (Stop/Continue/Ignore)
- Error Trigger workflow
- Execution history tab
- This unlocks: production-ready workflows

### Phase 6: Pre-built AI Chains (MAJOR)
- Sentiment Analysis node
- Summarization node
- Information Extractor node
- Text Classifier node
- These are wrappers around text generation with structured prompts

### Phase 7: RAG Pipeline (MAJOR)
- Embeddings node
- Vector Store nodes (Pinecone, Weaviate, etc.)
- Q&A Chain node
- This unlocks: "chat with your documents" workflows

---

## Quick Wins (Low effort, high impact)

1. **Fallback Model toggle** — Add to AI Agent node settings
2. **Sticky Notes on canvas** — Simple text boxes
3. **Persistent Data Table node** — Simple DB CRUD
4. **Multiple triggers per workflow** — Allow N trigger nodes
5. **Node notes/settings tab** — Add description field per node
