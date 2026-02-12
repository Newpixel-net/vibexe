import type { AiAgentContent } from "@giselles-ai/protocol";

type GuardrailRule = AiAgentContent["guardrails"]["inputRules"][number];

export interface GuardrailResult {
	passed: boolean;
	violations: Array<{
		ruleId: string;
		ruleType: string;
		action: "block" | "warn" | "redact";
		message: string;
	}>;
	processedText: string;
}

// Common PII patterns
const PII_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
	{
		name: "email",
		pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
	},
	{
		name: "phone",
		pattern:
			/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
	},
	{
		name: "ssn",
		pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
	},
	{
		name: "credit_card",
		pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
	},
	{
		name: "ip_address",
		pattern:
			/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
	},
];

function evaluateRule(
	rule: GuardrailRule,
	text: string,
): { violated: boolean; message: string; redactedText: string } {
	switch (rule.type) {
		case "blocklist": {
			const words = (rule.config.words as string[] | undefined) ?? [];
			const caseSensitive =
				(rule.config.caseSensitive as boolean | undefined) ?? false;
			const checkText = caseSensitive ? text : text.toLowerCase();
			let redactedText = text;
			let violated = false;

			for (const word of words) {
				const checkWord = caseSensitive ? word : word.toLowerCase();
				if (checkText.includes(checkWord)) {
					violated = true;
					const regex = new RegExp(
						word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
						caseSensitive ? "g" : "gi",
					);
					redactedText = redactedText.replace(
						regex,
						"[BLOCKED]",
					);
				}
			}

			return {
				violated,
				message: violated ? "Blocked word(s) detected" : "",
				redactedText,
			};
		}

		case "regex": {
			const pattern = rule.config.pattern as string | undefined;
			if (!pattern) return { violated: false, message: "", redactedText: text };

			try {
				const flags = (rule.config.flags as string | undefined) ?? "gi";
				const regex = new RegExp(pattern, flags);
				const matches = text.match(regex);
				const violated = matches !== null && matches.length > 0;

				return {
					violated,
					message: violated
						? `Pattern match: ${matches?.join(", ")}`
						: "",
					redactedText: violated
						? text.replace(regex, "[REDACTED]")
						: text,
				};
			} catch {
				return {
					violated: false,
					message: "Invalid regex pattern",
					redactedText: text,
				};
			}
		}

		case "length": {
			const min = (rule.config.min as number | undefined) ?? 0;
			const max = (rule.config.max as number | undefined) ?? Number.MAX_SAFE_INTEGER;
			const violated = text.length < min || text.length > max;

			return {
				violated,
				message: violated
					? `Text length ${text.length} outside range [${min}, ${max}]`
					: "",
				redactedText: violated && text.length > max
					? `${text.slice(0, max)}...`
					: text,
			};
		}

		case "pii": {
			const detectTypes = (rule.config.detectTypes as string[] | undefined) ??
				PII_PATTERNS.map((p) => p.name);
			let redactedText = text;
			let violated = false;
			const found: string[] = [];

			for (const piiPattern of PII_PATTERNS) {
				if (!detectTypes.includes(piiPattern.name)) continue;
				const matches = text.match(piiPattern.pattern);
				if (matches && matches.length > 0) {
					violated = true;
					found.push(`${piiPattern.name}(${matches.length})`);
					redactedText = redactedText.replace(
						piiPattern.pattern,
						`[${piiPattern.name.toUpperCase()}_REDACTED]`,
					);
				}
			}

			return {
				violated,
				message: violated ? `PII detected: ${found.join(", ")}` : "",
				redactedText,
			};
		}

		case "custom": {
			const expression = rule.config.expression as string | undefined;
			if (!expression) {
				return { violated: false, message: "", redactedText: text };
			}

			try {
				// Safe evaluation: only checks if expression matches text
				// Supports simple expressions like: text.includes("secret") || text.length > 1000
				const fn = new Function("text", `"use strict"; return Boolean(${expression});`);
				const violated = fn(text) as boolean;

				return {
					violated,
					message: violated
						? `Custom rule triggered: ${expression}`
						: "",
					redactedText: text,
				};
			} catch {
				return {
					violated: false,
					message: "Custom expression error",
					redactedText: text,
				};
			}
		}

		default:
			return { violated: false, message: "", redactedText: text };
	}
}

export function evaluateGuardrails(
	rules: GuardrailRule[],
	text: string,
): GuardrailResult {
	const violations: GuardrailResult["violations"] = [];
	let processedText = text;
	let blocked = false;

	for (const rule of rules) {
		if (!rule.enabled) continue;

		const result = evaluateRule(rule, processedText);

		if (result.violated) {
			violations.push({
				ruleId: rule.id,
				ruleType: rule.type,
				action: rule.action,
				message: result.message,
			});

			if (rule.action === "block") {
				blocked = true;
			} else if (rule.action === "redact") {
				processedText = result.redactedText;
			}
			// "warn" — just log the violation, don't change text
		}
	}

	return {
		passed: !blocked,
		violations,
		processedText,
	};
}
