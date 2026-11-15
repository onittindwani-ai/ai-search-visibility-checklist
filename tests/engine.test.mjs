// Tests for app/engine.js. Run with: node --test tests/engine.test.mjs
// The app's scoring and tracker math must match tools/visibility.py exactly on the sample.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const require = createRequire(import.meta.url);
const read = (rel) => JSON.parse(readFileSync(path.join(root, rel), "utf8"));

const E = require(path.join(root, "app", "engine.js"));
const KIT = require(path.join(root, "app", "kit-data.js"));
const checklist = read("data/checklist.json");
const library = read("data/prompts.json");
const sample = read("data/sample-business.json");
const expected = read("tests/fixtures/expected.json");

function python(...args) {
  const exe = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  return execFileSync(exe, [path.join(root, "tools", "visibility.py"), ...args], { cwd: root, encoding: "utf8" });
}

test("the app's kit-data.js holds the same data as data/*.json", () => {
  assert.deepEqual(KIT.checklist, checklist);
  assert.deepEqual(KIT.library, library);
  assert.deepEqual(KIT.sample, sample);
});

test("the app engine gives exactly the same result as visibility.py json on the sample", () => {
  const py = JSON.parse(python("json", "--file", "data/sample-business.json"));
  assert.deepEqual(E.compute(sample, checklist, library), py);
});

test("the sample score matches the shared fixture", () => {
  const s = E.score(checklist, sample.answers);
  for (const [k, v] of Object.entries(expected.score)) assert.equal(s[k], v, k);
  for (const sec of s.sections) {
    for (const [k, v] of Object.entries(expected.sections[sec.id])) assert.equal(sec[k], v, `${sec.id} ${k}`);
  }
  assert.deepEqual(s.fixes.slice(0, 5).map((f) => f.id), expected.top_fixes);
});

test("the sample tracker matches the shared fixture and shows a rising share", () => {
  const t = E.tracker(sample, library);
  assert.deepEqual(t.dates.map((d) => [d.date, d.mentioned, d.checks, d.share]), expected.tracker.dates);
  assert.equal(t.change, expected.tracker.change);
  assert.equal(t.avg_position, expected.tracker.avg_position);
  assert.deepEqual(t.competitors[0], expected.tracker.top_competitor);
  const shares = t.dates.map((d) => d.share);
  assert.ok(shares[2] > shares[1] && shares[1] > shares[0]);
});

test("score rules: weights, not relevant, thresholds, half up rounding", () => {
  const mini = {
    weights: { high: 3, medium: 2, low: 1 },
    status: { green_from: 70, amber_from: 40 },
    sections: [{ id: "a", n: 1, title: "A" }],
    items: [
      { id: "h", section: "a", question: "H?", weight: "high" },
      { id: "m", section: "a", question: "M?", weight: "medium" },
      { id: "l", section: "a", question: "L?", weight: "low" },
    ],
  };
  let s = E.score(mini, { h: "yes", m: "not_relevant", l: "no" });
  assert.deepEqual([s.earned, s.possible, s.percent, s.status], [3, 4, 75, "green"]);
  s = E.score(mini, { h: "not_relevant", m: "not_relevant", l: "not_relevant" });
  assert.equal(s.percent, null);
  assert.equal(s.status, "none");
  assert.equal(E.wholePercent(1, 8), 13);
  assert.equal(E.statusFor(139, 200, mini.status), "amber");
  assert.equal(E.statusFor(7, 10, mini.status), "green");
  assert.equal(E.statusFor(4, 10, mini.status), "amber");
});

test("CSV columns match visibility.py", () => {
  assert.equal(E.checklistCSV(sample, checklist), python("csv", "--file", "data/sample-business.json"));
  assert.equal(E.trackerCSV(sample, library), python("csv", "--tracker", "--file", "data/sample-business.json"));
});

test("normalizeData drops broken rows and never mutates the input", () => {
  const input = {
    answers: { "entity-one-name": "yes", nope: "yes", "entity-one-liner": "maybe" },
    prompts: [{ id: "p1", text: "best AI SDR agency" }, { id: "p1", text: "dup" }, { id: "", text: "x" }],
    checks: [
      { date: "2026-11-15", prompt_id: "p1", platform: "chatgpt", mentioned: true, position: 2, competitors: ["  Acme  Co ", ""] },
      { date: "2026-11-15", prompt_id: "p1", platform: "chatgpt", mentioned: false },
      { date: "bad", prompt_id: "p1", platform: "chatgpt", mentioned: true },
      { date: "2026-11-15", prompt_id: "p1", platform: "bing", mentioned: true },
      { date: "2026-11-15", prompt_id: "p1", platform: "claude", mentioned: false, position: 3 },
    ],
  };
  const before = JSON.stringify(input);
  const out = E.normalizeData(input, checklist, library);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(out.answers, { "entity-one-name": "yes" });
  assert.deepEqual(out.prompts, [{ id: "p1", text: "best AI SDR agency" }]);
  assert.equal(out.checks.length, 2);
  assert.deepEqual(out.checks[0].competitors, ["Acme Co"]);
  assert.equal(out.checks[1].position, null);
  assert.deepEqual(E.parseCompetitors("Acme, acme; Beta\n , "), ["Acme", "Beta"]);
});
