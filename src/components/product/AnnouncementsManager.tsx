// L2b-2 — the in-app announcement authoring UI (the "Ship" surface, per the
// home-and-today-ia rubric: ship -> Product > Releases). It wires the already
// verified `announcements.functions.ts` server fns onto an EXISTING route (the
// Product Releases tab), so it adds no route and never churns routeTree.gen.ts.
//
// Governance is the DB's job (the published-only RLS policy + the SECURITY
// DEFINER `publish_announcement` RPC that re-checks owner/admin); the role gates
// here are UX-only and are derived from the SAME `TRANSITION_ROLES` table the DB
// mirrors, so the button visibility can never disagree with what the server will
// allow. A tampered client still cannot publish — the RPC rejects it.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Megaphone, Pencil, Send, Check, X } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  submitForApproval,
  approveAndPublish,
  type AnnouncementRow,
} from "@/lib/announcements.functions";
import { listWorkspaceMembers } from "@/lib/workspaces.functions";
import { TRANSITION_ROLES, type WorkspaceRole } from "@/lib/announcements";
import { MonoLabel, VerdictChip, type VerdictTone } from "@/components/cadence/Primitives";
import { toast } from "@/lib/notify";
import { relTime } from "./format";

/** Status -> verdict-chip tone (a rendered classification, not live state). */
const STATUS_TONE: Record<AnnouncementRow["status"], VerdictTone> = {
  draft: "ember",
  pending: "saffron",
  published: "moss",
};

export function AnnouncementsManager() {
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();

  const fList = useServerFn(listAnnouncements);
  const fMembers = useServerFn(listWorkspaceMembers);
  const fCreate = useServerFn(createAnnouncement);
  const fUpdate = useServerFn(updateAnnouncement);
  const fSubmit = useServerFn(submitForApproval);
  const fPublish = useServerFn(approveAndPublish);

  const wid = activeWorkspaceId ?? "";
  const listQ = useQuery({
    queryKey: ["announcements", wid],
    queryFn: () => fList({ data: { workspaceId: wid } }),
    enabled: !!wid,
  });
  // selfRole gates the buttons; the members fn is the proven RLS-safe source.
  const roleQ = useQuery({
    queryKey: ["workspace-members", wid],
    queryFn: () => fMembers({ data: { id: wid } }),
    enabled: !!wid,
  });

  const role = (roleQ.data?.selfRole ?? null) as WorkspaceRole | null;
  const canContribute = !!role && TRANSITION_ROLES["draft->pending"].includes(role);
  const canPublish = !!role && TRANSITION_ROLES["pending->published"].includes(role);

  const [composing, setComposing] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["announcements", wid] });

  const createMut = useMutation({
    mutationFn: () =>
      fCreate({ data: { workspaceId: wid, title: newTitle.trim(), body: newBody } }),
    onSuccess: () => {
      toast.success("Draft created");
      setNewTitle("");
      setNewBody("");
      setComposing(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; title: string; body: string }) =>
      fUpdate({ data: { id: vars.id, title: vars.title.trim(), body: vars.body } }),
    onSuccess: () => {
      toast.success("Saved");
      setEditId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => fSubmit({ data: { id, workspaceId: wid } }),
    onSuccess: () => {
      toast.success("Submitted for approval");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMut = useMutation({
    mutationFn: (id: string) => fPublish({ data: { id, workspaceId: wid } }),
    onSuccess: () => {
      toast.success("Published");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!activeWorkspaceId) return null;

  const rows = listQ.data?.announcements ?? [];
  const busy =
    createMut.isPending || updateMut.isPending || submitMut.isPending || publishMut.isPending;

  function startEdit(a: AnnouncementRow) {
    setEditId(a.id);
    setEditTitle(a.title);
    setEditBody(a.body);
  }

  return (
    <div className="bento" style={{ padding: "var(--card-pad)", marginBottom: 14 }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
      >
        <MonoLabel icon={Megaphone}>Announcements</MonoLabel>
        {canContribute ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => setComposing((v) => !v)}
          >
            {composing ? "Close" : "New announcement"}
          </button>
        ) : null}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-faint)", lineHeight: 1.4 }}>
        Customer-facing posts. Drafts stay private to the workspace; a published post is public at{" "}
        <span style={{ fontFamily: "var(--font-mono)" }}>/p/&lt;slug&gt;</span>. Owners and admins
        publish.
      </p>

      {composing ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid var(--hairline)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <input
            className="input"
            placeholder="Title"
            value={newTitle}
            maxLength={200}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            className="input"
            placeholder="What changed for your customers…"
            value={newBody}
            maxLength={20000}
            rows={4}
            style={{ resize: "vertical", fontFamily: "inherit" }}
            onChange={(e) => setNewBody(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!newTitle.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? "Creating…" : "Create draft"}
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        {listQ.isLoading ? (
          <div style={{ fontSize: 12.5, color: "var(--ink-faint)", padding: "16px 0" }}>
            Loading announcements…
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-faint)",
              fontStyle: "italic",
              padding: "12px 0",
            }}
          >
            No announcements yet. {canContribute ? "Draft one to tell customers what shipped." : ""}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((a) =>
              editId === a.id ? (
                <div
                  key={a.id}
                  style={{
                    padding: 12,
                    border: "1px solid var(--hairline)",
                    borderRadius: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <input
                    className="input"
                    value={editTitle}
                    maxLength={200}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                  <textarea
                    className="input"
                    value={editBody}
                    maxLength={20000}
                    rows={4}
                    style={{ resize: "vertical", fontFamily: "inherit" }}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditId(null)}
                    >
                      <X size={12} /> Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!editTitle.trim() || updateMut.isPending}
                      onClick={() =>
                        updateMut.mutate({ id: a.id, title: editTitle, body: editBody })
                      }
                    >
                      <Check size={12} /> {updateMut.isPending ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={a.id}
                  className="bento"
                  style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 12 }}
                >
                  <VerdictChip tone={STATUS_TONE[a.status]}>{a.status}</VerdictChip>
                  <span
                    className="truncate"
                    style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500 }}
                  >
                    {a.title}
                  </span>
                  <span className="mono-label" style={{ color: "var(--ink-faint)" }}>
                    {relTime(a.published_at ?? a.submitted_at ?? a.created_at)}
                  </span>
                  {/* draft/pending stay editable for contributors (RLS scopes the write) */}
                  {a.status !== "published" && canContribute ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => startEdit(a)}
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  ) : null}
                  {a.status === "draft" && canContribute ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() => submitMut.mutate(a.id)}
                    >
                      <Send size={11} /> Submit
                    </button>
                  ) : null}
                  {a.status === "pending" && canPublish ? (
                    <button
                      type="button"
                      className="btn btn-approve btn-sm"
                      disabled={busy}
                      onClick={() => publishMut.mutate(a.id)}
                    >
                      <Check size={11} /> Publish
                    </button>
                  ) : null}
                  {a.status === "published" ? (
                    <a
                      href={`/p/${a.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm"
                      aria-label={`View ${a.title} public page`}
                    >
                      View <ExternalLink size={11} />
                    </a>
                  ) : null}
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
