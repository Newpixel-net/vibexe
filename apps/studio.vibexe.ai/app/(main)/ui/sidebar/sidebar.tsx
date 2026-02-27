import {
	BlocksIcon,
	ChevronDownIcon,
	SettingsIcon,
	ShieldIcon,
	SparklesIcon,
} from "lucide-react";
import type { IconName } from "lucide-react/dynamic";
import { Accordion } from "radix-ui";
import { isAdmin } from "@/lib/admin-guard";
import { fetchCurrentTeam } from "@/services/teams";
import { isInternalPlan } from "@/services/teams/utils";
import { dataStoreFlag, stageV2Flag } from "../../../../flags";
import { CreateAppButton } from "./create-app-button";
import { SidebarLink } from "./sidebar-link";

interface SidebarLinkGroupPart {
	type: "linkGroup";
	id: string;
	label: string;
	icon: IconName;
	links: SidebarLink[];
}

interface SidebarDividerPart {
	type: "divider";
	id: string;
}

type SidebarPart = SidebarLinkGroupPart | SidebarDividerPart;

function SidebarItem({ part }: { part: SidebarPart }) {
	switch (part.type) {
		case "divider":
			return <div className="bg-border/80 h-px mx-2 my-2" />;
		case "linkGroup":
			return (
				<Accordion.Item key={part.id} value={part.id} className="w-full">
					<Accordion.Trigger className="group w-full text-text-muted text-[13px] font-semibold px-2 pt-3 pb-3 flex items-center gap-2 hover:text-text transition-colors outline-none">
						{part.icon === "sparkle" && <SparklesIcon className="size-4" />}
						{part.icon === "blocks" && <BlocksIcon className="size-4" />}
						{part.icon === "settings" && <SettingsIcon className="size-4" />}
						{part.icon === "shield" && <ShieldIcon className="size-4" />}

						<span className="flex-1 text-left">{part.label}</span>
						<ChevronDownIcon className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
					</Accordion.Trigger>

					<Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
						{part.links.map((link) => (
							<SidebarLink key={link.id} {...link}>
								{link.label}
							</SidebarLink>
						))}
					</Accordion.Content>
				</Accordion.Item>
			);
		default: {
			const _exhaustiveCheck: never = part;
			throw new Error(`Unknown sidebar part type: ${_exhaustiveCheck}`);
		}
	}
}

function createBuildPart(isStageV2Enabled: boolean): SidebarPart {
	const links: SidebarLink[] = [
		{
			id: "dashboard",
			label: "Dashboard",
			href: "/dashboard",
			activeMatchPattern: "/dashboard*",
		},
		{
			id: "app-builder",
			label: "App Builder",
			href: "/app-builder",
			activeMatchPattern: ["/app-builder*", "!/app-builder/templates*"],
		},
		{
			id: "templates",
			label: "Templates",
			href: "/app-builder/templates",
			activeMatchPattern: "/app-builder/templates*",
		},
		...(isStageV2Enabled
			? [
					{
						id: "apps",
						label: "Apps",
						href: "/stage/showcase",
						activeMatchPattern: "/stage/showcase",
					},
				]
			: []),
		{
			id: "playground",
			label: "Playground",
			href: "/playground",
			activeMatchPattern: "/playground",
		},
	];

	return {
		type: "linkGroup",
		id: "build",
		label: "Build",
		icon: "sparkle",
		links,
	};
}

function createBaseSidebarParts(
	isApiPublishingEnabled: boolean,
	isDataStoreEnabled: boolean,
): SidebarPart[] {
	return [
		{
			type: "linkGroup",
			id: "automate",
			label: "Automate",
			icon: "blocks",
			links: [
				{
					id: "workflows",
					label: "Workflows",
					href: "/workflows",
					activeMatchPattern: "/workflows*",
				},
				{
					id: "integration",
					label: "Integration",
					href: "/settings/team/integrations",
					activeMatchPattern: "/settings/team/integrations*",
				},
				{
					id: "vector-stores",
					label: "Vector Stores",
					href: "/settings/team/vector-stores",
					activeMatchPattern: "/settings/team/vector-stores*",
				},
				...(isDataStoreEnabled
					? [
							{
								id: "data-stores",
								label: "Data Stores",
								href: "/settings/team/data-stores",
								activeMatchPattern: "/settings/team/data-stores*",
							},
						]
					: []),
				{
					id: "custom-nodes",
					label: "Custom Nodes",
					href: "/settings/team/custom-nodes",
					activeMatchPattern: "/settings/team/custom-nodes*",
				},
				{
					id: "tasks",
					label: "Task History",
					href: "/tasks",
					activeMatchPattern: "/tasks*",
				},
			],
		},
		{ type: "divider", id: "divider1" },
		{
			type: "linkGroup",
			id: "manage",
			label: "Manage",
			icon: "settings",
			links: [
				{
					id: "member",
					label: "Member",
					href: "/settings/team/members",
					activeMatchPattern: "/settings/team/members*",
				},
				{
					id: "usage",
					label: "Usage",
					href: "/settings/team/usage",
					activeMatchPattern: "/settings/team/usage*",
				},
				...(isApiPublishingEnabled
					? [
							{
								id: "api-keys",
								label: "API keys",
								href: "/settings/team/api-keys",
								activeMatchPattern: "/settings/team/api-keys*",
							},
						]
					: []),
				{
					id: "ai-keys",
					label: "AI Keys",
					href: "/settings/team/ai-keys",
					activeMatchPattern: "/settings/team/ai-keys*",
				},
				{
					id: "team-settings",
					label: "Team Settings",
					href: "/settings/team",
					activeMatchPattern: [
						"/settings/team*",
						"!/settings/team/members*",
						"!/settings/team/integrations*",
						"!/settings/team/vector-stores*",
						...(isDataStoreEnabled ? ["!/settings/team/data-stores*"] : []),
						"!/settings/team/usage*",
						"!/settings/team/api-keys*",
						"!/settings/team/ai-keys*",
						"!/settings/team/custom-nodes*",
					],
				},
			],
		},
	];
}

export async function Sidebar() {
	const [isStageV2Enabled, isDataStoreEnabled, team, userIsAdmin] =
		await Promise.all([
			stageV2Flag(),
			dataStoreFlag(),
			fetchCurrentTeam(),
			isAdmin(),
		]);
	const isApiPublishingEnabled = isInternalPlan(team);
	const baseSidebarParts = createBaseSidebarParts(
		isApiPublishingEnabled,
		isDataStoreEnabled,
	);
	const adminParts: SidebarPart[] = userIsAdmin
		? [
				{ type: "divider", id: "divider-admin" },
				{
					type: "linkGroup",
					id: "admin",
					label: "Admin",
					icon: "shield",
					links: [
						{
							id: "admin-dashboard",
							label: "Dashboard",
							href: "/admin/dashboard",
							activeMatchPattern: "/admin/dashboard*",
						},
						{
							id: "admin-users",
							label: "Users",
							href: "/admin/users",
							activeMatchPattern: "/admin/users*",
						},
						{
							id: "admin-teams",
							label: "Teams",
							href: "/admin/teams",
							activeMatchPattern: "/admin/teams*",
						},
						{
							id: "admin-sessions",
							label: "Sessions",
							href: "/admin/sessions",
							activeMatchPattern: "/admin/sessions*",
						},
						{
							id: "admin-system",
							label: "System",
							href: "/admin/system",
							activeMatchPattern: "/admin/system*",
						},
						{
							id: "ai-providers",
							label: "AI Providers",
							href: "/admin/settings/ai-providers",
							activeMatchPattern: "/admin/settings/ai-providers*",
						},
						{
							id: "oauth-apps",
							label: "OAuth Apps",
							href: "/admin/settings/oauth-apps",
							activeMatchPattern: "/admin/settings/oauth-apps*",
						},
						{
							id: "admin-templates",
							label: "Templates",
							href: "/admin/templates",
							activeMatchPattern: "/admin/templates*",
						},
						{
							id: "admin-suggestions",
							label: "Suggestions",
							href: "/admin/suggestions",
							activeMatchPattern: "/admin/suggestions*",
						},
						{
							id: "admin-media-stock",
							label: "Media Stock",
							href: "/admin/media-stock",
							activeMatchPattern: "/admin/media-stock*",
						},
					],
				},
			]
		: [];
	const sidebarParts = [
		createBuildPart(isStageV2Enabled),
		...baseSidebarParts,
		...adminParts,
	];

	return (
		<div className="w-[240px]">
			<div className="px-4">
				<div className="px-0 flex flex-col h-full">
					<div className="flex flex-col">
						<div className="px-1 pt-3 pb-3">
							<CreateAppButton />
						</div>

						<Accordion.Root
							type="multiple"
							className="w-full"
							defaultValue={sidebarParts.map((g) => g.id)}
						>
							{sidebarParts.map((sidebarPart) => (
								<SidebarItem part={sidebarPart} key={sidebarPart.id} />
							))}
						</Accordion.Root>
					</div>
				</div>
			</div>
		</div>
	);
}
