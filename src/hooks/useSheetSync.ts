import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncSheetData } from "@/integrations/googleSheets/sync";
import type { SyncResult } from "@/integrations/googleSheets";

export type SyncMode = "all" | "term" | "current";

export interface SyncOptions {
  mode: SyncMode;
  term?: string; // e.g. "24-25" — required when mode === "term"
  month?: string; // ISO first-of-month e.g. "2026-06-01" — auto-set when mode === "current"
}

export interface ExtendedSyncResult extends SyncResult {
  webhookRows?: number;
  webhookWarnings?: string[];
}

export function useSheetSync() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtendedSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = async (options: SyncOptions) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const month =
        options.mode === "current"
          ? (() => {
              const d = new Date();
              d.setDate(1);
              return d.toISOString().slice(0, 10);
            })()
          : (options.month ?? null);

      // ── Step 1: trigger AppScript via Edge Function ──────────────────────
      // The Edge Function holds APPSCRIPT_WEBHOOK_URL + APPSCRIPT_SECRET
      // server-side — the browser only sends the user's JWT here.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-financial-sync`;

      const webhookRes = await fetch(edgeFnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mode: options.mode,
          term: options.term ?? null,
          month,
        }),
      });

      if (!webhookRes.ok) {
        throw new Error(`AppScript webhook HTTP error: ${webhookRes.status}`);
      }

      const webhookData = (await webhookRes.json()) as {
        ok: boolean;
        error?: string;
        rowsWritten?: number;
        warnings?: string[];
      };

      if (!webhookData.ok) {
        throw new Error(`AppScript error: ${webhookData.error ?? "unknown"}`);
      }

      // ── Step 2: pull updated master sheet into Supabase ──
      const res = await syncSheetData();
      setResult({
        ...res,
        webhookRows: webhookData.rowsWritten,
        webhookWarnings: webhookData.warnings ?? [],
      });
      if (!res.success) setError(res.errors.join("; "));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return { sync, loading, result, error };
}
