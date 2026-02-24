# Integration Rollout Plan: Adding All 500+ Remaining Activepieces

## Executive Summary

| Metric | Value |
|--------|-------|
| Currently installed | 57 pieces |
| Total on NPM registry | 625 pieces |
| Total in our catalog | 598 pieces |
| **Pieces to install** | **~562 pieces** |
| **Phases** | **11 phases (~50 each)** |
| Files modified per phase | 4-7 files |
| New OAuth providers needed | ~70 unique providers across all phases |

---

## Files Modified Per Phase (Checklist)

Every phase requires changes to these files:

### REQUIRED for every piece:

1. **`packages/activepieces-adapter/package.json`**
   - Add: `"@activepieces/piece-{name}": "^{version}"`
   - Get version from: `pnpm view @activepieces/piece-{name} version`

2. **`packages/activepieces-adapter/src/piece-catalog.ts`**
   - Add piece name to `INSTALLED_PIECES` set (line ~759)
   - If piece is missing from catalog: add `p("name", "Display Name", "Category", "authType")` entry

3. **`apps/studio.vibexe.ai/app/api/workflow-builder/system-prompt.ts`**
   - Add piece to the "INSTALLED INTEGRATIONS" section with action names
   - Get action names from: `GET /api/integrations/pieces/{name}` on live site

### REQUIRED only for OAuth2 pieces:

4. **`packages/activepieces-adapter/src/oauth-providers.ts`**
   - Add: `"piece-name": "provider-group"` to PIECE_TO_PROVIDER map
   - Only if not already mapped (check existing entries)

5. **`apps/studio.vibexe.ai/app/(main)/settings/team/oauth-apps/oauth-apps-section.tsx`**
   - Add provider to PROVIDER_INFO if the provider group is new
   - Already has ~100 providers; most new pieces reuse existing providers

### OPTIONAL (improves UX):

6. **`packages/activepieces-adapter/src/piece-enrichment.ts`**
   - Add domain to DOMAIN_MAP for favicon generation
   - Add custom description/logo to PIECE_ENRICHMENTS if desired

7. **`apps/studio.vibexe.ai/app/(main)/settings/team/integrations/credentials-section.tsx`**
   - Add API key setup link to API_KEY_LINKS for api_key pieces with known setup URLs

### Deployment steps (after each phase):

```bash
# Local
pnpm install
pnpm build --filter @vibexe-ai/activepieces-adapter
git add -A && git commit -m "Phase X: Install 50 integration pieces"
git push origin main

# Server (WHM Terminal)
cd /opt/vibexe
git fetch vibexe && git reset --hard vibexe/main
source /home/vibexe/.nvm/nvm.sh && nvm use 24
pnpm install
pnpm build
pm2 restart vibexe
```

### Verification (after each phase):

1. Visit `vibexe.online/settings/team/integrations`
2. Search for 3-5 newly added pieces
3. Verify OAuth2 pieces show "Connect with X" button
4. Verify api_key pieces show credential input form
5. Test piece inspector: `GET /api/integrations/pieces/{name}` for 2-3 pieces

---

## Phase 1: Microsoft 365 + Top OAuth2 Services (50 pieces)

**Priority**: HIGHEST - Completes the Microsoft ecosystem, adds major social/business platforms
**OAuth2 pieces**: 47 | **API key pieces**: 3 | **New OAuth providers needed**: ~15

| # | Piece Name | Display Name | Category | Auth | NPM Version |
|---|-----------|-------------|----------|------|-------------|
| 1 | microsoft-excel-365 | Microsoft Excel 365 | Microsoft 365 | oauth2 | 0.4.4 |
| 2 | microsoft-onedrive | Microsoft OneDrive | Microsoft 365 | oauth2 | 0.1.3 |
| 3 | microsoft-onenote | Microsoft OneNote | Microsoft 365 | oauth2 | 0.1.2 |
| 4 | microsoft-outlook-calendar | Outlook Calendar | Microsoft 365 | oauth2 | 0.1.3 |
| 5 | microsoft-power-bi | Microsoft Power BI | Microsoft 365 | oauth2 | 0.1.3 |
| 6 | microsoft-sharepoint | Microsoft SharePoint | Microsoft 365 | oauth2 | 0.2.5 |
| 7 | microsoft-todo | Microsoft To Do | Microsoft 365 | oauth2 | 0.2.3 |
| 8 | microsoft-365-people | Microsoft 365 People | Microsoft 365 | oauth2 | 0.1.3 |
| 9 | microsoft-365-planner | Microsoft 365 Planner | Microsoft 365 | oauth2 | 0.1.3 |
| 10 | microsoft-dynamics-365-business-central | Dynamics 365 BC | Microsoft 365 | oauth2 | 0.1.3 |
| 11 | youtube | YouTube | Social Media | oauth2 | 0.4.3 |
| 12 | facebook-pages | Facebook Pages | Social Media | oauth2 | 0.2.2 |
| 13 | facebook-leads | Facebook Leads | Social Media | oauth2 | 0.3.2 |
| 14 | instagram-business | Instagram Business | Social Media | oauth2 | 0.2.2 |
| 15 | reddit | Reddit | Social Media | oauth2 | 0.1.3 |
| 16 | pinterest | Pinterest | Social Media | oauth2 | 0.1.2 |
| 17 | spotify | Spotify | Social Media | oauth2 | 0.4.3 |
| 18 | vimeo | Vimeo | Social Media | oauth2 | 0.1.2 |
| 19 | twitch | Twitch | Social Media | oauth2 | 0.0.4 |
| 20 | pipedrive | Pipedrive | CRM & Sales | oauth2 | 0.8.3 |
| 21 | zoho-crm | Zoho CRM | CRM & Sales | oauth2 | 0.2.3 |
| 22 | activecampaign | ActiveCampaign | CRM & Sales | api_key | 0.4.3 |
| 23 | quickbooks | QuickBooks | Finance | oauth2 | 0.1.3 |
| 24 | xero | Xero | Finance | oauth2 | 0.6.2 |
| 25 | square | Square | E-Commerce | oauth2 | 0.4.2 |
| 26 | bigcommerce | BigCommerce | E-Commerce | oauth2 | 0.1.3 |
| 27 | box | Box | Cloud Storage | oauth2 | 0.1.3 |
| 28 | docusign | DocuSign | Documents | oauth2 | 0.1.3 |
| 29 | pandadoc | PandaDoc | Documents | oauth2 | 0.1.3 |
| 30 | calendly | Calendly | Automation | oauth2 | 0.1.3 |
| 31 | webflow | Webflow | CMS | oauth2 | 0.2.2 |
| 32 | contentful | Contentful | CMS | oauth2 | 0.1.3 |
| 33 | gitlab | GitLab | Developer Tools | oauth2 | 0.1.3 |
| 34 | confluence | Confluence | Developer Tools | oauth2 | 0.1.3 |
| 35 | surveymonkey | SurveyMonkey | Forms | oauth2 | 0.1.3 |
| 36 | formstack | Formstack | Forms | oauth2 | 0.1.3 |
| 37 | bitly | Bitly | Automation | oauth2 | 0.1.3 |
| 38 | constant-contact | Constant Contact | Email | oauth2 | 0.2.3 |
| 39 | campaign-monitor | Campaign Monitor | Email | oauth2 | 0.1.3 |
| 40 | front | Front | Communication | oauth2 | 0.1.2 |
| 41 | help-scout | Help Scout | Communication | oauth2 | 0.1.3 |
| 42 | wrike | Wrike | PM | oauth2 | 0.1.2 |
| 43 | meistertask | MeisterTask | PM | oauth2 | 0.1.3 |
| 44 | ticktick | TickTick | PM | oauth2 | 0.1.3 |
| 45 | podio | Podio | PM | oauth2 | 0.1.3 |
| 46 | teamleader | Teamleader | PM | oauth2 | 0.1.3 |
| 47 | lever | Lever | CRM | oauth2 | 0.1.3 |
| 48 | microsoft-dynamics-crm | MS Dynamics CRM | CRM | oauth2 | 0.2.3 |
| 49 | bigin-by-zoho | Bigin by Zoho | CRM | oauth2 | 0.1.3 |
| 50 | harvest | Harvest | HR | oauth2 | 0.1.3 |

**OAuth provider mappings needed:**
- All Microsoft 365 pieces -> "microsoft" (already mapped)
- youtube -> "google" (already mapped)
- facebook-pages, facebook-leads, instagram-business -> "facebook" (already mapped)
- reddit, pinterest, spotify, vimeo, twitch, pipedrive, square, bigcommerce, box, docusign, pandadoc, calendly, webflow, contentful, gitlab, confluence, surveymonkey, formstack, bitly, constant-contact, campaign-monitor, front, help-scout, wrike, meistertask, ticktick, podio, teamleader, lever, harvest -> individual providers (most already mapped)
- zoho-crm, bigin-by-zoho -> "zoho" (already mapped)
- quickbooks, xero -> individual (already mapped)
- activecampaign -> api_key, no mapping needed

---

## Phase 2: AI/ML Services + Core Utilities (50 pieces)

**Priority**: HIGH - Adds all major AI providers + essential utility pieces
**OAuth2 pieces**: 1 | **API key pieces**: 25 | **None pieces**: 24

| # | Piece Name | Display Name | Category | Auth | NPM Version |
|---|-----------|-------------|----------|------|-------------|
| 1 | claude | Claude (Anthropic) | AI & ML | api_key | 0.1.3 |
| 2 | google-gemini | Google Gemini | AI & ML | api_key | 0.1.3 |
| 3 | azure-openai | Azure OpenAI | AI & ML | api_key | 0.1.2 |
| 4 | deepseek | DeepSeek | AI & ML | api_key | 0.1.2 |
| 5 | groq | Groq | AI & ML | api_key | 0.2.3 |
| 6 | grok-xai | Grok (xAI) | AI & ML | api_key | 0.1.3 |
| 7 | mistral-ai | Mistral AI | AI & ML | api_key | 0.1.3 |
| 8 | perplexity-ai | Perplexity AI | AI & ML | api_key | 0.3.2 |
| 9 | open-router | OpenRouter | AI & ML | api_key | 0.1.3 |
| 10 | elevenlabs | ElevenLabs | AI & ML | api_key | 0.2.3 |
| 11 | deepgram | Deepgram | AI & ML | api_key | 0.1.3 |
| 12 | assemblyai | AssemblyAI | AI & ML | api_key | 0.1.3 |
| 13 | stability-ai | Stability AI | AI & ML | api_key | 0.2.3 |
| 14 | hugging-face | Hugging Face | AI & ML | api_key | 0.1.2 |
| 15 | deepl | DeepL | AI & ML | api_key | 0.1.3 |
| 16 | firecrawl | Firecrawl | AI & ML | api_key | 0.3.4 |
| 17 | tavily | Tavily | AI & ML | api_key | 0.1.2 |
| 18 | exa | Exa | AI & ML | api_key | 0.1.3 |
| 19 | jina-ai | Jina AI | AI & ML | api_key | 0.1.2 |
| 20 | runway | Runway | AI & ML | api_key | 0.1.2 |
| 21 | heygen | HeyGen | AI & ML | api_key | 0.1.3 |
| 22 | synthesia | Synthesia | AI & ML | api_key | 0.1.2 |
| 23 | google-search | Google Search | Google Workspace | api_key | 0.0.4 |
| 24 | hackernews | Hacker News | Social Media | none | 0.4.2 |
| 25 | bluesky | Bluesky | Social Media | api_key | 0.1.3 |
| 26 | mastodon | Mastodon | Social Media | api_key | 0.5.3 |
| 27 | pdf | PDF | Productivity | none | 0.3.2 |
| 28 | text-helper | Text Helper | Productivity | none | 0.4.12 |
| 29 | date-helper | Date Helper | Productivity | none | 0.1.26 |
| 30 | math-helper | Math Helper | Productivity | none | 0.0.20 |
| 31 | file-helper | File Helper | Productivity | none | 0.1.21 |
| 32 | image-helper | Image Helper | Productivity | none | 0.1.11 |
| 33 | qrcode | QR Code | Productivity | none | 0.0.11 |
| 34 | delay | Delay | Productivity | none | 0.3.25 |
| 35 | json | JSON | Developer Tools | none | 0.1.3 |
| 36 | xml | XML | Developer Tools | none | 0.1.12 |
| 37 | data-summarizer | Data Summarizer | Productivity | none | 0.0.9 |
| 38 | flow-helper | Flow Helper | Productivity | none | 0.1.2 |
| 39 | flow-parser | Flow Parser | Productivity | none | 0.1.3 |
| 40 | crypto | Crypto | Productivity | none | 0.0.18 |
| 41 | queue | Queue | Productivity | none | 0.1.3 |
| 42 | todos | Todos | Productivity | none | 0.0.15 |
| 43 | time-ops | Time Ops | Productivity | none | 0.0.4 |
| 44 | approval | Approval | Productivity | none | 0.1.3 |
| 45 | forms | Forms | Productivity | none | 0.4.13 |
| 46 | manual-trigger | Manual Trigger | Productivity | none | 0.0.4 |
| 47 | subflows | Subflows | Productivity | none | 0.4.10 |
| 48 | tables | Tables | Productivity | none | 0.2.14 |
| 49 | tags | Tags | Productivity | none | 0.0.15 |
| 50 | barcode-lookup | Barcode Lookup | Productivity | api_key | 0.1.3 |

**Notes:**
- Almost no OAuth2 in this phase - all pieces work immediately with API keys or no auth
- Core utility pieces (pdf, text-helper, json, xml, etc.) are used internally by other pieces
- AI pieces only need API keys pasted by users

---

## Phase 3: Developer Tools + Databases + E-Commerce (50 pieces)

**Priority**: HIGH - Infrastructure, databases, analytics, e-commerce
**OAuth2 pieces**: 3 | **API key pieces**: 31 | **Basic pieces**: 10 | **Custom**: 2 | **None**: 4

| # | Piece Name | Display Name | Category | Auth | NPM Version |
|---|-----------|-------------|----------|------|-------------|
| 1 | mongodb | MongoDB | Developer Tools | basic | 0.1.2 |
| 2 | snowflake | Snowflake | Developer Tools | basic | 0.1.2 |
| 3 | oracle-database | Oracle Database | Developer Tools | basic | 0.1.2 |
| 4 | surrealdb | SurrealDB | Developer Tools | basic | 0.1.2 |
| 5 | couchbase | Couchbase | Developer Tools | basic | 0.1.3 |
| 6 | duckdb | DuckDB | Developer Tools | none | 0.0.4 |
| 7 | rabbitmq | RabbitMQ | Developer Tools | basic | 0.1.2 |
| 8 | sftp | SFTP | Developer Tools | basic | 0.4.9 |
| 9 | gcloud-pubsub | Google Cloud Pub/Sub | Developer Tools | oauth2 | 0.1.2 |
| 10 | amazon-s3 | Amazon S3 | Developer Tools | api_key | 0.1.3 |
| 11 | amazon-sqs | Amazon SQS | Developer Tools | api_key | 0.1.3 |
| 12 | amazon-sns | Amazon SNS | Developer Tools | api_key | 0.1.3 |
| 13 | azure-blob-storage | Azure Blob Storage | Developer Tools | api_key | 0.1.3 |
| 14 | azure-communication-services | Azure Communications | Developer Tools | api_key | 0.1.3 |
| 15 | digital-ocean | DigitalOcean | Developer Tools | api_key | 0.0.4 |
| 16 | netlify | Netlify | Developer Tools | oauth2 | 0.1.2 |
| 17 | browserless | Browserless | Developer Tools | api_key | 0.1.3 |
| 18 | apify | Apify | Developer Tools | api_key | 0.1.3 |
| 19 | scrapeless | Scrapeless | Developer Tools | api_key | 0.1.3 |
| 20 | datadog | Datadog | Developer Tools | api_key | 0.1.3 |
| 21 | segment | Segment | Developer Tools | api_key | 0.1.2 |
| 22 | posthog | PostHog | Developer Tools | api_key | 0.4.3 |
| 23 | mixpanel | Mixpanel | Developer Tools | api_key | 0.1.3 |
| 24 | logrocket | LogRocket | Developer Tools | api_key | 0.1.3 |
| 25 | pinecone | Pinecone | Developer Tools | api_key | 0.1.2 |
| 26 | qdrant | Qdrant | Developer Tools | api_key | 0.3.2 |
| 27 | http-oauth2 | HTTP OAuth2 | Developer Tools | oauth2 | 0.2.3 |
| 28 | graphql | GraphQL | Developer Tools | custom | 0.0.9 |
| 29 | soap | SOAP | Developer Tools | custom | 0.1.2 |
| 30 | zeplin | Zeplin | Developer Tools | oauth2 | 0.0.4 |
| 31 | backblaze | Backblaze | Developer Tools | api_key | 0.1.3 |
| 32 | hashi-corp-vault | HashiCorp Vault | Developer Tools | api_key | 0.0.4 |
| 33 | metabase | Metabase | Developer Tools | basic | 0.2.2 |
| 34 | tableau | Tableau | Developer Tools | api_key | 0.1.2 |
| 35 | cloudinary | Cloudinary | Cloud Storage | api_key | 0.1.3 |
| 36 | cloudconvert | CloudConvert | Cloud Storage | api_key | 0.1.3 |
| 37 | woocommerce | WooCommerce | E-Commerce | api_key | 0.1.2 |
| 38 | lemon-squeezy | Lemon Squeezy | E-Commerce | api_key | 0.1.3 |
| 39 | razorpay | Razorpay | E-Commerce | api_key | 0.1.3 |
| 40 | mollie | Mollie | E-Commerce | api_key | 0.1.2 |
| 41 | saleor | Saleor | E-Commerce | api_key | 0.1.2 |
| 42 | vtex | VTEX | E-Commerce | api_key | 0.2.2 |
| 43 | shippo | Shippo | E-Commerce | api_key | 0.1.2 |
| 44 | cashfree-payments | Cashfree | E-Commerce | api_key | 0.1.3 |
| 45 | cartloom | Cartloom | E-Commerce | api_key | 0.1.3 |
| 46 | billplz | Billplz | E-Commerce | api_key | 0.1.3 |
| 47 | moonclerk | MoonClerk | E-Commerce | api_key | 0.0.4 |
| 48 | pinch-payments | Pinch Payments | E-Commerce | api_key | 0.0.6 |
| 49 | quickzu | Quickzu | E-Commerce | api_key | 0.1.2 |
| 50 | paywhirl | PayWhirl | E-Commerce | api_key | 0.0.4 |

---

## Phase 4: Email Marketing + Communication (50 pieces)

**Priority**: MEDIUM-HIGH - Completes email and messaging categories
**OAuth2 pieces**: 2 | **API key pieces**: 43 | **Basic pieces**: 2 | **None pieces**: 3

| # | Piece Name | Display Name | Category | Auth | NPM Version |
|---|-----------|-------------|----------|------|-------------|
| 1 | sendinblue | Brevo (Sendinblue) | Email & Marketing | api_key | 0.2.3 |
| 2 | mailjet | Mailjet | Email & Marketing | api_key | 0.1.2 |
| 3 | mailer-lite | MailerLite | Email & Marketing | api_key | 0.6.3 |
| 4 | convertkit | ConvertKit | Email & Marketing | api_key | 0.4.3 |
| 5 | customer-io | Customer.io | Email & Marketing | api_key | 0.3.3 |
| 6 | drip | Drip | Email & Marketing | api_key | 0.4.3 |
| 7 | lemlist | Lemlist | Email & Marketing | api_key | 0.1.2 |
| 8 | beehiiv | Beehiiv | Email & Marketing | api_key | 0.1.3 |
| 9 | vbout | VBOUT | Email & Marketing | api_key | 0.1.2 |
| 10 | emailoctopus | EmailOctopus | Email & Marketing | api_key | 0.1.3 |
| 11 | maileroo | Maileroo | Email & Marketing | api_key | 0.1.2 |
| 12 | instantly-ai | Instantly | Email & Marketing | api_key | 0.1.3 |
| 13 | reachinbox | ReachInbox | Email & Marketing | api_key | 0.1.3 |
| 14 | sendpulse | SendPulse | Email & Marketing | api_key | 0.1.3 |
| 15 | amazon-ses | Amazon SES | Email & Marketing | api_key | 0.1.3 |
| 16 | smtp | SMTP | Email & Marketing | basic | 0.3.11 |
| 17 | sendfox | SendFox | Email & Marketing | api_key | 0.1.3 |
| 18 | smaily | Smaily | Email & Marketing | api_key | 0.1.3 |
| 19 | nuelink | Nuelink | Email & Marketing | api_key | 0.1.2 |
| 20 | tarvent | Tarvent | Email & Marketing | api_key | 0.1.2 |
| 21 | resend | Resend | Email & Marketing | api_key | 0.2.3 |
| 22 | sender | Sender | Email & Marketing | api_key | 0.1.2 |
| 23 | sendy | Sendy | Email & Marketing | api_key | 0.1.2 |
| 24 | acumbamail | Acumbamail | Email & Marketing | api_key | 0.1.3 |
| 25 | mailchain | Mailchain | Email & Marketing | api_key | 0.1.2 |
| 26 | mailercheck | MailerCheck | Email & Marketing | api_key | 0.1.3 |
| 27 | smoove | Smoove | Email & Marketing | api_key | 0.1.2 |
| 28 | woodpecker | Woodpecker | Email & Marketing | api_key | 0.0.4 |
| 29 | zoho-campaigns | Zoho Campaigns | Email & Marketing | oauth2 | 0.1.3 |
| 30 | zoho-mail | Zoho Mail | Email & Marketing | oauth2 | 0.1.2 |
| 31 | imap | IMAP | Email & Marketing | basic | 0.4.2 |
| 32 | mattermost | Mattermost | Communication | api_key | 0.4.3 |
| 33 | whatsapp | WhatsApp | Communication | api_key | 0.2.2 |
| 34 | line | LINE | Communication | api_key | 0.1.3 |
| 35 | crisp | Crisp | Communication | api_key | 0.1.3 |
| 36 | missive | Missive | Communication | api_key | 0.1.3 |
| 37 | manychat | ManyChat | Communication | api_key | 0.1.2 |
| 38 | respond-io | Respond.io | Communication | api_key | 0.1.3 |
| 39 | chatbase | Chatbase | Communication | api_key | 0.1.3 |
| 40 | messagebird | MessageBird | Communication | api_key | 0.2.3 |
| 41 | clicksend | ClickSend | Communication | api_key | 0.1.3 |
| 42 | open-phone | OpenPhone | Communication | api_key | 0.1.2 |
| 43 | voipstudio | VoIPStudio | Communication | api_key | 0.1.2 |
| 44 | ntfy | Ntfy | Communication | none | 0.2.3 |
| 45 | pushbullet | Pushbullet | Communication | api_key | 0.1.3 |
| 46 | pushover | Pushover | Communication | api_key | 0.2.2 |
| 47 | matrix | Matrix | Communication | api_key | 0.4.3 |
| 48 | discourse | Discourse | Communication | api_key | 0.1.3 |
| 49 | gotify | Gotify | Communication | api_key | 0.4.2 |
| 50 | bonjoro | Bonjoro | Communication | api_key | 0.1.3 |

---

## Phase 5: CRM + Project Management + Finance + HR (50 pieces)

**Priority**: MEDIUM-HIGH - Business tools
**OAuth2 pieces**: 7 | **API key pieces**: 43

| # | Piece Name | Display Name | Category | Auth | NPM Version |
|---|-----------|-------------|----------|------|-------------|
| 1 | close | Close | CRM & Sales | api_key | 0.1.3 |
| 2 | copper | Copper | CRM & Sales | api_key | 0.1.3 |
| 3 | freshsales | Freshsales | CRM & Sales | api_key | 0.4.3 |
| 4 | attio | Attio | CRM & Sales | api_key | 0.1.3 |
| 5 | apollo | Apollo | CRM & Sales | api_key | 0.1.3 |
| 6 | ashby | Ashby | CRM & Sales | api_key | 0.1.3 |
| 7 | kommo | Kommo | CRM & Sales | api_key | 0.1.3 |
| 8 | insightly | Insightly | CRM & Sales | api_key | 0.1.2 |
| 9 | capsule-crm | Capsule CRM | CRM & Sales | api_key | 0.1.3 |
| 10 | folk | Folk | CRM & Sales | api_key | 0.1.3 |
| 11 | lead-connector | Lead Connector | CRM & Sales | api_key | 0.2.3 |
| 12 | moxie-crm | Moxie CRM | CRM & Sales | api_key | 0.1.3 |
| 13 | wealthbox | Wealthbox | CRM & Sales | api_key | 0.1.2 |
| 14 | hunter | Hunter | CRM & Sales | api_key | 0.1.2 |
| 15 | clearout | Clearout | CRM & Sales | api_key | 0.1.3 |
| 16 | lusha | Lusha | CRM & Sales | api_key | 0.1.3 |
| 17 | predict-leads | Predict Leads | CRM & Sales | api_key | 0.1.3 |
| 18 | vtiger | Vtiger | CRM & Sales | api_key | 1.3.2 |
| 19 | lofty | Lofty | CRM & Sales | api_key | 0.1.3 |
| 20 | fireberry | Fireberry | CRM & Sales | api_key | 0.1.2 |
| 21 | baserow | Baserow | PM | api_key | 0.1.3 |
| 22 | smartsheet | Smartsheet | PM | api_key | 0.1.2 |
| 23 | smartsuite | SmartSuite | PM | api_key | 0.1.3 |
| 24 | coda | Coda | PM | api_key | 0.1.3 |
| 25 | taskade | Taskade | PM | api_key | 0.1.3 |
| 26 | nocodb | NocoDB | PM | api_key | 0.4.3 |
| 27 | retable | Retable | PM | api_key | 0.1.3 |
| 28 | apitable | APITable | PM | api_key | 0.1.3 |
| 29 | bika | Bika | PM | api_key | 0.1.3 |
| 30 | grist | Grist | PM | api_key | 0.1.3 |
| 31 | quickbase | QuickBase | PM | api_key | 0.1.3 |
| 32 | flowlu | Flowlu | PM | api_key | 0.1.2 |
| 33 | frame | Frame | PM | api_key | 0.1.3 |
| 34 | productboard | Productboard | PM | api_key | 0.1.2 |
| 35 | teamwork | Teamwork | PM | api_key | 0.1.2 |
| 36 | zoho-books | Zoho Books | Finance | oauth2 | 0.1.2 |
| 37 | zoho-invoice | Zoho Invoice | Finance | oauth2 | 0.1.2 |
| 38 | invoiceninja | Invoice Ninja | Finance | api_key | 0.3.3 |
| 39 | bokio | Bokio | Finance | api_key | 0.1.3 |
| 40 | bexio | Bexio | Finance | oauth2 | 0.1.3 |
| 41 | quaderno | Quaderno | Finance | api_key | 0.0.4 |
| 42 | zuora | Zuora | Finance | oauth2 | 0.1.2 |
| 43 | netsuite | NetSuite | Finance | oauth2 | 0.1.3 |
| 44 | splitwise | Splitwise | Finance | oauth2 | 0.1.2 |
| 45 | sap-ariba | SAP Ariba | Finance | oauth2 | 0.0.4 |
| 46 | bamboohr | BambooHR | HR | api_key | 0.1.3 |
| 47 | clockify | Clockify | HR | api_key | 0.1.3 |
| 48 | clockodo | Clockodo | HR | api_key | 0.1.3 |
| 49 | kimai | Kimai | HR | api_key | 0.2.3 |
| 50 | workable | Workable | HR | api_key | 0.1.2 |

---

## Phase 6: Forms + CMS + Documents + Remaining Comms (50 pieces)

**Priority**: MEDIUM - Completes forms/CMS/docs categories + communication tail
**OAuth2 pieces**: 2 | **API key pieces**: 44 | **Basic**: 1 | **None**: 3

| # | Piece Name | Display Name | Category | Auth | NPM Version |
|---|-----------|-------------|----------|------|-------------|
| 1 | jotform | Jotform | Forms & Surveys | api_key | 0.2.3 |
| 2 | tally | Tally | Forms & Surveys | none | 0.2.2 |
| 3 | fillout-forms | Fillout Forms | Forms & Surveys | api_key | 0.1.3 |
| 4 | cognito-forms | Cognito Forms | Forms & Surveys | api_key | 0.1.3 |
| 5 | formspark | Formspark | Forms & Surveys | api_key | 0.1.2 |
| 6 | formsite | Formsite | Forms & Surveys | api_key | 0.1.3 |
| 7 | formitable | Formitable | Forms & Surveys | api_key | 0.0.4 |
| 8 | formbricks | Formbricks | Forms & Surveys | api_key | 0.2.3 |
| 9 | youform | Youform | Forms & Surveys | api_key | 0.1.3 |
| 10 | kizeo-forms | Kizeo Forms | Forms & Surveys | api_key | 0.4.3 |
| 11 | opnform | OpnForm | Forms & Surveys | api_key | 0.1.3 |
| 12 | wufoo | Wufoo | Forms & Surveys | api_key | 0.1.2 |
| 13 | feathery | Feathery | Forms & Surveys | api_key | 0.1.3 |
| 14 | videoask | VideoAsk | Forms & Surveys | api_key | 0.1.2 |
| 15 | paperform | Paperform | Forms & Surveys | api_key | 0.1.3 |
| 16 | ghostcms | Ghost CMS | CMS & Website | api_key | 0.1.3 |
| 17 | drupal | Drupal | CMS & Website | basic | 1.1.3 |
| 18 | bubble | Bubble | CMS & Website | api_key | 0.1.3 |
| 19 | softr | Softr | CMS & Website | api_key | 0.1.3 |
| 20 | datocms | DatoCMS | CMS & Website | api_key | 0.1.3 |
| 21 | brilliant-directories | Brilliant Directories | CMS & Website | api_key | 0.1.3 |
| 22 | totalcms | TotalCMS | CMS & Website | api_key | 0.1.3 |
| 23 | beamer | Beamer | CMS & Website | api_key | 0.1.3 |
| 24 | bettermode | Bettermode | CMS & Website | api_key | 0.1.3 |
| 25 | documerge | DocuMerge | Documents | api_key | 0.1.3 |
| 26 | simplepdf | SimplePDF | Documents | api_key | 1.1.2 |
| 27 | esignatures | eSignatures | Documents | api_key | 0.1.3 |
| 28 | signrequest | SignRequest | Documents | api_key | 0.1.3 |
| 29 | documentpro | DocumentPro | Documents | api_key | 0.1.3 |
| 30 | parseur | Parseur | Documents | api_key | 0.1.3 |
| 31 | parser-expert | Parser Expert | Documents | api_key | 0.1.3 |
| 32 | pdf-co | PDF.co | Documents | api_key | 0.1.2 |
| 33 | pdfmonkey | PDFMonkey | Documents | api_key | 0.1.3 |
| 34 | omnihr | OmniHR | HR | api_key | 0.0.5 |
| 35 | skyprep | SkyPrep | HR | api_key | 0.0.5 |
| 36 | toggl-track | Toggl Track | HR | api_key | 0.1.4 |
| 37 | just-invoice | Just Invoice | Finance | api_key | 0.0.4 |
| 38 | mooninvoice | Moon Invoice | Finance | api_key | 0.0.4 |
| 39 | chatfly | Chatfly | Communication | api_key | 0.1.3 |
| 40 | chatling | Chatling | Communication | api_key | 0.1.3 |
| 41 | chatnode | Chatnode | Communication | api_key | 0.1.3 |
| 42 | chat-data | Chat Data | Communication | api_key | 0.1.3 |
| 43 | chat-aid | Chat Aid | Communication | api_key | 0.1.3 |
| 44 | chatsistant | Chatsistant | Communication | api_key | 0.1.3 |
| 45 | wonderchat | Wonderchat | Communication | api_key | 0.1.3 |
| 46 | pylon | Pylon | Communication | api_key | 0.1.3 |
| 47 | heymarket-sms | Heymarket SMS | Communication | api_key | 0.0.4 |
| 48 | octopush-sms | Octopush SMS | Communication | api_key | 0.1.3 |
| 49 | smsmode | SMSMode | Communication | api_key | 0.0.4 |
| 50 | instasent | InstaSent | Communication | api_key | 0.1.2 |

---

## Phase 7: AI/ML Batch 2 (50 pieces)

**Priority**: MEDIUM - Extended AI/ML ecosystem
**All API key pieces**

| # | Piece Name | Display Name | Category | Auth | NPM Version |
|---|-----------|-------------|----------|------|-------------|
| 1 | stable-diffusion-webui | Stable Diffusion WebUI | AI & ML | api_key | 0.1.2 |
| 2 | gladia | Gladia | AI & ML | api_key | 0.1.3 |
| 3 | eden-ai | Eden AI | AI & ML | api_key | 0.1.2 |
| 4 | clarifai | Clarifai | AI & ML | api_key | 0.1.3 |
| 5 | flowise | Flowise | AI & ML | api_key | 0.1.3 |
| 6 | afforai | Afforai | AI & ML | api_key | 0.1.3 |
| 7 | aidbase | Aidbase | AI & ML | api_key | 0.1.3 |
| 8 | aianswer | AI Answer | AI & ML | api_key | 0.1.3 |
| 9 | ai | AI | AI & ML | api_key | 0.1.3 |
| 10 | alt-text-ai | Alt Text AI | AI & ML | api_key | 0.1.3 |
| 11 | alttextify | Alttextify | AI & ML | api_key | 0.1.3 |
| 12 | copy-ai | Copy.ai | AI & ML | api_key | 0.1.3 |
| 13 | textcortex-ai | TextCortex AI | AI & ML | api_key | 0.1.3 |
| 14 | detecting-ai | Detecting AI | AI & ML | api_key | 0.0.4 |
| 15 | gptzero-detect-ai | GPTZero | AI & ML | api_key | 0.1.3 |
| 16 | straico | Straico | AI & ML | api_key | 0.2.3 |
| 17 | contextual-ai | Contextual AI | AI & ML | api_key | 0.1.3 |
| 18 | mind-studio | Mind Studio | AI & ML | api_key | 0.1.3 |
| 19 | devin | Devin | AI & ML | api_key | 0.1.2 |
| 20 | cursor | Cursor | AI & ML | api_key | 0.1.3 |
| 21 | griptape | Griptape | AI & ML | api_key | 0.1.3 |
| 22 | letta | Letta | AI & ML | api_key | 0.1.3 |
| 23 | mcp | MCP | AI & ML | api_key | 0.0.15 |
| 24 | localai | LocalAI | AI & ML | api_key | 0.1.4 |
| 25 | comfyicu | ComfyICU | AI & ML | api_key | 0.1.3 |
| 26 | jogg-ai | Jogg AI | AI & ML | api_key | 0.1.2 |
| 27 | vidnoz | Vidnoz | AI & ML | api_key | 0.0.4 |
| 28 | camb-ai | Camb AI | AI & ML | api_key | 0.1.3 |
| 29 | murf-api | Murf API | AI & ML | api_key | 0.1.3 |
| 30 | bolna | Bolna | AI & ML | api_key | 0.1.3 |
| 31 | agentx | AgentX | AI & ML | api_key | 0.1.3 |
| 32 | air-ops | Air Ops | AI & ML | api_key | 0.1.3 |
| 33 | airparser | Airparser | AI & ML | api_key | 0.1.3 |
| 34 | airtop | Airtop | AI & ML | api_key | 0.1.3 |
| 35 | alai | Alai | AI & ML | api_key | 0.1.3 |
| 36 | easy-peasy-ai | Easy Peasy AI | AI & ML | api_key | 0.1.3 |
| 37 | echowin | Echowin | AI & ML | api_key | 0.1.3 |
| 38 | extracta-ai | Extracta AI | AI & ML | api_key | 0.1.2 |
| 39 | fireflies-ai | Fireflies AI | AI & ML | api_key | 0.1.2 |
| 40 | insighto-ai | Insighto AI | AI & ML | api_key | 0.1.2 |
| 41 | kallabot-ai | Kallabot AI | AI & ML | api_key | 0.4.2 |
| 42 | leap-ai | Leap AI | AI & ML | api_key | 0.0.4 |
| 43 | llmrails | LLM Rails | AI & ML | api_key | 0.1.3 |
| 44 | magical-api | Magical API | AI & ML | api_key | 0.1.3 |
| 45 | magicslides | MagicSlides | AI & ML | api_key | 0.1.2 |
| 46 | meetgeek-ai | MeetGeek AI | AI & ML | api_key | 0.1.3 |
| 47 | mindee | Mindee | AI & ML | api_key | 0.2.3 |
| 48 | moveo-ai | Moveo AI | AI & ML | api_key | 0.0.4 |
| 49 | openmic-ai | OpenMic AI | AI & ML | api_key | 0.1.3 |
| 50 | personal-ai | Personal AI | AI & ML | api_key | 0.1.2 |

---

## Phase 8: AI/ML Batch 3 + Scheduling/Security (50 pieces)

**Priority**: MEDIUM - Remaining AI pieces + scheduling and security tools
**OAuth2 pieces**: 3 | **API key pieces**: 47

| # | Piece Name | Display Name | Category | Auth | NPM Version |
|---|-----------|-------------|----------|------|-------------|
| 1 | phantombuster | PhantomBuster | AI & ML | api_key | 0.1.3 |
| 2 | photoroom | PhotoRoom | AI & ML | api_key | 0.1.2 |
| 3 | predis-ai | Predis AI | AI & ML | api_key | 0.0.4 |
| 4 | prompthub | PromptHub | AI & ML | api_key | 0.1.3 |
| 5 | promptmate | PromptMate | AI & ML | api_key | 0.1.3 |
| 6 | raia-ai | Raia AI | AI & ML | api_key | 0.1.3 |
| 7 | rapidtext-ai | RapidText AI | AI & ML | api_key | 0.1.3 |
| 8 | recall-ai | Recall AI | AI & ML | api_key | 0.1.3 |
| 9 | retell-ai | Retell AI | AI & ML | api_key | 0.1.3 |
| 10 | retune | Retune | AI & ML | api_key | 0.1.3 |
| 11 | returning-ai | Returning AI | AI & ML | api_key | 0.1.2 |
| 12 | roe-ai | Roe AI | AI & ML | api_key | 0.0.4 |
| 13 | runware | Runware | AI & ML | api_key | 0.1.2 |
| 14 | scenario | Scenario | AI & ML | api_key | 0.1.3 |
| 15 | scrapegrapghai | ScrapeGraph AI | AI & ML | api_key | 0.1.3 |
| 16 | sitespeakai | SiteSpeakAI | AI & ML | api_key | 0.1.2 |
| 17 | skyvern | Skyvern | AI & ML | api_key | 0.1.3 |
| 18 | slidespeak | SlidespEAK | AI & ML | api_key | 0.1.3 |
| 19 | vlm-run | VLM Run | AI & ML | api_key | 0.1.2 |
| 20 | webscraping-ai | WebScraping AI | AI & ML | api_key | 0.1.2 |
| 21 | writesonic-bulk | Writesonic | AI & ML | api_key | 0.1.3 |
| 22 | denser-ai | Denser AI | AI & ML | api_key | 0.1.3 |
| 23 | docsbot | DocsBot | AI & ML | api_key | 0.1.3 |
| 24 | customgpt | CustomGPT | AI & ML | api_key | 0.1.3 |
| 25 | hume-ai | Hume AI | AI & ML | api_key | 0.1.3 |
| 26 | seven | Seven | Communication | api_key | 0.1.2 |
| 27 | krisp-call | Krisp Call | Communication | api_key | 0.1.2 |
| 28 | call-rounded | Call Rounded | Communication | api_key | 0.1.3 |
| 29 | autocalls | AutoCalls | Communication | api_key | 0.1.3 |
| 30 | activepieces | Activepieces | Automation | api_key | 0.1.3 |
| 31 | generatebanners | Generate Banners | Automation | api_key | 0.4.2 |
| 32 | placid | Placid | Automation | api_key | 0.1.3 |
| 33 | robolly | Robolly | Automation | api_key | 0.1.3 |
| 34 | peekshot | Peekshot | Automation | api_key | 0.1.3 |
| 35 | chartly | Chartly | Automation | api_key | 0.1.3 |
| 36 | insta-charts | InstaCharts | Automation | api_key | 0.0.4 |
| 37 | bannerbear | Bannerbear | Automation | api_key | 0.1.3 |
| 38 | short-io | Short.io | Automation | api_key | 0.1.3 |
| 39 | cal-com | Cal.com | Automation | api_key | 0.1.3 |
| 40 | acuity-scheduling | Acuity Scheduling | Automation | oauth2 | 0.1.3 |
| 41 | tidycal | TidyCal | Automation | api_key | 0.1.3 |
| 42 | bookedin | BookedIn | Automation | api_key | 0.1.3 |
| 43 | simplybookme | SimplyBook.me | Automation | api_key | 0.1.2 |
| 44 | lets-calendar | Lets Calendar | Automation | api_key | 0.0.4 |
| 45 | youcanbookme | YouCanBook.me | Automation | api_key | 0.1.2 |
| 46 | oncehub | OnceHub | Automation | api_key | 0.1.3 |
| 47 | sessions-us | Sessions.us | Automation | api_key | 0.1.3 |
| 48 | cyberark | CyberArk | Automation | api_key | 0.1.2 |
| 49 | service-now | ServiceNow | Automation | oauth2 | 0.1.2 |
| 50 | odoo | Odoo | Automation | api_key | 0.1.2 |

---

## Phase 9: Automation & Utilities Batch 1 (50 pieces)

**Priority**: MEDIUM-LOW - Specialized automation tools
**OAuth2 pieces**: 1 | **API key pieces**: 49

| # | Piece Name | Display Name | Category | Auth | NPM Version |
|---|-----------|-------------|----------|------|-------------|
| 1 | knack | Knack | Automation | api_key | 0.1.3 |
| 2 | kissflow | KissFlow | Automation | api_key | 0.1.3 |
| 3 | systeme-io | Systeme.io | Automation | api_key | 0.1.2 |
| 4 | clickfunnels | ClickFunnels | Automation | api_key | 0.1.3 |
| 5 | lightfunnels | LightFunnels | Automation | api_key | 0.1.3 |
| 6 | poper | Poper | Automation | api_key | 0.2.2 |
| 7 | lokalise | Lokalise | Automation | api_key | 0.0.4 |
| 8 | webling | Webling | Automation | api_key | 0.1.2 |
| 9 | actualbudget | Actual Budget | Automation | api_key | 0.1.3 |
| 10 | ampeco | Ampeco | Automation | api_key | 0.1.3 |
| 11 | certopus | Certopus | Automation | api_key | 0.1.3 |
| 12 | circle | Circle | Automation | api_key | 0.1.3 |
| 13 | clicdata | ClicData | Automation | api_key | 0.1.3 |
| 14 | cloutly | Cloutly | Automation | api_key | 0.1.3 |
| 15 | cody | Cody | Automation | api_key | 0.1.3 |
| 16 | dittofeed | Dittofeed | Automation | api_key | 0.1.2 |
| 17 | gameball | Gameball | Automation | api_key | 0.1.2 |
| 18 | gamma | Gamma | Automation | api_key | 0.1.2 |
| 19 | giftbit | Giftbit | Automation | api_key | 0.1.3 |
| 20 | gistly | Gistly | Automation | api_key | 0.1.2 |
| 21 | heartbeat | Heartbeat | Automation | api_key | 0.1.3 |
| 22 | katana | Katana | Automation | api_key | 0.1.3 |
| 23 | livesession | LiveSession | Automation | api_key | 0.0.5 |
| 24 | matomo | Matomo | Automation | api_key | 0.1.3 |
| 25 | mem | Mem | Automation | api_key | 0.1.3 |
| 26 | motion | Motion | Automation | api_key | 0.1.3 |
| 27 | motiontools | MotionTools | Automation | api_key | 0.1.3 |
| 28 | onfleet | Onfleet | Automation | api_key | 0.1.3 |
| 29 | presenton | Presenton | Automation | api_key | 0.1.3 |
| 30 | respaid | Respaid | Automation | api_key | 0.1.2 |
| 31 | saastic | Saastic | Automation | api_key | 0.1.3 |
| 32 | seek-table | Seek Table | Automation | api_key | 0.0.5 |
| 33 | serp-api | SERP API | Automation | api_key | 0.1.2 |
| 34 | serpstat | Serpstat | Automation | api_key | 0.1.3 |
| 35 | socialkit | SocialKit | Automation | api_key | 0.1.3 |
| 36 | sperse | Sperse | Automation | api_key | 0.1.2 |
| 37 | swarmnode | SwarmNode | Automation | api_key | 0.1.3 |
| 38 | talkable | Talkable | Automation | api_key | 0.2.3 |
| 39 | thankster | Thankster | Automation | api_key | 0.1.2 |
| 40 | tidely | Tidely | Automation | api_key | 0.0.4 |
| 41 | timelines-ai | Timelines AI | Automation | api_key | 0.1.3 |
| 42 | tiny-talk-ai | Tiny Talk AI | Automation | api_key | 0.1.2 |
| 43 | tl-dv | tl;dv | Automation | api_key | 0.1.2 |
| 44 | truelayer | TrueLayer | Automation | oauth2 | 0.1.3 |
| 45 | twin-labs | Twin Labs | Automation | api_key | 0.1.2 |
| 46 | uscreen | Uscreen | Automation | api_key | 0.1.2 |
| 47 | vadoo-ai | Vadoo AI | Automation | api_key | 0.1.2 |
| 48 | valyu | Valyu | Automation | api_key | 0.0.3 |
| 49 | vero | Vero | Automation | api_key | 0.1.2 |
| 50 | vidlab7 | VidLab7 | Automation | api_key | 0.1.2 |

---

## Phase 10: Automation & Utilities Batch 2 (50 pieces)

**Priority**: LOW - Niche/specialized tools
**OAuth2 pieces**: 1 | **API key pieces**: 46 | **Custom**: 2 | **None**: 1

| # | Piece Name | Display Name | Category | Auth | NPM Version |
|---|-----------|-------------|----------|------|-------------|
| 1 | village | Village | Automation | api_key | 0.3.2 |
| 2 | visible | Visible | Automation | api_key | 0.0.4 |
| 3 | vouchery-io | Vouchery.io | Automation | api_key | 0.0.4 |
| 4 | waitwhile | Waitwhile | Automation | api_key | 0.0.4 |
| 5 | wedof | Wedof | Automation | api_key | 1.4.2 |
| 6 | week-done | Weekdone | Automation | api_key | 0.0.4 |
| 7 | what-converts | WhatConverts | Automation | api_key | 0.1.2 |
| 8 | whatsable | Whatsable | Automation | api_key | 0.1.2 |
| 9 | wootric | Wootric | Automation | api_key | 0.1.2 |
| 10 | zagomail | Zagomail | Automation | api_key | 0.1.2 |
| 11 | zendesk-sell | Zendesk Sell | Automation | api_key | 0.1.2 |
| 12 | zerobounce | ZeroBounce | Automation | api_key | 0.1.2 |
| 13 | zoo | Zoo | Automation | api_key | 0.1.2 |
| 14 | zoho-bookings | Zoho Bookings | Automation | oauth2 | 0.1.2 |
| 15 | zoho-desk | Zoho Desk | Automation | oauth2 | 0.1.2 |
| 16 | base44 | Base44 | Automation | api_key | 0.1.3 |
| 17 | blockscout | Blockscout | Automation | api_key | 0.1.3 |
| 18 | browse-ai | Browse AI | Automation | api_key | 0.1.3 |
| 19 | bumpups | BumpUps | Automation | api_key | 0.1.3 |
| 20 | bursty-ai | Bursty AI | Automation | api_key | 0.1.3 |
| 21 | captain-data | Captain Data | Automation | api_key | 0.1.3 |
| 22 | chain-aware | Chain Aware | Automation | api_key | 0.1.3 |
| 23 | chainalysis-api | Chainalysis | Automation | api_key | 0.1.3 |
| 24 | chaindesk | Chaindesk | Automation | api_key | 0.1.3 |
| 25 | chargekeep | ChargeKeep | Automation | api_key | 0.1.3 |
| 26 | clearoutphone | ClearoutPhone | Automation | api_key | 0.1.3 |
| 27 | cometapi | CometAPI | Automation | api_key | 0.1.3 |
| 28 | contiguity | Contiguity | Automation | api_key | 0.1.3 |
| 29 | cryptolens | Cryptolens | Automation | api_key | 0.0.4 |
| 30 | dappier | Dappier | Automation | api_key | 0.1.2 |
| 31 | dashworks | Dashworks | Automation | api_key | 0.1.3 |
| 32 | datafuel | DataFuel | Automation | api_key | 0.1.3 |
| 33 | digital-pilot | Digital Pilot | Automation | api_key | 0.1.3 |
| 34 | dimo | DIMO | Automation | api_key | 0.3.2 |
| 35 | doctly | Doctly | Automation | api_key | 0.1.3 |
| 36 | famulor | Famulor | Automation | api_key | 0.1.2 |
| 37 | fathom | Fathom | Automation | api_key | 0.1.2 |
| 38 | fellow | Fellow | Automation | api_key | 0.1.3 |
| 39 | flipando | Flipando | Automation | api_key | 0.0.4 |
| 40 | fliqr-ai | Fliqr AI | Automation | api_key | 0.1.3 |
| 41 | foreplay-co | Foreplay | Automation | api_key | 0.1.2 |
| 42 | fountain | Fountain | Automation | api_key | 0.1.3 |
| 43 | fragment | Fragment | Automation | api_key | 0.1.3 |
| 44 | free-agent | FreeAgent | Automation | oauth2 | 0.1.3 |
| 45 | gender-api | Gender API | Automation | api_key | 0.0.4 |
| 46 | greenpt | GreenPT | Automation | api_key | 0.1.3 |
| 47 | greip | Greip | Automation | api_key | 0.1.3 |
| 48 | guidelite | GuideLite | Automation | api_key | 0.1.3 |
| 49 | hastewire | Hastewire | Automation | api_key | 0.1.3 |
| 50 | hedy | Hedy | Automation | api_key | 0.1.2 |

---

## Phase 11: Final Batch - Remaining Catalog + NPM-Only Additions (~68 pieces)

**Priority**: LOW - Completes full coverage
**From catalog**: ~40 pieces | **New from NPM (not yet in catalog)**: ~28 pieces

### Part A: Remaining catalog pieces (40)

| # | Piece Name | Display Name | Category | Auth | NPM Version |
|---|-----------|-------------|----------|------|-------------|
| 1 | housecall-pro | Housecall Pro | Automation | api_key | 0.1.3 |
| 2 | hystruct | Hystruct | Automation | api_key | 0.1.3 |
| 3 | ibm-cognose | IBM Cognos | Automation | api_key | 0.1.3 |
| 4 | image-router | Image Router | Automation | api_key | 0.1.3 |
| 5 | influencers-club | Influencers Club | Automation | api_key | 0.0.4 |
| 6 | instabase | Instabase | Automation | api_key | 0.1.3 |
| 7 | kudosity | Kudosity | Automation | api_key | 0.1.3 |
| 8 | leexi | Leexi | Automation | api_key | 0.1.3 |
| 9 | linkup | LinkUp | Automation | api_key | 0.1.3 |
| 10 | lucidya | Lucidya | Automation | api_key | 0.0.4 |
| 11 | luxury-presence | Luxury Presence | Automation | api_key | 0.1.3 |
| 12 | manus | Manus | Automation | api_key | 0.1.3 |
| 13 | medullar | Medullar | Automation | api_key | 0.3.2 |
| 14 | mempool-space | Mempool Space | Automation | none | 0.1.3 |
| 15 | metatext | Metatext | Automation | api_key | 0.1.3 |
| 16 | millionverifier | MillionVerifier | Automation | api_key | 0.1.3 |
| 17 | neverbounce | NeverBounce | Automation | api_key | 0.1.3 |
| 18 | nifty | Nifty | Automation | api_key | 0.1.3 |
| 19 | omni-co | Omni.co | Automation | api_key | 0.1.3 |
| 20 | oneclickimpact | OneClickImpact | Automation | api_key | 0.0.4 |
| 21 | opportify | Opportify | Automation | api_key | 0.1.3 |
| 22 | orimon | Orimon | Automation | api_key | 0.1.3 |
| 23 | pastebin | Pastebin | Automation | api_key | 0.2.2 |
| 24 | pastefy | Pastefy | Automation | api_key | 0.2.3 |
| 25 | phone-validator | Phone Validator | Automation | api_key | 0.0.4 |
| 26 | pollybot-ai | PollyBot AI | Automation | api_key | 0.1.3 |
| 27 | reoon-verifier | Reoon Verifier | Automation | api_key | 0.1.2 |
| 28 | simpliroute | SimpliRoute | Automation | api_key | 0.1.3 |
| 29 | supadata | Supadata | Automation | api_key | 0.1.2 |
| 30 | tenzo | Tenzo | Automation | api_key | 0.0.3 |
| 31 | upgradechat | UpgradeChat | Automation | api_key | 0.1.2 |
| 32 | anyhook-graphql | AnyHook GraphQL | Automation | custom | 0.1.3 |
| 33 | anyhook-websocket | AnyHook WebSocket | Automation | custom | 0.1.3 |
| 34 | appfollow | AppFollow | Automation | api_key | 0.1.3 |
| 35 | ask-handle | Ask Handle | Automation | api_key | 0.1.3 |
| 36 | asknews | AskNews | Automation | api_key | 0.1.3 |
| 37 | assembled | Assembled | Automation | api_key | 0.1.3 |
| 38 | avoma | Avoma | Automation | api_key | 0.1.3 |
| 39 | baremetrics | Baremetrics | Automation | api_key | 0.1.3 |
| 40 | aminos | Aminos | Automation | api_key | 0.1.3 |

### Part B: NPM-only pieces to add to catalog (28)

These exist on NPM but are NOT yet in our catalog. Need to add catalog entries first.

| # | Piece Name | NPM Version | Suggested Category | Notes |
|---|-----------|-------------|-------------------|-------|
| 1 | activity | 0.1.3 | Automation & Utilities | Activity tracking |
| 2 | agent | 0.1.3 | AI & ML | AI agent framework |
| 3 | aircall | 0.1.3 | Communication | Cloud phone system |
| 4 | apitemplate-io | 0.1.3 | Automation & Utilities | PDF/image generation |
| 5 | binance | 0.1.3 | Finance & Accounting | Crypto exchange |
| 6 | blackbaud | 0.1.3 | CRM & Sales | Nonprofit CRM |
| 7 | bloomerang | 0.1.3 | CRM & Sales | Donor management |
| 8 | checkout | 0.1.3 | E-Commerce | Payment processing |
| 9 | dumpling-ai | 0.1.3 | AI & ML | AI data extraction |
| 10 | dust | 0.2.3 | AI & ML | AI assistant platform |
| 11 | eth-name-service | 0.1.2 | Developer Tools | ENS resolution |
| 12 | gravityforms | 0.1.2 | Forms & Surveys | WordPress form plugin |
| 13 | linka | 0.1.2 | Automation & Utilities | Link management |
| 14 | mautic | 0.5.3 | Email & Marketing | Marketing automation |
| 15 | mycase-piece | 0.1.2 | Automation & Utilities | Legal case management |
| 16 | ninox | 0.1.3 | Project Management | Cloud database |
| 17 | plausible | 0.0.4 | Developer Tools | Privacy analytics |
| 18 | presentation | 0.1.3 | Automation & Utilities | Presentation tool |
| 19 | qwilr | 0.1.3 | Documents & Signatures | Proposal software |
| 20 | rounded-studio | 0.2.3 | Automation & Utilities | Freelancer tools |
| 21 | salsa | 0.1.2 | Automation & Utilities | Nonprofit engagement |
| 22 | strava | 0.1.3 | Automation & Utilities | Fitness tracking |

**Pieces to SKIP (internal/duplicate):**
- `gmail-dev` (v0.1.0) - internal development variant of gmail
- `manual-task` (v0.0.1) - internal placeholder
- `nitfy` (v0.0.1) - appears to be placeholder
- `text-ai` - internal AI SDK wrapper, may conflict with our setup
- `utility-ai` - internal AI SDK wrapper, may conflict
- `image-ai` - internal AI SDK wrapper, may conflict
- `video-ai` (v0.1.0) - internal AI SDK wrapper

### Part B also requires catalog fixes:
- Rename `call-rounded` -> `rounded-studio` in catalog (npm name mismatch)
- Rename `presenton` -> `presentation` in catalog (npm name mismatch)

---

## OAuth Provider Setup Summary

Across all 11 phases, these are the **new OAuth providers that need PROVIDER_INFO entries** in `oauth-apps-section.tsx`:

| Provider | Pieces Using It | Phase |
|----------|----------------|-------|
| reddit | reddit | 1 |
| pinterest | pinterest | 1 |
| spotify | spotify | 1 |
| vimeo | vimeo | 1 |
| twitch | twitch | 1 |
| pipedrive | pipedrive | 1 |
| square | square | 1 |
| bigcommerce | bigcommerce | 1 |
| box | box | 1 |
| docusign | docusign | 1 |
| pandadoc | pandadoc | 1 |
| calendly | calendly | 1 |
| webflow | webflow | 1 |
| contentful | contentful | 1 |
| gitlab | gitlab | 1 |
| atlassian | confluence, jira-cloud | 1 |
| surveymonkey | surveymonkey | 1 |
| formstack | formstack | 1 |
| bitly | bitly | 1 |
| constantcontact | constant-contact | 1 |
| campaign-monitor | campaign-monitor | 1 |
| front | front | 1 |
| help-scout | help-scout | 1 |
| wrike | wrike | 1 |
| meistertask | meistertask | 1 |
| ticktick | ticktick | 1 |
| podio | podio | 1 |
| teamleader | teamleader | 1 |
| lever | lever | 1 |
| harvest | harvest | 1 |
| okta | okta | 1 |
| quickbooks | quickbooks | 1 |
| xero | xero | 1 |
| gcloud-pubsub | gcloud-pubsub | 3 |
| netlify | netlify | 3 |
| http-oauth2 | http-oauth2 | 3 |
| zeplin | zeplin | 3 |
| zoho-campaigns/mail | -> "zoho" (existing) | 4 |
| bexio | bexio | 5 |
| zuora | zuora | 5 |
| netsuite | netsuite | 5 |
| splitwise | splitwise | 5 |
| sap-ariba | sap-ariba | 5 |
| acuity-scheduling | acuity-scheduling | 8 |
| service-now | service-now | 8 |
| truelayer | truelayer | 9 |
| zoho-bookings/desk | -> "zoho" (existing) | 10 |
| free-agent | free-agent | 10 |

**Most already exist** in PROVIDER_INFO from our earlier work (we added ~77 providers). Only truly new ones need to be added.

---

## System Prompt Update Strategy

The system prompt at `system-prompt.ts` currently lists 50 installed pieces. After each phase, the prompt MUST be updated with:

1. The new piece names and their available actions
2. Action names obtained from: `GET /api/integrations/pieces/{name}` on the live site

**Recommended approach**: After deploying each phase, run a script to query the piece inspector API for all newly installed pieces and update the system prompt automatically.

Example per-phase query:
```bash
# After deploying Phase 1, get actions for all 50 new pieces:
for piece in microsoft-excel-365 microsoft-onedrive ...; do
  curl -s "https://vibexe.online/api/integrations/pieces/$piece" | jq '.actions | keys'
done
```

---

## Known Issues & Gotchas

1. **NPM version lookup**: Always verify versions with `pnpm view @activepieces/piece-{name} version` before adding. Versions listed above are from research and may have been updated.

2. **Name mismatches**: Two catalog entries have wrong names:
   - `call-rounded` should be `rounded-studio`
   - `presenton` should be `presentation`

3. **Skip internal pieces**: Do NOT install `gmail-dev`, `manual-task`, `nitfy`, `text-ai`, `utility-ai`, `image-ai`, `video-ai` - these are internal Activepieces pieces that may conflict with our setup.

4. **OAuth app configuration**: Installing OAuth2 pieces only enables the "Connect" button. Users still need to configure OAuth apps (client_id + client_secret) in Settings > OAuth Apps for each provider they want to use.

5. **Build time**: Each phase adds ~50 npm packages. `pnpm install` may take 2-5 minutes. `pnpm build` for the adapter package is fast (~5s) but full monorepo build takes ~60s.

6. **Auth still null at execution**: `execute-integration.ts` line 162 still hardcodes `auth: null`. Until credential wiring (Phase 2 of the auth system) is done, OAuth2-authenticated pieces will show the Connect button but won't actually work at execution time. This is a separate workstream from installation.

7. **Disk space**: All 625 packages total ~151MB unpacked. Shared dependencies are deduplicated by pnpm. Not a concern.

---

## Progress Tracking

| Phase | Pieces | Status | Date |
|-------|--------|--------|------|
| Pre-existing | 57 installed | DONE | 2026-02-08 |
| Phase 1 | 49 (MS365 + OAuth2, minus docusign) | DONE | 2026-02-08 |
| Phase 2 | 50 (AI/ML + Utilities) | DONE | 2026-02-08 |
| Phase 3 | 50 (DevTools + E-Com) | PENDING | |
| Phase 4 | 50 (Email + Comms) | PENDING | |
| Phase 5 | 50 (CRM + PM + Finance) | PENDING | |
| Phase 6 | 50 (Forms + CMS + Docs) | PENDING | |
| Phase 7 | 50 (AI/ML Batch 2) | PENDING | |
| Phase 8 | 50 (AI/ML 3 + Scheduling) | PENDING | |
| Phase 9 | 50 (Automation 1) | PENDING | |
| Phase 10 | 50 (Automation 2) | PENDING | |
| Phase 11 | ~68 (Final + NPM-only) | PENDING | |
| **TOTAL** | **~618** | | |
