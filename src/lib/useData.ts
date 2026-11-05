import { useCallback, useEffect, useRef, useState } from 'react';
import { get, ApiError } from './api';

/** Loads a GET endpoint; reload() refetches. Keeps the previous data on screen while refreshing. */
export function useData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const r = await get<T>(path);
      if (id === seq.current) { setData(r); setError(null); }
    } catch (e) {
      if (id === seq.current) setError(e instanceof ApiError ? e.message : 'Could not load this page. Check your connection and try again.');
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);
  return { data, error, loading, reload: load };
}
