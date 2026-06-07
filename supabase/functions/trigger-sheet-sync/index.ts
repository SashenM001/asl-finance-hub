// ── Supabase Edge Function: trigger-sheet-sync ──────────────────────────────
// Proxy between the React app and the AppScript webhook.
// Secrets (APPSCRIPT_WEBHOOK_URL, APPSCRIPT_SECRET) live here server-side —
// they are never sent to the browser.
//
// Flow:
//   1. Verify caller has a valid Supabase JWT
//   2. Confirm caller has mc_user role
//   3. Forward { mode, term, month } to AppScript with the secret
//   4. Return AppScript's JSON response to the browser
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // ── 1. Authenticate: require a valid Supabase JWT ────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "Missing auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 2. Authorise: caller must have mc_user role ───────────────────────────
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

  const isMC = (roles ?? []).some((r: { role: string }) => r.role === "mc_user");
  if (!isMC) {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden — MC role required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── 3. Forward to AppScript ───────────────────────────────────────────────
  // APPSCRIPT_WEBHOOK_URL and APPSCRIPT_SECRET are stored as Supabase secrets
  // (Dashboard → Edge Functions → Secrets). They never reach the browser.
  const body = await req.json();

  const webhookRes = await fetch(Deno.env.get("APPSCRIPT_WEBHOOK_URL")!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: Deno.env.get("APPSCRIPT_SECRET")!,
      mode: body.mode ?? "all",
      term: body.term ?? null,
      month: body.month ?? null,
    }),
  });

  // ── 4. Return AppScript's response to the browser ─────────────────────────
  const result = await webhookRes.json();
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
