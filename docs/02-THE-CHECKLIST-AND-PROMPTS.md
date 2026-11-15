# The checklist and the prompt library as documents

Two printable files at the top of the kit:

- [CHECKLIST.md](../CHECKLIST.md): all 39 items with why each matters and how to do it, plus a box for your score.
- [PROMPT-LIBRARY.md](../PROMPT-LIBRARY.md): 38 example buyer prompts in 6 niches (AI SDR and outbound agencies, AI voice agents, AI
  automation agencies, AI chatbots and support, B2B SaaS products, local and service businesses).

## One source of truth

Both files are made from the data the app and the command line tool use:

| File | Made from |
| --- | --- |
| `CHECKLIST.md` | `data/checklist.json` |
| `PROMPT-LIBRARY.md` | `data/prompts.json` |
| `app/kit-data.js` (lets the app open with a double click) | both, plus `data/sample-business.json` |

To change an item or a prompt, edit the JSON, then run:

```
python3 tools/visibility.py build          # rewrites the 3 files
python3 tools/visibility.py build --check  # only checks they are in step (the tests run this)
```

## Using the prompts well

- Pick 10 to 20 prompts that fit what you sell. Change the words in [brackets].
- Write them the way your buyers talk. Look at your sales call notes and emails for their exact words.
- Keep the same list for a few months, so the results are comparable. Add new prompts when your offer changes.
- AI answers can change with the account, the location, earlier chats and the day. Use a fresh chat, note whether you were logged
  in, and treat one answer as one sample, not the truth.
