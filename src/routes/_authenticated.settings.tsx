import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/cadence/AppShell";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { listProjects } from "@/lib/projects.functions";
import { MODELS } from "@/lib/ai/models";
import {
  listIntegrations,
  upsertIntegration,
  disconnectIntegration,
  PROVIDERS,
} from "@/lib/integrations.functions";
import { Plug, CheckCircle2, Clock, Key, Trash2, Compass, Save } from "lucide-react";
import {
  listApiKeys,
  saveApiKey,
  deleteApiKey,
  testApiKey,
  BYO_PROVIDERS,
} from "@/lib/byokeys.functions";
import { getActiveBrief, upsertBrief, type WorkspaceBrief } from "@/lib/briefs.functions";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  listMyCalendarConnections,
  startCalendarConnect,
  saveCalendarConnection,
  disconnectCalendar,
} from "@/lib/calendar-connections.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import { useConfirm } from "@/hooks/use-confirm";
import { Calendar as CalIcon, Link2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search: Record<string, unknown>): { section?: string } => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings · Cadence" }] }),
});

function SettingsPage() {
  const { section } = Route.useSearch();
  const briefRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (section === "brief" && briefRef.current) {
      briefRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [section]);
  const qc = useQueryClient();
  const fProfile = useServerFn(getProfile);
  const fProjects = useServerFn(listProjects);
  const mUpdate = useServerFn(updateProfile);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fProfile() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => fProjects() });

  const fIntegrations = useServerFn(listIntegrations);
  const fUpsertInt = useServerFn(upsertIntegration);
  const fDisconnect = useServerFn(disconnectIntegration);
  const integrations = useQuery({ queryKey: ["integrations"], queryFn: () => fIntegrations() });
  const fKeys = useServerFn(listApiKeys);
  const fSaveKey = useServerFn(saveApiKey);
  const fDelKey = useServerFn(deleteApiKey);
  const fTestKey = useServerFn(testApiKey);
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => fKeys() });
  const [keyProv, setKeyProv] = useState<string>(BYO_PROVIDERS[0].id);
  const [keyLabel, setKeyLabel] = useState<string>("");
  const [keyValue, setKeyValue] = useState<string>("");
  const [keyBase, setKeyBase] = useState<string>("");
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latency_ms: number;
    error?: string;
    sample?: string;
  } | null>(null);
  const mTestKey = useMutation({
    mutationFn: () =>
      fTestKey({ data: { provider: keyProv, api_key: keyValue, base_url: keyBase || null } }),
    onSuccess: (r) => {
      setTestResult(r);
      if (r.ok) toast.success(`Key works (${r.latency_ms}ms)`);
      else toast.error(r.error ?? "Test failed");
    },
    onError: (e: Error) => {
      setTestResult({ ok: false, latency_ms: 0, error: e.message });
      toast.error(e.message);
    },
  });
  const mSaveKey = useMutation({
    mutationFn: () =>
      fSaveKey({
        data: {
          provider: keyProv,
          label: keyLabel || null,
          api_key: keyValue,
          base_url: keyBase || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setKeyValue("");
      setKeyLabel("");
      setKeyBase("");
      setTestResult(null);
      toast.success("Key saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelKey = useMutation({
    mutationFn: (id: string) => fDelKey({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Removed");
    },
  });
  const intMap = new Map(
    (integrations.data?.integrations ?? []).map(
      (i: { provider: string; status: string; account_label: string | null }) => [i.provider, i],
    ),
  );

  const mConnect = useMutation({
    mutationFn: (provider: string) =>
      fUpsertInt({
        data: { provider, status: "connected", account_label: "Connected via Lovable" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Connected");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDisconnect = useMutation({
    mutationFn: (provider: string) => fDisconnect({ data: { provider } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Disconnected");
    },
  });

  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("");
  const [timezone, setTimezone] = useState("");
  const [defaultModel, setDefaultModel] = useState("google/gemini-3-flash-preview");
  const [whStart, setWhStart] = useState(9);
  const [whEnd, setWhEnd] = useState(18);
  const [voiceAnchor, setVoiceAnchor] = useState("");

  useEffect(() => {
    const p = profile.data?.profile as {
      full_name?: string;
      display_name?: string;
      role?: string;
      timezone?: string;
      default_model?: string;
      working_hours_start?: number;
      working_hours_end?: number;
      voice_anchor_text?: string | null;
    } | null;
    if (!p) return;
    setFullName(p.full_name ?? "");
    setDisplayName(p.display_name ?? "");
    setRole(p.role ?? "AI Product Manager");
    setTimezone(p.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    setDefaultModel(p.default_model ?? "google/gemini-3-flash-preview");
    setWhStart(p.working_hours_start ?? 9);
    setWhEnd(p.working_hours_end ?? 18);
    setVoiceAnchor(p.voice_anchor_text ?? "");
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      mUpdate({
        data: {
          full_name: fullName || undefined,
          display_name: displayName || undefined,
          role: role || undefined,
          timezone: timezone || undefined,
          default_model: defaultModel,
          working_hours_start: whStart,
          working_hours_end: whEnd,
          voice_anchor_text: voiceAnchor,
          onboarded: true,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell projects={projects.data?.projects ?? []}>
      <div className="px-6 lg:px-10 py-10 max-w-3xl mx-auto">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Personal</div>
          <h1 className="mt-3 font-display text-4xl tracking-tight">
            Settings &amp; <span className="neural-text">profile</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            How Cadence and your AI agents should address you and operate.
          </p>
        </header>

        <WorkspaceBriefSection scrollRef={briefRef} highlight={section === "brief"} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-5"
        >
          <section className="bento p-6 space-y-4">
            <h2 className="font-display text-sm uppercase tracking-[0.16em] text-muted-foreground">
              Identity
            </h2>
            <Field label="Full name" hint="Used on documents, briefs, and stakeholder updates.">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Q. Doe"
                className="input"
              />
            </Field>
            <Field
              label="Preferred display name"
              hint="How Cadence and your agents will greet you."
            >
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane"
                className="input"
              />
            </Field>
            <Field label="Role">
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="AI Product Manager"
                className="input"
              />
            </Field>
            <Field label="Timezone">
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/New_York"
                className="input"
              />
            </Field>
          </section>

          <section className="bento p-6 space-y-4">
            <h2 className="font-display text-sm uppercase tracking-[0.16em] text-muted-foreground">
              Working hours
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start (24h)">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={whStart}
                  onChange={(e) => setWhStart(Number(e.target.value))}
                  className="input"
                />
              </Field>
              <Field label="End (24h)">
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={whEnd}
                  onChange={(e) => setWhEnd(Number(e.target.value))}
                  className="input"
                />
              </Field>
            </div>
          </section>

          <section className="bento p-6 space-y-4">
            <h2 className="font-display text-sm uppercase tracking-[0.16em] text-muted-foreground">
              Default AI model
            </h2>
            <p className="text-xs text-muted-foreground">
              Used for chat and agent runs unless you override.
            </p>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="input"
            >
              <optgroup label="Live (Lovable AI Gateway)">
                {MODELS.filter((m) => m.live).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.desc}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Bring your own key (coming soon)">
                {MODELS.filter((m) => !m.live).map((m) => (
                  <option key={m.id} value={m.id} disabled>
                    {m.label} — {m.desc}
                  </option>
                ))}
              </optgroup>
            </select>
          </section>

          <section className="bento p-6 space-y-4">
            <h2 className="font-display text-sm uppercase tracking-[0.16em] text-muted-foreground">
              Voice anchor
            </h2>
            <p className="text-xs text-muted-foreground">
              Operator-set tone and stance, injected into every agent mission's system prompt. Leave
              empty to skip.
            </p>
            <Field
              label="Voice anchor"
              hint="How your agents should sound and what stance they should take."
            >
              <textarea
                value={voiceAnchor}
                onChange={(e) => setVoiceAnchor(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Direct, evidence-first, no hype. Challenge weak assumptions. Prefer short declarative sentences."
                className="input resize-y"
              />
            </Field>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-xl bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <section className="bento p-6 mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm uppercase tracking-[0.16em] text-muted-foreground">
                Integrations
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Bring your other PM tools into Cadence. Two-way sync ships in 5.2b.
              </p>
            </div>
            <Plug className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {PROVIDERS.map((p) => {
              const conn = intMap.get(p.id) as
                | { status: string; account_label: string | null }
                | undefined;
              const connected = conn?.status === "connected";
              const comingSoon = p.desc.startsWith("Coming");
              return (
                <div
                  key={p.id}
                  className="rounded-xl border hairline p-4 flex flex-col gap-2 bg-background/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-sm flex items-center gap-1.5">
                        {p.label}
                        {connected && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                        {comingSoon && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</div>
                      {connected && conn?.account_label && (
                        <div className="text-[10px] text-muted-foreground/70 mt-1">
                          {conn.account_label}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {connected ? (
                      <button
                        onClick={() => mDisconnect.mutate(p.id)}
                        className="text-xs rounded-md border hairline px-2.5 py-1 hover:bg-secondary/60"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        disabled={comingSoon || mConnect.isPending}
                        onClick={() => mConnect.mutate(p.id)}
                        className="text-xs rounded-md bg-foreground text-background px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {comingSoon ? "Coming soon" : "Connect"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bento p-6 mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm uppercase tracking-[0.16em] text-muted-foreground">
                Bring your own AI keys
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Connect Claude, DeepSeek, Grok, Ollama, OpenAI direct, or a GitHub PAT. Stored
                encrypted per user.
              </p>
            </div>
            <Key className="h-4 w-4 text-muted-foreground" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (keyValue.trim()) mSaveKey.mutate();
            }}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2"
          >
            <select
              value={keyProv}
              onChange={(e) => setKeyProv(e.target.value)}
              className="input sm:col-span-3"
            >
              {BYO_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              value={keyLabel}
              onChange={(e) => setKeyLabel(e.target.value)}
              placeholder="Label (optional)"
              className="input sm:col-span-3"
            />
            <input
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              type="password"
              placeholder={BYO_PROVIDERS.find((p) => p.id === keyProv)?.placeholder}
              className="input sm:col-span-4"
            />
            <input
              value={keyBase}
              onChange={(e) => setKeyBase(e.target.value)}
              placeholder="Base URL (Ollama only)"
              className="input sm:col-span-2"
            />
            <div className="sm:col-span-12 flex items-center justify-end gap-2">
              {testResult && (
                <span className={`text-xs ${testResult.ok ? "text-emerald-400" : "text-rose-400"}`}>
                  {testResult.ok
                    ? `✓ ${testResult.latency_ms}ms`
                    : `✗ ${testResult.error?.slice(0, 80)}`}
                </span>
              )}
              <button
                type="button"
                disabled={mTestKey.isPending || !keyValue.trim()}
                onClick={() => mTestKey.mutate()}
                className="text-xs rounded-md border hairline px-3 py-1.5 hover:bg-secondary/60 disabled:opacity-50"
              >
                {mTestKey.isPending ? "Testing…" : "Test key"}
              </button>
              <button
                type="submit"
                disabled={mSaveKey.isPending || !keyValue.trim()}
                className="text-xs rounded-md bg-foreground text-background px-3 py-1.5 disabled:opacity-50"
              >
                {mSaveKey.isPending ? "Saving…" : "Add key"}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {(keys.data?.keys ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground">No BYO keys saved yet.</div>
            )}
            {(keys.data?.keys ?? []).map((k) => (
              <div
                key={k.id}
                className="flex items-center gap-3 rounded-lg border hairline px-3 py-2 bg-background/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    {BYO_PROVIDERS.find((p) => p.id === k.provider)?.label ?? k.provider}
                    {k.label && <span className="text-muted-foreground"> · {k.label}</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {k.preview}
                    {k.base_url ? ` · ${k.base_url}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => mDelKey.mutate(k.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <CalendarAccountsSection />
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.625rem;
          border: 1px solid var(--color-hairline);
          background: color-mix(in oklab, var(--color-paper) 60%, transparent);
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          color: var(--color-foreground);
        }
        .input:focus { box-shadow: 0 0 0 1px var(--color-ring); }
      `}</style>
    </AppShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-muted-foreground/70">{hint}</div>}
    </label>
  );
}

type BriefFieldKey = "mission" | "target_user" | "current_focus" | "anti_goals" | "notes";

const BRIEF_FIELDS: {
  key: BriefFieldKey;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
}[] = [
  {
    key: "mission",
    label: "Mission",
    hint: "One paragraph. What this workspace exists to do.",
    placeholder: "We help solo PMs run the work of a 10-person product org.",
    rows: 3,
  },
  {
    key: "target_user",
    label: "Target user (ICP)",
    hint: "Who you're building for. Agents anchor on this.",
    placeholder: "Lead/solo PM at a 10 to 100 person B2B SaaS team. Ships weekly.",
    rows: 3,
  },
  {
    key: "current_focus",
    label: "Current focus",
    hint: "What the swarm should prioritize this quarter. Cut, don't expand.",
    placeholder: "Q3 2026: close the Discover, Define, Plan, Build loop on real signals.",
    rows: 4,
  },
  {
    key: "anti_goals",
    label: "Anti-goals",
    hint: "Things agents should refuse, even when they look reasonable.",
    placeholder: "No new dashboards. No mocked data. No features whose value can't be measured.",
    rows: 3,
  },
  {
    key: "notes",
    label: "Notes for the swarm",
    hint: "Tone, constraints, decisions, references.",
    placeholder: "Speak in product terms. Lean concise over verbose. Always cite evidence.",
    rows: 4,
  },
];

const EMPTY_BRIEF: Record<BriefFieldKey, string> = {
  mission: "",
  target_user: "",
  current_focus: "",
  anti_goals: "",
  notes: "",
};

function WorkspaceBriefSection({
  scrollRef,
  highlight,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  highlight: boolean;
}) {
  const { activeWorkspaceId, activeWorkspace, refreshWorkspaces } = useWorkspace();
  const qc = useQueryClient();
  const getFn = useServerFn(getActiveBrief);
  const upsertFn = useServerFn(upsertBrief);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-brief", activeWorkspaceId],
    queryFn: () => getFn({ data: { workspaceId: activeWorkspaceId ?? null } }),
  });

  const effectiveWorkspaceId = activeWorkspaceId ?? data?.workspace_id ?? null;

  const [form, setForm] = useState<Record<BriefFieldKey, string>>(EMPTY_BRIEF);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        mission: data.mission ?? "",
        target_user: data.target_user ?? "",
        current_focus: data.current_focus ?? "",
        anti_goals: data.anti_goals ?? "",
        notes: data.notes ?? "",
      });
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => upsertFn({ data: { workspaceId: effectiveWorkspaceId, ...form } }),
    onSuccess: (row: WorkspaceBrief) => {
      qc.setQueryData(["workspace-brief", activeWorkspaceId], row);
      qc.setQueryData(["workspace-brief", null], row);
      void refreshWorkspaces();
      setDirty(false);
      toast.success("Brief saved, next mission uses the new context");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function update(key: BriefFieldKey, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setDirty(true);
  }

  return (
    <section
      ref={scrollRef}
      className={`bento p-6 space-y-4 mb-8 ${highlight ? "ring-1 ring-foreground/30" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-sm uppercase tracking-[0.16em] text-muted-foreground inline-flex items-center gap-2">
            <Compass className="h-3 w-3" /> Strategic brief
            {activeWorkspace?.name && (
              <span className="normal-case tracking-normal text-muted-foreground/70">
                · {activeWorkspace.name}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            This brief is injected into every agent mission's system prompt. Changing it visibly
            changes what Discovery surfaces and what the Strategist writes. Keep it tight.
          </p>
        </div>
        <button
          type="button"
          disabled={!dirty || save.isPending || isLoading}
          onClick={() => save.mutate()}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="h-3 w-3" />
          {save.isPending ? "Saving…" : dirty ? "Save brief" : "Saved"}
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading brief…</div>
      ) : (
        <div className="space-y-4">
          {BRIEF_FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={`brief-${f.key}`} className="block">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-foreground">{f.label}</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {form[f.key].length} chars
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">{f.hint}</p>
              </label>
              <textarea
                id={`brief-${f.key}`}
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                rows={f.rows}
                placeholder={f.placeholder}
                className="input mt-2 resize-y"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CalendarAccountsSection() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fListConns = useServerFn(listMyCalendarConnections);
  const fStartConnect = useServerFn(startCalendarConnect);
  const fSaveConn = useServerFn(saveCalendarConnection);
  const fDisconnect = useServerFn(disconnectCalendar);
  const connections = useQuery({ queryKey: ["calendar-connections"], queryFn: () => fListConns() });
  const mConnect = useMutation({
    mutationFn: async (provider: "google" | "microsoft") => {
      const result = await connectAppUser({
        connectorId: provider === "google" ? "google_calendar" : "microsoft_outlook",
        gatewayBaseUrl: "https://connector-gateway.lovable.dev",
        start: (targetOrigin) => fStartConnect({ data: { provider, targetOrigin } }),
      });
      if (!result.success || !result.connectionId)
        throw new Error(result.error ?? "Connect failed");
      return fSaveConn({ data: { provider, connectionId: result.connectionId } });
    },
    onSuccess: () => {
      toast.success("Calendar connected");
      qc.invalidateQueries({ queryKey: ["calendar-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDisconnect = useMutation({
    mutationFn: (id: string) => fDisconnect({ data: { id } }),
    onSuccess: () => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["calendar-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const list = connections.data?.connections ?? [];
  const available = connections.data?.providersAvailable ?? { google: false, microsoft: false };
  const hasGoogle = list.some((c) => c.provider === "google");
  const hasMicrosoft = list.some((c) => c.provider === "microsoft");

  return (
    <section className="bento p-6 mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-sm uppercase tracking-[0.16em] text-muted-foreground inline-flex items-center gap-2">
            <CalIcon className="h-3 w-3" /> Calendar accounts
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Connect your Google or Microsoft calendar. Disconnect or switch accounts any time.
          </p>
        </div>
        <Link2 className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        {list.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-lg border hairline px-3 py-2 bg-background/40"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <div className="min-w-0">
                <div className="text-sm">
                  {c.provider === "google" ? "Google Calendar" : "Microsoft Outlook"}
                </div>
                {c.account_email && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    {c.account_email}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "Disconnect this calendar?",
                  body: "Stored events stay but no further sync will happen.",
                  confirmLabel: "Disconnect",
                  destructive: true,
                });
                if (ok) mDisconnect.mutate(c.id);
              }}
              className="text-xs rounded-md border hairline px-2.5 py-1 hover:bg-secondary/60"
            >
              Disconnect
            </button>
          </div>
        ))}

        {!hasGoogle && (
          <button
            onClick={() => mConnect.mutate("google")}
            disabled={mConnect.isPending}
            title={available.google ? "" : "Provider credentials not yet configured"}
            className="w-full text-left text-xs rounded-lg border hairline px-3 py-2 hover:bg-secondary/60 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Plug className="h-3.5 w-3.5" /> Connect Google Calendar
          </button>
        )}
        {!hasMicrosoft && (
          <button
            onClick={() => mConnect.mutate("microsoft")}
            disabled={mConnect.isPending}
            title={available.microsoft ? "" : "Provider credentials not yet configured"}
            className="w-full text-left text-xs rounded-lg border hairline px-3 py-2 hover:bg-secondary/60 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Plug className="h-3.5 w-3.5" /> Connect Microsoft Outlook
          </button>
        )}

        {!available.google && !available.microsoft && list.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">
            Connect setup pending. Admin must add provider credentials.
          </p>
        )}
      </div>
    </section>
  );
}
