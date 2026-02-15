import { describe, it, expect } from "vitest";
import { mapN8NNodeType, N8N_CREDENTIAL_TO_PIECE } from "./node-mapping";

describe("mapN8NNodeType", () => {
	describe("Triggers", () => {
		it("should map manual trigger", () => {
			const result = mapN8NNodeType("n8n-nodes-base.manualTrigger");
			expect(result).toEqual({ type: "trigger", subtype: "manual" });
		});

		it("should map schedule trigger", () => {
			const result = mapN8NNodeType("n8n-nodes-base.scheduleTrigger");
			expect(result).toEqual({ type: "nativeTrigger", provider: "schedule" });
		});

		it("should map webhook trigger", () => {
			const result = mapN8NNodeType("n8n-nodes-base.webhook");
			expect(result).toEqual({ type: "nativeTrigger", provider: "webhook" });
		});
	});

	describe("Flow Control", () => {
		it("should map if node", () => {
			const result = mapN8NNodeType("n8n-nodes-base.if");
			expect(result).toEqual({ type: "nativeIf" });
		});

		it("should map switch node", () => {
			const result = mapN8NNodeType("n8n-nodes-base.switch");
			expect(result).toEqual({ type: "nativeSwitch" });
		});

		it("should map merge node", () => {
			const result = mapN8NNodeType("n8n-nodes-base.merge");
			expect(result).toEqual({ type: "nativeMerge" });
		});

		it("should map splitInBatches to loop", () => {
			const result = mapN8NNodeType("n8n-nodes-base.splitInBatches");
			expect(result).toEqual({ type: "nativeLoop" });
		});

		it("should map wait node", () => {
			const result = mapN8NNodeType("n8n-nodes-base.wait");
			expect(result).toEqual({ type: "nativeWait" });
		});
	});

	describe("Data Transform", () => {
		it("should map code node", () => {
			const result = mapN8NNodeType("n8n-nodes-base.code");
			expect(result).toEqual({ type: "nativeCode" });
		});

		it("should map function node to code", () => {
			const result = mapN8NNodeType("n8n-nodes-base.function");
			expect(result).toEqual({ type: "nativeCode" });
		});

		it("should map set node to editFields", () => {
			const result = mapN8NNodeType("n8n-nodes-base.set");
			expect(result).toEqual({ type: "nativeEditFields" });
		});

		it("should map filter node", () => {
			const result = mapN8NNodeType("n8n-nodes-base.filter");
			expect(result).toEqual({ type: "nativeFilter" });
		});

		it("should map sort node", () => {
			const result = mapN8NNodeType("n8n-nodes-base.sort");
			expect(result).toEqual({ type: "nativeSort" });
		});
	});

	describe("New Node Types (Phase 1)", () => {
		it("should map aggregate", () => {
			const result = mapN8NNodeType("n8n-nodes-base.aggregate");
			expect(result).toEqual({ type: "nativeAggregate" });
		});

		it("should map limit", () => {
			const result = mapN8NNodeType("n8n-nodes-base.limit");
			expect(result).toEqual({ type: "nativeLimit" });
		});

		it("should map removeDuplicates", () => {
			const result = mapN8NNodeType("n8n-nodes-base.removeDuplicates");
			expect(result).toEqual({ type: "nativeRemoveDuplicates" });
		});

		it("should map renameKeys", () => {
			const result = mapN8NNodeType("n8n-nodes-base.renameKeys");
			expect(result).toEqual({ type: "nativeRenameKeys" });
		});

		it("should map splitOut", () => {
			const result = mapN8NNodeType("n8n-nodes-base.splitOut");
			expect(result).toEqual({ type: "nativeSplitOut" });
		});

		it("should map compareDatasets", () => {
			const result = mapN8NNodeType("n8n-nodes-base.compareDatasets");
			expect(result).toEqual({ type: "nativeCompareDatasets" });
		});

		it("should map summarize", () => {
			const result = mapN8NNodeType("n8n-nodes-base.summarize");
			expect(result).toEqual({ type: "nativeSummarize" });
		});

		it("should map respondToWebhook to native type", () => {
			const result = mapN8NNodeType("n8n-nodes-base.respondToWebhook");
			expect(result).toEqual({ type: "nativeRespondToWebhook" });
		});
	});

	describe("Integration Nodes", () => {
		it("should map http request", () => {
			const result = mapN8NNodeType("n8n-nodes-base.httpRequest");
			expect(result).toEqual({
				type: "integration",
				pieceName: "http",
				actionName: "send_request",
			});
		});

		it("should map slack via N8N_TO_PIECE_NAME", () => {
			const result = mapN8NNodeType("n8n-nodes-base.slack");
			expect(result.type).toBe("integration");
			if (result.type === "integration") {
				expect(result.pieceName).toBe("slack");
			}
		});

		it("should map unknown base node to integration with fallback", () => {
			const result = mapN8NNodeType("n8n-nodes-base.unknownService");
			expect(result.type).toBe("integration");
			if (result.type === "integration") {
				expect(result.pieceName).toBe("unknownservice");
			}
		});
	});

	describe("LLM Nodes", () => {
		it("should map OpenAI LLM", () => {
			const result = mapN8NNodeType("@n8n/n8n-nodes-langchain.lmOpenAi");
			expect(result.type).toBe("textGeneration");
		});

		it("should map Anthropic LLM", () => {
			const result = mapN8NNodeType(
				"@n8n/n8n-nodes-langchain.lmChatAnthropic",
			);
			expect(result.type).toBe("textGeneration");
		});
	});

	describe("Skip/End", () => {
		it("should skip noop", () => {
			const result = mapN8NNodeType("n8n-nodes-base.noOp");
			expect(result.type).toBe("skip");
		});

		it("should map sticky note to text", () => {
			const result = mapN8NNodeType("n8n-nodes-base.stickyNote");
			expect(result.type).toBe("text");
		});
	});

	describe("Case Insensitivity", () => {
		it("should handle mixed case types", () => {
			const result = mapN8NNodeType("n8n-nodes-base.IF");
			expect(result).toEqual({ type: "nativeIf" });
		});
	});
});

describe("N8N_CREDENTIAL_TO_PIECE", () => {
	it("should map common credentials", () => {
		expect(N8N_CREDENTIAL_TO_PIECE.slackOAuth2Api).toBe("slack");
		expect(N8N_CREDENTIAL_TO_PIECE.gmailOAuth2).toBe("gmail");
		expect(N8N_CREDENTIAL_TO_PIECE.notionApi).toBe("notion");
		expect(N8N_CREDENTIAL_TO_PIECE.googleSheetsOAuth2Api).toBe("google-sheets");
		expect(N8N_CREDENTIAL_TO_PIECE.airtableApi).toBe("airtable");
		expect(N8N_CREDENTIAL_TO_PIECE.hubspotOAuth2Api).toBe("hubspot");
		expect(N8N_CREDENTIAL_TO_PIECE.discordOAuth2Api).toBe("discord");
	});

	it("should have entries for major services", () => {
		const keys = Object.keys(N8N_CREDENTIAL_TO_PIECE);
		expect(keys.length).toBeGreaterThanOrEqual(20);
	});
});
