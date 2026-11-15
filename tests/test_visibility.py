"""Tests for tools/visibility.py: scoring rules, tracker share math, validation, CLI and generated files.

Run: python3 -m unittest discover tests
"""
from __future__ import annotations

import contextlib
import io
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import visibility as v  # noqa: E402

CHECKLIST = v.load_checklist()
LIBRARY = v.load_library()
SAMPLE = json.loads((ROOT / "data" / "sample-business.json").read_text(encoding="utf-8"))
EXPECTED = json.loads((ROOT / "tests" / "fixtures" / "expected.json").read_text(encoding="utf-8"))


def mini_checklist():
    """A tiny checklist: 1 high (3), 1 medium (2), 1 low (1) in one section, 1 high in another."""
    return {
        "weights": {"high": 3, "medium": 2, "low": 1},
        "status": {"green_from": 70, "amber_from": 40},
        "sections": [{"id": "a", "n": 1, "title": "A", "desc": ""}, {"id": "b", "n": 2, "title": "B", "desc": ""}],
        "items": [
            {"id": "h", "section": "a", "question": "H?", "why": "", "how": "", "weight": "high"},
            {"id": "m", "section": "a", "question": "M?", "why": "", "how": "", "weight": "medium"},
            {"id": "l", "section": "a", "question": "L?", "why": "", "how": "", "weight": "low"},
            {"id": "h2", "section": "b", "question": "H2?", "why": "", "how": "", "weight": "high"},
        ],
    }


def run_cli(*args):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = v.main(list(args))
    return code, out.getvalue(), err.getvalue()


class ChecklistData(unittest.TestCase):
    def test_at_least_30_items_in_7_sections(self):
        self.assertGreaterEqual(len(CHECKLIST["items"]), 30)
        self.assertEqual([s["id"] for s in CHECKLIST["sections"]], ["entity", "crawl", "pages", "third", "proof", "words", "measure"])
        for sec in CHECKLIST["sections"]:
            self.assertTrue(any(i["section"] == sec["id"] for i in CHECKLIST["items"]), sec["id"])

    def test_every_item_is_complete(self):
        ids = set()
        for item in CHECKLIST["items"]:
            for key in ("id", "section", "question", "why", "how", "weight"):
                self.assertTrue(str(item.get(key, "")).strip(), f"{item.get('id')} misses {key}")
            self.assertIn(item["weight"], ("high", "medium", "low"))
            self.assertNotIn(item["id"], ids)
            ids.add(item["id"])

    def test_llms_txt_is_optional_and_low(self):
        item = next(i for i in CHECKLIST["items"] if i["id"] == "crawl-llms-txt")
        self.assertEqual(item["weight"], "low")
        self.assertIn("optional", (item["question"] + item["why"]).lower())
        self.assertIn("not proven", item["why"])

    def test_no_item_promises_ranking(self):
        banned = ("guarantee", "rank #1", "rank first", "will recommend you", "top of chatgpt")
        for item in CHECKLIST["items"]:
            text = (item["question"] + item["why"] + item["how"]).lower()
            for word in banned:
                self.assertNotIn(word, text.replace("not a guarantee", ""), item["id"])

    def test_weights_and_thresholds_match_the_spec(self):
        self.assertEqual(CHECKLIST["weights"], {"high": 3, "medium": 2, "low": 1})
        self.assertEqual(CHECKLIST["status"], {"green_from": 70, "amber_from": 40})


class ScoreRules(unittest.TestCase):
    def setUp(self):
        self.cl = mini_checklist()

    def test_yes_earns_full_points(self):
        s = v.score(self.cl, {"h": "yes", "m": "yes", "l": "yes", "h2": "yes"})
        self.assertEqual((s["earned"], s["possible"], s["percent"], s["status"]), (9, 9, 100, "green"))

    def test_no_not_sure_and_blank_earn_zero_but_count(self):
        s = v.score(self.cl, {"h": "yes", "m": "no", "l": "not_sure"})
        self.assertEqual((s["earned"], s["possible"]), (3, 9))
        self.assertEqual(s["answered"], 3)
        self.assertEqual(s["percent"], 33)
        self.assertEqual(s["status"], "red")

    def test_not_relevant_is_left_out(self):
        s = v.score(self.cl, {"h": "yes", "m": "yes", "l": "not_relevant", "h2": "not_relevant"})
        self.assertEqual((s["earned"], s["possible"], s["percent"]), (5, 5, 100))
        self.assertEqual(s["sections"][1]["possible"], 0)
        self.assertIsNone(s["sections"][1]["percent"])
        self.assertEqual(s["sections"][1]["status"], "none")

    def test_all_not_relevant_has_no_score(self):
        s = v.score(self.cl, {k: "not_relevant" for k in ("h", "m", "l", "h2")})
        self.assertIsNone(s["percent"])
        self.assertEqual(s["status"], "none")
        self.assertEqual(s["fixes"], [])

    def test_unknown_answer_counts_as_unanswered(self):
        s = v.score(self.cl, {"h": "maybe"})
        self.assertEqual(s["answered"], 0)
        self.assertEqual(s["earned"], 0)

    def test_status_boundaries_are_exact(self):
        rules = {"green_from": 70, "amber_from": 40}
        self.assertEqual(v.status_for(7, 10, rules), "green")   # exactly 70
        self.assertEqual(v.status_for(69, 100, rules), "amber")
        self.assertEqual(v.status_for(4, 10, rules), "amber")   # exactly 40
        self.assertEqual(v.status_for(39, 100, rules), "red")
        self.assertEqual(v.status_for(0, 0, rules), "none")
        # 69.5 percent shows as 70 but is still amber, the status uses the exact share.
        self.assertEqual(v.whole_percent(139, 200), 70)
        self.assertEqual(v.status_for(139, 200, rules), "amber")

    def test_whole_percent_rounds_half_up(self):
        self.assertEqual(v.whole_percent(1, 8), 13)   # 12.5
        self.assertEqual(v.whole_percent(5, 8), 63)   # 62.5
        self.assertEqual(v.whole_percent(2, 3), 67)
        self.assertIsNone(v.whole_percent(0, 0))

    def test_fixes_order_points_then_answer_then_list_order(self):
        s = v.score(self.cl, {"h": "not_sure", "m": "no", "h2": "no"})
        self.assertEqual([f["id"] for f in s["fixes"]], ["h2", "h", "m", "l"])
        self.assertEqual([f["answer"] for f in s["fixes"]], ["no", "not_sure", "no", "unanswered"])


class SampleScore(unittest.TestCase):
    def test_sample_matches_the_fixture(self):
        s = v.score(CHECKLIST, SAMPLE["answers"])
        for key, value in EXPECTED["score"].items():
            self.assertEqual(s[key], value, key)
        for sec in s["sections"]:
            want = EXPECTED["sections"][sec["id"]]
            for key, value in want.items():
                self.assertEqual(sec[key], value, f"{sec['id']} {key}")
        self.assertEqual([f["id"] for f in s["fixes"][:5]], EXPECTED["top_fixes"])

    def test_sample_is_amber_and_partly_done(self):
        s = v.score(CHECKLIST, SAMPLE["answers"])
        self.assertEqual(s["status"], "amber")
        self.assertLess(s["answered"], s["total"])

    def test_sample_is_labelled_fictional(self):
        self.assertTrue(SAMPLE["fictional"])
        self.assertIn("fictional", SAMPLE["business"]["name"].lower())
        self.assertIn("FICTIONAL", SAMPLE["note"])


class TrackerMath(unittest.TestCase):
    def data(self, checks, prompts=("p1", "p2")):
        return {"prompts": [{"id": p, "text": p} for p in prompts], "checks": checks}

    def check(self, date, pid, plat, mentioned, position=None, comps=()):
        return {"date": date, "prompt_id": pid, "platform": plat, "mentioned": mentioned, "position": position, "competitors": list(comps)}

    def test_share_per_date_and_change(self):
        checks = [
            self.check("2026-01-01", "p1", "chatgpt", False),
            self.check("2026-01-01", "p2", "chatgpt", False),
            self.check("2026-01-01", "p1", "perplexity", True, 2),
            self.check("2026-02-01", "p1", "chatgpt", True, 1),
            self.check("2026-02-01", "p2", "chatgpt", True, 3),
            self.check("2026-02-01", "p1", "perplexity", False),
        ]
        t = v.tracker(self.data(checks), LIBRARY)
        self.assertEqual([(d["date"], d["mentioned"], d["checks"], d["share"]) for d in t["dates"]],
                         [("2026-01-01", 1, 3, 33), ("2026-02-01", 2, 3, 67)])
        self.assertEqual(t["change"], 34)
        self.assertEqual(t["latest"], "2026-02-01")
        self.assertEqual(t["overall"], {"checks": 6, "mentioned": 3, "share": 50})
        self.assertEqual(t["avg_position"], 2.0)
        chat = next(p for p in t["platforms"] if p["id"] == "chatgpt")
        self.assertEqual((chat["mentioned"], chat["checks"], chat["share"]), (2, 2, 100))
        gem = next(p for p in t["platforms"] if p["id"] == "gemini")
        self.assertEqual((gem["checks"], gem["share"]), (0, None))

    def test_competitors_are_counted_case_and_space_insensitive(self):
        checks = [
            self.check("2026-01-01", "p1", "chatgpt", False, comps=["Acme  Co", "Beta"]),
            self.check("2026-01-01", "p2", "chatgpt", False, comps=["acme co", " "]),
            self.check("2026-01-01", "p1", "claude", False, comps=["Beta", "Acme Co"]),
        ]
        t = v.tracker(self.data(checks), LIBRARY)
        self.assertEqual(t["competitors"], [{"name": "Acme Co", "count": 3}, {"name": "Beta", "count": 2}])

    def test_empty_tracker(self):
        t = v.tracker({"prompts": [], "checks": []}, LIBRARY)
        self.assertEqual(t["dates"], [])
        self.assertIsNone(t["latest"])
        self.assertIsNone(t["change"])
        self.assertIsNone(t["avg_position"])
        self.assertIsNone(t["overall"]["share"])

    def test_one_date_has_no_change(self):
        t = v.tracker(self.data([self.check("2026-01-01", "p1", "chatgpt", True, 1)]), LIBRARY)
        self.assertIsNone(t["change"])

    def test_average_position_rounds_half_up_to_one_decimal(self):
        checks = [self.check("2026-01-01", "p1", "chatgpt", True, 1), self.check("2026-01-01", "p2", "chatgpt", True, 2),
                  self.check("2026-01-01", "p1", "claude", True, 2), self.check("2026-01-01", "p2", "claude", True, 2)]
        self.assertEqual(v.tracker(self.data(checks), LIBRARY)["avg_position"], 1.8)  # 1.75

    def test_sample_has_12_prompts_3_dates_and_a_rising_share(self):
        t = v.tracker(SAMPLE, LIBRARY)
        self.assertEqual(len(SAMPLE["prompts"]), 12)
        self.assertEqual([[d["date"], d["mentioned"], d["checks"], d["share"]] for d in t["dates"]], EXPECTED["tracker"]["dates"])
        shares = [d["share"] for d in t["dates"]]
        self.assertEqual(shares, sorted(shares))
        self.assertGreater(shares[-1], shares[0])
        self.assertEqual(t["change"], EXPECTED["tracker"]["change"])
        self.assertEqual(t["avg_position"], EXPECTED["tracker"]["avg_position"])
        self.assertEqual(t["competitors"][0], EXPECTED["tracker"]["top_competitor"])
        self.assertEqual({p["id"]: p["share"] for p in t["platforms"]}, EXPECTED["tracker"]["platform_shares"])


class Validation(unittest.TestCase):
    def test_sample_and_starter_are_valid(self):
        self.assertEqual(v.validate(SAMPLE), [])
        self.assertEqual(v.validate(json.loads((ROOT / "data" / "business.json").read_text(encoding="utf-8"))), [])

    def test_bad_data_is_reported(self):
        bad = {
            "answers": {"nope": "yes", "entity-one-name": "maybe"},
            "prompts": [{"id": "p1", "text": "x"}, {"id": "p1", "text": "y"}, {"id": "p2", "text": " "}],
            "checks": [
                {"date": "15/11/2026", "prompt_id": "p9", "platform": "bing", "mentioned": "yes", "position": 0, "competitors": "Acme"},
                {"date": "2026-11-15", "prompt_id": "p1", "platform": "chatgpt", "mentioned": False, "position": 2, "competitors": []},
                {"date": "2026-11-15", "prompt_id": "p1", "platform": "chatgpt", "mentioned": False, "position": None, "competitors": []},
            ],
        }
        errors = " | ".join(v.validate(bad))
        for fragment in ("'nope' is not a checklist item", "has 'maybe'", "used twice", "text is empty", "date must look like",
                         "prompt_id 'p9'", "platform 'bing'", "mentioned must be true or false", "whole number from 1",
                         "competitors must be a list", "position is set but mentioned is false", "recorded twice"):
            self.assertIn(fragment, errors)

    def test_not_an_object(self):
        self.assertEqual(v.validate([1, 2]), ["The file must hold one JSON object."])


class CommandLine(unittest.TestCase):
    def test_check_ok_on_sample(self):
        code, out, _ = run_cli("check", "--file", "data/sample-business.json")
        self.assertEqual(code, 0)
        self.assertIn("OK", out)

    def test_report_on_sample(self):
        code, out, _ = run_cli("report", "--file", "data/sample-business.json")
        self.assertEqual(code, 0)
        self.assertIn("Visibility score: 54% (Amber), 43 of 80 points", out)
        self.assertIn("FICTIONAL", out)
        self.assertIn("Top 5 fixes", out)
        self.assertIn("Change since the first check: +30 points", out)
        self.assertIn("No tool can promise", out)

    def test_json_matches_compute(self):
        code, out, _ = run_cli("json", "--file", "data/sample-business.json")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out), v.compute(SAMPLE))

    def test_csv_outputs(self):
        code, out, _ = run_cli("csv", "--file", "data/sample-business.json")
        self.assertEqual(code, 0)
        lines = out.strip().splitlines()
        self.assertEqual(lines[0], "section,id,question,weight,points,answer,earned")
        self.assertEqual(len(lines), len(CHECKLIST["items"]) + 1)
        code, out, _ = run_cli("csv", "--tracker", "--file", "data/sample-business.json")
        lines = out.strip().splitlines()
        self.assertEqual(lines[0], "date,platform,prompt,mentioned,position,competitors,notes")
        self.assertEqual(len(lines), len(SAMPLE["checks"]) + 1)

    def test_missing_file(self):
        code, _, err = run_cli("report", "--file", "data/does-not-exist.json")
        self.assertEqual(code, 1)
        self.assertIn("Could not find", err)

    def test_generated_files_are_in_step(self):
        code, out, _ = run_cli("build", "--check")
        self.assertEqual(code, 0, out)


class GeneratedDocs(unittest.TestCase):
    def test_checklist_md_lists_every_item(self):
        text = (ROOT / "CHECKLIST.md").read_text(encoding="utf-8")
        for item in CHECKLIST["items"]:
            self.assertIn(item["question"], text)
        self.assertEqual(text.count("- [ ] "), len(CHECKLIST["items"]))

    def test_prompt_library_md_lists_every_prompt(self):
        text = (ROOT / "PROMPT-LIBRARY.md").read_text(encoding="utf-8")
        for niche in LIBRARY["niches"]:
            self.assertIn("## " + niche["title"], text)
            for prompt in niche["prompts"]:
                self.assertIn(prompt, text)


if __name__ == "__main__":
    unittest.main()
