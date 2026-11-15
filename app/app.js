/*
 * AI Search Visibility Checklist: the interface.
 * Scoring and tracker math live in engine.js (window.VisibilityEngine).
 * The checklist, prompt library and sample come from kit-data.js.
 * This file only renders, edits and saves. No network calls. Data stays in this browser.
 */
(function () {
  "use strict";

  var E = window.VisibilityEngine;
  var KIT = window.VISIBILITY_KIT;
  var STORAGE_KEY = "ai-search-visibility-checklist.v1";
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BUSY_MS = REDUCED ? 0 : 560;

  var STATUS_LABEL = { green: "Green", amber: "Amber", red: "Red", none: "No score yet" };
  var STATUS_TEXT = { green: "Easy to find and understand", amber: "Partly there", red: "Hard to find", none: "Answer the checklist" };
  var ANSWER_LABEL = { yes: "Yes", no: "No", not_sure: "Not sure", not_relevant: "Not relevant", unanswered: "Not answered" };
  var FIX_HINT = { no: "To do", not_sure: "Check this first", unanswered: "Not answered" };

  var state = {
    data: null,
    result: null,
    tab: "checklist",
    open: { entity: true },
    more: {},
    recDate: "",
    recPlatform: "chatgpt",
    drafts: {},
    storageOk: true
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function esc(text) {
    return String(text === null || text === undefined ? "" : text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayStamp() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function shortDate(iso) {
    var p = String(iso).split("-");
    return p.length === 3 ? MONTHS[+p[1] - 1] + " " + (+p[2]) : iso;
  }
  function longDate(iso) {
    var p = String(iso).split("-");
    return p.length === 3 ? MONTHS[+p[1] - 1] + " " + (+p[2]) + ", " + p[0] : iso;
  }
  function pctText(v) { return v === null || v === undefined ? "n/a" : v + "%"; }
  function platformLabel(id) { var p = KIT.library.platforms.filter(function (x) { return x.id === id; })[0]; return p ? p.label : id; }
  function sectionOf(id) { return KIT.checklist.sections.filter(function (s) { return s.id === id; })[0]; }
  function itemOf(id) { return KIT.checklist.items.filter(function (i) { return i.id === id; })[0]; }

  // ---------- storage (wrapped, the app works without it) ----------

  function loadSaved() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.data ? parsed : null;
    } catch (err) {
      state.storageOk = probeStorage();
      return null;
    }
  }
  function probeStorage() {
    try {
      var k = STORAGE_KEY + ".probe";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch (err) {
      return false;
    }
  }
  function saveNow() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: state.data, ui: { tab: state.tab, open: state.open, recPlatform: state.recPlatform } }));
      state.storageOk = true;
    } catch (err) {
      state.storageOk = false;
    }
    updatePrivacyNote();
    return state.storageOk;
  }
  var saveTimer = null;
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { saveTimer = null; saveNow(); }, 450); }
  function flushSave() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; saveNow(); } }
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flushSave(); });

  function updatePrivacyNote() {
    var note = $("#privacy-note");
    note.classList.toggle("is-warn", !state.storageOk);
    $("#privacy-text").textContent = state.storageOk ? "Everything stays on this device" : "Stays on this device. Saving is blocked here, so export to keep your work";
  }

  // ---------- data ----------

  function setData(next) {
    state.data = E.normalizeData(next, KIT.checklist, KIT.library);
    state.result = E.compute(state.data, KIT.checklist, KIT.library);
  }
  function patchData(patch) {
    setData(Object.assign({}, state.data, patch));
  }
  function snapshot() { return { data: clone(state.data) }; }
  function isEmptyData(d) {
    return !Object.keys(d.answers).length && !d.prompts.length && !d.checks.length && !d.business.name;
  }

  // ---------- small visual helpers ----------

  var R = 42;
  var C = 2 * Math.PI * R;
  function ringMarkup(strokeWidth, labelHtml) {
    return (
      '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="track" cx="50" cy="50" r="' + R + '" stroke-width="' + strokeWidth + '"></circle>' +
      '<circle class="arc" cx="50" cy="50" r="' + R + '" stroke-width="' + strokeWidth + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '"></circle>' +
      "</svg>" + '<div class="ring-label">' + (labelHtml || "") + "</div>"
    );
  }
  function setRing(el, fraction, status, label) {
    if (!el) return;
    var f = typeof fraction === "number" && isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
    var arc = $(".arc", el);
    el.setAttribute("data-status", status);
    if (label) el.setAttribute("aria-label", label);
    var apply = function () { if (arc) arc.style.strokeDashoffset = (C * (1 - f)).toFixed(2); };
    if (el._ready) apply();
    else { el._ready = true; requestAnimationFrame(function () { requestAnimationFrame(apply); }); }
  }

  function animateNumber(el, value, format) {
    if (!el) return;
    var fmt = format || function (v) { return String(Math.round(v)); };
    if (typeof value !== "number" || !isFinite(value)) {
      cancelAnimationFrame(el._raf);
      el._v = undefined;
      el.textContent = "n/a";
      return;
    }
    var from = typeof el._v === "number" ? el._v : 0;
    el._v = value;
    if (REDUCED || from === value) { el.textContent = fmt(value); return; }
    var dur = el._seen ? 420 : 900;
    el._seen = true;
    var start = performance.now();
    cancelAnimationFrame(el._raf);
    var step = function (now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (value - from) * eased);
      if (t < 1) el._raf = requestAnimationFrame(step);
      else el.textContent = fmt(value);
    };
    el._raf = requestAnimationFrame(step);
  }

  var TICK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var X_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var TRASH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>';
  var CHEV_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  function decorateButton(btn) {
    if (btn._decorated || btn.getAttribute("data-feedback") === "none") return;
    btn._decorated = true;
    var spin = document.createElement("span");
    spin.className = "btn-spinner";
    spin.setAttribute("aria-hidden", "true");
    var tick = document.createElement("span");
    tick.className = "btn-tick";
    tick.innerHTML = TICK_SVG;
    btn.appendChild(spin);
    btn.appendChild(tick);
  }

  /** Processing state, then the action, then a tick, then settle. */
  function withFeedback(btn, action) {
    if (btn && (btn.classList.contains("is-busy") || btn.classList.contains("is-done"))) return Promise.resolve();
    if (btn) { decorateButton(btn); btn.classList.add("is-busy"); btn.setAttribute("aria-busy", "true"); }
    return wait(BUSY_MS)
      .then(function () { return action(); })
      .then(function (result) {
        if (!btn) return result;
        btn.classList.remove("is-busy");
        btn.removeAttribute("aria-busy");
        if (result === false) return result;
        btn.classList.add("is-done");
        setTimeout(function () { btn.classList.remove("is-done"); }, REDUCED ? 600 : 1400);
        return result;
      })
      .catch(function () {
        if (btn) { btn.classList.remove("is-busy"); btn.removeAttribute("aria-busy"); }
        toast("Something went wrong. Nothing was changed.", { error: true });
      });
  }

  document.addEventListener("pointerdown", function (ev) {
    var btn = ev.target.closest && ev.target.closest(".btn");
    if (!btn) return;
    var r = btn.getBoundingClientRect();
    btn.style.setProperty("--press-x", ev.clientX - r.left + "px");
    btn.style.setProperty("--press-y", ev.clientY - r.top + "px");
    btn.classList.add("is-pressed");
    setTimeout(function () { btn.classList.remove("is-pressed"); }, 240);
  });

  // ---------- toasts ----------

  function toast(message, opts) {
    var o = opts || {};
    var host = $("#toasts");
    var el = document.createElement("div");
    el.className = "toast" + (o.error ? " is-error" : "");
    el.setAttribute("role", o.error ? "alert" : "status");
    el.innerHTML =
      '<span class="toast-icon">' + (o.error ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6M12 17h.01"/></svg>' : TICK_SVG) + "</span>" +
      '<span class="toast-msg">' + esc(message) + "</span>";
    if (o.action) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = o.action.label;
      b.addEventListener("click", function () { o.action.run(); dismiss(); });
      el.appendChild(b);
    }
    host.appendChild(el);
    while (host.children.length > 3) host.removeChild(host.firstChild);
    var timer = setTimeout(dismiss, o.action ? 7000 : 3200);
    function dismiss() {
      clearTimeout(timer);
      if (!el.parentNode) return;
      el.classList.add("is-leaving");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, REDUCED ? 0 : 240);
    }
    return el;
  }

  function undoable(label, snap) {
    return {
      label: "Undo",
      run: function () {
        setData(snap.data);
        renderAll(true);
        saveNow();
        toast(label);
      }
    };
  }

  function confirmBox(title, text, okLabel) {
    var dlg = $("#confirm-dialog");
    $("#confirm-title").textContent = title;
    $("#confirm-text").textContent = text;
    $("#confirm-ok .btn-label").textContent = okLabel || "Confirm";
    if (typeof dlg.showModal !== "function") return Promise.resolve(window.confirm(title + "\n\n" + text));
    return new Promise(function (resolve) {
      dlg.returnValue = "";
      var onClose = function () { dlg.removeEventListener("close", onClose); resolve(dlg.returnValue === "ok"); };
      dlg.addEventListener("close", onClose);
      dlg.showModal();
    });
  }

  // ---------- header parts ----------

  function renderHero() {
    var b = state.data.business;
    $("#hero-name").textContent = b.name || "Your business";
    $("#hero-line").textContent = b.one_liner || "Add your one line description: what you do and for whom.";
    var meta = [];
    if (b.niche) meta.push(esc(b.niche));
    if (b.location) meta.push(esc(b.location));
    if (b.website) meta.push(esc(b.website.replace(/^https?:\/\//, "")));
    meta.push('<button type="button" id="btn-edit-business">Edit details</button>');
    $("#hero-meta").innerHTML = meta.map(function (m) { return "<span>" + m + "</span>"; }).join("");
    $("#sample-banner").hidden = !state.data.fictional;
  }

  function moveTabPill() {
    var active = $('.tab[aria-selected="true"]');
    var pill = $("#tab-pill");
    if (!active || !pill) return;
    pill.style.width = active.offsetWidth + "px";
    pill.style.transform = "translateX(" + (active.offsetLeft - 5) + "px)";
  }

  function setTab(tab, focus) {
    state.tab = tab;
    $$(".tab").forEach(function (t) {
      var on = t.getAttribute("data-tab") === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $("#panel-checklist").hidden = tab !== "checklist";
    $("#panel-tracker").hidden = tab !== "tracker";
    moveTabPill();
    if (tab === "tracker") renderTracker(true);
    scheduleSave();
  }

  // ---------- checklist ----------

  function renderChecklistSummary() {
    var s = state.result.score;
    var t = state.result.tracker;
    var ring = $("#score-ring");
    if (!ring.innerHTML) ring.innerHTML = ringMarkup(9, '<span class="ring-big" id="score-pct">0</span><span class="ring-small">score</span>');
    setRing(ring, s.percent === null ? 0 : s.percent / 100, s.status, "Visibility score " + pctText(s.percent));
    animateNumber($("#score-pct"), s.percent === null ? NaN : s.percent, function (v) { return Math.round(v) + "%"; });
    var chip = $("#score-chip");
    chip.className = "chip chip-dot chip-" + s.status;
    chip.textContent = STATUS_LABEL[s.status] + ": " + STATUS_TEXT[s.status];
    $("#score-sub").textContent = s.possible ? s.earned + " of " + s.possible + " points" : "Answer the checklist to get a score";
    animateNumber($("#points-earned"), s.earned);
    $("#points-possible").textContent = "of " + s.possible;
    animateNumber($("#answered"), s.answered);
    $("#answered-total").textContent = "of " + s.total;
    requestAnimationFrame(function () { $("#answered-bar").style.width = (s.total ? (100 * s.answered) / s.total : 0) + "%"; });
    var latest = t.dates.length ? t.dates[t.dates.length - 1] : null;
    if (latest) {
      animateNumber($("#share-latest"), latest.share, function (v) { return Math.round(v) + "%"; });
      $("#share-latest-sub").innerHTML = "of AI answers named you on " + esc(shortDate(latest.date)) + (t.change !== null ? ", " + deltaHtml(t.change) : "");
    } else {
      animateNumber($("#share-latest"), NaN);
      $("#share-latest-sub").textContent = "Record checks in the AI answer tracker";
    }
    renderInsight();
  }

  function deltaHtml(change) {
    if (change === 0) return '<span class="delta">no change</span>';
    var up = change > 0;
    return '<span class="delta ' + (up ? "up" : "down") + '">' + (up ? "+" : "") + change + " points</span>";
  }

  function renderInsight() {
    var s = state.result.score;
    var weakest = s.sections.filter(function (x) { return x.percent !== null; }).sort(function (a, b) { return a.percent - b.percent; })[0];
    var top = s.fixes[0];
    var text;
    if (!s.answered) {
      text = "Start with section 1. Answer each item honestly: <strong>Yes</strong> only when it is really done.";
    } else if (!s.fixes.length) {
      text = "<strong>Every item is done.</strong> Keep checking your buyer prompts every month, because AI answers change often.";
    } else {
      text = "Your score is <strong>" + pctText(s.percent) + "</strong>. " +
        (weakest ? "The weakest area is <strong>" + esc(weakest.title.toLowerCase()) + "</strong> (" + weakest.percent + "%). " : "") +
        (top ? "The biggest single fix is worth " + top.points + " points: " + esc(top.question.replace(/\?$/, "").replace(/^\(Optional\) /, "").replace(/^(Do|Does|Is|Are|Have|Can) (you|your) /i, "")) + "." : "");
    }
    $("#insight").innerHTML = text;
  }

  function renderFixes() {
    var s = state.result.score;
    var list = $("#fixes");
    var top = s.fixes.slice(0, 5);
    var key = JSON.stringify(top.map(function (f) { return f.id + f.answer; }));
    if (list._key === key) return;
    list._key = key;
    if (!top.length) {
      list.innerHTML = '<li class="fix-empty">No open fixes. Nice work. Keep measuring every month.</li>';
      return;
    }
    list.innerHTML = top.map(function (f, i) {
      return '<li><button type="button" class="fix" data-goto="' + esc(f.id) + '" style="animation-delay:' + (REDUCED ? 0 : i * 50) + 'ms">' +
        '<span class="fix-num">' + (i + 1) + "</span><span><span class=\"fix-q\">" + esc(f.question) + "</span>" +
        '<span class="fix-meta"><span class="chip chip-w w-' + f.weight + '">' + f.points + (f.points === 1 ? " point" : " points") + "</span>" +
        '<span class="chip chip-ans a-' + f.answer + '">' + FIX_HINT[f.answer] + "</span><span>" + esc(sectionOf(f.section).title) + "</span></span></span></button></li>";
    }).join("");
  }

  function renderSecProgress() {
    var host = $("#sec-progress");
    var s = state.result.score;
    if (!host.children.length) {
      host.innerHTML = s.sections.map(function (sec) {
        return '<li><button type="button" data-goto-sec="' + sec.id + '"><span class="sp-name">' + sec.n + ". " + esc(sec.title) + '</span><span class="sp-pct" data-sp-pct="' + sec.id + '"></span><span class="sp-bar"><span data-sp-bar="' + sec.id + '"></span></span></button></li>';
      }).join("");
    }
    s.sections.forEach(function (sec) {
      var pct = $('[data-sp-pct="' + sec.id + '"]', host);
      pct.textContent = pctText(sec.percent);
      pct.className = "sp-pct is-" + sec.status + "-text";
      var bar = $('[data-sp-bar="' + sec.id + '"]', host);
      requestAnimationFrame(function () { bar.style.width = (sec.percent || 0) + "%"; bar.className = sec.status; });
    });
  }

  function itemMarkup(item) {
    var a = state.data.answers[item.id] || "unanswered";
    var pts = KIT.checklist.weights[item.weight];
    var more = !!state.more[item.id];
    var radios = E.ANSWERS.map(function (v) {
      return '<label><input type="radio" name="a-' + item.id + '" value="' + v + '"' + (a === v ? " checked" : "") + "><span>" + ANSWER_LABEL[v] + "</span></label>";
    }).join("");
    return (
      '<li class="item' + (more ? " is-more" : "") + '" id="item-' + item.id + '" data-id="' + item.id + '" data-answer="' + a + '">' +
      '<div class="item-top"><span class="item-mark" aria-hidden="true">' + TICK_SVG + "</span><div>" +
      '<p class="item-q" id="q-' + item.id + '">' + esc(item.question) + "</p>" +
      '<div class="item-row"><div class="item-tags"><span class="chip chip-w w-' + item.weight + '">' + item.weight.charAt(0).toUpperCase() + item.weight.slice(1) + ", " + pts + (pts === 1 ? " point" : " points") + "</span></div>" +
      '<div class="seg" role="radiogroup" aria-labelledby="q-' + item.id + '">' + radios + "</div></div>" +
      '<button type="button" class="more-toggle" aria-expanded="' + more + '" aria-controls="more-' + item.id + '">' + CHEV_SVG + "Why it matters and how to do it</button>" +
      '<div class="item-more" id="more-' + item.id + '"><div><div class="more-grid">' +
      '<p class="more-box"><span class="eyebrow">Why it matters</span>' + esc(item.why) + "</p>" +
      '<p class="more-box how"><span class="eyebrow">How to do it</span>' + esc(item.how) + "</p>" +
      "</div></div></div></div></div></li>"
    );
  }

  function renderEditor() {
    var editor = $("#editor");
    var s = state.result.score;
    editor.innerHTML = KIT.checklist.sections.map(function (sec) {
      var part = s.sections.filter(function (x) { return x.id === sec.id; })[0];
      var open = !!state.open[sec.id];
      var items = KIT.checklist.items.filter(function (i) { return i.section === sec.id; });
      return (
        '<section class="sec' + (open ? " is-open" : "") + '" id="sec-' + sec.id + '" data-sec="' + sec.id + '">' +
        '<button type="button" class="sec-toggle" aria-expanded="' + open + '" aria-controls="body-' + sec.id + '">' +
        '<span class="sec-num">' + sec.n + '</span><span><span class="sec-title">' + esc(sec.title) + '</span><span class="sec-desc">' + esc(sec.desc) + "</span></span>" +
        '<span class="sec-count" data-sec-count="' + sec.id + '">' + part.answered + " of " + part.total + " answered</span>" +
        '<span class="ring ring-sm" data-sec-ring="' + sec.id + '">' + ringMarkup(10, '<span data-sec-pct="' + sec.id + '"></span>') + "</span>" +
        '<svg class="sec-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
        '<div class="sec-body" id="body-' + sec.id + '"><div class="sec-inner"><div class="sec-content"><ul class="items">' +
        items.map(itemMarkup).join("") + "</ul></div></div></div></section>"
      );
    }).join("");
    refreshSections();
  }

  function refreshSections() {
    state.result.score.sections.forEach(function (sec) {
      var count = $('[data-sec-count="' + sec.id + '"]');
      if (count) count.textContent = sec.answered + " of " + sec.total + " answered";
      var pct = $('[data-sec-pct="' + sec.id + '"]');
      if (pct) pct.textContent = sec.percent === null ? "n/a" : sec.percent + "%";
      setRing($('[data-sec-ring="' + sec.id + '"]'), sec.percent === null ? 0 : sec.percent / 100, sec.status, sec.title + " " + pctText(sec.percent));
    });
  }

  function onAnswer(ev) {
    var t = ev.target;
    if (!t.name || t.name.indexOf("a-") !== 0) return;
    var id = t.name.slice(2);
    var answers = Object.assign({}, state.data.answers);
    answers[id] = t.value;
    patchData({ answers: answers });
    var li = $("#item-" + id);
    if (li) li.setAttribute("data-answer", t.value);
    refreshChecklist();
    scheduleSave();
  }

  function refreshChecklist() {
    renderChecklistSummary();
    renderFixes();
    renderSecProgress();
    refreshSections();
  }

  function toggleSection(id, open) {
    var sec = $("#sec-" + id);
    if (!sec) return;
    var next = typeof open === "boolean" ? open : !sec.classList.contains("is-open");
    sec.classList.toggle("is-open", next);
    $(".sec-toggle", sec).setAttribute("aria-expanded", String(next));
    var o = Object.assign({}, state.open);
    o[id] = next;
    state.open = o;
    scheduleSave();
  }

  function gotoItem(id) {
    var item = itemOf(id);
    if (!item) return;
    toggleSection(item.section, true);
    var li = $("#item-" + id);
    setTimeout(function () {
      li.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
      li.classList.remove("is-flash");
      void li.offsetWidth;
      li.classList.add("is-flash");
      var first = $("input:checked", li) || $("input", li);
      if (first) first.focus({ preventScroll: true });
    }, REDUCED ? 0 : 200);
  }

  // ---------- tracker ----------

  function renderTracker(full) {
    var t = state.result.tracker;
    var ring = $("#share-ring");
    var latest = t.dates.length ? t.dates[t.dates.length - 1] : null;
    if (!ring.innerHTML) ring.innerHTML = ringMarkup(9, '<span class="ring-big" id="share-pct">0</span><span class="ring-small">named</span>');
    setRing(ring, latest && latest.share !== null ? latest.share / 100 : 0, "teal", "Share of AI answers " + pctText(latest ? latest.share : null));
    animateNumber($("#share-pct"), latest ? latest.share : NaN, function (v) { return Math.round(v) + "%"; });
    $("#share-sub").textContent = latest ? latest.mentioned + " of " + latest.checks + " answers named you on " + shortDate(latest.date) : "No checks recorded yet";
    var ch = $("#share-change");
    if (t.change === null) { animateNumber(ch, NaN); ch.className = "stat-value"; }
    else {
      animateNumber(ch, t.change, function (v) { var r = Math.round(v); return (r > 0 ? "+" : "") + r; });
      ch.className = "stat-value " + (t.change > 0 ? "is-green-text" : t.change < 0 ? "is-amber-text" : "");
    }
    $("#share-change-sub").textContent = t.dates.length >= 2 ? "points, " + shortDate(t.dates[0].date) + " to " + shortDate(latest.date) : "needs 2 or more check dates";
    animateNumber($("#avg-pos"), t.avg_position === null ? NaN : t.avg_position, function (v) { return v.toFixed(1); });
    animateNumber($("#checks-total"), t.overall.checks);
    $("#checks-sub").textContent = "across " + t.dates.length + (t.dates.length === 1 ? " date" : " dates") + ", " + state.data.prompts.length + " prompts";
    renderChart();
    renderPlatBars();
    renderCompBars();
    if (full) { renderPrompts(); renderLibSelect(); renderRecord(); }
    else renderRecordMeta();
  }

  function renderChart() {
    var host = $("#chart");
    var rows = state.result.tracker.dates;
    var key = JSON.stringify(rows) + "|" + host.clientWidth;
    if (host._key === key) return;
    host._key = key;
    if (!rows.length) {
      host.innerHTML = '<div class="chart-empty"><div><p class="empty-title">No checks yet</p><p>Add buyer prompts, ask them on each platform, and record what the AI said below.</p></div></div>';
      return;
    }
    var w = Math.max(host.clientWidth, 280);
    var h = host.clientHeight || 250;
    var padL = 40, padR = 22, padT = 28, padB = 30;
    var iw = w - padL - padR, ih = h - padT - padB;
    var inset = Math.min(36, iw / 6);
    var x = function (i) { return rows.length === 1 ? padL + iw / 2 : padL + inset + ((iw - 2 * inset) * i) / (rows.length - 1); };
    var y = function (v) { return padT + ih * (1 - (v || 0) / 100); };
    var grid = [0, 25, 50, 75, 100].map(function (v) {
      return '<line class="grid-line" x1="' + padL + '" x2="' + (w - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '"></line>' +
        '<text class="axis-label" x="' + (padL - 10) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "%</text>";
    }).join("");
    var pts = rows.map(function (r, i) { return [x(i), y(r.share)]; });
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    var area = line + " L" + pts[pts.length - 1][0].toFixed(1) + " " + y(0) + " L" + pts[0][0].toFixed(1) + " " + y(0) + " Z";
    var dots = rows.map(function (r, i) {
      return '<g class="fade"><circle class="dot" cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="5"><title>' + esc(longDate(r.date)) + ": " + r.share + "% (" + r.mentioned + " of " + r.checks + ")</title></circle>" +
        '<text class="val" x="' + pts[i][0] + '" y="' + (pts[i][1] - 14) + '" text-anchor="middle">' + r.share + "%</text>" +
        '<text class="axis-label" x="' + pts[i][0] + '" y="' + (h - 8) + '" text-anchor="middle">' + esc(shortDate(r.date)) + "</text></g>";
    }).join("");
    host.innerHTML =
      '<svg class="chart" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="Share of answers by date: ' + esc(rows.map(function (r) { return shortDate(r.date) + " " + r.share + "%"; }).join(", ")) + '">' +
      '<defs><linearGradient id="share-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#2D6A62" stop-opacity="0.28"/><stop offset="100%" stop-color="#2D6A62" stop-opacity="0"/></linearGradient></defs>' +
      grid + (rows.length > 1 ? '<path class="area fade" d="' + area + '"></path><path class="line draw" d="' + line + '"></path>' : "") + dots + "</svg>";
    var path = $(".line", host);
    if (path && path.getTotalLength) {
      var len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.setProperty("--len", len);
    }
  }

  function barsMarkup(rows, max, opts) {
    var o = opts || {};
    return rows.map(function (r, i) {
      var width = max > 0 ? (100 * r.value) / max : 0;
      return '<li class="bar-row' + (r.you ? " is-you" : "") + '" style="animation-delay:' + (REDUCED ? 0 : i * 40) + 'ms">' +
        '<span class="bar-name">' + esc(r.name) + (r.small ? "<small>" + esc(r.small) + "</small>" : "") + '</span><span class="bar-val">' + esc(r.label) + "</span>" +
        '<span class="bar-track' + (o.teal ? " teal" : "") + '"><span data-w="' + width.toFixed(2) + '"></span></span></li>';
    }).join("");
  }
  function growBars(host) {
    requestAnimationFrame(function () { requestAnimationFrame(function () { $$("[data-w]", host).forEach(function (s) { s.style.width = s.getAttribute("data-w") + "%"; }); }); });
  }

  function renderPlatBars() {
    var t = state.result.tracker;
    var host = $("#plat-bars");
    $("#plat-date").textContent = t.latest ? "Latest check, " + shortDate(t.latest) : "";
    if (!t.latest) { host.innerHTML = '<li class="empty">No checks yet.</li>'; return; }
    var key = JSON.stringify(t.platforms);
    if (host._key === key) return;
    host._key = key;
    host.innerHTML = barsMarkup(t.platforms.map(function (p) {
      return { name: p.label, value: p.share || 0, label: p.checks ? p.share + "%" : "n/a", small: p.checks ? p.mentioned + " of " + p.checks : "not checked" };
    }), 100, { teal: true });
    growBars(host);
  }

  function renderCompBars() {
    var t = state.result.tracker;
    var host = $("#comp-bars");
    if (!t.overall.checks) { host.innerHTML = '<li class="empty">Competitors you record show up here.</li>'; return; }
    var you = { name: state.data.business.name || "Your business", value: t.overall.mentioned, you: true };
    var rows = t.competitors.slice(0, 6).map(function (c) { return { name: c.name, value: c.count }; }).concat([you]);
    rows.sort(function (a, b) { return b.value - a.value || (a.you ? -1 : b.you ? 1 : 0); });
    var max = rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0);
    rows = rows.map(function (r) { return Object.assign({}, r, { label: r.value + (r.value === 1 ? " answer" : " answers"), small: r.you ? "you" : "" }); });
    var key = JSON.stringify(rows);
    if (host._key === key) return;
    host._key = key;
    host.innerHTML = barsMarkup(rows, max);
    growBars(host);
  }

  function renderPrompts() {
    var list = $("#prompt-list");
    var prompts = state.data.prompts;
    $("#prompt-count").textContent = prompts.length ? "(" + prompts.length + ")" : "";
    if (!prompts.length) {
      list.innerHTML = '<li class="empty"><p class="empty-title">No prompts yet</p><p>Add 10 to 20 questions your buyers might ask an AI tool. Start from the library below.</p></li>';
      return;
    }
    list.innerHTML = prompts.map(function (p, i) {
      return '<li class="prompt-item" data-pid="' + esc(p.id) + '"><span class="prompt-n">' + (i + 1) + '</span>' +
        '<input class="field-input" type="text" maxlength="200" value="' + esc(p.text) + '" aria-label="Prompt ' + (i + 1) + '" data-prompt-edit="' + esc(p.id) + '">' +
        '<button type="button" class="icon-btn" data-prompt-del="' + esc(p.id) + '" aria-label="Remove prompt ' + (i + 1) + '" title="Remove">' + TRASH_SVG + "</button></li>";
    }).join("");
  }

  function renderLibSelect() {
    var sel = $("#lib-select");
    var have = {};
    state.data.prompts.forEach(function (p) { have[p.text.toLowerCase()] = true; });
    sel.innerHTML = '<option value="">Add from the prompt library (' + KIT.library.niches.reduce(function (n, x) { return n + x.prompts.length; }, 0) + ' examples)...</option>' +
      KIT.library.niches.map(function (n) {
        return '<optgroup label="' + esc(n.title) + '">' + n.prompts.map(function (text) {
          return "<option" + (have[text.toLowerCase()] ? " disabled" : "") + ' value="' + esc(text) + '">' + esc(text) + (have[text.toLowerCase()] ? " (added)" : "") + "</option>";
        }).join("") + "</optgroup>";
      }).join("");
  }

  function nextPromptId() {
    var max = 0;
    state.data.prompts.forEach(function (p) { var m = /^p(\d+)$/.exec(p.id); if (m) max = Math.max(max, +m[1]); });
    var id;
    do { max += 1; id = "p" + (max < 10 ? "0" : "") + max; } while (state.data.prompts.some(function (p) { return p.id === id; }));
    return id;
  }

  function addPrompt(text) {
    var clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return { ok: false, msg: "Type a buyer question first" };
    if (state.data.prompts.some(function (p) { return p.text.toLowerCase() === clean.toLowerCase(); })) return { ok: false, msg: "That prompt is already in your list" };
    patchData({ prompts: state.data.prompts.concat([{ id: nextPromptId(), text: clean }]) });
    renderTracker(true);
    saveNow();
    return { ok: true };
  }

  function checkFor(pid) {
    return state.data.checks.filter(function (c) { return c.date === state.recDate && c.platform === state.recPlatform && c.prompt_id === pid; })[0] || null;
  }
  function draftKey(pid) { return state.recDate + "|" + state.recPlatform + "|" + pid; }

  function renderRecord() {
    var dates = state.result.tracker.dates.map(function (d) { return d.date; });
    if (!state.recDate) state.recDate = dates.length ? dates[dates.length - 1] : todayStamp();
    $("#rec-date").value = state.recDate;
    var all = dates.indexOf(state.recDate) >= 0 ? dates : dates.concat([state.recDate]).sort();
    $("#date-chips").innerHTML = '<span class="hint" style="margin:0 6px 0 0">Dates:</span>' + all.map(function (d) {
      var on = d === state.recDate;
      var saved = dates.indexOf(d) >= 0;
      return '<button type="button" class="date-chip' + (on ? " is-on" : "") + '" data-date="' + d + '" aria-pressed="' + on + '">' + esc(longDate(d)) + (saved ? "" : " (new)") +
        (saved ? '<span class="x" role="button" tabindex="-1" data-del-date="' + d + '" aria-label="Delete all results on ' + esc(longDate(d)) + '" title="Delete this date">' + X_SVG + "</span>" : "") + "</button>";
    }).join("");
    renderPlatTabs();
    renderRows();
    renderRecordMeta();
  }

  function renderPlatTabs() {
    $("#plat-tabs").innerHTML = KIT.library.platforms.map(function (p) {
      var n = state.data.checks.filter(function (c) { return c.date === state.recDate && c.platform === p.id; }).length;
      var on = p.id === state.recPlatform;
      return '<button type="button" class="plat-tab" role="tab" aria-selected="' + on + '" data-plat="' + p.id + '">' + esc(p.label) +
        '<span class="cnt" data-plat-count="' + p.id + '">' + n + "/" + state.data.prompts.length + "</span></button>";
    }).join("");
  }

  function renderRows() {
    var host = $("#rows");
    var prompts = state.data.prompts;
    if (!prompts.length) {
      host.innerHTML = '<div class="empty"><p class="empty-title">Add buyer prompts first</p><p>Then ask each one on ' + esc(platformLabel(state.recPlatform)) + " and record the answer here.</p></div>";
      return;
    }
    host.innerHTML = '<div class="rows-head" aria-hidden="true"><span>Prompt</span><span>Were you named?</span><span>Position</span><span>Competitors named</span><span></span></div>' +
      prompts.map(function (p) {
        var c = checkFor(p.id);
        var d = state.drafts[draftKey(p.id)] || {};
        var m = c ? (c.mentioned ? "named" : "not_named") : "";
        var pos = c && c.position ? c.position : d.position || "";
        var comps = c ? c.competitors.join(", ") : d.competitors || "";
        var name = "m-" + p.id;
        return '<div class="result-row' + (m === "named" ? " is-named" : "") + '" data-row="' + esc(p.id) + '">' +
          '<span class="result-prompt" id="rp-' + esc(p.id) + '">' + esc(p.text) + "</span>" +
          '<div class="seg" role="radiogroup" aria-labelledby="rp-' + esc(p.id) + '">' +
          '<label><input type="radio" name="' + name + '" value="named"' + (m === "named" ? " checked" : "") + "><span>Named</span></label>" +
          '<label><input type="radio" name="' + name + '" value="not_named"' + (m === "not_named" ? " checked" : "") + "><span>Not named</span></label></div>" +
          '<input class="pos" type="number" min="1" step="1" inputmode="numeric" placeholder="#" aria-label="Position in the answer" data-pos="' + esc(p.id) + '" value="' + esc(pos) + '"' + (m === "not_named" ? " disabled" : "") + ">" +
          '<input class="comps" type="text" maxlength="300" placeholder="Names, separated by commas" aria-label="Competitors named" data-comps="' + esc(p.id) + '" value="' + esc(comps) + '">' +
          '<button type="button" class="icon-btn" data-clear="' + esc(p.id) + '" aria-label="Clear this result" title="Clear this result">' + X_SVG + "</button></div>";
      }).join("");
  }

  function renderRecordMeta() {
    var n = state.data.checks.filter(function (c) { return c.date === state.recDate && c.platform === state.recPlatform; }).length;
    var total = state.data.prompts.length;
    $("#rec-status").textContent = total ? n + " of " + total + " prompts recorded for " + platformLabel(state.recPlatform) + " on " + longDate(state.recDate) + ". Changes save on this device as you go." : "";
    KIT.library.platforms.forEach(function (p) {
      var el = $('[data-plat-count="' + p.id + '"]');
      if (el) el.textContent = state.data.checks.filter(function (c) { return c.date === state.recDate && c.platform === p.id; }).length + "/" + total;
    });
  }

  var trackerTimer = null;
  function refreshTrackerSoon() {
    clearTimeout(trackerTimer);
    trackerTimer = setTimeout(function () { renderTracker(false); renderChecklistSummary(); }, 120);
  }

  function upsertCheck(pid, patch) {
    var existing = checkFor(pid);
    var rest = state.data.checks.filter(function (c) { return c !== existing; });
    var base = existing || { date: state.recDate, prompt_id: pid, platform: state.recPlatform, mentioned: false, position: null, competitors: [], notes: "" };
    var next = Object.assign({}, base, patch);
    if (!next.mentioned) next.position = null;
    patchData({ checks: rest.concat([next]) });
  }

  function onRowsInput(ev) {
    var t = ev.target;
    var row = t.closest("[data-row]");
    if (!row) return;
    var pid = row.getAttribute("data-row");
    var existing = checkFor(pid);
    var dk = draftKey(pid);
    if (t.type === "radio") {
      var named = t.value === "named";
      var d = state.drafts[dk] || {};
      var posInput = $("[data-pos]", row);
      var pos = parseInt(posInput.value, 10);
      upsertCheck(pid, {
        mentioned: named,
        position: named && pos >= 1 ? pos : null,
        competitors: existing ? existing.competitors : E.parseCompetitors(d.competitors || $("[data-comps]", row).value)
      });
      posInput.disabled = !named;
      row.classList.toggle("is-named", named);
      delete state.drafts[dk];
    } else if (t.hasAttribute("data-pos")) {
      var raw = t.value.trim();
      var n = Number(raw);
      var ok = raw === "" || (Number.isInteger(n) && n >= 1 && n <= 50);
      t.classList.toggle("is-invalid", !ok);
      if (!ok) return;
      if (existing) upsertCheck(pid, { position: raw === "" ? null : n });
      else state.drafts[dk] = Object.assign({}, state.drafts[dk], { position: raw });
    } else if (t.hasAttribute("data-comps")) {
      if (existing) upsertCheck(pid, { competitors: E.parseCompetitors(t.value) });
      else state.drafts[dk] = Object.assign({}, state.drafts[dk], { competitors: t.value });
    }
    renderRecordMeta();
    refreshTrackerSoon();
    scheduleSave();
  }

  function deleteDate(date) {
    var snap = snapshot();
    var count = state.data.checks.filter(function (c) { return c.date === date; }).length;
    patchData({ checks: state.data.checks.filter(function (c) { return c.date !== date; }) });
    var dates = state.result.tracker.dates.map(function (d) { return d.date; });
    state.recDate = dates.length ? dates[dates.length - 1] : todayStamp();
    renderTracker(true);
    renderChecklistSummary();
    saveNow();
    toast("Deleted " + count + " results from " + longDate(date), { action: undoable("Results restored", snap) });
  }

  // ---------- top level ----------

  function renderAll(full) {
    if (full) { $("#sec-progress").innerHTML = ""; $("#fixes")._key = null; }
    renderHero();
    renderChecklistSummary();
    renderFixes();
    renderSecProgress();
    renderEditor();
    if (full) state.recDate = "";
    renderTracker(true);
    setTab(state.tab);
  }

  function download(filename, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportJSON(btn) {
    withFeedback(btn, function () {
      var name = "ai-visibility-" + todayStamp() + ".json";
      download(name, JSON.stringify(state.data, null, 2) + "\n", "application/json");
      toast("Exported " + name);
    });
  }

  function exportCSV(btn) {
    withFeedback(btn, function () {
      var tracker = state.tab === "tracker";
      var name = (tracker ? "ai-visibility-tracker-" : "ai-visibility-checklist-") + todayStamp() + ".csv";
      download(name, tracker ? E.trackerCSV(state.data, KIT.library) : E.checklistCSV(state.data, KIT.checklist), "text/csv");
      toast("Exported the " + (tracker ? "tracker" : "checklist") + " as " + name);
    });
  }

  function buildPrintSheet() {
    var r = state.result;
    var s = r.score;
    var t = r.tracker;
    var b = state.data.business;
    var latest = t.dates.length ? t.dates[t.dates.length - 1] : null;
    var secRows = s.sections.map(function (x) {
      return "<tr><td>" + x.n + ". " + esc(x.title) + '</td><td class="r">' + x.earned + "/" + x.possible + '</td><td class="r st-' + x.status + '">' + pctText(x.percent) + "</td></tr>";
    }).join("");
    var fixes = s.fixes.slice(0, 5).map(function (f) {
      var item = itemOf(f.id);
      return "<li><b>" + esc(f.question) + "</b> (" + f.points + " points, " + FIX_HINT[f.answer].toLowerCase() + "). " + esc(item.how) + "</li>";
    }).join("");
    var dateRows = t.dates.map(function (d) { return "<tr><td>" + esc(longDate(d.date)) + '</td><td class="r">' + d.mentioned + " of " + d.checks + '</td><td class="r">' + d.share + "%</td></tr>"; }).join("");
    var comps = t.competitors.slice(0, 5).map(function (c) { return "<tr><td>" + esc(c.name) + '</td><td class="r">' + c.count + "</td></tr>"; }).join("");
    $("#print-sheet").innerHTML =
      "<h1>AI Search Visibility Report</h1>" +
      '<p class="p-sub">' + esc(b.name || "Your business") + (b.website ? ", " + esc(b.website) : "") + ". " + esc(longDate(todayStamp())) + "." + (state.data.fictional ? " FICTIONAL SAMPLE." : "") + "</p>" +
      '<div class="p-stats">' +
      '<div class="p-stat"><span>Visibility score</span><b class="st-' + s.status + '">' + pctText(s.percent) + "</b></div>" +
      '<div class="p-stat"><span>Points</span><b>' + s.earned + " of " + s.possible + "</b></div>" +
      '<div class="p-stat"><span>Answered</span><b>' + s.answered + " of " + s.total + "</b></div>" +
      '<div class="p-stat"><span>Share of AI answers</span><b>' + (latest ? latest.share + "%" : "n/a") + "</b></div></div>" +
      "<h2>Top 5 fixes</h2><ol>" + (fixes || "<li>No open fixes.</li>") + "</ol>" +
      '<div class="p-cols"><div><h2>By section</h2><table><thead><tr><th>Section</th><th class="r">Points</th><th class="r">Score</th></tr></thead><tbody>' + secRows + "</tbody></table></div>" +
      "<div><h2>AI answer tracker</h2>" + (dateRows ? '<table><thead><tr><th>Date</th><th class="r">Named</th><th class="r">Share</th></tr></thead><tbody>' + dateRows + "</tbody></table>" : "<p>No checks recorded yet.</p>") +
      (comps ? '<table><thead><tr><th>Named most often</th><th class="r">Answers</th></tr></thead><tbody>' + comps + "</tbody></table>" : "") + "</div></div>" +
      '<p class="p-foot">Made with the AI Search Visibility Checklist on this device. No tool can promise that an AI will mention or recommend you. AI answers change often, so check again every month.</p>';
  }

  function printReport(btn) {
    withFeedback(btn, function () {
      buildPrintSheet();
      toast("Report ready. Choose Save as PDF to keep a copy.");
      setTimeout(function () { window.print(); }, 120);
    });
  }

  function loadSample() {
    var snap = snapshot();
    var hasOwn = !state.data.fictional && !isEmptyData(state.data);
    var go = hasOwn ? confirmBox("Load the fictional sample?", "This replaces your own answers and results on this device with the fictional sample. You can undo right after, or export JSON first.", "Load sample") : Promise.resolve(true);
    return go.then(function (ok) {
      if (!ok) return false;
      setData(KIT.sample);
      state.drafts = {};
      renderAll(true);
      saveNow();
      toast("Loaded the fictional sample", hasOwn ? { action: undoable("Your data is back", snap) } : {});
      return true;
    });
  }

  function startOwn() {
    var snap = snapshot();
    var msg = state.data.fictional
      ? "This clears the fictional sample so you can fill in your own business. You can load the sample again any time from the menu."
      : "This removes your answers, prompts and results on this device. You can undo right after, or export JSON first.";
    return confirmBox("Start your own?", msg, "Start my own").then(function (ok) {
      if (!ok) return false;
      setData(E.emptyData());
      state.drafts = {};
      state.open = { entity: true };
      state.tab = "checklist";
      renderAll(true);
      saveNow();
      toast("Ready for your own business", { action: undoable("Back as it was", snap) });
      setTimeout(openBusiness, REDUCED ? 0 : 400);
      return true;
    });
  }

  function importFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onerror = function () { toast("Could not read that file", { error: true }); };
    reader.onload = function () {
      var parsed;
      try { parsed = JSON.parse(String(reader.result)); } catch (err) { toast("That file is not valid JSON", { error: true }); return; }
      if (!parsed || typeof parsed !== "object" || !("answers" in parsed || "prompts" in parsed || "checks" in parsed)) {
        toast("No checklist or tracker data found in that file", { error: true });
        return;
      }
      var incoming = E.normalizeData(parsed, KIT.checklist, KIT.library);
      var dropped = (Array.isArray(parsed.checks) ? parsed.checks.length : 0) - incoming.checks.length;
      var snap = snapshot();
      confirmBox("Import " + file.name + "?",
        "This replaces what is on this device with " + Object.keys(incoming.answers).length + " answers, " + incoming.prompts.length + " prompts and " + incoming.checks.length + " results." +
        (dropped > 0 ? " " + dropped + " results could not be read and will be skipped." : ""), "Import").then(function (ok) {
        if (!ok) return;
        setData(incoming);
        state.drafts = {};
        renderAll(true);
        saveNow();
        toast("Imported " + file.name, { action: undoable("Import undone", snap) });
      });
    };
    reader.readAsText(file);
  }

  // ---------- business details ----------

  function openBusiness() {
    var b = state.data.business;
    $("#biz-name").value = b.name;
    $("#biz-line").value = b.one_liner;
    $("#biz-site").value = b.website;
    $("#biz-niche").value = b.niche;
    $("#biz-loc").value = b.location;
    $("#biz-site-error").hidden = true;
    $("#biz-site").classList.remove("is-invalid");
    var dlg = $("#business-dialog");
    if (typeof dlg.showModal === "function") dlg.showModal();
  }

  function readBusiness() {
    var site = $("#biz-site").value.trim();
    if (site && !/^https?:\/\//i.test(site)) site = "https://" + site;
    var bad = site && !/^https?:\/\/[^\s\/.]+\.[^\s]+$/i.test(site);
    $("#biz-site-error").hidden = !bad;
    $("#biz-site-error").textContent = bad ? "Use a web address like https://your-site.com" : "";
    $("#biz-site").classList.toggle("is-invalid", !!bad);
    if (bad) return null;
    return {
      name: $("#biz-name").value.replace(/\s+/g, " ").trim(),
      one_liner: $("#biz-line").value.replace(/\s+/g, " ").trim(),
      website: site,
      niche: $("#biz-niche").value.trim(),
      location: $("#biz-loc").value.trim()
    };
  }

  // ---------- wiring ----------

  function bind() {
    $$(".btn").forEach(decorateButton);
    $("#btn-export-json").addEventListener("click", function (e) { exportJSON(e.currentTarget); });
    $("#btn-export-csv").addEventListener("click", function (e) { exportCSV(e.currentTarget); });
    $("#btn-print").addEventListener("click", function (e) { printReport(e.currentTarget); });
    $("#btn-import").addEventListener("click", function () { $("#import-file").click(); });
    $("#import-file").addEventListener("change", function (e) { importFile(e.target.files && e.target.files[0]); e.target.value = ""; });
    $("#btn-business").addEventListener("click", openBusiness);
    $("#hero-meta").addEventListener("click", function (e) { if (e.target.id === "btn-edit-business") openBusiness(); });
    $("#btn-start-own").addEventListener("click", function (e) { withFeedback(e.currentTarget, startOwn); });

    var more = $("#btn-more");
    var menu = $("#more-menu");
    var closeMenu = function () { menu.hidden = true; more.setAttribute("aria-expanded", "false"); };
    more.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      more.setAttribute("aria-expanded", String(open));
      if (open) $("button", menu).focus();
    });
    document.addEventListener("click", function (e) { if (!menu.hidden && !e.target.closest(".menu-wrap")) closeMenu(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { closeMenu(); more.focus(); } });
    menu.addEventListener("keydown", function (e) {
      var items = $$("button", menu);
      var i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
    $("#btn-load-sample").addEventListener("click", function () { closeMenu(); loadSample(); });
    $("#btn-reset").addEventListener("click", function () { closeMenu(); startOwn(); });

    // tabs
    $$(".tab").forEach(function (t) { t.addEventListener("click", function () { setTab(t.getAttribute("data-tab")); }); });
    $(".tabs").addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      setTab(state.tab === "checklist" ? "tracker" : "checklist", true);
    });
    window.addEventListener("resize", function () { moveTabPill(); if (state.tab === "tracker") renderChart(); });

    // checklist
    var editor = $("#editor");
    editor.addEventListener("change", onAnswer);
    editor.addEventListener("click", function (e) {
      var tog = e.target.closest(".sec-toggle");
      if (tog) { toggleSection(tog.closest(".sec").getAttribute("data-sec")); return; }
      var mt = e.target.closest(".more-toggle");
      if (mt) {
        var li = mt.closest(".item");
        var id = li.getAttribute("data-id");
        var open = !li.classList.contains("is-more");
        li.classList.toggle("is-more", open);
        mt.setAttribute("aria-expanded", String(open));
        var m = Object.assign({}, state.more);
        m[id] = open;
        state.more = m;
      }
    });
    $("#fixes").addEventListener("click", function (e) { var b = e.target.closest("[data-goto]"); if (b) gotoItem(b.getAttribute("data-goto")); });
    $("#sec-progress").addEventListener("click", function (e) {
      var b = e.target.closest("[data-goto-sec]");
      if (!b) return;
      var id = b.getAttribute("data-goto-sec");
      toggleSection(id, true);
      setTimeout(function () { $("#sec-" + id).scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); }, REDUCED ? 0 : 120);
    });

    // prompts
    $("#prompt-add").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = $("#new-prompt");
      var btn = $("#btn-add-prompt");
      var text = input.value;
      var pre = String(text).trim();
      if (!pre) { input.classList.remove("is-invalid"); void input.offsetWidth; input.classList.add("is-invalid"); toast("Type a buyer question first", { error: true }); return; }
      withFeedback(btn, function () {
        var res = addPrompt(text);
        if (!res.ok) { toast(res.msg, { error: true }); return false; }
        input.value = "";
        input.classList.remove("is-invalid");
        toast("Added the prompt");
      });
    });
    $("#new-prompt").addEventListener("input", function (e) { e.target.classList.remove("is-invalid"); });
    $("#lib-select").addEventListener("change", function (e) {
      var text = e.target.value;
      if (!text) return;
      var res = addPrompt(text);
      toast(res.ok ? "Added from the library: " + text : res.msg, { error: !res.ok });
    });
    var plist = $("#prompt-list");
    plist.addEventListener("change", function (e) {
      var id = e.target.getAttribute("data-prompt-edit");
      if (!id) return;
      var text = e.target.value.replace(/\s+/g, " ").trim();
      if (!text) { e.target.value = state.data.prompts.filter(function (p) { return p.id === id; })[0].text; toast("A prompt cannot be empty. Kept the old text.", { error: true }); return; }
      patchData({ prompts: state.data.prompts.map(function (p) { return p.id === id ? { id: p.id, text: text } : p; }) });
      renderRows();
      renderLibSelect();
      saveNow();
      toast("Prompt updated");
    });
    plist.addEventListener("click", function (e) {
      var b = e.target.closest("[data-prompt-del]");
      if (!b) return;
      var id = b.getAttribute("data-prompt-del");
      var snap = snapshot();
      var p = state.data.prompts.filter(function (x) { return x.id === id; })[0];
      var removed = state.data.checks.filter(function (c) { return c.prompt_id === id; }).length;
      patchData({ prompts: state.data.prompts.filter(function (x) { return x.id !== id; }), checks: state.data.checks.filter(function (c) { return c.prompt_id !== id; }) });
      renderTracker(true);
      renderChecklistSummary();
      saveNow();
      toast("Removed the prompt" + (removed ? " and its " + removed + " results" : ""), { action: undoable("Prompt restored: " + p.text, snap) });
    });

    // record
    $("#rec-date").addEventListener("change", function (e) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) { e.target.value = state.recDate; return; }
      state.recDate = e.target.value;
      renderRecord();
    });
    $("#btn-today").addEventListener("click", function () { state.recDate = todayStamp(); renderRecord(); toast("Recording for today, " + longDate(state.recDate)); });
    $("#date-chips").addEventListener("click", function (e) {
      var x = e.target.closest("[data-del-date]");
      if (x) { e.stopPropagation(); deleteDate(x.getAttribute("data-del-date")); return; }
      var chip = e.target.closest("[data-date]");
      if (chip) { state.recDate = chip.getAttribute("data-date"); renderRecord(); }
    });
    $("#plat-tabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-plat]");
      if (!b) return;
      state.recPlatform = b.getAttribute("data-plat");
      renderPlatTabs();
      renderRows();
      renderRecordMeta();
      scheduleSave();
    });
    var rows = $("#rows");
    rows.addEventListener("change", function (e) { if (e.target.type === "radio") onRowsInput(e); });
    rows.addEventListener("input", function (e) { if (e.target.type !== "radio") onRowsInput(e); });
    rows.addEventListener("focusout", function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute("data-pos") && e.target.classList.contains("is-invalid")) {
        var c = checkFor(e.target.getAttribute("data-pos"));
        e.target.value = c && c.position ? c.position : "";
        e.target.classList.remove("is-invalid");
        toast("Position must be a whole number from 1. Kept the last valid one.", { error: true });
      }
    });
    rows.addEventListener("click", function (e) {
      var b = e.target.closest("[data-clear]");
      if (!b) return;
      var pid = b.getAttribute("data-clear");
      var existing = checkFor(pid);
      delete state.drafts[draftKey(pid)];
      if (existing) patchData({ checks: state.data.checks.filter(function (c) { return c !== existing; }) });
      renderRows();
      renderRecordMeta();
      refreshTrackerSoon();
      scheduleSave();
    });
    $("#btn-save-results").addEventListener("click", function (e) {
      withFeedback(e.currentTarget, function () {
        clearTimeout(saveTimer);
        var ok = saveNow();
        var n = state.data.checks.filter(function (c) { return c.date === state.recDate && c.platform === state.recPlatform; }).length;
        renderTracker(true);
        toast(ok ? "Saved " + n + " results for " + platformLabel(state.recPlatform) + " on " + longDate(state.recDate) : "Saving is blocked in this browser. Export JSON to keep your work.", { error: !ok });
      });
    });

    // business dialog
    $("#business-cancel").addEventListener("click", function () { $("#business-dialog").close(); });
    $("#business-save").addEventListener("click", function (e) {
      var next = readBusiness();
      if (!next) return;
      withFeedback(e.currentTarget, function () {
        patchData({ business: next });
        renderHero();
        renderCompBars();
        saveNow();
        setTimeout(function () { $("#business-dialog").close(); }, REDUCED ? 0 : 500);
        toast("Business details saved");
      });
    });
    $("#business-form").addEventListener("submit", function (e) { e.preventDefault(); $("#business-save").click(); });

    window.addEventListener("beforeprint", buildPrintSheet);
  }

  function init() {
    if (!E || !KIT) {
      document.body.innerHTML = "<p style='padding:24px'>kit-data.js or engine.js did not load. Keep the app folder together and open index.html again.</p>";
      return;
    }
    var saved = loadSaved();
    if (saved) {
      var ui = saved.ui || {};
      if (ui.tab === "tracker" || ui.tab === "checklist") state.tab = ui.tab;
      if (ui.open && typeof ui.open === "object") state.open = ui.open;
      if (ui.recPlatform) state.recPlatform = ui.recPlatform;
      setData(saved.data);
    } else {
      setData(KIT.sample);
      state.storageOk = probeStorage();
    }
    bind();
    updatePrivacyNote();
    renderAll(false);
    requestAnimationFrame(moveTabPill);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveTabPill);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // A tiny handle for automated checks of this page (read only use).
  window.VisibilityApp = { state: state, setTab: setTab, gotoItem: gotoItem, toast: toast };
})();
