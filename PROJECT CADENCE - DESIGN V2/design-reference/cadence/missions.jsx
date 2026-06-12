// Missions — list + Agents tab, and the mission detail page.
const { useState: useStateM } = React;

function MissionRow({ m, onOpen }) {
  const done = m.steps.filter((s) => s.status === "completed").length;
  return (
    <button onClick={() => onOpen(m.id)} className="bento" style={{
      display: "flex", alignItems: "center", gap: 16, width: "100%", textAlign: "left",
      padding: "13px 16px", transition: "border-color var(--dur-fast)",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--hairline-strong)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--hairline)"; }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="font-display" style={{ fontSize: 15.5 }}>{m.title}</span>
          <StatusBadge status={m.status} />
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginTop: 3 }}>{m.goal}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }} aria-label={`${done} of ${m.steps.length} steps complete`}>
        {m.steps.map((s, i) => <StepDot key={i} status={s.status} />)}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, width: 90 }}>
        <div className="mono-label tabular" style={{ color: "var(--ink)" }}>${m.cost.toFixed(2)}</div>
        <div className="mono-label" style={{ fontSize: 9 }}>{m.started}</div>
      </div>
      <IcChevRight size={14} style={{ color: "var(--ink-faint)" }} />
    </button>
  );
}

function MissionsScreen({ missions, onGo }) {
  const [tab, setTab] = useStateM("missions");
  const D = window.CADENCE_DATA;
  return (
    <div data-screen-label="Missions" style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
      <header style={{ marginBottom: 22 }}>
        <MonoLabel icon={IcActivity}>Loop · Build</MonoLabel>
        <h1 className="font-display" style={{ fontSize: 26, marginTop: 7, fontWeight: 430 }}>Missions</h1>
        <p style={{ fontSize: 13.5, color: "var(--ink-subtle)", marginTop: 4, maxWidth: 520 }}>
          Goal-driven runs across the agent mesh. Watch the work, jump into any step.
        </p>
      </header>

      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--hairline)", marginBottom: 18 }}>
        {[["missions", "Missions"], ["agents", "Agents"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "7px 13px", fontSize: 12.5, marginBottom: -1,
            color: tab === id ? "var(--ink)" : "var(--ink-subtle)",
            borderBottom: `2px solid ${tab === id ? "var(--ember)" : "transparent"}`,
            fontWeight: tab === id ? 500 : 400,
          }}>{label}</button>
        ))}
      </div>

      {tab === "missions" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {missions.map((m) => <MissionRow key={m.id} m={m} onOpen={(id) => onGo({ name: "mission", missionId: id })} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {D.agents.map((a) => (
            <div key={a.slug} className="bento" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="mono-label" style={{ fontSize: 9 }}>{a.role}</div>
                  <div className="font-display" style={{ fontSize: 17, marginTop: 2 }}>{a.name}</div>
                </div>
                <StepDot status={a.status === "running" ? "running" : a.status === "gate" || a.status === "waiting" ? "gate" : "planned"} />
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 10 }}>{a.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MissionDetail({ mission, gateApproval, onApprove, onReject, onGo, onRetry }) {
  const D = window.CADENCE_DATA;
  const live = mission.id === "m1";
  const [view, setView] = useStateM("plan");
  const [selStep, setSelStep] = useStateM(null);
  return (
    <div data-screen-label={`Mission · ${mission.title}`} style={{ padding: "30px 44px 56px", maxWidth: 860, margin: "0 auto" }}>
      <button onClick={() => onGo({ name: "missions" })} className="mono-label" style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 18, color: "var(--action-blue)" }}>
        ← All missions
      </button>

      <header className="hero-editorial" style={{ padding: "28px 32px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, position: "relative", zIndex: 1 }}>
          <div>
            <MonoLabel style={{ color: "color-mix(in oklab, var(--hero-ink) 60%, transparent)" }}>Mission · {mission.id}</MonoLabel>
            <h1 style={{ fontSize: 30, margin: "8px 0 6px", fontFamily: "'Newsreader', serif", fontWeight: 400, letterSpacing: "-0.02em" }}>{mission.title}</h1>
            <p style={{ fontSize: 13.5, color: "color-mix(in oklab, var(--hero-ink) 70%, transparent)" }}>{mission.goal}</p>
          </div>
          <StatusBadge status={mission.status} />
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 20, position: "relative", zIndex: 1, flexWrap: "wrap" }}>
          {[["started", mission.started], ["cost", `$${mission.cost.toFixed(2)}`], ["tokens", mission.tokens], ["trace", mission.traceId]].map(([l, v]) => (
            <span key={l} className="mono-label" style={{ color: "color-mix(in oklab, var(--hero-ink) 55%, transparent)" }}>
              {l} <strong style={{ color: "var(--hero-ink)", fontWeight: 600 }} className="tabular">{v}</strong>
            </span>
          ))}
        </div>
      </header>

      {/* Steps — plan list or live graph */}
      <section className="bento" style={{ padding: "var(--card-pad)", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <MonoLabel icon={IcBranch}>Plan · {mission.steps.length} specialists</MonoLabel>
          <div style={{ display: "flex", gap: 2, border: "1px solid var(--hairline)", borderRadius: 7, padding: 2 }}>
            {[["plan", "List"], ["graph", "Graph"]].map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} className="mono-label" style={{
                fontSize: 9, padding: "3px 10px", borderRadius: 5,
                background: view === id ? "var(--surface-2)" : "transparent",
                color: view === id ? "var(--ink)" : "var(--ink-subtle)",
              }}>{label}</button>
            ))}
          </div>
        </div>
        {view === "plan" ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {mission.steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "10px 0", borderBottom: i < mission.steps.length - 1 ? "1px solid var(--hairline)" : "none" }}>
              <span className="mono-label tabular" style={{ width: 18, textAlign: "right", marginTop: 2 }}>{i + 1}</span>
              <span style={{ marginTop: 6 }}><StepDot status={s.status} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="mono-label" style={{ color: "var(--agent)" }}>{s.agent}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 3 }}>{s.goal}</div>
                {s.note ? <div style={{ fontSize: 12, color: "var(--rose)", marginTop: 2 }}>{s.note}</div> : null}
              </div>
            </div>
          ))}
        </div>
        ) : (
        <MissionGraphView mission={mission} selStep={selStep} onSelect={setSelStep} />
        )}
      </section>

      {/* Gate */}
      {live && gateApproval ? (
        <section style={{ marginBottom: 16 }}>
          <GatePanel approval={gateApproval} onApprove={onApprove} onReject={onReject} />
        </section>
      ) : null}

      {/* Hops trace — per-hop expand/collapse, tinted tool calls, timing bars */}
      {live ? (
        <section className="bento" style={{ padding: "var(--card-pad)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <MonoLabel icon={IcActivity}>Execution trace</MonoLabel>
            <span className="mono-label">{D.hops.length} hops · live</span>
          </div>
          {D.hops.map((h, i) => <TraceHop key={i} h={h} defaultOpen={i === 0} />)}
        </section>
      ) : null}

      {/* Failed mission — visible retry path */}
      {mission.status === "failed" ? (
        <section className="fade-up" style={{
          padding: "14px 16px", borderRadius: 10, marginBottom: 16,
          background: "color-mix(in oklab, var(--rose) 7%, transparent)",
          border: "1px solid color-mix(in oklab, var(--rose) 35%, transparent)",
        }}>
          <div className="mono-label" style={{ color: "var(--rose)", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
            <IcX size={13} /> Failed · guardrail: voice check scored 82 and 84 (needs ≥ 90)
          </div>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: "6px 0 10px" }}>
            Historian suggests the fix: the brand voice eval penalizes exclamation density — the rewrite used 3× the baseline. Retry with the updated Marketer prompt.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-sm" onClick={() => onRetry(mission.id)}><IcReplay size={11} />Retry · updated prompt, same budget</button>
            <button className="btn btn-ghost btn-sm" onClick={() => onGo({ name: "govern", tab: "Guardrails" })}>View guardrail</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* TraceHop — collapsible hop with timing bar and tinted tool calls. */
function TraceHop({ h, defaultOpen }) {
  const [open, setOpen] = useStateM(!!defaultOpen);
  const tint = (st) => {
    if (st.startsWith("called")) return { color: "var(--agent)" };
    if (st.startsWith("thought")) return { color: "var(--ink-faint)", fontStyle: "italic" };
    if (st.startsWith("reply")) return { color: "var(--emerald)" };
    return { color: "var(--ink-subtle)" };
  };
  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginBottom: 10 }}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "4px 0" }}>
        {open ? <IcChevDown size={11} style={{ color: "var(--ink-faint)" }} /> : <IcChevRight size={11} style={{ color: "var(--ink-faint)" }} />}
        <span style={{ color: "var(--agent)", fontWeight: 600 }}>{h.agent} ({h.slug})</span>
        <span style={{ flex: 1, height: 3, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", maxWidth: 160 }}>
          <span style={{ display: "block", height: "100%", width: `${h.pct || 10}%`, background: h.status === "running" ? "var(--action-blue)" : "var(--emerald)" }}></span>
        </span>
        <span className="mono-label tabular" style={{ fontSize: 9 }}>{h.duration}</span>
        <StatusBadge status={h.status} />
      </button>
      {open ? (
        <div className="fade-up">
          {h.steps.map((st, j) => (
            <div key={j} style={{ paddingLeft: 22, lineHeight: 1.8, borderLeft: "1px solid var(--hairline)", marginLeft: 5, ...tint(st) }}>{st}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* MissionGraphView — the agent mesh as a live DAG. Orchestrator hub
   dispatches to specialist nodes; sequential edges show the handoff chain.
   Redesigned from the repo's MissionGraph in the Ember language. */
function MissionGraphView({ mission, selStep, onSelect }) {
  const steps = mission.steps;
  const NW = 138, NH = 54, GAP = 26;
  const width = Math.max(560, steps.length * (NW + GAP) + 20);
  const hubX = width / 2, hubY = 34;
  const nodeY = 118;
  const color = (st) => st === "completed" ? "var(--emerald)" : st === "running" ? "var(--action-blue)" : st === "gate" ? "var(--ember)" : st === "failed" ? "var(--rose)" : "var(--ink-faint)";
  const sel = selStep == null ? null : steps[selStep];
  return (
    <div>
      <div className="scrollbar-thin" style={{ overflowX: "auto" }}>
        <svg width={width} height={200} style={{ display: "block", minWidth: "100%" }} role="group" aria-label="Mission execution graph">
          {/* dispatch edges (hub → node), dashed */}
          {steps.map((s, i) => {
            const nx = 10 + i * (NW + GAP) + NW / 2;
            return <path key={"d" + i} d={`M ${hubX} ${hubY + 16} C ${hubX} ${hubY + 50}, ${nx} ${nodeY - 40}, ${nx} ${nodeY - 6}`}
              fill="none" stroke="var(--hairline-strong)" strokeWidth="1" strokeDasharray="3 4" opacity="0.7"></path>;
          })}
          {/* sequential edges */}
          {steps.slice(0, -1).map((s, i) => {
            const x1 = 10 + i * (NW + GAP) + NW, x2 = x1 + GAP;
            const done = s.status === "completed";
            return (
              <g key={"e" + i}>
                <line x1={x1} y1={nodeY + NH / 2} x2={x2} y2={nodeY + NH / 2}
                  stroke={done ? "var(--emerald)" : "var(--hairline-strong)"} strokeWidth="1.4"></line>
                <path d={`M ${x2 - 5} ${nodeY + NH / 2 - 3.5} L ${x2} ${nodeY + NH / 2} L ${x2 - 5} ${nodeY + NH / 2 + 3.5}`}
                  fill="none" stroke={done ? "var(--emerald)" : "var(--hairline-strong)"} strokeWidth="1.4"></path>
              </g>
            );
          })}
          {/* orchestrator hub */}
          <g>
            <circle cx={hubX} cy={hubY} r="15" fill="var(--hero-bg)"></circle>
            <circle cx={hubX} cy={hubY} r="4" fill="var(--ember)" className="gnode-live"></circle>
            <text x={hubX} y={hubY - 22} textAnchor="middle" style={{ fill: "var(--ink-subtle)", fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase" }}>orchestrator</text>
          </g>
          {/* specialist nodes */}
          {steps.map((s, i) => {
            const x = 10 + i * (NW + GAP);
            const active = selStep === i;
            const c = color(s.status);
            const liveNode = s.status === "running" || s.status === "gate";
            return (
              <g key={"n" + i} role="button" tabIndex={0} aria-label={`${s.agent} · ${s.status}`}
                style={{ cursor: "pointer" }} onClick={() => onSelect(active ? null : i)}>
                <rect x={x} y={nodeY} width={NW} height={NH} rx="10"
                  fill={active ? "var(--surface-2)" : "var(--canvas)"}
                  stroke={active ? "var(--hairline-strong)" : "var(--hairline)"} strokeWidth="1"></rect>
                <rect x={x} y={nodeY} width="3" height={NH} rx="1.5" fill={c} opacity="0.9"></rect>
                <circle cx={x + 16} cy={nodeY + 17} r="3.5" fill={c} className={liveNode ? "gnode-live" : undefined}></circle>
                <text x={x + 26} y={nodeY + 21} style={{ fill: "var(--agent)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600 }}>{s.agent}</text>
                <text x={x + 13} y={nodeY + 40} style={{ fill: "var(--ink-subtle)", fontFamily: "'JetBrains Mono', monospace", fontSize: 8 }}>{s.status}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {sel ? (
        <div className="fade-up" style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: "var(--surface-1)", border: "1px solid var(--hairline)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="mono-label" style={{ color: "var(--agent)" }}>{sel.agent}</span>
            <StatusBadge status={sel.status} />
            <span style={{ flex: 1 }}></span>
            <button className="mono-label" style={{ fontSize: 8.5, color: "var(--ink-faint)" }} onClick={() => onSelect(null)}>close</button>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 5 }}>{sel.goal}</div>
          {sel.note ? <div style={{ fontSize: 11.5, color: "var(--rose)", marginTop: 3 }}>{sel.note}</div> : null}
        </div>
      ) : (
        <div className="mono-label" style={{ fontSize: 8.5, marginTop: 8 }}>click a node for details · dashed = dispatch · solid = handoff</div>
      )}
    </div>
  );
}

Object.assign(window, { MissionsScreen, MissionDetail, MissionGraphView });
