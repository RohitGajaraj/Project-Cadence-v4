import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ScrollText,
  Gavel,
  Zap,
  User,
  Bot,
  History,
  Link2,
  Search,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/cadence/AppShell";
import { TopBar } from "@/components/cadence/TopBar";
import { SurfaceHeader, TabRow, EmptyState, MonoLabel } from "@/components/cadence/Primitives";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  listTrustReceipts,
  getLedgerSeal,
  verifyLedgerSeal,
  type TrustReceipt,
} from "@/lib/trust-ledger.functions";
import { setDecisionShared } from "@/lib/decisions-share.functions";
import { shortHead } from "@/lib/trust-verify";

export const Route = createFileRoute("/_authenticated/trust-ledger")({
  component: TrustLedgerPage,
});

type Kind = "all" | "decision" | "action";
type Outcome = "all" | "standing" | "superseded";

/** "3d ago" / "2h ago" / "just now" from an ISO stamp. */
function relTime(iso: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  if (ms < 60_000) return "just now";
  const d = Math.round(ms / 86_400_000);
  const h = Math.round(ms / 3_600_000);
  const m = Math.round(ms / 60_000);
  if (d >= 1) return `${d}d ago`;
  if (h >= 1) return `${h}h ago`;
  return `${m}m ago`;
}

const STATUS_COLOR: Record<string, string> = {
  approved: "var(--emerald)",
  executed: "var(--emerald)",
  auto_approved: "var(--emerald)",
  rejected: "var(--rose)",
  failed: "var(--rose)",
  cancelled: "var(--ink-faint)",
  expired: "var(--ink-faint)",
  pending: "var(--ink-subtle)",
};

function OutcomePill({
  outcome,
  supersededBy,
}: {
  outcome: TrustReceipt["outcome"];
  supersededBy: string | null;
}) {
  const superseded = outcome === "superseded";
  return (
    <span
      title={superseded && supersededBy ? `Superseded by ${supersededBy.slice(0, 8)}` : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "2px 8px",
        borderRadius: 999,
        color: superseded ? "var(--ink-subtle)" : "var(--emerald)",
        background: superseded
          ? "var(--soft-stone)"
          : "color-mix(in srgb, var(--emerald) 12%, transparent)",
        border: `1px solid ${superseded ? "var(--hairline)" : "color-mix(in srgb, var(--emerald) 30%, transparent)"}`,
      }}
    >
      {superseded ? <History size={10} strokeWidth={2} /> : null}
      {superseded ? "Superseded" : "Standing"}
    </span>
  );
}

/**
 * TRUST-SHARE: publish a decision's receipt as a public provenance artifact.
 * The publish act is USER-INITIATED (a click), per the v11 ruling that sharing is
 * outward-facing — nothing auto-publishes. On success it surfaces the public
 * `/d/<slug>` link to copy (what a PM forwards to their VP).
 */
function ShareControl({ decisionId }: { decisionId: string }) {
  const fShare = useServerFn(setDecisionShared);
  const [copied, setCopied] = useState(false);
  const m = useMutation({ mutationFn: () => fShare({ data: { id: decisionId, isPublic: true } }) });

  const slug = m.data?.share_slug ?? null;
  const link =
    slug && typeof window !== "undefined"
      ? `${window.location.origin}/d/${slug}`
      : slug
        ? `/d/${slug}`
        : null;

  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: "var(--ink-subtle)",
    background: "transparent",
    border: "1px solid var(--hairline)",
    borderRadius: 99,
    padding: "2px 8px",
    cursor: "pointer",
  };

  if (link) {
    return (
      <button
        type="button"
        title={link}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — the link is in the title for manual copy */
          }
        }}
        style={chip}
      >
        {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={1.8} />}
        {copied ? "Link copied" : "Copy public link"}
      </button>
    );
  }
  if (m.data && m.data.available === false) {
    return (
      <span
        style={{ ...chip, cursor: "default", color: "var(--ink-faint)" }}
        title="Sharing lands on the next deploy"
      >
        Sharing not available yet
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => m.mutate()}
      disabled={m.isPending}
      style={{ ...chip, opacity: m.isPending ? 0.6 : 1 }}
    >
      <Share2 size={11} strokeWidth={1.8} />
      {m.isPending ? "Sharing…" : m.isError ? "Retry share" : "Share"}
    </button>
  );
}

function ReceiptCard({ r }: { r: TrustReceipt }) {
  const KindIcon = r.kind === "decision" ? Gavel : Zap;
  const statusColor = STATUS_COLOR[r.status] ?? "var(--ink-subtle)";
  const decidedBy = r.humanDecided
    ? { Icon: User, label: "approved by you" }
    : { Icon: Bot, label: r.actor ? `${r.actor}` : "agent" };
  return (
    <article
      className="bento receipt-card"
      data-superseded={r.outcome === "superseded" ? "true" : undefined}
      style={{
        padding: "16px 18px",
        opacity: r.outcome === "superseded" ? 0.72 : 1,
        borderLeft: `2px solid ${r.outcome === "superseded" ? "var(--hairline)" : "var(--ember)"}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            width: 30,
            height: 30,
            flexShrink: 0,
            borderRadius: 9,
            background: "var(--soft-stone)",
            color: "var(--ink-subtle)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <KindIcon size={15} strokeWidth={1.9} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>{r.title}</span>
            <OutcomePill outcome={r.outcome} supersededBy={r.supersededBy} />
          </div>
          {r.rationale ? (
            <p
              style={{
                fontSize: 12.5,
                color: "var(--ink-muted, #4a443c)",
                lineHeight: 1.5,
                marginTop: 5,
              }}
            >
              {r.rationale}
            </p>
          ) : (
            <p
              style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 5, fontStyle: "italic" }}
            >
              No rationale recorded.
            </p>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              marginTop: 10,
            }}
          >
            <MonoLabel icon={decidedBy.Icon} style={{ fontSize: 10.5 }}>
              {decidedBy.label}
            </MonoLabel>
            <span
              className="tabular-nums"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: statusColor,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {r.status}
            </span>
            {r.source.label ? (
              <MonoLabel icon={Link2} style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>
                {r.source.kind ? `${r.source.kind}: ` : ""}
                {r.source.label}
              </MonoLabel>
            ) : null}
            {r.evidenceCount > 0 ? (
              <span
                className="tabular-nums"
                style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)" }}
                title="Provenance edges linked to this record"
              >
                {r.evidenceCount} evidence
              </span>
            ) : null}
            {/* TRUST-SHARE: only decisions are publicly shareable (reuse /d/$slug). */}
            {r.kind === "decision" ? <ShareControl decisionId={r.id} /> : null}
            <span
              style={{
                marginLeft: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--ink-faint)",
              }}
            >
              {relTime(r.occurredAt)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * TRUST-VERIFY (#26): the integrity check. Shows a SHA-256 FINGERPRINT (a plain
 * checksum, NOT a blockchain) of the whole decision-and-outcome record — what a user
 * SAVES now and re-checks later to confirm the ledger has not changed. "Verify" checks
 * the current record against a fingerprint saved earlier. Available to every user.
 * Calm chrome: one quiet bar, the check revealed on demand. (An optional signed mode
 * and saving the fingerprint at write time are possible later add-ons.)
 */
function SealPanel() {
  const fSeal = useServerFn(getLedgerSeal);
  const fVerify = useServerFn(verifyLedgerSeal);
  const sealQ = useQuery({ queryKey: ["ledger-seal"], queryFn: () => fSeal({ data: {} }) });
  const verify = useMutation({
    mutationFn: (head: string) => fVerify({ data: { head: head.trim() } }),
  });
  const [open, setOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);

  const seal = sealQ.data;
  // Hide when there is nothing to fingerprint: an empty ledger hashes to a fixed
  // genesis constant (identical across workspaces), so showing it would offer a
  // meaningless "match" — guard on count === 0.
  if (!seal || seal.available === false || !seal.head || seal.count === 0) return null;

  const v = verify.data;

  return (
    <section
      className="bento"
      style={{ padding: "12px 16px", marginBottom: 18, background: "var(--surface-1, #fff)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <ShieldCheck size={15} strokeWidth={1.9} color="var(--emerald)" />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>
          Integrity check
        </span>
        <span
          className="tabular-nums"
          title={seal.head}
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-subtle)" }}
        >
          {shortHead(seal.head)}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)" }}>
          {seal.count} record{seal.count === 1 ? "" : "s"} · as of {relTime(seal.sealedAt)}
        </span>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(seal.head);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard blocked — the full head is in the title attribute */
              }
            }}
            style={chipStyle}
            title="Copy the full fingerprint to save it"
          >
            {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={1.8} />}
            {copied ? "Copied" : "Copy fingerprint"}
          </button>
          <button type="button" onClick={() => setOpen((o) => !o)} style={chipStyle}>
            {open ? "Close" : "Verify"}
          </button>
        </span>
      </div>

      {open ? (
        <div
          style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
        >
          <input
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="Paste a fingerprint you saved earlier"
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 220,
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              padding: "7px 10px",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--ink)",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => paste.trim() && verify.mutate(paste)}
            disabled={verify.isPending || paste.trim().length < 8}
            style={{
              ...chipStyle,
              opacity: verify.isPending || paste.trim().length < 8 ? 0.55 : 1,
            }}
          >
            {verify.isPending ? "Checking…" : "Check"}
          </button>
          {v ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: v.ok ? "var(--emerald)" : "var(--rose)",
              }}
            >
              {v.ok ? (
                <Check size={13} strokeWidth={2.2} />
              ) : (
                <AlertTriangle size={13} strokeWidth={2} />
              )}
              {v.ok
                ? "Unchanged. Your ledger matches this fingerprint."
                : `Changed: ${v.reason ?? "the ledger no longer matches this fingerprint"}.`}
            </span>
          ) : verify.isError ? (
            <span style={{ fontSize: 12, color: "var(--rose)" }}>Could not verify. Try again.</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--ink-subtle)",
  background: "transparent",
  border: "1px solid var(--hairline)",
  borderRadius: 99,
  padding: "3px 9px",
  cursor: "pointer",
};

function TrustLedgerPage() {
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>("all");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [q, setQ] = useState("");

  const fList = useServerFn(listTrustReceipts);
  const query = useQuery({
    queryKey: ["trust-receipts", kind, outcome, q],
    queryFn: () => fList({ data: { kind, outcome, q: q.trim() || undefined } }),
  });

  const receipts = query.data?.receipts ?? [];
  const counts = query.data?.counts ?? { all: 0, standing: 0, superseded: 0 };

  const kindTabs = useMemo(
    () => [
      { id: "all", label: "All" },
      { id: "decision", label: "Decisions" },
      { id: "action", label: "Actions" },
    ],
    [],
  );

  return (
    <AppShell>
      <TopBar crumbs={[activeWorkspace?.name ?? "Workspace", "Trust Ledger"]} />
      <div
        data-screen-label="Trust Ledger"
        style={{ padding: "30px 44px 56px", maxWidth: 880, margin: "0 auto" }}
      >
        <SurfaceHeader
          kicker="Govern · Trust"
          icon={ScrollText}
          title="Trust Ledger"
          sub="Every decision and autonomous action, as a receipt: what changed, why, the evidence, who approved it and when, and whether it still stands or was superseded."
        />

        <SealPanel />

        <TabRow tabs={kindTabs} active={kind} onSet={(id) => setKind(id as Kind)} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div
            role="group"
            aria-label="Filter by outcome"
            style={{
              display: "inline-flex",
              gap: 2,
              padding: 2,
              background: "var(--soft-stone)",
              borderRadius: 8,
            }}
          >
            {(["all", "standing", "superseded"] as Outcome[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOutcome(o)}
                aria-pressed={outcome === o}
                className="tabular-nums"
                style={{
                  fontSize: 11.5,
                  padding: "4px 11px",
                  borderRadius: 6,
                  textTransform: "capitalize",
                  color: outcome === o ? "var(--ink)" : "var(--ink-subtle)",
                  background: outcome === o ? "var(--surface, #fff)" : "transparent",
                  fontWeight: outcome === o ? 500 : 400,
                  boxShadow: outcome === o ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                {o}
                {o === "standing" && counts.standing ? ` · ${counts.standing}` : ""}
                {o === "superseded" && counts.superseded ? ` · ${counts.superseded}` : ""}
              </button>
            ))}
          </div>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              flex: 1,
              minWidth: 200,
              padding: "6px 11px",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
            }}
          >
            <Search size={14} strokeWidth={1.8} color="var(--ink-faint)" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search what, why, or who"
              aria-label="Search receipts"
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 12.5,
                width: "100%",
                color: "var(--ink)",
              }}
            />
          </label>
        </div>

        {query.isPending ? (
          <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "32px 0" }}>
            Loading receipts…
          </div>
        ) : query.isError ? (
          <div style={{ fontSize: 13, color: "var(--rose)", padding: "32px 0" }}>
            Could not load the Trust Ledger. {(query.error as Error)?.message}
          </div>
        ) : receipts.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No receipts yet"
            body="Decisions and approved autonomous actions appear here as receipts the moment they happen, with their evidence and whether they still stand."
            cta="Open Approvals"
            onCta={() => {
              navigate({ to: "/govern", search: { tab: "approvals" } });
            }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {receipts.map((r) => (
              <ReceiptCard key={`${r.kind}-${r.id}`} r={r} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
