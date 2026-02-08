"use client";

import {
	ChevronDownIcon,
	EyeIcon,
	EyeOffIcon,
	KeyRoundIcon,
	Loader2Icon,
	PlusIcon,
	SearchIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface OAuthAppConfigDisplay {
	dbId: number;
	provider: string;
	clientId: string;
	clientSecretMasked: string;
	scopes: string | null;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

const PROVIDER_INFO: Record<string, { label: string; description: string; docsUrl: string; color: string; domain: string }> = {
	google: {
		label: "Google",
		description: "Google Sheets, Drive, Gmail, Calendar, Contacts, Forms",
		docsUrl: "https://console.cloud.google.com/apis/credentials",
		color: "#4285F4",
		domain: "google.com",
	},
	slack: {
		label: "Slack",
		description: "Slack messaging and channels",
		docsUrl: "https://api.slack.com/apps",
		color: "#4A154B",
		domain: "slack.com",
	},
	discord: {
		label: "Discord",
		description: "Discord messaging and servers",
		docsUrl: "https://discord.com/developers/applications",
		color: "#5865F2",
		domain: "discord.com",
	},
	microsoft: {
		label: "Microsoft",
		description: "Teams, Outlook, OneDrive, Excel, SharePoint",
		docsUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
		color: "#00A4EF",
		domain: "microsoft.com",
	},
	github: {
		label: "GitHub",
		description: "GitHub repositories and actions",
		docsUrl: "https://github.com/settings/developers",
		color: "#181717",
		domain: "github.com",
	},
	notion: {
		label: "Notion",
		description: "Notion pages and databases",
		docsUrl: "https://www.notion.so/my-integrations",
		color: "#000000",
		domain: "notion.so",
	},
	airtable: {
		label: "Airtable",
		description: "Airtable bases and records",
		docsUrl: "https://airtable.com/create/tokens",
		color: "#18BFFF",
		domain: "airtable.com",
	},
	hubspot: {
		label: "HubSpot",
		description: "HubSpot CRM and marketing",
		docsUrl: "https://developers.hubspot.com",
		color: "#FF7A59",
		domain: "hubspot.com",
	},
	salesforce: {
		label: "Salesforce",
		description: "Salesforce CRM",
		docsUrl: "https://developer.salesforce.com",
		color: "#00A1E0",
		domain: "salesforce.com",
	},
	shopify: {
		label: "Shopify",
		description: "Shopify e-commerce",
		docsUrl: "https://partners.shopify.com",
		color: "#7AB55C",
		domain: "shopify.com",
	},
	dropbox: {
		label: "Dropbox",
		description: "Dropbox file storage",
		docsUrl: "https://www.dropbox.com/developers/apps",
		color: "#0061FF",
		domain: "dropbox.com",
	},
	zoom: {
		label: "Zoom",
		description: "Zoom meetings",
		docsUrl: "https://marketplace.zoom.us/develop/create",
		color: "#2D8CFF",
		domain: "zoom.us",
	},
	twitter: {
		label: "Twitter / X",
		description: "Tweets, timeline, and social engagement",
		docsUrl: "https://developer.x.com/en/portal/dashboard",
		color: "#000000",
		domain: "x.com",
	},
	linkedin: {
		label: "LinkedIn",
		description: "Posts, profiles, and professional networking",
		docsUrl: "https://www.linkedin.com/developers/apps",
		color: "#0A66C2",
		domain: "linkedin.com",
	},
	mailchimp: {
		label: "Mailchimp",
		description: "Email campaigns, audiences, and automation",
		docsUrl: "https://admin.mailchimp.com/account/oauth2/",
		color: "#FFE01B",
		domain: "mailchimp.com",
	},
	trello: {
		label: "Trello",
		description: "Boards, lists, and cards",
		docsUrl: "https://trello.com/power-ups/admin",
		color: "#0052CC",
		domain: "trello.com",
	},
	asana: {
		label: "Asana",
		description: "Tasks, projects, and team collaboration",
		docsUrl: "https://app.asana.com/0/developer-console",
		color: "#F06A6A",
		domain: "asana.com",
	},
	"jira-cloud": {
		label: "Jira Cloud",
		description: "Issues, projects, and agile boards",
		docsUrl: "https://developer.atlassian.com/console/myapps/",
		color: "#0052CC",
		domain: "atlassian.com",
	},
	clickup: {
		label: "ClickUp",
		description: "Tasks, docs, and project management",
		docsUrl: "https://app.clickup.com/settings/integrations",
		color: "#7B68EE",
		domain: "clickup.com",
	},
	monday: {
		label: "Monday.com",
		description: "Work management boards and automations",
		docsUrl: "https://monday.com/developers/apps",
		color: "#FF3D57",
		domain: "monday.com",
	},
	todoist: {
		label: "Todoist",
		description: "Tasks, projects, and personal productivity",
		docsUrl: "https://developer.todoist.com/appconsole.html",
		color: "#E44332",
		domain: "todoist.com",
	},
	linear: {
		label: "Linear",
		description: "Issues, cycles, and product development",
		docsUrl: "https://linear.app/settings/api",
		color: "#5E6AD2",
		domain: "linear.app",
	},
	intercom: {
		label: "Intercom",
		description: "Customer messaging and support",
		docsUrl: "https://app.intercom.com/a/developer-signup",
		color: "#6AFDEF",
		domain: "intercom.com",
	},
	zendesk: {
		label: "Zendesk",
		description: "Support tickets and customer service",
		docsUrl: "https://developer.zendesk.com/documentation/",
		color: "#03363D",
		domain: "zendesk.com",
	},
	freshdesk: {
		label: "Freshdesk",
		description: "Help desk and customer support",
		docsUrl: "https://developers.freshdesk.com/",
		color: "#25C16F",
		domain: "freshdesk.com",
	},
	figma: {
		label: "Figma",
		description: "Design files, components, and collaboration",
		docsUrl: "https://www.figma.com/developers/apps",
		color: "#F24E1E",
		domain: "figma.com",
	},
	typeform: {
		label: "Typeform",
		description: "Forms, surveys, and quizzes",
		docsUrl: "https://admin.typeform.com/account#/section/tokens",
		color: "#262627",
		domain: "typeform.com",
	},
	pipedrive: {
		label: "Pipedrive",
		description: "Sales CRM and pipeline management",
		docsUrl: "https://developers.pipedrive.com/docs/api/v1",
		color: "#25292C",
		domain: "pipedrive.com",
	},
	zoho: {
		label: "Zoho",
		description: "Zoho CRM, Books, Invoice, Mail, Desk, Campaigns",
		docsUrl: "https://api-console.zoho.com/",
		color: "#C8202B",
		domain: "zoho.com",
	},
	wordpress: {
		label: "WordPress",
		description: "WordPress.com sites, posts, and pages",
		docsUrl: "https://developer.wordpress.com/apps/",
		color: "#21759B",
		domain: "wordpress.com",
	},
	spotify: {
		label: "Spotify",
		description: "Music, playlists, and podcast data",
		docsUrl: "https://developer.spotify.com/dashboard",
		color: "#1DB954",
		domain: "spotify.com",
	},
	stripe: {
		label: "Stripe",
		description: "Payments, subscriptions, and invoicing",
		docsUrl: "https://dashboard.stripe.com/apikeys",
		color: "#635BFF",
		domain: "stripe.com",
	},
	calendly: {
		label: "Calendly",
		description: "Scheduling and appointment booking",
		docsUrl: "https://developer.calendly.com/",
		color: "#006BFF",
		domain: "calendly.com",
	},
	quickbooks: {
		label: "QuickBooks",
		description: "Accounting, invoicing, and bookkeeping",
		docsUrl: "https://developer.intuit.com/app/developer/dashboard",
		color: "#2CA01C",
		domain: "quickbooks.intuit.com",
	},
	xero: {
		label: "Xero",
		description: "Cloud accounting and financial management",
		docsUrl: "https://developer.xero.com/app/manage",
		color: "#13B5EA",
		domain: "xero.com",
	},
	gitlab: {
		label: "GitLab",
		description: "GitLab repositories and CI/CD pipelines",
		docsUrl: "https://gitlab.com/-/user_settings/applications",
		color: "#FC6D26",
		domain: "gitlab.com",
	},
	bitbucket: {
		label: "Bitbucket",
		description: "Bitbucket repositories and pull requests",
		docsUrl: "https://bitbucket.org/account/settings/app-authorizations/",
		color: "#0052CC",
		domain: "bitbucket.org",
	},
	twitch: {
		label: "Twitch",
		description: "Live streaming and chat",
		docsUrl: "https://dev.twitch.tv/console/apps",
		color: "#9146FF",
		domain: "twitch.tv",
	},
	box: {
		label: "Box",
		description: "Cloud content management and file sharing",
		docsUrl: "https://app.box.com/developers/console",
		color: "#0061D5",
		domain: "box.com",
	},
	surveymonkey: {
		label: "SurveyMonkey",
		description: "Surveys, forms, and research",
		docsUrl: "https://developer.surveymonkey.com/apps/",
		color: "#00BF6F",
		domain: "surveymonkey.com",
	},
	pinterest: {
		label: "Pinterest",
		description: "Pins, boards, and visual discovery",
		docsUrl: "https://developers.pinterest.com/apps/",
		color: "#E60023",
		domain: "pinterest.com",
	},
	miro: {
		label: "Miro",
		description: "Collaborative whiteboard and diagramming",
		docsUrl: "https://developers.miro.com/page/get-started",
		color: "#FFD02F",
		domain: "miro.com",
	},
	"google-ads": {
		label: "Google Ads",
		description: "Ad campaigns, keywords, and analytics",
		docsUrl: "https://console.cloud.google.com/apis/credentials",
		color: "#4285F4",
		domain: "ads.google.com",
	},
	instagram: {
		label: "Instagram",
		description: "Posts, stories, and social media management",
		docsUrl: "https://developers.facebook.com/apps/",
		color: "#E4405F",
		domain: "instagram.com",
	},
	facebook: {
		label: "Facebook",
		description: "Pages, groups, and Meta Business Suite",
		docsUrl: "https://developers.facebook.com/apps/",
		color: "#1877F2",
		domain: "facebook.com",
	},
	tiktok: {
		label: "TikTok",
		description: "Videos, analytics, and creator tools",
		docsUrl: "https://developers.tiktok.com/apps/",
		color: "#000000",
		domain: "tiktok.com",
	},
	youtube: {
		label: "YouTube",
		description: "Videos, channels, and analytics",
		docsUrl: "https://console.cloud.google.com/apis/credentials",
		color: "#FF0000",
		domain: "youtube.com",
	},
	telegram: {
		label: "Telegram",
		description: "Bot messaging and channels",
		docsUrl: "https://core.telegram.org/bots#botfather",
		color: "#26A5E4",
		domain: "telegram.org",
	},
	whatsapp: {
		label: "WhatsApp",
		description: "Business messaging via Meta Cloud API",
		docsUrl: "https://developers.facebook.com/apps/",
		color: "#25D366",
		domain: "whatsapp.com",
	},
	sendgrid: {
		label: "SendGrid",
		description: "Transactional and marketing email delivery",
		docsUrl: "https://app.sendgrid.com/settings/api_keys",
		color: "#1A82E2",
		domain: "sendgrid.com",
	},
	twilio: {
		label: "Twilio",
		description: "SMS, voice, and communication APIs",
		docsUrl: "https://www.twilio.com/console",
		color: "#F22F46",
		domain: "twilio.com",
	},
	aws: {
		label: "Amazon Web Services",
		description: "S3, Lambda, and cloud infrastructure",
		docsUrl: "https://console.aws.amazon.com/iam/home#/security_credentials",
		color: "#FF9900",
		domain: "aws.amazon.com",
	},
	openai: {
		label: "OpenAI",
		description: "GPT models, DALL-E, and AI APIs",
		docsUrl: "https://platform.openai.com/api-keys",
		color: "#412991",
		domain: "openai.com",
	},
	"google-analytics": {
		label: "Google Analytics",
		description: "Website traffic and user behavior data",
		docsUrl: "https://console.cloud.google.com/apis/credentials",
		color: "#E37400",
		domain: "analytics.google.com",
	},
	webflow: {
		label: "Webflow",
		description: "Website building and CMS management",
		docsUrl: "https://webflow.com/dashboard/account/integrations",
		color: "#4353FF",
		domain: "webflow.com",
	},
	contentful: {
		label: "Contentful",
		description: "Headless CMS and content management",
		docsUrl: "https://app.contentful.com/account/profile/developers/applications",
		color: "#2478CC",
		domain: "contentful.com",
	},
	docusign: {
		label: "DocuSign",
		description: "Electronic signatures and document workflows",
		docsUrl: "https://admindemo.docusign.com/apps-and-keys",
		color: "#FFCC22",
		domain: "docusign.com",
	},
	// --- 20 New Providers ---
	reddit: {
		label: "Reddit",
		description: "Communities, posts, and discussions",
		docsUrl: "https://www.reddit.com/prefs/apps",
		color: "#FF4500",
		domain: "reddit.com",
	},
	paypal: {
		label: "PayPal",
		description: "Payments, invoices, and transactions",
		docsUrl: "https://developer.paypal.com/dashboard/applications",
		color: "#003087",
		domain: "paypal.com",
	},
	square: {
		label: "Square",
		description: "Payments, POS, and commerce",
		docsUrl: "https://developer.squareup.com/apps",
		color: "#3E4348",
		domain: "squareup.com",
	},
	atlassian: {
		label: "Atlassian",
		description: "Confluence, Bitbucket, and Jira suite",
		docsUrl: "https://developer.atlassian.com/console/myapps/",
		color: "#0052CC",
		domain: "atlassian.com",
	},
	netlify: {
		label: "Netlify",
		description: "Web hosting and serverless functions",
		docsUrl: "https://app.netlify.com/user/applications",
		color: "#00C7B7",
		domain: "netlify.com",
	},
	heroku: {
		label: "Heroku",
		description: "Cloud platform and app hosting",
		docsUrl: "https://dashboard.heroku.com/account/applications",
		color: "#430098",
		domain: "heroku.com",
	},
	okta: {
		label: "Okta",
		description: "Identity management and SSO",
		docsUrl: "https://developer.okta.com/",
		color: "#007DC1",
		domain: "okta.com",
	},
	vimeo: {
		label: "Vimeo",
		description: "Video hosting and streaming",
		docsUrl: "https://developer.vimeo.com/apps",
		color: "#1AB7EA",
		domain: "vimeo.com",
	},
	harvest: {
		label: "Harvest",
		description: "Time tracking and invoicing",
		docsUrl: "https://id.getharvest.com/developers",
		color: "#FA5D00",
		domain: "getharvest.com",
	},
	strava: {
		label: "Strava",
		description: "Fitness tracking and athletic data",
		docsUrl: "https://www.strava.com/settings/api",
		color: "#FC4C02",
		domain: "strava.com",
	},
	medium: {
		label: "Medium",
		description: "Publishing and blogging platform",
		docsUrl: "https://medium.com/me/applications",
		color: "#000000",
		domain: "medium.com",
	},
	digitalocean: {
		label: "DigitalOcean",
		description: "Cloud infrastructure and hosting",
		docsUrl: "https://cloud.digitalocean.com/account/api/applications",
		color: "#0080FF",
		domain: "digitalocean.com",
	},
	auth0: {
		label: "Auth0",
		description: "Authentication and identity platform",
		docsUrl: "https://manage.auth0.com/dashboard",
		color: "#EB5424",
		domain: "auth0.com",
	},
	apple: {
		label: "Apple",
		description: "Sign in with Apple",
		docsUrl: "https://developer.apple.com/account/resources/authkeys/list",
		color: "#000000",
		domain: "apple.com",
	},
	ebay: {
		label: "eBay",
		description: "Online marketplace and auctions",
		docsUrl: "https://developer.ebay.com/my/keys",
		color: "#E53238",
		domain: "ebay.com",
	},
	wrike: {
		label: "Wrike",
		description: "Project management and collaboration",
		docsUrl: "https://developers.wrike.com/",
		color: "#08CF65",
		domain: "wrike.com",
	},
	basecamp: {
		label: "Basecamp",
		description: "Project management and team comms",
		docsUrl: "https://launchpad.37signals.com/integrations",
		color: "#1D2D35",
		domain: "basecamp.com",
	},
	constantcontact: {
		label: "Constant Contact",
		description: "Email marketing campaigns",
		docsUrl: "https://app.constantcontact.com/pages/dma/portal/",
		color: "#0076BE",
		domain: "constantcontact.com",
	},
	pandadoc: {
		label: "PandaDoc",
		description: "Document automation and e-signatures",
		docsUrl: "https://developers.pandadoc.com/",
		color: "#4FCE5D",
		domain: "pandadoc.com",
	},
	amplitude: {
		label: "Amplitude",
		description: "Product analytics and user behavior",
		docsUrl: "https://www.docs.developers.amplitude.com/",
		color: "#1324E6",
		domain: "amplitude.com",
	},
};

const PROVIDER_OPTIONS = Object.entries(PROVIDER_INFO).map(([key, val]) => ({
	value: key,
	label: val.label,
	description: val.description,
}));

function ProviderIcon({ provider, size = 20 }: { provider: string; size?: number }) {
	const info = PROVIDER_INFO[provider];
	const [imgError, setImgError] = useState(false);
	if (info?.domain && !imgError) {
		return (
			<img
				src={`https://www.google.com/s2/favicons?domain=${info.domain}&sz=64`}
				alt={info.label}
				width={size}
				height={size}
				className="shrink-0 rounded object-contain"
				onError={() => setImgError(true)}
			/>
		);
	}
	const color = info?.color ?? "#6366f1";
	const letter = (info?.label ?? provider).charAt(0).toUpperCase();
	return (
		<div
			className="shrink-0 rounded flex items-center justify-center text-white font-semibold"
			style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.5 }}
		>
			{letter}
		</div>
	);
}

export function OAuthAppsSection() {
	const [configs, setConfigs] = useState<OAuthAppConfigDisplay[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showForm, setShowForm] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchConfigs = useCallback(async () => {
		try {
			const response = await fetch("/api/admin/oauth-apps");
			if (response.ok) {
				const data = (await response.json()) as {
					configs: OAuthAppConfigDisplay[];
				};
				setConfigs(data.configs);
			}
		} catch {
			console.error("Failed to fetch OAuth app configs");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchConfigs();
	}, [fetchConfigs]);

	const handleDelete = useCallback(
		async (provider: string) => {
			if (!confirm(`Delete OAuth app config for "${provider}"?`)) return;
			try {
				const response = await fetch(
					`/api/admin/oauth-apps?provider=${encodeURIComponent(provider)}`,
					{ method: "DELETE" },
				);
				if (response.ok) {
					await fetchConfigs();
				}
			} catch {
				console.error("Failed to delete config");
			}
		},
		[fetchConfigs],
	);

	const configuredProviders = new Set(configs.map((c) => c.provider));

	return (
		<div className="flex flex-col gap-6">
			{/* Configured providers */}
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-medium text-white/70">
						Configured Providers
					</h2>
					<button
						type="button"
						onClick={() => setShowForm(true)}
						className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary-900 text-white hover:bg-primary-800 transition-colors"
					>
						<PlusIcon className="size-3.5" />
						Add Provider
					</button>
				</div>

				{isLoading ? (
					<div className="flex items-center gap-2 py-8 text-sm text-white/40 justify-center">
						<Loader2Icon className="size-4 animate-spin" />
						Loading...
					</div>
				) : configs.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-8 text-white/40 border border-dashed border-white/10 rounded-xl">
						<KeyRoundIcon className="size-8 opacity-50" />
						<p className="text-sm">No OAuth apps configured yet</p>
						<p className="text-xs">
							Add a provider to enable one-click OAuth connect for your
							integrations
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{configs.map((config) => {
							const info = PROVIDER_INFO[config.provider];
							return (
								<div
									key={config.provider}
									className="flex items-start gap-3 p-4 rounded-xl bg-[rgb(27,23,40)] border border-white/[0.08]"
								>
									<div className="mt-0.5">
										<ProviderIcon provider={config.provider} size={28} />
									</div>
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium text-white">
											{info?.label ?? config.provider}
										</div>
										<div className="text-xs text-white/40 mt-0.5">
											{info?.description ?? "Custom provider"}
										</div>
										<div className="text-xs text-white/30 mt-1 font-mono">
											Client ID: {config.clientId.slice(0, 20)}...
										</div>
										<div className="text-xs text-white/30 font-mono">
											Secret: {config.clientSecretMasked}
										</div>
									</div>
									<button
										type="button"
										className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
										onClick={() => handleDelete(config.provider)}
									>
										<Trash2Icon className="size-4" />
									</button>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Add form modal */}
			{showForm && (
				<AddOAuthAppForm
					existingProviders={configuredProviders}
					onClose={() => {
						setShowForm(false);
						setError(null);
					}}
					onSuccess={() => {
						setShowForm(false);
						setError(null);
						fetchConfigs();
					}}
					error={error}
					setError={setError}
				/>
			)}
		</div>
	);
}

function AddOAuthAppForm({
	existingProviders,
	onClose,
	onSuccess,
	error,
	setError,
}: {
	existingProviders: Set<string>;
	onClose: () => void;
	onSuccess: () => void;
	error: string | null;
	setError: (error: string | null) => void;
}) {
	const [provider, setProvider] = useState("");
	const [customProvider, setCustomProvider] = useState("");
	const [clientId, setClientId] = useState("");
	const [clientSecret, setClientSecret] = useState("");
	const [showSecret, setShowSecret] = useState(false);
	const [scopes, setScopes] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const modalRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
				onClose();
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [onClose]);

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [onClose]);

	// Close dropdown on outside click
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setDropdownOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	const filteredOptions = useMemo(() => {
		const available = PROVIDER_OPTIONS.filter(
			(o) => !existingProviders.has(o.value),
		);
		if (!searchQuery.trim()) return available;
		const q = searchQuery.toLowerCase();
		return available.filter(
			(o) =>
				o.label.toLowerCase().includes(q) ||
				o.description.toLowerCase().includes(q) ||
				o.value.toLowerCase().includes(q),
		);
	}, [searchQuery, existingProviders]);

	const effectiveProvider = provider === "__custom" ? customProvider.trim() : provider;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!effectiveProvider || !clientId || !clientSecret) return;

		setIsSubmitting(true);
		setError(null);

		try {
			const response = await fetch("/api/admin/oauth-apps", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					provider: effectiveProvider,
					clientId,
					clientSecret,
					scopes: scopes || undefined,
				}),
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? "Failed to save");
			}

			onSuccess();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to save OAuth app config",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const selectedInfo =
		provider && provider !== "__custom" ? PROVIDER_INFO[provider] : null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div
				ref={modalRef}
				className="w-full max-w-lg mx-4 rounded-xl bg-[rgb(20,17,32)] border border-white/10 shadow-2xl"
			>
				{/* Header */}
				<div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
					<div>
						<h3 className="text-base font-medium text-white">
							Add OAuth App Configuration
						</h3>
						<p className="text-xs text-white/40 mt-0.5">
							Enter the client credentials from your provider's developer
							console
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1 text-white/40 hover:text-white transition-colors"
					>
						<XIcon className="size-4" />
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
					{/* Provider select */}
					<div className="flex flex-col gap-1.5">
						<label className="text-xs text-white/50">Provider</label>
						<div ref={dropdownRef} className="relative">
							<button
								type="button"
								onClick={() => {
									setDropdownOpen(!dropdownOpen);
									if (!dropdownOpen) {
										setTimeout(() => searchInputRef.current?.focus(), 50);
									}
								}}
								className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-white/25 text-left"
							>
								<span className={`flex items-center gap-2 ${provider ? "text-white" : "text-white/30"}`}>
									{provider && provider !== "__custom" && (
										<ProviderIcon provider={provider} size={18} />
									)}
									{provider === "__custom"
										? "Custom provider..."
										: provider
											? (PROVIDER_INFO[provider]?.label ?? provider)
											: "Select a provider..."}
								</span>
								<ChevronDownIcon className={`size-4 text-white/40 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
							</button>

							{dropdownOpen && (
								<div className="absolute z-50 mt-1 w-full rounded-lg bg-[#1b1728] border border-white/10 shadow-2xl overflow-hidden">
									<div className="p-2 border-b border-white/[0.06]">
										<div className="relative">
											<SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/30" />
											<input
												ref={searchInputRef}
												type="text"
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												placeholder="Search providers..."
												className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
												onKeyDown={(e) => {
													if (e.key === "Escape") setDropdownOpen(false);
												}}
											/>
										</div>
									</div>
									<div className="max-h-56 overflow-auto py-1">
										{filteredOptions.length === 0 ? (
											<div className="px-3 py-4 text-xs text-white/30 text-center">
												No providers match your search
											</div>
										) : (
											filteredOptions.map((opt) => (
												<button
													key={opt.value}
													type="button"
													onClick={() => {
														setProvider(opt.value);
														setSearchQuery("");
														setDropdownOpen(false);
													}}
													className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-white/[0.06] transition-colors"
												>
													<ProviderIcon provider={opt.value} size={20} />
													<div className="flex flex-col min-w-0">
														<span className="text-sm text-white">{opt.label}</span>
														<span className="text-[11px] text-white/35 leading-tight">{opt.description}</span>
													</div>
												</button>
											))
										)}
										<div className="border-t border-white/[0.06] mt-1 pt-1">
											<button
												type="button"
												onClick={() => {
													setProvider("__custom");
													setSearchQuery("");
													setDropdownOpen(false);
												}}
												className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-white/[0.06] transition-colors"
											>
												<PlusIcon className="size-3.5 text-white/40" />
												<span className="text-sm text-white/60">Custom provider...</span>
											</button>
										</div>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Custom provider input */}
					{provider === "__custom" && (
						<div className="flex flex-col gap-1.5">
							<label
								htmlFor="custom-provider"
								className="text-xs text-white/50"
							>
								Custom Provider Name
							</label>
							<input
								id="custom-provider"
								type="text"
								value={customProvider}
								onChange={(e) => setCustomProvider(e.target.value)}
								placeholder="e.g., twitter, linkedin"
								className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
								required
							/>
						</div>
					)}

					{/* Developer console link */}
					{selectedInfo && (
						<a
							href={selectedInfo.docsUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-primary-400 hover:text-primary-300 underline"
						>
							Open {selectedInfo.label} Developer Console
						</a>
					)}

					{/* Client ID */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="client-id" className="text-xs text-white/50">
							Client ID
						</label>
						<input
							id="client-id"
							type="text"
							value={clientId}
							onChange={(e) => setClientId(e.target.value)}
							placeholder="Enter OAuth2 Client ID"
							className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25 font-mono"
							required
						/>
					</div>

					{/* Client Secret */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="client-secret" className="text-xs text-white/50">
							Client Secret
						</label>
						<div className="relative">
							<input
								id="client-secret"
								type={showSecret ? "text" : "password"}
								value={clientSecret}
								onChange={(e) => setClientSecret(e.target.value)}
								placeholder="Enter OAuth2 Client Secret"
								className="w-full px-3 py-2 pr-10 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25 font-mono"
								required
							/>
							<button
								type="button"
								onClick={() => setShowSecret(!showSecret)}
								className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60"
							>
								{showSecret ? (
									<EyeOffIcon className="size-4" />
								) : (
									<EyeIcon className="size-4" />
								)}
							</button>
						</div>
					</div>

					{/* Scopes override */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="scopes" className="text-xs text-white/50">
							Scopes Override{" "}
							<span className="text-white/30">(optional)</span>
						</label>
						<input
							id="scopes"
							type="text"
							value={scopes}
							onChange={(e) => setScopes(e.target.value)}
							placeholder="Leave empty to use piece defaults"
							className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-white/25"
						/>
						<p className="text-[10px] text-white/30">
							Comma-separated. If empty, scopes from the piece definition
							will be used automatically.
						</p>
					</div>

					{/* Redirect URI info */}
					<div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
						<p className="text-xs text-white/50 mb-1">
							Set this as your Redirect URI / Callback URL:
						</p>
						<code className="text-xs text-primary-400 font-mono break-all">
							{typeof window !== "undefined"
								? `${window.location.origin}/api/integrations/oauth2/callback`
								: "/api/integrations/oauth2/callback"}
						</code>
					</div>

					{error && (
						<p className="text-sm text-red-400" role="alert">
							{error}
						</p>
					)}

					<div className="flex gap-2 justify-end pt-1">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 text-sm rounded-lg text-white/50 hover:text-white transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={
								isSubmitting || !effectiveProvider || !clientId || !clientSecret
							}
							className="px-4 py-2 text-sm rounded-lg bg-primary-900 text-white hover:bg-primary-800 transition-colors disabled:opacity-40"
						>
							{isSubmitting ? "Saving..." : "Save Configuration"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
