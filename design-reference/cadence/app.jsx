// App — routing, tweaks, shared approval/mission state, ⌘K, toasts.
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "ember",
  "dark": false,
  "density": "comfortable",
  "motion": true
} /*EDITMODE-END*/;

function App() {
  const D = window.CADENCE_DATA;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useStateA({ name: "home" });
  const [cmdk, setCmdk] = useStateA(false);
  const [toasts, setToasts] = useStateA([]);
  const [approvals, setApprovals] = useStateA(D.approvals.map((a) => ({ ...a })));
  const [missions, setMissions] = useStateA(D.missions.map((m) => ({ ...m, steps: m.steps.map((s) => ({ ...s })) })));
  const [workspace, setWorkspace] = useStateA({ name: D.workspace.name, product: D.workspace.product });
  const [banner, setBanner] = useStateA(true);
  const [buildPill, setBuildPill] = useStateA(true);
  const timersRef = useRefA([]);

  useEffectA(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", t.dark ? "dark" : "light");
    el.setAttribute("data-accent", t.accent);
    el.setAttribute("data-density", t.density);
    el.setAttribute("data-motion", t.motion ? "on" : "off");
  }, [t.dark, t.accent, t.density, t.motion]);

  useEffectA(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {e.preventDefault();setCmdk((v) => !v);}
      if (e.key === "Escape") setCmdk(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {window.removeEventListener("keydown", onKey);timersRef.current.forEach(clearTimeout);};
  }, []);

  const toast = (text) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, text }]);
    timersRef.current.push(setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4200));
  };

  const workspaceAction = (a) => {
    if (a.type === "switch") {
      setWorkspace({ name: a.ws.name, product: a.ws.products[0] });
      toast(`Switched to ${a.ws.name}.`);
    } else if (a.type === "product") {
      setWorkspace((w) => ({ ...w, product: a.product }));
      toast(`Now looking at ${a.product}.`);
    } else if (a.label === "Sign out") {
      setRoute({ name: "login" });
    } else {
      toast(`${a.label} opens in the full build.`);
    }
  };

  const setStep = (missionId, agent, status, extra) =>
  setMissions((ms) => ms.map((m) => m.id !== missionId ? m : {
    ...m, ...(extra || {}),
    steps: m.steps.map((s) => s.agent === agent ? { ...s, status } : s)
  }));

  const approve = (id) => {
    setApprovals((as) => as.map((a) => a.id === id ? { ...a, resolved: "approved" } : a));
    if (id === "a1") {
      setStep("m1", "builder", "completed");
      setStep("m1", "orchestrator", "running");
      toast("Approved. Builder opened PR #214 and resumed.");
      timersRef.current.push(setTimeout(() => {
        setStep("m1", "orchestrator", "completed", { status: "completed" });
        toast("Mission completed. Historian wrote the learning to memory.");
      }, 3800));
    } else if (id === "a2") {
      setMissions((ms) => ms.map((m) => m.id === "m2" ? { ...m, status: "completed", steps: m.steps.map((s) => ({ ...s, status: "completed" })) } : m));
      toast("Approved. Changelog published, email snippet queued.");
    } else {
      toast("Approved. The queue re-ranked, checkout is #1.");
    }
  };

  const reject = (id) => {
    setApprovals((as) => as.map((a) => a.id === id ? { ...a, resolved: "rejected" } : a));
    if (id === "a1") {
      setStep("m1", "builder", "planned", { status: "waiting" });
      toast("Rejected. Nothing ran, the branch is parked.");
    } else {
      toast("Rejected. Nothing ran.");
    }
  };

  const retry = (missionId) => {
    setMissions((ms) => ms.map((m) => m.id !== missionId ? m : {
      ...m, status: "running",
      steps: m.steps.map((s) => s.status === "failed" ? { ...s, status: "running", note: "retry · updated Marketer prompt, attempt 3" } : s)
    }));
    toast("Mission re-dispatched. Marketer is retrying with the updated prompt.");
    timersRef.current.push(setTimeout(() => {
      setMissions((ms) => ms.map((m) => m.id !== missionId ? m : {
        ...m, status: "completed",
        steps: m.steps.map((s) => ({ ...s, status: "completed", note: "voice check passed · score 93" }))
      }));
      toast("Retry succeeded. Voice check scored 93, emails are drafted.");
    }, 4200));
  };

  const m1 = missions.find((m) => m.id === "m1");
  const gateApproval = approvals.find((a) => a.id === "a1");
  const pendingCount = approvals.filter((a) => !a.resolved).length;
  const runningCount = missions.filter((m) => m.status === "running").length + 2;

  const crumbs = {
    home: [workspace.name, "Today"],
    chat: [workspace.name, "Chat"],
    missions: [workspace.name, "Missions"],
    mission: [workspace.name, "Missions", (missions.find((m) => m.id === route.missionId) || {}).title || ""],
    product: [workspace.name, "Product"],
    knowledge: [workspace.name, "Knowledge"],
    govern: [workspace.name, "Govern"],
    settings: [workspace.name, "Settings"]
  }[route.name] || [workspace.name];

  const go = (r) => setRoute(typeof r === "string" ? { name: r } : r);

  /* First-run surfaces render full-screen, outside the shell. */
  if (route.name === "login") {
    return (
      <React.Fragment>
        <LoginScreen onContinue={() => setRoute({ name: "onboarding" })} />
        {buildPill ? <ConstructionPill onDismiss={() => setBuildPill(false)} /> : null}
        <CommandPalette open={cmdk} onClose={() => setCmdk(false)} onGo={go} />
      </React.Fragment>);

  }
  if (route.name === "onboarding") {
    return (
      <React.Fragment>
        <OnboardingScreen onFinish={(goal) => {
          setRoute({ name: "home" });
          toast(`First mission dispatched: ${goal}. Watch it in Missions.`);
        }} />
        <Toasts toasts={toasts} />
        <CommandPalette open={cmdk} onClose={() => setCmdk(false)} onGo={go} />
      </React.Fragment>);

  }

  let screen = null;
  if (route.name === "home") screen = <HomeScreen approvals={approvals} onApprove={approve} onReject={reject} onGo={go} runningCount={runningCount} />;else
  if (route.name === "chat") screen = <ChatScreen mission={m1} gateApproval={gateApproval} onApprove={approve} onReject={reject} onGo={go} onToast={toast} />;else
  if (route.name === "missions") screen = <MissionsScreen missions={missions} onGo={go} />;else
  if (route.name === "mission") {
    const m = missions.find((x) => x.id === route.missionId) || m1;
    screen = <MissionDetail mission={m} gateApproval={m.id === "m1" ? gateApproval : null} onApprove={approve} onReject={reject} onGo={go} onRetry={retry} />;
  } else
  if (route.name === "product") screen = <ProductScreen onGo={go} onToast={toast} />;else
  if (route.name === "knowledge") screen = <KnowledgeScreen onGo={go} />;else
  if (route.name === "govern") screen = <GovernScreen key={route.tab || "Controls"} initialTab={route.tab} approvals={approvals} onApprove={approve} onReject={reject} onGo={go} onToast={toast} />;else
  if (route.name === "settings") screen = <SettingsScreen workspace={workspace} onToast={toast} />;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar route={route} onGo={go} pendingCount={pendingCount} onOpenCmdk={() => setCmdk(true)} workspace={workspace} onWorkspaceAction={workspaceAction} theme={t.dark ? "dark" : "light"} onToggleTheme={() => setTweak("dark", !t.dark)} runningCount={runningCount} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--paper)" }}>
        <TopBar crumbs={crumbs} />
        {banner ? <CookingBanner missions={missions} onGo={go} onDismiss={() => setBanner(false)} /> : null}
        <main className="scrollbar-thin" style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 0, display: route.name === "chat" ? "flex" : "block", flexDirection: "column" }}>
            {route.name === "chat" ? <div style={{ flex: 1, minHeight: 0 }}>{screen}</div> : screen}
          </div>
        </main>
      </div>

      <CommandPalette open={cmdk} onClose={() => setCmdk(false)} onGo={go} />
      <Toasts toasts={toasts} />
      {buildPill ? <ConstructionPill onDismiss={() => setBuildPill(false)} /> : null}

      <TweaksPanel>
        <TweakSection label="Brand" />
        <TweakRadio label="Accent" value={t.accent} options={["ember", "rust", "marigold"]} onChange={(v) => setTweak("accent", v)} />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        <TweakSection label="Feel" />
        <TweakRadio label="Density" value={t.density} options={["comfortable", "compact"]} onChange={(v) => setTweak("density", v)} />
        <TweakToggle label="Motion" value={t.motion} onChange={(v) => setTweak("motion", v)} />
      </TweaksPanel>
    </div>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);