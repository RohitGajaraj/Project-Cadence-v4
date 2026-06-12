// Chat — threads, the shared AI message contract, and the Inline Mission Cockpit.
const { useState: useStateC, useRef: useRefC, useEffect: useEffectC } = React;

/* The AI message UI contract — every AI message renders this footer. */
function AiContract({ onGo, onToast }) {
  const m = window.CADENCE_DATA.aiMeta;
  const [vote, setVote] = useStateC(null);
  const [replayOpen, setReplayOpen] = useStateC(false);
  const item = { display: "inline-flex", alignItems: "center", gap: 4 };
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, marginTop: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.02em" }}>
      <span style={{ ...item, color: "var(--emerald)", border: "1px solid color-mix(in oklab, var(--emerald) 40%, transparent)", borderRadius: 99, padding: "1px 8px", fontWeight: 600 }} title="LLM-as-judge composite">
        {m.score}
      </span>
      <span style={item}>{m.model}</span>
      <span style={item}>{m.latency}</span>
      <span style={{ ...item }} className="tabular">{m.tokens}</span>
      <span style={{ ...item }} className="tabular">{m.cost}</span>
      <span style={{ flex: 1 }}></span>
      <button aria-label="Good response" onClick={() => {setVote(vote === "up" ? null : "up");if (vote !== "up" && onToast) onToast("Thanks. Logged to ai_feedback.");}} style={{ ...item, color: vote === "up" ? "var(--deep-green)" : "var(--ink-faint)" }}><IcThumbUp size={11} /></button>
      <button aria-label="Bad response" onClick={() => {setVote(vote === "down" ? null : "down");if (vote !== "down" && onToast) onToast("Logged. The judge will re-grade this reply.");}} style={{ ...item, color: vote === "down" ? "var(--rose)" : "var(--ink-faint)" }}><IcThumbDown size={11} /></button>
      <button style={{ ...item, color: "var(--action-blue)" }} onClick={() => onGo({ name: "mission", missionId: "m1" })}>View trace</button>
      <span style={{ position: "relative" }}>
        <button style={{ ...item, color: "var(--ink-subtle)" }} onClick={() => setReplayOpen((v) => !v)} aria-expanded={replayOpen}><IcReplay size={11} />Replay with…</button>
        {replayOpen ?
        <span className="fade-up" style={{
          position: "absolute", bottom: "calc(100% + 6px)", right: 0, zIndex: 60, width: 190,
          background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 10,
          padding: 5, boxShadow: "0 12px 32px -16px oklch(0 0 0 / 30%)", display: "block"
        }}>
            <span className="mono-label" style={{ fontSize: 8.5, display: "block", padding: "3px 8px 5px" }}>Replay · diff lands in thread</span>
            {window.CADENCE_DATA.replayModels.map((mod) =>
          <button key={mod} className="cmdk-item" style={{ fontSize: 11.5, padding: "6px 8px", fontFamily: "'JetBrains Mono', monospace" }}
          onClick={() => {setReplayOpen(false);onToast && onToast(`Replay queued on ${mod}. Diff lands in this thread.`);}}>{mod}</button>
          )}
          </span> :
        null}
      </span>
    </div>);

}

/* extractTitle — standing rule: auto-titles are the OBJECTIVE, 2–3 words,
   never the full sentence. Strips filler/stopwords, keeps meaning-carriers. */
function extractTitle(text) {
  const stop = new Set(["a", "an", "the", "please", "can", "could", "you", "we", "our", "my", "i", "want", "need", "needs", "to", "for", "of", "in", "on", "at", "with", "and", "or", "make", "lets", "let's", "just", "really", "very", "that", "this", "it", "its", "is", "are", "be", "should", "would", "go", "ahead", "some", "do", "about", "into", "out", "up", "so", "as", "by", "keep", "scope"]);
  const words = text.replace(/[^\w\s'-]/g, " ").split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !stop.has(w.toLowerCase()));
  const pick = (kept.length ? kept : words).slice(0, 3);
  const t = pick.join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* StreamText — typewriter reveal driven by a timestamp so it always
   completes even if the component re-renders/remounts mid-stream; hard
   fallback timeout guarantees the full text. Instant when motion is off. */
function StreamText({ text, onDone }) {
  const [n, setN] = useStateC(0);
  const doneRef = useRefC(false);
  useEffectC(() => {
    if (document.documentElement.getAttribute("data-motion") === "off") {setN(text.length);return;}
    const start = Date.now();
    const t = setInterval(() => {
      const c = Math.floor((Date.now() - start) / 9);
      if (c >= text.length) {setN(text.length);clearInterval(t);} else {setN(c);}
    }, 36);
    const fallback = setTimeout(() => {setN(text.length);clearInterval(t);}, text.length * 9 + 900);
    return () => {clearInterval(t);clearTimeout(fallback);};
  }, [text]);
  useEffectC(() => {
    if (n >= text.length && !doneRef.current) {doneRef.current = true;onDone && onDone();}
  }, [n, text]);
  return <span>{text.slice(0, n)}{n < text.length ? <span className="stream-caret">▍</span> : null}</span>;
}

/* Inline governance gate — consequence-first controls. */
function GatePanel({ approval, onApprove, onReject }) {
  if (!approval) return null;
  if (approval.resolved) {
    return (
      <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--surface-1)", border: "1px solid var(--hairline)", fontSize: 12.5, color: "var(--ink-subtle)", display: "flex", gap: 8, alignItems: "center" }}>
        <StepDot status={approval.resolved === "approved" ? "completed" : "failed"} />
        {approval.resolved === "approved" ? "Gate approved. Builder opened PR #214 and resumed." : "Gate rejected. Nothing ran, the branch is parked."}
      </div>);

  }
  return (
    <div className="fade-up" style={{
      padding: "14px 16px", borderRadius: 10,
      background: "color-mix(in oklab, var(--ember) 9%, transparent)",
      border: "1px solid color-mix(in oklab, var(--ember) 35%, transparent)"
    }}>
      <div className="mono-label" style={{ color: "var(--ember)", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
        <IcShield size={13} /> Action required · governance gate
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: "6px 0 12px", lineHeight: 1.5 }}>
        Builder wants <span className="mono-label" style={{ color: "var(--agent)", fontSize: 10.5 }}>{approval.tool}</span>. {approval.summary}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-approve" onClick={() => onApprove(approval.id)}><IcCheck size={12} />{approval.consequence}</button>
        <button className="btn btn-reject" onClick={() => onReject(approval.id)}><IcX size={12} />{approval.reject}</button>
      </div>
    </div>);

}

/* Inline Mission Cockpit — the contract: header, steps, gate, trace toggle, mission link. */
function MissionCockpit({ mission, gateApproval, onApprove, onReject, onGo }) {
  const [showTrace, setShowTrace] = useStateC(false);
  const D = window.CADENCE_DATA;
  const working = mission.status === "running" || mission.status === "awaiting_review";
  return (
    <div className={working ? "ai-glow" : undefined} style={{ borderRadius: 12, border: "1px solid var(--hairline)", background: "color-mix(in oklab, var(--soft-stone) 45%, transparent)", padding: 16, maxWidth: 620, transition: "box-shadow var(--dur-slow)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--hairline)", paddingBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <span className="mono-label" style={{ fontSize: 9.5 }}>Mission cockpit</span>
          <h4 className="font-display" style={{ fontSize: 16, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mission.title}</h4>
        </div>
        <StatusBadge status={mission.status} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0" }}>
        {mission.steps.map((s, i) =>
        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 9, fontSize: 12.5 }} className="fade-up">
            <span className="mono-label tabular" style={{ fontSize: 10, width: 14, textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
            <StepDot status={s.status} />
            <span className="mono-label" style={{ color: "var(--agent)", fontSize: 10.5, flexShrink: 0 }}>{s.agent}</span>
            <span style={{ color: "var(--ink-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.goal}</span>
          </div>
        )}
      </div>

      <GatePanel approval={gateApproval} onApprove={onApprove} onReject={onReject} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, marginTop: 10, borderTop: "1px solid var(--hairline)" }}>
        <button onClick={() => setShowTrace(!showTrace)} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "var(--action-blue)", display: "flex", alignItems: "center", gap: 4 }}>
          {showTrace ? <IcChevUp size={11} /> : <IcChevDown size={11} />}{showTrace ? "Hide raw trace" : "Show raw trace"}
        </button>
        <button onClick={() => onGo({ name: "mission", missionId: mission.id })} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "var(--action-blue)", display: "flex", alignItems: "center", gap: 4 }}>
          Open mission page<IcExternal size={11} />
        </button>
      </div>

      {showTrace ?
      <div className="fade-up scrollbar-thin" style={{ marginTop: 10, padding: 12, background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 10, maxHeight: 200, overflowY: "auto" }}>
          <div className="mono-label" style={{ fontSize: 9.5, display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--hairline)", paddingBottom: 5, marginBottom: 8 }}>
            <span>Execution hops</span><span>{D.hops.length} hops</span>
          </div>
          {D.hops.map((h, i) =>
        <div key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: "var(--agent)", fontWeight: 600 }}>{h.agent} ({h.slug})</span>
                <StatusBadge status={h.status} />
              </div>
              {h.steps.map((st, j) =>
          <div key={j} style={{ paddingLeft: 12, color: "var(--ink-subtle)", lineHeight: 1.7 }}>· {st}</div>
          )}
            </div>
        )}
        </div> :
      null}
    </div>);

}

function Bubble({ role, children }) {
  const user = window.CADENCE_DATA.user;
  if (role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <div style={{ background: "var(--soft-stone)", borderRadius: "14px 14px 4px 14px", padding: "10px 16px", fontSize: 13.5, maxWidth: 480, lineHeight: 1.55 }}>{children}</div>
        <span aria-hidden="true" title={user.name} style={{
          width: 26, height: 26, flexShrink: 0, marginTop: 2, borderRadius: "50% 50% 4px 50%",
          background: "var(--primary-ink)", color: "var(--canvas)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.04em",
          boxShadow: "0 0 0 2px color-mix(in oklab, var(--ember) 30%, transparent)",
        }} className="fade-up">{user.initials}</span>
      </div>);

  }
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span aria-hidden="true" style={{
        width: 28, height: 28, flexShrink: 0, marginTop: 2,
        display: "inline-flex", alignItems: "center", justifyContent: "center"
      }}><CadenceMark size={24} /></span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--ink)" }}>{children}</div>
    </div>);

}

function ChatScreen({ mission, gateApproval, onApprove, onReject, onGo, onToast }) {
  const D = window.CADENCE_DATA;
  const [threads, setThreads] = useStateC(D.chatThreads);
  const [thread, setThread] = useStateC("c1");
  const [extra, setExtra] = useStateC({});
  const [draft, setDraft] = useStateC("");
  const [typing, setTyping] = useStateC(false);
  const [live, setLive] = useStateC({}); // threadId -> assembling mission
  const endRef = useRefC(null);
  const timersRef = useRefC([]);
  useEffectC(() => () => timersRef.current.forEach(clearTimeout), []);

  const threadExtra = extra[thread] || [];
  const newThread = () => {
    const id = "c" + Date.now();
    setThreads((ts) => [{ id, title: "New thread", when: "now" }, ...ts]);
    setThread(id);
    onToast("Fresh thread. Hand me a goal and I'll dispatch a mission.");
  };

  const wait = (ms, fn) => timersRef.current.push(setTimeout(fn, ms));
  const patchLive = (tid, fn) => setLive((lv) => lv[tid] ? { ...lv, [tid]: fn(lv[tid]) } : lv);

  /* The streaming cockpit — dispatch a live mission that assembles
     step-by-step, runs each specialist, and lands at a gate. */
  const dispatch = (tid, goalText) => {
    const title = extractTitle(goalText);
    const plan = [
    { agent: "discovery", goal: "Pull related signals, cluster and cite the theme" },
    { agent: "strategist", goal: "Score against the queue, write the rationale" },
    { agent: "prd_writer", goal: "Draft the spec, run a Critic pass" },
    { agent: "builder", goal: "Implement behind a flag, self-correct CI" }];

    setLive((lv) => ({ ...lv, [tid]: { id: "live", title, status: "running", steps: [] } }));
    // steps appear one by one
    plan.forEach((p, i) => {
      wait(500 + i * 550, () => patchLive(tid, (m) => ({ ...m, steps: [...m.steps, { ...p, status: "planned" }] })));
    });
    // then each runs and completes
    plan.forEach((p, i) => {
      const base = 500 + plan.length * 550 + i * 1500;
      wait(base, () => patchLive(tid, (m) => ({ ...m, steps: m.steps.map((s, j) => j === i ? { ...s, status: "running" } : s) })));
      wait(base + 1250, () => patchLive(tid, (m) => ({ ...m, steps: m.steps.map((s, j) => j === i ? { ...s, status: i === plan.length - 1 ? "gate" : "completed" } : s) })));
    });
    // gate arrives
    wait(500 + plan.length * 550 + plan.length * 1500 + 300, () => {
      patchLive(tid, (m) => ({
        ...m, status: "awaiting_review",
        gate: {
          id: "lg-" + tid, tool: "create_pull_request", risk: "medium",
          summary: `Implementation ready behind a flag. CI green, Inspector score 95. Opening the PR needs your call.`,
          consequence: "Approve · opens the PR", reject: "Reject · nothing ships"
        }
      }));
      onToast("Mission at a gate. Builder is holding for you.");
    });
  };

  const resolveLiveGate = (tid, verdict) => {
    patchLive(tid, (m) => ({
      ...m,
      status: verdict === "approved" ? "completed" : "waiting",
      steps: m.steps.map((s) => ({ ...s, status: verdict === "approved" ? "completed" : s.status === "gate" ? "planned" : s.status })),
      gate: { ...m.gate, resolved: verdict }
    }));
    onToast(verdict === "approved" ? "Approved. PR opened, mission complete — Historian wrote the learning." : "Rejected. Nothing shipped, the branch is parked.");
  };

  const send = () => {
    const text = draft.trim();
    if (!text || typing) return;
    setExtra((xs) => ({ ...xs, [thread]: [...(xs[thread] || []), { role: "user", text }] }));
    setDraft("");
    setTyping(true);
    const isSeeded = thread === "c1" || thread === "c2" || thread === "c3";
    if (isSeeded) {
      wait(900, () => {
        setExtra((xs) => ({ ...xs, [thread]: [...(xs[thread] || []), { role: "ai", text: "Noted. I folded that into the mission context. If it changes scope, Critic will flag it before Builder picks it up." }] }));
        setTyping(false);
      });
    } else {
      wait(700, () => {
        setExtra((xs) => ({ ...xs, [thread]: [...(xs[thread] || []), { role: "ai", stream: true, cockpit: true, text: "On it. Dispatching specialists — watch the plan assemble below. You'll only hear from me at the gate." }] }));
        setTyping(false);
        dispatch(thread, text);
      });
      setThreads((ts) => ts.map((t) => t.id === thread ? { ...t, title: extractTitle(text), mission: "live" } : t));
    }
  };
  useEffectC(() => {if (endRef.current) endRef.current.scrollTop = endRef.current.scrollHeight;}, [extra, typing, mission, thread, live]);

  return (
    <div data-screen-label="Chat" style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Threads */}
      <div style={{ width: 224, flexShrink: 0, borderRight: "1px solid var(--hairline)", padding: "18px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 8px 10px" }}>
          <MonoLabel>Threads</MonoLabel>
          <button aria-label="New thread" className="btn btn-ghost" style={{ padding: "3px 7px" }} onClick={newThread}><IcPlus size={12} /></button>
        </div>
        {threads.map((t) =>
        <button key={t.id} onClick={() => setThread(t.id)} style={{
          display: "flex", flexDirection: "column", gap: 1, padding: "8px 10px", borderRadius: 8, textAlign: "left",
          background: thread === t.id ? "var(--surface-2)" : "transparent"
        }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
              {t.unread ? <span className="dot" style={{ width: 6, height: 6, background: "var(--ember)" }} title="Unread"></span> : null}
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: thread === t.id || t.unread ? 550 : 400, color: thread === t.id ? "var(--ink)" : "var(--ink-muted)" }}>{t.title}</span>
              {t.mission ? <IcBranch size={11} style={{ color: "var(--agent)", flexShrink: 0 }} /> : null}
            </span>
            <span className="mono-label" style={{ fontSize: 9 }}>{t.when}{t.mission ? " · mission live" : ""}</span>
          </button>
        )}
      </div>

      {/* Conversation */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div ref={endRef} className="scrollbar-thin" style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
            {thread === "c1" ?
            <React.Fragment>
                <Bubble role="user">What came in overnight on checkout?</Bubble>
                <Bubble role="ai">
                  <p>14 new signals, 9 of them cluster on guest checkout friction <Cite n={1} />. The funnel confirms it: completion fell from 64% to 51% after v2.41 <Cite n={2} />. Scout filed it as the theme "Checkout drop-off" and Strategist already scored it to the top of the queue.</p>
                  <AiContract onGo={onGo} onToast={onToast} />
                </Bubble>
                <Bubble role="user">Turn the checkout drop-off theme into a shipped fix. Keep scope to the guest flow.</Bubble>
                <Bubble role="ai">
                  <p style={{ marginBottom: 12 }}>Dispatched. Five specialists carry it end to end, you'll only hear from me at the gates.</p>
                  <MissionCockpit mission={mission} gateApproval={gateApproval} onApprove={onApprove} onReject={onReject} onGo={onGo} />
                  <AiContract onGo={onGo} onToast={onToast} />
                </Bubble>
              </React.Fragment> :
            D.threadMessages[thread] ?
            D.threadMessages[thread].map((m, i) =>
            <Bubble key={i} role={m.role === "user" ? "user" : "ai"}>
                  <p>{m.text} {(m.cites || []).map((n) => <Cite key={n} n={n} />)}</p>
                  {m.role === "ai" ? <AiContract onGo={onGo} onToast={onToast} /> : null}
                </Bubble>
            ) :
            threadExtra.length === 0 ?
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-faint)" }}>
                <div style={{ display: "inline-flex", marginBottom: 12, color: "var(--ink-subtle)" }}><CadenceMark size={34} /></div>
                <p style={{ fontSize: 13 }}>Fresh thread. Hand me a goal and I'll dispatch a mission.</p>
              </div> :
            null}
            {threadExtra.map((m, i) =>
            <Bubble key={i} role={m.role === "user" ? "user" : "ai"}>
                <p>{m.stream ? <StreamText key={m.text} text={m.text} /> : m.text}</p>
                {m.cockpit && live[thread] ?
              <div style={{ margin: "12px 0" }} className="fade-up">
                    <MissionCockpit mission={live[thread]} gateApproval={live[thread].gate || null}
                onApprove={() => resolveLiveGate(thread, "approved")}
                onReject={() => resolveLiveGate(thread, "rejected")}
                onGo={onGo} />
                  </div> :
              null}
                {m.role === "ai" && !m.stream ? <AiContract onGo={onGo} onToast={onToast} /> : null}
                {m.role === "ai" && m.stream && live[thread] && live[thread].gate ? <AiContract onGo={onGo} onToast={onToast} /> : null}
              </Bubble>
            )}
            {typing ?
            <Bubble role="ai"><span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ink-faint)", fontSize: 12.5 }}><span className="spinner"></span>thinking</span></Bubble> :
            null}
          </div>
        </div>

        {/* Composer */}
        <div style={{ padding: "0 32px 22px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, border: "1px solid var(--hairline)", borderRadius: 14, background: "var(--canvas)", padding: "10px 10px 10px 16px", boxShadow: "0 1px 3px oklch(0.2 0.02 60 / 6%)" }}>
              <textarea rows={1} value={draft} placeholder="Message Cadence…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {if (e.key === "Enter" && !e.shiftKey) {e.preventDefault();send();}}}
              style={{ flex: 1, border: 0, outline: "none", background: "transparent", resize: "none", fontSize: 13.5, lineHeight: 1.5, maxHeight: 120 }} />
              <button aria-label="Send" onClick={send} className="btn btn-primary" style={{ borderRadius: 10, padding: "7px 9px" }}><IcArrowUp size={14} /></button>
            </div>
            <div className="mono-label" style={{ fontSize: 9, marginTop: 6, textAlign: "center" }}>Enter to send · goals become missions · gates always come back to you</div>
          </div>
        </div>
      </div>
    </div>);

}

Object.assign(window, { ChatScreen, GatePanel, AiContract });