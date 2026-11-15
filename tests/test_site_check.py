"""Tests for tools/site_check.py. They use local fixture files and a fake fetch function, never the network.

Run: python3 -m unittest discover tests
"""
from __future__ import annotations

import contextlib
import io
import sys
import unittest
import urllib.request
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "tests" / "fixtures"
sys.path.insert(0, str(ROOT / "tools"))

import site_check as sc  # noqa: E402


def read(name: str) -> str:
    return (FIX / name).read_text(encoding="utf-8")


class FakeFetch:
    """Answers from a dict of url -> (status, text). Records every url asked for."""

    def __init__(self, pages: dict):
        self.pages = pages
        self.asked = []

    def __call__(self, url):
        self.asked.append(url)
        status, text = self.pages.get(url, (404, "<html><body>Not found</body></html>"))
        return sc.FetchResult(url, status, text, "text/html" if text.lstrip().startswith("<") else "text/plain")


def no_network(*args, **kwargs):
    raise AssertionError("A test tried to use the network")


@mock.patch.object(urllib.request, "urlopen", no_network)
class RobotsParsing(unittest.TestCase):
    def status(self, text):
        return {c["bot"]: c["status"] for c in sc.robots_report(text)}

    def test_no_robots_allows_everyone(self):
        self.assertEqual(set(self.status("").values()), {"allowed"})

    def test_empty_disallow_allows_everyone(self):
        self.assertEqual(set(self.status(read("robots_allow.txt")).values()), {"allowed"})

    def test_block_all(self):
        self.assertEqual(set(self.status(read("robots_block_all.txt")).values()), {"blocked"})

    def test_named_ai_bots_blocked_others_partly(self):
        s = self.status(read("robots_block_ai.txt"))
        self.assertEqual(s["GPTBot"], "blocked")
        self.assertEqual(s["ClaudeBot"], "blocked")
        self.assertEqual(s["Google-Extended"], "blocked")
        self.assertEqual(s["OAI-SearchBot"], "partly blocked")
        self.assertEqual(s["PerplexityBot"], "partly blocked")
        self.assertEqual(s["ChatGPT-User"], "partly blocked")

    def test_named_group_wins_over_star(self):
        s = self.status(read("robots_star_block_allow_search.txt"))
        self.assertEqual(s["GPTBot"], "blocked")
        self.assertEqual(s["OAI-SearchBot"], "partly blocked")
        self.assertEqual(s["PerplexityBot"], "partly blocked")

    def test_longest_match_wins_and_allow_wins_a_tie(self):
        rules = [("disallow", "/"), ("allow", "/pricing")]
        self.assertFalse(sc.is_allowed(rules, "/"))
        self.assertTrue(sc.is_allowed(rules, "/pricing"))
        self.assertTrue(sc.is_allowed([("disallow", "/a"), ("allow", "/a")], "/a"))
        self.assertFalse(sc.is_allowed([("disallow", "/*.pdf$")], "/file.pdf"))
        self.assertTrue(sc.is_allowed([("disallow", "/*.pdf$")], "/file.pdfx"))

    def test_user_agent_is_case_insensitive_and_comments_ignored(self):
        s = self.status("user-agent: gptbot  # OpenAI\nDISALLOW: /\n")
        self.assertEqual(s["GPTBot"], "blocked")
        self.assertEqual(s["ClaudeBot"], "allowed")


@mock.patch.object(urllib.request, "urlopen", no_network)
class FullCheck(unittest.TestCase):
    def test_good_site(self):
        fetch = FakeFetch({
            "https://example.test/": (200, read("home_good.html")),
            "https://example.test/robots.txt": (200, read("robots_allow.txt")),
            "https://example.test/llms.txt": (200, read("llms.txt")),
        })
        r = sc.run_checks("example.test", fetch=fetch)
        self.assertEqual(fetch.asked, ["https://example.test/", "https://example.test/robots.txt", "https://example.test/llms.txt"])
        self.assertTrue(r["robots"]["found"])
        self.assertTrue(r["schema"]["found"])
        self.assertEqual(r["schema"]["org_types"], ["Organization"])
        self.assertEqual(r["title"], "Example Reply Studio | AI SDR systems for B2B SaaS")
        self.assertTrue(r["meta_description"].startswith("We build AI SDR"))
        self.assertEqual(r["h1"], ["AI SDR systems that book sales meetings for B2B SaaS"])
        self.assertEqual(r["links"]["pricing"], "https://example.test/pricing")
        self.assertEqual(r["links"]["about"], "https://example.test/about-us/")
        self.assertEqual(r["links"]["faq"], "https://example.test/#faq")
        self.assertTrue(r["llms_txt"]["found"])
        self.assertFalse([t for lv, t in r["findings"] if lv == "fix"])

    def test_bare_site_lists_fixes(self):
        fetch = FakeFetch({
            "https://bare.test/": (200, read("home_bare.html")),
            "https://bare.test/robots.txt": (200, read("robots_block_ai.txt")),
            "https://bare.test/llms.txt": (200, "<!doctype html><html><body>Page not found</body></html>"),
        })
        r = sc.run_checks("https://bare.test", fetch=fetch)
        self.assertFalse(r["schema"]["found"])
        self.assertEqual(r["schema"]["broken"], 1)
        self.assertIsNone(r["title"])
        self.assertIsNone(r["meta_description"])
        self.assertEqual(r["h1"], [])
        self.assertIsNone(r["links"]["pricing"], "a pricing link to another site must not count")
        self.assertIsNone(r["links"]["about"])
        self.assertFalse(r["llms_txt"]["found"], "an HTML page served at /llms.txt is not an llms.txt")
        fixes = " ".join(t for lv, t in r["findings"] if lv == "fix")
        for fragment in ("GPTBot", "ClaudeBot", "Google-Extended", "structured data", "no title", "meta description", "No main heading",
                         "No pricing page", "No about page", "No FAQ page", "could not be read"):
            self.assertIn(fragment, fixes)

    def test_local_business_and_two_h1(self):
        fetch = FakeFetch({"https://smile.test/": (200, read("home_local.html"))})
        r = sc.run_checks("smile.test", fetch=fetch)
        self.assertEqual(r["schema"]["org_types"], ["Dentist"])
        self.assertEqual(len(r["h1"]), 2)
        self.assertFalse(r["robots"]["found"])
        self.assertEqual(r["links"]["faq"], "https://smile.test/frequently-asked-questions")
        self.assertEqual(r["links"]["about"], "https://smile.test/our-team")
        self.assertTrue(any(lv == "info" and "2 H1" in t for lv, t in r["findings"]))

    def test_home_page_down(self):
        fetch = FakeFetch({})
        fetch.pages["https://down.test/"] = (0, "")
        r = sc.run_checks("down.test", fetch=fetch)
        self.assertEqual(r["home_status"], 0)
        self.assertEqual(r["findings"][0][0], "fix")

    def test_report_text_says_what_was_fetched(self):
        fetch = FakeFetch({"https://example.test/": (200, read("home_good.html"))})
        text = sc.report_text(sc.run_checks("https://example.test/", fetch=fetch))
        self.assertIn("Fetched only: the home page, /robots.txt and /llms.txt", text)
        self.assertIn("does not mean an AI tool will mention you", text)


class UrlsAndAgent(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(sc.normalize_url("example.test"), "https://example.test/")
        self.assertEqual(sc.normalize_url(" http://example.test/home "), "http://example.test/home")
        for bad in ("", "ftp://example.test", "file:///etc/passwd", "https://"):
            with self.assertRaises(ValueError):
                sc.normalize_url(bad)

    def test_user_agent_names_the_tool(self):
        self.assertIn("AISearchVisibilityChecklist-SiteCheck", sc.USER_AGENT)
        self.assertIn("https://github.com/onittindwani-ai/ai-search-visibility-checklist", sc.USER_AGENT)

    def test_bad_url_exits_2_without_network(self):
        err = io.StringIO()
        with mock.patch.object(urllib.request, "urlopen", no_network), contextlib.redirect_stderr(err):
            self.assertEqual(sc.main(["ftp://example.test"]), 2)
        self.assertIn("Only http and https", err.getvalue())

    def test_default_fetch_uses_timeout_and_agent(self):
        seen = {}

        class FakeResponse:
            status = 200
            headers = mock.Mock(get_content_charset=lambda: "utf-8", get=lambda k, d="": "text/plain")

            def read(self, n):
                return b"ok"

            def geturl(self):
                return "https://example.test/robots.txt"

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        def fake_urlopen(request, timeout):
            seen["agent"] = request.get_header("User-agent")
            seen["timeout"] = timeout
            return FakeResponse()

        with mock.patch.object(urllib.request, "urlopen", fake_urlopen):
            result = sc.default_fetch("https://example.test/robots.txt", timeout=7)
        self.assertEqual(result.text, "ok")
        self.assertEqual(seen["timeout"], 7)
        self.assertEqual(seen["agent"], sc.USER_AGENT)


if __name__ == "__main__":
    unittest.main()
