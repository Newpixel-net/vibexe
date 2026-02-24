# OAuth2 One-Click Connect - Implementation Plan

## Goal

Replace the current manual "paste your access token" credential form with a **one-click "Connect [Service]"** button that walks users through the standard OAuth consent flow and automatically stores tokens.

**User experience target:**
1. User clicks "Connect Slack" on an integration node
2. Popup opens showing Slack's "Allow access?" consent screen
3. User clicks "Allow"
4. Popup closes, credential is saved, node is ready to execute

---

## Architecture Overview

```
User clicks "Connect Slack"
        |
        v
[Frontend] opens popup to /api/integrations/oauth2/authorize?pieceName=slack
        |
        v
[Authorize Route] looks up:
  - authUrl, tokenUrl, scope from piece metadata (piece-inspector)
  - client_id, client_secret from oauth_app_configs DB table
  - Generates state token, stores in cookie
  - Redirects user to https://slack.com/oauth/v2/authorize?client_id=...&scope=...
        |
        v
User consents on Slack's website
        |
        v
Slack redirects to /api/integrations/oauth2/callback?code=xxx&state=yyy
        |
        v
[Callback Route]:
  1. Validates state token
  2. Exchanges auth code for tokens (POST to tokenUrl with client_secret)
  3. Stores encrypted tokens in integration_credentials table
  4. Returns HTML that calls window.opener.postMessage({credentialId})
  5. Popup closes automatically
        |
        v
[Frontend] receives postMessage, auto-selects new credential on the node
        |
        v
[Execution] When node runs:
  1. Loads credential from DB
  2. Calls ensureFreshToken() to auto-refresh if expired
  3. Passes fresh access_token to Activepieces piece action
```

---

## Phase 1: OAuth App Configuration Storage

**Goal:** Admin can store client_id + client_secret per OAuth provider, encrypted in DB.

### Tasks

#### 1.1 Create `oauth_app_configs` DB table

**File:** `apps/studio.vibexe.ai/db/schema.ts`

```sql
oauth_app_configs (
  db_id        SERIAL PRIMARY KEY,
  provider     TEXT NOT NULL UNIQUE,  -- "google", "slack", "discord", "microsoft", etc.
  client_id    TEXT NOT NULL,
  encrypted_client_secret TEXT NOT NULL,  -- encrypted via token-encryption
  scopes       TEXT,                  -- optional override, comma-separated
  extra_params JSONB DEFAULT '{}',    -- e.g. {"access_type": "offline", "prompt": "consent"}
  enabled      BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
)
```

The `provider` field maps to a **provider group**, not a piece name. One Google config covers google-sheets, google-drive, gmail, google-calendar, google-contacts, google-forms. One Microsoft config covers microsoft-teams, microsoft-outlook, microsoft-onedrive, etc.

#### 1.2 Create provider-to-piece mapping

**File:** `packages/activepieces-adapter/src/oauth-providers.ts`

Maps piece names to their OAuth provider group:

```typescript
const PIECE_TO_PROVIDER: Record<string, string> = {
  // Google
  "google-sheets": "google",
  "google-drive": "google",
  "gmail": "google",
  "google-calendar": "google",
  "google-contacts": "google",
  "google-forms": "google",
  "google-slides": "google",
  "google-tasks": "google",
  // Microsoft
  "microsoft-teams": "microsoft",
  "microsoft-outlook": "microsoft",
  "microsoft-onedrive": "microsoft",
  "microsoft-excel-365": "microsoft",
  // Individual
  "slack": "slack",
  "discord": "discord",
  "notion": "notion",
  "github": "github",
  "airtable": "airtable",
  "hubspot": "hubspot",
  "salesforce": "salesforce",
  "shopify": "shopify",
  // ... etc
};

export function getOAuthProvider(pieceName: string): string | null;
```

Export from `src/index.ts`.

#### 1.3 Create CRUD service for OAuth app configs

**File:** `apps/studio.vibexe.ai/services/integrations/oauth-app-config.ts`

- `getOAuthAppConfig(provider: string)` -- returns decrypted config
- `getAllOAuthAppConfigs()` -- list all (client_secret masked for UI)
- `upsertOAuthAppConfig({ provider, clientId, clientSecret, scopes?, extraParams? })`
- `deleteOAuthAppConfig(provider: string)`
- `isOAuthConfigured(provider: string)` -- quick boolean check

#### 1.4 Create admin API routes

**File:** `apps/studio.vibexe.ai/app/api/admin/oauth-apps/route.ts`

- `GET /api/admin/oauth-apps` -- list all configs (secrets masked)
- `POST /api/admin/oauth-apps` -- create/update config
- `DELETE /api/admin/oauth-apps?provider=slack` -- remove config

Protect with admin auth check (team owner or site admin).

#### 1.5 Create admin settings page

**File:** `apps/studio.vibexe.ai/app/(main)/settings/team/oauth-apps/page.tsx`

Simple table showing:
| Provider | Client ID | Status | Actions |
|----------|-----------|--------|---------|
| Google   | 1234...abc | Configured | Edit / Delete |
| Slack    | 9876...xyz | Configured | Edit / Delete |
| Discord  | (not set) | Not configured | Configure |

With a form to add/edit: Provider dropdown, Client ID field, Client Secret field (password input).

### Deliverable
- Admin can add Google and Slack OAuth app configs via the settings page
- Configs are stored encrypted in DB
- API endpoint confirms config exists for a given provider

---

## Phase 2: Fix OAuth2 Authorization & Token Exchange

**Goal:** The full OAuth2 flow works end-to-end: authorize -> consent -> callback -> token exchange -> credential stored.

### Tasks

#### 2.1 Create piece auth metadata extractor

**File:** `packages/activepieces-adapter/src/piece-auth-metadata.ts`

Function that extracts OAuth2 config from an installed piece:

```typescript
interface PieceOAuth2Metadata {
  authUrl: string;
  tokenUrl: string;
  scope: string[];
  pkce?: boolean;
  authorizationMethod?: "HEADER" | "BODY";
  extra?: Record<string, string>;
}

export async function getPieceOAuth2Metadata(pieceName: string): Promise<PieceOAuth2Metadata | null>;
```

This loads the piece, accesses its `.auth` property, and extracts the OAuth2 config fields (authUrl, tokenUrl, scope, etc.) from it.

Export from `src/server.ts` (server-only since it loads piece packages).

#### 2.2 Create API route to check OAuth availability

**File:** `apps/studio.vibexe.ai/app/api/integrations/oauth2/status/route.ts`

`GET /api/integrations/oauth2/status?pieceName=slack`

Returns:
```json
{
  "available": true,
  "provider": "slack",
  "authType": "oauth2",
  "configured": true,
  "authUrl": "https://slack.com/oauth/v2/authorize",
  "scopes": ["channels:read", "chat:write", ...]
}
```

Or `{ "available": false, "reason": "No OAuth app configured for provider: slack" }`.

This is the endpoint the UI calls to decide whether to show the "Connect" button vs. manual form.

#### 2.3 Rewrite authorize route

**File:** `apps/studio.vibexe.ai/app/api/integrations/oauth2/authorize/route.ts`

Current route takes `authUrl`, `clientId`, `scope` as query params from the frontend (insecure).

New flow:
1. Accept only `pieceName` as query param
2. Look up `provider` from piece-to-provider mapping
3. Load `client_id` + `client_secret` from `oauth_app_configs` table
4. Load `authUrl`, `tokenUrl`, `scope` from piece auth metadata
5. Generate cryptographic `state` token
6. Store `{ state, pieceName, provider, tokenUrl }` in encrypted cookie (10-min TTL)
7. Build authorization URL with proper params
8. Redirect to provider's consent screen

The client_id and client_secret **never leave the server**. The frontend only passes `pieceName`.

#### 2.4 Rewrite callback route (TOKEN EXCHANGE)

**File:** `apps/studio.vibexe.ai/app/api/integrations/oauth2/callback/route.ts`

This is the critical fix. Current code stores the raw auth code. New flow:

1. Validate `state` from cookie
2. Retrieve `pieceName`, `provider`, `tokenUrl` from cookie
3. Load `client_id`, `client_secret` from `oauth_app_configs`
4. **Exchange auth code for tokens:**
   ```
   POST {tokenUrl}
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   code={authorizationCode}
   redirect_uri={our callback URL}
   client_id={client_id}
   client_secret={client_secret}
   ```
5. Parse token response: `{ access_token, refresh_token, expires_in, token_type, scope, ... }`
6. Handle provider-specific quirks:
   - Slack: response has nested `authed_user.access_token` in body
   - Google: always returns `refresh_token` only on first auth (need `prompt=consent`)
7. Store in `integration_credentials`:
   ```typescript
   config: {
     accessToken: tokenResponse.access_token,
     refreshToken: tokenResponse.refresh_token,
     expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
     tokenType: tokenResponse.token_type ?? "Bearer",
     scope: tokenResponse.scope,
     data: tokenResponse,  // Full raw response for pieces like Slack
     // For refresh:
     provider: provider,
     tokenUrl: tokenUrl,
   }
   ```
8. Return HTML page that sends `postMessage` to opener and closes:
   ```html
   <script>
     window.opener.postMessage({
       type: 'oauth2-callback',
       credentialId: {id},
       pieceName: '{pieceName}',
       displayName: '{Service} (OAuth2)'
     }, window.location.origin);
     window.close();
   </script>
   ```

#### 2.5 Handle authorization method variants

Some providers want credentials in the Authorization header (Basic auth), others in the POST body. Respect the `authorizationMethod` from piece metadata:

- `HEADER`: `Authorization: Basic base64(client_id:client_secret)` (standard RFC)
- `BODY`: Include `client_id` and `client_secret` in the POST body (Slack, some others)

### Deliverable
- Clicking authorize link for Slack/Google opens consent screen
- After consent, callback exchanges code for real tokens
- Tokens are stored encrypted in DB with all needed fields
- Popup closes with credential ID

---

## Phase 3: Token Refresh in Execution Pipeline

**Goal:** Expired OAuth2 tokens are automatically refreshed before piece execution.

### Tasks

#### 3.1 Wire ensureFreshToken() into execute-integration.ts

**File:** `packages/vibexe/src/operations/execute-integration.ts`

After loading the credential, before passing to `executePieceAction`:

```typescript
let auth: unknown = null;
const credentialId = operationNode.content.credentialId;
if (credentialId && args.context.resolveIntegrationCredential) {
    const credential = await args.context.resolveIntegrationCredential(credentialId);
    if (credential && credential.authType === "oauth2") {
        // Auto-refresh if token is expired or about to expire
        const refreshed = await ensureFreshToken(credential, {
            updateCredential: args.context.updateIntegrationCredential,
        });
        auth = resolveAuth(refreshed);
    } else if (credential) {
        auth = resolveAuth(credential);
    }
}
```

#### 3.2 Fix ensureFreshToken() implementation

**File:** `packages/activepieces-adapter/src/token-refresh.ts`

The existing function needs to:
1. Check if `expiresAt` is within 5 minutes of now
2. If so, POST to `tokenUrl` with `grant_type=refresh_token`
3. Look up `client_id` + `client_secret` from the stored credential config (provider + tokenUrl stored in Phase 2.4)
4. Update the stored credential with new tokens
5. Return the refreshed credential

#### 3.3 Add updateIntegrationCredential to context

**File:** `packages/vibexe/src/types/context.ts`

Add to `VibexeContext`:
```typescript
updateIntegrationCredential?: (credentialId: string, config: Record<string, unknown>) => Promise<void>;
```

**File:** `packages/vibexe/src/vibexe.ts`

Wire it up in `onRequest`:
```typescript
updateIntegrationCredential: async (credentialId, newConfig) => {
    const { updateCredential } = await import("@/services/integrations/credential-store");
    await updateCredential({
        teamDbId: team.dbId,
        credentialId: Number.parseInt(credentialId, 10),
        config: newConfig,
    });
},
```

#### 3.4 Handle refresh failures gracefully

If refresh fails (e.g., user revoked access):
- Log the error
- Return a clear error message: "Your [Slack] connection has expired. Please reconnect."
- Set a `connectionStatus: "expired"` flag on the credential
- UI shows a "Reconnect" button instead of the connected status

### Deliverable
- Expired Google/Slack tokens auto-refresh transparently
- Users never see "token expired" errors for active connections
- Revoked tokens show clear "Reconnect" message

---

## Phase 4: One-Click Connect UI

**Goal:** Integration node properties panel shows a "Connect [Service]" button that triggers the OAuth popup flow.

### Tasks

#### 4.1 Create OAuthConnectButton component

**File:** `internal-packages/workflow-designer-ui/src/editor/properties-panel/integration-node-properties-panel/oauth-connect-button.tsx`

```tsx
function OAuthConnectButton({ pieceName, onConnected }) {
  const [status, setStatus] = useState<"idle" | "checking" | "connecting" | "connected">("idle");

  // On mount: check /api/integrations/oauth2/status?pieceName=...
  // If configured: show "Connect [Service]" button
  // If not configured: show "OAuth not available - use manual credentials"

  const handleConnect = () => {
    // Open popup: /api/integrations/oauth2/authorize?pieceName=slack
    const popup = window.open(url, "oauth-connect", "width=600,height=700");

    // Listen for postMessage from callback
    window.addEventListener("message", (event) => {
      if (event.data.type === "oauth2-callback") {
        onConnected(event.data.credentialId);
        popup?.close();
      }
    });
  };

  return (
    <button onClick={handleConnect}>
      Connect {displayName}
    </button>
  );
}
```

#### 4.2 Update CredentialSelector to show connect button

**File:** `internal-packages/workflow-designer-ui/src/editor/properties-panel/integration-node-properties-panel/credential-selector.tsx`

Current flow: Dropdown + "Add new credential" (opens manual form).

New flow:
1. Check if OAuth is configured for this piece (call status endpoint)
2. If yes: Show **"Connect [Service]"** button prominently
3. Below it: Dropdown to select existing credentials (if any)
4. Small link: "Or enter credentials manually" (for advanced users / API keys)

Visual hierarchy:
```
[  Connect Slack  ]              <-- Primary CTA, category-colored

Connected accounts:
  [v] Slack (OAuth2) - volta@...  <-- Dropdown if credentials exist

  Or enter credentials manually   <-- Small text link
```

#### 4.3 Show connection status on credential

After connecting, show:
- Green dot + "Connected" + account display name (if available from token data)
- Disconnect button (deletes credential)
- "Reconnect" button (if token refresh failed)

#### 4.4 Auto-select credential after OAuth flow

When the postMessage callback fires with a `credentialId`:
1. Auto-select it in the dropdown
2. Update the node's `credentialId` in the store
3. Show success animation briefly

### Deliverable
- "Connect Slack" button appears when OAuth is configured for that provider
- Clicking opens popup, user consents, popup closes, credential auto-selected
- Manual form still available as fallback
- Connected status shown with account info

---

## Phase 5: Auth Metadata Extraction from Pieces

**Goal:** Automatically read authUrl, tokenUrl, scope from installed piece packages so we never hardcode provider-specific URLs.

### Tasks

#### 5.1 Implement getPieceOAuth2Metadata

**File:** `packages/activepieces-adapter/src/piece-auth-metadata.ts`

Load the piece package dynamically, access its `auth` export, extract:
- `authUrl` (string)
- `tokenUrl` (string)
- `scope` (string[])
- `pkce` (boolean)
- `authorizationMethod` ("HEADER" | "BODY")
- `extra` (Record<string, string>)
- `grantType` (string)

Handle edge cases:
- Some pieces export auth as an array (Google Sheets: [OAuth2, CustomAuth]) -- pick the OAuth2 entry
- Some pieces don't have OAuth2 auth at all -- return null
- Some pieces have dynamic scopes based on props -- use the base scope array

#### 5.2 Create auth metadata API endpoint

**File:** `apps/studio.vibexe.ai/app/api/integrations/pieces/[name]/auth/route.ts`

`GET /api/integrations/pieces/slack/auth`

Returns:
```json
{
  "authType": "oauth2",
  "authUrl": "https://slack.com/oauth/v2/authorize",
  "tokenUrl": "https://slack.com/api/oauth.v2.access",
  "scope": ["channels:read", "chat:write", ...],
  "authorizationMethod": "BODY",
  "pkce": false
}
```

This powers the authorize route (Phase 2.3) — it reads piece metadata instead of hardcoding URLs.

#### 5.3 Cache auth metadata

Piece metadata is static — cache it in-memory on first load. Use a simple Map with piece name as key. Invalidate on server restart only.

### Deliverable
- Auth metadata for all installed pieces is available via API
- Authorize route reads real piece config instead of hardcoded values
- Adding a new piece automatically makes its OAuth flow available (no code changes needed)

---

## Phase 6: Provider Registration & Initial Configuration

**Goal:** Register OAuth apps with the top providers and configure them in the admin panel.

### Tasks

#### 6.1 Register Google OAuth App
- Google Cloud Console -> APIs & Services -> Credentials
- Create OAuth 2.0 Client ID (Web Application)
- Authorized redirect URI: `https://vibexe.online/api/integrations/oauth2/callback`
- Enable APIs: Google Sheets, Drive, Gmail, Calendar, Contacts, Forms
- Scopes: combine all Google Workspace piece scopes
- Add to admin panel

#### 6.2 Register Slack OAuth App
- api.slack.com/apps -> Create New App
- Redirect URL: `https://vibexe.online/api/integrations/oauth2/callback`
- Bot Token Scopes: from Slack piece metadata
- User Token Scopes: from Slack piece metadata
- Add to admin panel

#### 6.3 Register Discord OAuth App
- discord.com/developers/applications
- Redirects: `https://vibexe.online/api/integrations/oauth2/callback`

#### 6.4 Register Microsoft OAuth App
- Azure Portal -> App Registrations
- Redirect URI: `https://vibexe.online/api/integrations/oauth2/callback`
- API Permissions: Microsoft Graph (Mail, Calendar, Files, Teams)

#### 6.5 Register remaining providers
- GitHub, Notion, Airtable, HubSpot, Salesforce, Shopify
- Each one: create app, set redirect URI, add to admin panel

#### 6.6 Document the registration process
- Create a guide for adding new OAuth providers
- Include screenshots / links to each developer console
- Document any provider-specific quirks (Slack nested tokens, Google refresh token behavior, etc.)

### Deliverable
- Top 10 providers configured and tested
- Documentation for adding more providers

---

## Phase 7: Joint Review & UAT

**Goal:** Walk through the complete flow together, verify everything works, catch edge cases.

### Review Checklist

#### Functional Tests
- [ ] Admin can add/edit/delete OAuth app configs in settings
- [ ] "Connect" button appears for configured providers (Slack, Google, etc.)
- [ ] "Connect" button does NOT appear for unconfigured providers
- [ ] OAuth popup opens and shows provider consent screen
- [ ] After consent, popup closes and credential is auto-selected
- [ ] Node execution works with the new credential
- [ ] Token refresh works transparently (simulate expired token)
- [ ] Revoked token shows "Reconnect" message
- [ ] Manual credential form still works as fallback
- [ ] Non-OAuth pieces (API key, none) are unaffected

#### Provider-Specific Tests
- [ ] Google Sheets: Connect -> insert_row action works
- [ ] Gmail: Connect -> send_email action works
- [ ] Slack: Connect -> send_message action works
- [ ] Discord: Connect -> send_message action works
- [ ] HTTP piece (no auth): still works without credential

#### Security Tests
- [ ] client_secret never exposed to frontend
- [ ] state parameter validated correctly
- [ ] CSRF protection working
- [ ] Tokens encrypted at rest in DB
- [ ] OAuth popup only opens on same origin
- [ ] Cookie-based state has proper httpOnly + secure flags

#### UX Tests
- [ ] Loading states during OAuth flow
- [ ] Error handling: user denies consent
- [ ] Error handling: popup blocked by browser
- [ ] Error handling: provider returns error
- [ ] Multiple credentials for same provider (e.g., 2 Slack workspaces)
- [ ] Credential deletion and re-connection
- [ ] Mobile responsiveness of connect button

#### Edge Cases
- [ ] Google: only returns refresh_token on first auth (prompt=consent)
- [ ] Slack: nested authed_user token structure
- [ ] Microsoft: multi-tenant vs single-tenant
- [ ] Provider rate limits during token exchange
- [ ] Concurrent OAuth flows from same user

---

## Implementation Order & Dependencies

```
Phase 1 (OAuth App Config Storage)
  |
  v
Phase 5 (Auth Metadata Extraction) --+
  |                                   |
  v                                   v
Phase 2 (Fix OAuth2 Flow) <----------+
  |
  v
Phase 3 (Token Refresh)
  |
  v
Phase 4 (One-Click Connect UI)
  |
  v
Phase 6 (Provider Registration)
  |
  v
Phase 7 (Joint Review & UAT)
```

**Phases 1 and 5 can run in parallel.**
Phase 2 depends on both Phase 1 (needs client_id/secret from DB) and Phase 5 (needs authUrl/tokenUrl from pieces).
Phase 3 depends on Phase 2 (needs working token exchange first).
Phase 4 depends on Phase 2 (needs working OAuth flow to connect to).
Phase 6 depends on Phase 2 (needs working flow to test registrations).
Phase 7 depends on all previous phases.

---

## Estimated Scope

| Phase | Complexity | New Files | Modified Files |
|-------|-----------|-----------|----------------|
| Phase 1 | Medium | 4-5 | 1 (schema) |
| Phase 2 | High | 2 | 2 (authorize, callback) |
| Phase 3 | Medium | 0 | 3 (execute-integration, token-refresh, context) |
| Phase 4 | Medium | 2 | 1 (credential-selector) |
| Phase 5 | Medium | 2 | 1 (server.ts export) |
| Phase 6 | Low (manual) | 0 | 0 |
| Phase 7 | Low | 0 | 0 |
