"use client";

import { type FormEvent, useEffect, useState } from "react";

interface EntityField {
  name: string;
  type: string;
  required?: boolean;
}

interface EntityFormProps {
  appId: string;
  entity: string;
  fields: EntityField[];
  editRow: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EntityForm({ appId, entity, fields, editRow, onClose, onSaved }: EntityFormProps) {
  const isEdit = editRow !== null;
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editRow) {
      const initial: Record<string, unknown> = {};
      for (const field of fields) {
        initial[field.name] = editRow[field.name] ?? getDefaultValue(field.type);
      }
      setValues(initial);
    } else {
      const initial: Record<string, unknown> = {};
      for (const field of fields) {
        initial[field.name] = getDefaultValue(field.type);
      }
      setValues(initial);
    }
  }, [editRow, fields]);

  const handleChange = (fieldName: string, fieldType: string, rawValue: string | boolean) => {
    let parsed: unknown = rawValue;
    if (fieldType === "number" || fieldType === "integer" || fieldType === "float") {
      parsed = rawValue === "" ? null : Number(rawValue);
    } else if (fieldType === "boolean") {
      parsed = rawValue;
    } else if (fieldType === "json") {
      parsed = rawValue;
    }
    setValues(prev => ({ ...prev, [fieldName]: parsed }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {};
    for (const field of fields) {
      let val = values[field.name];
      if (field.type === "json" && typeof val === "string") {
        try {
          val = JSON.parse(val);
        } catch {
          setError(`Invalid JSON in field "${field.name}"`);
          setSaving(false);
          return;
        }
      }
      body[field.name] = val;
    }

    try {
      const url = isEdit
        ? `/api/apps/${appId}/data/${entity}/${editRow.id}`
        : `/api/apps/${appId}/data/${entity}`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Request failed (${res.status})`);
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white/[0.015] border border-white/[0.04] rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
          <h2 className="text-lg font-semibold text-zinc-100">
            {isEdit ? "Edit" : "Add"} {entity}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-900/30 border border-red-700 text-red-300 text-sm">
              {error}
            </div>
          )}

          {fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                {field.name}
                {field.required && <span className="text-red-400 ml-1">*</span>}
                <span className="text-zinc-500 ml-2 text-xs font-normal">{field.type}</span>
              </label>
              {renderFieldInput(field, values[field.name], (val) => handleChange(field.name, field.type, val))}
            </div>
          ))}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.04]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-300 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getDefaultValue(type: string): unknown {
  switch (type) {
    case "boolean":
      return false;
    case "number":
    case "integer":
    case "float":
      return "";
    case "json":
      return "{}";
    case "date":
    case "datetime":
      return "";
    default:
      return "";
  }
}

function renderFieldInput(
  field: EntityField,
  value: unknown,
  onChange: (val: string | boolean) => void,
) {
  const baseInputClass =
    "w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-md text-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/30 focus:border-transparent placeholder-zinc-500";

  switch (field.type) {
    case "boolean":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-white/[0.06] bg-white/[0.03] text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
          />
          <span className="text-sm text-zinc-300">{value ? "True" : "False"}</span>
        </label>
      );

    case "number":
    case "integer":
    case "float":
      return (
        <input
          type="number"
          step={field.type === "float" ? "any" : "1"}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={baseInputClass}
          placeholder={`Enter ${field.name}`}
        />
      );

    case "date":
      return (
        <input
          type="date"
          value={value ? String(value).slice(0, 10) : ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={baseInputClass}
        />
      );

    case "datetime":
      return (
        <input
          type="datetime-local"
          value={value ? String(value).slice(0, 16) : ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={baseInputClass}
        />
      );

    case "json":
      return (
        <textarea
          value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          rows={4}
          className={`${baseInputClass} font-mono text-xs`}
          placeholder='{"key": "value"}'
        />
      );

    case "text":
      return (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          rows={3}
          className={baseInputClass}
          placeholder={`Enter ${field.name}`}
        />
      );

    default:
      return (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={baseInputClass}
          placeholder={`Enter ${field.name}`}
        />
      );
  }
}
