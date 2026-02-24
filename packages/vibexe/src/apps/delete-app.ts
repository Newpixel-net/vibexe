import { AppId } from "@vibexe-ai/protocol";
import * as z from "zod/v4";
import { appPath } from "../path";
import { createVibexeFunction } from "../utils/create-vibexe-function";

export const deleteApp = createVibexeFunction({
	input: z.object({ appId: AppId.schema }),
	handler: async ({ context, input }) => {
		await context.storage.remove(appPath(input.appId));
		await context.callbacks?.appDelete?.({ appId: input.appId });
	},
});
