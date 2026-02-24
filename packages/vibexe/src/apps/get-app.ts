import { App, AppId } from "@vibexe-ai/protocol";
import * as z from "zod/v4";
import { appPath } from "../path";
import { createVibexeFunction } from "../utils/create-vibexe-function";

export const getApp = createVibexeFunction({
	input: z.object({ appId: AppId.schema }),
	handler: async ({ context, input }) => {
		return await context.storage.getJson({
			path: appPath(input.appId),
			schema: App,
		});
	},
});
