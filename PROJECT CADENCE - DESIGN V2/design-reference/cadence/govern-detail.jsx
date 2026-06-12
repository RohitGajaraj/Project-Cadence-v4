// Govern drill-downs — eval suite detail, analytics ranges + per-agent detail,
// trace replay, drift detail. Same principle everywhere: every aggregate row
// opens a screen that explains itself (GitHub-style list → detail).
const { useState: useStateG } = React;

/* Tiny inline trend chart — no axes, indigo line, dot on the last point. */
function Sparkline({ data, color = "var(--action-blue)", w = 150, h = 36, baseline }) {
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const px = (i) => 4 + i * ((w - 8) / (data.length - 1));
  const py = (v) => h - 5 - (v - min) / span * (h - 10);
  const pts = data.map((v, i) => `${px(i)},${py(v)}`).join(" ");
  return (
    <svg width={w} height={h} aria-hidden="true" style={{ display: "block" }}>
      {baseline != null && baseline >= min && baseline <= max ?
      <line x1="4" x2={w - 4} y1={py(baseline)} y2={py(baseline)} stroke="var(--hairline-strong)" strokeDasharray="3 3"></line> : null}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"></polyline>
      <circle cx={px(data.length - 1)} cy={py(data[data.length - 1])} r="2.5" fill={color}></circle>
    </svg>);
}

/* Back link + title row shared by every drill-down screen. */
function DrillHeader({ onBack, backLabel, kicker, title, right }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <button className="mono-label" style={{ color: "var(--action-blue)", marginBottom: 10 }} onClick={onBack}>← {backLabel}</button>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <MonoLabel>{kicker}</MonoLabel>
          <div className="font-display" style={{ fontSize: 21, marginTop: 2 }}>{title}</div>
        </div>
        {right || null}
      </div>
    </div>);
}

/* Pill-row sub-navigation inside a drill-down (Runs / Failing cases / Config). */
function SubTabs({ tabs, active, onSet }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {tabs.map((t) =>
      <button key={t} onClick={() => onSet(t)} className="mono-label" style={{
        padding: "5px 11px", borderRadius: 99, fontSize: 9.5,
        color: t === active ? "var(--canvas)" : "var(--ink-subtle)",
        background: t === active ? "var(--primary-ink)" : "transparent",
        border: `1px solid ${t === active ? "transparent" : "var(--hairline)"}`,
        transition: "background var(--dur-fast), color var(--dur-fast)"
      }}>{t}</button>
      )}
    </div>);
}

const HOP_DOT = { completed: "dot-completed", gate: "dot-gate", failed: "dot-failed", planned: "dot-planned", running: "dot-running" };

/* ---------- Evals → suite detail ---------- */
function EvalDetail({ name, onBack, onToast }) {
  const D = window.CADENCE_DATA;
  const d = D.governDetail.evalDetail[name];
  const meta = D.evals.find((e) => e.name === name) || {};
  const [sub, setSub] = useStateG("Runs");
  if (!d) return null;
  const below = meta.score < d.threshold;
  return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="All eval suites" kicker={`Eval suite · ${d.cadence}`} title={name}
      right={<button className="btn btn-ghost btn-sm" onClick={() => onToast(`${name}: re-run dispatched on ${d.dataset.toLowerCase()}.`)}>Re-run suite · ~2 min</button>} />

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 6 }}>Latest score</MonoLabel>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="font-display tabular" style={{ fontSize: 32, color: below ? "var(--ember)" : undefined }}>{meta.score}</span>
            <span className="mono-label" style={{ color: below ? "var(--ember)" : "var(--emerald)" }}>{below ? `below gate ${d.threshold}` : `gate ${d.threshold} ✓`}</span>
          </div>
        </div>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 8 }}>Trend · last 8 runs</MonoLabel>
          <Sparkline data={d.history} baseline={d.threshold} w={210} h={42} color={below ? "var(--ember)" : "var(--action-blue)"} />
        </div>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 6 }}>Dataset</MonoLabel>
          <div style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.5 }}>{d.dataset}<br /><span style={{ color: "var(--ink-subtle)" }}>owner · {d.owner}</span></div>
        </div>
      </div>

      <SubTabs tabs={["Runs", "Failing cases", "Config"]} active={sub} onSet={setSub} />

      {sub === "Runs" ?
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "80px 100px 70px 60px 110px 1fr", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
            <span>Run</span><span>When</span><span>Prompt</span><span>Score</span><span>Pass / fail</span><span></span>
          </div>
          {d.runs.map((r, i) =>
        <div key={r.id} style={{ display: "grid", gridTemplateColumns: "80px 100px 70px 60px 110px 1fr", gap: 12, padding: "11px 18px", alignItems: "center", borderBottom: i < d.runs.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 12.5 }}>
              <span className="mono-label" style={{ color: "var(--ink)" }}>{r.id}</span>
              <span style={{ color: "var(--ink-subtle)" }}>{r.when}</span>
              <span className="mono-label tabular">{r.version}</span>
              <span className="font-display tabular" style={{ fontSize: 16, color: r.score < d.threshold ? "var(--ember)" : "var(--ink)" }}>{r.score}</span>
              <span className="mono-label tabular"><span style={{ color: "var(--emerald)" }}>{r.pass} ✓</span> · <span style={{ color: r.fail ? "var(--rose)" : "var(--ink-faint)" }}>{r.fail} ✕</span></span>
              <span style={{ textAlign: "right" }}>
                <button className="mono-label" style={{ color: "var(--action-blue)", fontSize: 8.5 }} onClick={() => setSub("Failing cases")}>open cases →</button>
              </span>
            </div>
        )}
        </div> :
      sub === "Failing cases" ?
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {d.cases.map((c) =>
        <div key={c.name} className="bento">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="dot dot-failed"></span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                <span className="mono-label" style={{ color: "var(--rose)" }}>scored {c.score} · {c.verdict}</span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: "8px 0 6px", lineHeight: 1.5 }}>{c.got}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="mono-label" style={{ color: "var(--emerald)", flexShrink: 0 }}>fix</span>
                <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{c.fix}</span>
              </div>
            </div>
        )}
        </div> :

      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          {[["Judge", d.judge], ["Dataset", d.dataset], ["Gate threshold", `≥ ${d.threshold} — below this, the producing agent's output pauses at a gate`], ["Cadence", d.cadence], ["Owner", `${d.owner} — failures write a learning to memory automatically`]].map(([l, v], i, arr) =>
        <div key={l} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, padding: "12px 18px", borderBottom: i < arr.length - 1 ? "1px solid var(--hairline)" : "none" }}>
              <span className="mono-label">{l}</span>
              <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{v}</span>
            </div>
        )}
        </div>
      }
    </div>);
}

/* ---------- Analytics tab (range tabs + clickable per-agent rows) ---------- */
function AnalyticsTab({ onDrill }) {
  const D = window.CADENCE_DATA;
  const [range, setRange] = useStateG("30d");
  const a = D.governDetail.analytics[range];
  return (
    <div>
      <SubTabs tabs={["7d", "30d", "90d"]} active={range} onSet={setRange} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {a.stats.map(([l, v, s]) =>
        <div key={l} className="bento">
            <MonoLabel style={{ marginBottom: 6 }}>{l}</MonoLabel>
            <div className="font-display tabular" style={{ fontSize: 26 }}>{v}</div>
            <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{s}</div>
          </div>
        )}
        <div className="bento" style={{ gridColumn: "span 3" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <MonoLabel icon={IcGauge}>Spend by agent · {range}</MonoLabel>
            <span className="mono-label" style={{ fontSize: 8.5 }}>click an agent to drill down</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {a.perAgent.map((x) =>
            <button key={x.agent} className="lift" onClick={() => onDrill(x.agent)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 8px", borderRadius: 8, border: "1px solid transparent", textAlign: "left" }}>
                <span className="mono-label" style={{ width: 70, color: "var(--agent)" }}>{x.agent}</span>
                <span style={{ flex: 1, height: 5, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${x.pct}%`, background: "var(--ember)", opacity: 0.85 }}></span>
                </span>
                <span className="mono-label tabular" style={{ width: 56, textAlign: "right", color: "var(--ink)" }}>${x.spend.toFixed(2)}</span>
                <IcChevRight size={11} style={{ color: "var(--ink-faint)" }} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>);
}

/* ---------- Analytics → agent detail ---------- */
function AgentDetail({ agent, onBack, onGo, onToast }) {
  const D = window.CADENCE_DATA;
  const d = D.governDetail.agents[agent];
  if (!d) return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="Analytics" kicker="Agent rollup" title={agent} />
      <div className="bento" style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>Long-tail agents (Critic, Historian, Pricer, Orchestrator) are grouped here — each spends under $1/30d. Per-agent pages exist for the four largest spenders.</div>
    </div>);
  return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="Analytics" kicker={d.role} title={agent}
      right={<button className="btn btn-ghost btn-sm" onClick={() => onToast(`${agent}: per-agent budget cap opens in the full build.`)}>Set agent cap…</button>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
        {[["Spend · 30d", d.spend], ["Runs", d.runs], ["Tokens", d.tokens], ["p50 latency", d.p50]].map(([l, v]) =>
        <div key={l} className="bento">
            <MonoLabel style={{ marginBottom: 6 }}>{l}</MonoLabel>
            <div className="font-display tabular" style={{ fontSize: 24 }}>{v}</div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 10 }}>Daily spend · last 8 days</MonoLabel>
          <Sparkline data={d.trend} w={300} h={48} color="var(--ember)" />
        </div>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 10 }}>Top missions by cost</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {d.topMissions.map((m, i) =>
            <div key={m.title} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < d.topMissions.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 12.5 }}>
                {m.id ?
              <button style={{ color: "var(--action-blue)", textAlign: "left", flex: 1, fontWeight: 500 }} onClick={() => onGo({ name: "mission", missionId: m.id })}>{m.title}</button> :
              <span style={{ flex: 1, fontWeight: 500, color: "var(--ink-muted)" }}>{m.title}</span>}
                <span className="mono-label tabular">{m.runs} runs</span>
                <span className="mono-label tabular" style={{ color: "var(--ink)", width: 48, textAlign: "right" }}>{m.cost}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "80px 90px 1fr 60px 50px 60px 60px", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
          <span>Run</span><span>When</span><span>Mission</span><span>Tokens</span><span>Dur</span><span>Cost</span><span>Status</span>
        </div>
        {d.recent.map((r, i) =>
        <div key={r.id} style={{ display: "grid", gridTemplateColumns: "80px 90px 1fr 60px 50px 60px 60px", gap: 12, padding: "11px 18px", alignItems: "center", borderBottom: i < d.recent.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 12.5 }}>
            <span className="mono-label" style={{ color: "var(--ink)" }}>{r.id}</span>
            <span style={{ color: "var(--ink-subtle)" }}>{r.when}</span>
            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.mission}</span>
            <span className="mono-label tabular">{r.tokens}</span>
            <span className="mono-label tabular">{r.dur}</span>
            <span className="mono-label tabular" style={{ color: "var(--ink)" }}>{r.cost}</span>
            <span className="mono-label" style={{ color: r.status === "ok" ? "var(--emerald)" : "var(--ember)" }}>{r.status}</span>
          </div>
        )}
      </div>
    </div>);
}

/* ---------- Traces → hop-by-hop replay ---------- */
function TraceDetail({ id, onBack, onGo }) {
  const D = window.CADENCE_DATA;
  const tr = D.traces.find((t) => t.id === id) || {};
  const hops = D.governDetail.traceHops[id] || [];
  const mission = D.missions.find((m) => m.title === tr.mission);
  return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="All traces" kicker={`Trace · ${tr.hops} hops · ${tr.tokens} tokens · ${tr.cost}`} title={tr.mission}
      right={mission ?
      <button className="btn btn-ghost btn-sm" onClick={() => onGo({ name: "mission", missionId: mission.id })}><IcExternal size={11} />Open mission</button> :
      null} />
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "26px 90px 130px 1fr 60px 56px 50px", gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
          <span></span><span>Agent</span><span>Tool call</span><span>What happened</span><span>Dur</span><span>Tokens</span><span>Cost</span>
        </div>
        {hops.map((h, i) =>
        <div key={i} style={{ display: "grid", gridTemplateColumns: "26px 90px 130px 1fr 60px 56px 50px", gap: 10, padding: "12px 18px", alignItems: "center", borderBottom: i < hops.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 12.5, opacity: h.status === "planned" ? 0.55 : 1 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={`dot ${HOP_DOT[h.status] || "dot-planned"}`}></span>
            </span>
            <span className="mono-label" style={{ color: "var(--agent)" }}>{h.agent}</span>
            <span className="mono-label" style={{ color: "var(--ink-muted)" }}>{h.tool}</span>
            <span style={{ color: h.status === "failed" ? "var(--rose)" : h.status === "gate" ? "var(--ember)" : "var(--ink-muted)", fontWeight: h.status === "gate" ? 550 : 400 }}>{h.action}</span>
            <span className="mono-label tabular">{h.dur}</span>
            <span className="mono-label tabular">{h.tokens}</span>
            <span className="mono-label tabular" style={{ color: "var(--ink)" }}>{h.cost}</span>
          </div>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 10 }}>Showing tool-call hops. Reasoning steps between calls are folded — open the mission's raw trace for the full transcript.</p>
    </div>);
}

/* ---------- Drift → surface detail ---------- */
function DriftDetail({ surface, onBack, onToast }) {
  const D = window.CADENCE_DATA;
  const d = D.governDetail.driftDetail[surface];
  const row = D.drift.find((x) => x.surface === surface) || {};
  if (!d) return null;
  const watch = row.status === "watch";
  return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="All surfaces" kicker={d.window} title={surface}
      right={watch ?
      <button className="btn btn-primary btn-sm" onClick={() => onToast(`${surface}: eval re-running on the fresh sample.`)}>Re-sample now</button> :
      null} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 6 }}>Baseline → current</MonoLabel>
          <div className="font-display tabular" style={{ fontSize: 24 }}>{d.baseline} → <span style={{ color: watch ? "var(--ember)" : "var(--emerald)" }}>{d.current}</span></div>
        </div>
        <div className="bento" style={{ gridColumn: "span 2" }}>
          <MonoLabel style={{ marginBottom: 8 }}>Δ vs baseline · last 7 samples</MonoLabel>
          <Sparkline data={d.trend} baseline={0} w={300} h={42} color={watch ? "var(--ember)" : "var(--emerald)"} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 8 }}>Probable cause</MonoLabel>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: 0, lineHeight: 1.55 }}>{d.cause}</p>
          <MonoLabel style={{ margin: "12px 0 6px", color: watch ? "var(--ember)" : undefined }}>Action</MonoLabel>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: 0, lineHeight: 1.55 }}>{d.action}</p>
        </div>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 8 }}>Recent samples</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {d.samples.map((s, i) =>
            <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: i < d.samples.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 12.5 }}>
                <span className="mono-label" style={{ flexShrink: 0 }}>{s.when}</span>
                <span style={{ color: "var(--ink-muted)" }}>{s.note}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>);
}

Object.assign(window, { Sparkline, DrillHeader, SubTabs, EvalDetail, AnalyticsTab, AgentDetail, TraceDetail, DriftDetail });
