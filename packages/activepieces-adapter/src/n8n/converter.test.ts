import { describe, it, expect } from "vitest";
import { convertN8NToGiselle, type N8NWorkflow } from "./converter";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const fixture = {
	/** 1. Simple linear: trigger -> code -> slack */
	simpleLinear: (): N8NWorkflow => ({
		name: "Simple Linear",
		nodes: [
			{
				name: "Manual Trigger",
				type: "n8n-nodes-base.manualTrigger",
				position: [0, 0],
				parameters: {},
			},
			{
				name: "Code",
				type: "n8n-nodes-base.code",
				position: [200, 0],
				parameters: { jsCode: "return items;" },
			},
			{
				name: "Slack",
				type: "n8n-nodes-base.slack",
				position: [400, 0],
				parameters: { operation: "postMessage" },
				credentials: { slackOAuth2Api: { id: "123", name: "My Slack" } },
			},
		],
		connections: {
			"Manual Trigger": {
				main: [[{ node: "Code", type: "main", index: 0 }]],
			},
			Code: {
				main: [[{ node: "Slack", type: "main", index: 0 }]],
			},
		},
	}),

	/** 2. Branching: trigger -> if -> true/false */
	branching: (): N8NWorkflow => ({
		name: "Branching",
		nodes: [
			{
				name: "Start",
				type: "n8n-nodes-base.manualTrigger",
				position: [0, 0],
				parameters: {},
			},
			{
				name: "If",
				type: "n8n-nodes-base.if",
				position: [200, 0],
				parameters: {
					conditions: {
						conditions: [
							{ leftValue: "={{ $json.status }}", operator: "equal", rightValue: "active" },
						],
					},
				},
			},
			{
				name: "True Branch",
				type: "n8n-nodes-base.set",
				position: [400, -100],
				parameters: { assignments: { assignments: [{ name: "result", value: "yes" }] } },
			},
			{
				name: "False Branch",
				type: "n8n-nodes-base.set",
				position: [400, 100],
				parameters: { assignments: { assignments: [{ name: "result", value: "no" }] } },
			},
		],
		connections: {
			Start: {
				main: [[{ node: "If", type: "main", index: 0 }]],
			},
			If: {
				main: [
					[{ node: "True Branch", type: "main", index: 0 }],
					[{ node: "False Branch", type: "main", index: 0 }],
				],
			},
		},
	}),

	/** 3. Polling loop: if -> wait -> http -> if (cycle) */
	pollingLoop: (): N8NWorkflow => ({
		name: "Polling Loop",
		nodes: [
			{
				name: "Start",
				type: "n8n-nodes-base.manualTrigger",
				position: [0, 0],
				parameters: {},
			},
			{
				name: "HTTP Request",
				type: "n8n-nodes-base.httpRequest",
				position: [200, 0],
				parameters: { url: "https://api.example.com/status" },
			},
			{
				name: "Check Status",
				type: "n8n-nodes-base.if",
				position: [400, 0],
				parameters: {
					conditions: {
						conditions: [
							{ leftValue: "={{ $json.status }}", operator: "equal", rightValue: "completed" },
						],
					},
				},
			},
			{
				name: "Wait",
				type: "n8n-nodes-base.wait",
				position: [600, 100],
				parameters: { amount: 60, unit: "seconds" },
			},
			{
				name: "Done",
				type: "n8n-nodes-base.set",
				position: [600, -100],
				parameters: { assignments: { assignments: [{ name: "done", value: "true" }] } },
			},
		],
		connections: {
			Start: {
				main: [[{ node: "HTTP Request", type: "main", index: 0 }]],
			},
			"HTTP Request": {
				main: [[{ node: "Check Status", type: "main", index: 0 }]],
			},
			"Check Status": {
				main: [
					[{ node: "Done", type: "main", index: 0 }],
					[{ node: "Wait", type: "main", index: 0 }],
				],
			},
			Wait: {
				main: [[{ node: "HTTP Request", type: "main", index: 0 }]], // Back-edge!
			},
		},
	}),

	/** 4. Complex multi-branch switch with merge */
	complexSwitch: (): N8NWorkflow => ({
		name: "Complex Switch",
		nodes: [
			{
				name: "Trigger",
				type: "n8n-nodes-base.manualTrigger",
				position: [0, 0],
				parameters: {},
			},
			{
				name: "Switch",
				type: "n8n-nodes-base.switch",
				position: [200, 0],
				parameters: {
					rules: {
						values: [
							{ name: "Case A", conditions: { conditions: [{ leftValue: "type", operator: "equal", rightValue: "a" }] } },
							{ name: "Case B", conditions: { conditions: [{ leftValue: "type", operator: "equal", rightValue: "b" }] } },
							{ name: "Case C", conditions: { conditions: [{ leftValue: "type", operator: "equal", rightValue: "c" }] } },
							{ name: "Case D", conditions: { conditions: [{ leftValue: "type", operator: "equal", rightValue: "d" }] } },
						],
					},
				},
			},
			{
				name: "Merge",
				type: "n8n-nodes-base.merge",
				position: [600, 0],
				parameters: { mode: "append" },
			},
		],
		connections: {
			Trigger: {
				main: [[{ node: "Switch", type: "main", index: 0 }]],
			},
			Switch: {
				main: [
					[{ node: "Merge", type: "main", index: 0 }],
					[{ node: "Merge", type: "main", index: 1 }],
					[{ node: "Merge", type: "main", index: 0 }],
					[{ node: "Merge", type: "main", index: 1 }],
				],
			},
		},
	}),

	/** 5. All 7 new node types */
	allNewNodeTypes: (): N8NWorkflow => ({
		name: "All New Nodes",
		nodes: [
			{
				name: "Trigger",
				type: "n8n-nodes-base.manualTrigger",
				position: [0, 0],
				parameters: {},
			},
			{
				name: "Aggregate",
				type: "n8n-nodes-base.aggregate",
				position: [200, 0],
				parameters: {
					fieldsToAggregate: {
						values: [{ field: "amount", aggregation: "sum" }],
					},
					groupBy: "category",
				},
			},
			{
				name: "Limit",
				type: "n8n-nodes-base.limit",
				position: [400, 0],
				parameters: { maxItems: 5, keep: "firstItems" },
			},
			{
				name: "Remove Duplicates",
				type: "n8n-nodes-base.removeDuplicates",
				position: [600, 0],
				parameters: { fieldToCompare: "email" },
			},
			{
				name: "Rename Keys",
				type: "n8n-nodes-base.renameKeys",
				position: [800, 0],
				parameters: { keys: { key: [{ currentKey: "old_name", newKey: "new_name" }] } },
			},
			{
				name: "Split Out",
				type: "n8n-nodes-base.splitOut",
				position: [1000, 0],
				parameters: { fieldToSplitOut: "items" },
			},
			{
				name: "Compare Datasets",
				type: "n8n-nodes-base.compareDatasets",
				position: [1200, 0],
				parameters: { mergeByField1: "id" },
			},
			{
				name: "Summarize",
				type: "n8n-nodes-base.summarize",
				position: [1400, 0],
				parameters: { fieldsToSummarize: "revenue" },
			},
		],
		connections: {
			Trigger: {
				main: [[{ node: "Aggregate", type: "main", index: 0 }]],
			},
			Aggregate: {
				main: [[{ node: "Limit", type: "main", index: 0 }]],
			},
			Limit: {
				main: [[{ node: "Remove Duplicates", type: "main", index: 0 }]],
			},
			"Remove Duplicates": {
				main: [[{ node: "Rename Keys", type: "main", index: 0 }]],
			},
			"Rename Keys": {
				main: [[{ node: "Split Out", type: "main", index: 0 }]],
			},
		},
	}),

	/** 6. Credential references */
	credentials: (): N8NWorkflow => ({
		name: "With Credentials",
		nodes: [
			{
				name: "Trigger",
				type: "n8n-nodes-base.manualTrigger",
				position: [0, 0],
				parameters: {},
			},
			{
				name: "Slack",
				type: "n8n-nodes-base.slack",
				position: [200, 0],
				parameters: { operation: "postMessage" },
				credentials: { slackOAuth2Api: { id: "1", name: "My Slack" } },
			},
			{
				name: "Gmail",
				type: "n8n-nodes-base.gmail",
				position: [200, 200],
				parameters: { operation: "send" },
				credentials: { gmailOAuth2: { id: "2", name: "My Gmail" } },
			},
		],
		connections: {
			Trigger: {
				main: [
					[
						{ node: "Slack", type: "main", index: 0 },
						{ node: "Gmail", type: "main", index: 0 },
					],
				],
			},
		},
	}),

	/** 7. Error handling config */
	errorHandling: (): N8NWorkflow => ({
		name: "Error Handling",
		nodes: [
			{
				name: "Trigger",
				type: "n8n-nodes-base.manualTrigger",
				position: [0, 0],
				parameters: {},
			},
			{
				name: "Retry Node",
				type: "n8n-nodes-base.httpRequest",
				position: [200, 0],
				parameters: {
					url: "https://api.example.com",
					onError: "continueOnFail",
					retryOnFail: true,
					maxTries: 5,
					waitBetweenTries: 2000,
				},
			},
			{
				name: "Continue Node",
				type: "n8n-nodes-base.httpRequest",
				position: [200, 200],
				parameters: {
					url: "https://api.example.com",
					onError: "continueErrorOutput",
				},
			},
		],
		connections: {
			Trigger: {
				main: [
					[
						{ node: "Retry Node", type: "main", index: 0 },
						{ node: "Continue Node", type: "main", index: 0 },
					],
				],
			},
		},
	}),

	/** 8. Expression patterns */
	expressions: (): N8NWorkflow => ({
		name: "Expressions",
		nodes: [
			{
				name: "Source",
				type: "n8n-nodes-base.manualTrigger",
				position: [0, 0],
				parameters: {},
			},
			{
				name: "Set",
				type: "n8n-nodes-base.set",
				position: [200, 0],
				parameters: {
					assignments: {
						assignments: [
							{ name: "field1", value: "={{ $('Source').first().json.name }}" },
							{ name: "field2", value: "={{ $json.status }}" },
							{ name: "field3", value: "={{ $node[\"Source\"].json.value }}" },
							{ name: "field4", value: "={{ $input.first().json.data }}" },
							{ name: "field5", value: "={{ $now }}" },
							{ name: "field6", value: "={{ $execution.id }}" },
							{ name: "field7", value: "={{ $itemIndex }}" },
							{ name: "field8", value: "={{ $('Source').all() }}" },
						],
					},
				},
			},
		],
		connections: {
			Source: {
				main: [[{ node: "Set", type: "main", index: 0 }]],
			},
		},
	}),

	/** 9. Schedule + webhook triggers with config */
	triggers: (): N8NWorkflow => ({
		name: "Scheduled Workflow",
		nodes: [
			{
				name: "Schedule",
				type: "n8n-nodes-base.scheduleTrigger",
				position: [0, 0],
				parameters: {
					rule: {
						interval: [{ field: "hours", hoursInterval: 6 }],
					},
				},
			},
			{
				name: "Process",
				type: "n8n-nodes-base.set",
				position: [200, 0],
				parameters: { assignments: { assignments: [{ name: "ran", value: "true" }] } },
			},
		],
		connections: {
			Schedule: {
				main: [[{ node: "Process", type: "main", index: 0 }]],
			},
		},
	}),

	/** 10. Disabled nodes + pinned data */
	disabledAndPinned: (): N8NWorkflow => ({
		name: "Disabled and Pinned",
		nodes: [
			{
				name: "Trigger",
				type: "n8n-nodes-base.manualTrigger",
				position: [0, 0],
				parameters: {},
			},
			{
				name: "Disabled Code",
				type: "n8n-nodes-base.code",
				position: [200, 0],
				parameters: { jsCode: "return items;" },
				disabled: true,
			},
			{
				name: "Active Code",
				type: "n8n-nodes-base.code",
				position: [400, 0],
				parameters: { jsCode: "return items;" },
			},
		],
		connections: {
			Trigger: {
				main: [[{ node: "Disabled Code", type: "main", index: 0 }]],
			},
			"Disabled Code": {
				main: [[{ node: "Active Code", type: "main", index: 0 }]],
			},
		},
		pinData: {
			"Active Code": [{ json: { test: "pinned value" } }],
		},
	}),

	/** 11. Respond to Webhook node */
	respondToWebhook: (): N8NWorkflow => ({
		name: "Webhook Response",
		nodes: [
			{
				name: "Webhook",
				type: "n8n-nodes-base.webhook",
				position: [0, 0],
				parameters: {},
			},
			{
				name: "Process",
				type: "n8n-nodes-base.code",
				position: [200, 0],
				parameters: { jsCode: "return items;" },
			},
			{
				name: "Respond",
				type: "n8n-nodes-base.respondToWebhook",
				position: [400, 0],
				parameters: {
					responseCode: 201,
					contentType: "application/json",
					responseHeaders: {
						entries: [{ name: "X-Custom", value: "test" }],
					},
				},
			},
		],
		connections: {
			Webhook: {
				main: [[{ node: "Process", type: "main", index: 0 }]],
			},
			Process: {
				main: [[{ node: "Respond", type: "main", index: 0 }]],
			},
		},
	}),
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("convertN8NToGiselle", () => {
	describe("Phase 1: Node Type Mappings", () => {
		it("should convert simple linear workflow", () => {
			const result = convertN8NToGiselle(fixture.simpleLinear());
			expect(result.name).toBe("Simple Linear");
			expect(result.nodes).toHaveLength(3);
			expect(result.connections).toHaveLength(2);

			const nodeTypes = result.nodes.map((n) => (n.content as { type: string }).type);
			expect(nodeTypes).toContain("trigger");
			expect(nodeTypes).toContain("code");
			expect(nodeTypes).toContain("integration");
		});

		it("should convert all 7 new node types", () => {
			const result = convertN8NToGiselle(fixture.allNewNodeTypes());
			const contentTypes = result.nodes.map((n) => (n.content as { type: string }).type);

			expect(contentTypes).toContain("aggregate");
			expect(contentTypes).toContain("limit");
			expect(contentTypes).toContain("removeDuplicates");
			expect(contentTypes).toContain("renameKeys");
			expect(contentTypes).toContain("splitOut");
			expect(contentTypes).toContain("compareDatasets");
			expect(contentTypes).toContain("summarize");
		});

		it("should set hasFlowControl for new node types", () => {
			const result = convertN8NToGiselle(fixture.allNewNodeTypes());
			expect(result.hasFlowControl).toBe(true);
		});

		it("should extract aggregate operations", () => {
			const result = convertN8NToGiselle(fixture.allNewNodeTypes());
			const agg = result.nodes.find((n) => (n.content as { type: string }).type === "aggregate");
			expect(agg).toBeDefined();
			const content = agg!.content as { operations: Array<{ field: string; operation: string }>; groupBy: string[] };
			expect(content.operations).toHaveLength(1);
			expect(content.operations[0].field).toBe("amount");
			expect(content.operations[0].operation).toBe("sum");
			expect(content.groupBy).toContain("category");
		});

		it("should extract limit config", () => {
			const result = convertN8NToGiselle(fixture.allNewNodeTypes());
			const limit = result.nodes.find((n) => (n.content as { type: string }).type === "limit");
			expect(limit).toBeDefined();
			const content = limit!.content as { maxItems: number; keep: string };
			expect(content.maxItems).toBe(5);
			expect(content.keep).toBe("first");
		});

		it("should extract rename key mappings", () => {
			const result = convertN8NToGiselle(fixture.allNewNodeTypes());
			const rename = result.nodes.find((n) => (n.content as { type: string }).type === "renameKeys");
			expect(rename).toBeDefined();
			const content = rename!.content as { mappings: Array<{ from: string; to: string }> };
			expect(content.mappings).toHaveLength(1);
			expect(content.mappings[0].from).toBe("old_name");
			expect(content.mappings[0].to).toBe("new_name");
		});

		it("should handle compareDatasets with multiple inputs/outputs", () => {
			const result = convertN8NToGiselle(fixture.allNewNodeTypes());
			const compare = result.nodes.find((n) => (n.content as { type: string }).type === "compareDatasets");
			expect(compare).toBeDefined();
			expect(compare!.inputs).toHaveLength(2);
			expect(compare!.outputs).toHaveLength(3);
			expect(compare!.inputs[0].accessor).toBe("input1");
			expect(compare!.inputs[1].accessor).toBe("input2");
			expect(compare!.outputs[0].accessor).toBe("inBoth");
		});
	});

	describe("Phase 1: Metadata Transfer", () => {
		it("should transfer disabled flag", () => {
			const result = convertN8NToGiselle(fixture.disabledAndPinned());
			const disabled = result.nodes.find((n) => n.name === "Disabled Code");
			const active = result.nodes.find((n) => n.name === "Active Code");
			expect(disabled?.disabled).toBe(true);
			expect(active?.disabled).toBeUndefined();
		});

		it("should transfer pinned data", () => {
			const result = convertN8NToGiselle(fixture.disabledAndPinned());
			const active = result.nodes.find((n) => n.name === "Active Code");
			expect(active?.pinnedData).toBeDefined();
			expect(active?.pinnedData).toEqual([{ json: { test: "pinned value" } }]);
		});

		it("should track disabled nodes in importMeta", () => {
			const result = convertN8NToGiselle(fixture.disabledAndPinned());
			expect(result.importMeta?.disabledNodes).toBe(1);
		});
	});

	describe("Phase 2: Credentials", () => {
		it("should extract credential hints", () => {
			const result = convertN8NToGiselle(fixture.credentials());
			const slack = result.nodes.find((n) => n.name === "Slack");
			const gmail = result.nodes.find((n) => n.name === "Gmail");

			expect(slack?.credentialHint).toBeDefined();
			expect(slack?.credentialHint?.n8nCredentialType).toBe("slackOAuth2Api");
			expect(slack?.credentialHint?.suggestedPiece).toBe("slack");

			expect(gmail?.credentialHint).toBeDefined();
			expect(gmail?.credentialHint?.n8nCredentialType).toBe("gmailOAuth2");
			expect(gmail?.credentialHint?.suggestedPiece).toBe("gmail");
		});

		it("should generate warnings for credentials", () => {
			const result = convertN8NToGiselle(fixture.credentials());
			const credWarnings = result.warnings.filter((w) => w.nodeType === "credential");
			expect(credWarnings.length).toBeGreaterThanOrEqual(2);
		});

		it("should count nodes needing credentials in importMeta", () => {
			const result = convertN8NToGiselle(fixture.credentials());
			expect(result.importMeta?.nodesNeedingCredentials).toBe(2);
		});
	});

	describe("Phase 2: Error Handling", () => {
		it("should extract continueOnFail error config", () => {
			const result = convertN8NToGiselle(fixture.errorHandling());
			const retryNode = result.nodes.find((n) => n.name === "Retry Node");
			expect(retryNode?.errorConfig).toBeDefined();
			expect(retryNode?.errorConfig?.onError).toBe("continueOnFail");
			expect(retryNode?.errorConfig?.retryOnFail).toBe(true);
			expect(retryNode?.errorConfig?.maxRetries).toBe(5);
			expect(retryNode?.errorConfig?.retryDelay).toBe(2000);
		});

		it("should map continueErrorOutput to routeToError", () => {
			const result = convertN8NToGiselle(fixture.errorHandling());
			const continueNode = result.nodes.find((n) => n.name === "Continue Node");
			expect(continueNode?.errorConfig?.onError).toBe("routeToError");
		});

		it("should not create errorConfig for default settings", () => {
			const result = convertN8NToGiselle(fixture.simpleLinear());
			const trigger = result.nodes.find((n) => n.name === "Manual Trigger");
			expect(trigger?.errorConfig).toBeUndefined();
		});
	});

	describe("Phase 3: Expressions", () => {
		it("should translate N8N expressions to Giselle format", () => {
			const result = convertN8NToGiselle(fixture.expressions());
			const setNode = result.nodes.find((n) => n.name === "Set");
			expect(setNode).toBeDefined();
			const content = setNode!.content as { operations: Array<{ value: string }> };
			const values = content.operations.map((op) => op.value);

			expect(values).toContain("[Source.name]"); // $('Source').first().json.name
			expect(values).toContain("[input.status]"); // $json.status
			expect(values).toContain("[Source.value]"); // $node["Source"].json.value
			expect(values).toContain("[input.data]"); // $input.first().json.data
			expect(values).toContain("[timestamp]"); // $now
			expect(values).toContain("[execution.id]"); // $execution.id
			expect(values).toContain("[index]"); // $itemIndex
			expect(values).toContain("[Source.*]"); // $('Source').all()
		});
	});

	describe("Phase 4: Triggers", () => {
		it("should extract schedule config", () => {
			const result = convertN8NToGiselle(fixture.triggers());
			expect(result.importMeta?.scheduleConfig).toBeDefined();
			expect(result.importMeta?.scheduleConfig?.cronExpression).toBe("0 */6 * * *");
			expect(result.importMeta?.scheduleConfig?.timezone).toBe("UTC");
		});

		it("should convert respondToWebhook to native node", () => {
			const result = convertN8NToGiselle(fixture.respondToWebhook());
			const respond = result.nodes.find((n) => n.name === "Respond");
			expect(respond).toBeDefined();
			const content = respond!.content as { type: string; statusCode: number; headers: Record<string, string> };
			expect(content.type).toBe("respondToWebhook");
			expect(content.statusCode).toBe(201);
			expect(content.headers["X-Custom"]).toBe("test");
		});
	});

	describe("Phase 4: Branching", () => {
		it("should convert If node with conditions", () => {
			const result = convertN8NToGiselle(fixture.branching());
			const ifNode = result.nodes.find((n) => (n.content as { type: string }).type === "if");
			expect(ifNode).toBeDefined();
			expect(ifNode!.outputs).toHaveLength(2);
			expect(ifNode!.outputs[0].accessor).toBe("true");
			expect(ifNode!.outputs[1].accessor).toBe("false");
		});

		it("should convert Switch node with rules", () => {
			const result = convertN8NToGiselle(fixture.complexSwitch());
			const switchNode = result.nodes.find((n) => (n.content as { type: string }).type === "switch");
			expect(switchNode).toBeDefined();
			// 4 rules + 1 fallback
			expect(switchNode!.outputs.length).toBe(5);
		});
	});

	describe("Phase 6: Cycle Conversion", () => {
		it("should handle cycles in polling loop pattern", () => {
			const result = convertN8NToGiselle(fixture.pollingLoop());
			// The back-edge should be either converted to a Loop or stripped
			const cycleWarnings = result.warnings.filter(
				(w) => w.nodeType === "cycle" || w.nodeType === "connection",
			);
			expect(cycleWarnings.length).toBeGreaterThan(0);
		});

		it("should not crash on cycle workflows", () => {
			expect(() => convertN8NToGiselle(fixture.pollingLoop())).not.toThrow();
		});

		it("should track cycles in importMeta", () => {
			const result = convertN8NToGiselle(fixture.pollingLoop());
			expect(result.importMeta).toBeDefined();
			// cyclesConverted can be 0 (stripped) or 1 (converted)
			expect(result.importMeta!.cyclesConverted).toBeGreaterThanOrEqual(0);
		});
	});

	describe("Phase 7: Import Meta", () => {
		it("should include importMeta in all conversions", () => {
			const result = convertN8NToGiselle(fixture.simpleLinear());
			expect(result.importMeta).toBeDefined();
			expect(result.importMeta?.source).toBe("n8n");
		});

		it("should count credentials and cycles", () => {
			const result = convertN8NToGiselle(fixture.credentials());
			expect(result.importMeta?.nodesNeedingCredentials).toBe(2);
			expect(result.importMeta?.cyclesConverted).toBe(0);
		});
	});
});
