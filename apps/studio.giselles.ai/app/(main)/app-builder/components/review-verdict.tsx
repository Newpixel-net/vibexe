"use client";

/**
 * ReviewVerdict Component
 *
 * Rendered when code-reviewer or security-reviewer completes.
 * Shows pass/warning/block verdict with issues list.
 */

import { motion } from "framer-motion";
import { AlertTriangle, Check, ShieldCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentEvent } from "../types/vibesdk";

interface ReviewVerdictProps {
	event: AgentEvent;
}

const VERDICT_CONFIG = {
	approve: {
		icon: <Check className="h-4 w-4" />,
		label: "APPROVE",
		bg: "bg-emerald-500/[0.06]",
		border: "border-emerald-500/[0.12]",
		text: "text-emerald-400",
		description: "No critical or high-severity issues",
	},
	warning: {
		icon: <AlertTriangle className="h-4 w-4" />,
		label: "WARNING",
		bg: "bg-amber-500/[0.06]",
		border: "border-amber-500/[0.12]",
		text: "text-amber-400",
		description: "Minor issues found",
	},
	block: {
		icon: <XCircle className="h-4 w-4" />,
		label: "BLOCK",
		bg: "bg-red-500/[0.06]",
		border: "border-red-500/[0.12]",
		text: "text-red-400",
		description: "Critical issues must be resolved",
	},
};

export function ReviewVerdict({ event }: ReviewVerdictProps) {
	const verdict = event.verdict || "approve";
	const config = VERDICT_CONFIG[verdict];
	const isSecurityReview = event.agentId === "security-reviewer";

	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
			className={cn(
				"rounded-2xl border overflow-hidden backdrop-blur-sm",
				config.bg,
				config.border,
			)}
		>
			<div className="px-3 py-2.5">
				<div className="flex items-center gap-2">
					<div className={cn("flex-shrink-0", config.text)}>
						{isSecurityReview ? (
							<ShieldCheck className="h-4 w-4" />
						) : (
							config.icon
						)}
					</div>
					<span className="text-sm font-medium text-foreground">
						{isSecurityReview ? "Security Scan" : "Code Review"}:{" "}
						<span className={config.text}>{config.label}</span>
					</span>
				</div>
				<p className="text-xs text-muted-foreground mt-1 ml-6">
					{event.issues && event.issues.length > 0
						? `${event.issues.length} issue${event.issues.length > 1 ? "s" : ""} found`
						: config.description}
				</p>
				{event.issues && event.issues.length > 0 && (
					<ul className="mt-1.5 ml-6 space-y-0.5">
						{event.issues.map((issue, i) => (
							<li
								key={`issue-${i}`}
								className="text-xs text-muted-foreground flex items-start gap-1"
							>
								<span className="text-yellow-400 flex-shrink-0">-</span>
								{issue}
							</li>
						))}
					</ul>
				)}
			</div>
		</motion.div>
	);
}
