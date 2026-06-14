import { describe, expect, test } from "bun:test";
import { humanizeText } from "./humanize";

describe("humanizeText — dash normalization", () => {
  test("a spaced em dash separator becomes a comma", () => {
    expect(humanizeText("Ship it now — the cap is reached.")).toBe(
      "Ship it now, the cap is reached.",
    );
  });

  test("a spaced en dash separator becomes a comma", () => {
    expect(humanizeText("Two options – pick one.")).toBe("Two options, pick one.");
  });

  test("a numeric range becomes 'to'", () => {
    expect(humanizeText("Runs 1–6 steps.")).toBe("Runs 1 to 6 steps.");
    expect(humanizeText("Runs 1 — 6 steps.")).toBe("Runs 1 to 6 steps.");
  });

  test("an unspaced dash collapses to a comma", () => {
    expect(humanizeText("yes—no")).toBe("yes, no");
  });

  test("plain hyphens in compounds are kept", () => {
    expect(humanizeText("role-based auto-confirm")).toBe("role-based auto-confirm");
  });
});

describe("humanizeText — invisible / exotic character stripping", () => {
  const cases: { name: string; ch: string }[] = [
    { name: "zero-width space U+200B", ch: "​" },
    { name: "ZWNJ U+200C", ch: "‌" },
    { name: "ZWJ U+200D", ch: "‍" },
    { name: "word joiner U+2060", ch: "⁠" },
    { name: "BOM U+FEFF", ch: "﻿" },
    { name: "soft hyphen U+00AD", ch: "­" },
    { name: "LRM U+200E", ch: "‎" },
    { name: "RLM U+200F", ch: "‏" },
    { name: "replacement char U+FFFD", ch: "�" },
  ];
  for (const c of cases) {
    test(`strips ${c.name}`, () => {
      expect(humanizeText(`ab${c.ch}cd`)).toBe("abcd");
    });
  }

  const spaces: { name: string; ch: string }[] = [
    { name: "non-breaking space U+00A0", ch: " " },
    { name: "narrow no-break U+202F", ch: " " },
    { name: "en space U+2002", ch: " " },
    { name: "em space U+2003", ch: " " },
    { name: "thin space U+2009", ch: " " },
    { name: "hair space U+200A", ch: " " },
  ];
  for (const s of spaces) {
    test(`collapses ${s.name} to a normal space`, () => {
      expect(humanizeText(`ab${s.ch}cd`)).toBe("ab cd");
    });
  }
});

describe("humanizeText — whitespace cleanup", () => {
  test("collapses double spaces in prose", () => {
    expect(humanizeText("one  two   three")).toBe("one two three");
  });

  test("trims trailing whitespace per line", () => {
    expect(humanizeText("line one   \nline two\t")).toBe("line one\nline two");
  });
});

describe("humanizeText — code is preserved", () => {
  test("fenced triple-backtick block is untouched", () => {
    const input = "Prose — here.\n```\nconst r = a — b; // 1–6\n```\nMore — prose.";
    const out = humanizeText(input);
    expect(out).toContain("```\nconst r = a — b; // 1–6\n```");
    expect(out.startsWith("Prose, here.")).toBe(true);
    expect(out.endsWith("More, prose.")).toBe(true);
  });

  test("inline backtick code span is untouched", () => {
    const input = "Use `a — b` not a — b.";
    expect(humanizeText(input)).toBe("Use `a — b` not a, b.");
  });

  test("invisible chars inside inline code survive", () => {
    const input = "see `x​y` here​.";
    const out = humanizeText(input);
    expect(out).toBe("see `x​y` here.");
  });
});

describe("humanizeText — idempotence", () => {
  test("running twice equals running once", () => {
    const samples = [
      "Ship it now — the cap is reached.",
      "Runs 1–6 steps with a no-break space and  doubles.",
      "Mix `code — span` and prose — tail.\n```\nkeep — me\n```\n",
      "trailing   \nlines\t",
    ];
    for (const s of samples) {
      const once = humanizeText(s);
      expect(humanizeText(once)).toBe(once);
    }
  });

  test("empty string is returned unchanged", () => {
    expect(humanizeText("")).toBe("");
  });
});
