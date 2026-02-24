"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteSession } from "@/lib/session-store";

const SESSION_COOKIE_NAME = "vibexe-auth";

export const signOut = async () => {
	const cookieStore = await cookies();
	const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

	if (sessionToken) {
		await deleteSession(sessionToken);
	}

	cookieStore.delete(SESSION_COOKIE_NAME);
	redirect("/login");
};
