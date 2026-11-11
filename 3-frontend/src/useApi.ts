import { useEffect, useState } from "react";
import type { DependencyList } from "react";

/**
 * Loads data from the backend, and loads it again whenever one of `deps` changes
 * (e.g. the refresh counter of the app). The old data stays visible while reloading.
 */
export function useApi<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false; // ignore answers that arrive after the component changed
    load()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, deps); // the caller decides when to reload, through `deps`

  return { data, error };
}
