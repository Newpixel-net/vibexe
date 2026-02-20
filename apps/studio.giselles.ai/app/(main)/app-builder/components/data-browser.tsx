"use client";

import { useState } from "react";
import { DataTable } from "./data-table";
import { EntityForm } from "./entity-form";

interface SchemaField {
  name: string;
  type: string;
  required?: boolean;
}

interface SchemaEntity {
  name: string;
  tableName: string;
  fields: SchemaField[];
}

interface DataBrowserProps {
  appId: string;
  schema: { entities: SchemaEntity[] } | null;
}

export function DataBrowser({ appId, schema }: DataBrowserProps) {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(
    schema?.entities?.[0]?.tableName ?? null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!schema || schema.entities.length === 0) {
    return (
      <div className="text-center py-16 text-white/40">
        <p className="text-lg mb-2">No entities defined</p>
        <p className="text-sm">Add entities to your app schema to manage data here.</p>
      </div>
    );
  }

  const currentEntity = schema.entities.find(e => e.tableName === selectedEntity);

  const handleAddRow = () => {
    setEditRow(null);
    setFormOpen(true);
  };

  const handleEditRow = (row: Record<string, unknown>) => {
    setEditRow(row);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditRow(null);
  };

  const handleFormSaved = () => {
    setFormOpen(false);
    setEditRow(null);
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div>
      {/* Entity tab bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/[0.06] overflow-x-auto">
        {schema.entities.map((entity) => (
          <button
            key={entity.tableName}
            type="button"
            onClick={() => {
              setSelectedEntity(entity.tableName);
              setFormOpen(false);
              setEditRow(null);
            }}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              selectedEntity === entity.tableName
                ? "border-violet-400 text-violet-300"
                : "border-transparent text-white/40 hover:text-white/70 hover:border-white/40"
            }`}
          >
            {entity.name}
          </button>
        ))}
      </div>

      {/* Data table for selected entity */}
      {currentEntity && (
        <DataTable
          appId={appId}
          entity={currentEntity.tableName}
          fields={currentEntity.fields}
          onAddRow={handleAddRow}
          onEditRow={handleEditRow}
          refreshTrigger={refreshTrigger}
        />
      )}

      {/* Entity form modal */}
      {formOpen && currentEntity && (
        <EntityForm
          appId={appId}
          entity={currentEntity.tableName}
          fields={currentEntity.fields}
          editRow={editRow}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  );
}
