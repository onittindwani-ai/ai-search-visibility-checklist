# Check your own website

`tools/site_check.py` looks at a few basics on YOUR OWN website.

```
python3 tools/site_check.py https://your-site.com
python3 tools/site_check.py your-site.com --json
python3 tools/site_check.py https://your-site.com --timeout 15
```

## This is the only tool that uses the network

It runs only when you start it, with the address you give it. It then fetches exactly 3 addresses on that site:

1. the home page,
2. `/robots.txt`,
3. `/llms.txt`.

It does not crawl other pages, does not follow links, does not log in, and sends nothing anywhere else. Its user agent says what it
is: `AISearchVisibilityChecklist-SiteCheck/1.0.0`. Each address waits at most 10 seconds (change it with `--timeout`). Please only
run it on sites you own or manage.

## What it reports

| Check | What it means |
| --- | --- |
| robots.txt and AI crawlers | For GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot and Google-Extended: allowed, partly blocked (some paths) or blocked (the whole site). It follows the usual robots.txt rules: the group that names the bot wins over `*`, and the longest matching rule wins. |
| Structured data | Whether the home page has a JSON-LD block of type Organization, LocalBusiness (or a type like Dentist), or SoftwareApplication. |
| Title and meta description | Whether the home page has them, and the title text. |
| H1 | Whether there is one clear main heading as text. |
| Pricing, about and FAQ links | Whether the home page links to such pages on the same site. |
| llms.txt | Whether it exists. It is optional and its effect is not proven, so it is only listed as information. |

## About the crawlers

Each company explains its own crawlers on its help pages, and those pages change. In short: some crawlers collect data for training
models (for example GPTBot and ClaudeBot), some fetch pages for search results or when a user asks (for example OAI-SearchBot,
ChatGPT-User and PerplexityBot), and Google-Extended controls whether Google may use your content for Gemini models, not whether you
appear in Google Search. Blocking or allowing them is your choice. Read the companies' own pages before you change your robots.txt.

## Limits

- It reads the home page as plain HTML. Text that only appears after scripts run, or behind a login, is not seen (which is also what
  some crawlers see).
- Passing every check does not mean an AI tool will mention you. Failing one does not mean it will not. See
  [LIMITS-AND-HONESTY.md](LIMITS-AND-HONESTY.md).
