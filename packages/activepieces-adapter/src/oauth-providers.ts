/**
 * Maps piece names to their OAuth provider group.
 *
 * One provider group can cover multiple pieces:
 * - "google" covers google-sheets, google-drive, gmail, google-calendar, etc.
 * - "microsoft" covers microsoft-teams, microsoft-outlook, microsoft-onedrive, etc.
 *
 * Pieces not in this map either don't use OAuth2 or use piece-level auth
 * (i.e. the piece name IS the provider name, like "slack" -> "slack").
 */

const PIECE_TO_PROVIDER: Record<string, string> = {
	// Google Workspace
	"google-sheets": "google",
	"google-drive": "google",
	gmail: "google",
	"google-calendar": "google",
	"google-contacts": "google",
	"google-forms": "google",
	"google-slides": "google",
	"google-tasks": "google",
	"google-my-business": "google",
	"google-search-console": "google",
	"google-cloud-storage": "google",
	googlechat: "google",

	// Microsoft 365
	"microsoft-teams": "microsoft",
	"microsoft-outlook": "microsoft",
	"microsoft-outlook-calendar": "microsoft",
	"microsoft-onedrive": "microsoft",
	"microsoft-onenote": "microsoft",
	"microsoft-excel-365": "microsoft",
	"microsoft-power-bi": "microsoft",
	"microsoft-sharepoint": "microsoft",
	"microsoft-todo": "microsoft",
	"microsoft-365-people": "microsoft",
	"microsoft-365-planner": "microsoft",
	"microsoft-dynamics-365-business-central": "microsoft",
	"microsoft-dynamics-crm": "microsoft",

	// Individual providers (piece name = provider name)
	slack: "slack",
	discord: "discord",
	notion: "notion",
	github: "github",
	airtable: "airtable",
	hubspot: "hubspot",
	salesforce: "salesforce",
	shopify: "shopify",
	trello: "trello",
	asana: "asana",
	linear: "linear",
	"jira-cloud": "jira-cloud",
	clickup: "clickup",
	todoist: "todoist",
	intercom: "intercom",
	zendesk: "zendesk",
	figma: "figma",
	dropbox: "dropbox",
	twitter: "twitter",
	linkedin: "linkedin",
	typeform: "typeform",
	pipedrive: "pipedrive",
	monday: "monday",
	zoom: "zoom",
	freshdesk: "freshdesk",
	mailchimp: "mailchimp",
	wordpress: "wordpress",
	spotify: "spotify",
	stripe: "stripe",
	calendly: "calendly",
	quickbooks: "quickbooks",
	xero: "xero",
	gitlab: "gitlab",
	bitbucket: "bitbucket",
	twitch: "twitch",
	box: "box",
	surveymonkey: "surveymonkey",
	pinterest: "pinterest",
	miro: "miro",
	"google-ads": "google",
	instagram: "facebook",
	facebook: "facebook",
	tiktok: "tiktok",
	youtube: "google",
	"telegram-bot": "telegram",
	whatsapp: "facebook",
	sendgrid: "sendgrid",
	twilio: "twilio",
	webflow: "webflow",
	contentful: "contentful",
	docusign: "docusign",
	reddit: "reddit",
	confluence: "atlassian",
	"digital-ocean": "digitalocean",
	wrike: "wrike",
	"constant-contact": "constantcontact",
	pandadoc: "pandadoc",
	vimeo: "vimeo",
	harvest: "harvest",
	okta: "okta",
	netlify: "netlify",
	square: "square",
	sendinblue: "brevo",
	brevo: "brevo",
	convertkit: "convertkit",
	mailgun: "mailgun",
	"freshsales-crm": "freshsales",
	greenhouse: "greenhouse",
	lever: "lever",
	drift: "drift",
	front: "front",
	copper: "copper",
	loom: "loom",
	"line-bot": "line",

	// Zoho family
	"zoho-crm": "zoho",
	"zoho-books": "zoho",
	"zoho-invoice": "zoho",
	"zoho-campaigns": "zoho",
	"zoho-mail": "zoho",
	"zoho-bookings": "zoho",
	"zoho-desk": "zoho",
	"bigin-by-zoho": "zoho",
};

/**
 * Get the OAuth provider group name for a piece.
 * Returns the provider name, or the piece name itself as fallback
 * (many pieces use themselves as the provider, e.g. "slack" -> "slack").
 */
export function getOAuthProvider(pieceName: string): string {
	return PIECE_TO_PROVIDER[pieceName] ?? pieceName;
}

/**
 * Get all piece names that belong to a given provider group.
 */
export function getPiecesForProvider(provider: string): string[] {
	const pieces: string[] = [];
	for (const [piece, prov] of Object.entries(PIECE_TO_PROVIDER)) {
		if (prov === provider) pieces.push(piece);
	}
	// If no explicit mapping, the provider name IS the piece name
	if (pieces.length === 0) pieces.push(provider);
	return pieces;
}
