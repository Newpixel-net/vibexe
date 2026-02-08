/**
 * Enrichment data for popular integrations: descriptions, icons, and types.
 * This keeps the main catalog clean while adding rich metadata for the UI.
 */

export type PieceType = "regular" | "trigger" | "core";

export interface PieceEnrichment {
	description?: string;
	logoUrl?: string;
	pieceType?: PieceType;
}

/** Simple Icons CDN base — returns SVGs for well-known brands */
const SI = (slug: string) =>
	`https://cdn.simpleicons.org/${slug}/white`;

/**
 * Enrichment data keyed by piece name.
 * Only popular/recognizable pieces need explicit entries here.
 * Unlisted pieces get auto-generated descriptions and letter avatars.
 */
export const PIECE_ENRICHMENTS: Record<string, PieceEnrichment> = {
	// ─── AI & ML ───────────────────────────────────────────
	openai: {
		description: "Generate text, images, and embeddings with GPT models",
		logoUrl: SI("openai"),
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
		logoUrl: SI("microsoftazure"),
	},
	deepseek: {
		description: "Open-source AI models for code and reasoning tasks",
		logoUrl: SI("deepseek"),
	},
	groq: {
		description: "Ultra-fast LLM inference with custom hardware",
		logoUrl: SI("groq"),
	},
	"mistral-ai": {
		description: "European AI models for text generation and embeddings",
		logoUrl: SI("mistral"),
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
		logoUrl: SI("stability"),
	},
	elevenlabs: {
		description: "AI voice synthesis and text-to-speech generation",
		logoUrl: SI("elevenlabs"),
	},
	deepgram: {
		description: "Speech-to-text and audio intelligence APIs",
	},
	runway: {
		description: "AI video generation and creative editing tools",
	},
	heygen: {
		description: "Create AI-powered avatar videos at scale",
	},
	synthesia: {
		description: "Generate professional videos with AI avatars",
	},
	replicate: {
		description: "Run open-source ML models via simple API calls",
	},
	"open-router": {
		description: "Unified API for 100+ LLM providers and models",
	},

	// ─── Communication ─────────────────────────────────────
	slack: {
		description: "Send messages, manage channels, and automate Slack workflows",
		logoUrl: SI("slack"),
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
		logoUrl: SI("twilio"),
	},
	intercom: {
		description: "Customer messaging platform for support and engagement",
		logoUrl: SI("intercom"),
	},
	"microsoft-teams": {
		description: "Send messages and manage teams in Microsoft Teams",
		logoUrl: SI("microsoftteams"),
	},
	whatsapp: {
		description: "Send and receive WhatsApp messages via Business API",
		logoUrl: SI("whatsapp"),
	},
	zoom: {
		description: "Create and manage Zoom meetings and webinars",
		logoUrl: SI("zoom"),
	},
	"matrix-chat": {
		description: "Decentralized messaging via the Matrix protocol",
		logoUrl: SI("matrix"),
	},
	sendgrid: {
		description: "Transactional and marketing email delivery",
		logoUrl: SI("sendgrid"),
	},

	// ─── CRM & Sales ───────────────────────────────────────
	hubspot: {
		description: "CRM, marketing automation, and sales pipeline management",
		logoUrl: SI("hubspot"),
	},
	salesforce: {
		description: "Enterprise CRM for sales, service, and marketing",
		logoUrl: SI("salesforce"),
	},
	pipedrive: {
		description: "Sales CRM and pipeline management for small teams",
		logoUrl: SI("pipedrive"),
	},
	"zoho-crm": {
		description: "Cloud CRM for sales automation and customer management",
	},
	freshsales: {
		description: "AI-powered CRM for high-velocity sales teams",
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
	jira: {
		description: "Issue tracking and agile project management",
		logoUrl: SI("jira"),
	},
	"linear-app": {
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
	"monday-com": {
		description: "Work OS for managing projects and workflows",
	},
	basecamp: {
		description: "Project management and team communication hub",
		logoUrl: SI("basecamp"),
	},
	todoist: {
		description: "Task management and to-do list application",
		logoUrl: SI("todoist"),
	},

	// ─── Email & Marketing ─────────────────────────────────
	mailchimp: {
		description: "Email marketing campaigns and audience management",
		logoUrl: SI("mailchimp"),
	},
	"active-campaign": {
		description: "Email marketing, automation, and CRM platform",
	},
	convertkit: {
		description: "Email marketing for creators and small businesses",
		logoUrl: SI("convertkit"),
	},
	brevo: {
		description: "Email, SMS, and marketing automation platform",
		logoUrl: SI("brevo"),
	},
	mailgun: {
		description: "Email sending, receiving, and tracking APIs",
		logoUrl: SI("mailgun"),
	},

	// ─── Google Workspace ──────────────────────────────────
	gmail: {
		description: "Send, read, and manage emails in Gmail",
		logoUrl: SI("gmail"),
	},
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
	"google-docs": {
		description: "Create and edit documents in Google Docs",
		logoUrl: SI("googledocs"),
	},
	"google-contacts": {
		description: "Manage contacts in Google Contacts",
		logoUrl: SI("googlecontacts"),
	},
	"google-forms": {
		description: "Create and manage Google Forms surveys",
		logoUrl: SI("googleforms"),
	},
	"google-my-business": {
		description: "Manage your Google Business Profile listings",
		logoUrl: SI("googlemybusiness"),
	},
	"google-tasks": {
		description: "Create and manage tasks in Google Tasks",
	},

	// ─── Microsoft 365 ─────────────────────────────────────
	"microsoft-outlook-calendar": {
		description: "Manage calendar events in Microsoft Outlook",
		logoUrl: SI("microsoftoutlook"),
	},
	"microsoft-onedrive": {
		description: "File storage and sharing with Microsoft OneDrive",
		logoUrl: SI("microsoftonedrive"),
	},
	"microsoft-excel": {
		description: "Read and write Excel spreadsheets in the cloud",
		logoUrl: SI("microsoftexcel"),
	},
	"microsoft-dynamics-365-business-central": {
		description: "ERP and business management for enterprises",
	},
	"microsoft-dynamics-crm": {
		description: "Customer relationship management by Microsoft",
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
	facebook: {
		description: "Manage pages, posts, and ads on Facebook",
		logoUrl: SI("facebook"),
	},
	linkedin: {
		description: "Share posts and manage your LinkedIn presence",
		logoUrl: SI("linkedin"),
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
	"square-pos": {
		description: "Point-of-sale and payment processing",
		logoUrl: SI("square"),
	},
	"amazon-seller": {
		description: "Manage Amazon marketplace listings and orders",
		logoUrl: SI("amazon"),
	},
	lemonsqueezy: {
		description: "Digital product sales and subscription management",
		logoUrl: SI("lemonsqueezy"),
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
	"pager-duty": {
		description: "Incident management and on-call scheduling",
		logoUrl: SI("pagerduty"),
	},
	postman: {
		description: "API development, testing, and collaboration",
		logoUrl: SI("postman"),
	},
	figma: {
		description: "Collaborative design and prototyping platform",
		logoUrl: SI("figma"),
	},
	"docker-hub": {
		description: "Container image registry and management",
		logoUrl: SI("docker"),
	},
	vercel: {
		description: "Frontend deployment and serverless functions",
		logoUrl: SI("vercel"),
	},
	cloudflare: {
		description: "CDN, DNS, security, and edge computing",
		logoUrl: SI("cloudflare"),
	},
	supabase: {
		description: "Open-source Firebase alternative with PostgreSQL",
		logoUrl: SI("supabase"),
	},
	firebase: {
		description: "Google's app development platform with real-time database",
		logoUrl: SI("firebase"),
	},

	// ─── Productivity ──────────────────────────────────────
	airtable: {
		description: "Spreadsheet-database hybrid for organizing anything",
		logoUrl: SI("airtable"),
	},
	coda: {
		description: "All-in-one doc with tables, buttons, and automations",
		logoUrl: SI("coda"),
	},
	evernote: {
		description: "Note-taking and knowledge management tool",
		logoUrl: SI("evernote"),
	},
	calendly: {
		description: "Scheduling and appointment booking automation",
		logoUrl: SI("calendly"),
	},
	"cal-com": {
		description: "Open-source scheduling infrastructure",
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
	s3: {
		description: "Amazon S3 object storage operations",
		logoUrl: SI("amazons3"),
	},
	ftp: {
		description: "File transfer via FTP/SFTP protocols",
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
	"fresh-books": {
		description: "Invoicing and expense tracking for freelancers",
	},
	"wise-community": {
		description: "International money transfers and multi-currency accounts",
		logoUrl: SI("wise"),
	},

	// ─── HR & Recruitment ──────────────────────────────────
	"bamboo-hr": {
		description: "HR software for people management and hiring",
	},

	// ─── Forms & Surveys ───────────────────────────────────
	typeform: {
		description: "Beautiful forms and surveys with conversational UI",
		logoUrl: SI("typeform"),
	},
	"jot-form": {
		description: "Online form builder with 10,000+ templates",
	},
	"survey-monkey": {
		description: "Survey creation, distribution, and analysis",
		logoUrl: SI("surveymonkey"),
	},
	tally: {
		description: "Free form builder with unlimited submissions",
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
	strapi: {
		description: "Open-source headless CMS with customizable API",
		logoUrl: SI("strapi"),
	},
	ghost: {
		description: "Publishing platform for blogs and newsletters",
		logoUrl: SI("ghost"),
	},

	// ─── Documents & Signatures ────────────────────────────
	docusign: {
		description: "Electronic signature and document management",
		logoUrl: SI("docusign"),
	},

	// ─── Automation & Utilities ────────────────────────────
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
	"generate-banners": {
		description: "Create banner images from templates",
		pieceType: "core",
	},
	"image-helper": {
		description: "Resize, crop, and convert image files",
		pieceType: "core",
	},
	"pdf-helper": {
		description: "Generate, merge, and manipulate PDF documents",
		pieceType: "core",
	},
	"qr-code": {
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
	"approval-ui": {
		description: "Human-in-the-loop approval steps for workflows",
		pieceType: "core",
	},
};

/**
 * Get enrichment data for a piece, with auto-generated fallback.
 */
export function getEnrichment(
	pieceName: string,
	category: string,
): PieceEnrichment {
	const enrichment = PIECE_ENRICHMENTS[pieceName];
	if (enrichment) return enrichment;

	// Auto-generate a basic description from the piece name and category
	return {
		description: `${category} integration`,
		pieceType: "regular",
	};
}
