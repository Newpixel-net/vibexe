import { getUser } from "@/lib/auth/get-user";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.toLowerCase();
if (!ADMIN_EMAIL) {
	console.warn("[admin-guard] ADMIN_EMAIL env var not set — admin routes will be disabled");
}

export async function requireAdmin() {
	if (!ADMIN_EMAIL) {
		throw new Error("Unauthorized: ADMIN_EMAIL not configured");
	}
	const user = await getUser();
	if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
		throw new Error("Unauthorized: admin access required");
	}
	return user;
}

export async function isAdmin(): Promise<boolean> {
	if (!ADMIN_EMAIL) return false;
	try {
		const user = await getUser();
		return user.email?.toLowerCase() === ADMIN_EMAIL;
	} catch {
		return false;
	}
}
