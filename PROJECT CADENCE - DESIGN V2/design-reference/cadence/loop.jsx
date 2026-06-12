// Loop surfaces — Product (Signals), Knowledge, Govern (Approvals + Budgets).
const { useState: useStateL } = React;

function SurfaceHeader({ kicker, icon, title, sub }) {
  return (
    <header style={{ marginBottom: 26 }}>
      <MonoLabel icon={icon}>{kicker}</MonoLabel>
      <h1 className="font-display" style={{ fontSize: 26, marginTop: 7, fontWeight: 430 }}>{title}</h1>
      <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginTop: 3, maxWidth: 520 }}>{sub}</p>
    </header>);

}

function TabRow({ tabs, active, onSet, desc }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--hairline)", flexWrap: "wrap" }}>
        {tabs.map((t) =>
        <button key={t} onClick={() => onSet(t)} style={{
          padding: "7px 13px", fontSize: 12.5, marginBottom: -1,
          color: active === t ? "var(--ink)" : "var(--ink-subtle)",
          borderBottom: `2px solid ${active === t ? "var(--ember)" : "transparent"}`,
          fontWeight: active === t ? 500 : 400
        }}>{t}</button>
        )}
      </div>
      {desc && desc[active] ? <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8 }}>{desc[active]}</p> : null}
    </div>);

}

function EmptyState({ icon: Icon, title, body, cta, onCta }) {
  return (
    <div className="bento" style={{ padding: 48, textAlign: "center" }}>
      <span style={{ display: "inline-flex", width: 40, height: 40, borderRadius: 12, background: "var(--soft-stone)", alignItems: "center", justifyContent: "center", color: "var(--ink-subtle)", marginBottom: 14 }}>
        <Icon size={18} />
      </span>
      <h3 className="font-display" style={{ fontSize: 19 }}>{title}</h3>
      <p style={{ fontSize: 13, color: "var(--ink-subtle)", margin: "6px auto 16px", maxWidth: 360 }}>{body}</p>
      <button className="btn btn-primary" onClick={onCta}>{cta}</button>
    </div>);

}

const PRODUCT_DESC = {
  Signals: "Capture customer signals from anywhere; cluster them into actionable themes.",
  Opportunities: "Ranked by ICE. Generate a PRD with one click when you're ready to build.",
  Specs: "Product requirement docs. Draft from a brief, hand off to GitHub or Builder.",
  Roadmap: "Now / Next / Later lanes. Let AI plan the next two weeks or rebalance for you.",
  Tasks: "Per-task kanban for humans and agents. Import from Linear.",
  Releases: "Builder missions that completed end-to-end, with duration and cost."
};

function ProductScreen({ onGo, onToast }) {
  const D = window.CADENCE_DATA;
  const [tab, setTab] = useStateL("Signals");
  const [drill, setDrill] = useStateL(null);
  const [openSignal, setOpenSignal] = useStateL(null);
  const [queued, setQueued] = useStateL({});
  const [capture, setCapture] = useStateL("");
  const [extraSignals, setExtraSignals] = useStateL([]);
  const [extraSpecs, setExtraSpecs] = useStateL([]);
  const [lanes, setLanes] = useStateL(() => D.roadmap.map((c) => ({ quarter: c.quarter, items: [...c.items] })));
  const [dragItem, setDragItem] = useStateL(null);
  const [planPreview, setPlanPreview] = useStateL(null);
  const [kanban, setKanban] = useStateL(() => ({ todo: [...D.kanban.todo], doing: [...D.kanban.doing], done: [...D.kanban.done] }));
  const draftSpec = (s) => {
    setQueued((q) => ({ ...q, [s.id]: true }));
    onToast(`Mission queued: Scribe is drafting a spec for “${s.theme}”.`);
  };
  const captureSignal = (e) => {
    e.preventDefault();
    if (!capture.trim()) return;
    setExtraSignals((xs) => [{ id: "sx" + Date.now(), theme: capture.trim(), count: 1, sources: "Manual capture", fresh: "now", strength: 12, evidence: ["Captured by you, just now. Scout will cluster it on the next pass."] }, ...xs]);
    setCapture("");
    onToast("Signal captured. Scout clusters it on the next pass.");
  };
  const generatePrd = (o) => {
    setExtraSpecs((xs) => [{ title: o.title + " · PRD", state: "draft", critic: "running", cites: 7, updated: "just now" }, ...xs]);
    setTab("Specs");
    onToast(`PRD generated for “${o.title}”. Critic pass is running.`);
  };
  const moveLane = (item, toLane) => {
    setLanes((ls) => ls.map((l) => ({ ...l, items: l.quarter === toLane ? l.items.includes(item) ? l.items : [...l.items, item] : l.items.filter((x) => x !== item) })));
    onToast(`“${item}” → ${toLane}. Decision written to memory.`);
  };
  const commitPlan = () => {
    setKanban((k) => ({ ...k, todo: [...planPreview.tasks.map((t, i) => ({ id: "kp" + i, text: t, who: "Builder", agent: true })), ...k.todo] }));
    setPlanPreview(null);
    setTab("Tasks");
    onToast("Sprint committed. 3 tasks queued for the mesh.");
  };
  const allSignals = [...extraSignals, ...D.signals];
  const allSpecs = [...extraSpecs, ...D.specs];
  return (
    <div data-screen-label="Product" style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
      <SurfaceHeader kicker="Loop · Sense" icon={IcCompass} title="Product"
      sub="Discover, define, plan, and ship. One station for the whole product loop." />
      <TabRow tabs={["Signals", "Opportunities", "Specs", "Roadmap", "Tasks", "Releases"]} active={tab} onSet={(t) => {setTab(t);setDrill(null);}} desc={PRODUCT_DESC} />

      {tab === "Signals" ?
      (drill && drill.type === "signal" ?
      <SignalDetail id={drill.id} onBack={() => setDrill(null)} onGo={onGo} onToast={onToast} onDraftSpec={(s) => {draftSpec(s);setDrill(null);}} onOpenOpp={(title) => {setTab("Opportunities");setDrill({ type: "opp", title });}} /> :
      <div>
          <form onSubmit={captureSignal} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input className="input" value={capture} placeholder="Capture a signal — paste a quote, a ticket, a hallway comment…" onChange={(e) => setCapture(e.target.value)} />
            <button className="btn btn-primary" type="submit" style={{ flexShrink: 0 }}>Capture · Scout clusters it</button>
          </form>
        <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "14px 1fr 90px 170px 80px 130px 110px", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
            <span></span><span>Theme</span><span>Evidence</span><span>Sources</span><span>Fresh</span><span>Strength</span><span></span>
          </div>
          {allSignals.map((s, i) =>
          <React.Fragment key={s.id}>
              <div role="button" tabIndex={0} onClick={() => setOpenSignal(openSignal === s.id ? null : s.id)}
            onKeyDown={(e) => {if (e.key === "Enter") setOpenSignal(openSignal === s.id ? null : s.id);}}
            style={{ display: "grid", gridTemplateColumns: "14px 1fr 90px 170px 80px 130px 110px", gap: 12, padding: "13px 18px", alignItems: "center", borderBottom: openSignal === s.id || i < allSignals.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 13, cursor: "pointer" }}>
                <span style={{ color: "var(--ink-faint)", display: "inline-flex" }}>{openSignal === s.id ? <IcChevDown size={11} /> : <IcChevRight size={11} />}</span>
                <span style={{ fontWeight: 500 }}>{s.theme}</span>
                <span className="tabular" style={{ color: "var(--ink-muted)" }}>{s.count} items</span>
                <span style={{ color: "var(--ink-subtle)", fontSize: 12 }}>{s.sources}</span>
                <span className="mono-label tabular">{s.fresh}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, height: 4, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${s.strength}%`, background: s.strength > 75 ? "var(--ember)" : "var(--ink-faint)" }}></span>
                  </span>
                  <span className="mono-label tabular" style={{ width: 22 }}>{s.strength}</span>
                </span>
                {queued[s.id] ?
              <span className="mono-label" style={{ fontSize: 8.5, color: "var(--agent)", display: "inline-flex", alignItems: "center", gap: 5 }}><span className="spinner" style={{ width: 9, height: 9 }}></span>Scribe drafting</span> :

              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }}
              onClick={(e) => {e.stopPropagation();draftSpec(s);}}>Draft spec</button>
              }
              </div>
              {openSignal === s.id ?
            <div className="fade-up" style={{ padding: "12px 18px 14px 44px", background: "var(--surface-1)", borderBottom: i < allSignals.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <div className="mono-label" style={{ fontSize: 8.5 }}>Evidence · verbatim</div>
                    <span style={{ flex: 1 }}></span>
                    {D.loopDetail.signals[s.id] ?
                <button className="mono-label" style={{ fontSize: 8.5, color: "var(--action-blue)" }} onClick={() => setDrill({ type: "signal", id: s.id })}>open full signal — trend, sources, lineage →</button> :
                null}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {(s.evidence || []).map((q, j) =>
                <div key={j} style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.5, display: "flex", gap: 8 }}>
                        <span style={{ color: "var(--ember)", flexShrink: 0 }}>“</span>
                        <span>{q}</span>
                      </div>
                )}
                  </div>
                </div> :
            null}
            </React.Fragment>
          )}
        </div>
        </div>) :
      tab === "Opportunities" ?
      (drill && drill.type === "opp" ?
      <OpportunityDetail title={drill.title} onBack={() => setDrill(null)} onGo={onGo} onToast={onToast} onGeneratePrd={(o) => {generatePrd(o);setDrill(null);}} onOpenSignal={(sid) => {setTab("Signals");setDrill({ type: "signal", id: sid });}} /> :
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {D.opportunities.map((o) =>
        <div key={o.rank} className="bento lift" role="button" tabIndex={0} onClick={() => setDrill({ type: "opp", title: o.title })} onKeyDown={(e) => {if (e.key === "Enter") setDrill({ type: "opp", title: o.title });}} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", cursor: "pointer" }}>
              <span className="font-display tabular" style={{ fontSize: 22, width: 26, textAlign: "center", color: o.rank === 1 ? "var(--ember)" : "var(--ink-faint)" }}>{o.rank}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 550 }}>{o.title}</span>
                  <span className="mono-label" style={{ fontSize: 9 }}>{o.status}</span>
                  {o.rescore ?
              <span className="mono-label tabular" title="Re-scored by the outcome loop" style={{ fontSize: 8.5, color: o.rescore[1] >= o.rescore[0] ? "var(--emerald)" : "var(--rose)", border: `1px solid color-mix(in oklab, ${o.rescore[1] >= o.rescore[0] ? "var(--emerald)" : "var(--rose)"} 40%, transparent)`, borderRadius: 99, padding: "0 7px" }}>
                      {o.rescore[0].toFixed(1)} → {o.rescore[1].toFixed(1)}
                    </span> :
              null}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginTop: 2 }}>{o.rationale}</div>
              </div>
              <div style={{ display: "flex", gap: 14, flexShrink: 0, alignItems: "center" }}>
                <span className="mono-label">reach <strong style={{ color: "var(--ink)" }}>{o.reach}</strong></span>
                <span className="mono-label">effort <strong style={{ color: "var(--ink)" }}>{o.effort}</strong></span>
                <span title="ICE · impact, confidence, ease" style={{ textAlign: "right" }}>
                  <span className="font-display tabular" style={{ fontSize: 15, display: "block" }}>{o.ice.toFixed(1)}</span>
                  <span className="mono-label" style={{ fontSize: 7.5 }}>ICE</span>
                </span>
                <button className="btn btn-primary btn-sm" onClick={(e) => {e.stopPropagation();generatePrd(o);}}>Generate PRD</button>
                <button title="Signal lineage" aria-label="Signal lineage" className="btn btn-ghost btn-sm" style={{ padding: "4px 7px" }} onClick={(e) => {e.stopPropagation();const sid = (D.loopDetail.opportunities[o.title] || { signals: ["s1"] }).signals[0];setTab("Signals");setDrill({ type: "signal", id: sid });}}><IcBranch size={12} /></button>
              </div>
            </div>
        )}
          <p className="mono-label" style={{ fontSize: 8.5, textAlign: "center", marginTop: 4 }}>click a row for the full ICE breakdown and lineage · outcome loop re-scores after every release</p>
        </div>) :
      tab === "Specs" ?
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 150px 56px 80px 190px", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
            <span>Spec</span><span>State</span><span>Critic</span><span>Cites</span><span>Updated</span><span></span>
          </div>
          {allSpecs.map((s, i) =>
        <div key={s.title} style={{ display: "grid", gridTemplateColumns: "1fr 100px 150px 56px 80px 190px", gap: 12, padding: "13px 18px", alignItems: "center", borderBottom: i < allSpecs.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>{s.title}</span>
              <StatusBadge status={s.state === "shipped" ? "completed" : s.state === "in build" ? "running" : s.state === "review" ? "gate" : "planned"} />
              <span style={{ fontSize: 12, color: s.critic.includes("open") ? "var(--ember)" : "var(--ink-subtle)" }}>{s.critic}</span>
              <span className="mono-label tabular">{s.cites}</span>
              <span className="mono-label">{s.updated}</span>
              <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => onToast(`“${s.title}” opens in the editor in the full build.`)}>Open</button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "var(--agent)" }} onClick={() => onToast(`Handed to Builder. Mission queued from “${s.title}”.`)}>Hand to Builder</button>
              </span>
            </div>
        )}
        </div> :
      tab === "Roadmap" ?
      <div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => {setLanes((ls) => ls.map((l, i) => i === 0 ? { ...l, items: [...l.items] } : l));onToast("Rebalanced. Strategist kept Now lean, moved nothing — the lanes already match capacity.");}}>AI rebalance</button>
            <button className="btn btn-primary btn-sm" onClick={() => setPlanPreview({ tasks: ["Guest checkout fix · ship + verify", "Smart retry rollout · staged 10%", "SSO spec · SAML happy path"], hours: "~31h" })}>Plan next 2 weeks</button>
          </div>
          {planPreview ?
        <div className="fade-up bento" style={{ marginBottom: 12, padding: "14px 16px", borderColor: "color-mix(in oklab, var(--ember) 40%, transparent)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div className="font-display" style={{ fontSize: 15 }}>Sprint plan preview</div>
                  <div className="mono-label" style={{ fontSize: 8.5, marginTop: 2 }}>{planPreview.tasks.length} tasks · {planPreview.hours} · drafted by Strategist</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setPlanPreview(null)}>Dismiss</button>
                <button className="btn btn-primary btn-sm" onClick={commitPlan}>Commit · adds to Tasks</button>
              </div>
              <ul style={{ listStyle: "none", paddingLeft: 0, marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                {planPreview.tasks.map((t) =>
            <li key={t} style={{ fontSize: 12.5, color: "var(--ink-muted)", display: "flex", gap: 8 }}><StepDot status="planned" /><span>{t}</span></li>
            )}
              </ul>
            </div> :
        null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {lanes.map((col) =>
          <div key={col.quarter} className="band-stone" style={{ minHeight: 220 }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {e.preventDefault();if (dragItem) {moveLane(dragItem, col.quarter);setDragItem(null);}}}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <MonoLabel>{col.quarter}</MonoLabel>
                  <span className="mono-label tabular">{col.items.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {col.items.map((it) =>
              <div key={it} className="bento lift" draggable
              onDragStart={(e) => {setDragItem(it);e.dataTransfer.setData("text/plain", it);}}
              style={{ padding: "10px 12px", fontSize: 13, fontWeight: 500, cursor: "grab" }}>{it}</div>
              )}
                </div>
              </div>
          )}
          </div>
          <p className="mono-label" style={{ fontSize: 8.5, textAlign: "center", marginTop: 10 }}>drag a card between lanes · every move writes a decision to memory</p>
        </div> :
      tab === "Tasks" ?
      <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => onToast("Linear import opens in the full build. Issues sync both ways.")}>Import from Linear</button>
          </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[["To do", kanban.todo], ["In progress", kanban.doing], ["Done", kanban.done]].map(([col, cards]) =>
          <div key={col} className="band-stone" style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
                <MonoLabel>{col}</MonoLabel>
                <span className="mono-label tabular">{cards.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cards.map((k) =>
              <div key={k.id} className="bento lift" style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 12.5, lineHeight: 1.45, textDecoration: col === "Done" ? "line-through" : "none", color: col === "Done" ? "var(--ink-faint)" : "var(--ink)" }}>{k.text}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                      <span className="mono-label" style={{ fontSize: 8.5, color: k.agent ? "var(--agent)" : "var(--ink-subtle)" }}>{k.who}</span>
                      {k.agent ? <span className="mono-label" style={{ fontSize: 7.5, border: "1px solid color-mix(in oklab, var(--agent) 40%, transparent)", color: "var(--agent)", borderRadius: 99, padding: "0 6px" }}>agent</span> : null}
                    </div>
                  </div>
              )}
              </div>
            </div>
          )}
        </div>
        </div> :

      (drill && drill.type === "release" ?
      <ReleaseDetail version={drill.version} onBack={() => setDrill(null)} onGo={onGo} /> :
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {D.releases.map((r) =>
        <button key={r.version} className="bento lift" onClick={() => setDrill({ type: "release", version: r.version })} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", width: "100%", textAlign: "left", cursor: "pointer" }}>
              <StepDot status={r.health === "good" ? "completed" : "failed"} />
              <span className="mono-label" style={{ color: "var(--ink)", width: 48 }}>{r.version}</span>
              <span style={{ flex: 1, fontSize: 13, color: "var(--ink-muted)" }}>{r.note}</span>
              <span className="mono-label">{r.when}</span>
              <IcChevRight size={12} style={{ color: "var(--ink-faint)" }} />
            </button>
        )}
        </div>)
      }
    </div>);

}

const KNOWLEDGE_DESC = {
  Calendar: "Events and meeting transcripts. Open a meeting to capture and extract.",
  Memory: "What the swarm has learned about your workspace, customers, and product.",
  Decisions: "Every choice your team made, captured once. Sourced from missions, specs, meetings.",
  Docs: "Workspace pages. Import from Google Docs or Notion, edit inline."
};

function KnowledgeScreen({ onGo, onToast }) {
  const D = window.CADENCE_DATA;
  const [tab, setTab] = useStateL("Calendar");
  const [drill, setDrill] = useStateL(null);
  const [q, setQ] = useStateL("");
  const [openDoc, setOpenDoc] = useStateL(null);
  const [openMeeting, setOpenMeeting] = useStateL(null);
  const [calView, setCalView] = useStateL("list");
  const [calMonth, setCalMonth] = useStateL(0); // offset from June 2026
  const [selDay, setSelDay] = useStateL(null);
  const [events, setEvents] = useStateL(() => D.calendar.map((e) => ({ ...e })));
  const [docs, setDocs] = useStateL(() => D.docs.map((d) => ({ ...d, created: d.updated, edited: d.updated, version: 1 })));
  const [editDoc, setEditDoc] = useStateL(null); // title of doc in editor
  const [bodyVal, setBodyVal] = useStateL("");
  const [mdView, setMdView] = useStateL(false);
  const [shareOpen, setShareOpen] = useStateL(false);
  const [resOpen, setResOpen] = useStateL(false);
  const [docResources, setDocResources] = useStateL({});
  const openEditor = (title) => {
    const d = docs.find((x) => x.title === title);
    setBodyVal((d ? d.excerpt : "") + "\n\nKeep writing — this is your page. Type / for blocks in the full build.");
    setMdView(false); setShareOpen(false); setResOpen(false);
    setEditDoc(title);
  };
  const [ask, setAsk] = useStateL("");
  const [askAnswer, setAskAnswer] = useStateL(null);
  const feed = D.memoryFeed.filter((m) => m.text.toLowerCase().includes(q.toLowerCase()));
  const askMemory = (e) => {
    e.preventDefault();
    if (!ask.trim()) return;
    const lower = ask.toLowerCase();
    const hit = D.memoryFeed.find((m) => lower.split(/\s+/).some((w) => w.length > 3 && m.text.toLowerCase().includes(w)));
    setAskAnswer({
      q: ask.trim(),
      a: hit ? hit.text : "Nothing directly on record yet. The closest beliefs: checkout fixes need viewport-resize tests, and Northwind treats SSO as a launch blocker.",
      src: hit ? "memory · " + hit.when : "memory · synthesis"
    });
    setAsk("");
  };
  return (
    <div data-screen-label="Knowledge" style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
      <SurfaceHeader kicker="Loop · Learn" icon={IcBook} title="Knowledge"
      sub="What the swarm knows. Calendar, memory, decisions, docs in one place." />

      {/* Company brain strip — one consolidated substrate, queryable from Chat. */}
      <div className="band-stone" style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 18px", marginBottom: 18, flexWrap: "wrap" }}>
        <MonoLabel icon={IcSparkles} style={{ color: "var(--ink)" }}>Company brain</MonoLabel>
        {[["chat threads", "3"], ["signals", "22"], ["meetings", "4"], ["decisions", "142"], ["learnings", "57"], ["docs", "4"], ["connectors", "4 live"]].map(([l, v]) =>
        <span key={l} className="mono-label" style={{ fontSize: 9 }}>
            <strong className="tabular" style={{ color: "var(--ink)", fontWeight: 600 }}>{v}</strong> {l}
          </span>
        )}
        <span style={{ flex: 1 }}></span>
        <span className="mono-label" style={{ fontSize: 8.5 }}>everything here is what Chat reasons over — one brain</span>
      </div>

      <TabRow tabs={["Calendar", "Memory", "Decisions", "Docs"]} active={tab} onSet={(t) => {setTab(t);setDrill(null);}} desc={KNOWLEDGE_DESC} />

      {tab === "Calendar" ?
      <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 2, border: "1px solid var(--hairline)", borderRadius: 7, padding: 2 }}>
              {[["list", "List"], ["grid", "Month"], ["year", "Year"]].map(([id, label]) =>
            <button key={id} onClick={() => setCalView(id)} className="mono-label" style={{
              fontSize: 9, padding: "3px 10px", borderRadius: 5,
              background: calView === id ? "var(--surface-2)" : "transparent",
              color: calView === id ? "var(--ink)" : "var(--ink-subtle)"
            }}>{label}</button>
            )}
            </div>
          </div>
          {calView === "grid" ?
        (() => {
          /* Contribution-style month — pixel intensity = how occupied the day is.
             Nav ‹ › moves months; synced two-way with the connected calendar. */
          const MONTHS = [
          { off: -1, label: "May 2026", days: 31, first: 4 },
          { off: 0, label: "June 2026", days: 30, first: 0 },
          { off: 1, label: "July 2026", days: 31, first: 2 },
          { off: 2, label: "August 2026", days: 31, first: 5 }];
          const M = MONTHS.find((m) => m.off === calMonth) || MONTHS[1];
          const cells = Math.ceil((M.first + M.days) / 7) * 7;
          const dayEvents = (d) => calMonth === 0 ? events.filter((ev) => ev.day === d) : [];
          const selEvents = selDay != null ? dayEvents(selDay) : [];
          const SHADES = ["var(--surface-2)", "color-mix(in oklab, var(--ember) 18%, var(--canvas))", "color-mix(in oklab, var(--ember) 38%, var(--canvas))", "color-mix(in oklab, var(--ember) 60%, var(--canvas))"];
          return (
            <div className="bento" style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 2px" }}>
                <span className="font-display" style={{ fontSize: 16, flex: 1 }}>{M.label}</span>
                <button aria-label="Previous month" className="btn btn-ghost btn-sm" style={{ padding: "3px 8px" }} disabled={calMonth <= -1} onClick={() => {setCalMonth(calMonth - 1);setSelDay(null);}}>‹</button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10.5 }} onClick={() => {setCalMonth(0);setSelDay(12);}}>Today</button>
                <button aria-label="Next month" className="btn btn-ghost btn-sm" style={{ padding: "3px 8px" }} disabled={calMonth >= 2} onClick={() => {setCalMonth(calMonth + 1);setSelDay(null);}}>›</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, di) =>
                <div key={d} className="mono-label" style={{ fontSize: 8, textAlign: "center", padding: "2px 0 4px", opacity: di > 4 ? 0.5 : 1 }}>{d}</div>
                )}
                {Array.from({ length: cells }, (_, i) => {
                  const day = i - M.first + 1;
                  const inMonth = day >= 1 && day <= M.days;
                  const isToday = calMonth === 0 && day === 12;
                  const isSel = selDay === day && inMonth;
                  const evs = inMonth ? dayEvents(day) : [];
                  const n = evs.length;
                  const weekend = i % 7 > 4;
                  const fill = !inMonth ? "transparent" : SHADES[Math.min(n, 3)];
                  return (
                    <button key={i} disabled={!inMonth} aria-label={inMonth ? `${M.label.split(" ")[0]} ${day} · ${n} event${n === 1 ? "" : "s"}` : undefined}
                    onClick={() => setSelDay(isSel ? null : day)}
                    title={inMonth ? n ? evs.map((e) => e.title).join(" · ") : "free" : undefined}
                    style={{
                      aspectRatio: "1.6", borderRadius: 5, position: "relative", overflow: "hidden",
                      background: fill,
                      border: isSel ? "1.5px solid var(--ink)" : isToday ? "1.5px solid var(--ember)" : "1px solid var(--hairline)",
                      opacity: !inMonth ? 0.25 : weekend ? 0.55 : 1,
                      cursor: inMonth ? "pointer" : "default",
                      transition: "background var(--dur-fast), border-color var(--dur-fast)"
                    }}>
                      <span className="mono-label tabular" style={{ fontSize: 7.5, position: "absolute", top: 3, left: 5, color: n >= 2 ? "oklch(0.99 0.005 85)" : isToday ? "var(--ember)" : "var(--ink-faint)" }}>{inMonth ? day : ""}</span>
                      {n > 0 ? <span style={{ position: "absolute", left: 5, right: 4, bottom: 2, fontSize: 7, lineHeight: 1.2, fontFamily: "'JetBrains Mono', monospace", color: n >= 2 ? "oklch(0.99 0.005 85)" : "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{evs[0].title}{n > 1 ? ` +${n - 1}` : ""}</span> : null}
                    </button>);
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "0 2px" }}>
                <span className="mono-label" style={{ fontSize: 7.5 }}>free</span>
                {SHADES.map((c) =>
                <span key={c} style={{ width: 12, height: 12, borderRadius: 3, background: c, border: "1px solid var(--hairline)", display: "inline-block" }}></span>
                )}
                <span className="mono-label" style={{ fontSize: 7.5 }}>occupied</span>
                <span style={{ flex: 1 }}></span>
                <span className="mono-label" style={{ fontSize: 7.5 }}>synced two-way with your calendar · weekends: Settings → Profile</span>
              </div>
              {selDay != null ?
              <div className="fade-up" style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "var(--surface-1)", border: "1px solid var(--hairline)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: selEvents.length ? 6 : 0 }}>
                    <span className="mono-label" style={{ fontSize: 8.5, color: "var(--ink)" }}>{M.label.split(" ")[0]} {selDay}</span>
                    <span style={{ flex: 1 }}></span>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => {
                    if (calMonth === 0) {setEvents((es) => [...es, { id: "evx" + Date.now(), when: `Jun ${selDay}`, day: selDay, title: "Hold · focus block", kind: "hold", note: "added here · syncs to your calendar", transcript: null }]);}
                  }}>+ Add · syncs back</button>
                  </div>
                  {selEvents.map((ev) =>
                <button key={ev.id} onClick={() => {setCalView("list");setOpenMeeting(ev.id);}} style={{ display: "block", fontSize: 12, color: "var(--action-blue)", padding: "2px 0", textAlign: "left" }}>{ev.when} · {ev.title}</button>
                )}
                  {selEvents.length === 0 ? <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>Nothing scheduled — a good deep-work day.</div> : null}
                </div> :
              null}
            </div>);
        })() :
        calView === "year" ?
        (() => {
          /* Year occupancy — GitHub-contribution style: 52 weeks × 7 days,
             deterministic seeded busyness. */
          const SHADES = ["var(--surface-2)", "color-mix(in oklab, var(--ember) 18%, var(--canvas))", "color-mix(in oklab, var(--ember) 38%, var(--canvas))", "color-mix(in oklab, var(--ember) 60%, var(--canvas))"];
          const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const busy = (w, d) => {
            if (w > 23) return -1; // future weeks (after mid-June) stay empty
            const x = (w * 7 + d) * 2654435761 % 100;
            if (d > 4) return x < 82 ? 0 : 1;
            return x < 38 ? 0 : x < 64 ? 1 : x < 86 ? 2 : 3;
          };
          return (
            <div className="bento" style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, padding: "0 2px" }}>
                <span className="font-display" style={{ fontSize: 16, flex: 1 }}>2026 · occupancy</span>
                <span className="mono-label" style={{ fontSize: 7.5 }}>like a contribution graph — but for your time</span>
              </div>
              <div className="scrollbar-thin" style={{ overflowX: "auto", paddingBottom: 4 }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 4, paddingLeft: 30 }}>
                  {MO.map((m) => <span key={m} className="mono-label" style={{ fontSize: 7, width: 4.33 * 13 - 3 }}>{m}</span>)}
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, width: 27 }}>
                    {WD.map((d, i) => <span key={d} className="mono-label" style={{ fontSize: 6.5, height: 10, lineHeight: "10px", opacity: i > 4 ? 0.5 : 1 }}>{i % 2 === 0 ? d : ""}</span>)}
                  </div>
                  {Array.from({ length: 52 }, (_, w) => (
                    <div key={w} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {Array.from({ length: 7 }, (_, d) => {
                        const b = busy(w, d);
                        const isToday = w === 23 && d === 4;
                        return <span key={d} title={`${MO[Math.min(11, Math.floor(w / 4.33))]} · ${WD[d]} · ${b <= 0 ? "free" : b + " event" + (b > 1 ? "s" : "")}`}
                          style={{ width: 10, height: 10, borderRadius: 2.5, background: b < 0 ? "transparent" : SHADES[b], border: isToday ? "1.5px solid var(--ember)" : "1px solid var(--hairline)", opacity: d > 4 && b >= 0 ? 0.55 : 1, display: "block" }}></span>;
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "0 2px" }}>
                <span className="mono-label" style={{ fontSize: 7.5 }}>free</span>
                {SHADES.map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 3, background: c, border: "1px solid var(--hairline)", display: "inline-block" }}></span>)}
                <span className="mono-label" style={{ fontSize: 7.5 }}>occupied</span>
                <span style={{ flex: 1 }}></span>
                <span className="mono-label" style={{ fontSize: 7.5 }}>today ringed ember · future stays open</span>
              </div>
            </div>);
        })() :

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map((ev) =>
          <div key={ev.id} className="bento lift" style={{ padding: 0, overflow: "hidden" }}>
              <button onClick={() => setOpenMeeting(openMeeting === ev.id ? null : ev.id)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: "13px 16px" }}>
                <span className="mono-label tabular" style={{ width: 104, flexShrink: 0, color: "var(--ink)" }}>{ev.when}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 500, fontSize: 13.5 }}>{ev.title}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-faint)", marginTop: 1 }}>{ev.note}</span>
                </span>
                <span className="mono-label" style={{ fontSize: 8.5, color: ev.kind === "release" ? "var(--ember)" : "var(--ink-subtle)" }}>{ev.kind}</span>
                {ev.transcript ? openMeeting === ev.id ? <IcChevDown size={13} style={{ color: "var(--ink-faint)" }} /> : <IcChevRight size={13} style={{ color: "var(--ink-faint)" }} /> : <span style={{ width: 13 }}></span>}
              </button>
              {openMeeting === ev.id && ev.transcript ?
            <div className="fade-up" style={{ padding: "12px 16px 14px 134px", borderTop: "1px solid var(--hairline)", background: "var(--surface-1)" }}>
                  <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 6 }}>capture · extracted by Historian</div>
                  <p style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6 }}>{ev.transcript}</p>
                </div> :
            null}
            </div>
          )}
          </div>
        }
        </div> :
      tab === "Memory" ?
      (drill && drill.type === "learning" ?
      <LearningDetail id={drill.id} onBack={() => setDrill(null)} onGo={onGo} /> :
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="bento" style={{ padding: "var(--card-pad)" }}>
              <MonoLabel icon={IcSparkles} style={{ marginBottom: 10 }}>Ask memory · what does Cadence believe?</MonoLabel>
              <form onSubmit={askMemory} style={{ display: "flex", gap: 8 }}>
                <input className="input" value={ask} placeholder="e.g. what do we know about checkout? · why web-first for carts?" onChange={(e) => setAsk(e.target.value)} />
                <button className="btn btn-primary btn-sm" type="submit" style={{ flexShrink: 0 }}>Ask · Historian answers</button>
              </form>
              {askAnswer ?
            <div className="fade-up" style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "var(--surface-1)", border: "1px solid var(--hairline)" }}>
                  <div className="mono-label" style={{ fontSize: 8.5, marginBottom: 5 }}>“{askAnswer.q}”</div>
                  <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55, fontFamily: "'Newsreader', serif", fontSize: 14 }}>{askAnswer.a}</p>
                  <div className="mono-label" style={{ fontSize: 8, marginTop: 6, color: "var(--agent)" }}>{askAnswer.src} · cited to its trace</div>
                </div> :
            null}
            </div>
          <div className="bento" style={{ padding: "var(--card-pad)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <MonoLabel icon={IcBook}>Learnings · written by Historian</MonoLabel>
              <span style={{ position: "relative", width: 200 }}>
                <IcSearch size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)" }} />
                <input className="input" value={q} placeholder="Search memory…" onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 28, fontSize: 12 }} />
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {feed.length === 0 ?
              <div style={{ padding: "18px 0", fontSize: 12.5, color: "var(--ink-faint)" }}>Nothing in memory matches “{q}” yet. Learnings land here as missions complete.</div> :
              feed.map((m, i) =>
              <button key={m.id || i} disabled={!m.id || !D.loopDetail.learnings[m.id]} onClick={() => setDrill({ type: "learning", id: m.id })} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: i < feed.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 13, width: "100%", textAlign: "left", cursor: m.id && D.loopDetail.learnings[m.id] ? "pointer" : "default" }}>
                  <span className="mono-label tabular" style={{ width: 64, flexShrink: 0 }}>{m.when}</span>
                  <span style={{ color: "var(--ink-muted)", lineHeight: 1.5, flex: 1 }}>{m.text}</span>
                  {m.id && D.loopDetail.learnings[m.id] ? <IcChevRight size={11} style={{ color: "var(--ink-faint)", flexShrink: 0, alignSelf: "center" }} /> : null}
                </button>
              )}
            </div>
          </div>
          </div>
          <div className="band-stone">
            <MonoLabel icon={IcBook} style={{ marginBottom: 12 }}>Product memory</MonoLabel>
            {[["Decisions on record", "142"], ["Learnings written", "57"], ["Memory citations this week", "31"]].map(([l, v]) =>
          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--hairline)", fontSize: 13 }}>
                <span style={{ color: "var(--ink-muted)" }}>{l}</span>
                <span className="font-display tabular" style={{ fontSize: 16 }}>{v}</span>
              </div>
          )}
            <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12 }}>Every learning is cited back to the trace that taught it. Agents read this before every mission.</p>
          </div>
        </div>) :
      tab === "Decisions" ?
      (drill && drill.type === "decision" ?
      <DecisionDetail title={drill.title} onBack={() => setDrill(null)} onGo={onGo} /> :
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 90px 200px 20px", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
            <span>Decision</span><span>Made by</span><span>When</span><span>Why</span><span></span>
          </div>
          {D.decisions.map((d, i) =>
        <button key={d.title} onClick={() => setDrill({ type: "decision", title: d.title })} style={{ display: "grid", gridTemplateColumns: "1fr 150px 90px 200px 20px", gap: 12, padding: "13px 18px", alignItems: "baseline", borderBottom: i < D.decisions.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 13, width: "100%", textAlign: "left", cursor: "pointer" }}>
              <span style={{ fontWeight: 500 }}>{d.title}</span>
              <span style={{ color: "var(--ink-muted)", fontSize: 12.5 }}>{d.who}</span>
              <span className="mono-label">{d.when}</span>
              <span style={{ color: "var(--ink-subtle)", fontSize: 12.5 }}>{d.why}</span>
              <IcChevRight size={11} style={{ color: "var(--ink-faint)", alignSelf: "center" }} />
            </button>
        )}
        </div>) :

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {editDoc != null ? (() => {
          const doc = docs.find((d) => d.title === editDoc);
          if (!doc) return null;
          const fmt = (pre, post) => {
            const ta = document.getElementById("doc-body-ta");
            if (!ta) return;
            const { selectionStart: s0, selectionEnd: s1, value } = ta;
            const next = value.slice(0, s0) + pre + value.slice(s0, s1) + (post || "") + value.slice(s1);
            setBodyVal(next);
            onToast("Formatted. Markdown renders rich in the full build.");
          };
          return (
            <div className="bento fade-up" style={{ gridColumn: "span 2", padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--hairline)", flexWrap: "wrap" }}>
                <button className="mono-label" style={{ color: "var(--action-blue)", fontSize: 9 }} onClick={() => setEditDoc(null)}>← All docs</button>
                <span style={{ flex: 1 }}></span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "var(--agent)" }} onClick={() => onToast(`“${doc.title}” pushed to Signals. Scout will cluster it.`)}>Push to Signals</button>
                <span style={{ position: "relative" }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setShareOpen(!shareOpen)} aria-expanded={shareOpen}>Share…</button>
                  {shareOpen ? (
                    <span className="fade-up" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60, width: 250, background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 5, boxShadow: "0 12px 32px -16px oklch(0 0 0 / 30%)", display: "block" }}>
                      <span className="mono-label" style={{ fontSize: 8, display: "block", padding: "3px 8px 5px" }}>agentic first · then humans</span>
                      {[["To an agent · becomes mission context", "Scribe, Builder and Critic will cite it."], ["To a pipeline · attaches to a running mission", "Pick the mission in the full build."], ["To a human · email or Slack link", "Read-only link, version-pinned."]].map(([l, t]) => (
                        <button key={l} className="cmdk-item" style={{ fontSize: 11.5, padding: "6px 8px" }} onClick={() => { setShareOpen(false); onToast(t); }}>{l}</button>
                      ))}
                    </span>
                  ) : null}
                </span>
                <button className="btn btn-reject btn-sm" style={{ fontSize: 11 }} onClick={() => {setDocs((ds) => ds.filter((d) => d.title !== doc.title));setEditDoc(null);onToast(`“${doc.title}” deleted · removed from the brain. Versions stay in the audit log.`);}}>Delete · removes everywhere</button>
              </div>
              <div style={{ padding: "20px 28px 24px", maxWidth: 720, position: "relative" }}>
                {/* floating mini editor toolbar — tiptap-style, top right */}
                <div style={{ position: "absolute", top: 14, right: 16, display: "flex", gap: 2, alignItems: "center", background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 8, padding: 3, boxShadow: "0 4px 14px -8px oklch(0.2 0.02 60 / 25%)" }}>
                  {[["B", () => fmt("**", "**"), 700, "Bold"], ["I", () => fmt("_", "_"), 400, "Italic"], ["H1", () => fmt("\n# "), 600, "Heading 1"], ["H2", () => fmt("\n## "), 600, "Heading 2"], ["•", () => fmt("\n- "), 400, "Bullet list"], ["</>", () => fmt("`", "`"), 400, "Code"]].map(([l, fn, w, t]) => (
                    <button key={l} title={t} onClick={fn} style={{ fontFamily: l === "</>" ? "'JetBrains Mono', monospace" : "inherit", fontStyle: l === "I" ? "italic" : "normal", fontWeight: w, fontSize: 11, padding: "3px 7px", borderRadius: 5, color: "var(--ink-muted)" }}>{l}</button>
                  ))}
                  <span style={{ width: 1, height: 14, background: "var(--hairline)", margin: "0 2px" }}></span>
                  <button title="Toggle markdown (agent view) / rich (human view)" onClick={() => { setMdView(!mdView); onToast(mdView ? "Human view · rich text." : "Agent view · raw markdown, what agents read."); }}
                    className="mono-label" style={{ fontSize: 8.5, padding: "3px 8px", borderRadius: 5, background: mdView ? "var(--surface-2)" : "transparent", color: mdView ? "var(--agent)" : "var(--ink-subtle)" }}>MD</button>
                </div>
                <input defaultValue={doc.title} aria-label="Doc title" style={{ width: "calc(100% - 260px)", border: 0, outline: "none", background: "transparent", fontFamily: "'Newsreader', serif", fontSize: 24, fontWeight: 460, color: "var(--ink)", letterSpacing: "-0.015em" }} />
                <div className="mono-label" style={{ fontSize: 8.5, margin: "4px 0 14px" }}>v{doc.version || 1} · created {doc.created || doc.updated} · last edited {doc.edited || doc.updated} · every save is a new version · full history in the audit log</div>
                <textarea id="doc-body-ta" value={bodyVal} onChange={(e) => setBodyVal(e.target.value)} aria-label="Doc body"
                style={{ width: "100%", minHeight: 220, border: 0, outline: "none", background: "transparent", resize: "vertical", fontFamily: mdView ? "'JetBrains Mono', monospace" : "'Newsreader', serif", fontSize: mdView ? 12 : 14.5, lineHeight: 1.7, color: "var(--ink-muted)" }} />
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                  <span className="mono-label" style={{ fontSize: 8.5 }}>resources</span>
                  {(docResources[doc.title] || ["Mixpanel funnel", "Intercom tag report"]).map((r) =>
                  <span key={r} className="mono-label" style={{ fontSize: 8.5, border: "1px solid var(--hairline)", borderRadius: 99, padding: "2px 9px", color: "var(--ink-muted)" }}>{r}</span>
                  )}
                  <span style={{ position: "relative" }}>
                    <button className="mono-label" style={{ fontSize: 8.5, color: "var(--action-blue)" }} onClick={() => setResOpen(!resOpen)} aria-expanded={resOpen}>+ add resource</button>
                    {resOpen ? (
                      <span className="fade-up" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 60, width: 250, background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 8, boxShadow: "0 12px 32px -16px oklch(0 0 0 / 30%)", display: "block" }}>
                        <input className="input" autoFocus placeholder="Paste a link, or type to search…" style={{ fontSize: 11.5, marginBottom: 6 }}
                          onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { const v = e.target.value.trim(); setDocResources((m) => ({ ...m, [doc.title]: [...(m[doc.title] || ["Mixpanel funnel", "Intercom tag report"]), v] })); setResOpen(false); onToast(`“${v}” attached · part of the brain now.`); } }} />
                        <span className="mono-label" style={{ fontSize: 7.5, display: "block", padding: "0 2px 4px" }}>or pull from</span>
                        {["Connector doc · Intercom / Gong / Mixpanel", "Mission trace · tr_8f2c…", "Upload a file"].map((s) => (
                          <button key={s} className="cmdk-item" style={{ fontSize: 11, padding: "5px 8px" }} onClick={() => { const v = s.split(" ·")[0]; setDocResources((m) => ({ ...m, [doc.title]: [...(m[doc.title] || ["Mixpanel funnel", "Intercom tag report"]), v] })); setResOpen(false); onToast(`${v} attached · cited like any other source.`); }}>{s}</button>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <span style={{ flex: 1 }}></span>
                  <button className="btn btn-primary btn-sm" onClick={() => {setDocs((ds) => ds.map((d) => d.title === doc.title ? { ...d, version: (d.version || 1) + 1, edited: "just now" } : d));setEditDoc(null);onToast(`“${doc.title}” saved as v${(doc.version || 1) + 1} · synced to the brain.`);}}>Save · new version, syncs to brain</button>
                </div>
              </div>
            </div>);
        })() : docs.map((doc) =>
        <div key={doc.title} className="bento lift" style={{ padding: 0, overflow: "hidden" }}>
              <button onClick={() => setOpenDoc(openDoc === doc.title ? null : doc.title)} onDoubleClick={() => openEditor(doc.title)} title="Click to preview · double-click to edit" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", width: "100%", textAlign: "left" }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--soft-stone)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink-subtle)", flexShrink: 0 }}><IcBook size={14} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 500, fontSize: 13.5 }}>{doc.title}</span>
                  <span className="mono-label" style={{ fontSize: 9, marginTop: 1, display: "block" }}>{doc.kind === "pinned" ? "pinned" : "doc"} · updated {doc.updated}</span>
                </span>
                <span className="mono-label" style={{ fontSize: 8, color: "var(--action-blue)", flexShrink: 0 }} onClick={(e) => {e.stopPropagation();openEditor(doc.title);}} role="button">edit</span>
                {openDoc === doc.title ? <IcChevDown size={13} style={{ color: "var(--ink-faint)" }} /> : <IcChevRight size={13} style={{ color: "var(--ink-faint)" }} />}
              </button>
              {openDoc === doc.title ?
          <div className="fade-up" style={{ padding: "12px 16px 14px 60px", borderTop: "1px solid var(--hairline)", background: "var(--surface-1)" }}>
                  <p style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6, fontFamily: "'Newsreader', serif", fontSize: 13.5 }}>{doc.excerpt}</p>
                  <span className="mono-label" style={{ fontSize: 8.5, marginTop: 8, display: "block" }}>preview · double-click the card (or “edit”) to open the editor</span>
                </div> :
          null}
            </div>
        )}
        </div>
      }
    </div>);

}

/* Risk grade tag — low / medium / high. */
function RiskTag({ risk }) {
  const map = { low: ["var(--emerald)", "low risk"], medium: ["var(--ember)", "medium risk"], high: ["var(--rose)", "high risk"] };
  const [c, label] = map[risk] || map.medium;
  return (
    <span className="mono-label" style={{ fontSize: 8.5, color: c, border: `1px solid color-mix(in oklab, ${c} 45%, transparent)`, borderRadius: 99, padding: "1px 7px" }}>{label}</span>);

}

/* Detailed approval card — the richer layout, lives in Govern's queue. */
function ApprovalCard({ a, onApprove, onReject, onOpenMission }) {
  const resolved = a.resolved;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
      border: "1px solid var(--hairline)", borderRadius: 8,
      opacity: resolved ? 0.45 : 1, transition: "opacity var(--dur-slow)",
      background: "var(--canvas)"
    }} className="fade-up lift">
      <span style={{ marginTop: 5 }}><StepDot status={resolved ? resolved === "approved" ? "completed" : "failed" : "gate"} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span className="mono-label" style={{ color: "var(--ink)" }}>{a.agent}</span>
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>wants</span>
          <span className="mono-label" style={{ color: "var(--agent)" }}>{a.tool}</span>
          <RiskTag risk={a.risk} />
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>in</span>
          <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{a.mission}</span>
          <span style={{ flex: 1 }}></span>
          <span className="mono-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IcClock size={11} />expires {a.expires}
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: "4px 0 10px", lineHeight: 1.5 }}>{a.summary}</p>
        {resolved ?
        <span className="mono-label" style={{ color: resolved === "approved" ? "var(--emerald)" : "var(--coral)" }}>
            {resolved === "approved" ? "approved · agent resumed" : "rejected · nothing ran"}
          </span> :
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-approve btn-sm" onClick={() => onApprove(a.id)}><IcCheck size={11} />{a.consequence}</button>
            <button className="btn btn-reject btn-sm" onClick={() => onReject(a.id)}><IcX size={11} />{a.reject}</button>
            {a.missionId ?
          <button className="btn btn-sm" style={{ color: "var(--action-blue)" }} onClick={() => onOpenMission(a.missionId)}>
                Mission<IcExternal size={11} />
              </button> :
          null}
          </div>
        }
      </div>
    </div>);

}

const GOVERN_DESC = {
  Controls: "Kill switch, mission caps, stuck approvals, auto-pipelines.",
  Approvals: "Tool calls waiting on a human. Approve runs them; reject keeps them paused.",
  Guardrails: "Rules that block, warn, or redact text on every AI call.",
  Budgets: "Spend caps per day, month, and AI surface. Over-cap calls are blocked.",
  Prompts: "Version, A/B test, and roll back the system prompts powering every AI surface.",
  Evals: "Regression tests on prompts. Catch quality drops before they ship.",
  Analytics: "Spend, tokens, and latency rolled up across every agent run.",
  Traces: "Step-by-step replay of each agent run, with timing and tool calls.",
  Drift: "Quality shifts against baseline. Flags when answers start changing."
};

function GovernScreen({ approvals, onApprove, onReject, onGo, initialTab, onToast }) {
  const D = window.CADENCE_DATA;
  const [tab, setTab] = useStateL(initialTab || "Controls");
  const [drill, setDrill] = useStateL(null);
  const [kill, setKill] = useStateL(D.controls.killSwitch);
  const [pipes, setPipes] = useStateL(D.controls.pipelines);
  const [caps, setCaps] = useStateL({ Today: D.budget.todayCap, June: D.budget.monthCap });
  const [editCap, setEditCap] = useStateL(null);
  const [capDraft, setCapDraft] = useStateL("");
  const pending = approvals.filter((a) => !a.resolved);
  return (
    <div data-screen-label="Govern" style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
      <SurfaceHeader kicker="Engine room" icon={IcShield} title="Govern"
      sub="Every autonomous action is cited, observable, gated, and reversible." />
      <TabRow tabs={["Controls", "Approvals", "Guardrails", "Budgets", "Prompts", "Evals", "Analytics", "Traces", "Drift"]} active={tab} onSet={(t) => {setTab(t);setDrill(null);}} desc={GOVERN_DESC} />

      {tab === "Controls" ?
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="bento" style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", borderColor: kill ? "color-mix(in oklab, var(--rose) 45%, transparent)" : undefined }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Kill switch</div>
              <div style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 2 }}>{kill ? "All agents paused. Nothing runs until you resume." : "Swarm is live. Flipping this pauses every agent mid-step, reversibly."}</div>
            </div>
            <button role="switch" aria-checked={kill} onClick={() => {setKill(!kill);onToast(kill ? "Swarm resumed. Agents pick up where they paused." : "Swarm paused. Every agent is holding, nothing was lost.");}}
          style={{ width: 44, height: 24, borderRadius: 99, background: kill ? "var(--rose)" : "var(--surface-2)", border: "1px solid var(--hairline)", position: "relative", flexShrink: 0, transition: "background var(--dur-base)" }}>
              <span style={{ position: "absolute", top: 2, left: kill ? 22 : 2, width: 18, height: 18, borderRadius: 99, background: "var(--canvas)", transition: "left var(--dur-base)", boxShadow: "0 1px 3px oklch(0 0 0 / 25%)" }}></span>
            </button>
          </div>
          <div className="bento">
            <MonoLabel icon={IcGauge} style={{ marginBottom: 8 }}>Mission cap</MonoLabel>
            <div className="font-display tabular" style={{ fontSize: 28 }}>{D.controls.missionCap} <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>concurrent</span></div>
            <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 4 }}>New goals queue when the mesh is at capacity.</div>
          </div>
          <div className="bento">
            <MonoLabel icon={IcClock} style={{ marginBottom: 8 }}>Stuck approvals</MonoLabel>
            <div className="font-display tabular" style={{ fontSize: 28, color: D.controls.stuckApprovals ? "var(--ember)" : undefined }}>{D.controls.stuckApprovals}</div>
            <button className="mono-label" style={{ color: "var(--action-blue)", marginTop: 4 }} onClick={() => setTab("Approvals")}>open the queue →</button>
          </div>
          <div className="bento" style={{ gridColumn: "span 2" }}>
            <MonoLabel icon={IcZap} style={{ marginBottom: 10 }}>Auto-pipelines</MonoLabel>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {pipes.map((p, i) =>
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < pipes.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-subtle)" }}>{p.desc}</div>
                  </div>
                  <button role="switch" aria-checked={p.on} onClick={() => {setPipes((ps) => ps.map((x) => x.id === p.id ? { ...x, on: !x.on } : x));onToast(`${p.name} ${p.on ? "off" : "on"}.`);}}
              style={{ width: 34, height: 19, borderRadius: 99, background: p.on ? "var(--deep-green)" : "var(--surface-2)", border: "1px solid var(--hairline)", position: "relative", flexShrink: 0, transition: "background var(--dur-base)" }}>
                    <span style={{ position: "absolute", top: 2, left: p.on ? 16 : 2, width: 13, height: 13, borderRadius: 99, background: "var(--canvas)", transition: "left var(--dur-base)" }}></span>
                  </button>
                </div>
            )}
            </div>
          </div>
        </div> :
      tab === "Approvals" ?
      <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <MonoLabel icon={IcShield}>{pending.length} waiting · median response 18m</MonoLabel>
            {pending.filter((a) => a.risk === "low").length > 1 ?
          <button className="btn btn-ghost btn-sm" onClick={() => pending.filter((a) => a.risk === "low").forEach((a) => onApprove(a.id))}>
                <IcCheck size={11} />Approve all low-risk ({pending.filter((a) => a.risk === "low").length})
              </button> :
          null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {approvals.map((a) =>
          <ApprovalCard key={a.id} a={a} onApprove={onApprove} onReject={onReject}
          onOpenMission={(id) => onGo({ name: "mission", missionId: id })} />
          )}
          </div>
        </div> :
      tab === "Budgets" ?
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[["Today", D.budget.todayBurn, "Resets at midnight", "$1.9 projected by midnight"], ["June", D.budget.monthBurn, "BYO keys in Settings", "$58 projected by Jun 30"]].map(([label, burn, note, projection]) => {
          const cap = caps[label];
          const pct = Math.min(100, burn / cap * 100);
          const editing = editCap === label;
          return (
            <div key={label} className="bento">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <MonoLabel icon={IcGauge}>{label}</MonoLabel>
                  {editing ?
                <form style={{ display: "flex", gap: 6 }} onSubmit={(e) => {
                  e.preventDefault();
                  const v = parseFloat(capDraft);
                  if (v > 0) {setCaps((c) => ({ ...c, [label]: v }));onToast(`${label} cap set to $${v}. Over-cap calls are blocked.`);}
                  setEditCap(null);
                }}>
                      <input className="input" autoFocus value={capDraft} onChange={(e) => setCapDraft(e.target.value)} style={{ width: 76, fontSize: 12, padding: "3px 8px" }} inputMode="decimal" aria-label={`${label} cap`} />
                      <button className="btn btn-primary btn-sm" type="submit" style={{ fontSize: 10.5 }}>Set cap</button>
                    </form> :

                <button className="mono-label" style={{ fontSize: 8.5, color: "var(--action-blue)" }} onClick={() => {setEditCap(label);setCapDraft(String(cap));}}>edit cap</button>
                }
                </div>
                <div className="font-display tabular" style={{ fontSize: 30 }}>${burn.toFixed(2)} <span style={{ fontSize: 15, color: "var(--ink-faint)" }}>of ${cap}</span></div>
                <div style={{ height: 5, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", margin: "12px 0 8px" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct > 80 ? "var(--rose)" : "var(--ember)", transition: "width var(--dur-slow)" }}></div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-subtle)", flexWrap: "wrap", gap: 4 }}>
                  <span>{note}</span>
                  <span className="tabular" style={{ color: pct > 80 ? "var(--rose)" : "var(--ink-faint)" }}>{projection}</span>
                </div>
              </div>);

        })}
          <div className="bento" style={{ gridColumn: "span 2", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <IcShield size={13} style={{ color: "var(--ink-subtle)", flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>Caps are hard limits: an over-cap AI call is blocked mid-mission and the mission pauses at a gate. The spend-ceiling guardrail separately pauses anything past $5 without your sign-off.</span>
          </div>
        </div> :
      tab === "Prompts" ?
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr 90px 150px", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
            <span>Surface</span><span>Version</span><span>Note</span><span>Status</span><span></span>
          </div>
          {D.prompts.map((p, i) =>
        <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr 90px 150px", gap: 12, padding: "12px 18px", alignItems: "center", borderBottom: i < D.prompts.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 13 }}>
              <span style={{ fontWeight: 500 }}>{p.surface}</span>
              <span className="mono-label tabular" style={{ color: "var(--ink)" }}>{p.version}</span>
              <span style={{ fontSize: 12, color: "var(--ink-subtle)" }}>{p.note}</span>
              <span className="mono-label" style={{ fontSize: 8.5, color: p.status === "testing" ? "var(--action-blue)" : "var(--emerald)" }}>{p.status}</span>
              <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => onToast(`${p.surface}: diff view opens in the full build.`)}>Diff</button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => onToast(`${p.surface} rolled back one version. Evals re-running.`)}>Roll back</button>
              </span>
            </div>
        )}
        </div> :
      tab === "Analytics" ?
      (drill && drill.type === "agent" ?
      <AgentDetail agent={drill.agent} onBack={() => setDrill(null)} onGo={onGo} onToast={onToast} /> :
      <AnalyticsTab onDrill={(agent) => setDrill({ type: "agent", agent })} />) :
      tab === "Drift" ?
      (drill && drill.type === "drift" ?
      <DriftDetail surface={drill.surface} onBack={() => setDrill(null)} onToast={onToast} /> :
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px 1fr 20px", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
            <span>AI surface</span><span>Δ baseline</span><span>Status</span><span>Note</span><span></span>
          </div>
          {D.drift.map((d, i) =>
        <button key={d.surface} onClick={() => setDrill({ type: "drift", surface: d.surface })} style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px 1fr 20px", gap: 12, padding: "12px 18px", alignItems: "baseline", borderBottom: i < D.drift.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 13, width: "100%", textAlign: "left" }}>
              <span style={{ fontWeight: 500 }}>{d.surface}</span>
              <span className="mono-label tabular" style={{ color: d.status === "watch" ? "var(--ember)" : "var(--ink)" }}>{d.delta}</span>
              <span className="mono-label" style={{ fontSize: 8.5, color: d.status === "watch" ? "var(--ember)" : "var(--emerald)" }}>{d.status}</span>
              <span style={{ fontSize: 12, color: "var(--ink-subtle)" }}>{d.note}</span>
              <IcChevRight size={11} style={{ color: "var(--ink-faint)", alignSelf: "center" }} />
            </button>
        )}
        </div>) :
      tab === "Guardrails" ?
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 210px", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
            <span>Guardrail</span><span>Rule</span><span>Last fired</span>
          </div>
          {D.guardrails.map((g, i) =>
        <div key={g.name} style={{ display: "grid", gridTemplateColumns: "160px 1fr 210px", gap: 12, padding: "13px 18px", alignItems: "baseline", borderBottom: i < D.guardrails.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 13 }}>
              <span style={{ fontWeight: 550 }}>{g.name}</span>
              <span style={{ color: "var(--ink-muted)" }}>{g.rule}</span>
              <span className="mono-label" style={{ color: g.fired === "never" ? "var(--ink-faint)" : "var(--ember)" }}>{g.fired}</span>
            </div>
        )}
        </div> :
      tab === "Traces" ?
      (drill && drill.type === "trace" ?
      <TraceDetail id={drill.id} onBack={() => setDrill(null)} onGo={onGo} /> :
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 60px 70px 70px 110px", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">
            <span>Trace</span><span>Mission</span><span>Hops</span><span>Tokens</span><span>Cost</span><span>When</span>
          </div>
          {D.traces.map((tr, i) =>
        <div key={tr.id} style={{ display: "grid", gridTemplateColumns: "90px 1fr 60px 70px 70px 110px", gap: 12, padding: "13px 18px", alignItems: "center", borderBottom: i < D.traces.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 13 }}>
              <button className="mono-label" style={{ color: "var(--action-blue)", textAlign: "left" }} onClick={() => setDrill({ type: "trace", id: tr.id })}>{tr.id}</button>
              <button style={{ fontWeight: 500, textAlign: "left" }} onClick={() => setDrill({ type: "trace", id: tr.id })}>{tr.mission}</button>
              <span className="tabular" style={{ color: "var(--ink-muted)" }}>{tr.hops}</span>
              <span className="mono-label tabular">{tr.tokens}</span>
              <span className="mono-label tabular" style={{ color: "var(--ink)" }}>{tr.cost}</span>
              <span className="mono-label" style={{ color: tr.when === "running" ? "var(--action-blue)" : tr.when.includes("failed") ? "var(--rose)" : undefined }}>{tr.when}</span>
            </div>
        )}
        </div>) :

      (drill && drill.type === "eval" ?
      <EvalDetail name={drill.name} onBack={() => setDrill(null)} onToast={onToast} /> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {D.evals.map((e) =>
        <button key={e.name} className="bento lift" onClick={() => setDrill({ type: "eval", name: e.name })} style={{ textAlign: "left", display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <MonoLabel>{e.name}</MonoLabel>
                <span className="mono-label" style={{ fontSize: 9 }}>{e.n}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                <span className="font-display tabular" style={{ fontSize: 30 }}>{e.score}</span>
                <span className="mono-label" style={{ color: e.trend === "up" ? "var(--emerald)" : "var(--ink-subtle)" }}>{e.trend === "up" ? "↑ improving" : "→ steady"}</span>
                <span style={{ flex: 1 }}></span>
                <span className="mono-label" style={{ fontSize: 8.5, color: "var(--action-blue)" }}>runs · cases · config →</span>
              </div>
              <div style={{ height: 4, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", marginTop: 10 }}>
                <div style={{ height: "100%", width: `${e.score}%`, background: e.score >= 90 ? "var(--emerald)" : "var(--ember)" }}></div>
              </div>
            </button>
        )}
        </div>)
      }
    </div>);

}

function SettingsScreen({ workspace, onToast }) {
  const D = window.CADENCE_DATA;
  const [tab, setTab] = useStateL("Connectors");
  const [drill, setDrill] = useStateL(null);
  return (
    <div data-screen-label="Settings" style={{ padding: "30px 44px 56px", maxWidth: 980, margin: "0 auto" }}>
      <SurfaceHeader kicker="Workspace" icon={IcSliders} title="Settings"
      sub={`${workspace.name} · ${workspace.product}. Connectors, models, and staff config.`} />
      <TabRow tabs={["Connectors", "Models", "Staff", "Digest", "Profile"]} active={tab} onSet={(t) => {setTab(t);setDrill(null);}} />

      {tab === "Connectors" ?
      (drill && drill.type === "connector" ?
      <ConnectorDetail name={drill.name} onBack={() => setDrill(null)} onToast={onToast} /> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {D.connectors.map((c) =>
        <div key={c.name} className="bento lift" role="button" tabIndex={0} onClick={() => setDrill({ type: "connector", name: c.name })} onKeyDown={(e) => {if (e.key === "Enter") setDrill({ type: "connector", name: c.name });}} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="font-display" style={{ fontSize: 16 }}>{c.name}</span>
                <StepDot status={c.status === "connected" ? "completed" : "planned"} />
              </div>
              <span style={{ fontSize: 12, color: "var(--ink-subtle)", flex: 1 }}>{c.desc}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {c.status === "connected" ?
          <button className="btn btn-ghost btn-sm" onClick={(e) => {e.stopPropagation();onToast(`${c.name} sync ran. Signals are fresh.`);}}>Sync now</button> :

          <button className="btn btn-primary btn-sm" onClick={(e) => {e.stopPropagation();onToast(`${c.name} connect flow opens in the full build.`);}}>Connect</button>
          }
              <span className="mono-label" style={{ fontSize: 8.5, color: "var(--action-blue)" }}>details →</span>
              </div>
            </div>
        )}
        </div>) :
      tab === "Models" ?
      <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
          {[["High reasoning · specs, briefs", "claude-sonnet-4.5", "gateway"], ["Surgical codegen · Builder", "claude-sonnet-4.5", "gateway"], ["High-context ingest · WhisperFlow", "gemini-2.5-pro", "byo"], ["Fast intent routing · chat", "gemini-2.5-flash", "gateway"]].map(([role, model, via], i, arr) =>
        <div key={role} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: i < arr.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 13 }}>
              <span style={{ flex: 1, color: "var(--ink-muted)" }}>{role}</span>
              <span className="mono-label" style={{ color: "var(--ink)" }}>{model}</span>
              <span className="mono-label" style={{ fontSize: 9 }}>{via}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => onToast("Model routing lives in the AI chokepoint. Swap is one click in the full build.")}>Change</button>
            </div>
        )}
        </div> :
      tab === "Staff" ?
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {D.agents.map((a) =>
        <div key={a.slug} className="bento" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-display" style={{ fontSize: 15 }}>{a.name}</div>
                <div className="mono-label" style={{ fontSize: 8.5 }}>{a.role}</div>
              </div>
              <button role="switch" aria-checked="true" title={`${a.name} enabled`} onClick={() => onToast(`${a.name} stays on. Disabling agents is gated in Govern.`)}
          style={{ width: 30, height: 17, borderRadius: 99, background: "var(--deep-green)", position: "relative", flexShrink: 0 }}>
                <span style={{ position: "absolute", right: 2, top: 2, width: 13, height: 13, borderRadius: 99, background: "var(--canvas)" }}></span>
              </button>
            </div>
        )}
        </div> :
      tab === "Digest" ?
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="bento" style={{ padding: "var(--card-pad)" }}>
            <MonoLabel icon={IcSparkles} style={{ marginBottom: 12 }}>Where the digest lands</MonoLabel>
            {[["Email · 06:45 daily", true], ["Slack #product · 06:45 daily", true], ["Slack DM · gate alerts, instant", false]].map(([l, on]) =>
          <div key={l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--hairline)", fontSize: 13 }}>
                <span style={{ color: "var(--ink-muted)" }}>{l}</span>
                <button className="mono-label" style={{ fontSize: 8.5, color: on ? "var(--emerald)" : "var(--ink-faint)" }} onClick={() => onToast("Digest routing saves in the full build.")}>{on ? "on" : "off"}</button>
              </div>
          )}
            <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12 }}>One digest, not ten notifications: the brief, your pending gates, and budget state — nothing else pings you.</p>
          </div>
          <div className="bento" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--hairline)" }} className="mono-label">Preview · tomorrow 06:45</div>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <CadenceMark size={18} />
                <span className="font-display" style={{ fontSize: 15 }}>Your loop, overnight</span>
              </div>
              {["2 calls waiting · PR gate + changelog gate", "14 signals in · checkout drop-off leads, 92 strength", "Budget $1.84 of $10 · mostly Builder CI loops"].map((l) =>
            <div key={l} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--ink-muted)", padding: "4px 0", lineHeight: 1.5 }}>
                  <span style={{ color: "var(--ember)" }}>·</span><span>{l}</span>
                </div>
            )}
              <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => onToast("That button deep-links into the approvals queue.")}>Open the queue · 2 gates</button>
            </div>
          </div>
        </div> :

      <div className="bento" style={{ padding: "var(--card-pad)", maxWidth: 480 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ width: 38, height: 38, borderRadius: 99, background: "var(--soft-stone)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13 }}>{D.user.initials}</span>
            <div>
              <div style={{ fontWeight: 550 }}>{D.user.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-subtle)" }}>Owner · {workspace.name}</div>
            </div>
          </div>
          {[["Gate alerts", "Email + in-app"], ["Daily brief", "06:30, written by Historian"], ["Quiet hours", "22:00 to 07:00"], ["Calendar weekends", "Shown · Sat & Sun"]].map(([l, v]) =>
        <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--hairline)", fontSize: 13 }}>
              <span style={{ color: "var(--ink-muted)" }}>{l}</span>
              <button style={{ color: "var(--action-blue)", fontSize: 12.5 }} onClick={() => onToast(`${l} editing opens in the full build.`)}>{v}</button>
            </div>
        )}
        </div>
      }
    </div>);

}

Object.assign(window, { ProductScreen, KnowledgeScreen, GovernScreen, SettingsScreen, EmptyState });