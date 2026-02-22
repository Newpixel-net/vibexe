/**
 * Vibexe Functions Client
 *
 * Invoke serverless backend functions via the Vibexe REST API.
 */

export class FunctionsClient {
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor(baseUrl: string, headers: Record<string, string>) {
		this.baseUrl = baseUrl;
		this.headers = headers;
	}

	/**
	 * Invoke a registered function by name.
	 *
	 * @param name - The function name (registered in the functions panel)
	 * @param data - Optional payload sent as request body
	 * @returns The function's return value
	 */
	async invoke<T = unknown>(name: string, data?: unknown): Promise<T> {
		const url = `${this.baseUrl}/functions/${encodeURIComponent(name)}`;
		const res = await fetch(url, {
			method: "POST",
			headers: { ...this.headers, "Content-Type": "application/json" },
			body: data !== undefined ? JSON.stringify(data) : undefined,
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(
				(err as Record<string, string>).error ||
					`Function '${name}' failed: ${res.status}`,
			);
		}

		const json = await res.json();
		return (json as Record<string, T>).data;
	}
}
