# Changelog

## 1.0.0 (2026-11-15)

First release.

- The app: a local web app in `app/` with two parts. The checklist (39 items in 7 sections, Yes / No / Not sure / Not relevant,
  why it matters and how to do it, a visibility score with a green, amber or red status, and the top fixes in order) and the AI
  answer tracker (your buyer prompts, results recorded by hand per platform and date, share of answers over time, results by
  platform and the competitors named most). Import and export JSON, export CSV, a one page printable report, data saved on your
  device only.
- The documents: `CHECKLIST.md` (printable) and `PROMPT-LIBRARY.md` (38 example buyer prompts in 6 niches), both made from
  `data/*.json`.
- Claude Code: the `ai-search-visibility` skill and the `/visibility-audit` and `/visibility-report` commands.
- `tools/visibility.py`: check, report, json, csv and build commands, standard library only, no network.
- `tools/site_check.py`: checks your own website for AI crawler blocks in robots.txt, structured data, title, meta description,
  H1, pricing, about and FAQ links, and llms.txt. The only tool that uses the network, and only with the address you give it.
- A fictional sample business (amber, partly done) with 12 tracked prompts across 3 dates.
- Tests: Python unit tests (scoring, tracker math, site checker with fixture files), Node tests (the app and the command line tool
  must give the same numbers) and a kit check.
