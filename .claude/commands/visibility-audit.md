---
description: Check how visible your business is in AI search, step by step, and get your top 3 fixes
---

Use the `ai-search-visibility` skill in `.claude/skills/ai-search-visibility/SKILL.md` and follow its steps in full.

1. Read `data/business.json`. If it already has answers, ask whether to update it or start over.
2. Ask me for my business basics, then offer to check my website with `python3 tools/site_check.py` (only my home page,
   robots.txt and llms.txt are fetched).
3. Go through the 7 checklist sections with me in plain questions, a few at a time. Never guess an answer. If I do not know, use
   Not sure.
4. Help me pick 10 to 20 buyer prompts from the prompt library, in my buyers' words.
5. Write everything to `data/business.json`, run `python3 tools/visibility.py check` until it is OK, then
   `python3 tools/visibility.py report`.
6. Explain my score, my weakest sections and the top 3 fixes, in order.
7. Draft an about us fact sheet and FAQ answers using only facts I gave you. Mark missing facts with [ADD: ...].
8. Offer to open the app with `python3 tools/serve.py`.

Never invent facts or AI results. No promise that I will be recommended.

$ARGUMENTS
