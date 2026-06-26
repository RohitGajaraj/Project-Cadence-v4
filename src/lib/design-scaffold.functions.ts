/**
 * DEF-04 (generative half) — AI-drafted design scaffold from a PRD spec.
 *
 * Takes the spec body already loaded on the PRD page and produces a
 * self-contained HTML mockup the user can view in a sandboxed iframe.
 *
 * No new CallSurface needed: uses the existing "prd" surface (already in
 * the union in runtime.server.ts, used by prdAssist / generateTaskGraph).
 * No DB storage: generated on demand, cached by TanStack Query on the client.
 * No new API key: uses the model already wired for the workspace.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";

// Minimal CSS injected into every generated mockup. Avoids any external CDN
// (cdn.tailwindcss.com is a dynamic JIT compiler; SRI hashes don't apply).
// The iframe is already sandboxed at null origin — this adds defense in depth.
const MOCKUP_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fff; color: #1e293b; font-size: 14px; line-height: 1.5; }
  nav { display: flex; align-items: center; gap: 12px; padding: 0 24px; height: 48px; border-bottom: 1px solid #e2e8f0; background: #fff; }
  nav .brand { font-weight: 700; font-size: 15px; color: #4f46e5; }
  nav .nav-links { display: flex; gap: 16px; font-size: 13px; color: #64748b; }
  main { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
  h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  h2 { font-size: 16px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
  h3 { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
  p { color: #475569; margin-bottom: 12px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 16px; }
  .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; }
  .badge-blue { background: #eff6ff; color: #1d4ed8; }
  .badge-green { background: #f0fdf4; color: #15803d; }
  .badge-slate { background: #f1f5f9; color: #475569; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; }
  .btn-primary { background: #4f46e5; color: #fff; }
  .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
  .btn-sm { padding: 4px 10px; font-size: 12px; }
  input, textarea, select { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 7px; font-size: 13px; color: #1e293b; background: #fff; outline: none; }
  input:focus, textarea:focus, select:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79,70,229,0.1); }
  label { display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px; }
  .form-group { margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .sidebar { width: 220px; flex-shrink: 0; }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .gap-4 { gap: 16px; }
  .gap-2 { gap: 8px; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .text-muted { color: #94a3b8; font-size: 12px; }
  .placeholder { color: #94a3b8; font-style: italic; }
  .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 8px; }
  .empty-state { text-align: center; padding: 48px 24px; color: #94a3b8; }
`;

const SYSTEM_PROMPT = `You are a UI/UX designer who writes clean, professional HTML mockups.

Given a product spec, generate a COMPLETE self-contained HTML page that visually mockups the main user-facing screen described.

Rules:
- Output ONLY raw HTML. No markdown, no code fences, no explanation before or after.
- The page must be a full HTML document with <html>, <head>, and <body>.
- Do NOT include any <script> tags or external CDN links. CSS only.
- Use an inline <style> block in <head> for any additional custom styles beyond the base stylesheet.
- Use a clean SaaS design aesthetic: white background, slate/gray text, subtle borders.
- For accent color use #4f46e5 (indigo) for buttons and highlights.
- Show the MAIN screen for the spec — the primary user interaction surface.
- Use placeholder text for variable content: [User Name], [Date], [Description], etc.
- Mark interactive elements clearly (buttons, inputs, dropdowns) using the class names: btn btn-primary, btn btn-secondary, input, .card, .badge.
- Include a slim <nav> with class="brand" span containing "Cadence" as the product name.
- Keep the page under 250 lines.`;

export type DesignScaffold = {
  html: string;
  generatedAt: string;
};

export const generateDesignScaffold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        prdId: z.string().uuid(),
        specBody: z.string().min(40).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<DesignScaffold> => {
    const { supabase } = context;
    const userId = context.auth.user.id;

    const userMsg = `Product spec to mockup:\n\n${data.specBody.slice(0, 8000)}`;

    const res = await callModel(supabase, userId, {
      surface: "prd",
      surface_ref: `design-scaffold:${data.prdId}`,
      model: "google/gemini-2.5-flash",
      fallbackModel: "anthropic/claude-haiku-4-5-20251001",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    });

    // Strip any accidental markdown code fences the model may add despite instructions
    let html = (res.output ?? "").trim();
    html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    // Remove any external CDN script/link tags the model may emit; inject our
    // own controlled inline stylesheet so no external resources are loaded.
    html = html.replace(/<script[^>]*src=[^>]*cdn[^>]*><\/script>/gi, "");
    html = html.replace(/<link[^>]*cdn[^>]*>/gi, "");

    const styleTag = `<style>${MOCKUP_CSS}</style>`;

    if (html.toLowerCase().includes("<head>")) {
      html = html.replace(/<head>/i, `<head>${styleTag}`);
    } else if (html.toLowerCase().includes("<html")) {
      // Bare html tag without head — inject after opening html tag
      html = html.replace(/<html[^>]*>/i, (m) => `${m}<head>${styleTag}</head>`);
    } else {
      // Bare fragment — wrap in a minimal document
      html = `<!DOCTYPE html><html><head>${styleTag}</head><body>${html}</body></html>`;
    }

    return { html, generatedAt: new Date().toISOString() };
  });
