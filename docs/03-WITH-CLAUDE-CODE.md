# With Claude Code

Give Claude this repo link and say:

> Set up the AI Search Visibility Checklist for me, open the app, and check how visible my business is.

Repo: https://github.com/onittindwani-ai/ai-search-visibility-checklist

## Commands

| Command | What Claude does |
| --- | --- |
| `/visibility-audit` | Interviews you about your business and the checklist, writes `data/business.json`, runs the report, explains the top 3 fixes, and drafts an "about us" fact sheet and FAQ answers from your own facts. |
| `/visibility-report` | Runs `python3 tools/visibility.py report` on your saved file and explains it, including the tracker results. |

You can also just say "audit how visible my business is in AI search". The skill in
`.claude/skills/ai-search-visibility/SKILL.md` is picked up automatically.

## What Claude will and will not do

- It only uses facts you give it. If you do not know an answer, the item stays "Not sure", never a guess.
- It never invents reviews, case study numbers, clients, awards or prices for your fact sheet or FAQ. Missing facts are marked
  `[ADD: ...]` for you to fill in.
- It runs `tools/site_check.py` on your website only if you ask, with the address you give. That is the only step that uses the
  network.
- It does not ask any AI platform your buyer prompts for you, and it does not claim to know what an AI says about you. You record
  those results yourself in the tracker.

## The tools Claude runs

```
python3 tools/visibility.py check      # checks data/business.json for mistakes
python3 tools/visibility.py report     # score, sections, top fixes, tracker results
python3 tools/visibility.py json       # the same as data, for scripts
python3 tools/visibility.py csv        # checklist rows (add --tracker for tracker rows)
python3 tools/site_check.py https://your-site.com
python3 tools/serve.py                 # opens the app at http://localhost:8767
```

To see Claude's work in the app, open the app and use **Import** with `data/business.json`.
