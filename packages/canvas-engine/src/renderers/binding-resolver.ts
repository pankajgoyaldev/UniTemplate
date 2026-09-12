import type { TextElement, BarcodeElement } from '@uts/core';

/**
 * Resolves inline {{variable}} tokens within a string using a payload dictionary.
 *
 * Rules:
 * - Replaces known variables with their stringified value.
 * - Preserves unknown variables (e.g. {{unknown_field}} remains {{unknown_field}}).
 * - Handles numbers (e.g. 2500 -> "2500") and booleans (true -> "true").
 * - Handles malformed brackets and empty inputs safely without throwing.
 * - Supports multiple tokens in one string.
 * - Trims inner whitespace around token identifier: {{ customer_name }} -> resolves customer_name.
 */
export function resolveTemplateTokens(
  content: string,
  payload: Record<string, unknown> = {},
): string {
  if (!content || typeof content !== 'string' || !content.includes('{{')) {
    return content || '';
  }

  return content.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, fieldName) => {
    if (Object.prototype.hasOwnProperty.call(payload, fieldName)) {
      const val = payload[fieldName];
      if (val !== undefined && val !== null) {
        return String(val);
      }
      return '';
    }
    // Preserve unknown variable token as-is
    return match;
  });
}

/**
 * Resolves the display content for a text element.
 *
 * Design View:
 * - If bindingField is set: returns `{{bindingField}}` (or element.content if it already contains tokens).
 * - If static: returns element.content as-is.
 *
 * Preview View:
 * - If bindingField is set: resolves mockPayload[bindingField]. If missing or undefined, falls back
 *   to token-resolved element.content or empty string.
 * - If not bound: resolves any inline {{tokens}} in element.content using mockPayload.
 */
export function resolveTextElementContent(
  element: TextElement,
  payload: Record<string, unknown> = {},
  previewMode = false,
): string {
  if (!previewMode) {
    if (element.bindingField && element.bindingField.trim().length > 0) {
      // If content already has template tokens, preserve template structure
      if (element.content && element.content.includes('{{')) {
        return element.content;
      }
      return `{{${element.bindingField.trim()}}}`;
    }
    return element.content || '';
  }

  // Preview View
  if (element.bindingField && element.bindingField.trim().length > 0) {
    const key = element.bindingField.trim();
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const val = payload[key];
      if (val !== undefined && val !== null) {
        return String(val);
      }
    }
    // Fallback: if binding not found in payload, check if content has fallback text or tokens
    if (element.content) {
      return resolveTemplateTokens(element.content, payload);
    }
    return '';
  }

  // Unbound text element with potential inline tokens
  return resolveTemplateTokens(element.content || '', payload);
}

/**
 * Resolves the dynamic value for a barcode or QR code element.
 *
 * Design View:
 * - Returns element.content (preserving valid barcode syntax for static render).
 *
 * Preview View:
 * - If bindingField is set: resolves mockPayload[bindingField]. If missing, falls back to element.content.
 * - If not bound: resolves any inline tokens in element.content.
 */
export function resolveBarcodeElementContent(
  element: BarcodeElement,
  payload: Record<string, unknown> = {},
  previewMode = false,
): string {
  if (!previewMode) {
    return element.content || '';
  }

  if (element.bindingField && element.bindingField.trim().length > 0) {
    const key = element.bindingField.trim();
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const val = payload[key];
      if (val !== undefined && val !== null) {
        return String(val);
      }
    }
    return element.content || '';
  }

  return resolveTemplateTokens(element.content || '', payload);
}

