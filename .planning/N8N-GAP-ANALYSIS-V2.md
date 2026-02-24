# N8N vs Vibexe: Comprehensive Gap Analysis V2 (Updated)
**Date**: 2026-02-13
**Previous**: V1 gap analysis closed 20 gaps across 6 waves (V6 N8N Parity, commit `80000ba9f`)
**Method**: Systematic exploration of every N8N menu, node type, config panel, and workflow feature
**Purpose**: Identify ALL remaining gaps after V6 deployment

---

## Executive Summary

After V6 deployment (20 original gaps closed), **43 new/remaining gaps** identified. Vibexe is now at **~65% N8N feature parity** (up from ~40% pre-V5).

### Parity Already Achieved (V5+V6)
- If/Switch/Merge/Loop/Wait/Code/Filter/EditFields/Sort nodes (all executing)
- Error handling (retry, timeout, error routing, ErrorTrigger node)
- AI Agent with tools (MCP Client, Human Review, Sub-Workflow, Agent Tool)
- 606 Activepieces integrations with OAuth2 (30 providers registered)
- Mock data per node, sticky notes, node comments, workflow versioning
- Command palette (Cmd+K), JSON export, workflow tags/published
- Triggers: Manual, Schedule, Webhook, Chat, Form, App Event
- Expression system with autocomplete (`{{nodeId:outputId.field}}`)
- Node settings tab (disabled, timeout, retry, onError)
- Execution history with drill-down and logs
- Data table node, form trigger with 7 field types
- Custom Node SDK, 5 chain templates
- 6 AI providers (Anthropic, Google, OpenAI, xAI, NVIDIA, Perplexity)
- 3 embedding providers, hover toolbar, DAG executor

---

## TIER 1: CRITICAL (Core UX - affects every user)

### Gap 1: Input Panel Schema/Table/JSON Views
**N8N**: Input panel has 3 view modes:
- **Schema view**: Tree of field names, types, sample values
- **Table view**: Spreadsheet grid of items
- **JSON view**: Raw JSON with syntax highlighting
- Drag fields from input to parameters (auto-creates expressions)

**Vibexe**: Input panel shows upstream node connections but no structured data preview. Users can't inspect data shape without running workflow.

**Impact**: HIGH - core debugging/authoring workflow

### Gap 2: Edit Output Feature
**N8N**: "Edit Output" button on output panel - manually modify node output after execution. Changes propagate downstream for testing.

**Vibexe**: Output is read-only. Mock data sets fake data BEFORE execution, not editing AFTER.

**Impact**: MEDIUM - limits iterative debugging

### Gap 3: Debug in Editor
**N8N**: "Debug in editor" button on past executions loads all node input/output data into the canvas for visual inspection.

**Vibexe**: Has execution drill-down with step details and logs, but no way to load past execution data into the editor.

**Impact**: HIGH - key workflow for production debugging

### Gap 4: Always Output Data / Execute Once
**N8N**: Two per-node settings:
- **Always Output Data**: Outputs `[{}]` when no results (prevents downstream errors)
- **Execute Once**: Run once regardless of input item count

**Vibexe**: Settings tab has disabled, timeout, retry, onError but not these two.

**Impact**: MEDIUM - causes subtle bugs in complex workflows

### Gap 5: Execution Retry & Tagging
**N8N**:
- **Retry execution**: Re-run failed executions from history
- **Execution tags**: Label executions for filtering
- **Auto-refresh**: Real-time execution list updates
- **Execution saving config**: Choose which executions to persist

**Vibexe**: Has history table but no retry, tagging, or saving config.

**Impact**: MEDIUM - operations workflow

---

## TIER 2: HIGH (Data transformation completeness)

### Gap 6: Limit Node
**N8N**: Keep first N / last N items with offset. Simple item count control.

**Vibexe**: No equivalent. Must use Filter or Code node.

### Gap 7: Remove Duplicates Node
**N8N**: Deduplicate by field(s). Keep first/last occurrence.

**Vibexe**: No equivalent.

### Gap 8: Split Out Node
**N8N**: Expand array field into separate items. Essential for API response processing.

**Vibexe**: No equivalent.

### Gap 9: Aggregate Node
**N8N**: Combine multiple items into one (append to array, key-value pairs, concatenate strings).

**Vibexe**: Merge node has append mode but no single-item aggregation.

### Gap 10: Summarize Node
**N8N**: Statistical operations (count, sum, average, min, max, concatenate) with group-by.

**Vibexe**: No equivalent.

### Gap 11: Compare Datasets Node
**N8N**: Compare two data sets - outputs: only-in-A, only-in-B, in-both. For sync workflows.

**Vibexe**: No equivalent.

### Gap 12: Date & Time Node
**N8N**: Parse, format, add/subtract, round dates. Luxon expressions. Multiple format options.

**Vibexe**: `{{$now}}` exists but no date manipulation node.

### Gap 13: Rename Keys Node
**N8N**: Bulk old-name -> new-name mapping.

**Vibexe**: **PARTIAL** - EditFields has rename, but N8N's dedicated UI is simpler for bulk operations.

---

## TIER 3: MEDIUM (AI pipeline & file handling)

### Gap 14: AI Transform Node
**N8N**: Transform data via plain English ("Extract emails from text", "Convert CSV to JSON"). LLM-powered.

**Vibexe**: Must use text generation node with careful prompting.

### Gap 15: Guardrails Node
**N8N**: Validate AI inputs/outputs against safety rules. Block harmful content, check PII, validate format.

**Vibexe**: AI agent has structured output but no safety validation.

### Gap 16: Evaluation System
**N8N**: Full batch evaluation:
1. Connect test dataset
2. Wire workflow to process each case
3. Define quality metrics (LLM-as-judge)
4. Run batch with results dashboard
- Separate "Evaluations" tab
- "When running evaluation" trigger

**Vibexe**: Per-node Execute Step and mock data, but no batch evaluation.

### Gap 17: Document Loader Nodes
**N8N**: PDF, CSV, JSON, GitHub, Google Drive, Notion loaders for RAG pipelines.

**Vibexe**: File and web page variable nodes but no structured document parsing.

### Gap 18: Text Splitter Nodes
**N8N**: Character, Recursive Character, Token text splitters for embedding.

**Vibexe**: No equivalent.

### Gap 19: Output Parser Nodes
**N8N**: Auto-fixing, Structured, Item List output parsers.

**Vibexe**: **PARTIAL** - AI agent has structured output format. No standalone parser nodes.

### Gap 20: Retriever Nodes
**N8N**: Vector Store, Contextual Compression, Multi-Query retrievers for RAG.

**Vibexe**: Vector store nodes exist (GitHub, document) but no advanced retrieval strategies.

### Gap 21: Compression Node
**N8N**: Gzip, zip, tar compress/decompress.

**Vibexe**: No equivalent.

### Gap 22: Convert to File Node
**N8N**: Data -> CSV, Excel, HTML, iCal, JSON, ODS, RTF, text, XML.

**Vibexe**: No equivalent.

### Gap 23: Crypto Node
**N8N**: Hash (MD5, SHA256), HMAC, encrypt/decrypt, sign/verify.

**Vibexe**: No equivalent.

### Gap 24: Extract from File Node
**N8N**: Parse PDF, CSV, HTML, ICS, RTF, spreadsheets, text.

**Vibexe**: File node handles uploads but not parsing.

### Gap 25: HTML Node
**N8N**: Extract via CSS selectors, convert HTML to text/Markdown.

**Vibexe**: No equivalent.

### Gap 26: Markdown Node
**N8N**: Markdown <-> HTML conversion.

**Vibexe**: No equivalent.

### Gap 27: XML Node
**N8N**: XML <-> JSON conversion.

**Vibexe**: No equivalent.

### Gap 28: Edit Image Node
**N8N**: Crop, resize, rotate, blur, composite, draw text on images.

**Vibexe**: Image generation creates images, no editing.

---

## TIER 4: LOW (Specialized features)

### Gap 29: Execute Sub-workflow Node (Standalone)
**N8N**: Dedicated node to call another workflow passing data in/out. Separate from AI Agent tool.

**Vibexe**: Sub-workflow exists as AI Agent tool type, not standalone node.

### Gap 30: Stop and Error Node
**N8N**: Explicitly stop workflow with error or success. Custom message/data.

**Vibexe**: ErrorTrigger catches errors, but no explicit stop/error node.

### Gap 31: Respond to Webhook Node
**N8N**: Custom HTTP response (body, headers, status) back to webhook caller.

**Vibexe**: Webhook trigger exists but no custom response control.

### Gap 32: No Operation Node
**N8N**: Pass-through placeholder for flow organization.

**Vibexe**: No equivalent.

### Gap 33: FTP Node
**N8N**: FTP/SFTP file transfer.

**Vibexe**: No equivalent. Could use integration pieces.

### Gap 34: Execution Data Node
**N8N**: Access/set execution metadata. Useful for tracking.

**Vibexe**: `{{$execution.id}}` in expressions but no metadata setter.

### Gap 35: Track Time Saved
**N8N**: Calculates automation ROI per execution.

**Vibexe**: No equivalent.

### Gap 36: Workflow Variables ($vars)
**N8N**: Workflow-level variables in settings, accessible everywhere as `$vars.name`.

**Vibexe**: No workflow-level variables. Data flows through connections only.

### Gap 37: Display Note in Flow
**N8N**: Per-node setting to show note text on canvas below the node.

**Vibexe**: Has comments tab and sticky notes, but no inline node note display.

### Gap 38: Ollama / Local LLM Support
**N8N**: Built-in Ollama for local LLMs (Llama, Mistral).

**Vibexe**: All providers cloud-based.

### Gap 39: Insights Panel
**N8N**: Analytics sidebar: execution counts, success rates, time saved, trends.

**Vibexe**: No analytics.

### Gap 40: Chat Panel (In-Editor Testing)
**N8N**: Left sidebar "Chat" for testing chat workflows directly in editor.

**Vibexe**: FloatingChat exists but may not be integrated into editor sidebar.

### Gap 41: Inspiration Panel (Template Browser)
**N8N**: Sidebar template gallery with community workflows and AI suggestions.

**Vibexe**: 5 chain templates, template marketplace "Coming soon".

### Gap 42: AI Chain Nodes as Standalone
**N8N**: Information Extractor, Q&A Chain, Sentiment Analysis, Summarization Chain, Text Classifier as draggable nodes.

**Vibexe**: Exists as chain templates in code, not individual canvas nodes.

### Gap 43: Embeddings as Standalone Nodes
**N8N**: Embedding models as standalone pipeline nodes.

**Vibexe**: Embedding providers in vector store config, not standalone nodes.

---

## Implementation Waves

### Wave 7: Core UX Parity (Recommended Next)
| # | Gap | Effort | Notes |
|---|-----|--------|-------|
| 1 | Input Schema/Table/JSON views | Large | Core data inspection |
| 3 | Debug in Editor | Medium | Load execution into canvas |
| 4 | Always Output Data / Execute Once | Small | 2 toggles on settings tab |
| 5 | Execution Retry & Tagging | Medium | Enhance run history |

### Wave 8: Data Transform Completeness
| # | Gap | Effort | Notes |
|---|-----|--------|-------|
| 6 | Limit | Small | Simple counter node |
| 7 | Remove Duplicates | Small | Field-based dedup |
| 8 | Split Out | Small | Array -> items |
| 9 | Aggregate | Small | Items -> single item |
| 10 | Summarize | Medium | Stats with group-by |
| 11 | Compare Datasets | Medium | Set operations |
| 12 | Date & Time | Medium | Parse/format/math |

### Wave 9: AI Pipeline Maturity
| # | Gap | Effort | Notes |
|---|-----|--------|-------|
| 14 | AI Transform | Medium | LLM-powered data transform |
| 15 | Guardrails | Medium | Input/output safety |
| 16 | Evaluation System | Large | Batch testing + dashboard |

### Wave 10: RAG Pipeline
| # | Gap | Effort | Notes |
|---|-----|--------|-------|
| 17 | Document Loaders | Medium | PDF/CSV/etc. parsing |
| 18 | Text Splitters | Small | Chunking strategies |
| 19 | Output Parsers | Small | Structured parsing |
| 20 | Retrievers | Medium | Advanced RAG strategies |

### Wave 11: File & Conversion Utilities
| # | Gap | Effort | Notes |
|---|-----|--------|-------|
| 21 | Compression | Small | gzip/zip/tar |
| 22 | Convert to File | Medium | Data -> file formats |
| 23 | Crypto | Small | Hash/encrypt/sign |
| 24 | Extract from File | Medium | Parse various formats |
| 25-27 | HTML/Markdown/XML | Small each | Format conversions |
| 28 | Edit Image | Medium | Image manipulation |

### Wave 12: Polish & Specialized
| # | Gap | Effort | Notes |
|---|-----|--------|-------|
| 29-43 | Various | Small each | Sub-workflow, NoOp, FTP, Insights, etc. |

---

## Comparison Scorecard (Post-V6)

| Category | N8N | Vibexe | Status |
|----------|-----|--------|--------|
| **Flow Control** | 9 types | 12 types (all executing) | PARITY+ |
| **Data Transform** | 22 types | 7 types (Code/Filter/EditFields/Sort/DataTable/FormTrigger/ErrorTrigger) | PARTIAL (32%) |
| **Triggers** | 8 types | 6 types | PARTIAL (75%) |
| **AI Providers** | ~5 (OpenAI, Anthropic, Google, Ollama, Cohere) | 6 (OpenAI, Anthropic, Google, xAI, NVIDIA, Perplexity) | PARITY+ |
| **Integrations** | ~500 | 606 Activepieces pieces | PARITY+ |
| **Expression System** | Full (`{{ }}` everywhere + $vars) | `{{nodeId:outputId.field}}` + `$now`/`$execution` | PARTIAL (60%) |
| **Input Data Views** | Schema/Table/JSON | Connection list only | MISSING |
| **Output Features** | Execute Step + Mock + Edit Output | Execute Step + Mock | PARTIAL (67%) |
| **Error Handling** | Per-node retry + On Error + Always Output | Per-node retry + On Error (no Always Output/Execute Once) | PARTIAL (80%) |
| **Execution History** | Debug in editor, retry, tags, config | Table + drill-down + logs | PARTIAL (50%) |
| **Versioning** | Basic undo/redo | Full version save/restore | PARITY+ |
| **AI Pipeline (RAG)** | Loaders, Splitters, Retrievers, Parsers, Embeddings | Vector stores only | PARTIAL (20%) |
| **File Handling** | 8 conversion nodes | None | MISSING |
| **Evaluation** | Full batch system + dashboard | None | MISSING |
| **Custom Nodes** | JavaScript/TypeScript | Custom Node SDK | PARITY |
| **Sticky Notes** | Yes | Yes | PARITY |
| **Command Palette** | Yes | Yes (Cmd+K) | PARITY |
| **Node Comments** | Notes field | Full threaded comments | PARITY+ |
| **Workflow Tags** | Yes | Yes | PARITY |
| **JSON Export** | Yes | Yes | PARITY |

### Overall: ~65% N8N Feature Parity (up from ~40% pre-V5)
- **Strongest areas**: Flow control, AI providers, integrations, versioning, comments
- **Biggest gaps**: Data transform utilities, RAG pipeline, file handling, evaluation system, input data views

---

## Appendix: Full Feature Matrix

### Triggers
| N8N | Vibexe | Status |
|-----|--------|--------|
| Trigger manually | Manual trigger | PARITY |
| On app event | App event trigger | PARITY |
| On a schedule | Schedule trigger | PARITY |
| On webhook call | Webhook trigger | PARITY |
| On form submission | Form trigger | PARITY |
| When called by workflow | Sub-workflow tool | PARTIAL |
| On chat message | Chat trigger | PARITY |
| When running evaluation | - | MISSING |

### Flow Control
| N8N | Vibexe | Status |
|-----|--------|--------|
| If | If node | PARITY |
| Switch | Switch node | PARITY |
| Merge | Merge node (4 modes) | PARITY |
| Loop Over Items | Loop node (forEach/nTimes) | PARITY |
| Wait | Wait node (3 modes) | PARITY |
| Filter | Filter node | PARITY |
| Execute Sub-workflow | Sub-workflow tool | PARTIAL |
| Stop and Error | - | MISSING |
| Compare Datasets | - | MISSING |

### Data Transform
| N8N | Vibexe | Status |
|-----|--------|--------|
| Code | Code node | PARITY |
| Edit Fields (Set) | EditFields node | PARITY |
| Sort | Sort node | PARITY |
| Filter | Filter node | PARITY |
| AI Transform | - | MISSING |
| Date & Time | - | MISSING |
| Limit | - | MISSING |
| Remove Duplicates | - | MISSING |
| Split Out | - | MISSING |
| Aggregate | - | MISSING |
| Summarize | - | MISSING |
| Rename Keys | EditFields (rename) | PARTIAL |
| Compression | - | MISSING |
| Convert to File | - | MISSING |
| Crypto | - | MISSING |
| Edit Image | - | MISSING |
| Extract from File | - | MISSING |
| HTML | - | MISSING |
| Markdown | - | MISSING |
| XML | - | MISSING |

### Core
| N8N | Vibexe | Status |
|-----|--------|--------|
| HTTP Request | Integration (HTTP piece) | PARITY |
| Webhook | Webhook trigger | PARITY |
| Data table | DataTable node | PARITY |
| n8n Form | Form trigger | PARITY |
| Execute Sub-workflow | - | MISSING (standalone) |
| Respond to Webhook | - | MISSING |
| Execution Data | `{{$execution.id}}` | PARTIAL |
| FTP | - | MISSING |
| No Operation | - | MISSING |
| Track Time Saved | - | MISSING |

### AI
| N8N | Vibexe | Status |
|-----|--------|--------|
| AI Agent | AI Agent node | PARITY |
| Text generation | Text/Content generation | PARITY |
| Image generation | Image generation | PARITY |
| AI Templates | 5 chain templates | PARTIAL |
| Guardrails | - | MISSING |
| Evaluation system | - | MISSING |
| AI Transform | - | MISSING |
| Document Loaders | - | MISSING |
| Text Splitters | - | MISSING |
| Output Parsers | Structured output | PARTIAL |
| Retrievers | - | MISSING |
| Embeddings (standalone) | Vector store config | PARTIAL |
| Ollama | - | MISSING |

### Workflow Features
| N8N | Vibexe | Status |
|-----|--------|--------|
| Execution history | Run history + drill-down | PARITY |
| Sticky notes | Sticky notes (5 colors) | PARITY |
| Command palette | Cmd+K | PARITY |
| JSON export | Export action | PARITY |
| Workflow versioning | Version save/restore | PARITY |
| Node comments | Threaded comments | PARITY+ |
| Tags | Tags field | PARITY |
| Custom nodes | Custom Node SDK | PARITY |
| Debug in editor | - | MISSING |
| Edit output | - | MISSING |
| Execution retry | - | MISSING |
| Execution tagging | - | MISSING |
| Always Output Data | - | MISSING |
| Execute Once | - | MISSING |
| Display Note in Flow | - | MISSING |
| Workflow variables | - | MISSING |
| Insights/analytics | - | MISSING |
| Template marketplace | Coming soon badge | MISSING |
| Chat panel (testing) | FloatingChat | PARTIAL |
