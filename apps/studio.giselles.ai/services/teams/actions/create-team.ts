"use server";

import { redirect } from "next/navigation";
import invariant from "tiny-invariant";
import { db, teamMemberships, teams } from "@/db";
import { updateGiselleSession } from "@/lib/giselle-session";
import { getUser } from "@/lib/auth/get-user";
import { isEmailFromRoute06 } from "@/lib/utils";
import {
	DRAFT_TEAM_NAME_METADATA_KEY,
	DRAFT_TEAM_USER_DB_ID_METADATA_KEY,
} from "../constants";
import { fetchUserTeams } from "../fetch-user-teams";
import { canCreateFreeTeam } from "../plan-features/free-team-creation";
import { setCurrentTeam } from "../set-current-team";
import { createTeamId } from "../utils";
import { createCheckoutSessionV2 } from "./create-checkout-session-v2";

export async function createTeam(formData: FormData) {
	const teamName = formData.get("teamName") as string;
	const selectedPlan = formData.get("selectedPlan") as string;

	const user = await getUser();
	if (!user) {
		throw new Error("User not found");
	}

	const isInternalUser =
		user.email != null && isEmailFromRoute06(user.email);
	if (isInternalUser) {
		const teamId = await createInternalTeam(user.dbId, teamName);
		await setCurrentTeam(teamId);
		redirect("/settings/team");
	}

	if (selectedPlan === "free") {
		const userTeams = await fetchUserTeams();
		const isEligible = canCreateFreeTeam(
			user.email,
			userTeams.map((t) => t.plan),
		);
		if (!isEligible) {
			throw new Error("You are not eligible to create a free team");
		}
		const teamId = await createFreeTeam(user.dbId, teamName);
		await setCurrentTeam(teamId);
		redirect("/settings/team");
	}

	const checkoutSession = await prepareProTeamCreation(user.dbId, teamName);
	redirect(checkoutSession.url);
}

/**
 * 1. Create a new draft team
 * 2. Set the draft team informations in metadata (https://support.stripe.com/questions/using-metadata-with-checkout-sessions)
 */
async function prepareProTeamCreation(userDbId: number, teamName: string) {
	return createCheckout(userDbId, teamName);
}

async function createCheckout(userDbId: number, teamName: string) {
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
	invariant(siteUrl, "NEXT_PUBLIC_SITE_URL is not set");

	const successUrl = `${siteUrl}/subscriptions/success`;
	const cancelUrl = `${siteUrl}/settings/team`;

	const subscriptionMetadata: Record<string, string> = {
		[DRAFT_TEAM_USER_DB_ID_METADATA_KEY]: userDbId.toString(),
		[DRAFT_TEAM_NAME_METADATA_KEY]: teamName,
	};

	const checkoutSession = await createCheckoutSessionV2(
		subscriptionMetadata,
		successUrl,
		cancelUrl,
	);

	// set checkout id on the session to be able to retrieve it later
	await updateGiselleSession({ checkoutSessionId: checkoutSession.id });
	return checkoutSession;
}

async function createInternalTeam(userDbId: number, teamName: string) {
	return await createTeamInDatabase(userDbId, teamName, true);
}

async function createFreeTeam(userDbId: number, teamName: string) {
	return await createTeamInDatabase(userDbId, teamName, false);
}

async function createTeamInDatabase(
	userDbId: number,
	teamName: string,
	isInternal: boolean,
) {
	const [result] = await db
		.insert(teams)
		.values({
			id: createTeamId(),
			name: teamName,
			plan: isInternal ? "internal" : "free",
		})
		.returning({ id: teams.id, dbId: teams.dbId });

	const teamId = result.id;
	const teamDbId = result.dbId;

	// add membership
	await db.insert(teamMemberships).values({
		teamDbId,
		userDbId,
		role: "admin",
	});
	return teamId;
}
