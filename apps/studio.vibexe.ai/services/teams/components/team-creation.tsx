import { getUser } from "@/lib/auth/get-user";
import { isEmailFromRoute06 } from "@/lib/utils";
import { fetchUserTeams } from "../fetch-user-teams";
import { TeamCreationForm } from "./team-creation-form";

export default async function TeamCreation({
	children,
}: {
	children?: React.ReactNode;
}) {
	const user = await getUser();
	if (!user) {
		throw new Error("User not found");
	}
	const isInternalUser = user.email != null && isEmailFromRoute06(user.email);
	const teams = await fetchUserTeams();
	const hasExistingFreeTeam = teams.some((team) => team.plan === "free");

	const proPlanPriceId = process.env.STRIPE_PRO_PLAN_PRICE_ID;
	let proPlanPrice = "";
	if (proPlanPriceId) {
		try {
			const { formatStripePrice, getCachedPrice } = await import(
				"@/services/external/stripe"
			);
			const proPlan = await getCachedPrice(proPlanPriceId);
			proPlanPrice = formatStripePrice(proPlan);
		} catch {
			// Stripe not configured — Pro plan unavailable
		}
	}

	return (
		<TeamCreationForm
			canCreateFreeTeam={!isInternalUser && !hasExistingFreeTeam}
			proPlanPrice={proPlanPrice}
			stripeConfigured={!!proPlanPriceId && !!proPlanPrice}
		>
			{children}
		</TeamCreationForm>
	);
}
