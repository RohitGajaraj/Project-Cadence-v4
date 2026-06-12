// App shell — sidebar (v5 felt product rail), topbar with budget, ⌘K palette, toasts.
const { useState, useEffect, useRef } = React;

const NAV_WORKSPACE = [
{ id: "home", label: "Today", icon: IcHome },
{ id: "govern", label: "Approvals", icon: IcInbox, go: { name: "govern", tab: "Approvals" } },
{ id: "chat", label: "Chat", icon: IcChat }];

const NAV_GROUPS = [
{ id: "product", label: "Product", icon: IcCompass },
{ id: "missions", label: "Missions", icon: IcActivity },
{ id: "knowledge", label: "Knowledge", icon: IcBook }];

const TRUST_LINKS = [
{ go: { name: "govern" }, label: "Approvals", icon: IcInbox },
{ go: { name: "govern", tab: "Budgets" }, label: "Budgets", icon: IcGauge },
{ go: { name: "govern", tab: "Guardrails" }, label: "Engine room", icon: IcShield },
{ go: { name: "settings" }, label: "Connectors", icon: IcPlug }];


function NavRow({ item, active, badge, onGo }) {
  const Icon = item.icon;
  return (
    <button onClick={() => onGo(item.go || item.id)} style={{
      position: "relative", display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "6px 12px", borderRadius: 6, fontSize: 13, textAlign: "left",
      color: active ? "var(--ink)" : "var(--ink-muted)",
      background: active ? "var(--surface-2)" : "transparent",
      fontWeight: active ? 500 : 400, transition: "background var(--dur-fast), color var(--dur-fast)"
    }}
    onMouseEnter={(e) => {if (!active) e.currentTarget.style.background = "color-mix(in oklab, var(--surface-2) 60%, transparent)";}}
    onMouseLeave={(e) => {if (!active) e.currentTarget.style.background = "transparent";}}>
      {active ? <span aria-hidden="true" style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", height: 16, width: 2, borderRadius: 99, background: "var(--ink)" }}></span> : null}
      <Icon size={14} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {badge ? <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600,
        background: "var(--coral)", color: "oklch(0.99 0.005 60)", borderRadius: 99,
        minWidth: 17, height: 17, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px"
      }}>{badge}</span> : null}
    </button>);

}

function Sidebar({ route, onGo, pendingCount, onOpenCmdk, workspace, onWorkspaceAction, theme, onToggleTheme, runningCount }) {
  const D = window.CADENCE_DATA;
  const [wsOpen, setWsOpen] = useState(false);
  const act = (a) => {setWsOpen(false);onWorkspaceAction(a);};
  return (
    <aside style={{
      width: 232, flexShrink: 0, display: "flex", flexDirection: "column",
      borderRight: "1px solid var(--hairline)", background: "var(--canvas)", height: "100%"
    }}>
      {/* Workspace switcher */}
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--hairline)", position: "relative" }}>
        <button onClick={() => setWsOpen((v) => !v)} aria-expanded={wsOpen} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left" }}>
          <span style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}>
            <CadenceMark size={26} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 500, lineHeight: 1.2, fontFamily: "'Newsreader', serif", letterSpacing: "-0.01em" }}>Cadence</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--ink-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{workspace.name} · {workspace.product}</span>
          </span>
          <IcChevDown size={12} style={{ color: "var(--ink-faint)", transform: wsOpen ? "rotate(180deg)" : "none", transition: "transform var(--dur-fast)" }} />
        </button>
        {wsOpen ?
        <React.Fragment>
            <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={() => setWsOpen(false)}></div>
            <div className="menu" role="menu" style={{ zIndex: 70 }}>
              <div className="mono-label" style={{ fontSize: 9, padding: "5px 10px 3px" }}>Workspaces</div>
              {D.workspaces.map((w) =>
            <button key={w.id} className="menu-item" onClick={() => act({ type: "switch", ws: w })}>
                  <span style={{ width: 13, display: "inline-flex" }}>{w.name === workspace.name ? <IcCheck size={12} /> : null}</span>
                  <span style={{ flex: 1 }}>{w.name}</span>
                </button>
            )}
              <div className="menu-sep"></div>
              <div className="mono-label" style={{ fontSize: 9, padding: "5px 10px 3px" }}>Products</div>
              {(D.workspaces.find((w) => w.name === workspace.name) || D.workspaces[0]).products.map((p) =>
            <button key={p} className="menu-item" onClick={() => act({ type: "product", product: p })}>
                  <span style={{ width: 13, display: "inline-flex" }}>{p === workspace.product ? <IcCheck size={12} /> : null}</span>
                  <span style={{ flex: 1 }}>{p}</span>
                </button>
            )}
              <div className="menu-sep"></div>
              {[["New workspace", IcPlus], ["Rename workspace", IcChevRight], ["Invite teammates", IcUsers], ["Leave workspace", IcX], ["Sign out", IcExternal]].map(([label, Icon]) =>
            <button key={label} className="menu-item" onClick={() => act({ type: "action", label })}>
                  <span style={{ width: 13, display: "inline-flex", color: "var(--ink-faint)" }}><Icon size={12} /></span>
                  <span style={{ flex: 1 }}>{label}</span>
                </button>
            )}
            </div>
          </React.Fragment> :
        null}
      </div>

      {/* ⌘K search */}
      <div style={{ padding: "10px 12px 4px" }}>
        <button onClick={onOpenCmdk} style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px",
          borderRadius: 6, border: "1px solid var(--hairline)", color: "var(--ink-faint)", fontSize: 12.5,
          background: "var(--surface-1)"
        }}>
          <IcSearch size={13} /><span style={{ flex: 1, textAlign: "left" }}>Jump to…</span>
          <span className="mono-label" style={{ fontSize: 10 }}>⌘K</span>
        </button>
      </div>

      {/* Workspace rail */}
      <nav style={{ padding: "10px 12px 0", display: "flex", flexDirection: "column", gap: 1 }}>
        {NAV_WORKSPACE.map((it) =>
        <NavRow key={it.label} item={it} active={route.name === it.id} onGo={onGo}
        badge={it.id === "govern" ? pendingCount || null : null} />
        )}
      </nav>

      {/* Groups */}
      <div style={{ padding: "16px 12px 0", flex: 1 }}>
        <div className="mono-label" style={{ padding: "0 12px 6px" }}>Loop</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {NAV_GROUPS.map((it) =>
          <NavRow key={it.id} item={it} active={route.name === it.id || it.id === "missions" && route.name === "mission"} onGo={onGo} />
          )}
        </div>
      </div>

      {/* Trust row + user */}
      <div style={{ borderTop: "1px solid var(--hairline)", padding: "10px 12px" }}>
        {runningCount > 0 ? (
          <button className="mono-label" onClick={() => onGo({ name: "missions" })} style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--action-blue)", padding: "0 4px 10px", fontSize: 9.5 }}>
            <span className="dot dot-running" style={{ width: 5, height: 5 }}></span>{runningCount} agents running →
          </button>
        ) : null}
        <div className="mono-label" style={{ padding: "0 4px 6px" }}>Trust</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {TRUST_LINKS.map((t) => {
            const Icon = t.icon;
            const showBadge = t.label === "Approvals" && pendingCount > 0;
            return (
              <button key={t.label} title={t.label} aria-label={showBadge ? `Approvals · ${pendingCount} pending` : t.label} onClick={() => onGo(t.go)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                height: 30, borderRadius: 6, color: "var(--ink-subtle)", border: "1px solid var(--hairline)",
                position: "relative",
                transition: "color var(--dur-fast), border-color var(--dur-fast)"
              }}
              onMouseEnter={(e) => {e.currentTarget.style.color = "var(--ink)";}}
              onMouseLeave={(e) => {e.currentTarget.style.color = "var(--ink-subtle)";}}>
                <Icon size={13} />
                {showBadge ?
                <span className="dot-gate" style={{
                  position: "absolute", top: -5, right: -4,
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 700,
                  background: "var(--coral)", color: "oklch(0.99 0.005 60)", borderRadius: 99,
                  minWidth: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 3px"
                }}>{pendingCount}</span> :
                null}
              </button>);

          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 2px" }}>
          <BudgetChip onGo={onGo} up />
          <span style={{ flex: 1 }}></span>
          <button aria-label="Toggle theme" title="Toggle theme" onClick={onToggleTheme} style={{ color: "var(--ink-subtle)", display: "flex", padding: 4 }}>
            {theme === "dark" ? <IcSun size={13} /> : <IcMoon size={13} />}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{
            width: 26, height: 26, borderRadius: 99, background: "var(--soft-stone)", color: "var(--ink)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600
          }}>{window.CADENCE_DATA.user.initials}</span>
          <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink-muted)" }}>{window.CADENCE_DATA.user.name}</span>
          <button title="Settings" aria-label="Settings" onClick={() => onGo({ name: "settings" })} style={{ color: route.name === "settings" ? "var(--ink)" : "var(--ink-subtle)", display: "flex" }}>
            <IcSliders size={13} />
          </button>
          <span className="dot dot-completed" title="All systems normal"></span>
        </div>
      </div>
    </aside>);

}

function BudgetChip({ onGo, up }) {
  const b = window.CADENCE_DATA.budget;
  const [open, setOpen] = useState(false);
  const pct = Math.min(100, b.todayBurn / b.todayCap * 100);
  const tone = pct > 80 ? "var(--rose)" : pct > 50 ? "var(--coral)" : "var(--ink-subtle)";
  return (
    <div style={{ position: "relative" }}
    onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="mono-label" title="Open budgets" onClick={() => onGo({ name: "govern", tab: "Budgets" })} style={{ display: "flex", alignItems: "center", gap: 7, color: tone }}>
        <IcCoins size={12} />
        <span className="tabular">${b.todayBurn.toFixed(2)} / ${b.todayCap}</span>
        <span style={{ width: 52, height: 3, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", display: "inline-block" }}>
          <span style={{ display: "block", height: "100%", width: `${pct}%`, background: tone, transition: "width var(--dur-slow)" }}></span>
        </span>
      </button>
      {open ?
      <div style={up ? {
        position: "absolute", bottom: "calc(100% + 8px)", left: 0, width: 220, zIndex: 50,
        background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 8,
        padding: "12px 14px", boxShadow: "0 12px 32px -16px oklch(0 0 0 / 30%)"
      } : {
        position: "absolute", top: "calc(100% + 8px)", right: 0, width: 230, zIndex: 50,
        background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: 8,
        padding: "12px 14px", boxShadow: "0 12px 32px -16px oklch(0 0 0 / 30%)"
      }} className="fade-up">
          <div className="mono-label" style={{ marginBottom: 8 }}>Budget</div>
          {[["Today", b.todayBurn, b.todayCap], ["June", b.monthBurn, b.monthCap]].map(([label, burn, cap]) =>
        <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", color: "var(--ink-muted)" }}>
              <span>{label}</span><span className="tabular" style={{ color: "var(--ink)" }}>${burn.toFixed(2)} <span style={{ color: "var(--ink-faint)" }}>of ${cap}</span></span>
            </div>
        )}
          <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 6 }}>Mostly Builder CI loops. Caps live in Govern.</div>
        </div> :
      null}
    </div>);

}

function TopBar({ crumbs }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const w = window.CADENCE_DATA.weather;
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 16, padding: "0 28px", height: 54, flexShrink: 0,
      borderBottom: "1px solid var(--hairline)", background: "var(--canvas)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-subtle)", whiteSpace: "nowrap", overflow: "hidden" }}>
        {crumbs.map((c, i) =>
        <React.Fragment key={i}>
            {i > 0 ? <IcChevRight size={11} style={{ color: "var(--ink-faint)" }} /> : null}
            <span style={{ color: i === crumbs.length - 1 ? "var(--ink)" : undefined, fontWeight: i === crumbs.length - 1 ? 500 : 400 }}>{c}</span>
          </React.Fragment>
        )}
      </div>
      <span style={{ flex: 1 }}></span>
      <span className="mono-label" style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        <IcCalendar size={11} />{today}
      </span>
      <span className="mono-label" title={`${w.city} · ${w.desc}`} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        <IcDrizzle size={12} />{w.city} · <span className="tabular">{w.temp}</span>
      </span>
    </header>);

}

function CommandPalette({ open, onClose, onGo }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {if (open) {setQ("");setTimeout(() => inputRef.current && inputRef.current.focus(), 30);}}, [open]);
  if (!open) return null;
  const D = window.CADENCE_DATA;
  const items = [
  { label: "Today", hint: "Home", go: { name: "home" }, icon: IcHome },
  { label: "Chat", hint: "Threads", go: { name: "chat" }, icon: IcChat },
  { label: "Missions", hint: "Live runs", go: { name: "missions" }, icon: IcActivity },
  { label: "Product", hint: "Signals · Specs", go: { name: "product" }, icon: IcCompass },
  { label: "Knowledge", hint: "Memory · Docs", go: { name: "knowledge" }, icon: IcBook },
  { label: "Approvals", hint: "Govern", go: { name: "govern" }, icon: IcInbox },
  { label: "Settings", hint: "Workspace", go: { name: "settings" }, icon: IcSliders },
  { label: "Login screen", hint: "First-run", go: { name: "login" }, icon: IcExternal },
  { label: "Onboarding", hint: "First-run", go: { name: "onboarding" }, icon: IcSparkles },
  ...D.missions.map((m) => ({ label: m.title, hint: "Mission", go: { name: "mission", missionId: m.id }, icon: IcBranch }))].
  filter((it) => it.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="cmdk-overlay" onMouseDown={(e) => {if (e.target === e.currentTarget) onClose();}}>
      <div className="cmdk" role="dialog" aria-label="Command palette">
        <input ref={inputRef} value={q} placeholder="Where to? Type a surface or mission…"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && items[0]) {onGo(items[0].go);onClose();}
        }} />
        <div style={{ padding: 6, maxHeight: 320, overflowY: "auto" }} className="scrollbar-thin">
          {items.length === 0 ? <div style={{ padding: "14px 10px", fontSize: 13, color: "var(--ink-faint)" }}>Nothing matches. Try a surface name.</div> :
          items.map((it, i) => {
            const Icon = it.icon;
            return (
              <button key={it.label + i} className={`cmdk-item ${i === 0 ? "sel" : ""}`}
              onClick={() => {onGo(it.go);onClose();}}>
                  <Icon size={13} />
                  <span style={{ flex: 1 }}>{it.label}</span>
                  <span className="mono-label" style={{ fontSize: 9.5 }}>{it.hint}</span>
                </button>);

          })}
        </div>
      </div>
    </div>);

}

function Toasts({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map((t) =>
      <div className="toast" key={t.id}>
          <span>{t.text}</span>
          {t.undo ? <button onClick={t.undo}>Undo</button> : null}
        </div>
      )}
    </div>);

}

/* CookingBanner — a quiet "something is running" strip on every screen. */
function CookingBanner({ missions, onGo, onDismiss }) {
  const running = missions.find((m) => m.status === "running");
  const text = running ?
  `Agents are building in lumen/web · cad/checkout-guest · CI green · ${running.title}` :
  "Loop idle · PR #214 shipped · Historian wrote the learning to memory";
  return (
    <div className="cooking-banner">
      <span className={`dot ${running ? "dot-running" : "dot-completed"}`} style={{ width: 6, height: 6 }}></span>
      <span className="mono-label" style={{ fontSize: 9.5, color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
      <span style={{ flex: 1 }}></span>
      <button className="mono-label" style={{ fontSize: 9.5, color: "var(--action-blue)" }} onClick={() => onGo({ name: "missions" })}>Watch live →</button>
      <button aria-label="Dismiss banner" onClick={onDismiss} style={{ color: "var(--ink-faint)", display: "flex" }}><IcX size={11} /></button>
    </div>);

}

/* ConstructionPill — temporary, distinctive, all screens: the platform is
   actively being built. Remove when fully shipped. */
function ConstructionPill({ onDismiss }) {
  return (
    <div className="construction-pill" role="status">
      <CadenceMark size={13} />
      <span>Agents are building in the back · fresh build loading</span>
      <button aria-label="Dismiss" onClick={onDismiss} style={{ color: "var(--ink-faint)", display: "flex", padding: 3 }}><IcX size={10} /></button>
    </div>);

}

Object.assign(window, { Sidebar, TopBar, CommandPalette, Toasts, CookingBanner, ConstructionPill });