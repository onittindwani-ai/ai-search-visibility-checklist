# The app

A local web app. No install, no account, no network calls. Everything you type is saved in your own browser on this device.

## Open it

- Double click `app/index.html`, or
- run `python3 tools/serve.py` (opens http://localhost:8767, stop it with Ctrl+C). Use `--port 9000` for another port.

The first time, the app shows a fictional sample business so you can see how it works. Click **Start my own** (or the menu, then
**Start my own (empty)**) to begin with your business. You can load the sample again any time from the menu.

## Part 1: the checklist

- 39 items in 7 sections. Each has a **Yes / No / Not sure / Not relevant** choice, a weight (high, medium or low) and a
  **Why it matters and how to do it** panel.
- The **visibility score** at the top updates as you answer: points earned out of points possible, with a green, amber or red status.
- **Top fixes** lists the 5 open items worth the most points. Click one to jump to it.
- **By section** shows where you are strong and where you are weak. Click a section to open it.
- **Share of AI answers** shows the latest number from the tracker, so you can see both sides in one place.

## Part 2: the AI answer tracker

The app never asks any AI for you. You ask, and you record what you saw.

1. **Buyer prompts**: type your own, or add from the library of 38 examples. Edit them into the words your buyers use. Removing a
   prompt also removes its results, with Undo.
2. **Record what the AI said**: pick the date and the platform (ChatGPT, Perplexity, Gemini, Claude, Google AI Overviews). For each
   prompt, tick **Named** or **Not named**, add your position in the answer if you were named, and type the competitors that were
   named, separated by commas. Changes save as you go. **Save results** confirms it.
3. Read the results: **share of answers over time** (answers that named you, out of all answers checked, per date), **by platform**
   for the latest date, and **who gets named most** across all checks, with your own business in the same list.
4. Delete a whole date with the small x on its chip. Undo is offered right after.

## Files

| Button | What you get |
| --- | --- |
| Import | Loads a JSON file exported by this app or written by Claude (`data/business.json`). Replaces what is on this device, with Undo. |
| Export JSON | Everything: business details, answers, prompts and results. Keep it as a backup or move it to another device. |
| Export CSV | On the checklist tab, one row per checklist item. On the tracker tab, one row per recorded answer. |
| Print report | A one page report: score, top 5 fixes, sections, tracker results and top competitors. Choose Save as PDF to keep it. |
| Business details (house icon) | Your company name, one line description, website, niche and where you serve. Used in the report. |

## Good to know

- If your browser blocks saving (some private windows do), the top bar says so. Export JSON to keep your work.
- The app works with the keyboard: Tab through controls, arrow keys inside each answer group and between the two tabs.
- If you prefer less motion, your system's reduced motion setting turns the animations off.
