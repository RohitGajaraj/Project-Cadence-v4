import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { CadenceMark } from "@/components/cadence/Primitives";

// Screen 8 completion (F-DESIGN-EMBER) — the recovery-link landing page on
// the login stage. Real flow unchanged: a valid recovery hash carries a
// session, updateUser({ password }) sets the new one and leaves the user
// signed in (the done state continues into the workspace). ssr:false kept.

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Cadence" }] }),
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [validHash, setValidHash] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const hasRecovery = hash.includes("type=recovery") || hash.includes("access_token=");
    setValidHash(hasRecovery);
  }, []);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    setDone(true);
    toast.success("Password updated");
  }

  return (
    <div
      data-screen-label="New password"
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
            Choose a new password
          </h1>
          <div className="mono-label" style={{ marginTop: 6 }}>
            agents execute · you govern
          </div>
        </div>

        <div className="bento" style={{ padding: 22 }}>
          {done ? (
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-muted)",
                  margin: "4px 0 14px",
                  lineHeight: 1.55,
                }}
              >
                Your password is updated — you're signed in with it now.
              </p>
              <Link
                to="/"
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
              >
                Continue · opens your workspace
              </Link>
            </div>
          ) : !validHash ? (
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-muted)",
                  margin: "4px 0 14px",
                  lineHeight: 1.55,
                }}
              >
                This reset link is invalid or has expired.
              </p>
              <Link
                to="/forgot-password"
                className="btn btn-ghost"
                style={{ width: "100%", justifyContent: "center" }}
              >
                Request a new link · takes a minute
              </Link>
            </div>
          ) : (
            <form onSubmit={updatePassword}>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="new password — at least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: "100%", paddingRight: 34 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--ink-faint)",
                    display: "flex",
                  }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <input
                className="input"
                type="password"
                required
                placeholder="retype it"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
                  "Update password · takes effect now"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
