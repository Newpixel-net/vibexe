/**
 * DEPLOYMENT.md Generator
 *
 * Documents deployment info (subdomain, URL), storage settings,
 * connected integrations, and environment configuration.
 */

interface DeploymentInfo {
	subdomain: string | null;
	customDomain: string | null;
	deployedAt: Date | null;
}

interface StorageSettings {
	accessLevel: string;
	maxFileSizeMb: number;
	storageQuotaMb: number;
	allowedTypes: string[] | null;
}

interface Integration {
	pieceName: string;
	displayName: string | null;
	status: string | null;
}

interface EnvironmentInfo {
	name: string;
	databaseName: string | null;
	status: string | null;
}

/**
 * Generate docs/DEPLOYMENT.md from deployment, storage, integrations, and environments.
 */
export function generateDeployment(
	deployment: DeploymentInfo | null,
	storage: StorageSettings | null,
	integrations: Integration[],
	environments: EnvironmentInfo[],
): string {
	const lines: string[] = [];
	lines.push("# Deployment & Environment");
	lines.push("");

	// --- Deployment ---
	lines.push("## Deployment");
	lines.push("");

	if (!deployment || !deployment.subdomain) {
		lines.push("> App has not been deployed yet.");
		lines.push("");
	} else {
		const url = deployment.customDomain
			? `https://${deployment.customDomain}`
			: `https://vibexe.online/apps/${deployment.subdomain}/`;
		lines.push(`| Property | Value |`);
		lines.push(`|----------|-------|`);
		lines.push(`| Subdomain | \`${deployment.subdomain}\` |`);
		lines.push(`| URL | ${url} |`);
		if (deployment.customDomain) {
			lines.push(`| Custom Domain | \`${deployment.customDomain}\` |`);
		}
		if (deployment.deployedAt) {
			lines.push(`| Last Deployed | ${deployment.deployedAt.toISOString().split("T")[0]} |`);
		}
		lines.push("");
	}

	// --- Environments ---
	if (environments.length > 1) {
		lines.push("## Environments");
		lines.push("");
		lines.push("| Name | Database | Status |");
		lines.push("|------|----------|--------|");
		for (const env of environments) {
			lines.push(`| ${env.name} | ${env.databaseName || "—"} | ${env.status || "active"} |`);
		}
		lines.push("");
	}

	// --- Storage ---
	lines.push("## File Storage");
	lines.push("");

	if (!storage) {
		lines.push("> Storage not configured. Default: authenticated access, 10MB max, 500MB quota.");
		lines.push("");
	} else {
		lines.push("| Setting | Value |");
		lines.push("|---------|-------|");
		lines.push(`| Access Level | ${storage.accessLevel} |`);
		lines.push(`| Max File Size | ${storage.maxFileSizeMb} MB |`);
		lines.push(`| Storage Quota | ${storage.storageQuotaMb} MB |`);
		if (storage.allowedTypes && storage.allowedTypes.length > 0) {
			lines.push(`| Allowed Types | ${storage.allowedTypes.join(", ")} |`);
		}
		lines.push("");
	}

	// --- Integrations ---
	lines.push("## Connected Integrations");
	lines.push("");

	if (integrations.length === 0) {
		lines.push("> No integrations connected.");
		lines.push("");
	} else {
		lines.push("| Service | Status |");
		lines.push("|---------|--------|");
		for (const i of integrations) {
			const name = i.displayName || i.pieceName;
			const status = i.status || "connected";
			lines.push(`| ${name} | ${status} |`);
		}
		lines.push("");
	}

	return lines.join("\n");
}
