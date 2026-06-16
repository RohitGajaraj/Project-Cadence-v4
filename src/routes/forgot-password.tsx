import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { CadenceMark } from "@/components/cadence/Primitives";

// Screen 8 completion (F-DESIGN-EMBER) — the auth family's reset-request
// page on the login stage (login.tsx is the pattern source). Real flow
// unchanged: supabase resetPasswordForEmail → /reset-password recovery link.
// ssr:false kept — the auth pages hydrate browser-only (preview-blank fix).

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Forgot password · Cadence" }] }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendResetLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Check your email for the reset link");
  }

  return (
    <div
      data-screen-label="Reset password"
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        color: "var(--ink)",
        overflow: "hidden",
      }}
    >
      {/* giant mono butterfly watermark */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: -120,
          bottom: -130,
          color: "var(--ink)",
          opacity: 0.05,
          transform: "rotate(-12deg)",
        }}
      >
        <CadenceMark size={520} tile={false} />
      </div>

      <div
        className="fade-up"
        style={{ width: 360, maxWidth: "calc(100vw - 48px)", position: "relative", zIndex: 1 }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            marginBottom: 26,
          }}
        >
          <CadenceMark size={52} />
          <h1 className="font-display" style={{ fontSize: 30, fontWeight: 440, marginTop: 14 }}>
            Reset your password
          </h1>
          <div className="mono-label" style={{ marginTop: 6 }}>
            agents execute · you govern
          </div>
        </div>

        <div className="bento" style={{ padding: 22 }}>
          {sent ? (
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-muted)",
                  margin: "4px 0 14px",
                  lineHeight: 1.55,
                }}
              >
                If an account exists for <strong style={{ color: "var(--ink)" }}>{email}</strong>,
                the reset link is on its way.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={() => setSent(false)}
              >
                Send again · same address
              </button>
            </div>
          ) : (
            <form onSubmit={sendResetLink}>
              <input
                className="input"
                type="email"
                required
                placeholder="work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ marginBottom: 8, width: "100%" }}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Send reset link · lands in your inbox"
                )}
              </button>
            </form>
          )}
        </div>

        <p
          style={{
            fontSize: 11.5,
            color: "var(--ink-faint)",
            textAlign: "center",
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          Remembered it?{" "}
          <Link
            to="/login"
            style={{
              color: "var(--ink-subtle)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
