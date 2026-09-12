import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, Database } from 'lucide-react';
import type { DataField } from '@uts/core';
import { useTemplateStore } from '../../store/useTemplateStore.js';
import {
  validateVariableName,
  parseSampleValue,
  type VariableType,
} from '../../operations/variableOperations.js';

interface VariablesManagerProps {
  onVariableSelect?: (variableName: string) => void;
}

export const VariablesManager: React.FC<VariablesManagerProps> = ({ onVariableSelect }) => {
  const fields = useTemplateStore((s) => s.template.dataSchema?.fields || []);
  const mockPayload = useTemplateStore((s) => s.template.dataSchema?.mockPayload || {});
  const addVariable = useTemplateStore((s) => s.addVariable);
  const updateVariable = useTemplateStore((s) => s.updateVariable);
  const deleteVariable = useTemplateStore((s) => s.deleteVariable);

  // Form mode: null (idle), 'add', or variable name being edited
  const [editingName, setEditingName] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<VariableType>('string');
  const [formSample, setFormSample] = useState<string>('');
  const [nameError, setNameError] = useState<string | null>(null);

  const startAdd = () => {
    setIsAdding(true);
    setEditingName(null);
    setFormName('');
    setFormType('string');
    setFormSample('');
    setNameError(null);
  };

  const startEdit = (field: DataField) => {
    setEditingName(field.name);
    setIsAdding(false);
    setFormName(field.name);
    setFormType((field.type as VariableType) || 'string');
    const sample = mockPayload[field.name] !== undefined ? mockPayload[field.name] : field.sampleValue;
    setFormSample(sample !== undefined && sample !== null ? String(sample) : '');
    setNameError(null);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingName(null);
    setFormName('');
    setNameError(null);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    const validation = validateVariableName(val, fields, editingName || undefined);
    if (!validation.valid) {
      setNameError(validation.error || 'Invalid name');
    } else {
      setNameError(null);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateVariableName(formName, fields, editingName || undefined);
    if (!validation.valid) {
      setNameError(validation.error || 'Invalid name');
      return;
    }

    const cleanName = formName.trim();
    const parsedSample = parseSampleValue(formType, formSample);

    if (isAdding) {
      addVariable(
        {
          name: cleanName,
          type: formType,
          sampleValue: parsedSample,
        },
        parsedSample,
      );
    } else if (editingName) {
      updateVariable(
        editingName,
        {
          name: cleanName,
          type: formType,
          sampleValue: parsedSample,
        },
        parsedSample,
      );
    }

    cancelForm();
  };

  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case 'number':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60';
      case 'boolean':
        return 'bg-purple-950/60 text-purple-400 border-purple-800/60';
      case 'string':
      default:
        return 'bg-blue-950/60 text-blue-400 border-blue-800/60';
    }
  };

  return (
    <div className="space-y-3">
      {/* Top Header & Add Variable Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-studio-text">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span>Template Variables</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            {fields.length}
          </span>
        </div>
        {!isAdding && !editingName && (
          <button
            type="button"
            onClick={startAdd}
            className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors shadow-sm"
          >
            <Plus className="w-3 h-3" />
            <span>Add Variable</span>
          </button>
        )}
      </div>

      {/* Add / Edit Inline Form */}
      {(isAdding || editingName) && (
        <form
          onSubmit={handleSave}
          className="p-3 rounded-lg bg-zinc-900 border border-blue-500/40 space-y-2.5 text-xs"
        >
          <div className="text-[11px] font-semibold text-blue-400">
            {isAdding ? 'Create New Variable' : `Edit Variable: ${editingName}`}
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-[10px] font-medium text-studio-muted mb-1">
              Variable Name (Identifier)
            </label>
            <input
              type="text"
              autoFocus
              value={formName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. customer_name"
              className={`w-full bg-zinc-950 border ${
                nameError ? 'border-red-500' : 'border-studio-border'
              } rounded px-2 py-1 text-studio-text text-xs font-mono focus:outline-none focus:border-blue-500`}
            />
            {nameError && (
              <span className="text-[10px] text-red-400 block mt-0.5">{nameError}</span>
            )}
          </div>

          {/* Type & Sample Value Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-studio-muted mb-1">
                Data Type
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as VariableType)}
                className="w-full bg-zinc-950 border border-studio-border rounded px-2 py-1 text-studio-text text-xs focus:outline-none focus:border-blue-500 font-sans"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-studio-muted mb-1">
                Sample / Mock Value
              </label>
              {formType === 'boolean' ? (
                <select
                  value={formSample}
                  onChange={(e) => setFormSample(e.target.value)}
                  className="w-full bg-zinc-950 border border-studio-border rounded px-2 py-1 text-studio-text text-xs font-mono focus:outline-none focus:border-blue-500"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input
                  type={formType === 'number' ? 'number' : 'text'}
                  value={formSample}
                  onChange={(e) => setFormSample(e.target.value)}
                  placeholder={formType === 'number' ? '0' : 'Sample value'}
                  className="w-full bg-zinc-950 border border-studio-border rounded px-2 py-1 text-studio-text text-xs font-mono focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={cancelForm}
              className="px-2 py-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 text-[11px] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={Boolean(nameError) || !formName.trim()}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-medium transition-colors"
            >
              <Check className="w-3 h-3" />
              <span>{isAdding ? 'Create' : 'Save'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Variables List */}
      <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-0.5">
        {fields.length === 0 && !isAdding && (
          <div className="p-4 rounded-lg border border-dashed border-studio-border/80 text-center text-studio-muted">
            <p className="text-xs font-medium text-studio-text mb-0.5">No variables defined</p>
            <p className="text-[11px] text-zinc-500 mb-2.5">
              Add variables to create dynamic placeholders for names, barcodes, amounts, and IDs.
            </p>
            <button
              type="button"
              onClick={startAdd}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-studio-border text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Create First Variable</span>
            </button>
          </div>
        )}

        {fields.map((field) => {
          const sample =
            mockPayload[field.name] !== undefined
              ? mockPayload[field.name]
              : field.sampleValue;
          const sampleStr =
            sample !== undefined && sample !== null ? String(sample) : '—';

          return (
            <div
              key={field.name}
              className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/70 hover:bg-zinc-900 border border-studio-border/60 transition-colors group"
            >
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => onVariableSelect?.(field.name)}
                title={onVariableSelect ? `Click to select variable {{${field.name}}}` : undefined}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-mono text-xs font-semibold text-studio-text truncate">
                    {field.name}
                  </span>
                  <span
                    className={`text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded border font-mono ${getTypeBadgeStyle(
                      field.type,
                    )}`}
                  >
                    {field.type}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 truncate">
                  <span className="text-studio-muted">Sample: </span>
                  <span className="font-mono text-zinc-300 font-medium">
                    {sampleStr}
                  </span>
                </div>
              </div>

              {/* Edit & Delete Actions */}
              <div className="flex items-center gap-0.5 ml-2 opacity-80 group-hover:opacity-100 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(field)}
                  title={`Edit ${field.name}`}
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete variable "${field.name}"? Elements bound to it will be unbound.`)) {
                      deleteVariable(field.name);
                      if (editingName === field.name) cancelForm();
                    }
                  }}
                  title={`Delete ${field.name}`}
                  className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
