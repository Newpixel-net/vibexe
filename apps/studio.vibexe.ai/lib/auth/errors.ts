export type AuthError = {
	name: string;
	status: number | undefined;
	code: string | undefined;
	message: string;
};

const GENERIC_AUTH_ERROR_MESSAGE =
	"We could not complete your request. Please try again.";

export function createAuthError(error: unknown): AuthError {
	if (error && typeof error === "object" && "message" in error) {
		const e = error as { message: string; name?: string; status?: number; code?: string };
		return {
			code: e.code ?? "unknown_error",
			message: e.message || GENERIC_AUTH_ERROR_MESSAGE,
			name: e.name ?? "AuthError",
			status: e.status,
		};
	}

	if (error instanceof Error) {
		return {
			code: "unknown_error",
			message: error.message || GENERIC_AUTH_ERROR_MESSAGE,
			name: error.name,
			status: undefined,
		};
	}

	return {
		code: "unknown_error",
		message: GENERIC_AUTH_ERROR_MESSAGE,
		name: "UnknownError",
		status: undefined,
	};
}
