/**
 * Hook: useSheetSync
 * 
 * Provides sync functionality in React components
 */

import { useState } from "react";
import { syncSheetData } from "@/integrations/googleSheets/sync";
import type { SyncResult } from "@/integrations/googleSheets";

export function useSheetSync() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await syncSheetData();
      setResult(res);
      if (!res.success) {
        setError(res.errors.join("; "));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return { sync, loading, result, error };
}
