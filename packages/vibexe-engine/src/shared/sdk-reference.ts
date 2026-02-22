/**
 * Shared SDK Reference — Single source of truth for @vibexe/sdk API documentation
 *
 * All agent prompts import from here to ensure consistent, correct SDK signatures.
 * Derived from packages/vibexe-sdk/src/data.ts and packages/vibexe-sdk/src/auth.ts.
 */

/** Core API reference with correct signatures and return types */
export const SDK_API_REFERENCE = `
## @vibexe/sdk — Complete API Reference

\`\`\`typescript
import { VibexeApp } from "@vibexe/sdk";
const app = new VibexeApp({ appId: "..." }); // appId injected at runtime

// ─── CRUD Operations ───
// list() returns PaginatedResponse, NOT a plain array
const result = await app.data.list("tasks");
const result = await app.data.list("tasks", {
  filter: { status: "active", assigned_to: userId },  // "filter" (singular), NOT "filters"
  sort: "created_at",                                  // string field name, NOT an object
  order: "desc",                                       // separate param: "asc" | "desc"
  page: 1,                                             // 1-indexed page number, NOT "offset"
  limit: 50,
});
// result = { data: Task[], pagination: { page, limit, total, totalPages } }
// Access the array: result.data
// Access pagination: result.pagination.total, result.pagination.totalPages

await app.data.get("tasks", id);                      // returns single item directly
await app.data.create("tasks", { title: "New", status: "active" }); // returns created item
await app.data.update("tasks", id, { status: "done" });             // returns updated item
await app.data.delete("tasks", id);                                  // returns void

// ─── Real-Time Subscriptions ───
// subscribe() opens an SSE connection and calls callback on data changes
const unsubscribe = app.data.subscribe("tasks", (event) => {
  // event.entity: string          — e.g. "tasks"
  // event.action: "created" | "updated" | "deleted"
  // event.record: the full row (created/updated) or { id } (deleted)
  // event.timestamp: ISO string
});

// With client-side filter (only receive events matching filter)
const unsub = app.data.subscribe("tasks", { filter: { status: "active" } }, (event) => {
  console.log("Active task changed:", event);
});

// Cleanup — call the returned function to close the connection
unsubscribe();

// ─── Auth ───
// signUp/signIn return AuthResponse { user, token }, NOT user directly
const response = await app.auth.signUp({ email, password, displayName }); // "displayName", NOT "name"
// response = { user: AppUser, token: string }
// response.user = { id, email, display_name, role, email_verified, created_at }

const response = await app.auth.signIn({ email, password });
// response = { user: AppUser, token: string }

await app.auth.signOut();
const user = await app.auth.getCurrentUser();   // returns AppUser | null
app.auth.isAuthenticated();                      // boolean
// Session token: localStorage "vibexe_session" (SDK manages automatically)
\`\`\`

**Entity naming**: \`define_entities\` uses PascalCase names (e.g. "BlogPost"). SDK calls use the auto-generated snake_case table name: \`app.data.list("blog_posts")\`.

### CRITICAL — Common Mistakes to Avoid
| Wrong (agents used to teach this) | Correct |
|-----------------------------------|---------|
| \`filters: { status: "active" }\` | \`filter: { status: "active" }\` (singular) |
| \`sort: { created_at: "desc" }\` | \`sort: "created_at", order: "desc"\` (separate params) |
| \`offset: page * PAGE_SIZE\` | \`page: 1\` (1-indexed page number) |
| \`signUp({ email, password, name })\` | \`signUp({ email, password, displayName })\` |
| \`const data = await app.data.list(...); setItems(data)\` | \`const result = await app.data.list(...); setItems(result.data)\` |
| \`const user = await app.auth.signIn(...)\` | \`const { user } = await app.auth.signIn(...)\` (returns AuthResponse) |
`;

/** Correct data hook pattern showing result.data destructuring */
export const SDK_HOOK_PATTERN = `
## Custom Data Hook Pattern

Every entity gets a dedicated hook that encapsulates ALL SDK interactions:

\`\`\`typescript
// src/hooks/useComments.ts
import { useState, useEffect, useCallback } from "react";
import { VibexeApp } from "@vibexe/sdk";
import type { Comment, CreateCommentInput } from "../types";

const app = new VibexeApp({ appId: "..." });

export function useComments(postId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await app.data.list("comments", {
        filter: { post_id: postId },
        sort: "created_at",
        order: "desc",
      });
      setComments(result.data);  // .data extracts the array from PaginatedResponse
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const createComment = async (input: CreateCommentInput) => {
    const comment = await app.data.create("comments", { ...input, post_id: postId });
    setComments(prev => [comment, ...prev]);
    return comment;
  };

  const deleteComment = async (id: string) => {
    await app.data.delete("comments", id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  // Real-time: auto-update when data changes on server
  useEffect(() => {
    const unsub = app.data.subscribe("comments", { filter: { post_id: postId } }, (event) => {
      if (event.action === "created") setComments(prev => [event.record as Comment, ...prev]);
      if (event.action === "updated") setComments(prev => prev.map(c => c.id === (event.record as Comment).id ? event.record as Comment : c));
      if (event.action === "deleted") setComments(prev => prev.filter(c => c.id !== (event.record as any).id));
    });
    return unsub;
  }, [postId]);

  return { comments, loading, error, createComment, deleteComment, refetch: fetchComments };
}
\`\`\`

### Hook Rules
- **One hook per entity** (or per entity + filter context, like \`useComments(postId)\`)
- **Components call hook methods** — never call \`app.data.*\` directly in components
- **Optimistic updates**: Update local state immediately, revert on error
- **Error handling**: Every SDK call in a try/catch, error stored in hook state
- **Loading states**: Set loading before fetch, clear in finally block
- **list() returns PaginatedResponse**: Always use \`result.data\` to get the array
`;

/** Correct auth flow pattern with AuthResponse destructuring */
export const SDK_AUTH_PATTERN = `
## Auth Flow Pattern

\`\`\`typescript
// src/hooks/useAuth.ts
const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const currentUser = await app.auth.getCurrentUser();
        setUser(currentUser);
      } catch {
        // No valid session — stay logged out
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await app.auth.signIn({ email, password });
    setUser(response.user);  // response = { user, token } — extract .user
    return response.user;
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const response = await app.auth.signUp({ email, password, displayName }); // "displayName", NOT "name"
    setUser(response.user);  // response = { user, token } — extract .user
    return response.user;
  };

  const signOut = async () => {
    await app.auth.signOut();
    setUser(null);
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, signOut, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
\`\`\`

### Auth Patterns
- **Public app**: No auth needed. Anyone can read/write.
- **Login required**: Wrap app with AuthProvider. Show Login/Register when no user.
- **Owner-only data**: The backend enforces RLS automatically — when the entity policy is set to "owner", the server auto-filters queries to \`user_id = currentUser\` and auto-injects \`user_id\` on create. No client-side filter needed.
- **Role-based**: The backend checks \`user.role\` against the entity's allowedRoles list. Use \`user.role\` in UI for conditional rendering: \`if (user.role === "admin")\`

### Row-Level Security (RLS) — Server-Side Enforcement
RLS is enforced automatically by the backend based on entity access policies. No SDK code changes are needed.

| Policy Level | Read Behavior | Write/Delete Behavior |
|-------------|--------------|----------------------|
| \`public\` | Anyone can read, no auth needed | Anyone can write/delete, no auth needed |
| \`authenticated\` | Must be logged in (Bearer token) | Must be logged in |
| \`owner\` | Only see rows where \`user_id\` = your user ID | Can only modify/delete your own rows. \`user_id\` is auto-set on create. |
| \`role\` | Only allowed roles can read | Only allowed roles can write/delete |
| \`custom\` | Server-defined WHERE clause with \`$userId\`/\`$userRole\` | Same custom WHERE for writes/deletes |

**For owner-based apps**: Add a \`user_id\` (number) field to your entities. The backend auto-populates it on create and filters on read/update/delete. Do NOT manually set \`user_id\` in create calls — the server enforces it.

**API key requests bypass RLS entirely** — they represent the app builder (admin access).
`;

/** Common data patterns with correct pagination, search, and cascading delete */
export const SDK_COMMON_PATTERNS = `
## Common Data Patterns

### Pagination
\`\`\`typescript
const PAGE_SIZE = 20;
const [page, setPage] = useState(1);  // 1-indexed
const result = await app.data.list("items", { limit: PAGE_SIZE, page });
setItems(result.data);
setTotalPages(result.pagination.totalPages);
\`\`\`

### Search + Filter
\`\`\`typescript
const fetchFiltered = async (filters: Record<string, string>) => {
  const cleanFilter = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) => v !== "" && v !== "all")
  );
  const result = await app.data.list("tasks", {
    filter: cleanFilter,
    sort: "created_at",
    order: "desc",
  });
  setTasks(result.data);
};
\`\`\`

### Real-Time Subscription
\`\`\`typescript
// Subscribe to entity changes — auto-update UI when data changes
useEffect(() => {
  const unsub = app.data.subscribe("tasks", (event) => {
    if (event.action === "created") setTasks(prev => [...prev, event.record]);
    if (event.action === "updated") setTasks(prev => prev.map(t => t.id === event.record.id ? event.record : t));
    if (event.action === "deleted") setTasks(prev => prev.filter(t => t.id !== event.record.id));
  });
  return unsub; // cleanup on unmount
}, []);
\`\`\`

### Cascading Delete (manual)
\`\`\`typescript
const deleteProject = async (projectId: string) => {
  // Delete children first
  const result = await app.data.list("tasks", { filter: { project_id: projectId } });
  await Promise.all(result.data.map(t => app.data.delete("tasks", t.id)));
  // Then delete parent
  await app.data.delete("projects", projectId);
};
\`\`\`
`;

/** Error catalog entries for build-error-resolver — 6 new API mismatch diagnoses */
export const SDK_ERROR_CATALOG = `
### API Mismatch Errors (commonly caused by wrong SDK usage patterns)

| Error Pattern | Root Cause | Fix |
|--------------|-----------|-----|
| \`data.map is not a function\` or \`TypeError: X.map is not a function\` after \`app.data.list()\` | \`list()\` returns \`{ data: [...], pagination: {...} }\` (PaginatedResponse), NOT a plain array | Change \`const data = await app.data.list(...); data.map(...)\` to \`const result = await app.data.list(...); result.data.map(...)\` |
| \`user.email is undefined\` or \`Cannot read properties of undefined (reading 'email')\` after \`signIn()\` | \`signIn()\` returns \`{ user, token }\` (AuthResponse), NOT the user directly | Change \`const user = await app.auth.signIn(...)\` to \`const { user } = await app.auth.signIn(...)\` or \`const response = await app.auth.signIn(...); response.user\` |
| \`filters\` parameter seems to be ignored — data is not filtered | SDK parameter is \`filter\` (singular), not \`filters\` (plural) | Change \`{ filters: { status: "active" } }\` to \`{ filter: { status: "active" } }\` |
| Data not sorted despite passing sort option | \`sort\` must be a string field name with a separate \`order\` param, NOT an object | Change \`{ sort: { created_at: "desc" } }\` to \`{ sort: "created_at", order: "desc" }\` |
| \`display_name\` is null even though user entered a name on signup | SDK signup parameter is \`displayName\` (camelCase), not \`name\` | Change \`signUp({ email, password, name: "..." })\` to \`signUp({ email, password, displayName: "..." })\` |
| Pagination not working, always shows same data | SDK uses \`page\` (1-indexed page number), not \`offset\` | Change \`{ offset: page * PAGE_SIZE }\` to \`{ page: pageNumber }\` where pageNumber starts at 1 |
`;

/** Review checklist entries for code-reviewer — 6 new API mismatch checks */
export const SDK_REVIEW_CHECKLIST = `
### SDK API Parameter Checks (verify correct parameter names and return types)

| Pattern to Flag | Problem | Correct Usage |
|-----------------|---------|---------------|
| \`filters:\` in SDK list() options | Wrong param name — data won't be filtered | Use \`filter:\` (singular) |
| \`sort: { field: "direction" }\` or \`sort: { created_at: "desc" }\` | Sort must be a string, not an object | Use \`sort: "field_name", order: "asc" \\| "desc"\` |
| \`offset:\` in SDK list() options | Wrong param name — pagination won't work | Use \`page: N\` (1-indexed page number) |
| \`setItems(data)\` or \`data.map()\` directly after \`app.data.list()\` | list() returns PaginatedResponse \`{ data, pagination }\`, not an array | Use \`result.data.map()\` or \`setItems(result.data)\` |
| \`signUp({ name: ... })\` or \`signUp({ ..., name })\` | Wrong param name — display_name won't be saved | Use \`signUp({ displayName: ... })\` |
| \`const user = await app.auth.signIn(...)\` then \`user.email\` | signIn returns \`{ user, token }\`, not user directly | Destructure: \`const { user } = await app.auth.signIn(...)\` |
`;

/** Correct mock return shapes for TDD testing */
export const SDK_MOCK_PATTERNS = `
### SDK Mock Pattern

\`\`\`typescript
// src/utils/__tests__/mocks.ts — SDK mock for testing
export const mockApp = {
  data: {
    list: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((entity, data) =>
      Promise.resolve({ id: "mock-id", ...data, created_at: new Date().toISOString() })
    ),
    update: vi.fn().mockImplementation((entity, id, data) =>
      Promise.resolve({ id, ...data })
    ),
    delete: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => {}), // returns unsubscribe function
  },
  auth: {
    signUp: vi.fn().mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", display_name: null, role: "user", email_verified: false, created_at: new Date().toISOString() },
      token: "mock-token",
    }),
    signIn: vi.fn().mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", display_name: null, role: "user", email_verified: false, created_at: new Date().toISOString() },
      token: "mock-token",
    }),
    signOut: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockReturnValue(null),
    isAuthenticated: vi.fn().mockReturnValue(false),
  },
};
\`\`\`

**Important**: \`list()\` mock returns \`{ data: [], pagination: {...} }\` — NOT a plain array. \`signUp\`/\`signIn\` mocks return \`{ user: {...}, token: "..." }\` — NOT a user object directly.
`;

/** Correct E2E auth flow validation with proper destructuring */
export const SDK_E2E_AUTH_FLOW = `
### Auth Flow Validation Pattern
\`\`\`typescript
async function validateAuthFlow(): Promise<FlowResult> {
  const steps: FlowResult["steps"] = [];
  const testEmail = \\\`e2e-\\\${Date.now()}@test.com\\\`;
  const testPassword = "TestPass123!";

  try {
    // Sign up — returns { user, token }, extract user
    const signUpResponse = await app.auth.signUp({
      email: testEmail,
      password: testPassword,
      displayName: "E2E User",  // "displayName", NOT "name"
    });
    steps.push({ name: "Sign up new user", pass: !!signUpResponse.user?.id });

    // Sign out
    await app.auth.signOut();
    steps.push({ name: "Sign out", pass: !app.auth.isAuthenticated() });

    // Sign back in — returns { user, token }, extract user
    const signInResponse = await app.auth.signIn({ email: testEmail, password: testPassword });
    steps.push({ name: "Sign in", pass: !!signInResponse.user?.id });

    // Check current user
    const current = await app.auth.getCurrentUser();
    steps.push({ name: "Get current user", pass: current?.email === testEmail });

    // Clean up
    await app.auth.signOut();
    steps.push({ name: "Final sign out", pass: true });
  } catch (err) {
    steps.push({ name: "Auth flow", pass: false, error: String(err) });
  }

  return { flow: "Authentication", steps };
}
\`\`\`
`;
