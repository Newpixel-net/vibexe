import { getUser } from "@/lib/supabase";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "newpixel.net1@gmail.com";

export async function requireAdmin() {
	const user = await getUser();
	if (user.email !== ADMIN_EMAIL) {
		throw new Error("Unauthorized: admin access required");
	}
	return user;
}

export async function isAdmin(): Promise<boolean> {
	try {
		const user = await getUser();
		return user.email === ADMIN_EMAIL;
	} catch {
		return false;
	}
}
