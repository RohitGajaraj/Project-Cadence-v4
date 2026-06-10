import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NOTION_GATEWAY = "https://connector-gateway.lovable.dev/notion/v1";

function headers() {
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

type TTMark = { type: string; attrs?: Record<string, unknown> };
type TTNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TTNode[];
  marks?: TTMark[];
  text?: string;
};

type NRich = {
  plain_text?: string;
  text?: { content?: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
  href?: string | null;
};
type NBlock = {
  id: string;
  type: string;
  paragraph?: { rich_text: NRich[] };
  heading_1?: { rich_text: NRich[] };
  heading_2?: { rich_text: NRich[] };
  heading_3?: { rich_text: NRich[] };
  bulleted_list_item?: { rich_text: NRich[] };
  numbered_list_item?: { rich_text: NRich[] };
  to_do?: { rich_text: NRich[]; checked?: boolean };
  quote?: { rich_text: NRich[] };
  code?: { rich_text: NRich[]; language?: string };
};
type NPage = {
  id: string;
  url?: string;
  icon?: { type?: string; emoji?: string } | null;
  properties?: Record<string, { type?: string; title?: NRich[] }>;
};

function extractPageId(input: string): string | null {
  const s = input.trim();
  // Notion IDs are 32 hex chars, often dashed as 8-4-4-4-12.
  const dashed = s.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (dashed) return dashed[1];
  const url = s.match(/([0-9a-f]{32})(?:[?#]|$)/i);
  if (url) {
    const id = url[1];
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  }
  if (/^[0-9a-f]{32}$/i.test(s)) {
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  }
  return null;
}

async function nGet<T>(path: string): Promise<T> {
  const res = await fetch(`${NOTION_GATEWAY}${path}`, { headers: headers() });
  const body = await res.text();
  if (!res.ok) throw new Error(`Notion GET ${path} failed [${res.status}]: ${body.slice(0, 400)}`);
  return JSON.parse(body) as T;
}
async function nPost<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${NOTION_GATEWAY}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Notion POST ${path} failed [${res.status}]: ${body.slice(0, 400)}`);
  return JSON.parse(body) as T;
}

function rtToTiptap(rt: NRich[] | undefined): TTNode[] {
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

function blockToTiptap(b: NBlock): TTNode | null {
  switch (b.type) {
    case "paragraph":
      return { type: "paragraph", content: rtToTiptap(b.paragraph?.rich_text) };
    case "heading_1":
      return { type: "heading", attrs: { level: 1 }, content: rtToTiptap(b.heading_1?.rich_text) };
    case "heading_2":
      return { type: "heading", attrs: { level: 2 }, content: rtToTiptap(b.heading_2?.rich_text) };
    case "heading_3":
      return { type: "heading", attrs: { level: 3 }, content: rtToTiptap(b.heading_3?.rich_text) };
    case "bulleted_list_item":
      return {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: rtToTiptap(b.bulleted_list_item?.rich_text) }],
          },
        ],
      };
    case "numbered_list_item":
      return {
        type: "orderedList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: rtToTiptap(b.numbered_list_item?.rich_text) }],
          },
        ],
      };
    case "to_do":
      return {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: !!b.to_do?.checked },
            content: [{ type: "paragraph", content: rtToTiptap(b.to_do?.rich_text) }],
          },
        ],
      };
    case "quote":
      return {
        type: "blockquote",
        content: [{ type: "paragraph", content: rtToTiptap(b.quote?.rich_text) }],
      };
    case "code":
      return {
        type: "codeBlock",
        attrs: { language: b.code?.language ?? null },
        content: rtToTiptap(b.code?.rich_text),
      };
    case "divider":
      return { type: "horizontalRule" };
    default:
      return null;
  }
}

function pageTitle(p: NPage): string {
  const props = p.properties ?? {};
  for (const k of Object.keys(props)) {
    const v = props[k];
    if (v?.type === "title" && Array.isArray(v.title)) {
      return v.title
        .map((t) => t.plain_text ?? t.text?.content ?? "")
        .join("")
        .trim();
    }
  }
  return "Untitled";
}

function extractText(n: TTNode): string {
  if (n.text) return n.text;
  if (n.content)
    return n.content
      .map(extractText)
      .join(n.type === "paragraph" || n.type === "heading" ? "\n" : "");
  return "";
}

async function fetchAllChildren(blockId: string): Promise<NBlock[]> {
  const all: NBlock[] = [];
  let cursor: string | undefined;
  do {
    const qs = cursor
      ? `?start_cursor=${encodeURIComponent(cursor)}&page_size=100`
      : `?page_size=100`;
    const data = await nGet<{ results: NBlock[]; has_more?: boolean; next_cursor?: string | null }>(
      `/blocks/${encodeURIComponent(blockId)}/children${qs}`,
    );
    all.push(...(data.results ?? []));
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return all;
}

// ---------- Server functions ----------

export const searchNotionPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ query: z.string().max(200).optional() }).parse(i))
  .handler(async ({ data }) => {
    const res = await nPost<{ results: NPage[] }>(`/search`, {
      query: data.query ?? "",
      filter: { value: "page", property: "object" },
      page_size: 25,
    });
    const pages = (res.results ?? []).map((p) => ({
      id: p.id,
      title: pageTitle(p),
      url: p.url ?? null,
      icon: p.icon?.emoji ?? null,
    }));
    return { pages };
  });

export const importNotionPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        urlOrId: z.string().min(8).max(500),
        parent_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const pageId = extractPageId(data.urlOrId);
    if (!pageId) throw new Error("Could not parse a Notion page ID from input");

    const page = await nGet<NPage>(`/pages/${encodeURIComponent(pageId)}`);
    const title = (pageTitle(page) || "Untitled").slice(0, 200);
    const icon = page.icon?.emoji ?? "📄";
    const children = await fetchAllChildren(pageId);
    const nodes: TTNode[] = [];
    for (const b of children) {
      const n = blockToTiptap(b);
      if (n) nodes.push(n);
    }
    const tiptap: TTNode = { type: "doc", content: nodes.length ? nodes : [{ type: "paragraph" }] };
    const text = extractText(tiptap).slice(0, 50000);

    const { data: row, error } = await supabase
      .from("docs")
      .insert({
        user_id: userId,
        title,
        parent_id: data.parent_id ?? null,
        icon,
        content_json: tiptap as never,
        content_text: text,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("sync_mappings").insert({
      user_id: userId,
      provider: "notion",
      local_kind: "doc",
      local_id: row.id,
      external_id: pageId,
      external_url: page.url ?? `https://www.notion.so/${pageId.replace(/-/g, "")}`,
      last_pulled_at: new Date().toISOString(),
      version_remote: 1,
    } as never);

    return { doc: row };
  });
