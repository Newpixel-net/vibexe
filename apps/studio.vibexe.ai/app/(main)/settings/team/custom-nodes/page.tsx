"use client";

import { useCallback, useEffect, useState } from "react";

interface CustomNodeRecord {
	dbId: number;
	name: string;
	displayName: string;
	description: string | null;
	icon: string;
	category: string;
	version: string;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
	authorName: string | null;
}

export default function CustomNodesPage() {
	const [nodes, setNodes] = useState<CustomNodeRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [showUpload, setShowUpload] = useState(false);
	const [jsonInput, setJsonInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const fetchNodes = useCallback(async () => {
		try {
			const res = await fetch("/api/custom-nodes");
			if (!res.ok) throw new Error("Failed to fetch");
			const data = await res.json();
			setNodes(data.nodes ?? []);
		} catch {
			setError("Failed to load custom nodes");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchNodes();
	}, [fetchNodes]);

	const handleUpload = async () => {
		setError(null);
		setSubmitting(true);
		try {
			const definition = JSON.parse(jsonInput);
			const res = await fetch("/api/custom-nodes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(definition),
			});
			const data = await res.json();
			if (!res.ok) {
				setError(data.error || "Failed to register node");
				return;
			}
			setJsonInput("");
			setShowUpload(false);
			fetchNodes();
		} catch {
			setError("Invalid JSON definition");
		} finally {
			setSubmitting(false);
		}
	};

	const handleToggle = async (nodeDbId: number, enabled: boolean) => {
		try {
			await fetch(`/api/custom-nodes/${nodeDbId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: !enabled }),
			});
			fetchNodes();
		} catch {
			setError("Failed to update node");
		}
	};

	const handleDelete = async (nodeDbId: number, name: string) => {
		if (!confirm(`Delete custom node "${name}"? This cannot be undone.`)) {
			return;
		}
		try {
			await fetch(`/api/custom-nodes/${nodeDbId}`, { method: "DELETE" });
			fetchNodes();
		} catch {
			setError("Failed to delete node");
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-white">Custom Nodes</h1>
					<p className="text-sm text-white/50 mt-1">
						Register custom node definitions to extend your workflow engine.
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowUpload(!showUpload)}
					className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-md transition-colors"
				>
					{showUpload ? "Cancel" : "Register Node"}
				</button>
			</div>

			{error && (
				<div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-md text-sm">
					{error}
					<button
						type="button"
						onClick={() => setError(null)}
						className="ml-2 text-red-300 hover:text-red-200"
					>
						Dismiss
					</button>
				</div>
			)}

			{showUpload && (
				<div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
					<label className="block text-sm font-medium text-white/70">
						Node Definition (JSON)
					</label>
					<textarea
						value={jsonInput}
						onChange={(e) => setJsonInput(e.target.value)}
						placeholder={`{
  "name": "my-custom-node",
  "displayName": "My Custom Node",
  "description": "Does something custom",
  "icon": "Box",
  "category": "Custom",
  "version": "1.0.0",
  "inputs": [
    { "name": "data", "displayName": "Data", "type": "any" }
  ],
  "outputs": [
    { "name": "result", "displayName": "Result", "type": "any" }
  ],
  "properties": [
    { "name": "apiUrl", "displayName": "API URL", "type": "string", "required": true }
  ],
  "executeCode": "async (context) => { return { result: context.inputs.data }; }"
}`}
						className="w-full h-[300px] bg-black/30 border border-white/10 rounded-md p-3 text-sm text-white font-mono resize-y focus:outline-none focus:border-white/30"
					/>
					<div className="flex gap-2 justify-end">
						<button
							type="button"
							onClick={() => {
								setShowUpload(false);
								setJsonInput("");
							}}
							className="px-3 py-1.5 text-sm text-white/50 hover:text-white/70"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleUpload}
							disabled={!jsonInput.trim() || submitting}
							className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/30 text-white text-sm rounded-md transition-colors"
						>
							{submitting ? "Registering..." : "Register"}
						</button>
					</div>
				</div>
			)}

			{loading ? (
				<div className="text-white/50 text-sm py-8 text-center">
					Loading custom nodes...
				</div>
			) : nodes.length === 0 ? (
				<div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center">
					<div className="text-white/30 text-4xl mb-3">&#x2699;</div>
					<p className="text-white/50 text-sm">
						No custom nodes registered yet.
					</p>
					<p className="text-white/30 text-xs mt-1">
						Click &quot;Register Node&quot; to upload a JSON node definition.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{nodes.map((node) => (
						<div
							key={node.dbId}
							className={`bg-white/5 border border-white/10 rounded-lg p-4 flex items-center gap-4 ${
								!node.enabled ? "opacity-50" : ""
							}`}
						>
							<div className="w-10 h-10 bg-white/10 rounded-md flex items-center justify-center text-white/60 text-lg shrink-0">
								&#x2699;
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="text-white font-medium text-sm truncate">
										{node.displayName}
									</span>
									<span className="text-white/30 text-xs font-mono">
										{node.name}
									</span>
									<span className="text-white/20 text-xs">v{node.version}</span>
								</div>
								{node.description && (
									<p className="text-white/40 text-xs mt-0.5 truncate">
										{node.description}
									</p>
								)}
								<div className="flex items-center gap-3 mt-1">
									<span className="text-white/20 text-xs">
										{node.category}
									</span>
									{node.authorName && (
										<span className="text-white/20 text-xs">
											by {node.authorName}
										</span>
									)}
								</div>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								<button
									type="button"
									onClick={() => handleToggle(node.dbId, node.enabled)}
									className={`px-3 py-1 text-xs rounded-full transition-colors ${
										node.enabled
											? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
											: "bg-white/10 text-white/40 hover:bg-white/20"
									}`}
								>
									{node.enabled ? "Enabled" : "Disabled"}
								</button>
								<button
									type="button"
									onClick={() => handleDelete(node.dbId, node.name)}
									className="px-2 py-1 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
								>
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
