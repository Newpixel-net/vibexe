"use client";

import {
	Bot,
	Boxes,
	Copy,
	Database,
	DatabaseBackup,
	FileText,
	GitBranch,
	Hammer,
	Lightbulb,
	Pencil,
	Plus,
	ShieldCheck,
	Trash2,
	Wand2,
	X,
	Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Tab = "agents" | "skills" | "tools" | "examples";

interface CapabilitiesModalProps {
	onClose: () => void;
	onInsertText?: (text: string) => void;
}

// ── Static Data ──

const AGENTS = [
	{ name: "Planner", description: "Creates implementation blueprints before coding begins", model: "reasoning", skills: ["Blueprint", "Task Breakdown"] },
	{ name: "System Architect", description: "Designs data models, entity schemas, and system structure", model: "reasoning", skills: ["Schema Design", "DB Relations"] },
	{ name: "Frontend Developer", description: "Builds React components, pages, and responsive UI with Tailwind", model: "standard", skills: ["React", "Tailwind", "Responsive"] },
	{ name: "Backend Developer", description: "API routes, server functions, SDK data operations, and auth", model: "standard", skills: ["SDK API", "Auth", "Functions"] },
	{ name: "Fullstack Developer", description: "End-to-end features spanning frontend and backend", model: "standard", skills: ["Full Stack", "Integration"] },
	{ name: "UI/UX Designer", description: "Visual polish, spacing, typography, and micro-interactions", model: "standard", skills: ["Design", "Animation"] },
	{ name: "Code Reviewer", description: "Quality audit, security check, and best practice enforcement", model: "reasoning", skills: ["Lint", "Security", "Patterns"] },
	{ name: "Build Error Resolver", description: "Diagnoses and fixes build, runtime, and type errors", model: "standard", skills: ["Debug", "TypeScript"] },
	{ name: "E2E Test Runner", description: "Generates comprehensive test suites and edge case coverage", model: "standard", skills: ["Testing", "Coverage"] },
	{ name: "TDD Guide", description: "Test-driven development with write-test-first workflow", model: "standard", skills: ["TDD", "Red-Green"] },
	{ name: "Security Auditor", description: "OWASP top 10, XSS, injection, auth bypass detection", model: "reasoning", skills: ["OWASP", "Pen Test"] },
	{ name: "Performance Optimizer", description: "Bundle size, lazy loading, memoization, and render optimization", model: "standard", skills: ["Profiling", "Optimization"] },
	{ name: "Documentation Writer", description: "README, API docs, inline comments, and usage guides", model: "standard", skills: ["Markdown", "API Docs"] },
	{ name: "Accessibility Expert", description: "WCAG compliance, ARIA labels, keyboard nav, screen readers", model: "standard", skills: ["WCAG", "ARIA"] },
	{ name: "Design Replicator", description: "Clones UI from screenshots or URLs with pixel-perfect accuracy", model: "vision", skills: ["Screenshot", "Replication"] },
];

const SKILLS = [
	{ name: "React + Tailwind", category: "Framework", description: "Component architecture with utility-first CSS" },
	{ name: "Next.js Patterns", category: "Framework", description: "App router, server components, API routes" },
	{ name: "SDK Data Operations", category: "Framework", description: "CRUD, relations, filtering, real-time subscriptions" },
	{ name: "Auth & Sessions", category: "Security", description: "Login, signup, protected routes, role-based access" },
	{ name: "Entity Schema Design", category: "Architecture", description: "Data modeling with relations and constraints" },
	{ name: "Test Generation", category: "Testing", description: "Unit tests, integration tests, edge case coverage" },
	{ name: "Error Diagnosis", category: "Workflow", description: "Stack trace analysis and root cause identification" },
	{ name: "Responsive Design", category: "Design", description: "Mobile-first breakpoints and adaptive layouts" },
	{ name: "Animation & Motion", category: "Design", description: "CSS transitions, keyframes, micro-interactions" },
	{ name: "Code Review", category: "Workflow", description: "Quality gates, pattern enforcement, refactoring" },
	{ name: "Performance Tuning", category: "Workflow", description: "Bundle analysis, lazy loading, memoization" },
	{ name: "Accessibility Audit", category: "Design", description: "WCAG checks, keyboard nav, contrast ratios" },
	{ name: "API Documentation", category: "Workflow", description: "Endpoint docs, SDK reference, usage examples" },
];

const TOOLS = [
	{ name: "create_file", description: "Create a new file with specified content", icon: Plus },
	{ name: "update_file", description: "Modify an existing file with new content", icon: Pencil },
	{ name: "delete_file", description: "Remove a file from the project", icon: Trash2 },
	{ name: "read_file", description: "Read current contents of any project file", icon: FileText },
	{ name: "define_entities", description: "Create or update database entity schemas", icon: Database },
	{ name: "manage_environments", description: "Create, promote, diff, or delete staging/production environments", icon: GitBranch },
	{ name: "manage_backups", description: "Create, list, restore, or schedule database backups", icon: DatabaseBackup },
	{ name: "deploy_app", description: "Build and deploy the app to a production subdomain", icon: Zap },
];

const EXAMPLES = [
	{ label: "Build a task manager", text: "Build a task management app with categories, due dates, priority levels, and drag-to-reorder." },
	{ label: "Add user authentication", text: "Add login and signup pages with email/password auth. Protect the dashboard route and show user info in the header." },
	{ label: "Create a REST API", text: "Create REST API endpoints for a blog with posts, comments, and tags. Include pagination and filtering." },
	{ label: "Make it responsive", text: "Make the entire app responsive. Add mobile navigation, adjust grid layouts for tablets, and ensure touch-friendly controls." },
	{ label: "Add dark mode", text: "Add a dark mode toggle. Create a theme system with light and dark color schemes across all components." },
	{ label: "Review for security", text: "Review the current code for security vulnerabilities. Check for XSS, injection, auth bypass, and OWASP top 10 issues." },
	{ label: "Polish the UI", text: "Polish the UI with better spacing, typography, hover states, transitions, loading skeletons, and empty state illustrations." },
	{ label: "Add real-time updates", text: "Add real-time data subscriptions so the UI updates live when data changes, without manual refresh." },
];

const SKILL_CATEGORIES = ["Framework", "Architecture", "Security", "Testing", "Design", "Workflow"] as const;

const TABS: { id: Tab; label: string }[] = [
	{ id: "agents", label: "Agents" },
	{ id: "skills", label: "Skills" },
	{ id: "tools", label: "Tools" },
	{ id: "examples", label: "Examples" },
];

export function CapabilitiesModal({ onClose, onInsertText }: CapabilitiesModalProps) {
	const [activeTab, setActiveTab] = useState<Tab>("agents");

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [onClose]);

	const handleExampleClick = useCallback(
		(text: string) => {
			onInsertText?.(text);
			onClose();
		},
		[onInsertText, onClose],
	);

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
			role="dialog"
			aria-modal="true"
			aria-label="AI Capabilities"
		>
			<div className="bg-[#0f0f1a] border border-white/[0.1] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
					<div className="flex items-center gap-2.5">
						<Wand2 className="h-4.5 w-4.5 text-violet-400" />
						<h3 className="text-base font-medium text-white">AI Capabilities</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="h-8 w-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Tab bar */}
				<div className="flex gap-1 px-5 pt-3 border-b border-white/[0.06]">
					{TABS.map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"px-3 py-2 text-xs font-medium transition-colors relative",
								activeTab === tab.id
									? "text-violet-300"
									: "text-white/40 hover:text-white/60",
							)}
						>
							{tab.label}
							{activeTab === tab.id && (
								<span className="absolute bottom-0 left-0 right-0 h-[2px] bg-violet-500 rounded-full" />
							)}
						</button>
					))}
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-5">
					{activeTab === "agents" && (
						<div className="grid gap-2.5">
							{AGENTS.map((agent) => (
								<div
									key={agent.name}
									className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
								>
									<Bot className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="text-xs font-medium text-white/85">{agent.name}</span>
											<span
												className={cn(
													"text-[10px] px-1.5 py-0.5 rounded-full font-medium",
													agent.model === "reasoning"
														? "bg-amber-500/[0.12] text-amber-300"
														: agent.model === "vision"
															? "bg-cyan-500/[0.12] text-cyan-300"
															: "bg-white/[0.06] text-white/40",
												)}
											>
												{agent.model}
											</span>
										</div>
										<p className="text-[11px] text-white/40 mt-0.5">{agent.description}</p>
										<div className="flex gap-1 mt-1.5 flex-wrap">
											{agent.skills.map((skill) => (
												<span
													key={skill}
													className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/[0.08] text-violet-300/60"
												>
													{skill}
												</span>
											))}
										</div>
									</div>
								</div>
							))}
						</div>
					)}

					{activeTab === "skills" && (
						<div className="space-y-4">
							{SKILL_CATEGORIES.map((category) => {
								const categorySkills = SKILLS.filter((s) => s.category === category);
								if (categorySkills.length === 0) return null;
								return (
									<div key={category}>
										<h4 className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2">
											{category}
										</h4>
										<div className="grid gap-1.5">
											{categorySkills.map((skill) => (
												<div
													key={skill.name}
													className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]"
												>
													<Boxes className="h-3.5 w-3.5 text-white/25 shrink-0" />
													<div className="flex-1 min-w-0">
														<span className="text-xs font-medium text-white/70">{skill.name}</span>
														<span className="text-[11px] text-white/30 ml-2">{skill.description}</span>
													</div>
												</div>
											))}
										</div>
									</div>
								);
							})}
						</div>
					)}

					{activeTab === "tools" && (
						<div className="grid gap-2">
							{TOOLS.map((tool) => {
								const Icon = tool.icon;
								return (
									<div
										key={tool.name}
										className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
									>
										<Icon className="h-4 w-4 text-white/25 shrink-0" />
										<div className="flex-1 min-w-0">
											<span className="text-xs font-mono text-violet-300/70">{tool.name}</span>
											<p className="text-[11px] text-white/35">{tool.description}</p>
										</div>
									</div>
								);
							})}
						</div>
					)}

					{activeTab === "examples" && (
						<div className="grid gap-2">
							{EXAMPLES.map((example) => (
								<button
									key={example.label}
									type="button"
									onClick={() => handleExampleClick(example.text)}
									className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-violet-500/[0.06] hover:border-violet-500/[0.12] transition-colors text-left group"
								>
									<Lightbulb className="h-4 w-4 text-white/25 group-hover:text-violet-400 mt-0.5 shrink-0 transition-colors" />
									<div className="flex-1 min-w-0">
										<span className="text-xs font-medium text-white/70 group-hover:text-white/85 transition-colors">
											{example.label}
										</span>
										<p className="text-[11px] text-white/30 mt-0.5 line-clamp-2">
											{example.text}
										</p>
									</div>
									<Copy className="h-3.5 w-3.5 text-white/15 group-hover:text-white/40 mt-0.5 shrink-0 transition-colors" />
								</button>
							))}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="px-5 py-3 border-t border-white/[0.06] text-center">
					<p className="text-[11px] text-white/25">
						Type <span className="font-mono text-violet-300/40">/</span> in the chat to quickly access commands
					</p>
				</div>
			</div>
		</div>
	);
}
