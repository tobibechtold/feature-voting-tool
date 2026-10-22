// Pure helpers for Jira-style item keys (e.g. INTAKE-42).
// No imports: loaded by both Deno (edge functions) and Vitest/Vite.

export const ITEM_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatItemKey(appKey: string, number: number): string {
  return `${appKey}-${number}`;
}

export function parseItemKey(
  input: string,
): { appKey: string; number: number } | null {
  const trimmed = input.trim();
  const dash = trimmed.lastIndexOf('-');
  if (dash < 0) return null;

  const appKey = trimmed.slice(0, dash).toUpperCase();
  const numberPart = trimmed.slice(dash + 1);
  if (!ITEM_KEY_PATTERN.test(appKey)) return null;
  if (!/^[0-9]+$/.test(numberPart)) return null;

  const number = Number(numberPart);
  if (!Number.isSafeInteger(number) || number < 1) return null;

  return { appKey, number };
}

export function isUuid(input: string): boolean {
  return UUID_PATTERN.test(input);
}

// Mirrors the base derivation of public.derive_item_key (no collision suffix).
export function deriveItemKey(slug: string): string {
  let base = (slug ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[0-9]/.test(base)) base = `X${base}`;
  base = base.padEnd(2, 'X');
  return base.slice(0, 10);
}

export function isValidItemKey(key: string): boolean {
  return ITEM_KEY_PATTERN.test(key);
}
