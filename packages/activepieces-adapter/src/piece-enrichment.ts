/**
 * Enrichment data for integrations: descriptions, icons, and types.
 *
 * Icon strategy (tiered fallback):
 *   1. Simple Icons CDN (cdn.simpleicons.org) — colored SVGs for ~80% of brands
 *   2. Google Favicon API — colored PNGs for brands removed from Simple Icons
 *   3. Domain-based Google Favicon — auto-generated for all remaining pieces
 *   4. Letter avatar — final fallback rendered in the UI component
 */

export type PieceType = "regular" | "trigger" | "core";

export interface PieceEnrichment {
	description?: string;
	logoUrl?: string;
	pieceType?: PieceType;
}

/** Simple Icons CDN — returns SVGs with official brand colors */
const SI = (slug: string) => `https://cdn.simpleicons.org/${slug}`;

/** Google Favicon API — returns colored PNGs for any domain */
const GF = (domain: string) =>
	`https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

/**
 * Domain map for pieces where the website domain differs from "{pieceName}.com".
 * Used to generate Google Favicon fallback URLs automatically.
 */
const DOMAIN_MAP: Record<string, string> = {
	// AI & ML
	openai: "openai.com",
	claude: "anthropic.com",
	"google-gemini": "gemini.google.com",
	"azure-openai": "azure.microsoft.com",
	deepseek: "deepseek.com",
	groq: "groq.com",
	"grok-xai": "x.ai",
	"mistral-ai": "mistral.ai",
	"hugging-face": "huggingface.co",
	"hume-ai": "hume.ai",
	"perplexity-ai": "perplexity.ai",
	"open-router": "openrouter.ai",
	"stability-ai": "stability.ai",
	"stable-diffusion-webui": "github.com/AUTOMATIC1111",
	elevenlabs: "elevenlabs.io",
	deepgram: "deepgram.com",
	assemblyai: "assemblyai.com",
	"eden-ai": "edenai.co",
	flowise: "flowiseai.com",
	"copy-ai": "copy.ai",
	"textcortex-ai": "textcortex.com",
	"gptzero-detect-ai": "gptzero.me",
	"mind-studio": "mindstudio.ai",
	devin: "devin.ai",
	cursor: "cursor.sh",
	localai: "localai.io",
	runway: "runwayml.com",
	comfyicu: "comfy.icu",
	synthesia: "synthesia.io",
	heygen: "heygen.com",
	"jogg-ai": "jogg.ai",
	"camb-ai": "camb.ai",
	"murf-api": "murf.ai",
	"air-ops": "airops.com",
	"easy-peasy-ai": "easypeasyai.com",
	exa: "exa.ai",
	"extracta-ai": "extracta.ai",
	firecrawl: "firecrawl.dev",
	"fireflies-ai": "fireflies.ai",
	"insighto-ai": "insighto.ai",
	"jina-ai": "jina.ai",
	"leap-ai": "tryleap.ai",
	"meetgeek-ai": "meetgeek.ai",
	"moveo-ai": "moveo.ai",
	phantombuster: "phantombuster.com",
	photoroom: "photoroom.com",
	"predis-ai": "predis.ai",
	"raia-ai": "raia.ai",
	"rapidtext-ai": "rapidtext.ai",
	"recall-ai": "recall.ai",
	"retell-ai": "retell.ai",
	"returning-ai": "returning.ai",
	"roe-ai": "roe.ai",
	"scrapegrapghai": "scrapegraphai.com",
	sitespeakai: "sitespeak.ai",
	tavily: "tavily.com",
	"vlm-run": "vlm.run",
	"webscraping-ai": "webscraping.ai",
	"writesonic-bulk": "writesonic.com",
	deepl: "deepl.com",
	"denser-ai": "denser.ai",
	customgpt: "customgpt.ai",
	replicate: "replicate.com",
	aianswer: "aianswer.com",
	"alt-text-ai": "alttext.ai",
	"detecting-ai": "detecting-ai.com",
	"contextual-ai": "contextual.ai",
	griptape: "griptape.ai",
	letta: "letta.com",
	mcp: "modelcontextprotocol.io",
	vidnoz: "vidnoz.com",
	bolna: "bolna.dev",
	agentx: "agentx.so",
	airparser: "airparser.com",
	airtop: "airtop.ai",
	alai: "alai.studio",
	echowin: "echo.win",
	"kallabot-ai": "kallabot.ai",
	llmrails: "llmrails.com",
	"magical-api": "getmagical.com",
	magicslides: "magicslides.app",
	mindee: "mindee.com",
	"openmic-ai": "openmic.ai",
	"personal-ai": "personal.ai",
	prompthub: "prompthub.us",
	promptmate: "promptmate.io",
	retune: "retune.so",
	runware: "runware.ai",
	scenario: "scenario.com",
	skyvern: "skyvern.com",
	slidespeak: "slidespeak.co",
	docsbot: "docsbot.ai",

	// Communication
	slack: "slack.com",
	discord: "discord.com",
	"telegram-bot": "telegram.org",
	"microsoft-teams": "teams.microsoft.com",
	mattermost: "mattermost.com",
	whatsapp: "whatsapp.com",
	line: "line.me",
	googlechat: "chat.google.com",
	intercom: "intercom.com",
	"respond-io": "respond.io",
	freshdesk: "freshdesk.com",
	zendesk: "zendesk.com",
	"help-scout": "helpscout.com",
	"heymarket-sms": "heymarket.com",
	clicksend: "clicksend.com",
	messagebird: "messagebird.com",
	twilio: "twilio.com",
	"octopush-sms": "octopush.com",
	"open-phone": "openphone.com",
	"krisp-call": "krispcall.com",
	"call-rounded": "callrounded.com",
	"matrix-chat": "matrix.org",
	matrix: "matrix.org",
	discourse: "discourse.org",
	ntfy: "ntfy.sh",
	gotify: "gotify.net",

	// CRM & Sales
	hubspot: "hubspot.com",
	salesforce: "salesforce.com",
	pipedrive: "pipedrive.com",
	"zoho-crm": "zoho.com/crm",
	freshsales: "freshworks.com/crm",
	activecampaign: "activecampaign.com",
	"bigin-by-zoho": "bigin.com",
	"capsule-crm": "capsulecrm.com",
	"lead-connector": "leadconnector.com",
	"moxie-crm": "moxie.com",
	"microsoft-dynamics-crm": "dynamics.microsoft.com",
	"predict-leads": "predictleads.com",

	// Project Management
	asana: "asana.com",
	clickup: "clickup.com",
	trello: "trello.com",
	monday: "monday.com",
	linear: "linear.app",
	notion: "notion.so",
	"jira-cloud": "atlassian.com/software/jira",
	todoist: "todoist.com",
	baserow: "baserow.io",
	airtable: "airtable.com",
	smartsuite: "smartsuite.com",
	coda: "coda.io",
	nocodb: "nocodb.com",
	apitable: "apitable.com",
	grist: "getgrist.com",
	quickbase: "quickbase.com",
	teamleader: "teamleader.eu",

	// Email & Marketing
	gmail: "gmail.com",
	mailchimp: "mailchimp.com",
	sendinblue: "brevo.com",
	sendgrid: "sendgrid.com",
	"mailer-lite": "mailerlite.com",
	convertkit: "convertkit.com",
	"constant-contact": "constantcontact.com",
	"campaign-monitor": "campaignmonitor.com",
	"customer-io": "customer.io",
	"instantly-ai": "instantly.ai",
	"amazon-ses": "aws.amazon.com/ses",
	smtp: "smtp.com",
	"zoho-campaigns": "zoho.com/campaigns",
	"zoho-mail": "zoho.com/mail",
	resend: "resend.com",

	// Google Workspace
	"google-sheets": "sheets.google.com",
	"google-drive": "drive.google.com",
	"google-calendar": "calendar.google.com",
	"google-contacts": "contacts.google.com",
	"google-docs": "docs.google.com",
	"google-forms": "docs.google.com/forms",
	"google-slides": "docs.google.com/presentation",
	"google-tasks": "tasks.google.com",
	"google-my-business": "business.google.com",
	"google-search": "google.com",
	"google-search-console": "search.google.com",
	"google-cloud-storage": "cloud.google.com/storage",

	// Microsoft 365
	"microsoft-excel-365": "microsoft.com/excel",
	"microsoft-onedrive": "onedrive.com",
	"microsoft-onenote": "onenote.com",
	"microsoft-outlook": "outlook.com",
	"microsoft-outlook-calendar": "outlook.com",
	"microsoft-power-bi": "powerbi.microsoft.com",
	"microsoft-sharepoint": "sharepoint.com",
	"microsoft-todo": "todo.microsoft.com",
	"microsoft-365-people": "microsoft.com",
	"microsoft-365-planner": "microsoft.com",
	"microsoft-dynamics-365-business-central": "dynamics.microsoft.com",

	// Social Media
	twitter: "x.com",
	linkedin: "linkedin.com",
	"facebook-pages": "facebook.com",
	"facebook-leads": "facebook.com",
	"instagram-business": "instagram.com",
	bluesky: "bsky.app",
	reddit: "reddit.com",
	mastodon: "joinmastodon.org",
	pinterest: "pinterest.com",
	youtube: "youtube.com",
	twitch: "twitch.tv",
	spotify: "spotify.com",
	vimeo: "vimeo.com",
	hackernews: "news.ycombinator.com",
	rss: "rss.com",

	// E-Commerce
	shopify: "shopify.com",
	woocommerce: "woocommerce.com",
	stripe: "stripe.com",
	square: "squareup.com",
	bigcommerce: "bigcommerce.com",
	"lemon-squeezy": "lemonsqueezy.com",
	"cashfree-payments": "cashfree.com",
	razorpay: "razorpay.com",
	"pinch-payments": "pinchpayments.com",

	// Developer Tools
	github: "github.com",
	gitlab: "gitlab.com",
	http: "developer.mozilla.org",
	"http-oauth2": "oauth.net",
	webhook: "webhook.site",
	graphql: "graphql.org",
	soap: "soapui.org",
	mysql: "mysql.com",
	postgres: "postgresql.org",
	mongodb: "mongodb.com",
	couchbase: "couchbase.com",
	snowflake: "snowflake.com",
	duckdb: "duckdb.org",
	"oracle-database": "oracle.com",
	surrealdb: "surrealdb.com",
	supabase: "supabase.com",
	rabbitmq: "rabbitmq.com",
	"gcloud-pubsub": "cloud.google.com/pubsub",
	"amazon-s3": "aws.amazon.com/s3",
	"amazon-sqs": "aws.amazon.com/sqs",
	"amazon-sns": "aws.amazon.com/sns",
	"azure-blob-storage": "azure.microsoft.com",
	"azure-communication-services": "azure.microsoft.com",
	"digital-ocean": "digitalocean.com",
	netlify: "netlify.com",
	browserless: "browserless.io",
	apify: "apify.com",
	sftp: "ssh.com",
	datadog: "datadoghq.com",
	segment: "segment.com",
	posthog: "posthog.com",
	mixpanel: "mixpanel.com",
	logrocket: "logrocket.com",
	pinecone: "pinecone.io",
	qdrant: "qdrant.tech",
	confluence: "atlassian.com/software/confluence",
	figma: "figma.com",
	zeplin: "zeplin.io",
	"hashi-corp-vault": "hashicorp.com",
	metabase: "metabase.com",
	tableau: "tableau.com",

	// Finance & Accounting
	quickbooks: "quickbooks.intuit.com",
	xero: "xero.com",
	"zoho-books": "zoho.com/books",
	"zoho-invoice": "zoho.com/invoice",
	invoiceninja: "invoiceninja.com",
	"just-invoice": "justinvoice.me",
	bexio: "bexio.com",
	zuora: "zuora.com",
	netsuite: "netsuite.com",
	splitwise: "splitwise.com",
	"sap-ariba": "ariba.com",

	// Cloud Storage
	dropbox: "dropbox.com",
	box: "box.com",
	cloudinary: "cloudinary.com",
	cloudconvert: "cloudconvert.com",

	// HR & Recruitment
	bamboohr: "bamboohr.com",
	harvest: "getharvest.com",
	clockify: "clockify.me",
	"toggl-track": "toggl.com",

	// Forms & Surveys
	typeform: "typeform.com",
	jotform: "jotform.com",
	tally: "tally.so",
	"fillout-forms": "fillout.com",
	"cognito-forms": "cognitoforms.com",
	surveymonkey: "surveymonkey.com",
	"kizeo-forms": "kizeo-forms.com",
	videoask: "videoask.com",

	// CMS & Website
	wordpress: "wordpress.org",
	webflow: "webflow.com",
	contentful: "contentful.com",
	ghostcms: "ghost.org",
	drupal: "drupal.org",
	bubble: "bubble.io",
	datocms: "datocms.com",

	// Documents & Signatures
	docusign: "docusign.com",
	pandadoc: "pandadoc.com",
	"pdf-co": "pdf.co",

	// Automation & Utilities
	activepieces: "activepieces.com",
	"short-io": "short.io",
	bitly: "bitly.com",
	"cal-com": "cal.com",
	calendly: "calendly.com",
	"acuity-scheduling": "acuityscheduling.com",
	"simplybookme": "simplybook.me",
	"youcanbookme": "youcanbook.me",
	zoom: "zoom.us",
	"sessions-us": "sessions.us",
	okta: "okta.com",
	"service-now": "servicenow.com",
	odoo: "odoo.com",
	"systeme-io": "systeme.io",
	clickfunnels: "clickfunnels.com",
	"browse-ai": "browse.ai",
	"captain-data": "captaindata.co",
	"zoho-bookings": "zoho.com/bookings",
	"zoho-desk": "zoho.com/desk",
	"zendesk-sell": "zendesk.com",
	"tl-dv": "tldv.io",
	"vouchery-io": "vouchery.io",
	"free-agent": "freeagent.com",
	matomo: "matomo.org",
	"timelines-ai": "timelines.ai",
	"tiny-talk-ai": "tinytalk.ai",
	"housecall-pro": "housecallpro.com",
	"ibm-cognose": "ibm.com",
	"mempool-space": "mempool.space",
	"week-done": "weekdone.com",
	"what-converts": "whatconverts.com",
	"serp-api": "serpapi.com",
};

/**
 * Enrichment data keyed by piece name.
 * Popular pieces get explicit descriptions and icon URLs.
 * All other pieces get auto-generated descriptions and domain-based favicon icons.
 */
export const PIECE_ENRICHMENTS: Record<string, PieceEnrichment> = {
	// ─── AI & ML ───────────────────────────────────────────
	openai: {
		description: "Generate text, images, and embeddings with GPT models",
		logoUrl: GF("openai.com"),
	},
	claude: {
		description: "AI assistant by Anthropic for text generation and analysis",
		logoUrl: SI("anthropic"),
	},
	"google-gemini": {
		description: "Google's multimodal AI model for text and vision tasks",
		logoUrl: SI("googlegemini"),
	},
	"azure-openai": {
		description: "Azure-hosted OpenAI models with enterprise compliance",
		logoUrl: GF("azure.microsoft.com"),
	},
	deepseek: {
		description: "Open-source AI models for code and reasoning tasks",
		logoUrl: GF("deepseek.com"),
	},
	groq: {
		description: "Ultra-fast LLM inference with custom hardware",
		logoUrl: GF("groq.com"),
	},
	"mistral-ai": {
		description: "European AI models for text generation and embeddings",
		logoUrl: GF("mistral.ai"),
	},
	"hugging-face": {
		description: "Access thousands of ML models and datasets",
		logoUrl: SI("huggingface"),
	},
	"perplexity-ai": {
		description: "AI search engine with cited, up-to-date answers",
		logoUrl: SI("perplexity"),
	},
	"stability-ai": {
		description: "Generate images with Stable Diffusion models",
		logoUrl: GF("stability.ai"),
	},
	elevenlabs: {
		description: "AI voice synthesis and text-to-speech generation",
		logoUrl: SI("elevenlabs"),
	},
	deepgram: {
		description: "Speech-to-text and audio intelligence APIs",
		logoUrl: GF("deepgram.com"),
	},
	runway: {
		description: "AI video generation and creative editing tools",
		logoUrl: GF("runwayml.com"),
	},
	heygen: {
		description: "Create AI-powered avatar videos at scale",
		logoUrl: GF("heygen.com"),
	},
	synthesia: {
		description: "Generate professional videos with AI avatars",
		logoUrl: GF("synthesia.io"),
	},
	replicate: {
		description: "Run open-source ML models via simple API calls",
		logoUrl: GF("replicate.com"),
	},
	"open-router": {
		description: "Unified API for 100+ LLM providers and models",
		logoUrl: GF("openrouter.ai"),
	},

	// ─── Communication ─────────────────────────────────────
	slack: {
		description: "Send messages, manage channels, and automate Slack workflows",
		logoUrl: GF("slack.com"),
	},
	discord: {
		description: "Send messages and manage servers via Discord bots",
		logoUrl: SI("discord"),
	},
	"telegram-bot": {
		description: "Send messages and notifications via Telegram bots",
		logoUrl: SI("telegram"),
	},
	twilio: {
		description: "SMS, voice calls, and messaging APIs",
		logoUrl: GF("twilio.com"),
	},
	intercom: {
		description: "Customer messaging platform for support and engagement",
		logoUrl: SI("intercom"),
	},
	"microsoft-teams": {
		description: "Send messages and manage teams in Microsoft Teams",
		logoUrl: GF("teams.microsoft.com"),
	},
	whatsapp: {
		description: "Send and receive WhatsApp messages via Business API",
		logoUrl: SI("whatsapp"),
	},
	zoom: {
		description: "Create and manage Zoom meetings and webinars",
		logoUrl: SI("zoom"),
	},
	sendgrid: {
		description: "Transactional and marketing email delivery",
		logoUrl: GF("sendgrid.com"),
	},
	zendesk: {
		description: "Customer service and support ticketing platform",
		logoUrl: SI("zendesk"),
	},
	freshdesk: {
		description: "Customer support software with ticketing and automations",
		logoUrl: GF("freshdesk.com"),
	},

	// ─── CRM & Sales ───────────────────────────────────────
	hubspot: {
		description: "CRM, marketing automation, and sales pipeline management",
		logoUrl: SI("hubspot"),
	},
	salesforce: {
		description: "Enterprise CRM for sales, service, and marketing",
		logoUrl: GF("salesforce.com"),
	},
	pipedrive: {
		description: "Sales CRM and pipeline management for small teams",
		logoUrl: GF("pipedrive.com"),
	},
	"zoho-crm": {
		description: "Cloud CRM for sales automation and customer management",
		logoUrl: GF("zoho.com"),
	},
	freshsales: {
		description: "AI-powered CRM for high-velocity sales teams",
		logoUrl: GF("freshworks.com"),
	},

	// ─── Project Management ────────────────────────────────
	trello: {
		description: "Visual boards, lists, and cards for project management",
		logoUrl: SI("trello"),
	},
	asana: {
		description: "Work management platform for teams and projects",
		logoUrl: SI("asana"),
	},
	"jira-cloud": {
		description: "Issue tracking and agile project management",
		logoUrl: SI("jira"),
	},
	linear: {
		description: "Streamlined issue tracking for software teams",
		logoUrl: SI("linear"),
	},
	notion: {
		description: "All-in-one workspace for notes, docs, and databases",
		logoUrl: SI("notion"),
	},
	clickup: {
		description: "Project management with tasks, docs, and goals",
		logoUrl: SI("clickup"),
	},
	monday: {
		description: "Work OS for managing projects and workflows",
		logoUrl: GF("monday.com"),
	},
	todoist: {
		description: "Task management and to-do list application",
		logoUrl: SI("todoist"),
	},
	airtable: {
		description: "Spreadsheet-database hybrid for organizing anything",
		logoUrl: SI("airtable"),
	},
	coda: {
		description: "All-in-one doc with tables, buttons, and automations",
		logoUrl: SI("coda"),
	},

	// ─── Email & Marketing ─────────────────────────────────
	gmail: {
		description: "Send, read, and manage emails in Gmail",
		logoUrl: SI("gmail"),
	},
	mailchimp: {
		description: "Email marketing campaigns and audience management",
		logoUrl: SI("mailchimp"),
	},
	convertkit: {
		description: "Email marketing for creators and small businesses",
		logoUrl: GF("convertkit.com"),
	},
	sendinblue: {
		description: "Email, SMS, and marketing automation platform",
		logoUrl: SI("brevo"),
	},
	mailgun: {
		description: "Email sending, receiving, and tracking APIs",
		logoUrl: SI("mailgun"),
	},
	resend: {
		description: "Modern email API for developers",
		logoUrl: GF("resend.com"),
	},

	// ─── Google Workspace ──────────────────────────────────
	"google-sheets": {
		description: "Read, write, and manage Google Sheets spreadsheets",
		logoUrl: SI("googlesheets"),
	},
	"google-drive": {
		description: "Upload, download, and manage files in Google Drive",
		logoUrl: SI("googledrive"),
	},
	"google-calendar": {
		description: "Create and manage events in Google Calendar",
		logoUrl: SI("googlecalendar"),
	},
	"google-contacts": {
		description: "Manage contacts in Google Contacts",
		logoUrl: GF("contacts.google.com"),
	},
	"google-docs": {
		description: "Create and edit documents in Google Docs",
		logoUrl: SI("googledocs"),
	},
	"google-forms": {
		description: "Create and manage Google Forms surveys",
		logoUrl: SI("googleforms"),
	},
	"google-my-business": {
		description: "Manage your Google Business Profile listings",
		logoUrl: GF("business.google.com"),
	},
	"google-tasks": {
		description: "Create and manage tasks in Google Tasks",
		logoUrl: GF("tasks.google.com"),
	},

	// ─── Microsoft 365 ─────────────────────────────────────
	"microsoft-outlook-calendar": {
		description: "Manage calendar events in Microsoft Outlook",
		logoUrl: GF("outlook.com"),
	},
	"microsoft-onedrive": {
		description: "File storage and sharing with Microsoft OneDrive",
		logoUrl: GF("onedrive.com"),
	},
	"microsoft-excel-365": {
		description: "Read and write Excel spreadsheets in the cloud",
		logoUrl: GF("microsoft.com"),
	},
	"microsoft-outlook": {
		description: "Email management with Microsoft Outlook",
		logoUrl: GF("outlook.com"),
	},
	"microsoft-sharepoint": {
		description: "Document management and team collaboration",
		logoUrl: GF("sharepoint.com"),
	},

	// ─── Social Media ──────────────────────────────────────
	twitter: {
		description: "Post tweets, read timelines, and manage Twitter/X accounts",
		logoUrl: SI("x"),
	},
	instagram: {
		description: "Manage posts and interact with Instagram Business API",
		logoUrl: SI("instagram"),
	},
	"instagram-business": {
		description: "Manage posts and interact with Instagram Business API",
		logoUrl: SI("instagram"),
	},
	"facebook-pages": {
		description: "Manage pages, posts, and ads on Facebook",
		logoUrl: SI("facebook"),
	},
	linkedin: {
		description: "Share posts and manage your LinkedIn presence",
		logoUrl: GF("linkedin.com"),
	},
	youtube: {
		description: "Upload videos and manage your YouTube channel",
		logoUrl: SI("youtube"),
	},
	tiktok: {
		description: "Post and manage content on TikTok",
		logoUrl: SI("tiktok"),
	},
	reddit: {
		description: "Post, comment, and manage Reddit communities",
		logoUrl: SI("reddit"),
	},
	pinterest: {
		description: "Create pins and manage Pinterest boards",
		logoUrl: SI("pinterest"),
	},
	mastodon: {
		description: "Post and interact on the Mastodon social network",
		logoUrl: SI("mastodon"),
	},
	bluesky: {
		description: "Post and interact on the Bluesky social network",
		logoUrl: SI("bluesky"),
	},
	twitch: {
		description: "Manage streams and chat on Twitch",
		logoUrl: SI("twitch"),
	},
	spotify: {
		description: "Manage playlists and track music on Spotify",
		logoUrl: SI("spotify"),
	},

	// ─── E-Commerce ────────────────────────────────────────
	shopify: {
		description: "Manage products, orders, and customers in Shopify",
		logoUrl: SI("shopify"),
	},
	woocommerce: {
		description: "WordPress e-commerce store management",
		logoUrl: SI("woocommerce"),
	},
	stripe: {
		description: "Payment processing, subscriptions, and invoicing",
		logoUrl: SI("stripe"),
	},
	paypal: {
		description: "Process payments and manage PayPal transactions",
		logoUrl: SI("paypal"),
	},
	square: {
		description: "Point-of-sale and payment processing",
		logoUrl: SI("square"),
	},
	razorpay: {
		description: "Payment gateway for Indian businesses",
		logoUrl: SI("razorpay"),
	},

	// ─── Developer Tools ───────────────────────────────────
	github: {
		description: "Manage repos, issues, PRs, and GitHub Actions",
		logoUrl: SI("github"),
	},
	gitlab: {
		description: "Source code management and CI/CD pipelines",
		logoUrl: SI("gitlab"),
	},
	bitbucket: {
		description: "Git repository hosting and CI/CD by Atlassian",
		logoUrl: SI("bitbucket"),
	},
	sentry: {
		description: "Application monitoring and error tracking",
		logoUrl: SI("sentry"),
	},
	datadog: {
		description: "Infrastructure monitoring and APM platform",
		logoUrl: SI("datadog"),
	},
	figma: {
		description: "Collaborative design and prototyping platform",
		logoUrl: SI("figma"),
	},
	supabase: {
		description: "Open-source Firebase alternative with PostgreSQL",
		logoUrl: SI("supabase"),
	},
	firebase: {
		description: "Google's app development platform with real-time database",
		logoUrl: SI("firebase"),
	},
	vercel: {
		description: "Frontend deployment and serverless functions",
		logoUrl: SI("vercel"),
	},
	cloudflare: {
		description: "CDN, DNS, security, and edge computing",
		logoUrl: SI("cloudflare"),
	},
	mysql: {
		description: "Relational database management system",
		logoUrl: SI("mysql"),
	},
	postgres: {
		description: "Advanced open-source relational database",
		logoUrl: SI("postgresql"),
	},
	mongodb: {
		description: "NoSQL document database for modern apps",
		logoUrl: SI("mongodb"),
	},
	snowflake: {
		description: "Cloud data warehouse and analytics platform",
		logoUrl: SI("snowflake"),
	},
	netlify: {
		description: "Web deployment and serverless functions",
		logoUrl: SI("netlify"),
	},
	"digital-ocean": {
		description: "Cloud infrastructure for developers",
		logoUrl: SI("digitalocean"),
	},
	posthog: {
		description: "Open-source product analytics platform",
		logoUrl: SI("posthog"),
	},
	confluence: {
		description: "Team wiki and knowledge base by Atlassian",
		logoUrl: SI("confluence"),
	},
	rabbitmq: {
		description: "Open-source message broker",
		logoUrl: SI("rabbitmq"),
	},

	// ─── Productivity ──────────────────────────────────────
	calendly: {
		description: "Scheduling and appointment booking automation",
		logoUrl: SI("calendly"),
	},
	"cal-com": {
		description: "Open-source scheduling infrastructure",
		logoUrl: GF("cal.com"),
	},

	// ─── Cloud Storage ─────────────────────────────────────
	dropbox: {
		description: "Cloud file storage, sharing, and collaboration",
		logoUrl: SI("dropbox"),
	},
	box: {
		description: "Enterprise cloud content management and sharing",
		logoUrl: SI("box"),
	},

	// ─── Finance & Accounting ──────────────────────────────
	quickbooks: {
		description: "Accounting, invoicing, and financial management",
		logoUrl: SI("quickbooks"),
	},
	xero: {
		description: "Cloud accounting for small businesses",
		logoUrl: SI("xero"),
	},

	// ─── Forms & Surveys ───────────────────────────────────
	typeform: {
		description: "Beautiful forms and surveys with conversational UI",
		logoUrl: SI("typeform"),
	},
	surveymonkey: {
		description: "Survey creation, distribution, and analysis",
		logoUrl: SI("surveymonkey"),
	},

	// ─── CMS & Website ─────────────────────────────────────
	wordpress: {
		description: "Manage posts, pages, and media on WordPress sites",
		logoUrl: SI("wordpress"),
	},
	webflow: {
		description: "Visual website builder and CMS platform",
		logoUrl: SI("webflow"),
	},
	contentful: {
		description: "Headless CMS for structured content management",
		logoUrl: SI("contentful"),
	},
	ghostcms: {
		description: "Publishing platform for blogs and newsletters",
		logoUrl: SI("ghost"),
	},
	drupal: {
		description: "Open-source CMS for ambitious digital experiences",
		logoUrl: SI("drupal"),
	},

	// ─── Documents & Signatures ────────────────────────────
	docusign: {
		description: "Electronic signature and document management",
		logoUrl: GF("docusign.com"),
	},
	pandadoc: {
		description: "Document automation and electronic signatures",
		logoUrl: GF("pandadoc.com"),
	},

	// ─── Automation & Utilities (core/trigger types) ───────
	http: {
		description: "Make HTTP requests to any API or webhook endpoint",
		pieceType: "core",
	},
	webhook: {
		description: "Receive incoming HTTP webhooks as workflow triggers",
		pieceType: "trigger",
	},
	schedule: {
		description: "Run workflows on a recurring cron schedule",
		pieceType: "trigger",
	},
	store: {
		description: "Key-value storage for persisting data between runs",
		pieceType: "core",
	},
	"text-helper": {
		description: "Text manipulation: split, join, replace, and transform",
		pieceType: "core",
	},
	"date-helper": {
		description: "Date parsing, formatting, and calculations",
		pieceType: "core",
	},
	"math-helper": {
		description: "Mathematical operations and number formatting",
		pieceType: "core",
	},
	json: {
		description: "Parse, stringify, and manipulate JSON data",
		pieceType: "core",
	},
	xml: {
		description: "Parse and build XML documents",
		pieceType: "core",
	},
	csv: {
		description: "Parse and generate CSV files",
		pieceType: "core",
	},
	"file-helper": {
		description: "Read, write, and convert files between formats",
		pieceType: "core",
	},
	"data-mapper": {
		description: "Map and transform data between different schemas",
		pieceType: "core",
	},
	delay: {
		description: "Pause workflow execution for a specified duration",
		pieceType: "core",
	},
	connections: {
		description: "Manage and route data between workflow branches",
		pieceType: "core",
	},
	"image-helper": {
		description: "Resize, crop, and convert image files",
		pieceType: "core",
	},
	pdf: {
		description: "Generate, merge, and manipulate PDF documents",
		pieceType: "core",
	},
	qrcode: {
		description: "Generate QR codes from text or URLs",
		pieceType: "core",
	},
	rss: {
		description: "Parse and monitor RSS/Atom feed updates",
		pieceType: "trigger",
	},
	imap: {
		description: "Monitor inboxes for new emails via IMAP protocol",
		pieceType: "trigger",
	},
	approval: {
		description: "Human-in-the-loop approval steps for workflows",
		pieceType: "core",
	},
	forms: {
		description: "Create forms to collect data in workflows",
		pieceType: "core",
	},
	"manual-trigger": {
		description: "Start workflows manually with a button click",
		pieceType: "trigger",
	},
	subflows: {
		description: "Nest workflows inside other workflows",
		pieceType: "core",
	},
	tables: {
		description: "Internal data tables for workflow storage",
		pieceType: "core",
	},
	tags: {
		description: "Tag and categorize workflow runs",
		pieceType: "core",
	},
	"data-summarizer": {
		description: "Aggregate and summarize data from multiple sources",
		pieceType: "core",
	},
	"flow-helper": {
		description: "Utility functions for workflow logic",
		pieceType: "core",
	},
	"flow-parser": {
		description: "Parse and process workflow data formats",
		pieceType: "core",
	},
	crypto: {
		description: "Encryption, hashing, and cryptographic operations",
		pieceType: "core",
	},
	queue: {
		description: "Queue tasks for async processing",
		pieceType: "core",
	},
	todos: {
		description: "Track to-do items within workflows",
		pieceType: "core",
	},
	"time-ops": {
		description: "Time-based operations and scheduling",
		pieceType: "core",
	},

	// ─── Other popular integrations ────────────────────────
	bitly: {
		description: "URL shortening and link management",
		logoUrl: SI("bitly"),
	},
	okta: {
		description: "Identity and access management platform",
		logoUrl: SI("okta"),
	},
	"service-now": {
		description: "IT service management and digital workflows",
		logoUrl: GF("servicenow.com"),
	},
	odoo: {
		description: "Open-source ERP and business management suite",
		logoUrl: GF("odoo.com"),
	},
	matomo: {
		description: "Open-source web analytics platform",
		logoUrl: SI("matomo"),
	},
};

/**
 * Get the website domain for a piece (for favicon fallback).
 * Checks DOMAIN_MAP first, then derives from piece name.
 */
function getDomain(pieceName: string): string {
	if (DOMAIN_MAP[pieceName]) return DOMAIN_MAP[pieceName];

	// Auto-derive: strip hyphens, add .com
	const cleaned = pieceName
		.replace(/-/g, "")
		.replace(/\s/g, "");
	return `${cleaned}.com`;
}

/**
 * Get enrichment data for a piece, with auto-generated fallback.
 * Every piece gets an icon — either from explicit logoUrl, or auto-generated favicon.
 */
export function getEnrichment(
	pieceName: string,
	category: string,
): PieceEnrichment {
	const enrichment = PIECE_ENRICHMENTS[pieceName];
	if (enrichment) {
		// If enrichment exists but has no logo, add a favicon fallback
		return {
			...enrichment,
			description: enrichment.description ?? `${category} integration`,
			pieceType: enrichment.pieceType ?? "regular",
			logoUrl: enrichment.logoUrl ?? GF(getDomain(pieceName)),
		};
	}

	// Auto-generate everything from the piece name and category
	return {
		description: `${category} integration`,
		pieceType: "regular",
		logoUrl: GF(getDomain(pieceName)),
	};
}
