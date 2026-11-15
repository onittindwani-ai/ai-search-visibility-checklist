/*
 * AI Search Visibility Checklist: the scoring and tracker engine.
 *
 * The single JavaScript source of the rules. It runs as a classic browser
 * script (window.VisibilityEngine) and loads in Node (module.exports).
 * tools/visibility.py implements the same rules and must give the same
 * numbers; tests/engine.test.mjs checks that on the sample.
 *
 * Integer math only, so both engines round the same way.
 * No network calls, no storage, no side effects.
 */
(function (root) {
  "use strict";

  var VERSION = "1.0.0";
  var ANSWERS = ["yes", "no", "not_sure", "not_relevant"];
  var FIX_ORDER = { no: 0, not_sure: 1, unanswered: 2 };
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /** Share as a whole percent, rounded half up. null when total is 0. */
  function wholePercent(part, total) {
    if (!(total > 0)) return null;
    return Math.floor((200 * part + total) / (2 * total));
  }

  function statusFor(earned, possible, rules) {
    if (!(possible > 0)) return "none";
    if (earned * 100 >= rules.green_from * possible) return "green";
    if (earned * 100 >= rules.amber_from * possible) return "amber";
    return "red";
  }

  function answerOf(answers, id) {
    var v = answers ? answers[id] : undefined;
    return ANSWERS.indexOf(v) >= 0 ? v : "unanswered";
  }

  // ---------- checklist score ----------

  function score(checklist, answers) {
    var weights = checklist.weights;
    var rules = checklist.status;
    var items = checklist.items;

    function tally(subset) {
      var earned = 0, possible = 0, answered = 0;
      subset.forEach(function (item) {
        var points = weights[item.weight];
        var a = answerOf(answers, item.id);
        if (a !== "unanswered") answered += 1;
        if (a === "not_relevant") return;
        possible += points;
        if (a === "yes") earned += points;
      });
      return {
        earned: earned,
        possible: possible,
        percent: wholePercent(earned, possible),
        status: statusFor(earned, possible, rules),
        answered: answered,
        total: subset.length
      };
    }

    var overall = tally(items);
    var sections = checklist.sections.map(function (sec) {
      var part = tally(items.filter(function (i) { return i.section === sec.id; }));
      return Object.assign({ id: sec.id, n: sec.n, title: sec.title }, part);
    });

    var fixes = [];
    items.forEach(function (item, index) {
      var a = answerOf(answers, item.id);
      if (a === "yes" || a === "not_relevant") return;
      fixes.push({ id: item.id, section: item.section, question: item.question, weight: item.weight, points: weights[item.weight], answer: a, _order: index });
    });
    fixes.sort(function (x, y) {
      return (y.points - x.points) || (FIX_ORDER[x.answer] - FIX_ORDER[y.answer]) || (x._order - y._order);
    });
    fixes.forEach(function (f) { delete f._order; });

    return Object.assign({}, overall, { sections: sections, fixes: fixes });
  }

  // ---------- AI answer tracker ----------

  function competitorKey(name) { return String(name).split(/\s+/).filter(Boolean).join(" ").toLowerCase(); }
  function tidyName(name) { return String(name).split(/\s+/).filter(Boolean).join(" "); }

  function tracker(data, library) {
    var checks = (data && data.checks) || [];
    var dates = Array.from(new Set(checks.map(function (c) { return c.date; }))).sort();

    function count(subset) {
      var m = subset.filter(function (c) { return c.mentioned === true; }).length;
      return { checks: subset.length, mentioned: m, share: wholePercent(m, subset.length) };
    }

    var byDate = dates.map(function (d) {
      return Object.assign({ date: d }, count(checks.filter(function (c) { return c.date === d; })));
    });
    var latest = dates.length ? dates[dates.length - 1] : null;
    var latestChecks = checks.filter(function (c) { return c.date === latest; });

    var change = null;
    if (byDate.length >= 2 && byDate[0].share !== null && byDate[byDate.length - 1].share !== null) {
      change = byDate[byDate.length - 1].share - byDate[0].share;
    }

    var platforms = library.platforms.map(function (p) {
      return Object.assign({ id: p.id, label: p.label }, count(latestChecks.filter(function (c) { return c.platform === p.id; })));
    });

    var seen = {};
    var order = [];
    checks.forEach(function (c) {
      (c.competitors || []).forEach(function (name) {
        var key = competitorKey(name);
        if (!key) return;
        if (!seen[key]) { seen[key] = { name: tidyName(name), count: 0 }; order.push(key); }
        seen[key].count += 1;
      });
    });
    var competitors = order.map(function (k) { return seen[k]; }).sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      var x = a.name.toLowerCase(), y = b.name.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });

    var positions = latestChecks.filter(function (c) { return c.mentioned === true && Number.isInteger(c.position); }).map(function (c) { return c.position; });
    var avg = null;
    if (positions.length) {
      var sum = positions.reduce(function (s, p) { return s + p; }, 0);
      avg = Math.floor((20 * sum + positions.length) / (2 * positions.length)) / 10;
    }

    var prompts = ((data && data.prompts) || []).map(function (p) {
      var subset = latestChecks.filter(function (c) { return c.prompt_id === p.id; });
      return { id: p.id, text: p.text, checks: subset.length, mentioned: subset.filter(function (c) { return c.mentioned === true; }).length };
    });

    return {
      dates: byDate,
      overall: count(checks),
      latest: latest,
      change: change,
      platforms: platforms,
      competitors: competitors,
      avg_position: avg,
      prompts: prompts
    };
  }

  function compute(data, checklist, library) {
    return {
      version: VERSION,
      business: (data && data.business) || {},
      fictional: !!(data && data.fictional),
      score: score(checklist, (data && data.answers) || {}),
      tracker: tracker(data, library)
    };
  }

  // ---------- data shape ----------

  function emptyData() {
    return {
      kit: "ai-search-visibility-checklist",
      version: 1,
      fictional: false,
      note: "Your own business. Only real facts from you.",
      business: { name: "", one_liner: "", website: "", niche: "", location: "" },
      answers: {},
      prompts: [],
      checks: []
    };
  }

  /** Returns a new, clean copy: unknown answers, broken checks and duplicates are dropped. */
  function normalizeData(input, checklist, library) {
    var src = input && typeof input === "object" ? input : {};
    var out = emptyData();
    out.fictional = !!src.fictional;
    if (typeof src.note === "string") out.note = src.note;
    var b = src.business && typeof src.business === "object" ? src.business : {};
    Object.keys(out.business).forEach(function (k) { out.business[k] = typeof b[k] === "string" ? b[k] : ""; });

    var ids = {};
    checklist.items.forEach(function (i) { ids[i.id] = true; });
    var a = src.answers && typeof src.answers === "object" ? src.answers : {};
    Object.keys(a).forEach(function (k) { if (ids[k] && ANSWERS.indexOf(a[k]) >= 0) out.answers[k] = a[k]; });

    var promptIds = {};
    (Array.isArray(src.prompts) ? src.prompts : []).forEach(function (p) {
      if (!p || typeof p !== "object") return;
      var id = String(p.id || "").trim();
      var text = String(p.text || "").trim();
      if (!id || !text || promptIds[id]) return;
      promptIds[id] = true;
      out.prompts.push({ id: id, text: text });
    });

    var plats = {};
    library.platforms.forEach(function (p) { plats[p.id] = true; });
    var seen = {};
    (Array.isArray(src.checks) ? src.checks : []).forEach(function (c) {
      if (!c || typeof c !== "object") return;
      if (!DATE_RE.test(String(c.date)) || !promptIds[c.prompt_id] || !plats[c.platform] || typeof c.mentioned !== "boolean") return;
      var key = c.date + "|" + c.prompt_id + "|" + c.platform;
      if (seen[key]) return;
      seen[key] = true;
      var pos = Number.isInteger(c.position) && c.position >= 1 && c.mentioned ? c.position : null;
      out.checks.push({
        date: c.date, prompt_id: c.prompt_id, platform: c.platform, mentioned: c.mentioned, position: pos,
        competitors: (Array.isArray(c.competitors) ? c.competitors : []).filter(function (n) { return typeof n === "string" && n.trim(); }).map(tidyName),
        notes: typeof c.notes === "string" ? c.notes : ""
      });
    });
    return out;
  }

  function parseCompetitors(text) {
    var seen = {};
    return String(text || "").split(/[,;\n]/).map(tidyName).filter(function (n) {
      var k = n.toLowerCase();
      if (!n || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  // ---------- CSV (same columns as tools/visibility.py) ----------

  function csvCell(v) {
    var s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csvRow(cells) { return cells.map(csvCell).join(",") + "\n"; }
  var ANSWER_LABEL = { yes: "Yes", no: "No", not_sure: "Not sure", not_relevant: "Not relevant", unanswered: "Not answered" };

  function checklistCSV(data, checklist) {
    var titles = {};
    checklist.sections.forEach(function (s) { titles[s.id] = s.title; });
    var out = csvRow(["section", "id", "question", "weight", "points", "answer", "earned"]);
    checklist.items.forEach(function (item) {
      var a = answerOf(data.answers, item.id);
      var pts = checklist.weights[item.weight];
      out += csvRow([titles[item.section], item.id, item.question, item.weight, pts, ANSWER_LABEL[a], a === "yes" ? pts : 0]);
    });
    return out;
  }

  function trackerCSV(data, library) {
    var labels = {};
    library.platforms.forEach(function (p) { labels[p.id] = p.label; });
    var texts = {};
    (data.prompts || []).forEach(function (p) { texts[p.id] = p.text; });
    var rows = (data.checks || []).slice().sort(function (x, y) {
      var a = x.date + "|" + x.prompt_id + "|" + x.platform, b = y.date + "|" + y.prompt_id + "|" + y.platform;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    var out = csvRow(["date", "platform", "prompt", "mentioned", "position", "competitors", "notes"]);
    rows.forEach(function (c) {
      out += csvRow([c.date, labels[c.platform] || c.platform, texts[c.prompt_id] || c.prompt_id, c.mentioned ? "yes" : "no", c.position || "", (c.competitors || []).join("; "), c.notes || ""]);
    });
    return out;
  }

  var api = {
    VERSION: VERSION,
    ANSWERS: ANSWERS,
    wholePercent: wholePercent,
    statusFor: statusFor,
    score: score,
    tracker: tracker,
    compute: compute,
    emptyData: emptyData,
    normalizeData: normalizeData,
    parseCompetitors: parseCompetitors,
    checklistCSV: checklistCSV,
    trackerCSV: trackerCSV,
    clone: clone
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  root.VisibilityEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
