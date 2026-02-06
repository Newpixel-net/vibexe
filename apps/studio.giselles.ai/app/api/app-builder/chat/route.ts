// giselle-integration/api/app-builder/chat/route.ts
// Chat API endpoint with AI SDK streaming for App Builder
//
// This endpoint handles AI chat interactions for code generation.
// Uses OpenAI via AI SDK v6 with useChat hook compatibility.
//
// Deploy to: /opt/giselle/apps/studio.giselles.ai/app/api/app-builder/chat/route.ts

import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { getUser } from "@/lib/supabase/get-user";
import { createFileTools } from "@/app/(main)/app-builder/lib/file-tools";
import { getFilesForApp, getAppById } from "@/app/(main)/app-builder/lib/queries";

// System prompt for app generation mode
const GENERATION_SYSTEM_PROMPT = `You are an expert full-stack developer who builds complete, working React applications.

## CRITICAL WORKFLOW - YOU MUST FOLLOW THIS EXACTLY

When the user describes an app, you MUST call create_file TWICE in sequence:

**Step 1:** Call create_file to create Blueprint.md (2-3 sentences describing the app)
**Step 2:** IMMEDIATELY call create_file again to create src/App.tsx with COMPLETE working React code

⚠️ WARNING: If you only create Blueprint.md and stop, you have FAILED the task.
⚠️ WARNING: A text response without calling create_file for src/App.tsx is a FAILURE.
⚠️ WARNING: You MUST call the create_file tool for src/App.tsx - do not just describe the code.

## File Tools Available
- create_file: Create files with path and content
- update_file: Modify existing files
- delete_file: Remove files

## Required Tool Calls (in order)
1. create_file for Blueprint.md - Brief app description
2. create_file for src/App.tsx - COMPLETE React component with ALL code

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

## Example: Counter App
For "Build a counter app", you would call create_file TWICE:

**First create_file call:**
- path: "Blueprint.md"
- content: "# Counter App\\nA simple counter with increment/decrement buttons."

**Second create_file call (REQUIRED):**
- path: "src/App.tsx"
- content: The complete React component code

Example src/App.tsx content:
\`\`\`tsx
import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-4xl font-bold mb-8">Counter: {count}</h1>
      <div className="flex gap-4">
        <button
          onClick={() => setCount(c => c - 1)}
          className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Decrement
        </button>
        <button
          onClick={() => setCount(c => c + 1)}
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          Increment
        </button>
      </div>
    </div>
  );
}
\`\`\`

## FINAL REMINDER
Your response is INCOMPLETE unless you have called create_file for BOTH:
1. Blueprint.md ✓
2. src/App.tsx ✓ (with complete, working code)

DO NOT STOP after creating Blueprint.md. ALWAYS continue to create src/App.tsx.`;

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
        `[Chat API] App: ${appId}, Mode: ${mode}, Messages: ${messages.length}, Files: ${existingFiles.length}`
      );
    }

    // Convert UI messages to model messages (AI SDK v6 requirement)
    const modelMessages = await convertToModelMessages(messages);

    // Debug: Log converted messages
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[Chat API] Converted ${messages.length} messages to ${modelMessages.length} model messages`
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
      onFinish: async ({ messages: finalMessages, responseMessage }) => {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `[Chat API] Stream finished - Chat ID: ${chatId || "new"}, Messages: ${finalMessages.length}`
          );
        }
      },
    });
  } catch (error) {
    console.error("[Chat API] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
