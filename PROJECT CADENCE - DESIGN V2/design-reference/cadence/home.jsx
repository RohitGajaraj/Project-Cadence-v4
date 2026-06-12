// Home · Today — the daily ritual: hero band, the calls queue, brief, agent rail, bento tabs.
const { useState: useStateH } = React;

function ApprovalRow({ a, onApprove, onReject, onOpenMission }) {
  const resolved = a.resolved; // "approved" | "rejected" | undefined
  return (
    <div title={a.summary} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "9px 14px",
      border: "1px solid var(--hairline)", borderRadius: 8,
      opacity: resolved ? 0.45 : 1, transition: "opacity var(--dur-slow)",
      background: "var(--canvas)"
    }} className="fade-up lift">
      <StepDot status={resolved ? resolved === "approved" ? "completed" : "failed" : "gate"} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 8, overflow: "hidden" }}>
        <span className="mono-label" style={{ color: "var(--ink)" }}>{a.agent}</span>
        <span className="mono-label" style={{ color: "var(--agent)", fontSize: 10 }}>{a.tool}</span>
        <span style={{ fontSize: 12.5, color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.summary}</span>
      </div>
      <span className="mono-label" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, flexShrink: 0 }}>
        <IcClock size={10} />{a.expires}
      </span>
      {resolved ?
      <span className="mono-label" style={{ flexShrink: 0, color: resolved === "approved" ? "var(--deep-green)" : "var(--coral)" }}>
          {resolved === "approved" ? "approved · agent resumed" : "rejected · nothing ran"}
        </span> :
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <button className="btn btn-approve btn-sm" onClick={() => onApprove(a.id)}><IcCheck size={11} />{a.consequence}</button>
          <button className="btn btn-reject btn-sm" onClick={() => onReject(a.id)}><IcX size={11} />{a.reject}</button>
          {a.missionId ?
        <button title="Open mission" aria-label="Open mission" className="btn btn-sm" style={{ color: "var(--action-blue)", padding: "4px 6px" }} onClick={() => onOpenMission(a.missionId)}>
              <IcExternal size={12} />
            </button> :
        null}
        </div>
      }
    </div>);

}

function AgentChip({ agent }) {
  return (
    <div className="lift" style={{
      minWidth: 148, flex: "0 0 auto", borderRadius: 8, border: "1px solid var(--hairline)",
      background: "var(--soft-stone)", padding: "10px 12px", position: "relative", overflow: "hidden"
    }}>
      <div className="mono-label" style={{ fontSize: 9 }}>{agent.role}</div>
      <div className="font-display" style={{ fontSize: 15, marginTop: 2 }}>{agent.name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, fontSize: 10.5, color: "var(--ink-subtle)" }}>
        <StepDot status={agent.status === "running" ? "running" : agent.status === "gate" || agent.status === "waiting" ? "gate" : "planned"} />
        {agent.note}
      </div>
    </div>);

}

function PriorityBars() {
  const rows = window.CADENCE_DATA.priorities;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r) =>
      <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ color: "var(--ink-muted)" }}>{r.label}</span>
            <span className="tabular mono-label" style={{ color: r.trend === "up" ? "var(--deep-green)" : r.trend === "down" ? "var(--ink-faint)" : "var(--ink-subtle)" }}>
              {r.score}{r.trend === "up" ? " ↑" : r.trend === "down" ? " ↓" : ""}
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${r.score}%`, borderRadius: 99, background: r.score > 75 ? "var(--coral)" : "var(--ink-subtle)", transition: "width var(--dur-slow)" }}></div>
          </div>
        </div>
      )}
    </div>);

}

function TasksPanel() {
  const [tasks, setTasks] = useStateH(window.CADENCE_DATA.tasks);
  const [draft, setDraft] = useStateH("");
  const toggle = (id) => setTasks((ts) => ts.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  const add = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setTasks((ts) => [...ts, { id: "t" + Date.now(), text: draft.trim(), done: false, deep: false }]);
    setDraft("");
  };
  return (
    <section className="bento" style={{ gridColumn: "span 7" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <MonoLabel icon={IcCheck}>Today's tasks</MonoLabel>
        <span className="mono-label tabular">{tasks.filter((t) => !t.done).length} open</span>
      </div>
      <form onSubmit={add} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input className="input" value={draft} placeholder="Add a task…" onChange={(e) => setDraft(e.target.value)} />
        <button className="btn btn-ghost" type="submit" aria-label="Add task"><IcPlus size={13} /></button>
      </form>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {tasks.map((t) =>
        <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", borderRadius: 6, cursor: "pointer", fontSize: 13.5 }}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} style={{ accentColor: "var(--deep-green)" }} />
            <span style={{ flex: 1, color: t.done ? "var(--ink-faint)" : "var(--ink)", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
            {t.deep ? <span className="mono-label" style={{ fontSize: 9, color: "var(--coral)", border: "1px solid color-mix(in oklab, var(--coral) 50%, transparent)", borderRadius: 99, padding: "1px 7px" }}>deep</span> : null}
          </label>
        )}
      </div>
    </section>);

}

function HomeScreen({ approvals, onApprove, onReject, onGo, runningCount }) {
  const D = window.CADENCE_DATA;
  const [tab, setTab] = useStateH("overview");
  const pending = approvals.filter((a) => !a.resolved);
  const cleared = approvals.length - pending.length;
  const callWord = pending.length === 0 ? null : ["", "One call is", "Two calls are", "Three calls are"][pending.length] || `${pending.length} calls are`;

  return (
    <div data-screen-label="Home · Today" style={{ padding: "30px 44px 56px", maxWidth: 1120, margin: "0 auto" }}>
      {/* HERO */}
      <section className="hero-editorial rise" style={{ padding: "26px 30px", marginBottom: 24 }}>
        <div className="hero-ghost-mark" aria-hidden="true"><CadenceMark size={230} tile={false} /></div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 32, position: "relative", zIndex: 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <MonoLabel icon={IcSparkles} style={{ color: "color-mix(in oklab, var(--hero-ink) 65%, transparent)", whiteSpace: "nowrap" }}>Workspace · Today</MonoLabel>
            <h1 style={{ fontSize: "clamp(21px, 2.2vw, 27px)", lineHeight: 1.18, margin: "8px 0 6px" }}>
              {callWord ? <React.Fragment>Morning, {D.user.name}. <em>{callWord.split(" ").slice(0, 2).join(" ")}</em> {callWord.split(" ").slice(2).join(" ")} waiting on you.</React.Fragment> :
              <React.Fragment>Morning, {D.user.name}. <em>All clear.</em> The loop is running itself.</React.Fragment>}
            </h1>
            <p style={{ fontSize: 12.5, color: "color-mix(in oklab, var(--hero-ink) 70%, transparent)", maxWidth: 520 }}>
              The swarm ran overnight: 14 signals in, one mission at a gate, one PR ready. Everything else is handled.
            </p>
            <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
              {[[`${pending.length} calls`, "waiting on you"], [`${runningCount} missions`, "running now"], [`$${D.budget.todayBurn.toFixed(2)}`, `of $${D.budget.todayCap} today`]].map(([v, s]) =>
              <span key={s} className="mono-label" style={{ color: "color-mix(in oklab, var(--hero-ink) 60%, transparent)", whiteSpace: "nowrap" }}>
                  <strong style={{ color: "var(--hero-ink)", fontWeight: 600 }}>{v}</strong> {s}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }} title="Approve or reject the calls in the queue below — this ring fills as you clear them.">
            {(() => {
              const R = 30,C = 2 * Math.PI * R;
              const frac = approvals.length ? cleared / approvals.length : 1;
              return (
                <svg width="84" height="84" viewBox="0 0 84 84" aria-label={`${cleared} of ${approvals.length} calls cleared`}>
                  <circle cx="42" cy="42" r={R} fill="none" stroke="color-mix(in oklab, var(--hero-ink) 16%, transparent)" strokeWidth="5"></circle>
                  <circle cx="42" cy="42" r={R} fill="none" stroke="var(--ember)" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 42 42)"
                  style={{ transition: "stroke-dashoffset var(--dur-slow) var(--ease-out)" }}></circle>
                  <text x="42" y="40" textAnchor="middle" style={{ fill: "var(--hero-ink)", fontFamily: "'Newsreader', serif", fontSize: 20 }} className="tabular">{cleared}/{approvals.length}</text>
                  <text x="42" y="54" textAnchor="middle" style={{ fill: "color-mix(in oklab, var(--hero-ink) 55%, transparent)", fontFamily: "'JetBrains Mono', monospace", fontSize: 6.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>cleared</text>
                </svg>);

            })()}
            <div className="mono-label" style={{ fontSize: 8.5, color: "color-mix(in oklab, var(--hero-ink) 50%, transparent)", marginTop: 2 }}>{pending.length === 0 ? "queue clear · day is yours" : "clear the queue to free your day"}</div>
          </div>
        </div>
      </section>

      {/* NEEDS YOU */}
      <section className="bento rise-2" style={{ padding: "14px var(--card-pad)", marginBottom: 24 }} data-comment-anchor="needs-you">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <MonoLabel icon={IcShield}>Needs you · {pending.length} call{pending.length === 1 ? "" : "s"}</MonoLabel>
          <button className="mono-label" style={{ color: "var(--action-blue)" }} onClick={() => onGo({ name: "govern" })}>All approvals →</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {approvals.map((a) =>
          <ApprovalRow key={a.id} a={a} onApprove={onApprove} onReject={onReject}
          onOpenMission={(id) => onGo({ name: "mission", missionId: id })} />
          )}
        </div>
      </section>

      {/* BRIEF */}
      <section className="bento rise-3" style={{ padding: "var(--card-pad)", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <MonoLabel icon={IcSparkles}>Today's brief</MonoLabel>
          <span className="mono-label">drafted 06:30 by Historian</span>
        </div>
        <ul style={{ paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
          {D.brief.map((b, i) =>
          <li key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.55 }}>
              <span style={{ color: "var(--coral)", flexShrink: 0, marginTop: 1 }}>·</span>
              <span>{b.text} {b.cites.map((n) => <Cite key={n} n={n} />)}</span>
            </li>
          )}
        </ul>
      </section>

      {/* AGENT RAIL */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 2px", marginBottom: 10 }}>
          <MonoLabel icon={IcBot}>AI agents</MonoLabel>
          <span className="mono-label">{D.agents.length} on staff · {D.agents.filter((a) => a.status === "running").length} running</span>
        </div>
        <div className="scrollbar-thin" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {D.agents.map((a) => <AgentChip key={a.slug} agent={a} />)}
        </div>
      </section>

      {/* TABS — merged per blueprint: Overview absorbs Pulse */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--hairline)", marginBottom: 18 }}>
        {[["overview", "Overview"], ["agents", "Agent activity"]].map(([id, label]) =>
        <button key={id} onClick={() => setTab(id)} style={{
          padding: "7px 13px", fontSize: 12.5, marginBottom: -1,
          color: tab === id ? "var(--ink)" : "var(--ink-subtle)",
          borderBottom: `2px solid ${tab === id ? "var(--ink)" : "transparent"}`,
          fontWeight: tab === id ? 500 : 400
        }}>{label}</button>
        )}
      </div>

      {tab === "overview" ?
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
          <section className="bento" style={{ gridColumn: "span 5" }}>
            <MonoLabel icon={IcTarget} style={{ marginBottom: 14 }}>Priority alignment</MonoLabel>
            <PriorityBars />
          </section>
          <section className="band-stone" style={{ gridColumn: "span 7" }}>
            <MonoLabel icon={IcZap} style={{ marginBottom: 12 }}>State of the product</MonoLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {[["Guest checkout", "51%", "was 64%", "var(--rose)"], ["Weekly actives", "12.4k", "+3% wow", "var(--emerald)"], ["Support volume", "−12%", "since hotfix", "var(--emerald)"], ["NPS (rolling)", "44", "flat", "var(--ink-subtle)"]].map(([l, v, s, c]) =>
            <div key={l}>
                  <div className="mono-label" style={{ fontSize: 8.5 }}>{l}</div>
                  <div className="font-display tabular" style={{ fontSize: 22, marginTop: 2, color: c }}>{v}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{s}</div>
                </div>
            )}
            </div>
            <div style={{ borderTop: "1px solid var(--hairline)", marginTop: 12, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {D.pulse.map((p) =>
            <div key={p.who} style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span className="mono-label" style={{ fontSize: 8.5, color: "var(--ink)", flexShrink: 0 }}>{p.who}</span>
                  <span style={{ color: "var(--ink-subtle)" }}>{p.note}</span>
                </div>
            )}
            </div>
          </section>
          <TasksPanel />
          <section className="bento" style={{ gridColumn: "span 5", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <MonoLabel icon={IcFocus} style={{ marginBottom: 6 }}>Deep work</MonoLabel>
              <span className="font-display tabular" style={{ fontSize: 24 }}>2h 40m</span>
              <span style={{ fontSize: 12, color: "var(--ink-subtle)" }}> protected · two deep tasks queued</span>
            </div>
            <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 10 }}>
              <MonoLabel icon={IcCalendar} style={{ marginBottom: 8 }}>Today's meetings</MonoLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {D.meetings.map((m) =>
              <div key={m.title} style={{ fontSize: 12.5, display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span className="mono-label tabular" style={{ color: "var(--ink)", flexShrink: 0 }}>{m.time}</span>
                    <span style={{ color: "var(--ink-muted)" }}>{m.title} <span style={{ color: "var(--ink-faint)", fontSize: 11 }}>· {m.note}</span></span>
                  </div>
              )}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginTop: "auto" }} onClick={() => onGo({ name: "chat" })}>
              Hand me a goal<IcChevRight size={12} />
            </button>
          </section>
        </div> :
      null}

      {tab === "agents" ?
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
          <section className="bento" style={{ gridColumn: "span 8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <MonoLabel icon={IcActivity}>Agent activity</MonoLabel>
              <span className="mono-label">last 12h</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
            ["09:41", "Builder", "CI pass on cad/checkout-guest, requesting PR gate", "gate"],
            ["09:12", "Scout", "Filed theme \"Checkout drop-off\" from 9 clustered signals", "completed"],
            ["08:55", "Scribe", "Revised saved carts v2 spec, 3 Critic comments open", "running"],
            ["07:58", "Inspector", "Quality gate on smart retry · score 94", "completed"],
            ["07:40", "Marketer", "Drafted changelog for smart retry, holding for approval", "gate"],
            ["06:30", "Historian", "Wrote the morning brief to memory", "completed"]].
            map(([time, agent, text, status], i) =>
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "8px 0", borderBottom: i < 5 ? "1px solid var(--hairline)" : "none", fontSize: 13 }}>
                  <span className="mono-label tabular" style={{ width: 42, flexShrink: 0 }}>{time}</span>
                  <StepDot status={status} />
                  <span className="mono-label" style={{ color: "var(--agent)", width: 78, flexShrink: 0 }}>{agent}</span>
                  <span style={{ color: "var(--ink-muted)" }}>{text}</span>
                </div>
            )}
            </div>
          </section>
          <section className="bento" style={{ gridColumn: "span 4" }}>
            <MonoLabel icon={IcGauge} style={{ marginBottom: 12 }}>Throughput</MonoLabel>
            {[["Missions completed", "11", "this week"], ["Median run time", "26m", "goal to done"], ["Gate response", "18m", "your median"]].map(([l, v, s]) =>
          <div key={l} style={{ marginBottom: 14 }}>
                <div className="mono-label">{l}</div>
                <div className="font-display tabular" style={{ fontSize: 26, marginTop: 2 }}>{v}</div>
                <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{s}</div>
              </div>
          )}
          </section>
        </div> :
      null}

      {tab === "pulse" ?
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
          <section className="bento" style={{ gridColumn: "span 6" }}>
            <MonoLabel icon={IcUsers} style={{ marginBottom: 12 }}>Stakeholder pulse</MonoLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {D.pulse.map((p) =>
            <div key={p.who} style={{ fontSize: 13 }}>
                  <span className="mono-label" style={{ color: "var(--ink)" }}>{p.who}</span>
                  <p style={{ color: "var(--ink-muted)", marginTop: 2 }}>{p.note}</p>
                </div>
            )}
            </div>
          </section>
          <section className="band-stone" style={{ gridColumn: "span 6" }}>
            <MonoLabel icon={IcZap} style={{ marginBottom: 12 }}>Product health</MonoLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[["Guest checkout", "51%", "completion, was 64%", "var(--rose)"], ["Weekly actives", "12.4k", "+3% wow", "var(--deep-green)"], ["Support volume", "−12%", "since hotfix", "var(--deep-green)"], ["NPS (rolling)", "44", "flat", "var(--ink-subtle)"]].map(([l, v, s, c]) =>
            <div key={l}>
                  <div className="mono-label">{l}</div>
                  <div className="font-display tabular" style={{ fontSize: 26, marginTop: 2, color: c }}>{v}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{s}</div>
                </div>
            )}
            </div>
          </section>
        </div> :
      null}

      <footer style={{ marginTop: 44, paddingTop: 18, borderTop: "1px solid var(--hairline)", display: "flex", justifyContent: "space-between" }} className="mono-label">
        <span>Cadence · agents execute, you govern</span>
        <span title="Continuously built — this stamp updates with every build">Last build · {new Date(document.lastModified).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
      </footer>
    </div>);

}

Object.assign(window, { HomeScreen, ApprovalRow });