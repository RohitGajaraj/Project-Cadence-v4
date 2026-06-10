import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Shield,
  Plus,
  Trash2,
  FlaskConical,
  Sparkles,
  AlertTriangle,
  EyeOff,
  Ban,
} from "lucide-react";
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

const ACTION_META: Record<Action, { Icon: typeof Ban; cls: string; label: string }> = {
  block: { Icon: Ban, cls: "bg-rose-500/10 text-rose-300 border-rose-500/30", label: "Block" },
  warn: {
    Icon: AlertTriangle,
    cls: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    label: "Warn",
  },
  redact: { Icon: EyeOff, cls: "bg-sky-500/10 text-sky-300 border-sky-500/30", label: "Redact" },
};

function ActionBadge({ action }: { action: string }) {
  const m = ACTION_META[action as Action] ?? ACTION_META.warn;
  const { Icon } = m;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${m.cls}`}
    >
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

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
      toast.success("Rule saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["guardrails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Rule deleted");
      qc.invalidateQueries({ queryKey: ["guardrails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const tog = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => fToggle({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guardrails"] }),
  });
  const seed = useMutation({
    mutationFn: () => fSeed(),
    onSuccess: (r) => {
      toast.success(`Seeded ${r.inserted} rule(s)`);
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

  const rules = overview.data?.rules ?? [];
  const hits = overview.data?.hits ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 text-violet-400" /> Filter sensitive data, secrets, and
          prompt-injection on every AI call.
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => seed.mutate()}
            disabled={seed.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Sparkles className="h-3.5 w-3.5" /> Seed built-ins
          </button>
          <button
            onClick={() => setEditing(emptyRule())}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> New rule
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-background/40">
        <div className="border-b border-border px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
          Rules ({rules.length})
        </div>
        {rules.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No rules yet. Click <strong>Seed built-ins</strong> to start with PII / secret /
            injection coverage.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => tog.mutate({ id: r.id, enabled: e.target.checked })}
                  className="h-4 w-4"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{r.name}</span>
                    <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 uppercase tracking-wider text-muted-foreground">
                      {r.kind}
                    </span>
                    <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {r.applies_to}
                    </span>
                    <ActionBadge action={r.action} />
                    {r.built_in && (
                      <span className="text-[10px] text-muted-foreground">built-in</span>
                    )}
                  </div>
                  <code className="mt-1 block text-[11px] text-muted-foreground truncate font-mono">
                    {r.pattern}
                  </code>
                </div>
                <button
                  onClick={() =>
                    setEditing({
                      id: r.id,
                      name: r.name,
                      kind: r.kind as Kind,
                      pattern: r.pattern,
                      action: r.action as Action,
                      applies_to: r.applies_to as Applies,
                      enabled: r.enabled,
                    })
                  }
                  className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete "${r.name}"?`,
                      body: "The rule stops applying immediately.",
                      destructive: true,
                      confirmLabel: "Delete rule",
                    });
                    if (ok) del.mutate(r.id);
                  }}
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-background/40">
        <div className="border-b border-border px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">
          Recent hits ({hits.length})
        </div>
        {hits.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No guardrail activity yet.
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">Rule</th>
                  <th className="px-4 py-2 text-left">Side</th>
                  <th className="px-4 py-2 text-left">Action</th>
                  <th className="px-4 py-2 text-left">Matched</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((h) => (
                  <tr key={h.id} className="border-b border-border/50">
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">{h.rule_name}</td>
                    <td className="px-4 py-2 text-xs">{h.side}</td>
                    <td className="px-4 py-2">
                      <ActionBadge action={h.action} />
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] truncate max-w-xs">
                      {h.matched}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-border bg-background p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">{editing.id ? "Edit rule" : "New rule"}</h2>
              <button
                onClick={() => setEditing(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-xs">
                Name
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs">
                Kind
                <select
                  value={editing.kind}
                  onChange={(e) => setEditing({ ...editing, kind: e.target.value as Kind })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="keyword">Keyword (literal substring)</option>
                  <option value="regex">Regex</option>
                  <option value="pii">PII (regex)</option>
                  <option value="injection">Injection (regex)</option>
                  <option value="secret">Secret (regex)</option>
                </select>
              </label>
              <label className="text-xs">
                Applies to
                <select
                  value={editing.applies_to}
                  onChange={(e) =>
                    setEditing({ ...editing, applies_to: e.target.value as Applies })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="both">Both</option>
                  <option value="input">Input only</option>
                  <option value="output">Output only</option>
                </select>
              </label>
              <label className="col-span-2 text-xs">
                Pattern
                <textarea
                  value={editing.pattern}
                  onChange={(e) => setEditing({ ...editing, pattern: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
                />
              </label>
              <label className="text-xs">
                Action
                <select
                  value={editing.action}
                  onChange={(e) => setEditing({ ...editing, action: e.target.value as Action })}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="warn">Warn (log only)</option>
                  <option value="redact">Redact</option>
                  <option value="block">Block</option>
                </select>
              </label>
              <label className="text-xs flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  checked={editing.enabled}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>

            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <FlaskConical className="h-3 w-3" /> Test
              </div>
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Paste sample text to test this rule against…"
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => test.mutate(editing)}
                  disabled={!testText.trim() || test.isPending}
                  className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
                >
                  Run test
                </button>
                {testResult && (
                  <span className="text-xs text-muted-foreground">
                    {testResult.hits.length} hit(s) · {testResult.blocked ? "BLOCKED" : "allowed"}
                  </span>
                )}
              </div>
              {testResult && testResult.hits.length > 0 && (
                <pre className="rounded bg-muted/40 p-2 text-[11px] overflow-auto max-h-32">
                  {testResult.text}
                </pre>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-md border border-border px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => upsert.mutate(editing)}
                disabled={!editing.name.trim() || !editing.pattern.trim() || upsert.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
