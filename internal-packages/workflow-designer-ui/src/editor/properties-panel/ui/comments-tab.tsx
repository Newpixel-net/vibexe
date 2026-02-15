"use client";

import {
	CheckCircleIcon,
	CircleIcon,
	LoaderIcon,
	MessageSquareIcon,
	SendIcon,
	TrashIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppDesignerStore } from "../../../app-designer";

interface Comment {
	dbId: number;
	nodeId: string;
	content: string;
	resolved: boolean;
	createdAt: string;
	updatedAt: string;
	authorName: string | null;
	authorAvatar: string | null;
}

export function CommentsTab({ nodeId }: { nodeId: string }) {
	const workspaceId = useAppDesignerStore((s) => s.workspaceId ?? "");
	const [comments, setComments] = useState<Comment[]>([]);
	const [loading, setLoading] = useState(true);
	const [newComment, setNewComment] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const fetchComments = useCallback(async (signal?: AbortSignal) => {
		if (!workspaceId) return;
		try {
			const res = await fetch(`/api/agents/by-workspace/comments?workspaceId=${workspaceId}`, { signal });
			if (res.ok) {
				const data = await res.json();
				const nodeComments = data.comments?.[nodeId] ?? [];
				if (!signal?.aborted) setComments(nodeComments);
			}
		} catch (err) {
			if (signal?.aborted) return;
			console.error("Failed to fetch comments:", err);
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, [workspaceId, nodeId]);

	useEffect(() => {
		const controller = new AbortController();
		fetchComments(controller.signal);
		return () => controller.abort();
	}, [fetchComments]);

	const handleSubmit = async () => {
		if (!newComment.trim() || !workspaceId) return;
		setSubmitting(true);
		try {
			const res = await fetch(`/api/agents/by-workspace/comments?workspaceId=${workspaceId}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ nodeId, content: newComment.trim() }),
			});
			if (res.ok) {
				setNewComment("");
				await fetchComments();
			}
		} catch (err) {
			console.error("Failed to add comment:", err);
		} finally {
			setSubmitting(false);
		}
	};

	const handleResolve = async (commentDbId: number, resolved: boolean) => {
		if (!workspaceId) return;
		try {
			await fetch(`/api/agents/by-workspace/comments/${commentDbId}?workspaceId=${workspaceId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ resolved }),
			});
			await fetchComments();
		} catch (err) {
			console.error("Failed to update comment:", err);
		}
	};

	const handleDelete = async (commentDbId: number) => {
		if (!workspaceId) return;
		try {
			await fetch(`/api/agents/by-workspace/comments/${commentDbId}?workspaceId=${workspaceId}`, {
				method: "DELETE",
			});
			await fetchComments();
		} catch (err) {
			console.error("Failed to delete comment:", err);
		}
	};

	const formatDate = (dateStr: string) => {
		const d = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return "Just now";
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d ago`;
		return d.toLocaleDateString();
	};

	return (
		<div className="flex flex-col h-full">
			{/* Comment list */}
			<div className="flex-1 overflow-y-auto px-3 py-2">
				{loading ? (
					<div className="flex items-center justify-center py-8">
						<LoaderIcon className="size-4 text-inverse/30 animate-spin" />
					</div>
				) : comments.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<MessageSquareIcon className="size-6 text-inverse/20 mb-2" />
						<p className="text-xs text-inverse/30">No comments yet.</p>
						<p className="text-[10px] text-inverse/20 mt-0.5">
							Add a comment to discuss this node.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{comments.map((comment) => (
							<div
								key={comment.dbId}
								className={`rounded-lg border px-3 py-2 transition-colors ${
									comment.resolved
										? "border-inverse/5 bg-inverse/[0.02] opacity-60"
										: "border-inverse/10 bg-inverse/[0.03]"
								}`}
							>
								<div className="flex items-start justify-between gap-2">
									<div className="flex items-center gap-1.5 min-w-0">
										<span className="text-[11px] font-medium text-inverse/60 truncate">
											{comment.authorName || "Anonymous"}
										</span>
										<span className="text-[9px] text-inverse/20 shrink-0">
											{formatDate(comment.createdAt)}
										</span>
									</div>
									<div className="flex items-center gap-1 shrink-0">
										<button
											type="button"
											onClick={() =>
												handleResolve(comment.dbId, !comment.resolved)
											}
											className="p-0.5 rounded hover:bg-inverse/10 transition-colors"
											title={
												comment.resolved
													? "Mark as unresolved"
													: "Mark as resolved"
											}
										>
											{comment.resolved ? (
												<CheckCircleIcon className="size-3.5 text-green-400" />
											) : (
												<CircleIcon className="size-3.5 text-inverse/20" />
											)}
										</button>
										<button
											type="button"
											onClick={() => handleDelete(comment.dbId)}
											className="p-0.5 rounded hover:bg-inverse/10 transition-colors"
											title="Delete comment"
										>
											<TrashIcon className="size-3 text-inverse/20 hover:text-red-400" />
										</button>
									</div>
								</div>
								<p className="text-xs text-inverse/70 mt-1 whitespace-pre-wrap break-words">
									{comment.content}
								</p>
							</div>
						))}
					</div>
				)}
			</div>

			{/* New comment input */}
			<div className="border-t border-inverse/10 px-3 py-2">
				<div className="flex gap-2">
					<textarea
						ref={textareaRef}
						value={newComment}
						onChange={(e) => setNewComment(e.target.value)}
						placeholder="Add a comment..."
						className="flex-1 bg-inverse/5 border border-inverse/10 rounded-lg px-3 py-2 text-xs text-inverse outline-none placeholder:text-inverse/25 focus:border-primary/40 resize-none min-h-[36px] max-h-[100px]"
						rows={1}
						onKeyDown={(e) => {
							if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								handleSubmit();
							}
						}}
						onInput={(e) => {
							const target = e.target as HTMLTextAreaElement;
							target.style.height = "auto";
							target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
						}}
					/>
					<button
						type="button"
						onClick={handleSubmit}
						disabled={!newComment.trim() || submitting}
						className="self-end p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
						title="Send (Ctrl+Enter)"
					>
						{submitting ? (
							<LoaderIcon className="size-3.5 animate-spin" />
						) : (
							<SendIcon className="size-3.5" />
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
