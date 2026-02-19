/**
 * Vibexe Auth Client
 *
 * End-user authentication for Vibexe apps.
 * Manages signup, signin, signout, and session state.
 */

export interface AppUser {
	id: number;
	email: string;
	display_name: string | null;
	role: string;
	email_verified: boolean;
	created_at: string;
}

export interface AuthResponse {
	user: AppUser;
	token: string;
}

export class AuthClient {
	private baseUrl: string;
	private headers: Record<string, string>;
	private sessionToken: string | null = null;

	constructor(baseUrl: string, headers: Record<string, string>) {
		this.baseUrl = baseUrl;
		this.headers = headers;

		// Try to restore session from localStorage (browser only)
		if (typeof window !== "undefined") {
			this.sessionToken = localStorage.getItem("vibexe_session") || null;
		}
	}

	/**
	 * Sign up a new user.
	 */
	async signUp(params: {
		email: string;
		password: string;
		displayName?: string;
	}): Promise<AuthResponse> {
		const res = await fetch(`${this.baseUrl}/auth/signup`, {
			method: "POST",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify({
				email: params.email,
				password: params.password,
				display_name: params.displayName,
			}),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Signup failed: ${res.status}`);
		}

		const data: AuthResponse = await res.json();
		this.setSession(data.token);
		return data;
	}

	/**
	 * Sign in an existing user.
	 */
	async signIn(params: {
		email: string;
		password: string;
	}): Promise<AuthResponse> {
		const res = await fetch(`${this.baseUrl}/auth/signin`, {
			method: "POST",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: JSON.stringify(params),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Signin failed: ${res.status}`);
		}

		const data: AuthResponse = await res.json();
		this.setSession(data.token);
		return data;
	}

	/**
	 * Sign out the current user.
	 */
	async signOut(): Promise<void> {
		if (this.sessionToken) {
			try {
				await fetch(`${this.baseUrl}/auth/signout`, {
					method: "POST",
					headers: {
						...this.headers,
						Authorization: `Bearer ${this.sessionToken}`,
					},
				});
			} catch {
				// Ignore network errors during signout
			}
		}
		this.clearSession();
	}

	/**
	 * Get the currently authenticated user, or null if not signed in.
	 */
	async getCurrentUser(): Promise<AppUser | null> {
		if (!this.sessionToken) return null;

		const res = await fetch(`${this.baseUrl}/auth/me`, {
			headers: {
				...this.headers,
				Authorization: `Bearer ${this.sessionToken}`,
			},
		});

		if (!res.ok) {
			if (res.status === 401) {
				this.clearSession();
				return null;
			}
			return null;
		}

		const data = await res.json();
		return data.user;
	}

	/**
	 * Check if there is an active session token.
	 */
	isAuthenticated(): boolean {
		return this.sessionToken !== null;
	}

	/**
	 * Get the current session token (for custom API calls).
	 */
	getToken(): string | null {
		return this.sessionToken;
	}

	private setSession(token: string): void {
		this.sessionToken = token;
		if (typeof window !== "undefined") {
			localStorage.setItem("vibexe_session", token);
		}
	}

	private clearSession(): void {
		this.sessionToken = null;
		if (typeof window !== "undefined") {
			localStorage.removeItem("vibexe_session");
		}
	}
}
