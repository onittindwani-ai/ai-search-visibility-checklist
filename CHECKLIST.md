# AI Search Visibility Checklist

39 things that help AI search tools like ChatGPT, Perplexity, Gemini, Claude and Google AI Overviews find, understand and
mention your business. Print it, or use the app (`app/index.html`) to score it for you.

This file is made from `data/checklist.json` by `python3 tools/visibility.py build`. Edit the JSON, not this file.

## How to use it

1. Answer each item: Yes, No, Not sure, or Not relevant to your business.
2. Points: high = 3, medium = 2, low = 1. A Yes earns the points. No, Not sure and blank earn 0.
   Not relevant items are left out of the total.
3. Visibility score = points earned / points possible, as a percent. Green from 70 percent, amber from 40 percent,
   red below. Full rules: [docs/04-HOW-THE-SCORE-WORKS.md](docs/04-HOW-THE-SCORE-WORKS.md).
4. Fix the No and Not sure items with the most points first.

No item on this list can promise that an AI tool will mention or recommend you. They make you easier to find and understand.

## 1. Clear entity

One name, one clear line about what you do and for whom, the same everywhere. 5 items, 11 points.

- [ ] **Do you use one exact company name everywhere: your website, LinkedIn, directories and invoices?** (high, 3 points)
  - Why it matters: AI tools put facts together from many sites. If your name is spelled three ways, they may treat you as three different companies, or skip you.
  - How to do it: Pick one exact spelling. Update your website footer, LinkedIn page, Google Business Profile and every directory listing to match it.

- [ ] **Do you have one plain sentence that says what you do and for whom?** (high, 3 points)
  - Why it matters: When someone asks an AI tool who does a job, it looks for a clear match. A plain sentence like "We build AI sales agents for B2B SaaS companies" is easy to match.
  - How to do it: Write one sentence: what you do, for whom, and how. No buzzwords. Put it at the top of your home page.

- [ ] **Is that sentence the same, or very close, on your website, LinkedIn and directory profiles?** (medium, 2 points)
  - Why it matters: When many sources say the same thing about you, the picture an AI tool builds of your company is clearer.
  - How to do it: Copy your one line description into your LinkedIn tagline, your directory profiles and your social bios.

- [ ] **Does your website have an About page that says who you are, where you are based (or that you are remote) and when you started?** (medium, 2 points)
  - Why it matters: Basic facts about a company help AI tools describe you correctly and tell you apart from companies with similar names.
  - How to do it: Add an About page with your founders, your location or service area, the year you started and what you focus on.

- [ ] **Are your contact details (address or service area, email, phone if you use one) the same on your site and your profiles?** (low, 1 points)
  - Why it matters: Matching details make it easier to connect your website, your profiles and your reviews as one business.
  - How to do it: List the same contact details on your website and your main profiles. Remove old addresses and old emails.

## 2. Website basics for AI crawlers

Let AI search tools reach your pages and read your facts. 9 items, 17 points.

- [ ] **Does your robots.txt file let AI search crawlers read your site (unless you chose to block them)?** (high, 3 points)
  - Why it matters: If your robots.txt blocks an AI company's search crawler, that tool may not be able to read your pages, so it cannot quote them.
  - How to do it: Run python3 tools/site_check.py with your own website address. It lists which known AI crawlers your robots.txt blocks. Each AI company explains its crawlers on its own help pages, so read those before you change anything.

- [ ] **Are your key facts (what you do, who it is for, prices, locations) written as plain text, not only inside images or videos?** (high, 3 points)
  - Why it matters: Text is the easiest thing for any tool to read. Facts that only live inside a picture or a video are easy to miss.
  - How to do it: Look at your home, services and pricing pages. Any fact that only appears in an image, write it out as text on the page too.

- [ ] **Does your home page have Organization structured data (or LocalBusiness or SoftwareApplication, whichever fits)?** (medium, 2 points)
  - Why it matters: Structured data (a small block of JSON-LD code) states your name, website, logo and profiles in a format machines read easily. It is not a guarantee of anything, but it removes guesswork.
  - How to do it: Add a JSON-LD block of type Organization to your home page with your name, url, logo and sameAs links to your profiles. tools/site_check.py tells you if one is found.

- [ ] **Does each important page have one clear main heading (H1) and headings that describe each part?** (medium, 2 points)
  - Why it matters: Clear headings show what each part of a page is about, so the right part can be found and quoted.
  - How to do it: Give every page one H1 that says what the page is about. Use H2 headings for each part, written in plain words.

- [ ] **Does each important page have its own page title and meta description?** (medium, 2 points)
  - Why it matters: The title and description are short summaries of the page. Search tools of all kinds read them.
  - How to do it: Write a unique title (about 60 characters) and description (about 150 characters) for your home, services, pricing and about pages.

- [ ] **Can your important pages be read without logging in, closing big popups, or waiting for heavy scripts to show the text?** (medium, 2 points)
  - Why it matters: Some crawlers do not log in, click popups or run every script. If your text only appears after that, they may see an empty page.
  - How to do it: Open your pages in a private window with scripts slowed down. Make sure the main text is in the page itself and is not hidden behind a login or a wall.

- [ ] **Do your pages load fast and work well on a phone?** (low, 1 points)
  - Why it matters: Slow or broken pages are a bad experience for people and can be harder for crawlers to read in full.
  - How to do it: Test your main pages on your phone. Shrink big images and remove scripts you do not need.

- [ ] **Do you have a sitemap.xml that lists your important pages?** (low, 1 points)
  - Why it matters: A sitemap is a simple list of your pages, so crawlers can find all of them, including new ones.
  - How to do it: Most website builders make one for you at /sitemap.xml. Check it exists and add a Sitemap line to your robots.txt.

- [ ] **(Optional) Do you have an llms.txt file at the root of your site?** (low, 1 points)
  - Why it matters: llms.txt is a proposed plain text file that summarises your site for AI tools. It is optional and its effect is not proven. It is cheap to add, so it is here as a small, low weight item.
  - How to do it: If you want to try it, add a short /llms.txt with your company name, your one line description and links to your key pages. Do not spend much time on it.

## 3. Pages that answer buyer questions

Services, pricing, who it is for, proof, FAQ and fair comparisons. 7 items, 15 points.

- [ ] **Do you have a page for each main service that says what it is, who it is for and what is included?** (high, 3 points)
  - Why it matters: Buyers ask AI tools for a specific service. A page that answers exactly that question is much easier to match than one page that lists everything.
  - How to do it: Make one page per main service: what it does, who it is for, what is included, how long it takes and what the buyer gets.

- [ ] **Do you have a pricing page, or a page that explains how your pricing works?** (high, 3 points)
  - Why it matters: "How much does it cost" is one of the first questions buyers ask. If your site never answers it, other sites will answer it for you.
  - How to do it: Show your prices, or a starting price, or explain what changes the price (volume, setup, extras). A range is better than nothing.

- [ ] **Do you have case studies with real results you are allowed to share?** (high, 3 points)
  - Why it matters: Specific, real results are the kind of proof that helps a buyer choose you over a long list of names.
  - How to do it: Write up 2 or 3 real projects: the problem, what you built, the result with real numbers. Get the client's permission first, or remove the client's name.

- [ ] **Does your site say clearly who you are for, and who you are not for?** (medium, 2 points)
  - Why it matters: Buyers often ask for help that fits their size, industry or budget. Saying who you serve makes that match clear.
  - How to do it: Add a short "Who this is for" part to your home or services page: industry, company size, and when you are not a good fit.

- [ ] **Do you have an FAQ page that answers real buyer questions in plain words?** (medium, 2 points)
  - Why it matters: Buyers ask AI tools questions. A page of real questions with short, direct answers matches the way they ask.
  - How to do it: Collect the questions buyers ask on sales calls and in emails. Answer each in 2 to 4 plain sentences on one FAQ page.

- [ ] **Do you explain how working with you works, step by step, with rough timelines?** (low, 1 points)
  - Why it matters: "What happens after I sign" is a common buyer question. A clear process page answers it and builds trust.
  - How to do it: Write your process as 3 to 6 steps, with what happens in each step and about how long it takes.

- [ ] **Do you have comparison pages that are fair and true (for example your service compared with hiring in house)?** (low, 1 points)
  - Why it matters: Buyers ask AI tools to compare options. A fair comparison page gives them a clear answer from you, as long as it is honest.
  - How to do it: Write 1 or 2 fair comparisons: you versus doing it in house, or versus a common alternative. Be accurate about the other option and say when it is the better choice.

## 4. Third party presence

What other sites say about you, not only your own site. 5 items, 11 points.

- [ ] **Is your LinkedIn company page complete, with the same name and one line description as your website?** (high, 3 points)
  - Why it matters: LinkedIn is one of the main places people and tools look for facts about a B2B company.
  - How to do it: Fill in every field of your LinkedIn company page: name, tagline, about, website, industry, size, location. Post now and then.

- [ ] **Are you listed on the directories and review sites that fit your niche?** (high, 3 points)
  - Why it matters: AI answers often draw on third party sites, not only your own. Being listed where buyers in your niche compare options gives tools more places to find you.
  - How to do it: Pick the ones that fit: G2 or Capterra for software, Clutch for agencies, Google Business Profile for local businesses, plus any directory your niche uses. Fill each profile in full.

- [ ] **Are you listed on partner pages, for example the partner directory of a tool you build with?** (medium, 2 points)
  - Why it matters: A listing on a well known partner page is a trusted outside source that says what you do.
  - How to do it: Check the partner or expert directories of the tools you use most. Apply where you qualify and keep the listing up to date.

- [ ] **Have you appeared in podcasts, guest articles or interviews in your niche?** (medium, 2 points)
  - Why it matters: Mentions on other people's sites and shows spread your name and your story beyond your own website.
  - How to do it: Pitch 2 or 3 niche podcasts or blogs a month with one useful story. Ask them to link to your site and use your exact company name.

- [ ] **Do you give helpful answers in communities your buyers read (forums, Reddit, Slack groups), under your real name and without spam?** (low, 1 points)
  - Why it matters: Community answers are public text about your topic. Helpful answers build your name over time. Spam does the opposite.
  - How to do it: Answer real questions in 1 or 2 communities each week. Help first. Mention your company only when it truly fits the question.

## 5. Proof and freshness

Dates, updates, real reviews and real people. 5 items, 10 points.

- [ ] **Do you have real reviews from real clients on third party sites?** (high, 3 points)
  - Why it matters: Reviews on outside sites are proof that other people trust you. Buyers look for them, and so does anyone comparing options.
  - How to do it: After each good project, ask the client for a short review on the site that fits your niche. Never write fake reviews or pay for them.

- [ ] **Do your articles and key pages show the date they were published or last updated?** (medium, 2 points)
  - Why it matters: A date tells readers and tools that the information is current, which matters a lot in a fast moving field like AI.
  - How to do it: Show a "Last updated" date on your articles, pricing page and service pages.

- [ ] **Have you reviewed your services, pricing and about pages in the last 6 months?** (medium, 2 points)
  - Why it matters: Old facts (old prices, old services, old team) confuse buyers and give tools the wrong picture of you.
  - How to do it: Put a reminder in your calendar every 3 months to read your key pages and fix anything that changed.

- [ ] **Does your site name the founders or team, with links to their real profiles?** (medium, 2 points)
  - Why it matters: Real, named people with real profiles make a company easier to trust and easier to describe.
  - How to do it: Add names, photos, a short bio and a LinkedIn link for the founders or key team on your About page.

- [ ] **Do your claims and numbers match everywhere (website, LinkedIn, decks, directories)?** (low, 1 points)
  - Why it matters: If one site says 50 clients and another says 200, nobody knows which one is true, and the claim loses its value.
  - How to do it: Make a short list of your key facts and numbers. Check that every profile and page uses the same, current ones.

## 6. Content in the words buyers use

Write the way buyers ask questions in AI chats. 4 items, 8 points.

- [ ] **Do you have pages or sections for specific use cases, like "AI SDR for B2B SaaS" or "voice agent for dental clinics"?** (high, 3 points)
  - Why it matters: People ask AI tools very specific questions. A page for a specific use case matches a specific question much better than a general page.
  - How to do it: List the 3 to 5 use cases you sell most. Give each one its own page or section with the problem, what you build and a real example.

- [ ] **Are some of your headings written as the questions buyers really ask?** (medium, 2 points)
  - Why it matters: A heading like "How long does it take to set up an AI SDR?" matches the way people type into AI chats.
  - How to do it: Turn some headings on your service pages and FAQ into real questions, then answer each one in the first sentence below it.

- [ ] **Where it matters, do you mention your niche and the places you serve (city, region or country)?** (medium, 2 points)
  - Why it matters: Many buyer questions include a place or an industry, like "in Austin" or "for law firms". If your pages never say it, it is hard to match you.
  - How to do it: Name the industries and the places you serve on your home and service pages. Only list places you really serve.

- [ ] **Do you use the words your buyers use, not only your own inside words?** (low, 1 points)
  - Why it matters: If buyers say "book more sales calls" and your site only says "pipeline orchestration", the match is weaker.
  - How to do it: Write down the exact words buyers use on sales calls and in emails. Use those words on your pages.

## 7. Measure

Check real buyer prompts every month and fix the gaps. 4 items, 10 points.

- [ ] **Do you have a list of 10 to 20 real questions your buyers might ask an AI tool?** (high, 3 points)
  - Why it matters: You cannot see what you do not check. A fixed list of buyer prompts shows you where you appear and where you do not.
  - How to do it: Use the prompt library in this kit. Pick 10 to 20 prompts that fit your niche and edit them into the words your buyers use.

- [ ] **Do you check those prompts every month on the main AI platforms and write down the results?** (high, 3 points)
  - Why it matters: AI answers change often. A monthly check shows whether your fixes are helping, instead of guessing.
  - How to do it: Once a month, ask each prompt on ChatGPT, Perplexity, Gemini, Claude and Google AI Overviews. Record in the tracker if you were named, your position and who else was named.

- [ ] **Do you note which competitors are named, and look at what their pages have that yours do not?** (medium, 2 points)
  - Why it matters: The companies that get named show you what kind of pages, proof and listings exist in your niche.
  - How to do it: In the tracker, write down who else is named. Look at the top 3 names: their pages, reviews and directory listings. Note what you are missing.

- [ ] **Do you turn each gap into one fix and check again next month?** (medium, 2 points)
  - Why it matters: Checking only helps if it leads to action. Small fixes, checked every month, add up.
  - How to do it: After each monthly check, pick the top 1 to 3 fixes from this checklist, do them, and compare next month's results.

## Your score

| | Points |
| --- | --- |
| Points earned (Yes) | |
| Points possible (all items except Not relevant) | |
| Visibility score (earned / possible x 100) | % |
