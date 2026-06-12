// Loop drill-downs — signal, opportunity, release, decision, learning,
// connector detail screens. Same list → detail principle as Govern
// (cadence/govern-detail.jsx provides DrillHeader / SubTabs / Sparkline).

/* ---------- Signals → theme detail ---------- */
function SignalDetail({ id, onBack, onGo, onToast, onDraftSpec, onOpenOpp }) {
  const D = window.CADENCE_DATA;
  const s = D.signals.find((x) => x.id === id);
  const d = D.loopDetail.signals[id];
  if (!s) return null;
  return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="All signals" kicker={`Signal theme · first seen ${d ? d.firstSeen : "—"} · clustered by ${d ? d.owner : "Scout"}`} title={s.theme}
      right={<button className="btn btn-primary btn-sm" onClick={() => onDraftSpec(s)}>Draft spec · Scribe starts now</button>} />

      <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 6 }}>Strength</MonoLabel>
          <div className="font-display tabular" style={{ fontSize: 30, color: s.strength > 75 ? "var(--ember)" : undefined }}>{s.strength}</div>
          <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{s.count} items · {s.fresh} fresh</div>
        </div>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 8 }}>Items / week · trend</MonoLabel>
          {d ? <Sparkline data={d.trend} w={210} h={42} color={s.strength > 75 ? "var(--ember)" : "var(--action-blue)"} /> : null}
        </div>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 8 }}>Sources</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(d ? d.breakdown : []).map(([src, n]) =>
            <div key={src} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mono-label" style={{ width: 64 }}>{src}</span>
                <span style={{ flex: 1, height: 4, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${n / s.count * 100}%`, background: "var(--ink-faint)" }}></span>
                </span>
                <span className="mono-label tabular">{n}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 12 }}>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 10 }}>Evidence · verbatim</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {(s.evidence || []).map((q, j) =>
            <div key={j} style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.55, display: "flex", gap: 8 }}>
                <span style={{ color: "var(--ember)", flexShrink: 0 }}>“</span><span>{q}</span>
              </div>
            )}
          </div>
        </div>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 10 }}>Where it went</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
            {d && d.linked.opportunity ?
            <div style={{ display: "flex", gap: 8 }}><span className="mono-label" style={{ width: 80, flexShrink: 0 }}>opportunity</span>
              <button style={{ color: "var(--action-blue)", textAlign: "left", fontWeight: 500 }} onClick={() => onOpenOpp(d.linked.opportunity)}>{d.linked.opportunity}</button></div> : null}
            {d && d.linked.spec ?
            <div style={{ display: "flex", gap: 8 }}><span className="mono-label" style={{ width: 80, flexShrink: 0 }}>spec</span>
              <span style={{ color: "var(--ink-muted)" }}>{d.linked.spec}</span></div> : null}
            {d && d.linked.missionId ?
            <div style={{ display: "flex", gap: 8 }}><span className="mono-label" style={{ width: 80, flexShrink: 0 }}>mission</span>
              <button style={{ color: "var(--action-blue)", textAlign: "left", fontWeight: 500 }} onClick={() => onGo({ name: "mission", missionId: d.linked.missionId })}>open the mission →</button></div> : null}
          </div>
          {d ? <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12, lineHeight: 1.5 }}>{d.note}</p> : null}
        </div>
      </div>
    </div>);
}

/* ---------- Opportunities → ICE detail ---------- */
function OpportunityDetail({ title, onBack, onGo, onToast, onGeneratePrd, onOpenSignal }) {
  const D = window.CADENCE_DATA;
  const o = D.opportunities.find((x) => x.title === title);
  const d = D.loopDetail.opportunities[title];
  if (!o || !d) return null;
  return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="All opportunities" kicker={`Rank #${o.rank} · ${o.status} · ${d.outcome}`} title={o.title}
      right={<button className="btn btn-primary btn-sm" onClick={() => onGeneratePrd(o)}>Generate PRD</button>} />

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 6 }}>ICE score</MonoLabel>
          <div className="font-display tabular" style={{ fontSize: 32 }}>{o.ice.toFixed(1)}</div>
          <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>reach {o.reach} · effort {o.effort}</div>
        </div>
        <div className="bento" style={{ gridColumn: "span 2" }}>
          <MonoLabel style={{ marginBottom: 10 }}>Breakdown · impact, confidence, ease</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {d.ice.map(([l, v]) =>
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="mono-label" style={{ width: 80 }}>{l}</span>
                <span style={{ flex: 1, height: 5, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${v * 10}%`, background: "var(--ember)", opacity: 0.85 }}></span>
                </span>
                <span className="mono-label tabular" style={{ width: 26, textAlign: "right", color: "var(--ink)" }}>{v.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 10 }}>Rescore history · outcome loop</MonoLabel>
          {d.rescores.length === 0 ?
          <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: 0 }}>No rescores yet — the outcome loop re-scores after every release that touches this theme.</p> :
          d.rescores.map((r, i) =>
          <div key={i} style={{ fontSize: 12.5, paddingBottom: i < d.rescores.length - 1 ? 8 : 0, marginBottom: i < d.rescores.length - 1 ? 8 : 0, borderBottom: i < d.rescores.length - 1 ? "1px solid var(--hairline)" : "none" }}>
              <span className="mono-label tabular" style={{ color: r.to >= r.from ? "var(--emerald)" : "var(--rose)" }}>{r.when} · {r.from.toFixed(1)} → {r.to.toFixed(1)}</span>
              <p style={{ color: "var(--ink-muted)", margin: "4px 0 0", lineHeight: 1.5 }}>{r.why}</p>
            </div>
          )}
        </div>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 10 }}>Lineage</MonoLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
            <div style={{ display: "flex", gap: 8 }}><span className="mono-label" style={{ width: 80, flexShrink: 0 }}>signals</span>
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {d.signals.map((sid) => {
                const sig = D.signals.find((x) => x.id === sid);
                return sig ? <button key={sid} style={{ color: "var(--action-blue)", fontWeight: 500 }} onClick={() => onOpenSignal(sid)}>{sig.theme} →</button> : null;
              })}
              </span>
            </div>
            {d.spec ? <div style={{ display: "flex", gap: 8 }}><span className="mono-label" style={{ width: 80, flexShrink: 0 }}>spec</span><span style={{ color: "var(--ink-muted)" }}>{d.spec}</span></div> : null}
            {d.missionId ?
            <div style={{ display: "flex", gap: 8 }}><span className="mono-label" style={{ width: 80, flexShrink: 0 }}>mission</span>
              <button style={{ color: "var(--action-blue)", textAlign: "left", fontWeight: 500 }} onClick={() => onGo({ name: "mission", missionId: d.missionId })}>open the mission →</button></div> : null}
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12, lineHeight: 1.5 }}>{o.rationale}</p>
        </div>
      </div>
    </div>);
}

/* ---------- Releases → outcome detail ---------- */
function ReleaseDetail({ version, onBack, onGo }) {
  const D = window.CADENCE_DATA;
  const r = D.releases.find((x) => x.version === version);
  const d = D.loopDetail.releases[version];
  if (!r || !d) return null;
  const bad = r.health !== "good";
  return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="All releases" kicker={`Release · ${r.when} · health ${r.health}`} title={`${r.version} — ${r.note.split(" · ")[0]}`}
      right={d.missionId ? <button className="btn btn-ghost btn-sm" onClick={() => onGo({ name: "mission", missionId: d.missionId })}><IcExternal size={11} />Open mission</button> : null} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 10 }}>What shipped</MonoLabel>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 7 }}>
            {d.shipped.map((x) => <li key={x} style={{ fontSize: 12.5, color: "var(--ink-muted)", display: "flex", gap: 8 }}><StepDot status={bad ? "failed" : "completed"} /><span>{x}</span></li>)}
          </ul>
          <MonoLabel style={{ margin: "14px 0 8px" }}>Signals closed</MonoLabel>
          {d.closed.length === 0 ?
          <p style={{ fontSize: 12.5, color: bad ? "var(--rose)" : "var(--ink-faint)", margin: 0 }}>{bad ? "None — this release opened a new signal theme instead." : "None recorded."}</p> :
          d.closed.map((x) => <p key={x} style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: "0 0 4px" }}>{x}</p>)}
        </div>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 10 }}>Outcome metrics · before → after</MonoLabel>
          {d.metrics.map(([l, b, a]) =>
          <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--hairline)", fontSize: 12.5 }}>
              <span style={{ flex: 1, color: "var(--ink-muted)" }}>{l}</span>
              <span className="mono-label tabular">{b}</span>
              <span className="mono-label">→</span>
              <span className="mono-label tabular" style={{ color: a.includes("regression") ? "var(--rose)" : "var(--emerald)" }}>{a}</span>
            </div>
          )}
          {d.note ? <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12, lineHeight: 1.5 }}>{d.note}</p> : null}
          {d.traceId ? <p className="mono-label" style={{ fontSize: 8.5, marginTop: 10 }}>full trace · {d.traceId} in Govern → Traces</p> : null}
        </div>
      </div>
    </div>);
}

/* ---------- Decisions → context detail ---------- */
function DecisionDetail({ title, onBack, onGo }) {
  const D = window.CADENCE_DATA;
  const row = D.decisions.find((x) => x.title === title);
  const d = D.loopDetail.decisions[title];
  if (!row || !d) return null;
  return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="All decisions" kicker={`Decision · ${row.when} · ${row.who} · cited by agents ${d.citedBy}× since`} title={row.title}
      right={d.missionId ? <button className="btn btn-ghost btn-sm" onClick={() => onGo({ name: "mission", missionId: d.missionId })}><IcExternal size={11} />Open mission</button> : null} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 8 }}>Context</MonoLabel>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: 0, lineHeight: 1.6 }}>{d.context}</p>
          <MonoLabel style={{ margin: "14px 0 6px" }}>Why</MonoLabel>
          <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: 0, lineHeight: 1.6 }}>{row.why}</p>
          <p className="mono-label" style={{ fontSize: 8.5, marginTop: 12 }}>source · {d.source}{d.traceId ? ` · trace ${d.traceId}` : ""}</p>
        </div>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 10 }}>Alternatives considered</MonoLabel>
          {d.alternatives.map(([opt, why], i) =>
          <div key={opt} style={{ paddingBottom: i < d.alternatives.length - 1 ? 9 : 0, marginBottom: i < d.alternatives.length - 1 ? 9 : 0, borderBottom: i < d.alternatives.length - 1 ? "1px solid var(--hairline)" : "none" }}>
              <div style={{ fontSize: 12.5, fontWeight: 550 }}>{opt}</div>
              <div style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 2, lineHeight: 1.5 }}>{why}</div>
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12 }}>Agents read this before any mission that touches the same surface — decisions are working memory, not minutes.</p>
        </div>
      </div>
    </div>);
}

/* ---------- Memory → learning detail ---------- */
function LearningDetail({ id, onBack, onGo }) {
  const D = window.CADENCE_DATA;
  const row = D.memoryFeed.find((x) => x.id === id);
  const d = D.loopDetail.learnings[id];
  if (!row || !d) return null;
  return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="All learnings" kicker={`Learning · ${row.when} · written by Historian after ${d.mission}`} title="What the swarm learned"
      right={d.missionId ? <button className="btn btn-ghost btn-sm" onClick={() => onGo({ name: "mission", missionId: d.missionId })}><IcExternal size={11} />Open mission</button> : null} />

      <div className="bento" style={{ marginBottom: 12 }}>
        <p style={{ fontFamily: "'Newsreader', serif", fontSize: 17, lineHeight: 1.55, color: "var(--ink)", margin: 0 }}>{row.text}</p>
        <p className="mono-label" style={{ fontSize: 8.5, marginTop: 10 }}>{d.trace ? `cited to trace ${d.trace}` : "captured from human input"} · applies to {d.appliesTo}</p>
      </div>

      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
          <span>When</span><span>Where this learning changed behavior</span>
        </div>
        {d.citedBy.map(([w, note], i) =>
        <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 12, padding: "11px 18px", borderBottom: i < d.citedBy.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 12.5 }}>
            <span className="mono-label tabular">{w}</span>
            <span style={{ color: "var(--ink-muted)" }}>{note}</span>
          </div>
        )}
      </div>
    </div>);
}

/* ---------- Connectors → sync detail ---------- */
function ConnectorDetail({ name, onBack, onToast }) {
  const D = window.CADENCE_DATA;
  const c = D.connectors.find((x) => x.name === name);
  const d = D.loopDetail.connectors[name];
  if (!c) return null;
  if (!d) return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="All connectors" kicker="Connector · not connected" title={name} />
      <div className="bento" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink-subtle)" }}>{c.desc}. Connect it and items start feeding the brain within minutes — everything it ingests is PII-scrubbed by the guardrail first.</span>
        <button className="btn btn-primary btn-sm" onClick={() => onToast(`${name} connect flow opens in the full build.`)}>Connect {name}</button>
      </div>
    </div>);
  return (
    <div className="fade-up">
      <DrillHeader onBack={onBack} backLabel="All connectors" kicker={`Connector · since ${d.since} · ${d.health}`} title={name}
      right={<button className="btn btn-ghost btn-sm" onClick={() => onToast(`${name} sync ran. Signals are fresh.`)}>Sync now</button>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
        {[["Last sync", d.lastSync], ["Items · 7d", d.itemsWeek], ["Health", d.health]].map(([l, v]) =>
        <div key={l} className="bento">
            <MonoLabel style={{ marginBottom: 6 }}>{l}</MonoLabel>
            <div className="font-display tabular" style={{ fontSize: 22, color: l === "Health" ? "var(--emerald)" : undefined }}>{v}</div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 12 }}>
        <div className="bento">
          <MonoLabel style={{ marginBottom: 10 }}>What it feeds</MonoLabel>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 7 }}>
            {d.feeds.map((f) => <li key={f} style={{ fontSize: 12.5, color: "var(--ink-muted)", display: "flex", gap: 8 }}><StepDot status="completed" /><span>{f}</span></li>)}
          </ul>
        </div>
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
            <span>When</span><span>Last items in</span>
          </div>
          {d.recent.map(([w, note], i) =>
          <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 12, padding: "11px 18px", borderBottom: i < d.recent.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 12.5 }}>
              <span className="mono-label tabular">{w}</span>
              <span style={{ color: "var(--ink-muted)" }}>{note}</span>
            </div>
          )}
        </div>
      </div>
    </div>);
}

Object.assign(window, { SignalDetail, OpportunityDetail, ReleaseDetail, DecisionDetail, LearningDetail, ConnectorDetail });
