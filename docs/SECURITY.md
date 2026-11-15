# Security

## What this kit does with your data

- The app, `tools/visibility.py` and `tools/serve.py` make no network calls and send no data anywhere.
- The app saves your answers, prompts and results in your browser's local storage on this device only. Clear your browser data to
  remove them.
- `tools/serve.py` serves the `app/` folder on your own computer at http://localhost:8767. It listens on 127.0.0.1 only.
- `data/business.json` is a plain file in this folder. Keep it out of public repos if your notes are private.

## The one tool that uses the network

`tools/site_check.py` fetches 3 addresses (home page, `/robots.txt`, `/llms.txt`) on the website you give it, and nothing else.
It sends no data from this kit. It only runs when you start it. Run it only on sites you own or manage.

## No keys needed

The kit never asks for an API key, a password or a login. It never calls any AI service. If something asks you for a key, it is not
part of this kit.

## Before you share

Your exports may hold competitor names, notes and your business details. Check them before you share a file, a CSV or a screenshot.

## Report a problem

If you find a security problem, open an issue on the repo without private details:
https://github.com/onittindwani-ai/ai-search-visibility-checklist
