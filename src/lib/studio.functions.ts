import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callModel } from "@/lib/ai/runtime.server";

const STARTER_INDEX = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Prototype</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main>
    <h1>New prototype</h1>
    <p>Edit files on the left, click <strong>Run</strong> to preview.</p>
    <button id="b">Click me</button>
  </main>
  <script src="app.js"></script>
</body>
</html>`;

const STARTER_CSS = `:root { color-scheme: dark; --bg:#0b0b12; --fg:#e9e9f2; --accent:#8b5cf6; }
* { box-sizing: border-box; }
body { margin:0; font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; background:var(--bg); color:var(--fg); min-height:100vh; display:grid; place-items:center; }
main { padding: 32px; max-width: 560px; text-align:center; }
h1 { font-size: 28px; letter-spacing: -0.02em; margin: 0 0 12px; }
button { margin-top: 16px; padding: 10px 16px; border-radius: 10px; border: 1px solid #2a2a3a; background: var(--accent); color: white; cursor: pointer; }
button:hover { filter: brightness(1.1); }`;

const STARTER_JS = `document.getElementById("b")?.addEventListener("click", () => {
  alert("Hello from your prototype 👋");
});`;

type TemplateKey = "blank" | "landing" | "pricing" | "dashboard" | "form";

function templateFiles(t: TemplateKey): { path: string; content: string; language: string }[] {
  const css = STARTER_CSS;
  if (t === "landing") {
    return [
      { path: "index.html", language: "html", content: `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Landing</title><link rel="stylesheet" href="styles.css"/></head><body><header><div class="logo">◈ Brand</div><nav><a href="#features">Features</a><a href="#cta">Get started</a></nav></header><main><section class="hero"><h1>Ship the idea, not the meeting.</h1><p>A landing page template you can iterate with chat.</p><a class="btn" href="#cta">Start free</a></section><section id="features" class="grid"><div class="card"><h3>Fast</h3><p>Edge-rendered. Zero config.</p></div><div class="card"><h3>Native</h3><p>Built for your team.</p></div><div class="card"><h3>Open</h3><p>Owned by you, always.</p></div></section><section id="cta" class="cta"><h2>Ready?</h2><a class="btn" href="#">Get started</a></section></main><footer>© Brand</footer><script src="app.js"></script></body></html>` },
      { path: "styles.css", language: "css", content: `:root{color-scheme:dark;--bg:#0a0a12;--fg:#eaeaf2;--muted:#9aa0b4;--accent:#8b5cf6;--card:#11111b}*{box-sizing:border-box}body{margin:0;font:15px/1.6 ui-sans-serif,system-ui;background:var(--bg);color:var(--fg)}header{display:flex;justify-content:space-between;align-items:center;padding:18px 28px;border-bottom:1px solid #1f1f2c}nav a{color:var(--muted);margin-left:18px;text-decoration:none}.hero{padding:100px 24px;text-align:center;max-width:760px;margin:0 auto}h1{font-size:48px;letter-spacing:-.02em;margin:0 0 16px}.btn{display:inline-block;padding:12px 22px;border-radius:12px;background:var(--accent);color:#fff;text-decoration:none;margin-top:8px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;max-width:980px;margin:24px auto;padding:0 24px}.card{background:var(--card);border:1px solid #1f1f2c;border-radius:14px;padding:18px}.cta{text-align:center;padding:80px 24px}footer{text-align:center;color:var(--muted);padding:28px}` },
      { path: "app.js", language: "javascript", content: `console.log("landing ready");` },
    ];
  }
  if (t === "pricing") {
    return [
      { path: "index.html", language: "html", content: `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Pricing</title><link rel="stylesheet" href="styles.css"/></head><body><main><h1>Simple pricing</h1><div class="tiers">${["Free","Pro","Team"].map((n,i)=>`<div class="tier${i===1?' featured':''}"><h3>${n}</h3><div class="price">$${[0,12,49][i]}<small>/mo</small></div><ul><li>All core features</li><li>${i?'Priority support':'Community support'}</li><li>${i===2?'SSO + audit logs':'Up to '+(i?'10':'1')+' seats'}</li></ul><a class="btn" href="#">Choose ${n}</a></div>`).join("")}</div></main></body></html>` },
      { path: "styles.css", language: "css", content: `:root{color-scheme:dark;--bg:#0a0a12;--fg:#eaeaf2;--muted:#9aa0b4;--accent:#8b5cf6;--card:#11111b}*{box-sizing:border-box}body{margin:0;font:15px/1.6 ui-sans-serif,system-ui;background:var(--bg);color:var(--fg);padding:60px 20px}h1{text-align:center;font-size:40px;letter-spacing:-.02em}.tiers{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;max-width:980px;margin:32px auto}.tier{background:var(--card);border:1px solid #1f1f2c;border-radius:16px;padding:24px}.tier.featured{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}.price{font-size:36px;margin:8px 0 16px}.price small{font-size:13px;color:var(--muted)}ul{padding-left:18px;color:var(--muted)}.btn{display:inline-block;margin-top:14px;padding:10px 18px;border-radius:10px;background:var(--accent);color:#fff;text-decoration:none}` },
      { path: "app.js", language: "javascript", content: `` },
    ];
  }
  if (t === "dashboard") {
    return [
      { path: "index.html", language: "html", content: `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>Dashboard</title><link rel="stylesheet" href="styles.css"/></head><body><aside><div class="logo">◈</div><nav><a class="active">Overview</a><a>Users</a><a>Revenue</a><a>Settings</a></nav></aside><main><header><h1>Overview</h1><div class="user">PM</div></header><section class="kpis"><div class="kpi"><div class="lbl">MRR</div><div class="val">$24.8k</div></div><div class="kpi"><div class="lbl">Active</div><div class="val">1,284</div></div><div class="kpi"><div class="lbl">Churn</div><div class="val">2.1%</div></div></section><section class="card"><h3>Recent activity</h3><ul id="feed"></ul></section></main><script src="app.js"></script></body></html>` },
      { path: "styles.css", language: "css", content: `:root{color-scheme:dark;--bg:#0a0a12;--fg:#eaeaf2;--muted:#9aa0b4;--accent:#8b5cf6;--card:#11111b;--line:#1f1f2c}*{box-sizing:border-box}body{margin:0;font:14px/1.5 ui-sans-serif,system-ui;background:var(--bg);color:var(--fg);display:grid;grid-template-columns:220px 1fr;min-height:100vh}aside{border-right:1px solid var(--line);padding:18px}aside .logo{font-size:22px;margin-bottom:18px}nav{display:flex;flex-direction:column;gap:6px}nav a{color:var(--muted);padding:8px 10px;border-radius:8px;cursor:pointer}nav a.active{color:var(--fg);background:#161623}main{padding:22px 28px}header{display:flex;justify-content:space-between;align-items:center}.user{width:28px;height:28px;border-radius:50%;background:var(--accent);display:grid;place-items:center;font-size:11px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:18px 0}.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}.lbl{color:var(--muted);font-size:12px}.val{font-size:22px;margin-top:4px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}#feed{list-style:none;padding:0;margin:10px 0 0}#feed li{padding:8px 0;border-bottom:1px solid var(--line);color:var(--muted)}` },
      { path: "app.js", language: "javascript", content: `const feed=document.getElementById("feed");["Acme upgraded to Pro","New signup: maya@orbit.io","Refund issued: $24","Webhook retried"].forEach(t=>{const li=document.createElement("li");li.textContent=t;feed.appendChild(li)});` },
    ];
  }
  if (t === "form") {
    return [
      { path: "index.html", language: "html", content: `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>Form</title><link rel="stylesheet" href="styles.css"/></head><body><main><h1>Get in touch</h1><form id="f"><label>Name<input name="name" required/></label><label>Email<input type="email" name="email" required/></label><label>Message<textarea name="msg" rows="5" required></textarea></label><button>Send</button><div id="ok" hidden>Thanks — we'll be in touch.</div></form></main><script src="app.js"></script></body></html>` },
      { path: "styles.css", language: "css", content: `:root{color-scheme:dark;--bg:#0a0a12;--fg:#eaeaf2;--muted:#9aa0b4;--accent:#8b5cf6;--card:#11111b;--line:#1f1f2c}*{box-sizing:border-box}body{margin:0;font:15px/1.6 ui-sans-serif,system-ui;background:var(--bg);color:var(--fg);display:grid;place-items:center;min-height:100vh}main{width:min(440px,92vw)}h1{font-size:28px;margin:0 0 16px}form{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;display:grid;gap:12px}label{display:grid;gap:6px;font-size:12px;color:var(--muted)}input,textarea{background:#0e0e18;border:1px solid var(--line);border-radius:10px;padding:10px;color:var(--fg);font:inherit}button{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:11px;font-weight:600;cursor:pointer}#ok{color:#34d399}` },
      { path: "app.js", language: "javascript", content: `document.getElementById("f").addEventListener("submit",e=>{e.preventDefault();document.getElementById("ok").hidden=false;e.target.reset()});` },
    ];
  }
  return [
    { path: "index.html", language: "html", content: STARTER_INDEX },
    { path: "styles.css", language: "css", content: css },
    { path: "app.js", language: "javascript", content: STARTER_JS },
  ];
}

export const listPrototypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prototypes")
      .select("id,name,description,share_slug,is_public,prd_id,updated_at,created_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { prototypes: data ?? [] };
  });

export const createPrototype = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      name: z.string().min(1).max(120),
      description: z.string().max(2000).optional().default(""),
      prd_id: z.string().uuid().nullable().optional(),
      template: z.enum(["blank","landing","pricing","dashboard","form"]).optional().default("blank"),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: proto, error } = await supabase
      .from("prototypes")
      .insert({ user_id: userId, name: data.name, description: data.description, prd_id: data.prd_id ?? null })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const files = templateFiles(data.template).map((f) => ({ ...f, prototype_id: proto.id, user_id: userId }));
    const { error: e2 } = await supabase.from("prototype_files").insert(files);
    if (e2) throw new Error(e2.message);
    return { id: proto.id };
  });

export const getPrototype = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const [{ data: proto, error: e1 }, { data: files, error: e2 }] = await Promise.all([
      context.supabase.from("prototypes").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("prototype_files").select("*").eq("prototype_id", data.id).order("path"),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    if (!proto) throw new Error("Prototype not found");
    return { prototype: proto, files: files ?? [] };
  });

export const saveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      prototype_id: z.string().uuid(),
      path: z.string().min(1).max(200),
      content: z.string().max(500_000),
      language: z.string().max(40).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const language = data.language ?? guessLang(data.path);
    const { error } = await supabase
      .from("prototype_files")
      .upsert(
        { prototype_id: data.prototype_id, user_id: userId, path: data.path, content: data.content, language },
        { onConflict: "prototype_id,path" },
      );
    if (error) throw new Error(error.message);
    await supabase.from("prototypes").update({ updated_at: new Date().toISOString() }).eq("id", data.prototype_id);
    return { ok: true };
  });

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ prototype_id: z.string().uuid(), path: z.string() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("prototype_files")
      .delete()
      .eq("prototype_id", data.prototype_id)
      .eq("path", data.path);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const togglePublic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), is_public: z.boolean() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("prototypes")
      .update({ is_public: data.is_public })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Cursor-style multi-file AI edit ----------

export const aiEditPrototype = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      prototype_id: z.string().uuid(),
      instruction: z.string().min(3).max(4000),
      commit: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: files, error } = await supabase
      .from("prototype_files")
      .select("path,content,language")
      .eq("prototype_id", data.prototype_id);
    if (error) throw new Error(error.message);

    const system = `You are a senior front-end engineer making surgical, multi-file edits to a small HTML/CSS/JS prototype.
Return STRICT JSON: { "changes": [{ "path": "string", "content": "FULL new file contents", "action": "create|update|delete" }], "summary": "1-2 sentences" }
Rules:
- Return the COMPLETE file content for any updated or created file (never diffs).
- Only touch files needed for the instruction. Keep everything else intact.
- Prefer vanilla HTML/CSS/JS. No build step. No external frameworks unless asked.
- Use semantic HTML and modern CSS. Keep accessibility in mind.
- For delete actions, set content to "".`;

    const user = JSON.stringify({
      instruction: data.instruction,
      files: (files ?? []).map((f) => ({ path: f.path, language: f.language, content: f.content.slice(0, 50_000) })),
    }).slice(0, 80_000);

    const result = await callModel(supabase, userId, {
      surface: "studio",
      surface_ref: data.prototype_id,
      model: "google/gemini-2.5-pro",
      fallbackModel: "google/gemini-2.5-flash",
      responseFormat: "json_object",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsed = (result.json ?? {}) as { changes?: { path: string; content: string; action?: string }[]; summary?: string };
    if (!parsed.changes) throw new Error("AI returned invalid JSON");
    const changes = (parsed.changes ?? [])
      .filter((c) => c.path && typeof c.content === "string")
      .slice(0, 30);

    if (!data.commit) {
      return { preview: { changes, summary: parsed.summary ?? "" } };
    }

    for (const c of changes) {
      const action = (c.action ?? "update").toLowerCase();
      if (action === "delete") {
        await supabase.from("prototype_files").delete().eq("prototype_id", data.prototype_id).eq("path", c.path);
      } else {
        await supabase.from("prototype_files").upsert(
          {
            prototype_id: data.prototype_id,
            user_id: userId,
            path: c.path,
            content: c.content,
            language: guessLang(c.path),
          },
          { onConflict: "prototype_id,path" },
        );
      }
    }
    await supabase.from("prototypes").update({ updated_at: new Date().toISOString() }).eq("id", data.prototype_id);
    return { committed: { changes: changes.length, summary: parsed.summary ?? "" } };
  });

function guessLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "mjs") return "javascript";
  if (ext === "ts") return "typescript";
  if (ext === "tsx") return "typescript";
  if (ext === "jsx") return "javascript";
  if (ext === "json") return "json";
  if (ext === "md") return "markdown";
  return "plaintext";
}

// ---------- Chat history ----------

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ prototype_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { data: msgs, error } = await context.supabase
      .from("prototype_messages")
      .select("*")
      .eq("prototype_id", data.prototype_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    const { data: atts } = await context.supabase
      .from("prototype_attachments")
      .select("id,name,kind,message_id,storage_path,size_bytes")
      .eq("prototype_id", data.prototype_id);
    return { messages: msgs ?? [], attachments: atts ?? [] };
  });

export const applyChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      message_id: z.string().uuid(),
      prototype_id: z.string().uuid(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: msg, error } = await supabase
      .from("prototype_messages")
      .select("*")
      .eq("id", data.message_id)
      .single();
    if (error || !msg) throw new Error("Message not found");
    const changes = (msg.changes_json as { path: string; content: string; action?: string }[]) ?? [];
    for (const c of changes) {
      const action = (c.action ?? "update").toLowerCase();
      if (action === "delete") {
        await supabase.from("prototype_files").delete()
          .eq("prototype_id", data.prototype_id).eq("path", c.path);
      } else {
        await supabase.from("prototype_files").upsert(
          { prototype_id: data.prototype_id, user_id: userId, path: c.path,
            content: c.content, language: guessLang(c.path) },
          { onConflict: "prototype_id,path" },
        );
      }
    }
    await supabase.from("prototype_messages").update({ applied: true }).eq("id", data.message_id);
    await supabase.from("prototypes").update({ updated_at: new Date().toISOString() }).eq("id", data.prototype_id);
    return { ok: true, count: changes.length };
  });

// ---------- Workspace context picker ----------

export const listContextItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [prds, opps, decs, mtgs, tasks] = await Promise.all([
      sb.from("prds").select("id,title,status").order("updated_at", { ascending: false }).limit(50),
      sb.from("opportunities").select("id,title,problem").order("updated_at", { ascending: false }).limit(50),
      sb.from("decisions").select("id,title,rationale").order("created_at", { ascending: false }).limit(50),
      sb.from("meetings").select("id,title,summary").order("start_at", { ascending: false }).limit(30),
      sb.from("tasks").select("id,title,status").order("updated_at", { ascending: false }).limit(50),
    ]);
    return {
      prds: prds.data ?? [], opportunities: opps.data ?? [],
      decisions: decs.data ?? [], meetings: mtgs.data ?? [], tasks: tasks.data ?? [],
    };
  });

export const getContextSnippets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      refs: z.array(z.object({
        kind: z.enum(["prd","opportunity","decision","meeting","task"]),
        id: z.string().uuid(),
      })).max(20),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const out: { kind: string; id: string; title: string; body: string }[] = [];
    for (const r of data.refs) {
      if (r.kind === "prd") {
        const { data: p } = await sb.from("prds").select("id,title,body_md").eq("id", r.id).maybeSingle();
        if (p) out.push({ kind: "prd", id: p.id, title: p.title, body: (p.body_md ?? "").slice(0, 6000) });
      } else if (r.kind === "opportunity") {
        const { data: p } = await sb.from("opportunities").select("id,title,problem,hypothesis,target_user").eq("id", r.id).maybeSingle();
        if (p) out.push({ kind: "opportunity", id: p.id, title: p.title,
          body: `Problem: ${p.problem}\nHypothesis: ${p.hypothesis ?? ""}\nTarget: ${p.target_user ?? ""}`.slice(0, 4000) });
      } else if (r.kind === "decision") {
        const { data: p } = await sb.from("decisions").select("id,title,rationale").eq("id", r.id).maybeSingle();
        if (p) out.push({ kind: "decision", id: p.id, title: p.title, body: (p.rationale ?? "").slice(0, 4000) });
      } else if (r.kind === "meeting") {
        const { data: p } = await sb.from("meetings").select("id,title,summary,notes").eq("id", r.id).maybeSingle();
        if (p) out.push({ kind: "meeting", id: p.id, title: p.title, body: `${p.summary ?? ""}\n${p.notes ?? ""}`.slice(0, 4000) });
      } else if (r.kind === "task") {
        const { data: p } = await sb.from("tasks").select("id,title,status,priority").eq("id", r.id).maybeSingle();
        if (p) out.push({ kind: "task", id: p.id, title: p.title, body: `Status: ${p.status} • Priority: ${p.priority}` });
      }
    }
    return { snippets: out };
  });

// ---------- Attachments (metadata; file goes to storage from client) ----------

export const recordAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      prototype_id: z.string().uuid(),
      name: z.string().min(1).max(255),
      kind: z.enum(["text","image","pdf","other"]).default("text"),
      storage_path: z.string().min(1).max(500),
      size_bytes: z.number().int().min(0).max(20_000_000),
      extracted_text: z.string().max(200_000).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("prototype_attachments")
      .insert({ ...data, user_id: userId })
      .select("id,name,kind,storage_path,size_bytes")
      .single();
    if (error) throw new Error(error.message);
    return { attachment: row };
  });