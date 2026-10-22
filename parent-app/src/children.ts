import { useCallback, useEffect, useState } from 'react';
import { children as fetchChildren, type Child } from './api';

/**
 * Loads the parent's linked children once and keeps a shared selection.
 * `selId` lives in App state so every tab shows the same child. Auto-selects
 * the first child when nothing (or a stale id) is selected — done in its own
 * effect so refresh never clobbers a manual choice.
 */
export function useChildren(selId: number | null, onSelect: (id: number) => void) {
  const [kids, setKids] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    try {
      const k = await fetchChildren();
      setKids(k);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Could not load your children.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (kids.length && (selId == null || !kids.some((x) => x.id === selId))) {
      onSelect(kids[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kids, selId]);

  const sel = kids.find((k) => k.id === selId) || kids[0] || null;
  return { kids, sel, loading, err, reload: load, setErr };
}
