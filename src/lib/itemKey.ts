import { isUuid, parseItemKey } from '../../supabase/functions/_shared/itemKey.ts';

export * from '../../supabase/functions/_shared/itemKey.ts';

export type FeedbackLookup =
  | { by: 'id'; id: string }
  | { by: 'number'; appId: string; number: number }
  | { by: 'none' };

export function resolveFeedbackLookup(
  idOrKey: string | undefined,
  app: { id: string; item_key: string } | null | undefined,
): FeedbackLookup {
  if (!idOrKey) return { by: 'none' };
  if (isUuid(idOrKey)) return { by: 'id', id: idOrKey };

  const parsed = parseItemKey(idOrKey);
  if (!parsed || !app || parsed.appKey !== app.item_key) return { by: 'none' };

  return { by: 'number', appId: app.id, number: parsed.number };
}
