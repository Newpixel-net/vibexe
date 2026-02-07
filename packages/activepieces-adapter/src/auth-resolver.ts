/**
 * Auth Resolver: Converts stored credentials to Activepieces PieceAuth format.
 *
 * Activepieces pieces expect auth in specific formats depending on the auth type:
 * - SecretText: a plain string
 * - OAuth2: { access_token, token_type, ... }
 * - BasicAuth: { username, password }
 * - CustomAuth: piece-specific object
 */

export type AuthType = "oauth2" | "secret_text" | "basic" | "custom";

export interface StoredCredential {
	authType: AuthType;
	config: Record<string, unknown>;
}

/**
 * Resolve a stored credential to the format expected by Activepieces.
 */
export function resolveAuth(credential: StoredCredential | null): unknown {
	if (!credential) return null;

	switch (credential.authType) {
		case "secret_text":
			return credential.config.apiKey ?? credential.config.token ?? "";

		case "oauth2":
			return {
				access_token: credential.config.accessToken,
				token_type: credential.config.tokenType ?? "Bearer",
				refresh_token: credential.config.refreshToken,
				expires_in: credential.config.expiresIn,
				scope: credential.config.scope,
				data: credential.config.data ?? {},
				...credential.config,
			};

		case "basic":
			return {
				username: credential.config.username ?? "",
				password: credential.config.password ?? "",
			};

		case "custom":
			return credential.config;

		default:
			return credential.config;
	}
}
