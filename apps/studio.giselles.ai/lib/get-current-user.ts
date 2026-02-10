import { cache } from "react";
import { getUser } from "./auth/get-user";

async function _getCurrentUser() {
	const user = await getUser();
	return {
		id: user.id,
		dbId: user.dbId,
		displayName: user.displayName ?? null,
		email: user.email ?? null,
		avatarUrl: user.avatarUrl ?? null,
	};
}

export const getCurrentUser = cache(_getCurrentUser);
