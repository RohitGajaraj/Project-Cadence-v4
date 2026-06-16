import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { CadenceMark } from "@/components/cadence/Primitives";

// Screen 8 (F-DESIGN-EMBER) — signup on the login stage from
// design-reference/cadence/onboard.jsx. Creates the account with
// onboarded:false so the first-run flow (/onboarding) greets the new user —
// the handle_new_user trigger has already seeded their workspace, staff,
// and demo content by the time they land there.

export const Route = createFileRoute("/signup")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: SignupPage,
  head: () => ({ meta: [{ title: "Sign up · Cadence" }] }),
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("AI Product Manager");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName.trim(), display_name: fullName.trim().split(" ")[0], role },
      },
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    // Auto-confirm is on; session should be present. Upsert profile.
    // onboarded stays false — the _authenticated gate routes the new user
    // through /onboarding on first landing.
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName.trim(),
        display_name: fullName.trim().split(" ")[0],
        role,
        onboarded: false,
      });
    }
    setLoading(false);
    toast.success("Account created");
    navigate({ to: "/" });
  }

  async function signupGoogle() {
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
      data-screen-label="Sign up"
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        color: "var(--ink)",
        overflow: "hidden",
        padding: 24,
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
            Create your workspace
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
            onClick={signupGoogle}
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
          <form onSubmit={signup}>
            <input
              className="input"
              required
              placeholder="full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ marginBottom: 8, width: "100%" }}
            />
            <input
              className="input"
              placeholder="role — e.g. AI Product Manager"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ marginBottom: 8, width: "100%" }}
            />
            <input
              className="input"
              type="email"
              required
              placeholder="work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: 8, width: "100%" }}
            />
            <input
              className="input"
              type="password"
              required
              minLength={6}
              placeholder="password — at least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
                "Create account · setup starts"
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
          Already have an account?{" "}
          <Link
            to="/login"
            style={{
              color: "var(--ink-subtle)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
