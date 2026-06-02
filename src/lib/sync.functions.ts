import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pullLinearIssue, pushLinearIssue } from "@/lib/linear.functions";

const GDOCS_GATEWAY = "https://connector-gateway.lovable.dev/google_docs/v1";
const NOTION_GATEWAY = "https://connector-gateway.lovable.dev/notion/v1";

// ---------- Types ----------
type TTMark = { type: string; attrs?: Record<string, unknown> };
type TTNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TTNode[];
  marks?: TTMark[];
  text?: string;
};

type GTextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  link?: { url?: string };
};
type GTextRun = { content?: string; textStyle?: GTextStyle };
type GParaEl = { textRun?: GTextRun };
type GParagraph = {
  elements?: GParaEl[];
  paragraphStyle?: { namedStyleType?: string };
};
type GStruct = { paragraph?: GParagraph; endIndex?: number };
type GDocument = {
  title?: string;
  body?: { content?: GStruct[] };
};

// ---------- Gateway helpers ----------
function gdocsHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const GOOGLE_DOCS_API_KEY = process.env.GOOGLE_DOCS_API_KEY;
  if (!GOOGLE_DOCS_API_KEY) throw new Error("GOOGLE_DOCS_API_KEY is not configured");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_DOCS_API_KEY,
    "Content-Type": "application/json",
  };
}

async function fetchGDoc(id: string): Promise<GDocument> {
  const res = await fetch(`${GDOCS_GATEWAY}/documents/${encodeURIComponent(id)}`, {
    headers: gdocsHeaders(),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Google Docs read failed [${res.status}]: ${body.slice(0, 400)}`);
  return JSON.parse(body) as GDocument;
}

async function batchUpdateGDoc(id: string, requests: unknown[]): Promise<void> {
  const res = await fetch(`${GDOCS_GATEWAY}/documents/${encodeURIComponent(id)}:batchUpdate`, {
    method: "POST",
    headers: gdocsHeaders(),
    body: JSON.stringify({ requests }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Google Docs write failed [${res.status}]: ${body.slice(0, 400)}`);
}

// ---------- gdoc -> tiptap ----------
function marksFromStyle(s?: GTextStyle): TTMark[] {
  if (!s) return [];
  const m: TTMark[] = [];
  if (s.bold) m.push({ type: "bold" });
  if (s.italic) m.push({ type: "italic" });
  if (s.underline) m.push({ type: "underline" });
  if (s.strikethrough) m.push({ type: "strike" });
  if (s.link?.url) m.push({ type: "link", attrs: { href: s.link.url } });
  return m;
}

function gdocsToTiptap(doc: GDocument): TTNode {
  const out: TTNode[] = [];
  for (const el of doc.body?.content ?? []) {
    const p = el.paragraph;
    if (!p) continue;
    const style = p.paragraphStyle?.namedStyleType ?? "NORMAL_TEXT";
    const children: TTNode[] = [];
    for (const e of p.elements ?? []) {
      if (e.textRun) {
        const text = (e.textRun.content ?? "").replace(/\n+$/, "");
        if (!text) continue;
        const marks = marksFromStyle(e.textRun.textStyle);
        children.push({ type: "text", text, ...(marks.length ? { marks } : {}) });
      }
    }
    const h = /^HEADING_([1-6])$/.exec(style);
    if (h) {
      out.push({
        type: "heading",
        attrs: { level: Number(h[1]) },
        content: children.length ? children : [{ type: "text", text: " " }],
      });
    } else if (children.length) {
      out.push({ type: "paragraph", content: children });
    } else {
      out.push({ type: "paragraph" });
    }
  }
  return { type: "doc", content: out.length ? out : [{ type: "paragraph" }] };
}

function extractText(n: TTNode): string {
  if (n.text) return n.text;
  if (n.content) return n.content.map(extractText).join(n.type === "paragraph" || n.type === "heading" ? "\n" : "");
  return "";
}

// ---------- tiptap -> gdoc batchUpdate requests ----------
function tiptapToBatchUpdate(doc: TTNode): unknown[] {
  const reqs: unknown[] = [];
  let idx = 1;
  const blocks = doc.content ?? [];
  for (const block of blocks) {
    const blockStart = idx;
    const inlines = block.content ?? [];
    const inlineRanges: Array<{ start: number; end: number; marks: TTMark[] }> = [];
    let buf = "";
    for (const node of inlines) {
      if (node.type !== "text" || !node.text) continue;
      const start = blockStart + buf.length;
      buf += node.text;
      const end = blockStart + buf.length;
      if (node.marks?.length) inlineRanges.push({ start, end, marks: node.marks });
    }
    const paragraphText = buf + "\n";
    if (paragraphText.length > 1 || block.type === "heading" || block.type === "paragraph") {
      reqs.push({
        insertText: { location: { index: idx }, text: paragraphText },
      });
    }
    const blockEnd = idx + paragraphText.length;

    if (block.type === "heading") {
      const level = Math.min(6, Math.max(1, Number(block.attrs?.level ?? 1)));
      reqs.push({
        updateParagraphStyle: {
          range: { startIndex: blockStart, endIndex: blockEnd },
          paragraphStyle: { namedStyleType: `HEADING_${level}` },
          fields: "namedStyleType",
        },
      });
    }

    for (const r of inlineRanges) {
      const ts: Record<string, unknown> = {};
      const fields: string[] = [];
      for (const mk of r.marks) {
        if (mk.type === "bold") { ts.bold = true; fields.push("bold"); }
        else if (mk.type === "italic") { ts.italic = true; fields.push("italic"); }
        else if (mk.type === "underline") { ts.underline = true; fields.push("underline"); }
        else if (mk.type === "strike") { ts.strikethrough = true; fields.push("strikethrough"); }
        else if (mk.type === "link" && (mk.attrs as { href?: string })?.href) {
          ts.link = { url: (mk.attrs as { href: string }).href };
          fields.push("link");
        }
      }
      if (fields.length) {
        reqs.push({
          updateTextStyle: {
            range: { startIndex: r.start, endIndex: r.end },
            textStyle: ts,
            fields: fields.join(","),
          },
        });
      }
    }

    idx = blockEnd;
  }
  return reqs;
}

function gdocBodyEndIndex(doc: GDocument): number {
  const content = doc.body?.content ?? [];
  for (let i = content.length - 1; i >= 0; i--) {
    const e = content[i].endIndex;
    if (typeof e === "number") return e;
  }
  return 1;
}

// ---------- Notion helpers ----------
function notionHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": NOTION_API_KEY,
    "Content-Type": "application/json",
  };
}

type NotionRichText = {
  type?: string;
  text?: { content?: string; link?: { url: string } | null };
  plain_text?: string;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
  href?: string | null;
};
type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  paragraph?: { rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  to_do?: { rich_text: NotionRichText[]; checked?: boolean };
  quote?: { rich_text: NotionRichText[] };
  code?: { rich_text: NotionRichText[]; language?: string };
};
type NotionPage = {
  id: string;
  properties?: Record<string, { type?: string; title?: NotionRichText[] }>;
};

async function notionGet<T>(path: string): Promise<T> {
  const res = await fetch(`${NOTION_GATEWAY}${path}`, { headers: notionHeaders() });
  const body = await res.text();
  if (!res.ok) throw new Error(`Notion GET ${path} failed [${res.status}]: ${body.slice(0, 400)}`);
  return JSON.parse(body) as T;
}
async function notionFetch(path: string, method: string, payload?: unknown): Promise<void> {
  const res = await fetch(`${NOTION_GATEWAY}${path}`, {
    method,
    headers: notionHeaders(),
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion ${method} ${path} failed [${res.status}]: ${body.slice(0, 400)}`);
  }
}

function notionRichTextToTiptap(rt: NotionRichText[]): TTNode[] {
  const out: TTNode[] = [];
  for (const r of rt ?? []) {
    const text = r.plain_text ?? r.text?.content ?? "";
    if (!text) continue;
    const marks: TTMark[] = [];
    const a = r.annotations ?? {};
    if (a.bold) marks.push({ type: "bold" });
    if (a.italic) marks.push({ type: "italic" });
    if (a.underline) marks.push({ type: "underline" });
    if (a.strikethrough) marks.push({ type: "strike" });
    if (a.code) marks.push({ type: "code" });
    const href = r.href ?? r.text?.link?.url;
    if (href) marks.push({ type: "link", attrs: { href } });
    out.push({ type: "text", text, ...(marks.length ? { marks } : {}) });
  }
  return out;
}

function notionBlockToTiptap(b: NotionBlock): TTNode | null {
  switch (b.type) {
    case "paragraph":
      return { type: "paragraph", content: notionRichTextToTiptap(b.paragraph?.rich_text ?? []) };
    case "heading_1":
      return { type: "heading", attrs: { level: 1 }, content: notionRichTextToTiptap(b.heading_1?.rich_text ?? []) };
    case "heading_2":
      return { type: "heading", attrs: { level: 2 }, content: notionRichTextToTiptap(b.heading_2?.rich_text ?? []) };
    case "heading_3":
      return { type: "heading", attrs: { level: 3 }, content: notionRichTextToTiptap(b.heading_3?.rich_text ?? []) };
    case "bulleted_list_item":
      return {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: notionRichTextToTiptap(b.bulleted_list_item?.rich_text ?? []) }] }],
      };
    case "numbered_list_item":
      return {
        type: "orderedList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: notionRichTextToTiptap(b.numbered_list_item?.rich_text ?? []) }] }],
      };
    case "to_do":
      return {
        type: "taskList",
        content: [{
          type: "taskItem",
          attrs: { checked: !!b.to_do?.checked },
          content: [{ type: "paragraph", content: notionRichTextToTiptap(b.to_do?.rich_text ?? []) }],
        }],
      };
    case "quote":
      return { type: "blockquote", content: [{ type: "paragraph", content: notionRichTextToTiptap(b.quote?.rich_text ?? []) }] };
    case "code":
      return { type: "codeBlock", attrs: { language: b.code?.language ?? null }, content: notionRichTextToTiptap(b.code?.rich_text ?? []) };
    case "divider":
      return { type: "horizontalRule" };
    default:
      return null;
  }
}

function notionPageTitle(page: NotionPage): string {
  const props = page.properties ?? {};
  for (const k of Object.keys(props)) {
    const p = props[k];
    if (p?.type === "title" && Array.isArray(p.title)) {
      return p.title.map((t) => t.plain_text ?? t.text?.content ?? "").join("").trim();
    }
  }
  return "Untitled";
}

async function fetchAllChildren(blockId: string): Promise<NotionBlock[]> {
  const all: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const qs = cursor ? `?start_cursor=${encodeURIComponent(cursor)}&page_size=100` : `?page_size=100`;
    const data = await notionGet<{ results: NotionBlock[]; has_more?: boolean; next_cursor?: string | null }>(
      `/blocks/${encodeURIComponent(blockId)}/children${qs}`,
    );
    all.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor ?? undefined : undefined;
  } while (cursor);
  return all;
}

function tiptapTextToRichText(nodes: TTNode[] | undefined): unknown[] {
  const out: unknown[] = [];
  for (const n of nodes ?? []) {
    if (n.type !== "text" || !n.text) continue;
    const annotations: Record<string, boolean> = {};
    let link: { url: string } | undefined;
    for (const m of n.marks ?? []) {
      if (m.type === "bold") annotations.bold = true;
      else if (m.type === "italic") annotations.italic = true;
      else if (m.type === "underline") annotations.underline = true;
      else if (m.type === "strike") annotations.strikethrough = true;
      else if (m.type === "code") annotations.code = true;
      else if (m.type === "link" && (m.attrs as { href?: string })?.href) {
        link = { url: (m.attrs as { href: string }).href };
      }
    }
    out.push({
      type: "text",
      text: { content: n.text, ...(link ? { link } : {}) },
      ...(Object.keys(annotations).length ? { annotations } : {}),
    });
  }
  return out;
}

function tiptapToNotionBlocks(doc: TTNode): unknown[] {
  const blocks: unknown[] = [];
  const push = (block: unknown) => blocks.push(block);
  for (const node of doc.content ?? []) {
    switch (node.type) {
      case "heading": {
        const lvl = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
        push({ object: "block", type: `heading_${lvl}`, [`heading_${lvl}`]: { rich_text: tiptapTextToRichText(node.content) } });
        break;
      }
      case "paragraph":
        push({ object: "block", type: "paragraph", paragraph: { rich_text: tiptapTextToRichText(node.content) } });
        break;
      case "bulletList":
        for (const li of node.content ?? []) {
          const inner = li.content?.[0]?.content;
          push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: tiptapTextToRichText(inner) } });
        }
        break;
      case "orderedList":
        for (const li of node.content ?? []) {
          const inner = li.content?.[0]?.content;
          push({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: tiptapTextToRichText(inner) } });
        }
        break;
      case "taskList":
        for (const li of node.content ?? []) {
          const inner = li.content?.[0]?.content;
          push({
            object: "block",
            type: "to_do",
            to_do: { rich_text: tiptapTextToRichText(inner), checked: !!li.attrs?.checked },
          });
        }
        break;
      case "blockquote":
        push({ object: "block", type: "quote", quote: { rich_text: tiptapTextToRichText(node.content?.[0]?.content) } });
        break;
      case "codeBlock":
        push({ object: "block", type: "code", code: { rich_text: tiptapTextToRichText(node.content), language: (node.attrs?.language as string) ?? "plain text" } });
        break;
      case "horizontalRule":
        push({ object: "block", type: "divider", divider: {} });
        break;
      default:
        break;
    }
  }
  return blocks;
}

async function pullNotionPage(pageId: string): Promise<{ tiptap: TTNode; title: string }> {
  const page = await notionGet<NotionPage>(`/pages/${encodeURIComponent(pageId)}`);
  const title = notionPageTitle(page).slice(0, 200) || "Untitled";
  const children = await fetchAllChildren(pageId);
  const nodes: TTNode[] = [];
  for (const b of children) {
    const n = notionBlockToTiptap(b);
    if (n) nodes.push(n);
  }
  return {
    tiptap: { type: "doc", content: nodes.length ? nodes : [{ type: "paragraph" }] },
    title,
  };
}

async function findTitlePropertyName(pageId: string): Promise<string> {
  const page = await notionGet<NotionPage>(`/pages/${encodeURIComponent(pageId)}`);
  const props = page.properties ?? {};
  for (const k of Object.keys(props)) {
    if (props[k]?.type === "title") return k;
  }
  return "title";
}

async function pushNotionPage(pageId: string, doc: TTNode, title: string): Promise<void> {
  const existing = await fetchAllChildren(pageId);
  for (const b of existing) {
    try {
      await notionFetch(`/blocks/${encodeURIComponent(b.id)}`, "DELETE");
    } catch {
      // best effort
    }
  }
  const newBlocks = tiptapToNotionBlocks(doc);
  for (let i = 0; i < newBlocks.length; i += 100) {
    const chunk = newBlocks.slice(i, i + 100);
    await notionFetch(`/blocks/${encodeURIComponent(pageId)}/children`, "PATCH", { children: chunk });
  }
  const titleProp = await findTitlePropertyName(pageId);
  await notionFetch(`/pages/${encodeURIComponent(pageId)}`, "PATCH", {
    properties: {
      [titleProp]: { title: [{ type: "text", text: { content: title.slice(0, 200) } }] },
    },
  });
}

// ---------- Server functions ----------
const IdInput = z.object({ id: z.string().uuid() });

export const pullMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdInput.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: m, error: mErr } = await supabase
      .from("sync_mappings")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (mErr || !m) throw new Error(mErr?.message ?? "Mapping not found");

    // Linear issues -> tasks
    if (m.provider === "linear" && m.local_kind === "task") {
      const r = await pullLinearIssue(m.external_id);
      const completedAt = r.status === "done" ? new Date().toISOString() : null;
      const { error: uErr } = await supabase
        .from("tasks")
        .update({
          title: r.title,
          status: r.status,
          priority: r.priority,
          completed_at: completedAt,
        })
        .eq("id", m.local_id)
        .eq("user_id", userId);
      if (uErr) throw new Error(uErr.message);
      const nowIso = new Date().toISOString();
      await supabase.from("sync_mappings").update({
        last_pulled_at: nowIso,
        version_remote: m.version_remote + 1,
        version_local: m.version_remote + 1,
        conflict: false,
        external_url: r.url,
      }).eq("id", m.id).eq("user_id", userId);
      return { ok: true, direction: "pull" as const };
    }

    if (m.local_kind !== "doc") {
      throw new Error(`Unsupported local_kind: ${m.local_kind}`);
    }

    let tiptap: TTNode;
    let title: string;
    if (m.provider === "google_docs") {
      const gdoc = await fetchGDoc(m.external_id);
      tiptap = gdocsToTiptap(gdoc);
      title = (gdoc.title ?? "Untitled").slice(0, 200);
    } else if (m.provider === "notion") {
      const r = await pullNotionPage(m.external_id);
      tiptap = r.tiptap;
      title = r.title;
    } else {
      throw new Error(`Pull not implemented for provider: ${m.provider}`);
    }
    const text = extractText(tiptap).slice(0, 50000);

    const { error: upErr } = await supabase
      .from("docs")
      .update({
        title,
        content_json: tiptap as never,
        content_text: text,
      })
      .eq("id", m.local_id)
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    const nowIso = new Date().toISOString();
    const { error: smErr } = await supabase
      .from("sync_mappings")
      .update({
        last_pulled_at: nowIso,
        version_remote: m.version_remote + 1,
        version_local: m.version_remote + 1,
        conflict: false,
      })
      .eq("id", m.id)
      .eq("user_id", userId);
    if (smErr) throw new Error(smErr.message);

    return { ok: true, direction: "pull" as const };
  });

export const pushMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => IdInput.parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: m, error: mErr } = await supabase
      .from("sync_mappings")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (mErr || !m) throw new Error(mErr?.message ?? "Mapping not found");

    if (m.provider === "linear" && m.local_kind === "task") {
      const { data: task, error: tErr } = await supabase
        .from("tasks")
        .select("title,status,priority")
        .eq("id", m.local_id)
        .eq("user_id", userId)
        .single();
      if (tErr || !task) throw new Error(tErr?.message ?? "Task not found");
      await pushLinearIssue(m.external_id, {
        title: task.title ?? undefined,
        status: (task.status as "todo" | "doing" | "done") ?? undefined,
        priority: (task.priority as "low" | "medium" | "high") ?? undefined,
      });
      const nowIso = new Date().toISOString();
      await supabase.from("sync_mappings").update({
        last_pushed_at: nowIso,
        version_local: m.version_local + 1,
        version_remote: m.version_local + 1,
        conflict: false,
      }).eq("id", m.id).eq("user_id", userId);
      return { ok: true, direction: "push" as const };
    }

    if (m.local_kind !== "doc") {
      throw new Error(`Unsupported local_kind: ${m.local_kind}`);
    }

    const { data: doc, error: dErr } = await supabase
      .from("docs")
      .select("title,content_json")
      .eq("id", m.local_id)
      .eq("user_id", userId)
      .single();
    if (dErr || !doc) throw new Error(dErr?.message ?? "Doc not found");

    if (m.provider === "google_docs") {
      const remote = await fetchGDoc(m.external_id);
      const endIndex = gdocBodyEndIndex(remote);
      const requests: unknown[] = [];
      if (endIndex > 2) {
        requests.push({
          deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } },
        });
      }
      const insertReqs = tiptapToBatchUpdate(doc.content_json as TTNode);
      requests.push(...insertReqs);
      if (requests.length > 0) await batchUpdateGDoc(m.external_id, requests);
    } else if (m.provider === "notion") {
      await pushNotionPage(m.external_id, doc.content_json as TTNode, doc.title ?? "Untitled");
    } else {
      throw new Error(`Push not implemented for provider: ${m.provider}`);
    }

    const nowIso = new Date().toISOString();
    const { error: smErr } = await supabase
      .from("sync_mappings")
      .update({
        last_pushed_at: nowIso,
        version_local: m.version_local + 1,
        version_remote: m.version_local + 1,
        conflict: false,
      })
      .eq("id", m.id)
      .eq("user_id", userId);
    if (smErr) throw new Error(smErr.message);

    return { ok: true, direction: "push" as const };
  });