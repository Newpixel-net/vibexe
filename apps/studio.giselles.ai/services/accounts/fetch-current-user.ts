import { cache } from "react";
import { getUser } from "@/lib/auth/get-user";

/**
 * @deprecated This implementation is outdated and barrel exported, which unintentionally increases bundle size.
 * Use `getCurrentUser` from "@/lib/get-current-user" instead.
 *
 * @example
 * ```ts
 * import { getCurrentUser } from "@/lib/get-current-user";
 *
 * const user = await getCurrentUser();
 * ```
 */
async function fetchCurrentUser() {
	const user = await getUser();
	return { dbId: user.dbId, id: user.id };
}

const cachedFetchCurrentUser = cache(fetchCurrentUser);
export { cachedFetchCurrentUser as fetchCurrentUser };
