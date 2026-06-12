// Lumen demo workspace — seeded to match the repo's demo data shape.
window.CADENCE_DATA = {
  workspace: { name: "Demo workspace", product: "Lumen" },
  workspaces: [
    { id: "w1", name: "Demo workspace", products: ["Lumen", "Atlas"] },
    { id: "w2", name: "Acme product team", products: ["Checkout v2"] },
  ],
  weather: { city: "Bengaluru", temp: "24°", desc: "drizzle" },
  user: { name: "Rohit", initials: "RG" },
  budget: { todayBurn: 1.84, todayCap: 10, monthBurn: 41.2, monthCap: 300 },

  brief: [
    { text: "14 new signals overnight. 9 cluster on checkout friction, Scout filed the theme \"Checkout drop-off\".", cites: [1, 2] },
    { text: "Mission \"Smart retry for failed payments\" passed CI. The PR is ready for your review.", cites: [3] },
    { text: "Northwind asked about the SSO timeline twice this week. Signal strength is rising.", cites: [4] },
    { text: "Spec \"Saved carts v2\" has 3 unresolved Critic comments, all on the offline edge case.", cites: [] },
  ],

  citations: {
    1: { source: "Intercom #4821", body: "\"Couldn't finish checkout on my phone, the card form kept resetting.\" Plus 6 similar tickets this week." },
    2: { source: "Mixpanel funnel · Jun 11", body: "Guest checkout completion fell from 64% to 51% after the v2.41 release." },
    3: { source: "GitHub · lumen/web #213", body: "CI green on cad/smart-retry. 7 files changed, Inspector score 94." },
    4: { source: "Gong · Northwind QBR Jun 9", body: "\"SSO is a hard requirement for the org-wide rollout in Q3.\"" },
  },

  approvals: [
    {
      id: "a1", agent: "Builder", agentSlug: "builder", mission: "Checkout drop-off fix", missionId: "m1",
      tool: "create_pull_request", risk: "medium",
      summary: "Open PR #214 in lumen/web. Guest checkout fix, 9 files, CI green, Inspector score 96.",
      consequence: "Approve · opens the PR", reject: "Reject · nothing ships", expires: "2h 10m",
    },
    {
      id: "a2", agent: "Marketer", agentSlug: "marketer", mission: "Smart retry for failed payments", missionId: "m2",
      tool: "publish_changelog", risk: "low",
      summary: "Changelog entry plus a 90-word email snippet for the smart retry release, in brand voice.",
      consequence: "Approve · publishes", reject: "Reject · stays drafted", expires: "6h",
    },
    {
      id: "a3", agent: "Strategist", agentSlug: "strategist", mission: "Opportunity queue", missionId: null,
      tool: "apply_rescore", risk: "low",
      summary: "Re-rank the queue after 14 overnight signals. Checkout drop-off moves to #1, SSO to #2.",
      consequence: "Approve · re-ranks", reject: "Reject · keeps order", expires: "today",
    },
  ],

  agents: [
    { slug: "scout", name: "Scout", role: "Signal intake", status: "running", note: "clustering 14 signals" },
    { slug: "strategist", name: "Strategist", role: "Opportunity scoring", status: "waiting", note: "1 call waiting on you" },
    { slug: "scribe", name: "Scribe", role: "Spec drafting", status: "running", note: "saved carts v2 revisions" },
    { slug: "builder", name: "Builder", role: "Code execution", status: "gate", note: "holding at PR gate" },
    { slug: "inspector", name: "Inspector", role: "Quality gate", status: "idle", note: "last run 22m ago" },
    { slug: "marketer", name: "Marketer", role: "Launch kit", status: "waiting", note: "changelog drafted" },
    { slug: "quant", name: "Quant", role: "Outcome analytics", status: "idle", note: "next read at 6pm" },
    { slug: "historian", name: "Historian", role: "Product memory", status: "idle", note: "memory synced" },
  ],

  missions: [
    {
      id: "m1", title: "Checkout drop-off fix", status: "running", started: "Today 09:12",
      goal: "Turn the checkout drop-off theme into a shipped guest flow fix.",
      cost: 0.62, tokens: "48k in / 11k out", traceId: "tr_8f2c",
      steps: [
        { agent: "discovery", goal: "Pull the 14 checkout signals, cluster and cite the theme", status: "completed" },
        { agent: "strategist", goal: "Score against the queue, write the rationale", status: "completed" },
        { agent: "prd_writer", goal: "Draft the spec with citations, run a Critic pass", status: "completed" },
        { agent: "builder", goal: "Implement on cad/checkout-guest, self-correct CI", status: "running" },
        { agent: "orchestrator", goal: "Verify, hand to Releaser, write the learning to memory", status: "planned" },
      ],
    },
    {
      id: "m2", title: "Smart retry for failed payments", status: "awaiting_review", started: "Today 07:40",
      goal: "Recover failed payments with an automatic smart retry.",
      cost: 1.08, tokens: "92k in / 18k out", traceId: "tr_5d1a",
      steps: [
        { agent: "discovery", goal: "Quantify failed payment volume and causes", status: "completed" },
        { agent: "prd_writer", goal: "Spec the retry ladder and guardrails", status: "completed" },
        { agent: "builder", goal: "Implement retry service, pass CI", status: "completed" },
        { agent: "marketer", goal: "Draft changelog and email snippet", status: "gate" },
      ],
    },
    {
      id: "m3", title: "Saved carts v2 spec", status: "completed", started: "Yesterday",
      goal: "Re-spec saved carts around the multi-device session.",
      cost: 0.34, tokens: "31k in / 7k out", traceId: "tr_2b9e",
      steps: [
        { agent: "discovery", goal: "Collect cart abandonment evidence", status: "completed" },
        { agent: "prd_writer", goal: "Draft v2 spec, resolve Critic comments", status: "completed" },
      ],
    },
    {
      id: "m4", title: "Onboarding email rewrite", status: "failed", started: "Yesterday",
      goal: "Rewrite the onboarding sequence in the new voice.",
      cost: 0.12, tokens: "9k in / 3k out", traceId: "tr_c771",
      steps: [
        { agent: "marketer", goal: "Rewrite 5 emails in brand voice", status: "failed", note: "guardrail: voice check failed twice" },
      ],
    },
  ],

  hops: [
    {
      agent: "Builder", slug: "builder", status: "running", duration: "4m 12s", pct: 78,
      steps: [
        "thought · the card form resets because the iframe remounts on viewport change",
        "called repo.read lumen/web/src/checkout/GuestForm.tsx",
        "called branch.commit cad/checkout-guest · 9 files",
        "called ci.run · pass (2m 14s)",
        "thought · CI green, requesting PR gate",
      ],
    },
    {
      agent: "Inspector", slug: "inspector", status: "completed", duration: "1m 03s", pct: 19,
      steps: ["called eval.run quality-gate · score 96", "reply · approved for PR"],
    },
  ],

  tasks: [
    { id: "t1", text: "Review Builder's PR #214 once approved", done: false, deep: false },
    { id: "t2", text: "Northwind SSO response, draft is in chat", done: false, deep: true },
    { id: "t3", text: "Resolve 3 Critic comments on saved carts v2", done: false, deep: true },
    { id: "t4", text: "Skim Quant's weekly funnel read", done: true, deep: false },
  ],

  meetings: [
    { time: "11:00", title: "Northwind weekly sync", note: "agenda drafted by Scribe" },
    { time: "14:30", title: "Design review · saved carts", note: "2 mockups attached" },
  ],

  priorities: [
    { label: "Checkout drop-off", score: 92, trend: "up" },
    { label: "SSO for enterprise", score: 81, trend: "up" },
    { label: "Saved carts v2", score: 64, trend: "flat" },
    { label: "Mobile nav refresh", score: 41, trend: "down" },
  ],

  pulse: [
    { who: "Northwind (pilot)", note: "Waiting on SSO timeline. Two asks this week.", tone: "warm" },
    { who: "CS team", note: "Checkout tickets down 12% since the hotfix.", tone: "good" },
    { who: "Eng leads", note: "Want earlier visibility into Builder branches.", tone: "neutral" },
  ],

  signals: [
    { id: "s1", theme: "Checkout drop-off", count: 9, sources: "Intercom · Mixpanel", fresh: "2h", strength: 92, evidence: [
      "“Couldn't finish checkout on my phone, the card form kept resetting.” — Intercom #4821",
      "“Tried three times to pay as a guest. Gave up, ordered elsewhere.” — Intercom #4836",
      "Guest checkout completion 64% → 51% after v2.41. — Mixpanel funnel, Jun 11"] },
    { id: "s2", theme: "SSO for enterprise", count: 4, sources: "Gong · Email", fresh: "1d", strength: 81, evidence: [
      "“SSO is a hard requirement for the org-wide rollout in Q3.” — Gong, Northwind QBR Jun 9",
      "“Security team will not approve password logins past pilot.” — Email, Northwind IT"] },
    { id: "s3", theme: "Cart sync across devices", count: 6, sources: "Reviews · Intercom", fresh: "3d", strength: 64, evidence: [
      "“Added items on my laptop, gone on the app.” — App Store review",
      "Cart-related tickets are 11% of volume this month. — Intercom tag report"] },
    { id: "s4", theme: "Slow dashboard loads", count: 3, sources: "Support", fresh: "5d", strength: 38, evidence: [
      "“Analytics tab takes ~12s to paint on our largest org.” — Support, power-user cohort"] },
  ],

  chatThreads: [
    { id: "c1", title: "Checkout drop-off", when: "now", mission: "m1" },
    { id: "c2", title: "Northwind SSO response", when: "2h", unread: true },
    { id: "c3", title: "Q3 pricing questions", when: "1d" },
  ],

  replayModels: ["claude-opus-4.6", "gemini-2.5-pro", "cadence-fast"],

  threadMessages: {
    c2: [
      { role: "user", text: "Draft a reply to Northwind on the SSO timeline." },
      { role: "ai", text: "Drafted. SAML SSO lands with the enterprise milestone in Q3, pilot orgs get it two sprints early. The full draft is in your tasks, ready to send.", cites: [4] },
    ],
    c3: [
      { role: "user", text: "Summarize the open pricing questions for Q3." },
      { role: "ai", text: "Three open: usage-based vs seat pricing for agent runs, the governance premium for enterprise, and whether BYO keys discount the platform fee. Pricer has a model for each." },
    ],
  },

  connectors: [
    { name: "Intercom", desc: "Support tickets → signals", status: "connected" },
    { name: "Gong", desc: "Call transcripts → signals", status: "connected" },
    { name: "Mixpanel", desc: "Funnels and cohorts", status: "connected" },
    { name: "GitHub", desc: "Branches, PRs, CI", status: "connected" },
    { name: "Slack", desc: "Gate alerts and digests", status: "available" },
    { name: "Linear", desc: "Issue sync", status: "available" },
  ],

  aiMeta: { score: 92, model: "claude-sonnet-4.5 · gateway", latency: "1.4s · 240ms ttft", tokens: "1.2k in / 410 out", cost: "$0.0042" },

  opportunities: [
  { rank: 1, title: "Checkout drop-off fix", ice: 8.7, rescore: [7.9, 8.7], reach: "38% of orders", effort: "S", status: "in mission", rationale: "9 fresh signals, funnel regression confirmed, small surface area." },
  { rank: 2, title: "SSO for enterprise", ice: 8.1, rescore: null, reach: "3 pilot orgs", effort: "L", status: "queued", rationale: "Hard requirement for Northwind Q3 rollout. Two asks this week." },
  { rank: 3, title: "Saved carts v2", ice: 6.4, rescore: [6.9, 6.4], reach: "22% of users", effort: "M", status: "spec ready", rationale: "Cart sync signals steady. Spec passed Critic, awaiting capacity." },
  { rank: 4, title: "Dashboard performance", ice: 3.8, rescore: null, reach: "power users", effort: "M", status: "watching", rationale: "Only 3 signals, all from one cohort. Quant is monitoring." }],

  specs: [
  { title: "Smart retry for failed payments", state: "shipped", critic: "passed", cites: 11, updated: "today" },
  { title: "Checkout guest flow fix", state: "in build", critic: "passed", cites: 9, updated: "today" },
  { title: "Saved carts v2", state: "review", critic: "3 open comments", cites: 14, updated: "yesterday" },
  { title: "SSO · SAML + SCIM", state: "draft", critic: "not run", cites: 6, updated: "2d ago" }],

  roadmap: [
  { quarter: "Now", items: ["Checkout drop-off fix", "Smart retry rollout"] },
  { quarter: "Next", items: ["SSO for enterprise", "Saved carts v2"] },
  { quarter: "Later", items: ["Dashboard performance", "Mobile nav refresh"] }],

  releases: [
  { version: "v2.43", when: "Jun 10", note: "Smart retry for failed payments · changelog drafted, gate pending", health: "good" },
  { version: "v2.42", when: "Jun 4", note: "Checkout hotfix · support volume −12% since", health: "good" },
  { version: "v2.41", when: "May 28", note: "Checkout v2 · regressed guest completion, now being fixed", health: "bad" }],

  guardrails: [
  { name: "Spend ceiling", rule: "Pause any mission past $5 without a gate", fired: "never" },
  { name: "Brand voice check", rule: "Marketer output must pass voice eval ≥ 90", fired: "2d ago · onboarding rewrite" },
  { name: "Prod write lock", rule: "No agent writes to main · PR gates only", fired: "never" },
  { name: "PII filter", rule: "Signals are scrubbed before clustering", fired: "continuous" },
  { name: "Scope drift", rule: "Critic flags spec changes mid-mission", fired: "5d ago · saved carts" }],

  traces: [
  { id: "tr_8f2c", mission: "Checkout drop-off fix", hops: 14, tokens: "48k", cost: "$0.62", when: "running" },
  { id: "tr_5d1a", mission: "Smart retry for failed payments", hops: 22, tokens: "110k", cost: "$1.08", when: "2h ago" },
  { id: "tr_2b9e", mission: "Saved carts v2 spec", hops: 9, tokens: "38k", cost: "$0.34", when: "1d ago" },
  { id: "tr_c771", mission: "Onboarding email rewrite", hops: 4, tokens: "12k", cost: "$0.12", when: "1d ago · failed" }],

  evals: [
  { name: "Spec quality (LLM judge)", score: 91, trend: "up", n: "32 runs" },
  { name: "Code review gate", score: 94, trend: "flat", n: "18 PRs" },
  { name: "Brand voice", score: 88, trend: "up", n: "41 drafts" },
  { name: "Signal clustering precision", score: 86, trend: "flat", n: "weekly sample" }],

  memoryFeed: [
  { id: "l1", when: "06:30", text: "Checkout fixes that touch the card iframe need viewport-resize tests. Written after tr_8f2c." },
  { id: "l2", when: "Yesterday", text: "Northwind counts SSO as a launch blocker, not a feature ask. Weight enterprise signals accordingly." },
  { id: "l3", when: "Jun 9", text: "Voice evals fail most often on exclamation density. Marketer prompt updated." },
  { id: "l4", when: "Jun 6", text: "Guest users abandon at address entry 2.3× more on mobile. Inform all checkout specs." }],

  decisions: [
  { title: "Retry ladder caps at 3 attempts", who: "You + Builder", when: "Jun 8", why: "Bank-side rate limits" },
  { title: "Guest flow ships before SSO", who: "You", when: "Jun 5", why: "Revenue regression outranks pipeline" },
  { title: "Saved carts scoped to web first", who: "You + Strategist", when: "Jun 2", why: "Mobile session model unsettled" }],

  docs: [
  { title: "Lumen product principles", kind: "pinned", updated: "May 30", excerpt: "Ship the smallest thing that closes the user's loop. Every feature must name the signal that justified it and the metric that will judge it. Defaults are decisions — make them carefully…" },
  { title: "Checkout architecture map", kind: "pinned", updated: "Jun 4", excerpt: "Guest flow renders the card iframe inside CheckoutShell; the iframe remounts on viewport change (root cause of the v2.41 regression). Payment service owns retries; the new smart-retry ladder caps at 3…" },
  { title: "Q3 enterprise readiness plan", kind: "doc", updated: "Jun 9", excerpt: "Three gates to enterprise-ready: SAML SSO + SCIM (Northwind blocker), audit log export, and per-workspace data residency. SSO lands two sprints before the org-wide rollout…" },
  { title: "Pricing model scenarios", kind: "doc", updated: "Jun 7", excerpt: "Scenario B (usage-based agent runs + flat governance fee) models best across pilot cohorts. BYO keys discount the platform fee by 18% and improve enterprise close rates…" }],

  /* —— v4 IA alignment: data for the full tab sets from the repo —— */

  kanban: {
    todo: [
    { id: "k1", text: "Reproduce iframe remount on Android Chrome", who: "Builder", agent: true },
    { id: "k2", text: "Confirm SSO scope with Northwind IT", who: "You", agent: false }],
    doing: [
    { id: "k3", text: "Guest checkout fix · cad/checkout-guest", who: "Builder", agent: true },
    { id: "k4", text: "Saved carts v2 Critic comments", who: "Scribe", agent: true }],
    done: [
    { id: "k5", text: "Smart retry implementation + CI", who: "Builder", agent: true },
    { id: "k6", text: "Funnel read on v2.42 hotfix", who: "Quant", agent: true }]
  },

  calendar: [
  { id: "ev1", when: "Fri 12 · 11:00", day: 12, title: "Northwind weekly sync", kind: "meeting", note: "Agenda drafted by Scribe · transcript capture on", transcript: "Last week: SSO timeline pressed twice; promised an answer this week. Open items: pilot expansion seats, data residency question routed to security." },
  { id: "ev2", when: "Fri 12 · 14:30", day: 12, title: "Design review · saved carts", kind: "meeting", note: "2 mockups attached · Critic comments pre-read", transcript: "Pre-read: 3 unresolved Critic comments, all on the offline edge case. Decision needed: web-first scope holds or expands to mobile." },
  { id: "ev3", when: "Mon 15 · 10:00", day: 15, title: "Sprint planning", kind: "meeting", note: "Roadmap Now-lane is the agenda", transcript: null },
  { id: "ev4", when: "Tue 16 · 16:00", day: 16, title: "v2.43 release window", kind: "release", note: "Smart retry ships if the changelog gate clears", transcript: null }],

  controls: {
    killSwitch: false,
    missionCap: 6,
    stuckApprovals: 1,
    pipelines: [
    { id: "p1", name: "Auto-approve low-risk gates", desc: "Skips the queue for low-risk tool calls under $1", on: false },
    { id: "p2", name: "Nightly brief", desc: "Historian writes the morning brief at 06:30", on: true },
    { id: "p3", name: "Auto-retry failed missions", desc: "One retry with Historian's fix before paging you", on: true }]
  },

  prompts: [
  { id: "pr1", surface: "Scribe · spec drafting", version: "v14", note: "A/B vs v13 · +4 judge score", status: "testing" },
  { id: "pr2", surface: "Marketer · brand voice", version: "v9", note: "patched exclamation density after Jun 10 failure", status: "live" },
  { id: "pr3", surface: "Scout · signal clustering", version: "v11", note: "stable 6 weeks", status: "live" },
  { id: "pr4", surface: "Chat · intent routing", version: "v22", note: "rolled back from v23 (latency)", status: "live" }],

  analyticsGov: {
    stats: [["Spend · 30d", "$41.20", "of $300 cap"], ["Tokens · 30d", "9.4M", "in + out"], ["Median latency", "1.2s", "240ms ttft"]],
    perAgent: [
    { agent: "Builder", spend: 22.4, pct: 54 },
    { agent: "Scribe", spend: 8.1, pct: 20 },
    { agent: "Scout", spend: 4.6, pct: 11 },
    { agent: "Quant", spend: 3.2, pct: 8 },
    { agent: "Others", spend: 2.9, pct: 7 }]
  },

  drift: [
  { surface: "Spec drafting", delta: "+0.4", status: "stable", note: "within baseline band" },
  { surface: "Signal clustering", delta: "−2.1", status: "watch", note: "cluster precision dipped after Intercom schema change" },
  { surface: "Brand voice", delta: "+3.0", status: "stable", note: "improved since prompt v9" },
  { surface: "Intent routing", delta: "−0.3", status: "stable", note: "flat" }],

  /* ---- Govern drill-downs: analytics ranges, per-agent, eval suites,
          trace replays, drift detail ---- */
  governDetail: {
    analytics: {
      "7d": {
        stats: [["Spend · 7d", "$9.84", "of $70 cap"], ["Tokens · 7d", "2.1M", "in + out"], ["Median latency", "1.1s", "230ms ttft"]],
        perAgent: [
        { agent: "Builder", spend: 5.12, pct: 52 },
        { agent: "Scribe", spend: 1.97, pct: 20 },
        { agent: "Scout", spend: 1.18, pct: 12 },
        { agent: "Quant", spend: 0.88, pct: 9 },
        { agent: "Others", spend: 0.69, pct: 7 }]
      },
      "30d": {
        stats: [["Spend · 30d", "$41.20", "of $300 cap"], ["Tokens · 30d", "9.4M", "in + out"], ["Median latency", "1.2s", "240ms ttft"]],
        perAgent: [
        { agent: "Builder", spend: 22.4, pct: 54 },
        { agent: "Scribe", spend: 8.1, pct: 20 },
        { agent: "Scout", spend: 4.6, pct: 11 },
        { agent: "Quant", spend: 3.2, pct: 8 },
        { agent: "Others", spend: 2.9, pct: 7 }]
      },
      "90d": {
        stats: [["Spend · 90d", "$118.70", "of $900 cap"], ["Tokens · 90d", "27.8M", "in + out"], ["Median latency", "1.3s", "260ms ttft"]],
        perAgent: [
        { agent: "Builder", spend: 61.3, pct: 52 },
        { agent: "Scribe", spend: 24.9, pct: 21 },
        { agent: "Scout", spend: 14.1, pct: 12 },
        { agent: "Quant", spend: 9.6, pct: 8 },
        { agent: "Others", spend: 8.8, pct: 7 }]
      }
    },
    agents: {
      Builder: {
        role: "Implements specs, runs CI, opens PRs", spend: "$22.40", runs: 41, tokens: "4.9M", p50: "2.1s",
        trend: [1.8, 2.6, 2.2, 3.1, 2.8, 3.4, 3.0, 3.5],
        topMissions: [
        { title: "Checkout drop-off fix", id: "m1", cost: "$9.40", runs: 12 },
        { title: "Smart retry for failed payments", id: "m2", cost: "$7.20", runs: 9 },
        { title: "Saved carts v2 spec", id: "m3", cost: "$3.10", runs: 6 }],
        recent: [
        { id: "run_91f", when: "06:12", mission: "Checkout drop-off fix", tokens: "38k", dur: "41s", cost: "$0.41", status: "ok" },
        { id: "run_8d2", when: "Yesterday", mission: "Smart retry for failed payments", tokens: "52k", dur: "63s", cost: "$0.58", status: "ok" },
        { id: "run_87a", when: "Yesterday", mission: "Checkout drop-off fix", tokens: "29k", dur: "37s", cost: "$0.33", status: "retry" }]
      },
      Scribe: {
        role: "Drafts specs, changelogs, and docs", spend: "$8.10", runs: 28, tokens: "2.2M", p50: "1.4s",
        trend: [0.9, 1.1, 0.8, 1.3, 1.0, 1.2, 0.9, 1.1],
        topMissions: [
        { title: "Saved carts v2 spec", id: "m3", cost: "$3.40", runs: 8 },
        { title: "Checkout drop-off fix", id: "m1", cost: "$2.60", runs: 7 }],
        recent: [
        { id: "run_90b", when: "06:02", mission: "Checkout drop-off fix", tokens: "21k", dur: "18s", cost: "$0.22", status: "ok" },
        { id: "run_8c1", when: "Yesterday", mission: "Saved carts v2 spec", tokens: "19k", dur: "16s", cost: "$0.20", status: "ok" }]
      },
      Scout: {
        role: "Captures and clusters signals", spend: "$4.60", runs: 64, tokens: "1.4M", p50: "0.8s",
        trend: [0.6, 0.5, 0.7, 0.6, 0.5, 0.6, 0.7, 0.6],
        topMissions: [
        { title: "Checkout drop-off fix", id: "m1", cost: "$1.90", runs: 22 },
        { title: "SSO for enterprise (queued)", id: null, cost: "$1.10", runs: 14 }],
        recent: [
        { id: "run_92c", when: "06:30", mission: "Overnight signal sweep", tokens: "9k", dur: "6s", cost: "$0.06", status: "ok" },
        { id: "run_92a", when: "06:30", mission: "Overnight signal sweep", tokens: "8k", dur: "5s", cost: "$0.05", status: "ok" }]
      },
      Quant: {
        role: "Queries funnels, sizes opportunities", spend: "$3.20", runs: 19, tokens: "0.7M", p50: "1.0s",
        trend: [0.3, 0.5, 0.4, 0.4, 0.3, 0.5, 0.4, 0.4],
        topMissions: [
        { title: "Checkout drop-off fix", id: "m1", cost: "$1.60", runs: 9 }],
        recent: [
        { id: "run_8f9", when: "05:58", mission: "Checkout drop-off fix", tokens: "12k", dur: "14s", cost: "$0.14", status: "ok" }]
      }
    },
    traceHops: {
      tr_8f2c: [
      { agent: "Scout", tool: "cluster_signals", action: "Clustered 9 signals → theme “Checkout drop-off”", dur: "1.8s", tokens: "6.2k", cost: "$0.05", status: "completed" },
      { agent: "Quant", tool: "query_funnel", action: "Confirmed −3.2pt completion regression on guest mobile", dur: "3.2s", tokens: "4.8k", cost: "$0.04", status: "completed" },
      { agent: "Scribe", tool: "draft_spec", action: "Spec v2 drafted · Critic passed at 92", dur: "12.4s", tokens: "21k", cost: "$0.22", status: "completed" },
      { agent: "Builder", tool: "run_ci", action: "3-line diff to CheckoutShell · CI green · resize tests added", dur: "9.8s", tokens: "11k", cost: "$0.18", status: "completed" },
      { agent: "Builder", tool: "create_pr", action: "Waiting at gate — needs your approval to open the PR", dur: "—", tokens: "—", cost: "—", status: "gate" },
      { agent: "Orchestrator", tool: "plan_next", action: "Holds merge + changelog until the gate clears", dur: "—", tokens: "—", cost: "—", status: "planned" }],
      tr_5d1a: [
      { agent: "Quant", tool: "query_funnel", action: "Sized failed-payment volume: 4.1% of checkouts", dur: "2.9s", tokens: "5.1k", cost: "$0.04", status: "completed" },
      { agent: "Scribe", tool: "draft_spec", action: "Retry-ladder spec with guardrails · Critic 94", dur: "11.2s", tokens: "24k", cost: "$0.25", status: "completed" },
      { agent: "Builder", tool: "run_ci", action: "Retry service implemented · CI green on attempt 2", dur: "14.6s", tokens: "61k", cost: "$0.62", status: "completed" },
      { agent: "Marketer", tool: "publish_changelog", action: "Changelog + email snippet drafted, at gate", dur: "4.1s", tokens: "20k", cost: "$0.17", status: "gate" }],
      tr_2b9e: [
      { agent: "Scout", tool: "cluster_signals", action: "Cart-sync signals steady at 6 · theme refreshed", dur: "1.4s", tokens: "5k", cost: "$0.04", status: "completed" },
      { agent: "Scribe", tool: "draft_spec", action: "Saved carts v2 re-spec around multi-device session", dur: "10.8s", tokens: "19k", cost: "$0.21", status: "completed" },
      { agent: "Critic", tool: "review_spec", action: "Passed with 3 comments on the offline edge case", dur: "6.2s", tokens: "7k", cost: "$0.09", status: "completed" }],
      tr_c771: [
      { agent: "Marketer", tool: "rewrite_email", action: "Attempt 1 · voice eval scored 82 (needs ≥ 90)", dur: "5.1s", tokens: "6k", cost: "$0.06", status: "failed" },
      { agent: "Marketer", tool: "rewrite_email", action: "Attempt 2 · voice eval scored 84 — guardrail stopped the run", dur: "4.8s", tokens: "6k", cost: "$0.06", status: "failed" },
      { agent: "Historian", tool: "write_learning", action: "Logged: voice evals fail most on exclamation density", dur: "1.1s", tokens: "1k", cost: "$0.01", status: "completed" }]
    },
    evalDetail: {
      "Spec quality (LLM judge)": {
        judge: "LLM judge v3 · rubric: completeness, measurability, edge cases", dataset: "Golden set v5 · 32 specs", threshold: 85, cadence: "On every spec draft", owner: "Critic",
        history: [84, 86, 85, 88, 87, 90, 89, 91],
        runs: [
        { id: "ev_512", when: "06:30", version: "v14", n: 32, score: 91, pass: 30, fail: 2 },
        { id: "ev_498", when: "Yesterday", version: "v13", n: 32, score: 89, pass: 29, fail: 3 },
        { id: "ev_471", when: "Jun 9", version: "v13", n: 32, score: 87, pass: 28, fail: 4 },
        { id: "ev_440", when: "Jun 6", version: "v12", n: 31, score: 85, pass: 27, fail: 4 }],
        cases: [
        { name: "Edge: offline cart merge", score: 62, verdict: "fail", got: "Spec omits conflict resolution when both carts changed offline.", fix: "Merge-policy section added to the template in v14." },
        { name: "Measurable acceptance criteria", score: 71, verdict: "fail", got: "“Should feel fast” — judge rejected: no metric, no target.", fix: "Judge now requires metric + target per criterion." }]
      },
      "Code review gate": {
        judge: "Static checks + LLM reviewer v2", dataset: "Last 18 PRs", threshold: 90, cadence: "On every PR", owner: "Builder",
        history: [92, 93, 94, 93, 94, 95, 94, 94],
        runs: [
        { id: "ev_509", when: "06:18", version: "v8", n: 18, score: 94, pass: 17, fail: 1 },
        { id: "ev_488", when: "Jun 10", version: "v8", n: 17, score: 94, pass: 16, fail: 1 },
        { id: "ev_452", when: "Jun 7", version: "v7", n: 16, score: 93, pass: 15, fail: 1 }],
        cases: [
        { name: "Missing viewport-resize test", score: 74, verdict: "fail", got: "PR touched the card iframe without a resize test — caught by the Jun 10 learning.", fix: "Reviewer prompt v8 enforces the rule from memory." }]
      },
      "Brand voice": {
        judge: "Voice eval · tone, person, exclamation density", dataset: "41 drafts · brand corpus v3", threshold: 90, cadence: "On every Marketer draft", owner: "Marketer",
        history: [82, 84, 83, 86, 85, 87, 88, 88],
        runs: [
        { id: "ev_511", when: "06:25", version: "v9", n: 41, score: 88, pass: 36, fail: 5 },
        { id: "ev_490", when: "Jun 10", version: "v9", n: 40, score: 87, pass: 35, fail: 5 },
        { id: "ev_460", when: "Jun 8", version: "v8", n: 38, score: 84, pass: 31, fail: 7 }],
        cases: [
        { name: "Exclamation density", score: 58, verdict: "fail", got: "Onboarding rewrite used 3× baseline exclamations — guardrail fired twice.", fix: "Prompt v9 patches density; score climbing since." },
        { name: "Second-person consistency", score: 79, verdict: "fail", got: "Drifted from “you” to “users” mid-email.", fix: "Added person-check to the rubric." }]
      },
      "Signal clustering precision": {
        judge: "Weekly labeled sample · precision@cluster", dataset: "120 signals / week", threshold: 85, cadence: "Weekly", owner: "Scout",
        history: [88, 87, 88, 86, 85, 86, 86, 86],
        runs: [
        { id: "ev_505", when: "Jun 11", version: "v11", n: 120, score: 86, pass: 103, fail: 17 },
        { id: "ev_455", when: "Jun 4", version: "v11", n: 120, score: 86, pass: 103, fail: 17 },
        { id: "ev_410", when: "May 28", version: "v11", n: 118, score: 88, pass: 104, fail: 14 }],
        cases: [
        { name: "Intercom tag remap", score: 66, verdict: "fail", got: "Schema change on Jun 8 renamed conversation tags; checkout signals landed in “payments”.", fix: "Scout prompt v12 with tag remap is in testing." }]
      }
    },
    driftDetail: {
      "Spec drafting": { baseline: 90.6, current: 91.0, window: "14d rolling vs 90d baseline", trend: [0.1, 0.2, 0.0, 0.3, 0.2, 0.4, 0.4], cause: "Stable. Prompt v14 nudged measurability scores up.", action: "None — within band.", samples: [{ when: "Jun 11", note: "Saved carts re-spec scored 92, no rubric misses" }] },
      "Signal clustering": { baseline: 88.1, current: 86.0, window: "14d rolling vs 90d baseline", trend: [0.2, 0.1, -0.3, -0.8, -1.4, -1.9, -2.1], cause: "Intercom schema change on Jun 8 renamed conversation tags — the clusterer sees fewer labels.", action: "Scout prompt v12 (tag remap) is in testing. Promote if precision recovers by Jun 15; else roll the connector mapping back.", samples: [{ when: "Jun 11", note: "3 checkout signals mis-filed into “payments” cluster" }, { when: "Jun 10", note: "Duplicate theme created for cart sync" }] },
      "Brand voice": { baseline: 85.0, current: 88.0, window: "14d rolling vs 90d baseline", trend: [0.5, 1.0, 1.4, 1.9, 2.2, 2.6, 3.0], cause: "Prompt v9 patched exclamation density after the Jun 10 guardrail stop.", action: "None — improving. Raise the gate threshold to 92 once stable for 2 weeks.", samples: [{ when: "Jun 11", note: "Changelog draft passed at 93 on first attempt" }] },
      "Intent routing": { baseline: 94.3, current: 94.0, window: "14d rolling vs 90d baseline", trend: [0.0, -0.1, -0.2, -0.1, -0.3, -0.2, -0.3], cause: "Flat. v23 rollback (latency) had no quality cost.", action: "None — within band.", samples: [{ when: "Jun 10", note: "2 misroutes in 640 turns, both ambiguous one-word prompts" }] }
    }
  },

  /* ---- Loop drill-downs: signals, opportunities, releases, decisions,
          learnings, connectors ---- */
  loopDetail: {
    signals: {
      s1: { firstSeen: "Jun 10", owner: "Scout", breakdown: [["Intercom", 6], ["Mixpanel", 3]], trend: [1, 1, 2, 3, 5, 7, 9], linked: { opportunity: "Checkout drop-off fix", missionId: "m1", spec: "Checkout guest flow fix" }, note: "Strength 92 — funnel regression confirmed; mission running." },
      s2: { firstSeen: "Jun 2", owner: "Scout", breakdown: [["Gong", 2], ["Email", 2]], trend: [0, 1, 1, 2, 3, 3, 4], linked: { opportunity: "SSO for enterprise", missionId: null, spec: "SSO · SAML + SCIM" }, note: "Launch-blocker weighting applied per the Jun 11 learning." },
      s3: { firstSeen: "May 26", owner: "Scout", breakdown: [["Reviews", 4], ["Intercom", 2]], trend: [2, 3, 4, 5, 5, 6, 6], linked: { opportunity: "Saved carts v2", missionId: "m3", spec: "Saved carts v2" }, note: "Growth slowing — confidence trimmed in the Jun 6 rescore." },
      s4: { firstSeen: "Jun 7", owner: "Scout", breakdown: [["Support", 3]], trend: [0, 0, 1, 1, 2, 3, 3], linked: { opportunity: "Dashboard performance", missionId: null, spec: null }, note: "Single cohort — Quant is monitoring before promotion." }
    },
    opportunities: {
      "Checkout drop-off fix": { ice: [["Impact", 9.2], ["Confidence", 9.0], ["Ease", 7.9]], rescores: [{ when: "Jun 10", from: 7.9, to: 8.7, why: "Quant confirmed the funnel regression; Builder scoped the diff to 3 lines — ease upgraded." }], signals: ["s1"], spec: "Checkout guest flow fix", missionId: "m1", outcome: "Mission running · PR at gate" },
      "SSO for enterprise": { ice: [["Impact", 9.0], ["Confidence", 8.4], ["Ease", 6.8]], rescores: [], signals: ["s2"], spec: "SSO · SAML + SCIM", missionId: null, outcome: "Queued — takes the Builder slot after the checkout fix" },
      "Saved carts v2": { ice: [["Impact", 7.4], ["Confidence", 6.6], ["Ease", 5.2]], rescores: [{ when: "Jun 6", from: 6.9, to: 6.4, why: "Outcome loop: cart-sync signal growth slowed — confidence trimmed." }], signals: ["s3"], spec: "Saved carts v2", missionId: "m3", outcome: "Spec ready · awaiting capacity" },
      "Dashboard performance": { ice: [["Impact", 4.8], ["Confidence", 3.4], ["Ease", 3.2]], rescores: [], signals: ["s4"], spec: null, missionId: null, outcome: "Watching — needs signals beyond one cohort" }
    },
    releases: {
      "v2.43": { shipped: ["Smart retry ladder — 3 attempts, bank-aware backoff", "Changelog + email snippet (drafted, at gate)"], closed: ["Failed-payment complaints · 4 signals resolved"], metrics: [["Payment success", "94.1%", "96.8%"]], traceId: "tr_5d1a", missionId: "m2" },
      "v2.42": { shipped: ["Checkout address-entry hotfix"], closed: ["Checkout friction · 3 of 9 signals"], metrics: [["Support volume", "baseline", "−12%"]], traceId: null, missionId: null },
      "v2.41": { shipped: ["Checkout v2 — card iframe inside CheckoutShell"], closed: [], metrics: [["Guest completion", "64%", "51% · regression"]], traceId: "tr_8f2c", missionId: "m1", note: "Root cause: iframe remounts on viewport change. The fix is mission m1; outcome loop re-scored the opportunity to #1." }
    },
    decisions: {
      "Retry ladder caps at 3 attempts": { context: "Smart-retry spec review. Bank-side rate limits flag bursts past 3 attempts as suspected fraud.", alternatives: [["5 attempts with exponential backoff", "Rejected — still trips issuer fraud heuristics on two test banks"], ["Configurable cap per gateway", "Deferred — adds a config surface no customer asked for"]], source: "Mission · Smart retry spec gate", traceId: "tr_5d1a", missionId: "m2", citedBy: 4 },
      "Guest flow ships before SSO": { context: "Capacity call: one Builder slot available this sprint. Revenue regression compounds daily; the Northwind Q3 date still holds if SSO starts next sprint.", alternatives: [["SSO first", "Rejected — checkout regression costs ≈38% of orders while it stands"]], source: "Sprint planning · Jun 5", traceId: null, missionId: null, citedBy: 7 },
      "Saved carts scoped to web first": { context: "The multi-device session model is unsettled until the mobile session refactor lands in Q3.", alternatives: [["Cross-device from day one", "Rejected — hard-blocks on the session refactor"], ["Mobile-only pilot", "Rejected — web is 78% of cart creations"]], source: "Design review · saved carts", traceId: "tr_2b9e", missionId: "m3", citedBy: 3 }
    },
    learnings: {
      l1: { trace: "tr_8f2c", missionId: "m1", mission: "Checkout drop-off fix", appliesTo: "Builder · code review gate", citedBy: [["06:18", "Code review eval v8 enforced it on PR #214"], ["Jun 11", "Spec template gained a resize-test checklist item"]] },
      l2: { trace: null, missionId: null, mission: "Northwind QBR capture", appliesTo: "Scout · enterprise signal weighting", citedBy: [["Jun 10", "SSO opportunity re-weighted as launch blocker"]] },
      l3: { trace: "tr_c771", missionId: "m4", mission: "Onboarding email rewrite", appliesTo: "Marketer · prompt v9", citedBy: [["Jun 11", "Voice eval passing at 88 and climbing"]] },
      l4: { trace: null, missionId: null, mission: "Checkout funnel analysis", appliesTo: "All checkout specs", citedBy: [["Jun 8", "Guest-flow spec cites the 2.3× mobile abandon rate"]] }
    },
    connectors: {
      Intercom: { since: "Mar 2026", lastSync: "6m ago", itemsWeek: 41, feeds: ["Signals — tickets clustered into themes", "Company brain — tag reports"], recent: [["06:24", "12 tickets ingested · 9 matched “Checkout drop-off”"], ["Yesterday", "Tag report synced · cart tickets 11% of volume"]], health: "healthy" },
      Gong: { since: "Apr 2026", lastSync: "1h ago", itemsWeek: 6, feeds: ["Signals — call quotes", "Calendar — QBR transcripts"], recent: [["Jun 9", "Northwind QBR → 2 SSO quotes extracted"]], health: "healthy" },
      Mixpanel: { since: "Mar 2026", lastSync: "12m ago", itemsWeek: 18, feeds: ["Signals — funnel regressions", "Outcome loop — release metrics"], recent: [["Jun 11", "Guest-completion funnel → strength 92 on “Checkout drop-off”"]], health: "healthy" },
      GitHub: { since: "Mar 2026", lastSync: "live", itemsWeek: 27, feeds: ["Missions — branches, PRs, CI", "Releases"], recent: [["06:12", "cad/checkout-guest CI green · PR #214 ready"]], health: "healthy" }
    }
  },
};
