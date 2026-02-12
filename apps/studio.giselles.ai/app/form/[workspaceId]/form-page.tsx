"use client";

import type { WorkspaceId } from "@giselles-ai/protocol";
import { useCallback, useEffect, useState } from "react";

interface FormFieldConfig {
	id: string;
	name: string;
	label: string;
	type: string;
	required: boolean;
	options: string[];
	placeholder: string;
	defaultValue: string;
}

interface FormConfig {
	title: string;
	description: string;
	fields: FormFieldConfig[];
	submitButtonText: string;
	successMessage: string;
}

export function FormPage({ workspaceId }: { workspaceId: WorkspaceId }) {
	const [config, setConfig] = useState<FormConfig | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [values, setValues] = useState<Record<string, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	useEffect(() => {
		fetch(`/api/form/${workspaceId}`)
			.then((res) => {
				if (!res.ok) throw new Error("Form not found");
				return res.json();
			})
			.then((data: FormConfig) => {
				setConfig(data);
				const defaults: Record<string, string> = {};
				for (const field of data.fields) {
					defaults[field.name] = field.defaultValue || "";
				}
				setValues(defaults);
			})
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [workspaceId]);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			if (!config) return;

			setSubmitting(true);
			setSubmitError(null);

			try {
				const res = await fetch(`/api/form/${workspaceId}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ data: values }),
				});

				if (!res.ok) {
					const err = await res.json();
					throw new Error(err.error || "Submission failed");
				}

				setSubmitted(true);
			} catch (err) {
				setSubmitError(
					err instanceof Error ? err.message : "Submission failed",
				);
			} finally {
				setSubmitting(false);
			}
		},
		[config, values, workspaceId],
	);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-[#0a0b14] text-white">
				<p className="text-[16px] text-white/60">Loading form...</p>
			</div>
		);
	}

	if (error || !config) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-[#0a0b14] text-white">
				<p className="text-[16px] text-red-400">
					{error || "Form not found"}
				</p>
			</div>
		);
	}

	if (submitted) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-[#0a0b14] text-white">
				<div className="w-full max-w-[500px] mx-auto p-[32px] text-center">
					<div className="text-[48px] mb-[16px]">&#10003;</div>
					<p className="text-[18px] text-white/90">
						{config.successMessage}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#0a0b14] text-white py-[48px] px-[16px]">
			<div className="w-full max-w-[500px] mx-auto">
				{config.title && (
					<h1 className="text-[24px] font-bold mb-[8px]">
						{config.title}
					</h1>
				)}
				{config.description && (
					<p className="text-[14px] text-white/60 mb-[24px]">
						{config.description}
					</p>
				)}
				<form onSubmit={handleSubmit} className="flex flex-col gap-[20px]">
					{config.fields.map((field) => (
						<div key={field.id} className="flex flex-col gap-[6px]">
							<label className="text-[13px] text-white/80 font-medium">
								{field.label}
								{field.required && (
									<span className="text-red-400 ml-[4px]">*</span>
								)}
							</label>
							{field.type === "textarea" ? (
								<textarea
									className="w-full min-h-[100px] rounded-[8px] border border-white/20 bg-white/5 px-[12px] py-[10px] text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500 resize-y"
									value={values[field.name] || ""}
									onChange={(e) =>
										setValues((v) => ({
											...v,
											[field.name]: e.target.value,
										}))
									}
									placeholder={field.placeholder}
									required={field.required}
								/>
							) : field.type === "select" ? (
								<select
									className="w-full rounded-[8px] border border-white/20 bg-white/5 px-[12px] py-[10px] text-[14px] text-white focus:outline-none focus:border-blue-500"
									value={values[field.name] || ""}
									onChange={(e) =>
										setValues((v) => ({
											...v,
											[field.name]: e.target.value,
										}))
									}
									required={field.required}
								>
									<option value="">
										{field.placeholder || "Select..."}
									</option>
									{field.options.map((opt) => (
										<option key={opt} value={opt}>
											{opt}
										</option>
									))}
								</select>
							) : field.type === "checkbox" ? (
								<label className="flex items-center gap-[8px] text-[14px]">
									<input
										type="checkbox"
										checked={values[field.name] === "true"}
										onChange={(e) =>
											setValues((v) => ({
												...v,
												[field.name]: String(e.target.checked),
											}))
										}
									/>
									<span className="text-white/70">
										{field.placeholder || field.label}
									</span>
								</label>
							) : (
								<input
									type={field.type}
									className="w-full rounded-[8px] border border-white/20 bg-white/5 px-[12px] py-[10px] text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500"
									value={values[field.name] || ""}
									onChange={(e) =>
										setValues((v) => ({
											...v,
											[field.name]: e.target.value,
										}))
									}
									placeholder={field.placeholder}
									required={field.required}
								/>
							)}
						</div>
					))}
					{submitError && (
						<p className="text-[13px] text-red-400">{submitError}</p>
					)}
					<button
						type="submit"
						disabled={submitting}
						className="w-full rounded-[8px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-[16px] py-[12px] text-[14px] font-medium text-white transition-colors mt-[8px]"
					>
						{submitting ? "Submitting..." : config.submitButtonText}
					</button>
				</form>
				<p className="mt-[24px] text-center text-[11px] text-white/30">
					Powered by Vibexe
				</p>
			</div>
		</div>
	);
}
