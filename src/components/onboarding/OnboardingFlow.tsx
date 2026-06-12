/**
 * Screen 8 (F-DESIGN-EMBER) — first-run onboarding, ported from
 * design-reference/cadence/onboard.jsx (StepShell + OnboardingScreen) onto
 * REAL production data:
 *
 *  - Step 1 connects the real OAuth-only connector platform (popup gateway /
 *    GitHub App redirect; unconfigured providers show the admin-setup state —
 *    the reference's instant mock toggles cannot exist under OAuth).
 *  - Step 2 toggles the real agents.enabled column (orchestrator excluded —
 *    it is mission infrastructure, not staff).
 *  - Step 3 offers the user's REAL top themes (never invented goals) and
 *    writes the choice to workspace_briefs.current_focus — the brief is
 *    injected into every mission's system prompt, so the goal genuinely
 *    reaches the staff. Honest deviations from the reference are labeled
 *    inline; nothing renders that isn't backed by stored data.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CadenceMark, StepDot } from "@/components/cadence/Primitives";
import { CONNECTOR_REGISTRY, type ProviderId, type ProviderSpec } from "@/lib/connectors/registry";
import {
  listConnections,
  saveGatewayConnection,
  startGatewayConnect,
  startGithubAppConnect,
} from "@/lib/connections.functions";
import {
  listMyCalendarConnections,
  saveCalendarConnection,
  startCalendarConnect,
} from "@/lib/calendar-connections.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import { listAgents } from "@/lib/agents.functions";
import { listThemes } from "@/lib/discovery.functions";
import { completeOnboarding, setAgentEnabled } from "@/lib/onboarding.functions";
import { markOnboarded } from "@/lib/onboarding-gate";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

// Registry providers backed by the calendar connection layer (same mapping
// as Settings → Connected accounts).
const CALENDAR_PROVIDERS: Partial<Record<ProviderId, "google" | "microsoft">> = {
  google_calendar: "google",
  microsoft_outlook: "microsoft",
};

type AgentRow = { id: string; slug: string; name: string; role: string; enabled: boolean };

/* ---------- StepShell (reference lines 56–80, verbatim anatomy) ---------- */
function StepShell({
  step,
  title,
  sub,
  children,
  footer,
}: {
  step: number;
  title: string;
  sub: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div
      data-screen-label={`Onboarding · step ${step}`}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        color: "var(--ink)",
        padding: 24,
      }}
    >
      <div className="fade-up" style={{ width: 620, maxWidth: "100%" }} key={step}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <CadenceMark size={26} />
          <span className="mono-label">Setup · step {step} of 3</span>
          <span style={{ flex: 1 }}></span>
          <span style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  width: 26,
                  height: 3,
                  borderRadius: 99,
                  background: i <= step ? "var(--ember)" : "var(--surface-2)",
                  transition: "background var(--dur-slow)",
                }}
              ></span>
            ))}
          </span>
        </div>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 430 }}>
          {title}
        </h1>
        <p
          style={{ fontSize: 13, color: "var(--ink-subtle)", margin: "6px 0 22px", maxWidth: 480 }}
        >
          {sub}
        </p>
        {children}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 24,
          }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}

/* ---------- The flow ---------- */
export function OnboardingFlow() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);

  /* — step 1 data: real connections + availability — */
  const fListConnections = useServerFn(listConnections);
  const fStartGithub = useServerFn(startGithubAppConnect);
  const fStartGateway = useServerFn(startGatewayConnect);
  const fSaveGateway = useServerFn(saveGatewayConnection);
  const fCalList = useServerFn(listMyCalendarConnections);
  const fCalStart = useServerFn(startCalendarConnect);
  const fCalSave = useServerFn(saveCalendarConnection);

  const connectionsQ = useQuery({ queryKey: ["connections"], queryFn: () => fListConnections() });
  const calendarsQ = useQuery({
    queryKey: ["calendar-connections"],
    queryFn: () => fCalList(),
  });

  const providers = Object.values(CONNECTOR_REGISTRY).filter((s) => s.userFacing !== false);
  const availability = connectionsQ.data?.providerAvailability;

  function isConnected(spec: ProviderSpec): boolean {
    const cal = CALENDAR_PROVIDERS[spec.id];
    if (cal) return (calendarsQ.data?.connections ?? []).some((c) => c.provider === cal);
    return (connectionsQ.data?.connections ?? []).some(
      (c) => c.provider === spec.id && c.status === "connected",
    );
  }
  const connCount = providers.filter(isConnected).length;

  const [connectingId, setConnectingId] = useState<ProviderId | null>(null);
  const mConnect = useMutation({
    mutationFn: async (spec: ProviderSpec) => {
      const cal = CALENDAR_PROVIDERS[spec.id];
      if (cal) {
        const result = await connectAppUser({
          connectorId: spec.id,
          gatewayBaseUrl: GATEWAY_BASE_URL,
          start: (targetOrigin) => fCalStart({ data: { provider: cal, targetOrigin } }),
        });
        if (!result.success || !result.connectionId)
          throw new Error(result.error ?? "Connect failed");
        return fCalSave({ data: { provider: cal, connectionId: result.connectionId } });
      }
      if (spec.id === "github") {
        // GitHub App install is a full redirect; the first-run gate routes
        // the callback landing straight back to /onboarding.
        const { installUrl } = await fStartGithub();
        window.location.assign(installUrl);
        return null;
      }
      const method = spec.authMethods.find((m) => m.kind === "oauth_gateway");
      if (!method || method.kind !== "oauth_gateway") {
        throw new Error(`${spec.label} does not support OAuth connect yet.`);
      }
      const result = await connectAppUser({
        connectorId: method.connectorId,
        gatewayBaseUrl: GATEWAY_BASE_URL,
        start: (targetOrigin) => fStartGateway({ data: { provider: spec.id, targetOrigin } }),
      });
      if (!result.success || !result.connectionId)
        throw new Error(result.error ?? "Connect failed");
      return fSaveGateway({ data: { provider: spec.id, connectionId: result.connectionId } });
    },
    onSuccess: (r) => {
      if (r === null) return; // github redirect in flight
      toast.success("Connected");
      qc.invalidateQueries({ queryKey: ["connections"] });
      qc.invalidateQueries({ queryKey: ["calendar-connections"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setConnectingId(null),
  });

  /* — step 2 data: the real staff — */
  const fListAgents = useServerFn(listAgents);
  const fSetEnabled = useServerFn(setAgentEnabled);
  const agentsQ = useQuery({ queryKey: ["agents"], queryFn: () => fListAgents() });
  // The orchestrator plans and dispatches missions — infrastructure, not
  // staff; standing it down would break every mission, so it isn't offered.
  const staff = ((agentsQ.data?.agents ?? []) as AgentRow[]).filter(
    (a) => a.slug !== "orchestrator",
  );
  const staffCount = staff.filter((a) => a.enabled).length;

  const mToggleAgent = useMutation({
    mutationFn: (a: { agentId: string; enabled: boolean }) => fSetEnabled({ data: a }),
    onMutate: async (a) => {
      await qc.cancelQueries({ queryKey: ["agents"] });
      const prev = qc.getQueryData(["agents"]);
      qc.setQueryData(["agents"], (old: { agents: AgentRow[] } | undefined) =>
        old
          ? {
              agents: old.agents.map((x) =>
                x.id === a.agentId ? { ...x, enabled: a.enabled } : x,
              ),
            }
          : old,
      );
      return { prev };
    },
    onError: (e: Error, _a, ctx) => {
      if (ctx?.prev) qc.setQueryData(["agents"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  /* — step 3 data: real themes as goal candidates — */
  const fListThemes = useServerFn(listThemes);
  const themesQ = useQuery({ queryKey: ["themes"], queryFn: () => fListThemes() });
  const goalOptions = ((themesQ.data?.themes ?? []) as Array<{ id: string; title: string }>).slice(
    0,
    3,
  );
  // Deviation from the reference (which preselects its first mock goal):
  // nothing is preselected — finishing without a choice changes no data.
  const [goal, setGoal] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const finalGoal = custom.trim() || goal || "";

  const fComplete = useServerFn(completeOnboarding);
  const mFinish = useMutation({
    mutationFn: () => fComplete({ data: finalGoal ? { goal: finalGoal } : {} }),
    onSuccess: async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) markOnboarded(data.session.user.id);
      toast.success(finalGoal ? "Goal handed to the staff" : "Setup complete");
      navigate({ to: "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------- step 1 — Where should Cadence listen? ---------- */
  if (step === 1) {
    return (
      <StepShell
        step={1}
        title="Where should Cadence listen?"
        sub="Signals are the loop's fuel. Connect the places your users already talk — three or more gives Scout enough to cluster real themes. Nothing is required now; Settings keeps every connector a click away."
        footer={
          <>
            <span className="mono-label">{connCount} connected</span>
            {/* Founder ruling: connecting is never a gate — at zero
                connections the right-side action IS the skip, primary
                weight, so the no-friction path is unmistakable. */}
            <button className="btn btn-primary" onClick={() => setStep(2)}>
              {connCount > 0
                ? "Continue · Scout starts listening"
                : "Skip for now · connect anytime in Settings"}
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {providers.map((spec) => {
            const on = isConnected(spec);
            const configured = availability?.[spec.id]?.configured ?? false;
            const busy = connectingId === spec.id;
            return (
              <button
                key={spec.id}
                className="lift"
                aria-pressed={on}
                disabled={busy}
                onClick={() => {
                  if (on) return;
                  if (!configured) {
                    toast.info(spec.setupHint ?? `Admin setup pending for ${spec.label}.`);
                    return;
                  }
                  setConnectingId(spec.id);
                  mConnect.mutate(spec);
                }}
                style={{
                  textAlign: "left",
                  padding: "13px 14px",
                  borderRadius: 10,
                  border: `1px solid ${on ? "color-mix(in oklab, var(--ember) 55%, transparent)" : "var(--hairline)"}`,
                  background: on
                    ? "color-mix(in oklab, var(--ember) 7%, var(--canvas))"
                    : "var(--canvas)",
                  opacity: configured || on ? 1 : 0.45,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontWeight: 550, fontSize: 13.5 }}>{spec.label}</span>
                  {busy ? (
                    <Loader2
                      size={13}
                      className="animate-spin"
                      style={{ color: "var(--ink-faint)" }}
                    />
                  ) : on ? (
                    <Check size={13} style={{ color: "var(--ember)" }} />
                  ) : (
                    <Plus size={13} style={{ color: "var(--ink-faint)" }} />
                  )}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "var(--ink-subtle)",
                    marginTop: 3,
                  }}
                >
                  {configured || on
                    ? spec.description
                    : "Admin setup required — ask your workspace admin."}
                </span>
              </button>
            );
          })}
        </div>
      </StepShell>
    );
  }

  /* ---------- step 2 — Meet your staff. ---------- */
  if (step === 2) {
    return (
      <StepShell
        step={2}
        title="Meet your staff."
        sub={`${staff.length || "Your"} specialists run the loop. All of them ask before anything irreversible — you can stand any of them down later in Settings.`}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              Continue · {staffCount} agents on staff
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {staff.map((a) => {
            const on = a.enabled;
            return (
              <button
                key={a.slug}
                className="lift"
                aria-pressed={on}
                onClick={() => mToggleAgent.mutate({ agentId: a.id, enabled: !on })}
                style={{
                  textAlign: "left",
                  padding: "12px 13px",
                  borderRadius: 10,
                  border: "1px solid var(--hairline)",
                  background: "var(--canvas)",
                  opacity: on ? 1 : 0.45,
                  // Grid items default to min-width:auto — sentence-long role
                  // kickers would blow the 1fr tracks out of the 620 column
                  // (screen-4 precedent); 0 lets the ellipses do their job.
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minWidth: 0,
                    gap: 6,
                  }}
                >
                  <span
                    className="font-display"
                    style={{
                      fontSize: 15,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.name}
                  </span>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 99,
                      flexShrink: 0,
                      background: on ? "var(--emerald)" : "var(--ink-faint)",
                    }}
                  ></span>
                </span>
                <span
                  className="mono-label"
                  style={{
                    fontSize: 8,
                    display: "block",
                    marginTop: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.role}
                </span>
              </button>
            );
          })}
        </div>
      </StepShell>
    );
  }

  /* ---------- step 3 — Hand them a first goal. ---------- */
  return (
    <StepShell
      step={3}
      title="Hand them a first goal."
      sub={
        goalOptions.length > 0
          ? "Scout already found themes in your sources. Pick one, or write your own — it becomes the brief every specialist reads."
          : "Write the first goal in your own words — it becomes the brief every specialist reads."
      }
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => setStep(2)}>
            ← Back
          </button>
          <button
            className="btn btn-primary"
            disabled={mFinish.isPending}
            onClick={() => mFinish.mutate()}
          >
            {mFinish.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : finalGoal ? (
              "Confirm · becomes the team's focus"
            ) : (
              "Finish · opens your workspace"
            )}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {goalOptions.map((t) => {
          const on = !custom.trim() && goal === t.title;
          return (
            <button
              key={t.id}
              aria-pressed={on}
              onClick={() => {
                setGoal(on ? null : t.title);
                setCustom("");
              }}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: 10,
                fontSize: 13.5,
                border: `1px solid ${on ? "color-mix(in oklab, var(--ember) 55%, transparent)" : "var(--hairline)"}`,
                background: on
                  ? "color-mix(in oklab, var(--ember) 7%, var(--canvas))"
                  : "var(--canvas)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <StepDot status={on ? "gate" : "planned"} />
              <span style={{ flex: 1 }}>{t.title}</span>
              {on ? (
                <span className="mono-label" style={{ fontSize: 8.5, color: "var(--ember)" }}>
                  selected
                </span>
              ) : null}
            </button>
          );
        })}
        <input
          className="input"
          placeholder="…or write your own goal"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          style={{ marginTop: 4, width: "100%" }}
        />
      </div>
    </StepShell>
  );
}
