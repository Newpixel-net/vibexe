import type { Trigger, TriggerId } from "@vibexe-ai/protocol";
import { useVibexe } from "@vibexe-ai/react";
import { useCallback, useMemo } from "react";
import useSWR from "swr";

export function useGitHubTrigger(triggerId: TriggerId) {
	const client = useVibexe();
	const {
		isLoading: isLoadingTriggerData,
		data: trigger,
		mutate,
	} = useSWR(
		{
			namespace: "getTrigger",
			triggerId,
		},
		({ triggerId }) =>
			client
				.getTrigger({
					triggerId,
				})
				.then((res) => res.trigger),
		{
			keepPreviousData: true,
		},
	);

	const {
		isLoading: isLoadingGitHubRepositoryFullname,
		data: githubRepositoryFullnameData,
	} = useSWR(
		trigger && trigger.configuration.provider === "github"
			? {
					installationId: trigger.configuration.installationId,
					repositoryNodeId: trigger.configuration.repositoryNodeId,
				}
			: null,
		({ installationId, repositoryNodeId }) =>
			client.getGitHubRepositoryFullname({
				installationId,
				repositoryNodeId,
			}),
		{
			keepPreviousData: true,
		},
	);
	const data = useMemo(
		() =>
			trigger === undefined ||
			trigger.configuration.provider !== "github" ||
			githubRepositoryFullnameData === undefined
				? undefined
				: {
						trigger: {
							...trigger,
							configuration: {
								...trigger.configuration,
							},
						},
						githubRepositoryFullname: githubRepositoryFullnameData.fullname,
					},
		[trigger, githubRepositoryFullnameData],
	);
	const setTrigger = useCallback(
		(newValue: Partial<Trigger>) => {
			if (trigger === undefined) {
				return;
			}
			mutate(
				(async () => {
					const newData = {
						...trigger,
						...newValue,
					} satisfies Trigger;
					await client.setTrigger({
						trigger: newData,
					});
					return newData;
				}) as any,
				{
					optimisticData: (() => ({
						...trigger,
						...newValue,
					})) as any,
				},
			);
		},
		[client, mutate, trigger],
	);
	const enableTrigger = useCallback(() => {
		setTrigger({ enable: true });
	}, [setTrigger]);
	const disableTrigger = useCallback(() => {
		setTrigger({ enable: false });
	}, [setTrigger]);
	const setTriggerConfiguration = useCallback(
		(configuration: Trigger["configuration"]) => {
			setTrigger({ configuration });
		},
		[setTrigger],
	);
	return {
		isLoading: isLoadingTriggerData || isLoadingGitHubRepositoryFullname,
		data,
		enableTrigger,
		disableTrigger,
		setTriggerConfiguration,
	};
}
