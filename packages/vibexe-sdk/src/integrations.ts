/**
 * Vibexe Integrations Client
 *
 * Execute Activepieces integration actions via the Vibexe REST API.
 */

export class IntegrationsClient {
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor(baseUrl: string, headers: Record<string, string>) {
		this.baseUrl = baseUrl;
		this.headers = headers;
	}

	/**
	 * Get headers with auth token if available.
	 */
	private authHeaders(): Record<string, string> {
		const h = { ...this.headers };
		if (typeof window !== "undefined") {
			const token = localStorage.getItem("vibexe_session");
			if (token) h.Authorization = `Bearer ${token}`;
		}
		return h;
	}

	/**
	 * Execute an integration action.
	 *
	 * @param pieceName - The integration piece name (e.g. "slack", "gmail", "http")
	 * @param actionName - The action to execute (e.g. "send_message", "send_email")
	 * @param properties - Action properties/parameters
	 * @returns The action result
	 */
	async execute<T = unknown>(
		pieceName: string,
		actionName: string,
		properties?: Record<string, unknown>,
	): Promise<T> {
		const url = `${this.baseUrl}/integrations/${encodeURIComponent(pieceName)}/execute`;
		const res = await fetch(url, {
			method: "POST",
			headers: { ...this.authHeaders(), "Content-Type": "application/json" },
			body: JSON.stringify({
				action: actionName,
				properties: properties ?? {},
			}),
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(
				(err as Record<string, string>).error ||
					`Integration '${pieceName}/${actionName}' failed: ${res.status}`,
			);
		}

		const json = await res.json();
		return (json as Record<string, T>).data;
	}
}
