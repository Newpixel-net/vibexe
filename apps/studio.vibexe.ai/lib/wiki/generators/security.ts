/**
 * SECURITY.md Generator
 *
 * Documents auth providers, entity access policies, and session configuration.
 */

interface AuthSettings {
	emailPasswordEnabled: boolean;
	googleEnabled: boolean;
	githubEnabled: boolean;
	microsoftEnabled: boolean;
	appleEnabled: boolean;
	requireApproval: boolean;
}

interface EntityPolicy {
	entityName: string;
	readAccess: string;
	writeAccess: string;
	deleteAccess: string;
	ownerField: string | null;
	allowedRoles: string | null;
}

/**
 * Generate docs/SECURITY.md from auth settings and entity policies.
 */
export function generateSecurity(
	auth: AuthSettings | null,
	policies: EntityPolicy[],
): string {
	const lines: string[] = [];
	lines.push("# Auth & Access Control");
	lines.push("");

	// --- Auth Providers ---
	lines.push("## Authentication Providers");
	lines.push("");

	if (!auth) {
		lines.push("> Auth settings not configured. Defaults apply (email/password enabled).");
		lines.push("");
	} else {
		const providers: string[] = [];
		if (auth.emailPasswordEnabled) providers.push("Email / Password");
		if (auth.googleEnabled) providers.push("Google OAuth");
		if (auth.githubEnabled) providers.push("GitHub OAuth");
		if (auth.microsoftEnabled) providers.push("Microsoft OAuth");
		if (auth.appleEnabled) providers.push("Apple Sign In");

		if (providers.length === 0) {
			lines.push("> No auth providers enabled.");
		} else {
			lines.push("| Provider | Status |");
			lines.push("|----------|--------|");
			for (const p of providers) {
				lines.push(`| ${p} | Enabled |`);
			}
		}
		lines.push("");

		if (auth.requireApproval) {
			lines.push("> **Manual approval required**: New user sign-ups need admin approval before access.");
			lines.push("");
		}
	}

	// --- Entity Access Policies ---
	lines.push("## Entity Access Policies");
	lines.push("");

	if (policies.length === 0) {
		lines.push("> No custom access policies configured. Default: read=public, write=authenticated, delete=authenticated.");
		lines.push("");
	} else {
		lines.push("| Entity | Read | Write | Delete | Owner Field |");
		lines.push("|--------|------|-------|--------|-------------|");
		for (const p of policies) {
			const owner = p.ownerField || "—";
			lines.push(`| ${p.entityName} | ${p.readAccess} | ${p.writeAccess} | ${p.deleteAccess} | ${owner} |`);
		}
		lines.push("");

		// Note about role-based policies
		const roleBased = policies.filter((p) => p.allowedRoles);
		if (roleBased.length > 0) {
			lines.push("### Role-Based Access");
			lines.push("");
			for (const p of roleBased) {
				try {
					const roles = JSON.parse(p.allowedRoles || "[]");
					lines.push(`- **${p.entityName}**: allowed roles — ${(roles as string[]).join(", ")}`);
				} catch {
					lines.push(`- **${p.entityName}**: custom roles configured`);
				}
			}
			lines.push("");
		}
	}

	// --- Access Level Reference ---
	lines.push("## Access Level Reference");
	lines.push("");
	lines.push("| Level | Description |");
	lines.push("|-------|-------------|");
	lines.push("| `public` | Anyone, no authentication required |");
	lines.push("| `authenticated` | Signed-in users only |");
	lines.push("| `owner` | Only the record creator (matched by owner field) |");
	lines.push("| `role` | Specific user roles only |");
	lines.push("");

	return lines.join("\n");
}
