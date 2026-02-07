/**
 * Context Builder: Constructs the ActionContext that Activepieces piece actions expect.
 *
 * Activepieces actions require a specific context object with auth, properties,
 * store, server info, etc. We build a minimal compatible version.
 */

export interface StoreAdapter {
	get(key: string): Promise<unknown>;
	put(key: string, value: unknown): Promise<void>;
	delete(key: string): Promise<void>;
}

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
				return `file://${_args.fileName}`;
			},
		},
		// Stub fields that pieces may reference but we don't use
		server: {
			apiUrl: "http://localhost",
			publicUrl: "http://localhost",
			token: "",
		},
		run: {
			id: "giselle-run",
			stop: () => {},
			pause: () => {},
		},
		connections: {
			get: async (_key: string) => null,
		},
		tags: {
			add: async (_params: { name: string }) => {},
		},
		generateResumeUrl: (_params: { queryParams: Record<string, string> }) => {
			return "http://localhost/resume";
		},
	};
}
