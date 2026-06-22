import { describe, expect, test } from "bun:test";
import { buildStakeholderUpdate, type StakeholderSnapshot } from "./stakeholder-update";

/**
 * One-keystroke stakeholder status update (PM-STATUS-UPDATE).
 *
 * A PURE composer that turns a snapshot of live product state into a shareable, paste-ready
 * update. It is the reference implementation of the felt-voice precedent
 * (docs/conventions/humanized-output.md "The felt voice"): signal first (a lede carries the
 * gist), short + precise, metrics interpreted not dumped, honest when sparse, and zero AI
 * fingerprints (the text leaves the app into Slack/email). These tests pin that voice.
 */

const full: StakeholderSnapshot = {
  periodLabel: "the last 7 days",
  workspaceName: "Project Glasswing",
  shipped: 2,
  decisions: 3,
  validated: 1,
  activeMissions: ["Ship Escalation Policy Engine v0", "Smart routing beta"],
  upNext: ["Per-segment tone calibration", "Macro suggestion from resolved history"],
  needsYou: 3,
  metrics: { acceptancePct: 100, autonomyPct: 50, outcomeAccuracyPct: 100 },
  spendUsd: 0.05,
  latestOutcome: { title: "Hard escalation policy for refunds", verdict: "validated" },
};

describe("buildStakeholderUpdate", () => {
  test("headline is a clean dateline: workspace + period", () => {
    const u = buildStakeholderUpdate(full);
    expect(u.headline).toContain("Project Glasswing");
    expect(u.headline.toLowerCase()).toContain("the last 7 days");
  });

  test("SIGNAL FIRST: the lede carries the gist in one line", () => {
    const u = buildStakeholderUpdate(full);
    expect(u.lede).toContain("3 decisions made");
    expect(u.lede).toContain("2 in flight");
    expect(u.lede).toContain("every reviewed bet held up");
    expect(u.markdown.indexOf(u.lede)).toBeLessThan(u.markdown.indexOf("Shipped"));
  });

  test("a full snapshot yields Shipped / In flight / Next / Health sections", () => {
    const titles = buildStakeholderUpdate(full).sections.map((s) => s.title);
    expect(titles).toEqual(["Shipped", "In flight", "Next", "Health"]);
  });

  test("Shipped is terse (header implies the verb) + names the latest outcome by meaning", () => {
    const shipped = buildStakeholderUpdate(full).sections.find((s) => s.title === "Shipped")!;
    const text = shipped.bullets.join(" ");
    expect(text).toContain("3 decisions");
    expect(text).toContain("2 deep-work");
    expect(text).toContain("Hard escalation policy for refunds");
    // "validated" is rendered as the felt verb, not the raw label.
    expect(text).toContain("held up");
    expect(text).not.toContain("validated");
  });

  test("Health INTERPRETS the metrics instead of dumping percentages", () => {
    const health = buildStakeholderUpdate(full).sections.find((s) => s.title === "Health")!;
    const text = health.bullets.join(" ");
    expect(text).toContain("you approved every call");
    expect(text).toContain("every reviewed bet held up");
    expect(text).toContain("50% of the work unattended");
    expect(text).toContain("$0.05 spent");
  });

  test("active work + next appear as scannable bullets", () => {
    const u = buildStakeholderUpdate(full);
    expect(u.sections.find((s) => s.title === "In flight")!.bullets).toContain(
      "Ship Escalation Policy Engine v0",
    );
    expect(u.sections.find((s) => s.title === "Next")!.bullets).toContain(
      "Per-segment tone calibration",
    );
  });

  test("the calls queue closes the note with the product noun", () => {
    expect(buildStakeholderUpdate(full).markdown).toContain("3 calls waiting on you");
  });

  test("pluralization: a single decision / call reads singular", () => {
    const u = buildStakeholderUpdate({
      ...full,
      shipped: 0,
      decisions: 1,
      needsYou: 1,
      activeMissions: [],
      upNext: [],
      latestOutcome: null,
      validated: 0,
      metrics: { acceptancePct: null, autonomyPct: null, outcomeAccuracyPct: null },
    });
    expect(u.lede).toContain("1 decision made");
    expect(u.markdown).toContain("1 call waiting on you");
    expect(u.markdown).not.toContain("1 decisions");
    expect(u.markdown).not.toContain("1 calls");
  });

  test("caps long lists and reports the overflow honestly", () => {
    const many = Array.from({ length: 8 }, (_, i) => `Mission ${i + 1}`);
    const inFlight = buildStakeholderUpdate({ ...full, activeMissions: many }).sections.find(
      (s) => s.title === "In flight",
    )!;
    expect(inFlight.bullets.length).toBe(6); // 5 shown + 1 overflow
    expect(inFlight.bullets[5]).toContain("3 more");
  });

  test("sparse state is honest: a quiet lede, no fabricated numbers, omitted empty sections", () => {
    const quiet = buildStakeholderUpdate({
      periodLabel: "the last 7 days",
      workspaceName: "Project Glasswing",
      shipped: 0,
      decisions: 0,
      validated: 0,
      activeMissions: [],
      upNext: [],
      needsYou: 0,
      metrics: { acceptancePct: null, autonomyPct: null, outcomeAccuracyPct: null },
      spendUsd: 0,
      latestOutcome: null,
    });
    expect(quiet.sections.find((s) => s.title === "In flight")).toBeUndefined();
    expect(quiet.sections.find((s) => s.title === "Next")).toBeUndefined();
    expect(quiet.lede.toLowerCase()).toContain("quiet");
    expect(quiet.markdown).not.toContain("null");
    expect(quiet.markdown).not.toContain("NaN");
  });

  test("null metrics are omitted, never shown as 0% or null", () => {
    const health = buildStakeholderUpdate({
      ...full,
      metrics: { acceptancePct: 100, autonomyPct: null, outcomeAccuracyPct: null },
    }).sections.find((s) => s.title === "Health")!;
    const text = health.bullets.join(" ");
    expect(text).toContain("you approved every call");
    expect(text).not.toContain("null");
    expect(text).not.toContain("unattended"); // autonomy was null -> omitted
  });

  test("HUMANIZED: no em/en dashes, no invisibles, no banned buzzwords", () => {
    const md = buildStakeholderUpdate(full).markdown;
    expect(md).not.toMatch(/[—–]/);
    expect(md).not.toMatch(/[​‌‍⁠﻿­]/);
    for (const bad of ["seamless", "leverage", "robust", "supercharge", "unlock", "elevate"]) {
      expect(md.toLowerCase()).not.toContain(bad);
    }
  });

  test("is deterministic - same snapshot, identical output", () => {
    expect(buildStakeholderUpdate(full)).toEqual(buildStakeholderUpdate(full));
  });
});
