import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation } from "@/lib/workspaces.functions";
import { CadenceMark } from "@/components/cadence/Primitives";

// WM-F5 accept side: the join landing for a workspace invitation link. A standalone
// page (not under the auth shell, so a logged-out invitee gets a clear prompt instead of
// a silent bounce that loses the token). If signed in, it redeems the token via
// acceptInvitation (the email-bound, single-use definer RPC) and drops the user into the app.
// Engine-Room: the accept_workspace_invitation RPC -> a calm "You're in" landing -> the user
// just lands in the workspace, no mechanism shown.

export const Route = createFileRoute("/join/$token")({
  ssr: false,
  component: JoinPage,
  head: () => ({ meta: [{ title: "Join a workspace · Cadence" }] }),
});

type State =
  | { kind: "checking" }
  | { kind: "needs-login" }
  | { kind: "accepting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

function JoinPage() {
  const { token } = Route.useParams();
  const fAccept = useServerFn(acceptInvitation);
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "checking" });
  const ran = useRef(false);

  useEffect(() => {
    // Accept is single-use and not idempotent, so guard against a double run
    // (StrictMode invokes effects twice in dev).
    if (ran.current) return;
    ran.current = true;

    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setState({ kind: "needs-login" });
        return;
      }
      setState({ kind: "accepting" });
      try {
        await fAccept({ data: { token } });
        if (!cancelled) setState({ kind: "done" });
      } catch (e) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : "This invitation could not be accepted.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, fAccept]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--paper)",
      }}
    >
      <div
        className="bento"
        style={{ padding: 32, maxWidth: 420, width: "100%", textAlign: "center" }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <CadenceMark />
        </div>

        {(state.kind === "checking" || state.kind === "accepting") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--ink-faint)" }} />
            <p style={{ fontSize: 14, color: "var(--ink-muted)" }}>
              {state.kind === "checking" ? "Checking your invitation" : "Joining the workspace"}
            </p>
          </div>
        )}

        {state.kind === "needs-login" && (
          <div>
            <h1 style={{ fontSize: 18, color: "var(--ink)", marginBottom: 8 }}>
              You have a workspace invitation
            </h1>
            <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 18 }}>
              Log in or sign up with the email it was sent to. You will land right back here to
              join.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <Link
                to="/login"
                search={{ next: `/join/${token}` }}
                className="btn btn-primary btn-sm"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                search={{ next: `/join/${token}` }}
                className="btn btn-ghost btn-sm"
              >
                Sign up
              </Link>
            </div>
          </div>
        )}

        {state.kind === "done" && (
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 999,
                background: "var(--moss-soft, var(--surface-sunken))",
                color: "var(--moss, var(--ink))",
                marginBottom: 12,
              }}
            >
              <Check size={18} />
            </div>
            <h1 style={{ fontSize: 18, color: "var(--ink)", marginBottom: 8 }}>You are in</h1>
            <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 18 }}>
              You have joined the workspace.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate({ to: "/" })}
            >
              Go to Cadence
            </button>
          </div>
        )}

        {state.kind === "error" && (
          <div>
            <h1 style={{ fontSize: 18, color: "var(--ink)", marginBottom: 8 }}>
              This invitation could not be accepted
            </h1>
            <p style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 18 }}>
              {state.message}
            </p>
            <Link to="/" className="btn btn-ghost btn-sm">
              Go to Cadence
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
