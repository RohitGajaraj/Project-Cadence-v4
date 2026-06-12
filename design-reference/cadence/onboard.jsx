// Login + Onboarding — the first-run surfaces. Full-screen, no shell.
const { useState: useStateO } = React;

/* ---------- Login ---------- */
function LoginScreen({ onContinue }) {
  const [email, setEmail] = useStateO("");
  return (
    <div data-screen-label="Login" style={{ position: "relative", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)", overflow: "hidden" }}>
      {/* giant mono butterfly watermark */}
      <div aria-hidden="true" style={{ position: "absolute", right: -120, bottom: -130, color: "var(--ink)", opacity: 0.05, transform: "rotate(-12deg)" }}>
        <CadenceMark size={520} tile={false} />
      </div>

      <div className="fade-up" style={{ width: 360, maxWidth: "calc(100vw - 48px)", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 26 }}>
          <CadenceMark size={52} />
          <h1 className="font-display" style={{ fontSize: 30, fontWeight: 440, marginTop: 14 }}>Cadence</h1>
          <div className="mono-label" style={{ marginTop: 6 }}>agents execute · you govern</div>
        </div>

        <div className="bento" style={{ padding: 22 }}>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginBottom: 8 }} onClick={onContinue}>
            Continue with Google
          </button>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={onContinue}>
            Continue with SAML SSO
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
            <span style={{ flex: 1, height: 1, background: "var(--hairline)" }}></span>
            <span className="mono-label" style={{ fontSize: 8.5 }}>or</span>
            <span style={{ flex: 1, height: 1, background: "var(--hairline)" }}></span>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); onContinue(); }}>
            <input className="input" type="email" placeholder="work email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 8 }} />
            <button className="btn btn-primary" type="submit" style={{ width: "100%", justifyContent: "center" }}>
              Continue · sends a magic link
            </button>
          </form>
        </div>

        <p style={{ fontSize: 11.5, color: "var(--ink-faint)", textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
          No passwords here — the link signs you in.<br />Trouble signing in? Ask your workspace admin, or email founders@cadence.dev.
        </p>
      </div>
    </div>
  );
}

/* ---------- Onboarding ---------- */
const ONBOARD_GOALS = [
  "Fix the checkout drop-off theme",
  "Draft the SSO spec for enterprise",
  "Investigate slow dashboard loads",
];

function StepShell({ step, title, sub, children, footer }) {
  return (
    <div data-screen-label={`Onboarding · step ${step}`} style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--paper)", padding: 24 }}>
      <div className="fade-up" style={{ width: 620, maxWidth: "100%" }} key={step}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <CadenceMark size={26} />
          <span className="mono-label">Setup · step {step} of 3</span>
          <span style={{ flex: 1 }}></span>
          <span style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3].map((i) => (
              <span key={i} style={{ width: 26, height: 3, borderRadius: 99, background: i <= step ? "var(--ember)" : "var(--surface-2)", transition: "background var(--dur-slow)" }}></span>
            ))}
          </span>
        </div>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 430 }}>{title}</h1>
        <p style={{ fontSize: 13, color: "var(--ink-subtle)", margin: "6px 0 22px", maxWidth: 480 }}>{sub}</p>
        {children}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

function OnboardingScreen({ onFinish }) {
  const D = window.CADENCE_DATA;
  const [step, setStep] = useStateO(1);
  const [conns, setConns] = useStateO({ Intercom: true, Mixpanel: true, GitHub: true });
  const [staff, setStaff] = useStateO(() => Object.fromEntries(D.agents.map((a) => [a.slug, true])));
  const [goal, setGoal] = useStateO(ONBOARD_GOALS[0]);
  const [custom, setCustom] = useStateO("");

  const connCount = Object.values(conns).filter(Boolean).length;
  const staffCount = Object.values(staff).filter(Boolean).length;
  const finalGoal = custom.trim() || goal;

  if (step === 1) {
    return (
      <StepShell step={1} title="Where should Cadence listen?"
        sub="Signals are the loop's fuel. Connect the places your users already talk — three or more gives Scout enough to cluster real themes."
        footer={
          <React.Fragment>
            <span className="mono-label">{connCount} connected</span>
            <button className="btn btn-primary" onClick={() => setStep(2)} disabled={connCount === 0} style={{ opacity: connCount === 0 ? 0.5 : 1 }}>
              Continue · Scout starts listening
            </button>
          </React.Fragment>
        }>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {D.connectors.map((c) => {
            const on = !!conns[c.name];
            return (
              <button key={c.name} onClick={() => setConns((x) => ({ ...x, [c.name]: !on }))} aria-pressed={on}
                className="lift" style={{
                  textAlign: "left", padding: "13px 14px", borderRadius: 10,
                  border: `1px solid ${on ? "color-mix(in oklab, var(--ember) 55%, transparent)" : "var(--hairline)"}`,
                  background: on ? "color-mix(in oklab, var(--ember) 7%, var(--canvas))" : "var(--canvas)",
                }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 550, fontSize: 13.5 }}>{c.name}</span>
                  {on ? <IcCheck size={13} style={{ color: "var(--ember)" }} /> : <IcPlus size={13} style={{ color: "var(--ink-faint)" }} />}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "var(--ink-subtle)", marginTop: 3 }}>{c.desc}</span>
              </button>
            );
          })}
        </div>
      </StepShell>
    );
  }

  if (step === 2) {
    return (
      <StepShell step={2} title="Meet your staff."
        sub="Eight specialists run the loop. All of them ask before anything irreversible — you can stand any of them down later in Settings."
        footer={
          <React.Fragment>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              Continue · {staffCount} agents on staff
            </button>
          </React.Fragment>
        }>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {D.agents.map((a) => {
            const on = !!staff[a.slug];
            return (
              <button key={a.slug} onClick={() => setStaff((x) => ({ ...x, [a.slug]: !on }))} aria-pressed={on}
                className="lift" style={{
                  textAlign: "left", padding: "12px 13px", borderRadius: 10,
                  border: "1px solid var(--hairline)", background: "var(--canvas)",
                  opacity: on ? 1 : 0.45,
                }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="font-display" style={{ fontSize: 15 }}>{a.name}</span>
                  <span className="dot" style={{ width: 7, height: 7, background: on ? "var(--emerald)" : "var(--ink-faint)" }}></span>
                </span>
                <span className="mono-label" style={{ fontSize: 8, display: "block", marginTop: 3 }}>{a.role}</span>
              </button>
            );
          })}
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell step={3} title="Hand them a first goal."
      sub="Scout already found themes in your connected sources. Pick one, or write your own — specialists dispatch the moment you confirm."
      footer={
        <React.Fragment>
          <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
          <button className="btn btn-primary" onClick={() => onFinish(finalGoal)}>
            Dispatch · agents start now
          </button>
        </React.Fragment>
      }>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ONBOARD_GOALS.map((g) => {
          const on = !custom.trim() && goal === g;
          return (
            <button key={g} onClick={() => { setGoal(g); setCustom(""); }} aria-pressed={on}
              style={{
                textAlign: "left", padding: "12px 14px", borderRadius: 10, fontSize: 13.5,
                border: `1px solid ${on ? "color-mix(in oklab, var(--ember) 55%, transparent)" : "var(--hairline)"}`,
                background: on ? "color-mix(in oklab, var(--ember) 7%, var(--canvas))" : "var(--canvas)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
              <StepDot status={on ? "gate" : "planned"} />
              <span style={{ flex: 1 }}>{g}</span>
              {on ? <span className="mono-label" style={{ fontSize: 8.5, color: "var(--ember)" }}>selected</span> : null}
            </button>
          );
        })}
        <input className="input" placeholder="…or write your own goal" value={custom} onChange={(e) => setCustom(e.target.value)} style={{ marginTop: 4 }} />
      </div>
    </StepShell>
  );
}

Object.assign(window, { LoginScreen, OnboardingScreen });
