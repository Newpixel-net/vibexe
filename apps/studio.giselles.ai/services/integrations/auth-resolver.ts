/**
 * Auth Resolver: Decrypts credentials and converts to Activepieces PieceAuth format.
 */

import type { IntegrationCredential } from "./credential-store";

/**
 * Convert a stored credential to the format expected by Activepieces piece actions.
 */
export function resolveCredentialToAuth(
	credential: IntegrationCredential | null,
): unknown {
	if (!credential) return null;

	switch (credential.authType) {
		case "secret_text":
			// Activepieces SecretText auth expects a plain string
			return (
				credential.config.apiKey ??
				credential.config.token ??
				credential.config.secret ??
				""
			);

		case "oauth2":
			// Activepieces OAuth2 expects { access_token, token_type, refresh_token, ... }
			return {
				access_token: credential.config.accessToken,
				token_type: credential.config.tokenType ?? "Bearer",
				refresh_token: credential.config.refreshToken,
				expires_in: credential.config.expiresIn,
				scope: credential.config.scope,
				data: credential.config.data ?? {},
			};

		case "basic":
			// Activepieces BasicAuth expects { username, password }
			return {
				username: credential.config.username ?? "",
				password: credential.config.password ?? "",
			};

		case "custom":
			// Custom auth passes through the config directly
			return credential.config;

		default:
			return credential.config;
	}
}
