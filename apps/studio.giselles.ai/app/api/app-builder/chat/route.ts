// giselle-integration/api/app-builder/chat/route.ts
// Chat API endpoint with AI SDK streaming for App Builder
//
// This endpoint handles AI chat interactions for code generation.
// Uses OpenAI via AI SDK v6 with useChat hook compatibility.
//
// Deploy to: /opt/giselle/apps/studio.giselles.ai/app/api/app-builder/chat/route.ts

import { openai } from "@ai-sdk/openai";
import type { UIMessage } from "ai";
import { convertToModelMessages, streamText } from "ai";
import { createFileTools } from "@/app/(main)/app-builder/lib/file-tools";
import {
	getAppById,
	getFilesForApp,
} from "@/app/(main)/app-builder/lib/queries";
import { getUser } from "@/lib/auth/get-user";

// System prompt for app generation mode
const GENERATION_SYSTEM_PROMPT = `You are an expert full-stack developer who builds complete, working React applications.

## CRITICAL WORKFLOW - YOU MUST FOLLOW THIS EXACTLY

When the user describes an app, you MUST call create_file THREE times in sequence:

**Step 1:** Call create_file to create Blueprint.md (2-3 sentences describing the app)
**Step 2:** IMMEDIATELY call create_file to create src/App.tsx with COMPLETE working React code
**Step 3:** IMMEDIATELY call create_file to create README.md with comprehensive project documentation

⚠️ WARNING: If you stop after Blueprint.md or src/App.tsx, you have FAILED the task.
⚠️ WARNING: You MUST create ALL THREE files. Missing any file is a FAILURE.

## File Tools Available
- create_file: Create files with path and content
- update_file: Modify existing files
- delete_file: Remove files

## Required Tool Calls (in order)
1. create_file for Blueprint.md - Brief 2-3 sentence app description
2. create_file for src/App.tsx - COMPLETE React component with ALL code
3. create_file for README.md - Comprehensive project documentation

## Code Requirements for src/App.tsx
- Use React functional components with hooks (useState, useEffect, etc.)
- Include ALL necessary imports at the top (React hooks, etc.)
- Use Tailwind CSS classes for styling (Tailwind is pre-loaded via CDN)
- DO NOT import tailwindcss or any CSS files - Tailwind classes work automatically
- Make sure the code is complete and will render without errors
- Export the component as default
- DO NOT use external packages like @headlessui/react, react-icons, framer-motion, etc.
- For icons, use simple SVG or emoji characters instead
- Only use React hooks and Tailwind CSS - nothing else

## IMPORTANT: Tailwind CSS Usage
Tailwind CSS is already loaded in the preview environment via CDN.
- ✅ DO: Use Tailwind classes directly: className="bg-blue-500 text-white p-4"
- ❌ DON'T: import 'tailwindcss/tailwind.css' or any CSS imports
- ❌ DON'T: Create separate CSS files

## README.md Requirements
The README.md MUST be comprehensive and well-structured. Follow this template:

\`\`\`markdown
# [App Name]

[Brief 1-2 sentence description of the app and its purpose.]

## ✨ Features

- **[Feature 1 Name]**: [Brief description]
- **[Feature 2 Name]**: [Brief description]
- **[Feature 3 Name]**: [Brief description]
- **[Feature 4 Name]**: [Brief description]
(list 4-8 key features based on the app)

## 🛠 Tech Stack

| Category | Technologies |
|----------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| UI/UX | Custom components, Responsive design, Dark mode support |
| State | React Hooks (useState, useEffect, useCallback) |
| Styling | Tailwind CSS utility classes |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or pnpm package manager

### Installation
1. Clone the repository
2. Install dependencies: \\\`npm install\\\`
3. Start development server: \\\`npm run dev\\\`

### Development
- Open http://localhost:5173 in your browser
- Edit src/App.tsx to modify the application
- Changes hot-reload automatically

## 📚 Usage

### [Main Feature Section]
[Describe how to use the primary feature]

### [Secondary Feature Section]
[Describe how to use secondary features]

### Key Files
- \\\`src/App.tsx\\\` - Main application component
- \\\`package.json\\\` - Dependencies and scripts

## 🚀 Deployment

1. Build: \\\`npm run build\\\`
2. Preview: \\\`npm run preview\\\`
3. Deploy the \\\`dist/\\\` folder to any static hosting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License

## 💬 Support

For questions or issues, please open a GitHub issue.
\`\`\`

Adapt the README.md content to match the specific app being built. Make it detailed and useful.

## Example: Counter App
For "Build a counter app", you would call create_file THREE times:

**First call:** Blueprint.md
- path: "Blueprint.md"
- content: "# Counter App\\nA simple counter with increment/decrement buttons."

**Second call:** src/App.tsx
- path: "src/App.tsx"
- content: Complete React component code

**Third call:** README.md
- path: "README.md"
- content: Full documentation following the template above, customized for the counter app

## FINAL REMINDER
Your response is INCOMPLETE unless you have called create_file for ALL THREE:
1. Blueprint.md ✓
2. src/App.tsx ✓ (with complete, working code)
3. README.md ✓ (with comprehensive documentation)

DO NOT STOP until all three files are created.`;

// System prompt for discussion mode (no file tools)
const DISCUSSION_SYSTEM_PROMPT = `You are an expert full-stack developer helping users plan and discuss web applications.

Help the user:
- Understand their requirements
- Plan the architecture and features
- Suggest best practices and technologies
- Answer technical questions
- Review and explain code

You are in discussion mode - you cannot create or modify files directly.
When the user is ready to generate code, they should switch to generation mode.`;

export async function POST(request: Request) {
	try {
		// Auth check using Giselle's session system
		const user = await getUser();
		if (!user) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Parse request body
		const body = await request.json();
		const {
			messages,
			appId,
			chatId,
			mode = "generate",
		} = body as {
			messages: UIMessage[];
			appId: string;
			chatId?: string;
			mode?: "generate" | "discussion";
		};

		// Validate required fields
		if (!appId) {
			return new Response(JSON.stringify({ error: "Missing appId" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (!messages || !Array.isArray(messages) || messages.length === 0) {
			return new Response(JSON.stringify({ error: "Messages are required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Verify app exists (ownership check via team membership)
		const app = await getAppById(appId, user.id);
		if (!app) {
			return new Response(JSON.stringify({ error: "App not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Get existing files for context
		const existingFiles = await getFilesForApp(appId);
		const fileContext =
			existingFiles.length > 0
				? `\n\nExisting files in the project:\n${existingFiles.map((f) => `- ${f.path}`).join("\n")}`
				: "";

		// Select system prompt and tools based on mode
		const systemPrompt =
			mode === "discussion"
				? DISCUSSION_SYSTEM_PROMPT
				: GENERATION_SYSTEM_PROMPT + fileContext;

		const tools = mode === "generate" ? createFileTools(appId) : {};

		// Log in development
		if (process.env.NODE_ENV === "development") {
			console.log(
				`[Chat API] App: ${appId}, Mode: ${mode}, Messages: ${messages.length}, Files: ${existingFiles.length}`,
			);
		}

		// Convert UI messages to model messages (AI SDK v6 requirement)
		const modelMessages = await convertToModelMessages(messages);

		// Debug: Log converted messages
		if (process.env.NODE_ENV === "development") {
			console.log(
				`[Chat API] Converted ${messages.length} messages to ${modelMessages.length} model messages`,
			);
		}

		// Stream response using AI SDK v6
		const result = streamText({
			model: openai("gpt-4o"),
			system: systemPrompt,
			messages: modelMessages,
			tools,
			// Force the model to use tools in generate mode (ensures it creates files)
			// @ts-ignore - maxSteps supported in AI SDK 4.x
			maxSteps: 25,
			toolChoice: mode === "generate" ? "required" : "auto",
		});

		// Return streaming response (toUIMessageStreamResponse for useChat compatibility in AI SDK v6)
		// CRITICAL: originalMessages must be passed for proper message continuity
		return result.toUIMessageStreamResponse({
			originalMessages: messages,
			onFinish: ({ messages: finalMessages }) => {
				if (process.env.NODE_ENV === "development") {
					console.log(
						`[Chat API] Stream finished - Chat ID: ${chatId || "new"}, Messages: ${finalMessages.length}`,
					);
				}
			},
		});
	} catch (error) {
		console.error("[Chat API] Error:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
