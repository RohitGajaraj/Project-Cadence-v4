import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkIngestRateLimit } from "@/lib/ingest-ratelimit.server";
import { screenIngestText, INGEST_REVIEW_TAG } from "@/lib/ingest-guardrails";

/**
 * F-V5-INGEST-WEBHOOK — public continuous-ingest door.
 *
 * Turns any external POST (Zapier, Slack outgoing webhook, forms, scripts)
 * into signals rows. Auth is a per-workspace ingest token (managed in
 * src/lib/ingest.functions.ts), NOT requireHookCaller: callers send
 * `Authorization: Bearer <token>` (or `x-ingest-token: <token>`), which is
 * looked up in ingest_tokens (revoked_at IS NULL) via the service-role client
 * to resolve user_id + workspace_id.
 *
 * Inserted rows stamp workspace_id explicitly — the column's
 * current_user_default_workspace() default returns NULL without an auth
 * context, and the signals_reactor_fanout trigger matches on workspace_id, so
 * the explicit stamp is what lets webhook signals enter the signal.created
 * auto-pipeline.
 */

const signalSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(5000).optional(),
  source: z.string().max(40).optional(),
});

// Liberal: either { signals: [...] } (max 50) or a single bare signal object.
// zod objects strip unknown keys, so anything else the caller sends is dropped.
const bodySchema = z.union([
  z.object({ signals: z.array(signalSchema).min(1).max(50) }),
  signalSchema,
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/public/ingest-signals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // --- Auth: Bearer ingest token (or x-ingest-token header) ---
          const authHeader = request.headers.get("authorization") ?? "";
          const bearer = /^bearer\s+/i.test(authHeader)
            ? authHeader.replace(/^bearer\s+/i, "").trim()
            : "";
          const token = bearer || (request.headers.get("x-ingest-token") ?? "").trim();
          if (!token) return json({ ok: false, error: "missing ingest token" }, 401);

          // ingest_tokens is not yet in the generated Database types — untyped
          // cast, same precedent as outcome.functions.ts.
          const admin = supabaseAdmin as unknown as SupabaseClient;
          const token_hash = createHash("sha256").update(token).digest("hex");
          const { data: tok, error: tokError } = await admin
            .from("ingest_tokens")
            .select("id,user_id,workspace_id")
            .eq("token_hash", token_hash)
            .is("revoked_at", null)
            .maybeSingle();
          if (tokError) throw new Error(tokError.message);
          if (!tok) return json({ ok: false, error: "invalid ingest token" }, 401);

          // --- Rate limit check: per-token cap ---
          const rateLimitCheck = await checkIngestRateLimit(admin, tok.id);
          if (!rateLimitCheck.allowed) {
            return json(
              {
                ok: false,
                error: "Rate limit exceeded",
                retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
              },
              429,
            );
          }

          // --- Body: validate liberally, strip everything else ---
          let raw: unknown;
          try {
            raw = await request.json();
          } catch {
            return json({ ok: false, error: "invalid JSON body" }, 400);
          }
          const parsed = bodySchema.safeParse(raw);
          if (!parsed.success) {
            return json(
              {
                ok: false,
                error: "expected { title, content?, source? } or { signals: [...] } (max 50)",
              },
              400,
            );
          }
          const items = "signals" in parsed.data ? parsed.data.signals : [parsed.data];

          // --- SEC-SIGNAL-INGEST-INJECTION (considerations #3, P0): this is a LIVE, EXTERNAL
          // untrusted-input door - a posted "signal" lands in `signals` and becomes trusted
          // context the agents read. Screen each item BEFORE insert: a structural prompt
          // injection (fence-breakout / forged-system-turn) is REJECTED (never stored); a
          // borderline lexical-only override is stored but tagged for review. Reuses the
          // structural-gate classifier, so an item merely QUOTING an injection is not dropped.
          let quarantined = 0;
          const rows: Array<{
            user_id: string;
            workspace_id: string;
            title: string;
            content: string;
            source: string;
            tags: string[];
          }> = [];
          for (const s of items) {
            // Screen ALL attacker-controlled free text that reaches downstream context:
            // title + content + source (the reactor copies `source` into the event payload).
            const decision = screenIngestText(`${s.title} ${s.content ?? ""} ${s.source ?? ""}`);
            if (decision === "quarantine") {
              quarantined++;
              continue; // never store a structural injection from an external caller
            }
            // --- Insert: same columns as createSignal (discovery.functions.ts), stamped with
            // the token's user_id + workspace_id. signals.content is NOT NULL, falls back to title.
            rows.push({
              user_id: tok.user_id,
              workspace_id: tok.workspace_id,
              title: s.title,
              content: s.content?.trim() || s.title,
              source: s.source?.trim() || "webhook",
              tags: decision === "flag" ? [INGEST_REVIEW_TAG] : [],
            });
          }
          if (rows.length) {
            const { error: insertError } = await supabaseAdmin.from("signals").insert(rows);
            if (insertError) throw new Error(insertError.message);
          }

          return json({ ok: true, created: rows.length, quarantined });
        } catch (e) {
          console.error("[ingest-signals]", e);
          return json({ ok: false, error: "internal error" }, 500);
        }
      },
    },
  },
});
