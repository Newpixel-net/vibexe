# Vibexe Platform Reorganization Plan

## Executive Summary

Vibexe is built on top of the Giselle AI open-source platform. Currently, the platform has three overlapping features that create confusion:

1. **App Builder** (our custom feature) - AI chat-driven app creation at `/app-builder`
2. **Workspaces** (Giselle's core feature) - Visual node-based workflow/agent builder at `/workspaces`
3. **"Create App" sidebar button** - Creates a Giselle workspace (NOT an App Builder app), causing confusion

This plan reorganizes the entire platform to make **App Builder the primary feature**, uses **workspaces as organizational containers**, and repositions **Giselle's visual workflow builder as a secondary power-user tool** that enhances the App Builder.

---

## Current State Analysis

### Architecture Overview

```
vibexe.online (Next.js app)
|
+-- Sidebar (left navigation)
|   +-- "Create App" button --> POST /api/workspaces --> creates Giselle workspace + agent record
|   |                          --> redirects to /workspaces/{wrks-xxx} (React Flow canvas)
|   |
|   +-- Stage - Run Apps
|   |   +-- Playground
|   |   +-- App Builder (/app-builder)
|   |   +-- Apps (feature-flagged)
|   |   +-- Task History
|   |
|   +-- Studio - Build Apps
|   |   +-- Workspaces (/workspaces)
|   |   +-- Integration
|   |   +-- Vector Stores
|   |   +-- Data Stores (feature-flagged)
|   |
|   +-- Manage
|       +-- Member, Usage, API keys, Team Settings
```

### The Three Systems

#### 1. App Builder (Custom - `/app-builder`)
- **Database**: `builder_apps`, `builder_files`, `builder_chats`, `builder_versions` tables
- **ID format**: `bapp_xxx` (BuilderAppId)
- **Interface**: Chat-based with live Sandpack preview, file explorer, code editor
- **How it works**: User describes app in chat -> AI generates React/TypeScript code -> live preview updates
- **Route**: `/app-builder` (list), `/app-builder/{bapp-id}` (builder)
- **Auth**: Uses `getUser()` from `@/lib/supabase/get-user`
- **Current state**: Fully working, main feature

#### 2. Giselle Workspaces (Original - `/workspaces`)
- **Database**: `workspaces` table (WorkspaceId: `wrks-xxx`) + `agents` table (AgentId: `agnt_xxx`)
- **Interface**: React Flow visual canvas with draggable nodes (text generation, triggers, actions, vector stores)
- **Node types**: Text Generation, GitHub Trigger, GitHub Action, Vector Store (GitHub/Document), App Entry
- **How it works**: Visual drag-and-connect workflow builder -> can create "apps" (API endpoints) from node graphs
- **Route**: `/workspaces` (list), `/workspaces/{wrks-xxx}` (React Flow canvas)
- **Relations**:
  - `workspaces` 1:1 `agents` (agents table is deprecated, workspace table is the source of truth)
  - `workspaces` 1:1 `apps` (Giselle's apps, not our builder_apps)
  - `workspaces` -> `flow_triggers`, `acts` (execution history)
- **Current state**: Working but confusing - terminology mismatch

#### 3. Sidebar "Create App" Button
- **File**: `app/(main)/ui/sidebar/create-app-button.tsx`
- **What it does**: `POST /api/workspaces` -> creates a Giselle workspace + agent record -> redirects to `/workspaces/{wrks-xxx}`
- **The problem**: Says "Create App" but creates a Giselle workspace/visual builder, NOT an App Builder app
- **Identical to**: The "New Workspace" button on the `/workspaces` page (`create-workspace-button.tsx`)

### Key Database Relationships

```
teams
  |-- builder_apps (our apps)       --> builder_files, builder_chats, builder_versions
  |-- workspaces (Giselle)          --> apps (Giselle's apps, linked to workflow nodes)
  |-- agents (deprecated)           --> linked to workspaces via workspaceId
  |-- flow_triggers                 --> linked to workspaces via sdkWorkspaceId
  |-- acts (execution history)      --> linked to workspaces via sdkWorkspaceId
```

### Current Problems

1. **"Create App" button creates a workspace, not an app** - Users clicking "Create App" expect the App Builder, not the visual workflow canvas
2. **Terminology confusion** - "Workspaces" page shows cards called "agents", code references "agents" table (deprecated), UI says "workspaces"
3. **No connection between App Builder and Workspaces** - Builder apps (`builder_apps`) have no relationship to Giselle workspaces (`workspaces`)
4. **Flat structure** - All builder apps belong to a team with no organizational hierarchy
5. **Duplicate functionality** - "Create App" sidebar button and "New Workspace" page button do the exact same thing
6. **Section labels don't match** - "Stage - Run Apps" contains the builder (which creates apps, not runs them), "Studio - Build Apps" contains workspaces (which is the visual builder)

---

## Proposed Reorganization

### Vision

**App Builder is the star.** Everything else supports it.

```
Vibexe Platform
|
+-- App Builder (PRIMARY)
|   +-- Create new apps via AI chat
|   +-- Edit existing apps
|   +-- Live preview + deploy
|
+-- Projects (replaces "Workspaces" as organizational layer)
|   +-- Group related apps together
|   +-- Optional: attach Giselle automations per project
|
+-- Automations (replaces "Workspaces" as the visual builder)
|   +-- Giselle's visual workflow builder (power-user tool)
|   +-- Can be linked to App Builder apps for:
|       +-- Auto-testing
|       +-- Content generation pipelines
|       +-- GitHub integration (CI/CD)
|       +-- Scheduled tasks
```

### Phase 1: Fix the Immediate Confusion (Quick Wins)

**Goal**: Stop confusing users. No database changes. No new features. Just rename things and fix the button.

#### 1.1 Fix "Create App" Sidebar Button

**Current**: Creates a Giselle workspace and redirects to React Flow canvas
**Change**: Redirect to `/app-builder` with auto-create behavior

**File**: `app/(main)/ui/sidebar/create-app-button.tsx`

```
Before: POST /api/workspaces -> redirect to /workspaces/{wrks-xxx}
After:  Navigate to /app-builder (list page, which has its own "New App" button)
OR:     POST server action to create builder_app -> redirect to /app-builder/{bapp-xxx}
```

**Recommended approach**: Make the sidebar "Create App" button directly create a new builder app and redirect to the builder interface. This is what users expect when they click "Create App".

#### 1.2 Rename Sidebar Sections

**File**: `app/(main)/ui/sidebar/sidebar.tsx`

Current:
```
Stage - Run Apps:     Playground, App Builder, Apps, Task History
Studio - Build Apps:  Workspaces, Integration, Vector Stores, Data Stores
```

Proposed:
```
Build:    App Builder, My Apps (list of builder_apps)
Automate: Workflows (renamed from Workspaces), Integration, Vector Stores, Data Stores
Manage:   (unchanged) Member, Usage, API keys, Team Settings
```

Changes:
- Remove "Stage - Run Apps" / "Studio - Build Apps" labels (too Giselle-specific)
- Move "App Builder" to first position in "Build" section
- Rename "Workspaces" -> "Workflows" (more accurate - these ARE visual workflow builders)
- Remove "Playground" from sidebar or move to secondary position (it's a Giselle-specific testing interface)
- Remove "Task History" or rename to "Execution History" under Automate section

#### 1.3 Rename Workspaces Page

**File**: `app/(main)/workspaces/layout.tsx`

- Page heading: "Workspaces" -> "Workflows"
- "New Workspace" button label -> "New Workflow"
- Empty state text: "No workspaces yet" -> "No workflows yet"
- Docs link: keep pointing to Giselle docs (useful reference)

**File**: `app/(main)/workspaces/page.tsx` (the AgentListV2Page)
- No route change needed (URL stays `/workspaces` internally, can add redirect later)
- Update empty state text

#### 1.4 Update Card Labels

**File**: `app/(main)/workspaces/components/agent-card.tsx`
- No changes needed to card itself (shows workspace name + metadata)

**File**: `app/(main)/workspaces/components/searchable-agent-list.tsx`
- Update search placeholder: "Search Workspaces..." -> "Search Workflows..."

### Phase 2: Add Projects Layer (Organizational Structure)

**Goal**: Let users organize their builder apps into projects. This replaces the need for "workspaces as folders".

#### 2.1 Database: Projects Table

```sql
CREATE TABLE builder_projects (
    id TEXT NOT NULL UNIQUE,          -- "bprj_xxx"
    db_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Untitled Project',
    description TEXT,
    team_db_id INTEGER NOT NULL REFERENCES teams(db_id) ON DELETE CASCADE,
    created_by_user_db_id INTEGER NOT NULL REFERENCES users(db_id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add project reference to builder_apps
ALTER TABLE builder_apps ADD COLUMN project_db_id INTEGER REFERENCES builder_projects(db_id) ON DELETE SET NULL;
```

#### 2.2 UI: Project List Page

**Route**: `/projects` or integrate into `/app-builder`

Show project cards, each containing:
- Project name + description
- Count of apps inside
- Last updated timestamp
- "Open" to see apps inside
- "New App" to create an app directly inside this project

#### 2.3 UI: App Builder List Update

**Current**: `/app-builder` shows a flat list of all apps
**Updated**: `/app-builder` shows apps grouped by project, with an "Unorganized" section for apps not in any project

#### 2.4 Sidebar Update

```
Build:
  +-- App Builder (links to /app-builder - shows all apps/projects)

Automate:
  +-- Workflows (links to /workspaces - Giselle visual builder)
  +-- Integration
  +-- Vector Stores
```

### Phase 3: Connect Workflows to App Builder

**Goal**: Make Giselle's visual workflow builder useful for App Builder users by allowing workflows to be attached to builder apps.

#### 3.1 Database: Link Workflows to Builder Apps

```sql
-- Link table: which workflows are connected to which builder apps
CREATE TABLE builder_app_workflows (
    db_id SERIAL PRIMARY KEY,
    builder_app_db_id INTEGER NOT NULL REFERENCES builder_apps(db_id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL, -- Giselle workspace ID (wrks-xxx)
    purpose TEXT,               -- e.g., "testing", "content-pipeline", "ci-cd"
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

#### 3.2 Predefined Workflow Templates

Create workflow templates that App Builder users can one-click attach:

1. **Auto-Test Workflow**: Runs generated code through test scenarios
2. **Content Pipeline**: Generates content (copy, images) for the app
3. **GitHub Sync**: Pushes generated code to a GitHub repository
4. **Scheduled Refresh**: Re-runs AI generation on a schedule to update app content

These use Giselle's existing node system but are pre-configured for App Builder use cases.

#### 3.3 UI: Workflow Tab in App Builder

Add a "Workflows" tab in the App Builder interface (alongside Chat, Code, Preview):
- Shows attached workflows
- "Add Workflow" button to create or attach a Giselle workflow
- Status indicators for active workflows
- Quick-run button to trigger a workflow manually

### Phase 4: Polish and Integration

#### 4.1 Unified Dashboard

Replace the current landing page with a dashboard showing:
- **Recent Apps** (from builder_apps) - cards with preview thumbnails
- **Recent Workflows** (from workspaces) - cards with node count
- **Quick Actions**: "Create App", "Create Workflow", "Browse Templates"
- **Activity Feed**: Recent file changes, workflow executions, deployments

#### 4.2 URL Structure

```
/app-builder              -> App list (grouped by project)
/app-builder/new          -> Create new app (auto-redirect to builder)
/app-builder/{bapp-id}    -> App Builder interface (chat + code + preview)
/projects                 -> Project list
/projects/{bprj-id}       -> Project detail (apps + workflows)
/workflows                -> Workflow list (redirect from /workspaces)
/workflows/{wrks-id}      -> Visual workflow builder (React Flow canvas)
/settings/*               -> Team settings (unchanged)
```

#### 4.3 Deprecation Path for Old Terminology

- Keep `/workspaces` route working (redirect to `/workflows`)
- Keep API endpoints at `/api/workspaces` working (backwards compat)
- Gradually migrate internal code references from "agent" to "workflow"
- The `agents` table is already marked as deprecated - continue migration to `workspaces` table

---

## Implementation Roadmap

### Sprint 1: Stop the Confusion (1-2 days)
- [x] Phase 1.1: Fix "Create App" button to create builder app
- [x] Phase 1.2: Rename sidebar sections
- [x] Phase 1.3: Rename workspaces page heading + buttons
- [x] Phase 1.4: Update search/filter labels

### Sprint 2: Project Organization (3-5 days)
- [ ] Phase 2.1: Create `builder_projects` table + migration
- [ ] Phase 2.2: Projects list page
- [ ] Phase 2.3: Update App Builder list to group by project
- [ ] Phase 2.4: Drag-and-drop apps between projects

### Sprint 3: Workflow Connection (5-7 days)
- [ ] Phase 3.1: `builder_app_workflows` link table
- [ ] Phase 3.2: Create 2-3 workflow templates
- [ ] Phase 3.3: Workflows tab in App Builder

### Sprint 4: Polish (3-5 days)
- [ ] Phase 4.1: Unified dashboard
- [ ] Phase 4.2: URL redirects
- [ ] Phase 4.3: Internal terminology cleanup

---

## Detailed File Changes for Phase 1 (Sprint 1)

### File: `app/(main)/ui/sidebar/create-app-button.tsx`

**Current behavior**:
```typescript
const response = await fetch("/api/workspaces", { method: "POST" });
// Creates Giselle workspace + agent record, redirects to /workspaces/{wrks-xxx}
```

**New behavior**:
```typescript
// Option A: Simply navigate to app-builder list
router.push("/app-builder");

// Option B (recommended): Create a new builder app directly
const response = await fetch("/api/app-builder/apps", { method: "POST" });
// Creates builder_app record, redirects to /app-builder/{bapp-xxx}
```

Button text stays "Create App" (now accurate).

### File: `app/(main)/ui/sidebar/sidebar.tsx`

Replace `createStagePart()` and `createBaseSidebarParts()`:

```typescript
function createBuildPart(): SidebarPart {
    return {
        type: "linkGroup",
        id: "build",
        label: "Build",
        icon: "sparkle",
        links: [
            { id: "app-builder", label: "App Builder", href: "/app-builder", activeMatchPattern: "/app-builder*" },
        ],
    };
}

function createAutomatePart(isDataStoreEnabled: boolean): SidebarPart {
    return {
        type: "linkGroup",
        id: "automate",
        label: "Automate",
        icon: "blocks",
        links: [
            { id: "workflows", label: "Workflows", href: "/workspaces", activeMatchPattern: "/workspaces*" },
            { id: "integration", label: "Integration", href: "/settings/team/integrations", activeMatchPattern: "/settings/team/integrations*" },
            { id: "vector-stores", label: "Vector Stores", href: "/settings/team/vector-stores", activeMatchPattern: "/settings/team/vector-stores*" },
            ...(isDataStoreEnabled ? [{ id: "data-stores", label: "Data Stores", href: "/settings/team/data-stores", activeMatchPattern: "/settings/team/data-stores*" }] : []),
        ],
    };
}
```

Remove: Playground, Task History (or move to "More" section)

### File: `app/(main)/workspaces/layout.tsx`

```tsx
<PageHeading glow>Workflows</PageHeading>
<CreateWorkspaceButton label="New Workflow" />
```

### File: `app/(main)/workspaces/create-workspace-button.tsx`

Update default label:
```tsx
function CreateWorkspaceSubmitButton({ label = "New Workflow" }) {
```

### File: `app/(main)/workspaces/components/search-header.tsx`

Update default placeholder:
```tsx
searchPlaceholder = "Search Workflows...",
```

### File: `app/(main)/workspaces/page.tsx`

Update empty state:
```tsx
<h3>No workflows yet.</h3>
<p>Please create a new workflow with the 'New Workflow +' button.</p>
```

---

## Architecture Diagram (Target State)

```
+------------------------------------------------------------------+
|                        VIBEXE PLATFORM                            |
+------------------------------------------------------------------+
|                                                                    |
|  +-----------------------+    +-----------------------+            |
|  |     APP BUILDER       |    |      WORKFLOWS        |            |
|  |    (PRIMARY)          |    |    (SECONDARY)         |            |
|  |                       |    |                        |            |
|  | - AI Chat Interface   |    | - Visual Node Editor   |            |
|  | - Live Code Preview   |    | - Text Generation      |            |
|  | - File Explorer       |    | - GitHub Integration   |            |
|  | - Code Editor         |    | - Triggers & Actions   |            |
|  | - Deploy              |    | - Vector Stores        |            |
|  |                       |    |                        |            |
|  | DB: builder_apps      |    | DB: workspaces         |            |
|  |     builder_files     |    |     agents (deprecated) |            |
|  |     builder_chats     |    |     flow_triggers      |            |
|  |     builder_versions  |    |     acts               |            |
|  +-----------+-----------+    +-----------+------------+            |
|              |                            |                        |
|              |    +-------------------+   |                        |
|              +--->| PROJECTS          |<--+                        |
|                   | (ORGANIZATION)    |                            |
|                   |                   |                            |
|                   | DB: builder_projects                           |
|                   |     builder_app_workflows                      |
|                   +-------------------+                            |
|                                                                    |
+------------------------------------------------------------------+
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing Giselle workspace functionality | Low | High | Route changes are additive (redirects, not removals). Internal logic unchanged. |
| User confusion during transition | Medium | Medium | Phase 1 is purely cosmetic (labels/buttons). No data migration needed. |
| Database migration for projects | Low | Medium | New tables only, no changes to existing tables (except optional FK on builder_apps). |
| Workflow-to-app linking complexity | Medium | Low | Phase 3 is optional and can be deferred. Core value is in Phase 1+2. |

---

## Success Criteria

After Phase 1:
- "Create App" button creates a builder app (not a Giselle workspace)
- Sidebar clearly separates "Build" (App Builder) from "Automate" (Workflows)
- No user sees "Create App" and ends up in the visual node editor by surprise

After Phase 2:
- Users can create projects to organize their apps
- App Builder list shows apps grouped by project

After Phase 3:
- Giselle workflows can be attached to builder apps
- At least 2 pre-built workflow templates are available

After Phase 4:
- Unified dashboard shows both apps and workflows
- All old URLs redirect properly
- Internal code uses consistent "workflow" terminology (not "agent" or "workspace" interchangeably)

---

## Appendix: Current File Map

### Sidebar
- `app/(main)/ui/sidebar/sidebar.tsx` - Sidebar layout + section definitions
- `app/(main)/ui/sidebar/create-app-button.tsx` - "Create App" button (currently creates workspace)
- `app/(main)/ui/sidebar/sidebar-link.tsx` - Individual sidebar link component

### App Builder (Custom)
- `app/(main)/app-builder/page.tsx` - App list page
- `app/(main)/app-builder/[appId]/page.tsx` - Builder interface (not listed but exists)
- `app/(main)/app-builder/components/` - 20+ components (chat, editor, preview, timeline)
- `app/(main)/app-builder/adapters/` - File, message, phase, sandpack adapters
- `app/(main)/app-builder/types/vibesdk.ts` - Type definitions
- `app/(main)/app-builder/lib/queries.ts` - Database queries for builder_apps

### Workspaces (Giselle)
- `app/(main)/workspaces/page.tsx` - Workspace list (actually queries `agents` table)
- `app/(main)/workspaces/layout.tsx` - Page layout with heading + "New Workspace" button
- `app/(main)/workspaces/create-workspace-button.tsx` - "New Workspace" button
- `app/(main)/workspaces/actions.ts` - Server actions (copy/delete agent)
- `app/(main)/workspaces/components/` - Agent card, search header, LLM provider icon
- `app/api/workspaces/route.ts` - POST endpoint to create workspace + agent

### Giselle Core
- `app/giselle.ts` - NextGiselle initialization, callbacks, storage config
- `packages/giselle/src/workspaces/` - Workspace CRUD (create, get, update, copy, delete)
- `packages/giselle/src/` - Core Giselle SDK (types, protocol, workflow designer)

### Database Schema
- `db/schema.ts` - All table definitions
  - Lines 319-338: `workspaces` table
  - Lines 1170-1213: `builder_apps`, `builder_files`, `builder_chats`, `builder_versions` tables
