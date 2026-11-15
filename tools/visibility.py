#!/usr/bin/env python3
"""AI Search Visibility Checklist: the command line tool.

Standard library only, Python 3.9 or newer. No network calls.

It scores your checklist answers, sums up the AI answers you tracked by hand,
and keeps the printable docs and the app data in step with data/*.json.
app/engine.js implements the same rules and must give the same numbers.

Usage:
    python3 tools/visibility.py check              # check data/business.json for mistakes
    python3 tools/visibility.py report             # readable report with the top fixes
    python3 tools/visibility.py json               # machine readable output
    python3 tools/visibility.py csv                # one row per checklist item
    python3 tools/visibility.py csv --tracker      # one row per tracked AI answer
    python3 tools/visibility.py build              # rebuild CHECKLIST.md, PROMPT-LIBRARY.md, app/kit-data.js
    python3 tools/visibility.py build --check      # only check that they are in step

Add --file data/sample-business.json to any command to use another data file.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DEFAULT_FILE = DATA / "business.json"
VERSION = "1.0.0"

ANSWERS = ("yes", "no", "not_sure", "not_relevant")
FIX_ORDER = {"no": 0, "not_sure": 1, "unanswered": 2}
STATUS_LABEL = {"green": "Green", "amber": "Amber", "red": "Red", "none": "No score yet"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ---------- loading ----------

def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def load_checklist() -> dict:
    return load_json(DATA / "checklist.json")


def load_library() -> dict:
    return load_json(DATA / "prompts.json")


# ---------- small math helpers (integer math so Python and JavaScript agree) ----------

def whole_percent(part: int, total: int):
    """Share as a whole percent, rounded half up. None when total is 0."""
    if total <= 0:
        return None
    return (200 * part + total) // (2 * total)


def status_for(earned: int, possible: int, rules: dict) -> str:
    if possible <= 0:
        return "none"
    if earned * 100 >= rules["green_from"] * possible:
        return "green"
    if earned * 100 >= rules["amber_from"] * possible:
        return "amber"
    return "red"


def answer_of(answers: dict, item_id: str) -> str:
    value = (answers or {}).get(item_id)
    return value if value in ANSWERS else "unanswered"


# ---------- checklist score ----------

def score(checklist: dict, answers: dict) -> dict:
    weights = checklist["weights"]
    rules = checklist["status"]
    items = checklist["items"]

    def tally(subset):
        earned = possible = answered = 0
        for item in subset:
            points = weights[item["weight"]]
            answer = answer_of(answers, item["id"])
            if answer != "unanswered":
                answered += 1
            if answer == "not_relevant":
                continue
            possible += points
            if answer == "yes":
                earned += points
        return {
            "earned": earned,
            "possible": possible,
            "percent": whole_percent(earned, possible),
            "status": status_for(earned, possible, rules),
            "answered": answered,
            "total": len(subset),
        }

    overall = tally(items)
    sections = []
    for sec in checklist["sections"]:
        part = tally([i for i in items if i["section"] == sec["id"]])
        sections.append({"id": sec["id"], "n": sec["n"], "title": sec["title"], **part})

    fixes = []
    for index, item in enumerate(items):
        answer = answer_of(answers, item["id"])
        if answer in ("yes", "not_relevant"):
            continue
        fixes.append({
            "id": item["id"],
            "section": item["section"],
            "question": item["question"],
            "weight": item["weight"],
            "points": weights[item["weight"]],
            "answer": answer,
            "_order": index,
        })
    fixes.sort(key=lambda f: (-f["points"], FIX_ORDER[f["answer"]], f["_order"]))
    for fix in fixes:
        del fix["_order"]

    return {**overall, "sections": sections, "fixes": fixes}


# ---------- AI answer tracker ----------

def competitor_key(name: str) -> str:
    return " ".join(str(name).split()).lower()


def tracker(data: dict, library: dict) -> dict:
    checks = data.get("checks") or []
    platforms = library["platforms"]
    dates = sorted({c["date"] for c in checks})

    def count(subset):
        n = len(subset)
        m = sum(1 for c in subset if c.get("mentioned") is True)
        return {"checks": n, "mentioned": m, "share": whole_percent(m, n)}

    by_date = [{"date": d, **count([c for c in checks if c["date"] == d])} for d in dates]
    latest = dates[-1] if dates else None
    latest_checks = [c for c in checks if c["date"] == latest]

    change = None
    if len(by_date) >= 2 and by_date[0]["share"] is not None and by_date[-1]["share"] is not None:
        change = by_date[-1]["share"] - by_date[0]["share"]

    per_platform = []
    for plat in platforms:
        per_platform.append({"id": plat["id"], "label": plat["label"], **count([c for c in latest_checks if c["platform"] == plat["id"]])})

    seen: dict = {}
    order: list = []
    for check in checks:
        for name in check.get("competitors") or []:
            key = competitor_key(name)
            if not key:
                continue
            if key not in seen:
                seen[key] = {"name": " ".join(str(name).split()), "count": 0}
                order.append(key)
            seen[key]["count"] += 1
    competitors = sorted((seen[k] for k in order), key=lambda c: (-c["count"], c["name"].lower()))

    positions = [c["position"] for c in latest_checks if c.get("mentioned") is True and isinstance(c.get("position"), int)]
    avg_position = None
    if positions:
        tenths = (20 * sum(positions) + len(positions)) // (2 * len(positions))
        avg_position = tenths / 10

    prompts = []
    for prompt in data.get("prompts") or []:
        subset = [c for c in latest_checks if c["prompt_id"] == prompt["id"]]
        prompts.append({"id": prompt["id"], "text": prompt["text"], "checks": len(subset),
                        "mentioned": sum(1 for c in subset if c.get("mentioned") is True)})

    return {
        "dates": by_date,
        "overall": count(checks),
        "latest": latest,
        "change": change,
        "platforms": per_platform,
        "competitors": competitors,
        "avg_position": avg_position,
        "prompts": prompts,
    }


def compute(data: dict, checklist: dict | None = None, library: dict | None = None) -> dict:
    checklist = checklist or load_checklist()
    library = library or load_library()
    return {
        "version": VERSION,
        "business": data.get("business") or {},
        "fictional": bool(data.get("fictional")),
        "score": score(checklist, data.get("answers") or {}),
        "tracker": tracker(data, library),
    }


# ---------- validation ----------

def validate(data, checklist: dict | None = None, library: dict | None = None) -> list:
    checklist = checklist or load_checklist()
    library = library or load_library()
    errors = []
    if not isinstance(data, dict):
        return ["The file must hold one JSON object."]
    item_ids = {i["id"] for i in checklist["items"]}
    platform_ids = {p["id"] for p in library["platforms"]}

    business = data.get("business", {})
    if not isinstance(business, dict):
        errors.append("business must be an object with name, one_liner, website, niche and location.")

    answers = data.get("answers", {})
    if not isinstance(answers, dict):
        errors.append("answers must be an object like {\"entity-one-name\": \"yes\"}.")
        answers = {}
    for key, value in answers.items():
        if key not in item_ids:
            errors.append(f"answers: '{key}' is not a checklist item id (see data/checklist.json).")
        if value not in ANSWERS:
            errors.append(f"answers: '{key}' has '{value}'. Use yes, no, not_sure or not_relevant.")

    prompts = data.get("prompts", [])
    prompt_ids = set()
    if not isinstance(prompts, list):
        errors.append("prompts must be a list.")
        prompts = []
    for n, prompt in enumerate(prompts, start=1):
        if not isinstance(prompt, dict) or not str(prompt.get("id", "")).strip():
            errors.append(f"prompts #{n}: needs an id.")
            continue
        if prompt["id"] in prompt_ids:
            errors.append(f"prompts #{n}: the id '{prompt['id']}' is used twice.")
        prompt_ids.add(prompt["id"])
        if not str(prompt.get("text", "")).strip():
            errors.append(f"prompts #{n} ({prompt['id']}): the prompt text is empty.")

    checks = data.get("checks", [])
    if not isinstance(checks, list):
        errors.append("checks must be a list.")
        checks = []
    seen = set()
    for n, check in enumerate(checks, start=1):
        label = f"checks #{n}"
        if not isinstance(check, dict):
            errors.append(f"{label}: must be an object.")
            continue
        date = check.get("date")
        if not isinstance(date, str) or not DATE_RE.match(date):
            errors.append(f"{label}: date must look like 2026-11-15.")
        if check.get("prompt_id") not in prompt_ids:
            errors.append(f"{label}: prompt_id '{check.get('prompt_id')}' is not in prompts.")
        if check.get("platform") not in platform_ids:
            errors.append(f"{label}: platform '{check.get('platform')}' is not one of {', '.join(sorted(platform_ids))}.")
        if not isinstance(check.get("mentioned"), bool):
            errors.append(f"{label}: mentioned must be true or false.")
        position = check.get("position")
        if position is not None:
            if not isinstance(position, int) or isinstance(position, bool) or position < 1:
                errors.append(f"{label}: position must be a whole number from 1, or null.")
            elif check.get("mentioned") is False:
                errors.append(f"{label}: position is set but mentioned is false.")
        comps = check.get("competitors", [])
        if not isinstance(comps, list) or not all(isinstance(c, str) for c in comps):
            errors.append(f"{label}: competitors must be a list of names.")
        key = (date, check.get("prompt_id"), check.get("platform"))
        if key in seen:
            errors.append(f"{label}: the same prompt, platform and date is recorded twice.")
        seen.add(key)
    return errors


# ---------- output ----------

def answer_label(answer: str) -> str:
    return {"yes": "Yes", "no": "No", "not_sure": "Not sure", "not_relevant": "Not relevant", "unanswered": "Not answered"}[answer]


def fix_hint(answer: str) -> str:
    return {"no": "To do", "not_sure": "Check this first", "unanswered": "Not answered yet"}[answer]


def report_text(result: dict, checklist: dict, limit: int = 5) -> str:
    s = result["score"]
    t = result["tracker"]
    name = result["business"].get("name") or "Your business"
    lines = [f"AI Search Visibility report: {name}"]
    if result.get("fictional"):
        lines.append("This is the FICTIONAL sample. Replace it with your own business.")
    lines.append("")
    if s["percent"] is None:
        lines.append("Visibility score: no score yet (answer the checklist first)")
    else:
        lines.append(f"Visibility score: {s['percent']}% ({STATUS_LABEL[s['status']]}), {s['earned']} of {s['possible']} points")
    lines.append(f"Answered: {s['answered']} of {s['total']} items")
    lines.append("")
    lines.append("By section:")
    for sec in s["sections"]:
        pct = "n/a" if sec["percent"] is None else f"{sec['percent']}%"
        lines.append(f"  {sec['n']}. {sec['title']:<36} {pct:>5}  {sec['earned']}/{sec['possible']} points  {STATUS_LABEL[sec['status']]}")
    lines.append("")
    titles = {sec["id"]: sec["title"] for sec in checklist["sections"]}
    fixes = s["fixes"][:limit]
    if fixes:
        lines.append(f"Top {len(fixes)} fixes (biggest points first):")
        for n, fix in enumerate(fixes, start=1):
            lines.append(f"  {n}. [{fix['weight']}, {fix['points']} pts, {fix_hint(fix['answer'])}] {fix['question']}")
            lines.append(f"     Section: {titles[fix['section']]}")
    else:
        lines.append("No open fixes. Keep checking your buyer prompts every month.")
    lines.append("")
    if not t["dates"]:
        lines.append("AI answer tracker: no results recorded yet.")
    else:
        lines.append("AI answer tracker (share of answers that named you):")
        for row in t["dates"]:
            lines.append(f"  {row['date']}: {row['share']}%  ({row['mentioned']} of {row['checks']} answers)")
        if t["change"] is not None:
            sign = "+" if t["change"] > 0 else ""
            lines.append(f"  Change since the first check: {sign}{t['change']} points")
        lines.append(f"  Latest check by platform ({t['latest']}):")
        for plat in t["platforms"]:
            pct = "n/a" if plat["share"] is None else f"{plat['share']}%"
            lines.append(f"    {plat['label']:<22} {pct:>5}  ({plat['mentioned']} of {plat['checks']})")
        if t["avg_position"] is not None:
            lines.append(f"  Average position when named (latest check): {t['avg_position']}")
        if t["competitors"]:
            lines.append("  Competitors named most often:")
            for comp in t["competitors"][:5]:
                lines.append(f"    {comp['name']}: {comp['count']} answers")
    lines.append("")
    lines.append("No tool can promise that an AI will recommend you. AI answers change often. See docs/LIMITS-AND-HONESTY.md.")
    return "\n".join(lines)


def csv_checklist(data: dict, checklist: dict) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(["section", "id", "question", "weight", "points", "answer", "earned"])
    titles = {s["id"]: s["title"] for s in checklist["sections"]}
    weights = checklist["weights"]
    for item in checklist["items"]:
        answer = answer_of(data.get("answers") or {}, item["id"])
        points = weights[item["weight"]]
        writer.writerow([titles[item["section"]], item["id"], item["question"], item["weight"], points,
                         answer_label(answer), points if answer == "yes" else 0])
    return out.getvalue()


def csv_tracker(data: dict, library: dict) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(["date", "platform", "prompt", "mentioned", "position", "competitors", "notes"])
    labels = {p["id"]: p["label"] for p in library["platforms"]}
    texts = {p["id"]: p["text"] for p in data.get("prompts") or []}
    rows = sorted(data.get("checks") or [], key=lambda c: (c["date"], c["prompt_id"], c["platform"]))
    for c in rows:
        writer.writerow([c["date"], labels.get(c["platform"], c["platform"]), texts.get(c["prompt_id"], c["prompt_id"]),
                         "yes" if c.get("mentioned") else "no", c.get("position") or "",
                         "; ".join(c.get("competitors") or []), c.get("notes") or ""])
    return out.getvalue()


# ---------- generated files (one source of truth: data/*.json) ----------

def checklist_markdown(checklist: dict) -> str:
    w = checklist["weights"]
    st = checklist["status"]
    total = len(checklist["items"])
    lines = [
        "# AI Search Visibility Checklist",
        "",
        f"{total} things that help AI search tools like ChatGPT, Perplexity, Gemini, Claude and Google AI Overviews find, understand and",
        "mention your business. Print it, or use the app (`app/index.html`) to score it for you.",
        "",
        "This file is made from `data/checklist.json` by `python3 tools/visibility.py build`. Edit the JSON, not this file.",
        "",
        "## How to use it",
        "",
        "1. Answer each item: Yes, No, Not sure, or Not relevant to your business.",
        f"2. Points: high = {w['high']}, medium = {w['medium']}, low = {w['low']}. A Yes earns the points. No, Not sure and blank earn 0.",
        "   Not relevant items are left out of the total.",
        f"3. Visibility score = points earned / points possible, as a percent. Green from {st['green_from']} percent, amber from {st['amber_from']} percent,",
        "   red below. Full rules: [docs/04-HOW-THE-SCORE-WORKS.md](docs/04-HOW-THE-SCORE-WORKS.md).",
        "4. Fix the No and Not sure items with the most points first.",
        "",
        "No item on this list can promise that an AI tool will mention or recommend you. They make you easier to find and understand.",
        "",
    ]
    for sec in checklist["sections"]:
        items = [i for i in checklist["items"] if i["section"] == sec["id"]]
        possible = sum(w[i["weight"]] for i in items)
        lines += [f"## {sec['n']}. {sec['title']}", "", f"{sec['desc']}. {len(items)} items, {possible} points.", ""]
        for item in items:
            lines += [
                f"- [ ] **{item['question']}** ({item['weight']}, {w[item['weight']]} points)",
                f"  - Why it matters: {item['why']}",
                f"  - How to do it: {item['how']}",
                "",
            ]
    lines += [
        "## Your score",
        "",
        "| | Points |",
        "| --- | --- |",
        "| Points earned (Yes) | |",
        "| Points possible (all items except Not relevant) | |",
        "| Visibility score (earned / possible x 100) | % |",
        "",
    ]
    return "\n".join(lines)


def prompts_markdown(library: dict) -> str:
    count = sum(len(n["prompts"]) for n in library["niches"])
    platforms = ", ".join(p["label"] for p in library["platforms"])
    lines = [
        "# Buyer Prompt Library",
        "",
        f"{count} example questions a buyer might type into an AI tool, grouped by niche. Pick 10 to 20 that fit your business, change the",
        "words in [brackets], and edit them into the words your own buyers use.",
        "",
        "This file is made from `data/prompts.json` by `python3 tools/visibility.py build`. Edit the JSON, not this file.",
        "",
        "## How to track them",
        "",
        f"1. Once a month, ask each prompt on: {platforms}.",
        "2. Use a fresh chat each time, and note if you were logged in, because answers can change with history, location and time.",
        "3. Write down if your business was named, its position in the answer, and which competitors were named.",
        "4. Record the results in the app's AI answer tracker. It shows your share of answers over time and who shows up most.",
        "",
        "These are examples to edit, not a list of what buyers really type. The app and this kit never call any AI for you.",
        "",
    ]
    for niche in library["niches"]:
        lines += [f"## {niche['title']}", ""]
        lines += [f"{n}. {text}" for n, text in enumerate(niche["prompts"], start=1)]
        lines.append("")
    return "\n".join(lines)


def kit_data_js(checklist: dict, library: dict, sample: dict) -> str:
    payload = json.dumps({"checklist": checklist, "library": library, "sample": sample}, indent=1, ensure_ascii=False)
    return (
        "/* Generated by `python3 tools/visibility.py build` from data/checklist.json, data/prompts.json and\n"
        " * data/sample-business.json. Do not edit by hand. It lets the app open with a double click (no server needed). */\n"
        "(function (root) {\n"
        f"  var KIT = {payload};\n"
        "  if (typeof module === \"object\" && module.exports) module.exports = KIT;\n"
        "  root.VISIBILITY_KIT = KIT;\n"
        "})(typeof globalThis !== \"undefined\" ? globalThis : this);\n"
    )


def generated_files() -> dict:
    checklist = load_checklist()
    library = load_library()
    sample = load_json(DATA / "sample-business.json")
    return {
        ROOT / "CHECKLIST.md": checklist_markdown(checklist),
        ROOT / "PROMPT-LIBRARY.md": prompts_markdown(library),
        ROOT / "app" / "kit-data.js": kit_data_js(checklist, library, sample),
    }


def build(check_only: bool) -> int:
    stale = []
    for path, text in generated_files().items():
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current != text:
            stale.append(path.relative_to(ROOT))
            if not check_only:
                path.write_text(text, encoding="utf-8")
    if check_only:
        if stale:
            print("Out of step with data/*.json: " + ", ".join(str(p) for p in stale))
            print("Run: python3 tools/visibility.py build")
            return 1
        print("Generated files are in step with data/*.json.")
        return 0
    print("Rebuilt: " + (", ".join(str(p) for p in stale) if stale else "nothing changed"))
    return 0


# ---------- command line ----------

def parse_args(argv):
    parser = argparse.ArgumentParser(description="AI Search Visibility Checklist tool (no network calls).")
    sub = parser.add_subparsers(dest="command", required=True)
    for name, text in (("check", "check a data file for mistakes"), ("report", "readable report"), ("json", "machine readable output"),
                       ("csv", "CSV output")):
        p = sub.add_parser(name, help=text)
        p.add_argument("--file", default="data/business.json", help="data file (default data/business.json)")
        if name == "csv":
            p.add_argument("--tracker", action="store_true", help="one row per tracked AI answer instead of per checklist item")
        if name == "report":
            p.add_argument("--top", type=int, default=5, help="how many fixes to list (default 5)")
    b = sub.add_parser("build", help="rebuild CHECKLIST.md, PROMPT-LIBRARY.md and app/kit-data.js")
    b.add_argument("--check", action="store_true", help="only check, write nothing")
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    if args.command == "build":
        return build(args.check)
    path = Path(args.file)
    if not path.is_absolute() and not path.exists():
        path = ROOT / path
    try:
        data = load_json(path)
    except FileNotFoundError:
        print(f"Could not find {args.file}.", file=sys.stderr)
        return 1
    except json.JSONDecodeError as exc:
        print(f"{args.file} is not valid JSON: {exc.msg} (line {exc.lineno}).", file=sys.stderr)
        return 1
    checklist = load_checklist()
    library = load_library()
    errors = validate(data, checklist, library)
    if args.command == "check":
        if errors:
            print(f"Found {len(errors)} problem(s) in {args.file}:")
            for err in errors:
                print(f"  * {err}")
            return 1
        print(f"{args.file}: OK ({len(data.get('answers') or {})} answers, {len(data.get('prompts') or [])} prompts, "
              f"{len(data.get('checks') or [])} tracked answers).")
        return 0
    if errors:
        print(f"{args.file} has {len(errors)} problem(s). Run: python3 tools/visibility.py check --file {args.file}", file=sys.stderr)
        return 1
    if args.command == "json":
        print(json.dumps(compute(data, checklist, library), indent=2, ensure_ascii=False))
    elif args.command == "csv":
        sys.stdout.write(csv_tracker(data, library) if args.tracker else csv_checklist(data, checklist))
    else:
        print(report_text(compute(data, checklist, library), checklist, args.top))
    return 0


if __name__ == "__main__":
    sys.exit(main())
