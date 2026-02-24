/**
 * Pre-built AI Chain Templates for common AI tasks.
 * Each template configures an AI Agent node with a system prompt
 * and optional structured output schema.
 *
 * NOTE: This file lives in the UI package (not @vibexe-ai/vibexe)
 * because importing from vibexe in client components would pull in
 * the entire server-side bundle (MCP SDK, pg-format, etc.).
 */

export interface ChainTemplate {
	id: string;
	name: string;
	description: string;
	category: "extraction" | "analysis" | "transformation";
	systemPrompt: string;
	structuredOutput: {
		enabled: boolean;
		schema: string;
	};
}

export const chainTemplates: ChainTemplate[] = [
	{
		id: "information-extractor",
		name: "Information Extractor",
		description:
			"Extract structured data from unstructured text (names, emails, dates, addresses, etc.)",
		category: "extraction",
		systemPrompt: `You are a precise information extraction assistant. Your task is to extract structured data from the user's text input.

Instructions:
1. Read the provided text carefully
2. Identify and extract all relevant entities and data points
3. Return the extracted information as a JSON object
4. If a field cannot be found in the text, set it to null
5. Be precise — only extract what is explicitly stated, do not infer

Extract the following fields:
- names: Array of person names found
- emails: Array of email addresses found
- phones: Array of phone numbers found
- dates: Array of dates found (in ISO 8601 format)
- addresses: Array of physical addresses found
- organizations: Array of company/organization names found
- amounts: Array of monetary amounts found (with currency)
- urls: Array of URLs found

Return ONLY valid JSON matching the schema provided.`,
		structuredOutput: {
			enabled: true,
			schema: JSON.stringify(
				{
					type: "object",
					properties: {
						names: {
							type: "array",
							items: { type: "string" },
						},
						emails: {
							type: "array",
							items: { type: "string" },
						},
						phones: {
							type: "array",
							items: { type: "string" },
						},
						dates: {
							type: "array",
							items: { type: "string" },
						},
						addresses: {
							type: "array",
							items: { type: "string" },
						},
						organizations: {
							type: "array",
							items: { type: "string" },
						},
						amounts: {
							type: "array",
							items: {
								type: "object",
								properties: {
									value: { type: "number" },
									currency: { type: "string" },
								},
							},
						},
						urls: {
							type: "array",
							items: { type: "string" },
						},
					},
				},
				null,
				2,
			),
		},
	},
	{
		id: "sentiment-analysis",
		name: "Sentiment Analysis",
		description:
			"Classify text sentiment as positive, negative, or neutral with confidence score",
		category: "analysis",
		systemPrompt: `You are a sentiment analysis assistant. Analyze the sentiment of the provided text.

Instructions:
1. Read the text carefully
2. Determine the overall sentiment: positive, negative, or neutral
3. Assign a confidence score between 0 and 1
4. Identify key phrases that support your sentiment classification
5. Provide a brief explanation of your analysis

Return ONLY valid JSON matching the schema provided.`,
		structuredOutput: {
			enabled: true,
			schema: JSON.stringify(
				{
					type: "object",
					properties: {
						sentiment: {
							type: "string",
							enum: ["positive", "negative", "neutral"],
						},
						confidence: {
							type: "number",
							minimum: 0,
							maximum: 1,
						},
						keyPhrases: {
							type: "array",
							items: {
								type: "object",
								properties: {
									phrase: { type: "string" },
									sentiment: {
										type: "string",
										enum: ["positive", "negative", "neutral"],
									},
								},
							},
						},
						explanation: { type: "string" },
					},
					required: [
						"sentiment",
						"confidence",
						"keyPhrases",
						"explanation",
					],
				},
				null,
				2,
			),
		},
	},
	{
		id: "summarization",
		name: "Summarization",
		description:
			"Summarize text into a concise version with key points and configurable length",
		category: "transformation",
		systemPrompt: `You are a summarization assistant. Create a clear, concise summary of the provided text.

Instructions:
1. Read the full text carefully
2. Identify the main topic and key points
3. Create a summary that captures the essential information
4. Extract 3-7 key takeaways as bullet points
5. Keep the summary concise but comprehensive

Return ONLY valid JSON matching the schema provided.`,
		structuredOutput: {
			enabled: true,
			schema: JSON.stringify(
				{
					type: "object",
					properties: {
						summary: { type: "string" },
						keyPoints: {
							type: "array",
							items: { type: "string" },
						},
						wordCount: { type: "number" },
						mainTopic: { type: "string" },
					},
					required: ["summary", "keyPoints", "mainTopic"],
				},
				null,
				2,
			),
		},
	},
	{
		id: "text-classifier",
		name: "Text Classifier",
		description:
			"Classify text into user-defined categories with confidence scores",
		category: "analysis",
		systemPrompt: `You are a text classification assistant. Classify the provided text into the most appropriate categories.

Instructions:
1. Read the text carefully
2. Determine which categories best describe the text
3. Assign a confidence score (0-1) for each matching category
4. The primary category should have the highest confidence
5. If no predefined categories fit, suggest appropriate ones

Common categories (adapt based on context):
- Business, Technology, Health, Sports, Entertainment, Science, Politics, Education, Finance, Travel, Food, Fashion, Art, Music, Legal

Return ONLY valid JSON matching the schema provided.`,
		structuredOutput: {
			enabled: true,
			schema: JSON.stringify(
				{
					type: "object",
					properties: {
						primaryCategory: { type: "string" },
						categories: {
							type: "array",
							items: {
								type: "object",
								properties: {
									name: { type: "string" },
									confidence: {
										type: "number",
										minimum: 0,
										maximum: 1,
									},
								},
							},
						},
						reasoning: { type: "string" },
					},
					required: ["primaryCategory", "categories", "reasoning"],
				},
				null,
				2,
			),
		},
	},
	{
		id: "ai-transform",
		name: "AI Transform",
		description:
			"Transform data format or structure using natural language instructions",
		category: "transformation",
		systemPrompt: `You are a data transformation assistant. Transform the provided data according to the user's instructions.

Instructions:
1. Parse the input data (may be JSON, CSV, text, or any format)
2. Apply the transformation described by the user
3. Return the transformed data in the requested format
4. Preserve data accuracy — do not alter values unless instructed
5. If the transformation is ambiguous, choose the most common interpretation

The user will provide:
- Input data to transform
- Transformation instructions (e.g., "convert to CSV", "flatten nested objects", "rename fields")

Return the transformed data. If structured output schema is provided, match that schema.`,
		structuredOutput: {
			enabled: false,
			schema: "",
		},
	},
];
