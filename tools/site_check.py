#!/usr/bin/env python3
"""Check YOUR OWN website for a few AI search basics.

This is the only tool in the kit that uses the network, and only when you run
it with a website address. It fetches exactly 3 addresses on that site and
nothing else: the home page, /robots.txt and /llms.txt. It does not crawl,
follow links to other pages, log in, or send your data anywhere else.

It reports:
  * whether robots.txt blocks known AI crawlers (GPTBot, OAI-SearchBot,
    ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended)
  * whether the home page has Organization, LocalBusiness or
    SoftwareApplication structured data (JSON-LD)
  * the page title, meta description and H1
  * whether pricing, about and FAQ pages are linked from the home page
  * whether /llms.txt exists (optional, its effect is not proven)

Standard library only. Usage:
    python3 tools/site_check.py https://your-site.com
    python3 tools/site_check.py your-site.com --json
    python3 tools/site_check.py https://your-site.com --timeout 15
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

VERSION = "1.0.0"
USER_AGENT = (
    f"AISearchVisibilityChecklist-SiteCheck/{VERSION} "
    "(run by the site owner; +https://github.com/onittindwani-ai/ai-search-visibility-checklist)"
)
MAX_BYTES = 2_000_000
DEFAULT_TIMEOUT = 10

# What each crawler is, in plain words. Each company documents its crawlers on its own help pages.
AI_CRAWLERS = [
    ("GPTBot", "OpenAI, used to collect data for training models"),
    ("OAI-SearchBot", "OpenAI, used for search results in ChatGPT"),
    ("ChatGPT-User", "OpenAI, visits a page when a ChatGPT user asks for it"),
    ("PerplexityBot", "Perplexity, used for its search results"),
    ("ClaudeBot", "Anthropic, used to collect data for training models"),
    ("Google-Extended", "Google, controls use of your content for Gemini models (not Google Search)"),
]

ORG_TYPES = {
    "organization", "corporation", "localbusiness", "professionalservice", "onlinebusiness", "onlinestore",
    "store", "dentist", "legalservice", "attorney", "medicalbusiness", "medicalclinic", "homeandconstructionbusiness",
    "financialservice", "realestateagent", "restaurant", "automotivebusiness", "healthandbeautybusiness",
    "softwareapplication", "webapplication", "mobileapplication",
}

LINK_PATTERNS = {
    "pricing": re.compile(r"pric|plans?\b|cost|rates", re.I),
    "about": re.compile(r"about|our[-_ ]?story|our[-_ ]?team|\bteam\b|who[-_ ]?we[-_ ]?are|company", re.I),
    "faq": re.compile(r"\bfaqs?\b|frequently|questions", re.I),
}


# ---------- fetching (replaceable, so tests never touch the network) ----------

class FetchResult:
    def __init__(self, url: str, status: int, text: str = "", content_type: str = "", error: str = ""):
        self.url = url
        self.status = status
        self.text = text
        self.content_type = content_type
        self.error = error

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300


def default_fetch(url: str, timeout: float = DEFAULT_TIMEOUT) -> FetchResult:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,text/plain,*/*;q=0.5"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 (the user's own URL, http or https only)
            raw = response.read(MAX_BYTES + 1)[:MAX_BYTES]
            charset = response.headers.get_content_charset() or "utf-8"
            return FetchResult(response.geturl(), response.status, raw.decode(charset, errors="replace"),
                               response.headers.get("Content-Type", ""))
    except urllib.error.HTTPError as err:
        return FetchResult(url, err.code, "", err.headers.get("Content-Type", "") if err.headers else "", f"HTTP {err.code}")
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as err:
        reason = getattr(err, "reason", err)
        return FetchResult(url, 0, "", "", f"Could not connect: {reason}")


def normalize_url(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        raise ValueError("Give your website address, like https://your-site.com")
    if "://" not in text:
        text = "https://" + text
    parts = urllib.parse.urlsplit(text)
    if parts.scheme not in ("http", "https"):
        raise ValueError("Only http and https addresses are supported.")
    if not parts.hostname:
        raise ValueError("That does not look like a website address.")
    path = parts.path or "/"
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, path, parts.query, ""))


def site_root(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}"


# ---------- robots.txt (RFC 9309: matching group, then the longest matching rule wins) ----------

def parse_robots(text: str) -> list:
    """Return groups: [{"agents": [...lowercase], "rules": [("allow"|"disallow", path)]}]."""
    groups = []
    current = None
    last_was_agent = False
    for line in (text or "").splitlines():
        line = line.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        field, value = line.split(":", 1)
        field = field.strip().lower()
        value = value.strip()
        if field == "user-agent":
            if current is None or not last_was_agent:
                current = {"agents": [], "rules": []}
                groups.append(current)
            current["agents"].append(value.lower())
            last_was_agent = True
        elif field in ("allow", "disallow"):
            last_was_agent = False
            if current is not None:
                current["rules"].append((field, value))
        else:
            last_was_agent = False
    return groups


def rules_for(groups: list, bot: str) -> list | None:
    """Rules of every group naming this bot; else of the * groups; None if no group applies."""
    token = bot.lower()
    named = [g for g in groups if token in g["agents"]]
    if named:
        return [r for g in named for r in g["rules"]]
    star = [g for g in groups if "*" in g["agents"]]
    if star:
        return [r for g in star for r in g["rules"]]
    return None


def _pattern_matches(pattern: str, path: str) -> bool:
    if pattern == "":
        return False
    regex = re.escape(pattern).replace(r"\*", ".*")
    if regex.endswith(r"\$"):
        regex = regex[:-2] + "$"
    return re.match(regex, path) is not None


def is_allowed(rules: list | None, path: str = "/") -> bool:
    if not rules:
        return True
    best = None
    for kind, pattern in rules:
        if _pattern_matches(pattern, path):
            length = len(pattern)
            if best is None or length > best[0] or (length == best[0] and kind == "allow"):
                best = (length, kind)
    return best is None or best[1] == "allow"


def robots_report(text: str | None) -> list:
    groups = parse_robots(text or "")
    out = []
    for bot, what in AI_CRAWLERS:
        rules = rules_for(groups, bot)
        named = any(bot.lower() in g["agents"] for g in groups)
        if is_allowed(rules, "/"):
            disallows = [p for kind, p in (rules or []) if kind == "disallow" and p]
            status = "partly blocked" if disallows else "allowed"
        else:
            status = "blocked"
        out.append({"bot": bot, "what": what, "status": status, "named": named})
    return out


# ---------- home page HTML ----------

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.meta_description = None
        self.h1 = []
        self.jsonld = []
        self.links = []
        self._in_title = False
        self._in_h1 = False
        self._h1_buf = []
        self._in_jsonld = False
        self._jsonld_buf = []
        self._link = None

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self._in_title = True
        elif tag == "meta" and a.get("name", "").lower() == "description":
            self.meta_description = a.get("content", "").strip()
        elif tag == "h1":
            self._in_h1 = True
            self._h1_buf = []
        elif tag == "script" and "ld+json" in a.get("type", "").lower():
            self._in_jsonld = True
            self._jsonld_buf = []
        elif tag == "a" and a.get("href"):
            self._link = {"href": a["href"], "text": ""}
        elif tag == "img" and self._in_h1 and a.get("alt"):
            self._h1_buf.append(a["alt"])

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "h1" and self._in_h1:
            self._in_h1 = False
            self.h1.append(" ".join("".join(self._h1_buf).split()))
        elif tag == "script" and self._in_jsonld:
            self._in_jsonld = False
            self.jsonld.append("".join(self._jsonld_buf))
        elif tag == "a" and self._link is not None:
            self._link["text"] = " ".join(self._link["text"].split())
            self.links.append(self._link)
            self._link = None

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._in_h1:
            self._h1_buf.append(data)
        if self._in_jsonld:
            self._jsonld_buf.append(data)
        if self._link is not None:
            self._link["text"] += data


def _types_in(node) -> set:
    found = set()
    if isinstance(node, list):
        for item in node:
            found |= _types_in(item)
    elif isinstance(node, dict):
        kind = node.get("@type")
        kinds = kind if isinstance(kind, list) else [kind]
        for k in kinds:
            if isinstance(k, str):
                found.add(k.split("/")[-1].split(":")[-1])
        for key in ("@graph", "publisher", "provider", "author", "brand", "mainEntity", "about"):
            if key in node:
                found |= _types_in(node[key])
    return found


def schema_report(blocks: list) -> dict:
    types = set()
    broken = 0
    for block in blocks:
        try:
            types |= _types_in(json.loads(block))
        except (json.JSONDecodeError, ValueError):
            broken += 1
    org = sorted(t for t in types if t.lower() in ORG_TYPES)
    return {"blocks": len(blocks), "broken": broken, "types": sorted(types), "org_types": org, "found": bool(org)}


def links_report(links: list, base_url: str) -> dict:
    host = urllib.parse.urlsplit(base_url).hostname or ""
    out = {}
    for name, pattern in LINK_PATTERNS.items():
        hit = None
        for link in links:
            href = link["href"].strip()
            if href.startswith(("mailto:", "tel:", "javascript:")):
                continue
            absolute = urllib.parse.urljoin(base_url, href)
            target_host = urllib.parse.urlsplit(absolute).hostname or ""
            same_site = target_host == host or target_host.endswith("." + host) or host.endswith("." + target_host)
            path = urllib.parse.urlsplit(absolute).path + "#" + (urllib.parse.urlsplit(absolute).fragment or "")
            if same_site and (pattern.search(path) or pattern.search(link["text"])):
                hit = absolute
                break
        out[name] = hit
    return out


def looks_like_html(text: str) -> bool:
    head = (text or "").lstrip()[:200].lower()
    return head.startswith("<!doctype") or head.startswith("<html") or "<head" in head or "<body" in head


# ---------- the check ----------

def run_checks(url: str, fetch=None, timeout: float = DEFAULT_TIMEOUT) -> dict:
    fetch = fetch or (lambda u: default_fetch(u, timeout))
    home_url = normalize_url(url)
    root = site_root(home_url)

    home = fetch(home_url)
    robots = fetch(root + "/robots.txt")
    llms = fetch(root + "/llms.txt")

    result = {"url": home_url, "final_url": home.url, "home_status": home.status, "home_error": home.error}

    if robots.ok and not looks_like_html(robots.text):
        result["robots"] = {"found": True, "crawlers": robots_report(robots.text)}
    else:
        result["robots"] = {"found": False, "status": robots.status, "crawlers": robots_report("")}

    parser = PageParser()
    if home.ok and home.text:
        try:
            parser.feed(home.text)
            parser.close()
        except Exception:  # noqa: BLE001 (a broken page should not stop the report)
            pass
    result["title"] = " ".join(parser.title.split()) or None
    result["meta_description"] = parser.meta_description or None
    result["h1"] = [h for h in parser.h1 if h]
    result["schema"] = schema_report(parser.jsonld)
    result["links"] = links_report(parser.links, home.url or home_url)
    result["llms_txt"] = {"found": bool(llms.ok and llms.text.strip() and not looks_like_html(llms.text)), "status": llms.status}
    result["findings"] = findings(result)
    return result


def findings(r: dict) -> list:
    """Plain word findings: (level, text). level is ok, fix or info."""
    out = []
    if r["home_status"] == 0 or not (200 <= r["home_status"] < 300):
        out.append(("fix", f"The home page did not load ({r['home_error'] or 'status ' + str(r['home_status'])}). The other checks may be incomplete."))
    blocked = [c["bot"] for c in r["robots"]["crawlers"] if c["status"] == "blocked"]
    partly = [c["bot"] for c in r["robots"]["crawlers"] if c["status"] == "partly blocked"]
    if not r["robots"]["found"]:
        out.append(("ok", "No robots.txt found, so no crawler is blocked by it."))
    elif blocked:
        out.append(("fix", "robots.txt blocks your whole site for: " + ", ".join(blocked) + ". If that was not your choice, change it."))
    else:
        out.append(("ok", "robots.txt does not block any of the AI crawlers checked from your home page."))
    if partly:
        out.append(("info", "Some paths are blocked for: " + ", ".join(partly) + ". Check that your key pages are not among them."))
    if r["schema"]["found"]:
        out.append(("ok", "Structured data found: " + ", ".join(r["schema"]["org_types"]) + "."))
    else:
        out.append(("fix", "No Organization, LocalBusiness or SoftwareApplication structured data (JSON-LD) on the home page."))
    if r["schema"]["broken"]:
        out.append(("fix", f"{r['schema']['broken']} JSON-LD block(s) could not be read. Check them for typos."))
    out.append(("ok", f"Page title: {r['title']}") if r["title"] else ("fix", "The home page has no title."))
    out.append(("ok", "Meta description is set.") if r["meta_description"] else ("fix", "The home page has no meta description."))
    if len(r["h1"]) == 1:
        out.append(("ok", f"One main heading (H1): {r['h1'][0]}"))
    elif not r["h1"]:
        out.append(("fix", "No main heading (H1) found as text on the home page."))
    else:
        out.append(("info", f"{len(r['h1'])} H1 headings found. One clear H1 is easier to read."))
    names = {"pricing": "pricing", "about": "about", "faq": "FAQ"}
    for key, label in names.items():
        link = r["links"].get(key)
        out.append(("ok", f"A {label} page is linked: {link}") if link else ("fix", f"No {label} page linked from the home page."))
    if r["llms_txt"]["found"]:
        out.append(("info", "llms.txt found (optional, its effect is not proven)."))
    else:
        out.append(("info", "No llms.txt (optional, its effect is not proven, low priority)."))
    return out


def report_text(r: dict) -> str:
    tag = {"ok": "OK  ", "fix": "FIX ", "info": "INFO"}
    lines = [f"Site check for {r['url']}", ""]
    for level, text in r["findings"]:
        lines.append(f"  {tag[level]}  {text}")
    lines += ["", "AI crawlers in robots.txt:"]
    for c in r["robots"]["crawlers"]:
        lines.append(f"  {c['bot']:<16} {c['status']:<15} {c['what']}")
    lines += [
        "",
        "Fetched only: the home page, /robots.txt and /llms.txt. Nothing was sent anywhere else.",
        "Passing these checks does not mean an AI tool will mention you. See docs/LIMITS-AND-HONESTY.md.",
    ]
    return "\n".join(lines)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Check your own website for AI search basics (fetches 3 addresses only).")
    parser.add_argument("url", help="your website, like https://your-site.com")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT, help="seconds to wait for each address (default 10)")
    parser.add_argument("--json", action="store_true", help="machine readable output")
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)
    try:
        result = run_checks(args.url, timeout=args.timeout)
    except ValueError as err:
        print(str(err), file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps({**result, "findings": [{"level": lv, "text": tx} for lv, tx in result["findings"]]}, indent=2))
    else:
        print(report_text(result))
    return 0 if 200 <= result["home_status"] < 300 else 1


if __name__ == "__main__":
    sys.exit(main())
