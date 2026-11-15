---
name: ai-search-visibility
description: Audit how easy a business is to find and understand in AI search (ChatGPT, Perplexity, Gemini, Claude, Google AI Overviews). Use when the user asks to check their AI search visibility, get found in ChatGPT or Perplexity, audit their business for AI answers, track buyer prompts, or write an about us fact sheet or FAQ for AI search. Interviews the user, writes data/business.json, runs tools/visibility.py check and report, explains the top 3 fixes, and drafts a fact sheet and FAQ from the user's own facts only.
---

# AI search visibility audit

You help the user work through the AI Search Visibility Checklist in this repo. The checklist lives in `data/checklist.json`
(39 items, 7 sections). All scoring lives in `tools/visibility.py` (the same rules as `app/engine.js`). Never score in your head;
run the tool.

## Hard rules

- **Never invent facts.** Every answer, prompt, result and fact in `data/business.json`, the fact sheet and the FAQ comes from the
  user. If they do not know, the item is `not_sure`, never a guess. Never invent reviews, client names, case study numbers,
  awards, prices, years or locations. Put `[ADD: what is missing]` where a fact is needed.
- **Never claim to know what an AI says about them.** Do not ask any AI platform their prompts, do not browse for answers, and do
  not make up tracker results. The user records results by hand in the app's tracker.
- **The network**: only `tools/site_check.py` uses it, and only when the user asks you to check their own website, with the
  address they give. Nothing else leaves this folder.
- **Honesty**: no promise that they will be recommended or ranked. AI answers change often. Say this once at the end
  (`docs/LIMITS-AND-HONESTY.md`). llms.txt is optional and its effect is not proven.
- Plain words, short sentences. No dashes in anything you write for the user.

## Steps

1. **Read first.** Open `data/business.json`. If it already holds answers, ask whether to update it or start over. Skim
   `data/checklist.json` so you know the item ids.
2. **Business basics.** Ask: exact company name (as used everywhere), one line on what they do and for whom, website, niche,
   where they serve. Write them under `business`.
3. **Website check (optional).** Offer: "Want me to run a quick check of your website? It fetches only your home page, robots.txt
   and llms.txt." If yes, run `python3 tools/site_check.py <their url>` and use what it finds to suggest answers for the
   `crawl-*` items. Confirm each with the user before you write it.
4. **Interview, section by section.** For each of the 7 sections, read the questions in plain words, a few at a time, and record
   `yes`, `no`, `not_sure` or `not_relevant` under `answers` using the item ids. Yes only when it is really done. If an item does
   not fit their business (for example a location for a remote software company), it can be `not_relevant`.
5. **Buyer prompts (optional).** Help them pick 10 to 20 prompts from `data/prompts.json` (or `PROMPT-LIBRARY.md`) that fit their
   niche, edited into their buyers' words. Write them under `prompts` as `{"id": "p01", "text": "..."}`. Leave `checks` empty
   unless the user gives you results they recorded themselves.
6. **Check and report.** Run `python3 tools/visibility.py check`. Fix every problem it lists, then run
   `python3 tools/visibility.py report`.
7. **Explain** in this order:
   - The visibility score, its status (green from 70, amber from 40, red below) and points earned out of possible.
   - The weakest 2 sections.
   - **The top 3 fixes** from the report, in its order. For each: what to do this week, using the item's "how" text from
     `data/checklist.json`, in their words and for their business.
8. **Draft from their facts** (in the chat, or as files in a `drafts/` folder if they want):
   - An **about us fact sheet**: company name, one line description, who it is for, services, where they serve, founders, year
     started, proof they can share, profiles and directory links. Only facts they gave you; `[ADD: ...]` for the rest.
   - **FAQ answers**: 6 to 10 real buyer questions (from their sales calls and the prompts) with 2 to 4 sentence answers in plain
     words, using only their facts. Mark any answer that needs a fact you do not have.
9. **Offer the app**: "Want to see it visually? I can run `python3 tools/serve.py`, which opens the app at http://localhost:8767.
   Use Import to load data/business.json, then record your AI answers in the tracker each month."

## Data format (`data/business.json`)

```json
{
  "kit": "ai-search-visibility-checklist",
  "version": 1,
  "fictional": false,
  "business": {"name": "", "one_liner": "", "website": "", "niche": "", "location": ""},
  "answers": {"entity-one-name": "yes", "pages-pricing": "no"},
  "prompts": [{"id": "p01", "text": "best AI SDR agency for B2B SaaS"}],
  "checks": [{"date": "2026-11-15", "prompt_id": "p01", "platform": "chatgpt", "mentioned": true, "position": 2,
              "competitors": ["Name One", "Name Two"], "notes": ""}]
}
```

Platforms: `chatgpt`, `perplexity`, `gemini`, `claude`, `google_ai_overviews`. `position` is a whole number from 1, or null, and
only set when `mentioned` is true. `data/sample-business.json` is a full fictional example.

## Useful commands

```
python3 tools/visibility.py check
python3 tools/visibility.py report
python3 tools/visibility.py report --file data/sample-business.json
python3 tools/visibility.py json
python3 tools/visibility.py csv            # add --tracker for tracker rows
python3 tools/site_check.py https://their-site.com
python3 tools/serve.py
```
