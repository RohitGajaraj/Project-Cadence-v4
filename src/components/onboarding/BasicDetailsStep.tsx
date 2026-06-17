import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { CadenceMark } from "@/components/cadence/Primitives";
import { updateProfile } from "@/lib/profile.functions";

/**
 * Shared basic-details capture — the single place EVERY signup path (email
 * /password AND Google OAuth) gives Cadence a name and role.
 *
 * Sign-up now only takes credentials (email + password, or Google). Identity is
 * captured here so the app can greet the user properly: before this, the OAuth
 * path set no display_name and the whole app fell back to the email local-part
 * ("abc.def"). We write BOTH the profiles row (Today greeting, chat brief) and
 * the auth user_metadata (the AppShell account chip + chat header read the name
 * from the session, not the row), so every surface shows the real name.
 *
 * Rendered as the first step of /onboarding, gated on a missing display_name, so
 * a user who already has a name never sees it.
 *
 * Engine-Room: none — calm-front identity capture, no machinery exposed.
 */
export function BasicDetailsStep({ onDone }: { onDone: () => void }) {
  const fUpdate = useServerFn(updateProfile);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("AI Product Manager");
  const [saving, setSaving] = useState(false);

  // Prefill from whatever the auth provider already gave us. Google returns
  // given_name / family_name / full_name; bare email signups give nothing, so
  // the fields stay empty. Never seed from the email local-part — that is the
  // exact wrong-name we are fixing.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const m = (data.user?.user_metadata ?? {}) as {
        given_name?: string;
        family_name?: string;
        full_name?: string;
        name?: string;
      };
      const full = (m.full_name ?? m.name ?? "").trim();
      const looksReal = full.length > 0 && !full.includes("@");
      if (m.given_name) setFirstName(m.given_name);
      else if (looksReal) setFirstName(full.split(" ")[0]);
      if (m.family_name) setLastName(m.family_name);
      else if (looksReal && full.split(" ").length > 1)
        setLastName(full.split(" ").slice(1).join(" "));
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const first = firstName.trim();
    if (!first) return toast.error("Please add at least your first name");
    const fullName = [first, lastName.trim()].filter(Boolean).join(" ");
    const roleValue = role.trim() || "Product Manager";
    setSaving(true);
    try {
      await fUpdate({
        data: { full_name: fullName, display_name: first, role: roleValue },
      });
      // Mirror to the session: the AppShell and chat header resolve the name
      // from auth user_metadata, not the profiles row, so both must carry it.
      await supabase.auth.updateUser({ data: { display_name: first, full_name: fullName } });
      onDone();
    } catch (err) {
      setSaving(false);
      toast.error(err instanceof Error ? err.message : "Could not save your details");
    }
  }

  return (
    <div
      data-screen-label="Onboarding · your details"
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
      {/* giant mono butterfly watermark — same anatomy as the signup stage */}
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
        style={{ width: 420, maxWidth: "calc(100vw - 48px)", position: "relative", zIndex: 1 }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <CadenceMark size={48} />
          <div className="mono-label" style={{ marginTop: 12 }}>
            before we begin
          </div>
          <h1 className="font-display" style={{ fontSize: 30, fontWeight: 440, marginTop: 8 }}>
            First, your <em style={{ fontStyle: "italic" }}>name</em>.
          </h1>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--ink-subtle)",
              marginTop: 10,
              lineHeight: 1.55,
              maxWidth: 320,
            }}
          >
            So Cadence greets you by name and signs every decision it makes with you. You can change
            this anytime in Settings.
          </p>
        </div>

        <div className="bento" style={{ padding: 22 }}>
          <form onSubmit={save}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                className="input"
                required
                placeholder="first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                style={{ flex: 1, minWidth: 0 }}
              />
              <input
                className="input"
                placeholder="last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={{ flex: 1, minWidth: 0 }}
              />
            </div>
            <input
              className="input"
              placeholder="your role, e.g. AI Product Manager"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ marginBottom: 12, width: "100%" }}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={saving}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Continue · setup begins"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
