import type { TemplateAst } from '@uts/core';

/**
 * Deep clones a TemplateAst ensuring complete reference isolation.
 * Uses structuredClone which is natively supported in Node 17+ and modern browsers,
 * with a JSON parse fallback.
 */
export function cloneTemplateAst(ast: TemplateAst): TemplateAst {
  if (typeof structuredClone === 'function') {
    return structuredClone(ast);
  }
  return JSON.parse(JSON.stringify(ast)) as TemplateAst;
}

/**
 * Deep equality check between two TemplateAst objects.
 * Used to detect no-ops and avoid creating unnecessary history records.
 */
export function isTemplateAstEqual(
  a: TemplateAst | null | undefined,
  b: TemplateAst | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b || !a.elements || !b.elements || !a.pageSettings || !b.pageSettings) return false;

  // Quick structure checks
  if (a.schemaVersion !== b.schemaVersion) return false;
  if (a.elements.length !== b.elements.length) return false;

  if (
    a.pageSettings.width !== b.pageSettings.width ||
    a.pageSettings.height !== b.pageSettings.height ||
    a.pageSettings.unit !== b.pageSettings.unit ||
    a.pageSettings.orientation !== b.pageSettings.orientation
  ) {
    return false;
  }

  // Deep comparison of AST payload
  return JSON.stringify(a) === JSON.stringify(b);
}

