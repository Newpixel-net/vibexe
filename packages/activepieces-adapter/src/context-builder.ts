/**
 * Context Builder: Constructs the ActionContext that Activepieces piece actions expect.
 *
 * Activepieces actions require a specific context object with auth, properties,
 * store, server info, etc. We build a minimal compatible version.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface StoreAdapter {
	get(key: string): Promise<unknown>;
	put(key: string, value: unknown): Promise<void>;
	delete(key: string): Promise<void>;
}

export type ConnectionResolver = (key: string) => Promise<unknown>;

interface ActionContextArgs {
	auth: unknown;
	propsValue: Record<string, unknown>;
	store?: StoreAdapter;
	files?: {
		write: (args: {
			fileName: string;
			data: Buffer;
		}) => Promise<string>;
	};
	connectionResolver?: ConnectionResolver;
	serverUrl?: string;
}

/**
 * Build an ActionContext compatible with Activepieces piece actions.
 * This provides the minimal interface that pieces need to execute.
 */
export function buildActionContext(args: ActionContextArgs) {
	const memoryStore = new Map<string, unknown>();

	const store = args.store ?? {
		get: async (key: string) => memoryStore.get(key) ?? null,
		put: async (key: string, value: unknown) => {
			memoryStore.set(key, value);
		},
		delete: async (key: string) => {
			memoryStore.delete(key);
		},
	};

	const serverUrl =
		args.serverUrl ||
		process.env.NEXT_PUBLIC_APP_URL ||
		"http://localhost:3000";

	return {
		auth: args.auth,
		propsValue: args.propsValue,
		store: {
			get: store.get.bind(store),
			put: store.put.bind(store),
			delete: store.delete.bind(store),
		},
		files: args.files ?? {
			write: async (_args: { fileName: string; data: Buffer }) => {
				// Write binary data to a temp directory so piece actions can
				// produce files (e.g. HTTP binary downloads) that flow through
				// the node pipeline as file paths.
				const dir = join(tmpdir(), "vibexe-files");
				await mkdir(dir, { recursive: true });
				const filePath = join(dir, `${Date.now()}-${_args.fileName}`);
				await writeFile(filePath, _args.data);
				return filePath;
			},
		},
		server: {
			apiUrl: serverUrl,
			publicUrl: serverUrl,
			token: "",
		},
		run: {
			id: `vibexe-run-${Date.now()}`,
			stop: () => {},
			pause: () => {},
		},
		connections: {
			get: args.connectionResolver ?? (async (_key: string) => null),
		},
		tags: {
			add: async (_params: { name: string }) => {},
		},
		generateResumeUrl: (_params: { queryParams: Record<string, string> }) => {
			return `${serverUrl}/api/integrations/resume`;
		},
	};
}
