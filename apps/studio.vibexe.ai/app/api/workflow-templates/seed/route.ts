import type { NextRequest } from "next/server";
import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { getUser } from "@/lib/auth/get-user";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const SEED_TEMPLATES = [
	// AI & ML
	{
		name: "AI Research Assistant",
		description: "Accepts a research topic, searches for relevant information, summarizes findings, and generates a structured research report with citations.",
		category: "ai",
		tags: ["research", "summarization", "report"],
	},
	{
		name: "Multi-Model Comparison",
		description: "Sends the same prompt to multiple LLMs (GPT, Claude, Grok) and compares their responses side by side with a quality assessment.",
		category: "ai",
		tags: ["comparison", "multi-llm", "evaluation"],
	},
	{
		name: "Content Classifier",
		description: "Classifies incoming text into categories (support, sales, feedback, spam) using AI and routes to the appropriate handler.",
		category: "ai",
		tags: ["classification", "routing", "nlp"],
	},
	{
		name: "Sentiment Analysis Pipeline",
		description: "Analyzes customer feedback or reviews for sentiment, extracts key themes, and generates an actionable insights summary.",
		category: "ai",
		tags: ["sentiment", "analysis", "insights"],
	},
	{
		name: "RAG Document Q&A",
		description: "Upload documents, create embeddings, and answer questions about the content using retrieval-augmented generation.",
		category: "ai",
		tags: ["rag", "embeddings", "qa"],
	},

	// Marketing
	{
		name: "Social Media Content Creator",
		description: "Takes a topic or product, generates platform-specific posts for Twitter, LinkedIn, and Instagram with appropriate tone and hashtags.",
		category: "marketing",
		tags: ["social-media", "content", "multi-platform"],
	},
	{
		name: "Email Campaign Generator",
		description: "Creates a complete email marketing sequence (welcome, nurture, conversion) from a product description and target audience.",
		category: "marketing",
		tags: ["email", "campaign", "copywriting"],
	},
	{
		name: "SEO Content Optimizer",
		description: "Analyzes existing content, suggests keyword improvements, generates meta descriptions, and creates optimized versions.",
		category: "marketing",
		tags: ["seo", "optimization", "keywords"],
	},
	{
		name: "Blog Post Generator",
		description: "Generates a complete blog post from a topic: outlines the structure, writes each section, adds a compelling intro and conclusion.",
		category: "marketing",
		tags: ["blog", "content", "writing"],
	},

	// Sales & CRM
	{
		name: "Lead Qualifier",
		description: "Analyzes incoming lead information, scores them based on ICP fit, and generates personalized outreach messages for qualified leads.",
		category: "sales",
		tags: ["leads", "qualification", "outreach"],
	},
	{
		name: "Proposal Generator",
		description: "Takes client requirements and company info, generates a professional business proposal with scope, timeline, and pricing.",
		category: "sales",
		tags: ["proposal", "business", "automation"],
	},
	{
		name: "Meeting Notes to CRM",
		description: "Processes meeting transcripts, extracts action items and key decisions, then formats them as CRM entries with follow-up tasks.",
		category: "sales",
		tags: ["meetings", "crm", "transcription"],
	},

	// Customer Support
	{
		name: "Customer Support Triage",
		description: "Receives customer messages, classifies urgency and category, generates initial response drafts, and escalates critical issues.",
		category: "support",
		tags: ["triage", "classification", "auto-reply"],
	},
	{
		name: "FAQ Auto-Responder",
		description: "Matches customer questions against a knowledge base, generates accurate answers, and flags unanswerable questions for human review.",
		category: "support",
		tags: ["faq", "knowledge-base", "auto-reply"],
	},
	{
		name: "Ticket Summarizer",
		description: "Takes a support ticket thread, summarizes the issue, attempted solutions, and current status for quick agent handoff.",
		category: "support",
		tags: ["tickets", "summarization", "handoff"],
	},

	// DevOps
	{
		name: "Incident Response Workflow",
		description: "Monitors alerts, classifies severity, gathers diagnostic info, suggests remediation steps, and drafts incident reports.",
		category: "devops",
		tags: ["incident", "monitoring", "response"],
	},
	{
		name: "Code Review Assistant",
		description: "Receives code diffs, analyzes for bugs, security issues, and style violations, then provides structured review feedback.",
		category: "devops",
		tags: ["code-review", "security", "quality"],
	},
	{
		name: "Log Analyzer",
		description: "Parses application logs, identifies error patterns, correlates events, and generates root cause analysis reports.",
		category: "devops",
		tags: ["logs", "analysis", "debugging"],
	},

	// Data
	{
		name: "CSV Data Transformer",
		description: "Reads CSV data, applies transformations (filtering, aggregation, enrichment), and outputs clean, formatted results.",
		category: "data",
		tags: ["csv", "etl", "transformation"],
	},
	{
		name: "Data Quality Checker",
		description: "Validates dataset completeness, checks for anomalies, identifies duplicates, and generates a data quality report.",
		category: "data",
		tags: ["validation", "quality", "anomalies"],
	},
	{
		name: "Report Generator",
		description: "Takes raw data and KPIs, generates narrative summaries, highlights trends, and creates executive-ready reports.",
		category: "data",
		tags: ["reporting", "analytics", "executive"],
	},

	// Content
	{
		name: "Multi-Language Translator",
		description: "Translates content between languages with quality review: first translates, then a reviewer agent checks accuracy and naturalness.",
		category: "content",
		tags: ["translation", "multilingual", "review"],
	},
	{
		name: "Technical Documentation Writer",
		description: "Takes API specs or code, generates user-friendly documentation with examples, usage guides, and troubleshooting sections.",
		category: "content",
		tags: ["docs", "technical", "api"],
	},
	{
		name: "Resume/CV Analyzer",
		description: "Parses resumes, extracts key qualifications, matches against job requirements, and generates interview preparation tips.",
		category: "content",
		tags: ["resume", "hr", "analysis"],
	},
	{
		name: "Product Description Writer",
		description: "Creates compelling product descriptions from feature lists, targeting specific audiences with appropriate tone and benefits.",
		category: "content",
		tags: ["product", "copywriting", "ecommerce"],
	},

	// Integration
	{
		name: "Slack Notification Pipeline",
		description: "Monitors events from various sources, formats notifications with context, and sends them to appropriate Slack channels.",
		category: "integration",
		tags: ["slack", "notifications", "monitoring"],
	},
	{
		name: "GitHub PR Reviewer",
		description: "Watches for new PRs, analyzes code changes, posts AI-generated review comments, and flags security concerns.",
		category: "integration",
		tags: ["github", "code-review", "automation"],
	},
	{
		name: "Webhook Processor",
		description: "Receives webhooks from external services, validates payloads, transforms data, and routes to appropriate handlers.",
		category: "integration",
		tags: ["webhooks", "api", "routing"],
	},

	// Code
	{
		name: "Code Explainer",
		description: "Takes complex code snippets, explains them step by step, identifies patterns used, and suggests improvements.",
		category: "code",
		tags: ["explanation", "education", "refactoring"],
	},
	{
		name: "Test Case Generator",
		description: "Analyzes function signatures and logic, generates comprehensive test cases including edge cases and error scenarios.",
		category: "code",
		tags: ["testing", "tdd", "quality"],
	},
	{
		name: "API Endpoint Builder",
		description: "Designs RESTful API endpoints from requirements: generates route handlers, validation schemas, and documentation.",
		category: "code",
		tags: ["api", "rest", "backend"],
	},

	// Web
	{
		name: "Web Scraping Pipeline",
		description: "Fetches web pages, extracts structured data using AI parsing, cleans and formats the output for downstream use.",
		category: "web",
		tags: ["scraping", "extraction", "parsing"],
	},
	{
		name: "Competitor Monitor",
		description: "Tracks competitor websites for changes, analyzes pricing updates, and generates competitive intelligence reports.",
		category: "web",
		tags: ["competitive", "monitoring", "analysis"],
	},
];

/**
 * POST /api/workflow-templates/seed
 *
 * Seeds the workflow_templates table with curated templates.
 * Only works if the table is empty (prevents duplicates).
 * Requires admin user.
 */
export async function POST(_request: NextRequest) {
	try {
		const user = await getUser();

		// Check if templates already exist
		const existing = await db
			.select({ dbId: workflowTemplates.dbId })
			.from(workflowTemplates)
			.limit(1);

		if (existing.length > 0) {
			return Response.json({
				message: "Templates already seeded",
				count: 0,
			});
		}

		// Insert all seed templates
		const inserted = await db
			.insert(workflowTemplates)
			.values(
				SEED_TEMPLATES.map((t) => ({
					name: t.name,
					description: t.description,
					category: t.category,
					tags: t.tags,
					snapshot: { type: "ai-prompt", prompt: `${t.name}: ${t.description}` },
					isPublic: true,
					authorDbId: user.dbId,
				})),
			)
			.returning({ dbId: workflowTemplates.dbId });

		return Response.json({
			message: "Templates seeded successfully",
			count: inserted.length,
		});
	} catch (err) {
		console.error("[WorkflowTemplates] Error seeding:", err);
		return Response.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
