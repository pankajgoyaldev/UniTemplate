import type { DataField } from '@uts/core';

export type VariableType = 'string' | 'number' | 'boolean';

/**
 * Validates a variable identifier according to safe identifier rules:
 * - Must not be empty.
 * - Whitespace trimmed.
 * - Must start with a letter (a-z, A-Z) or underscore (_).
 * - Can only contain alphanumeric characters and underscores.
 * - Must be unique among existing fields (case-insensitive check to prevent confusion).
 */
export function validateVariableName(
  rawName: string,
  existingFields: DataField[],
  currentName?: string,
): { valid: boolean; error?: string } {
  const name = rawName.trim();

  if (!name) {
    return { valid: false, error: 'Variable name cannot be empty.' };
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    return {
      valid: false,
      error: 'Name must start with a letter or underscore, and contain only letters, numbers, and underscores.',
    };
  }

  const normalizedName = name.toLowerCase();
  const isDuplicate = existingFields.some(
    (f) => f.name.toLowerCase() === normalizedName && f.name !== currentName,
  );

  if (isDuplicate) {
    return { valid: false, error: `A variable named "${name}" already exists.` };
  }

  return { valid: true };
}

/**
 * Coerces and formats a raw sample value according to its declared variable type.
 */
export function parseSampleValue(type: VariableType, raw: unknown): unknown {
  if (type === 'number') {
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? raw : 0;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    const str = String(raw).trim().toLowerCase();
    return str === 'true' || str === '1';
  }

  // String fallback
  if (raw === undefined || raw === null) return '';
  return String(raw);
}

