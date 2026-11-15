#!/usr/bin/env python3
"""Kit check: every file exists, no dashes, no secrets, no network calls in the app, valid data, working links.

Standard library only. Run: python3 tests/check_kit.py
Exit code 0 means every check passed.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

REPO = "https://github.com/onittindwani-ai/ai-search-visibility-checklist"
G2_URL = "https://learn.g2.com/" + "g2-2026-ai-search-insight-report"  # split so this file does not match itself
REQUIRED = [
    "README.md", "LICENSE", "CHANGELOG.md", "VERSION", ".gitignore", "CHECKLIST.md", "PROMPT-LIBRARY.md",
    "app/index.html", "app/app.css", "app/app.js", "app/engine.js", "app/kit-data.js", "app/DESIGN-NOTES.md", "app/assets/favicon.svg",
    "data/checklist.json", "data/prompts.json", "data/sample-business.json", "data/business.json",
    "tools/visibility.py", "tools/serve.py", "tools/site_check.py",
    ".claude/skills/ai-search-visibility/SKILL.md", ".claude/commands/visibility-audit.md", ".claude/commands/visibility-report.md",
    "docs/00-START-HERE.md", "docs/01-THE-APP.md", "docs/02-THE-CHECKLIST-AND-PROMPTS.md", "docs/03-WITH-CLAUDE-CODE.md",
    "docs/04-HOW-THE-SCORE-WORKS.md", "docs/05-CHECK-YOUR-WEBSITE.md", "docs/LIMITS-AND-HONESTY.md", "docs/SECURITY.md",
    "tests/test_visibility.py", "tests/test_site_check.py", "tests/engine.test.mjs", "tests/check_kit.py", "tests/fixtures/expected.json",
    ".github/workflows/ci.yml",
]
TEXT_SUFFIXES = {".md", ".html", ".css", ".js", ".mjs", ".py", ".json", ".yml", ".yaml", ".svg", ".txt"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv"}
DASHES = re.compile("[\u2013\u2014\u2015\u2212]")
SECRETS = [
    ("OpenAI style key", re.compile(r"\bs" + r"k-[A-Za-z0-9_\-]{16,}")),
    ("api_key assignment", re.compile(r"api" + r"_key\s*=\s*['\"]?[A-Za-z0-9_\-]{8,}", re.I)),
    ("AWS access key", re.compile(r"\bAK" + r"IA[0-9A-Z]{16}\b")),
    ("GitHub token", re.compile(r"\bgh" + r"p_[A-Za-z0-9]{20,}")),
]
NETWORK = [
    re.compile(r"\bfetch\s*\("),
    re.compile(r"XMLHttpRequest"),
    re.compile(r"sendBeacon"),
    re.compile(r"new\s+WebSocket"),
    re.compile(r"<script[^>]+src=[\"']https?://", re.I),
    re.compile(r"<link[^>]+href=[\"']https?://", re.I),
    re.compile(r"url\(\s*[\"']?https?://", re.I),
]
# Only site_check.py may open network connections.
PY_NETWORK = re.compile(r"\b(urllib\.request|http\.client|socket\.|requests\.)")


class Report:
    def __init__(self):
        self.failures = []
        self.passed = 0

    def check(self, ok, message):
        if ok:
            self.passed += 1
        else:
            self.failures.append(message)
        return ok


def text_files():
    for path in ROOT.rglob("*"):
        if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES and not (set(path.relative_to(ROOT).parts) & SKIP_DIRS):
            yield path


def check_tree(rep):
    for rel in REQUIRED:
        rep.check((ROOT / rel).is_file(), f"Missing file: {rel}")
    shots = sorted((ROOT / "screenshots").glob("*.png")) if (ROOT / "screenshots").is_dir() else []
    rep.check(len(shots) >= 5, f"screenshots/ should hold at least 5 PNG screenshots, found {len(shots)}")
    size = sum(p.stat().st_size for p in shots)
    rep.check(size < 10 * 1024 * 1024, f"screenshots/ is {size / 1e6:.1f} MB, keep it under 10 MB")
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip() if (ROOT / "VERSION").exists() else ""
    rep.check(version == "1.0.0", f"VERSION should be 1.0.0, it is '{version}'")
    licence = (ROOT / "LICENSE").read_text(encoding="utf-8") if (ROOT / "LICENSE").exists() else ""
    rep.check("MIT License" in licence and "Copyright (c) 2026 Onit Tindwani" in licence, "LICENSE is not the MIT licence for Onit Tindwani")


def check_text(rep):
    for path in text_files():
        rel = path.relative_to(ROOT)
        text = path.read_text(encoding="utf-8", errors="replace")
        for number, line in enumerate(text.splitlines(), start=1):
            if DASHES.search(line):
                rep.check(False, f"Dash character in {rel} line {number}")
            for label, pattern in SECRETS:
                if pattern.search(line):
                    rep.check(False, f"Possible secret ({label}) in {rel} line {number}")
        rep.check(True, "")
        if rel.parts[0] == "app":
            for pattern in NETWORK:
                rep.check(not pattern.search(text), f"Possible network call or remote load in {rel}: {pattern.pattern}")
        if rel.suffix == ".py" and rel.parts[0] == "tools" and rel.name != "site_check.py":
            rep.check(not PY_NETWORK.search(text), f"Only site_check.py may use the network, found a network module in {rel}")
        if "%" in text and rel.suffix == ".md" and rel.name not in ("00-START-HERE.md",):
            for m in re.finditer(r"\b\d+(\.\d+)?%", text):
                line = text[: m.start()].count("\n") + 1
                rep.check(False, f"Percent figure in {rel} line {line}. The only statistic belongs in docs/00-START-HERE.md")


def check_g2_cited_once(rep):
    hits = []
    for path in text_files():
        text = path.read_text(encoding="utf-8", errors="replace")
        if G2_URL in text:
            hits.append(str(path.relative_to(ROOT)))
    rep.check(hits == ["docs/00-START-HERE.md"], f"The G2 report must be cited once, in docs/00-START-HERE.md, found in: {hits}")


def check_data(rep):
    import visibility

    checklist = visibility.load_checklist()
    rep.check(len(checklist["items"]) >= 30, "The checklist needs at least 30 items")
    rep.check(len(checklist["sections"]) == 7, "The checklist needs 7 sections")
    for rel in ("data/sample-business.json", "data/business.json"):
        data = json.loads((ROOT / rel).read_text(encoding="utf-8"))
        errors = visibility.validate(data)
        rep.check(not errors, f"{rel} fails visibility.py check: {errors[:3]}")
    sample = json.loads((ROOT / "data/sample-business.json").read_text(encoding="utf-8"))
    rep.check(sample.get("fictional") is True and "fictional" in sample["business"]["name"].lower(), "The sample must be labelled fictional")
    result = visibility.compute(sample)
    rep.check(result["score"]["status"] == "amber", "The sample should be amber")
    shares = [d["share"] for d in result["tracker"]["dates"]]
    rep.check(len(sample["prompts"]) == 12 and len(shares) == 3 and shares == sorted(shares) and shares[-1] > shares[0],
              "The sample needs 12 prompts across 3 dates with a rising share")
    stale = [str(p.relative_to(ROOT)) for p, text in visibility.generated_files().items() if not p.exists() or p.read_text(encoding="utf-8") != text]
    rep.check(not stale, f"Generated files out of step, run python3 tools/visibility.py build: {stale}")


def check_links(rep):
    link = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
    docs = [ROOT / "README.md", ROOT / "CHECKLIST.md", ROOT / "PROMPT-LIBRARY.md", *sorted((ROOT / "docs").glob("*.md"))]
    for path in docs:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for target in link.findall(text):
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            clean = target.split("#")[0]
            rep.check((path.parent / clean).exists(), f"Broken link in {path.relative_to(ROOT)}: {target}")
    for path in text_files():
        text = path.read_text(encoding="utf-8", errors="replace")
        for url in re.findall(r"https://github\.com/[^\s)>\]\"'`]+", text):
            rep.check(url.rstrip(".,") == REPO, f"GitHub link in {path.relative_to(ROOT)} is not the repo home: {url}")
    readme = (ROOT / "README.md").read_text(encoding="utf-8") if (ROOT / "README.md").exists() else ""
    first_section = readme.split("## ")[1] if "## " in readme else ""
    rep.check(first_section.startswith("Quick start with Claude Code"), "README must open with the Claude Code quick start")
    rep.check("set up the AI Search Visibility Checklist for me, open the app, and check how visible my business is" in readme,
              "README quick start prompt is missing")
    for match in re.findall(r"screenshots/([\w\-]+\.png)", readme):
        rep.check((ROOT / "screenshots" / match).exists(), f"README names a missing screenshot: {match}")


def main():
    rep = Report()
    check_tree(rep)
    check_text(rep)
    check_g2_cited_once(rep)
    check_data(rep)
    check_links(rep)
    if rep.failures:
        print(f"Kit check FAILED: {len(rep.failures)} problem(s), {rep.passed} checks passed.")
        for failure in rep.failures:
            print(f"  * {failure}")
        return 1
    print(f"Kit check OK: {rep.passed} checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
