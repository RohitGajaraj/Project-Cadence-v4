import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { CadenceMark } from "@/components/cadence/Primitives";

// Screen 8 (F-DESIGN-EMBER) — login ported from design-reference/cadence/
// onboard.jsx LoginScreen onto the REAL auth flow (Supabase password +
// Lovable Google OAuth). Reference deviations, both honest-data calls:
// SAML SSO button omitted (no SAML in production); "magic link" copy
// replaced (production signs in with a password, so the consequence-first
// label says what actually happens).

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: LoginPage,
  head: () => ({ meta: [{ title: "Cadence" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoadingEmail(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoadingEmail(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/" });
  }

  async function signInGoogle() {
    setLoadingGoogle(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoadingGoogle(false);
      return toast.error(result.error.message ?? "Google sign-in failed");
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div
      data-screen-label="Login"
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
            Cadence
          </h1>
          <div className="mono-label" style={{ marginTop: 6 }}>
            agents execute · you govern
          </div>
        </div>

        <div className="bento" style={{ padding: 22 }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={signInGoogle}
            disabled={loadingGoogle}
          >
            {loadingGoogle ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              "Continue with Google"
            )}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
            <span style={{ flex: 1, height: 1, background: "var(--hairline)" }}></span>
            <span className="mono-label" style={{ fontSize: 8.5 }}>
              or
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--hairline)" }}></span>
          </div>
          <form onSubmit={signInEmail}>
            <input
              className="input"
              type="email"
              required
              placeholder="work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: 8, width: "100%" }}
            />
            <div style={{ position: "relative", marginBottom: 8 }}>
              <input
                className="input"
                type={showPassword ? "text" : "password"}
                required
                placeholder="password"
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
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loadingEmail}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {loadingEmail ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                "Sign in · opens your workspace"
              )}
            </button>
          </form>
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
          New here?{" "}
          <Link
            to="/signup"
            style={{
              color: "var(--ink-subtle)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Create an account
          </Link>{" "}
          ·{" "}
          <Link
            to="/forgot-password"
            style={{
              color: "var(--ink-subtle)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Forgot password?
          </Link>
          <br />
          Trouble signing in? Ask your workspace admin, or email founders@cadence.dev.
        </p>
      </div>
    </div>
  );
}
