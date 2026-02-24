import * as v from "valibot";
import { teamIdSchema } from "@/services/teams/validations";
import { getCookie, setCookie } from "./signed-cookie";

const COOKIE_NAME = "vibexe-session";

const VibexeSessionSchema = v.object({
	teamId: v.optional(teamIdSchema),
	// used in creating a new pro team flow
	checkoutSessionId: v.optional(v.string()),
});

type VibexeSession = v.InferOutput<typeof VibexeSessionSchema>;

export async function getVibexeSession(): Promise<VibexeSession | null> {
	const rawSession = await getCookie(COOKIE_NAME);
	if (rawSession == null) {
		return null;
	}
	return v.parse(VibexeSessionSchema, rawSession);
}

export async function updateVibexeSession(session: Partial<VibexeSession>) {
	const currentSession = await getVibexeSession();
	const values = v.parse(VibexeSessionSchema, {
		...currentSession,
		...session,
	});
	await setVibexeSession(values);
}

async function setVibexeSession(session: VibexeSession) {
	await setCookie(COOKIE_NAME, v.parse(VibexeSessionSchema, session));
}
