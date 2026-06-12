// Guardrails tab — ported 1:1 from design-reference/cadence/loop.jsx
// (GovernScreen tab "Guardrails"): the bento table — Guardrail 160px /
// Rule 1fr / Last fired 210px — name at weight 550, rule ink-muted, fired
// mono (ember when fired, ink-faint "never"). Production functionality
// kept: rule CRUD (row click opens the editor), enable switches (extra
// 40px column), seed built-ins, the dry-run test harness, and the recent
// hits log — all restyled quiet-Ember. "Last fired" derives from the real
// guardrail_hits log; rule prose derives from kind/action/applies_to.
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import {
  getGuardrailOverview,
  upsertGuardrailRule,
  deleteGuardrailRule,
  toggleGuardrailRule,
  seedBuiltInGuardrails,
  testGuardrailRule,
} from "@/lib/guardrails.functions";
import { EmptyState, MonoLabel } from "@/components/cadence/Primitives";
import { relTime } from "@/components/product/format";

type Kind = "regex" | "keyword" | "pii" | "injection" | "secret";
type Action = "block" | "warn" | "redact";
type Applies = "input" | "output" | "both";

type RuleForm = {
  id?: string;
  name: string;
  kind: Kind;
  pattern: string;
  action: Action;
  applies_to: Applies;
  enabled: boolean;
};

const GRID = "160px 1fr 210px 40px";
const HITS_GRID = "90px 150px 70px 70px 1fr";

const ACTION_PHRASE: Record<Action, string> = {
  block: "Blocks",
  warn: "Warns on",
  redact: "Redacts",
};
const KIND_PHRASE: Record<Kind, string> = {
  regex: "pattern matches",
  keyword: "keyword matches",
  pii: "PII matches",
  injection: "prompt-injection matches",
  secret: "secret matches",
};
const APPLIES_PHRASE: Record<Applies, string> = {
  both: "in input + output",
  input: "in input",
  output: "in output",
};

const ACTION_COLOR: Record<string, string> = {
  block: "var(--rose)",
  warn: "var(--ember)",
  redact: "var(--ink-muted)",
};

function emptyRule(): RuleForm {
  return {
    name: "",
    kind: "keyword",
    pattern: "",
    action: "warn",
    applies_to: "both",
    enabled: true,
  };
}

export function GuardrailsPanel() {
  const confirm = useConfirm();
  const fOverview = useServerFn(getGuardrailOverview);
  const fUpsert = useServerFn(upsertGuardrailRule);
  const fDelete = useServerFn(deleteGuardrailRule);
  const fToggle = useServerFn(toggleGuardrailRule);
  const fSeed = useServerFn(seedBuiltInGuardrails);
  const fTest = useServerFn(testGuardrailRule);
  const qc = useQueryClient();

  const overview = useQuery({ queryKey: ["guardrails"], queryFn: () => fOverview() });

  const [editing, setEditing] = useState<RuleForm | null>(null);
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<{
    text: string;
    blocked: boolean;
    hits: { matched: string }[];
  } | null>(null);

  const upsert = useMutation({
    mutationFn: (r: RuleForm) => fUpsert({ data: r }),
    onSuccess: () => {
      toast.success("Rule saved. It applies on the next AI call.");
      setEditing(null);
      setTestResult(null);
      qc.invalidateQueries({ queryKey: ["guardrails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Rule deleted. It stops applying immediately.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["guardrails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const tog = useMutation({
    mutationFn: (v: { id: string; enabled: boolean; name: string }) =>
      fToggle({ data: { id: v.id, enabled: v.enabled } }),
    onSuccess: (_d, v) => {
      toast.success(`${v.name} ${v.enabled ? "on" : "off"}.`);
      qc.invalidateQueries({ queryKey: ["guardrails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const seed = useMutation({
    mutationFn: () => fSeed(),
    onSuccess: (r) => {
      toast.success(
        r.inserted > 0
          ? `Seeded ${r.inserted} built-ins. Live on the next AI call.`
          : "Built-ins already present.",
      );
      qc.invalidateQueries({ queryKey: ["guardrails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const test = useMutation({
    mutationFn: (r: RuleForm) =>
      fTest({
        data: { text: testText, side: r.applies_to === "output" ? "output" : "input", rule: r },
      }),
    onSuccess: (r) => setTestResult(r),
    onError: (e: Error) => toast.error(e.message),
  });

  if (overview.error) {
    return (
      <div className="bento" style={{ padding: 24 }}>
        <div className="mono-label" style={{ color: "var(--rose)" }}>
          Couldn't load guardrails
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 8 }}>
          {(overview.error as Error)?.message}
        </p>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 14 }}
          onClick={() => overview.refetch()}
        >
          Retry · reloads guardrails
        </button>
      </div>
    );
  }

  if (overview.isLoading) {
    return (
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        Loading guardrails…
      </div>
    );
  }

  const rules = overview.data?.rules ?? [];
  const hits = overview.data?.hits ?? [];

  // Last fired per rule, from the real hits log (hits arrive newest-first).
  const lastFired = new Map<string, string>();
  for (const h of hits) {
    if (!lastFired.has(h.rule_name)) lastFired.set(h.rule_name, h.created_at);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <MonoLabel icon={Shield}>{rules.length} rules</MonoLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            disabled={seed.isPending}
            onClick={() => seed.mutate()}
          >
            Seed built-ins · PII, secrets, injection
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing(emptyRule())}>
            New rule · applies on the next call
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No guardrails yet"
          body="Seed the built-in set — PII redaction, secret blocking, prompt-injection flags — or write your own rule."
          cta="Seed built-ins · PII, secrets, injection"
          onCta={() => seed.mutate()}
        />
      ) : (
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div
            className="mono-label"
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "10px 18px",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span>Guardrail</span>
            <span>Rule</span>
            <span>Last fired</span>
            <span></span>
          </div>
          {rules.map((g, i) => {
            const fired = lastFired.get(g.name) ?? null;
            const ruleText = `${ACTION_PHRASE[g.action as Action] ?? g.action} ${
              KIND_PHRASE[g.kind as Kind] ?? g.kind
            } ${APPLIES_PHRASE[g.applies_to as Applies] ?? g.applies_to}`;
            return (
              <div
                key={g.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: 12,
                  padding: "13px 18px",
                  alignItems: "baseline",
                  borderBottom: i < rules.length - 1 ? "1px solid var(--hairline)" : "none",
                  fontSize: 13,
                  opacity: g.enabled ? 1 : 0.45,
                }}
              >
                <button
                  onClick={() =>
                    setEditing({
                      id: g.id,
                      name: g.name,
                      kind: g.kind as Kind,
                      pattern: g.pattern,
                      action: g.action as Action,
                      applies_to: g.applies_to as Applies,
                      enabled: g.enabled,
                    })
                  }
                  style={{ fontWeight: 550, textAlign: "left", cursor: "pointer", minWidth: 0 }}
                  title="Edit · changes apply on the next call"
                >
                  {g.name}
                  {g.built_in ? (
                    <span
                      className="mono-label"
                      style={{ display: "block", fontSize: 8.5, color: "var(--ink-faint)" }}
                    >
                      built-in
                    </span>
                  ) : null}
                </button>
                <span style={{ color: "var(--ink-muted)", minWidth: 0 }}>
                  {ruleText}
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--ink-faint)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {g.pattern}
                  </span>
                </span>
                <span
                  className="mono-label"
                  style={{ color: fired ? "var(--ember)" : "var(--ink-faint)" }}
                >
                  {fired ? relTime(fired) : "never"}
                </span>
                <span style={{ alignSelf: "center" }}>
                  <button
                    role="switch"
                    aria-checked={g.enabled}
                    aria-label={`${g.name} guardrail`}
                    disabled={tog.isPending}
                    onClick={() => tog.mutate({ id: g.id, enabled: !g.enabled, name: g.name })}
                    style={{
                      width: 34,
                      height: 19,
                      borderRadius: 99,
                      background: g.enabled ? "var(--deep-green)" : "var(--surface-2)",
                      border: "1px solid var(--hairline)",
                      position: "relative",
                      flexShrink: 0,
                      transition: "background var(--dur-base)",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: g.enabled ? 16 : 2,
                        width: 13,
                        height: 13,
                        borderRadius: 99,
                        background: "var(--canvas)",
                        transition: "left var(--dur-base)",
                      }}
                    />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent fires — production hits log (no reference equivalent), quiet. */}
      <div className="bento" style={{ padding: 0, overflow: "hidden", marginTop: 12 }}>
        <div
          className="mono-label"
          style={{
            display: "grid",
            gridTemplateColumns: HITS_GRID,
            gap: 12,
            padding: "10px 18px",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <span>When</span>
          <span>Rule</span>
          <span>Side</span>
          <span>Action</span>
          <span>Matched</span>
        </div>
        {hits.length === 0 ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-faint)",
              padding: "20px 18px",
              textAlign: "center",
            }}
          >
            No guardrail activity yet.
          </div>
        ) : (
          hits.map((h, i) => (
            <div
              key={h.id}
              style={{
                display: "grid",
                gridTemplateColumns: HITS_GRID,
                gap: 12,
                padding: "11px 18px",
                alignItems: "baseline",
                borderBottom: i < hits.length - 1 ? "1px solid var(--hairline)" : "none",
                fontSize: 12.5,
              }}
            >
              <span className="mono-label tabular-nums">{relTime(h.created_at)}</span>
              <span
                style={{
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {h.rule_name}
              </span>
              <span className="mono-label">{h.side}</span>
              <span
                className="mono-label"
                style={{ color: ACTION_COLOR[h.action] ?? "var(--ink-muted)" }}
              >
                {h.action}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--ink-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {h.matched}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Rule editor — production CRUD + dry-run test, restyled quiet-Ember. */}
      {editing ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "color-mix(in oklab, var(--ink) 35%, transparent)",
          }}
          onClick={() => setEditing(null)}
        >
          <div
            className="bento fade-up"
            style={{ width: "100%", maxWidth: 620, padding: 20, background: "var(--canvas)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 14,
              }}
            >
              <h2 className="font-display" style={{ fontSize: 19 }}>
                {editing.id ? "Edit rule" : "New rule"}
              </h2>
              <button
                className="mono-label"
                style={{ color: "var(--ink-faint)" }}
                onClick={() => setEditing(null)}
              >
                dismiss
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="mono-label" style={{ gridColumn: "span 2", display: "block" }}>
                Name
                <input
                  className="input"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  style={{ marginTop: 5, fontSize: 13 }}
                />
              </label>
              <label className="mono-label" style={{ display: "block" }}>
                Kind
                <select
                  className="input"
                  value={editing.kind}
                  onChange={(e) => setEditing({ ...editing, kind: e.target.value as Kind })}
                  style={{ marginTop: 5, fontSize: 13 }}
                >
                  <option value="keyword">Keyword (literal substring)</option>
                  <option value="regex">Regex</option>
                  <option value="pii">PII (regex)</option>
                  <option value="injection">Injection (regex)</option>
                  <option value="secret">Secret (regex)</option>
                </select>
              </label>
              <label className="mono-label" style={{ display: "block" }}>
                Applies to
                <select
                  className="input"
                  value={editing.applies_to}
                  onChange={(e) =>
                    setEditing({ ...editing, applies_to: e.target.value as Applies })
                  }
                  style={{ marginTop: 5, fontSize: 13 }}
                >
                  <option value="both">Both</option>
                  <option value="input">Input only</option>
                  <option value="output">Output only</option>
                </select>
              </label>
              <label className="mono-label" style={{ gridColumn: "span 2", display: "block" }}>
                Pattern
                <textarea
                  className="input"
                  value={editing.pattern}
                  onChange={(e) => setEditing({ ...editing, pattern: e.target.value })}
                  rows={2}
                  style={{
                    marginTop: 5,
                    resize: "none",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
              </label>
              <label className="mono-label" style={{ display: "block" }}>
                Action
                <select
                  className="input"
                  value={editing.action}
                  onChange={(e) => setEditing({ ...editing, action: e.target.value as Action })}
                  style={{ marginTop: 5, fontSize: 13 }}
                >
                  <option value="warn">Warn (log only)</option>
                  <option value="redact">Redact</option>
                  <option value="block">Block</option>
                </select>
              </label>
              <label
                className="mono-label"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "end",
                  paddingBottom: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={editing.enabled}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>

            <div
              style={{
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                padding: 12,
                marginTop: 12,
              }}
            >
              <div className="mono-label" style={{ marginBottom: 6 }}>
                Test · dry run, nothing is saved
              </div>
              <textarea
                className="input"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Paste sample text to test this rule against…"
                rows={2}
                style={{ resize: "none", fontFamily: "var(--font-mono)", fontSize: 12 }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={!testText.trim() || test.isPending}
                  onClick={() => test.mutate(editing)}
                >
                  {test.isPending ? (
                    <>
                      <span className="spinner" style={{ width: 11, height: 11 }} />
                      Testing…
                    </>
                  ) : (
                    "Run test · nothing is saved"
                  )}
                </button>
                {testResult ? (
                  <span
                    className="mono-label"
                    style={{ color: testResult.blocked ? "var(--rose)" : "var(--ink-subtle)" }}
                  >
                    {testResult.hits.length} hit{testResult.hits.length === 1 ? "" : "s"} ·{" "}
                    {testResult.blocked ? "blocked" : "allowed"}
                  </span>
                ) : null}
              </div>
              {testResult && testResult.hits.length > 0 ? (
                <pre
                  className="scrollbar-thin"
                  style={{
                    marginTop: 8,
                    maxHeight: 120,
                    overflow: "auto",
                    background: "var(--surface-1)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 8,
                    padding: 8,
                    fontSize: 11,
                    lineHeight: 1.5,
                  }}
                >
                  {testResult.text}
                </pre>
              ) : null}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              {editing.id ? (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--rose)", marginRight: "auto" }}
                  disabled={del.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete "${editing.name}"?`,
                      body: "The rule stops applying immediately.",
                      destructive: true,
                      confirmLabel: "Delete rule",
                    });
                    if (ok && editing.id) del.mutate(editing.id);
                  }}
                >
                  Delete · stops applying immediately
                </button>
              ) : null}
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                Dismiss
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!editing.name.trim() || !editing.pattern.trim() || upsert.isPending}
                onClick={() => upsert.mutate(editing)}
              >
                Save · applies on the next call
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
