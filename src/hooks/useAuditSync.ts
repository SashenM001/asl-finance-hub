import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncAuditData, type AuditSyncResult } from "@/integrations/googleSheets/auditSync";

export interface ExtendedAuditSyncResult extends AuditSyncResult {
  webhookRows?: number;
  webhookWarnings?: string[];
}

/**
 * Two-step audit sync, mirroring useSheetSync but for the audit pipeline:
 *   1. Trigger the AppScript audit builder via the Edge Function (sync: "audit").
 *   2. Pull MASTER_AUDIT_TALL into `audit_scores`.
 *
 * The Edge Function enforces the mc_user role server-side; the Admin page that
 * hosts this is already MC-only, so the trigger is MC-only at both layers.
 */
export function useAuditSync() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtendedAuditSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // ── Step 1: trigger AppScript audit builder via Edge Function ─────────
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trigger-audit-sync`;

      const webhookRes = await fetch(edgeFnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
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

      // ── Step 2: pull MASTER_AUDIT_TALL into audit_scores ─────────────────
      const res = await syncAuditData();
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
