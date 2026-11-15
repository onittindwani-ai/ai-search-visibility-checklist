# Design notes for the app

Why the app looks and moves the way it does. Builder notes, kept next to the code so the next change stays in the same style.
This kit uses the same design system as the AI Agent Profitability Calculator, so the free kits feel like one family: the same
tokens, glass cards, type pairing, buttons with a processing state and a success tick, toasts, count ups and ring gauges.

## The feeling we want

A calm, warm audit desk. Like a good printed checklist on thick paper, with one clear number at the top. The checklist is long (39
items), so the page has to stay quiet: lots of space, one accent colour, and progress you can feel (ticks drawing in, rings filling,
bars growing) so working through it is satisfying instead of tiring.

## Palette (60, 30, 10)

| Role | Share | Colours | Used for |
| --- | --- | --- | --- |
| Warm neutrals | 60 | cream `#F4EEE4`, oat `#EAE0D0`, sand `#DDCDB5`, glass fill `rgba(255,251,245,0.6)` | page, cards, inputs, items |
| Coffee browns | 30 | espresso `#2A1C14`, mocha `#5B4031`, muted `#735A48`, latte `#9C7B60` | text, borders, primary buttons, the active tab, competitor bars |
| Accent | 10 | deep teal `#2D6A62` (soft `#6FA096` for bar ends) | Yes answers, green status, your own share of AI answers, focus rings |
| Warning | small | terracotta `#A9502B` | No answers, amber status |
| Alarm | tiny | red `#B42318` | red status only |

Colour theory behind it:

- The creams and browns sit on one warm hue family (orange, about 25 to 35 degrees) at different lightness, which reads as calm
  and expensive. Many hues would make a 39 item list feel noisy.
- Teal is the complement of the brown orange family, so a little of it pops without being bright. It carries one meaning in this
  app: "you" and "done". Yes ticks are teal, your share of answers is teal, your row in the competitor list is teal, and every
  competitor is brown. So the eye finds your business at once.
- Terracotta is an analogous warm colour, so "No" and "amber" feel like a nudge that still belongs to the palette. True red is held
  back for a red score only.
- Latte is decoration only (bar fills, the Not sure dashed ring). It does not reach 4.5 to 1 on cream, so it never carries small
  text.

Contrast (WCAG AA): espresso on cream 14.3, mocha on cream 8.2, muted on cream 5.5, teal on cream 5.4, terracotta on glass 5.0,
red on cream 5.7, cream on espresso 14.3, white on teal 6.1. Every text pair is 4.5 to 1 or more.

## Type

Two typefaces, both from the system, so the app works offline:

- Serif for headings, questions and big numbers: Iowan Old Style, then Palatino, Book Antiqua, Georgia. Checklist questions are set
  in the serif so the list reads like a document, not a form. Numbers use lining, tabular figures so counting numbers do not wobble.
- Sans for everything you click: the system UI font (San Francisco, Segoe UI, Roboto).

Scale: 11, 12, 13, 14, 16, 18, 22, 32, 38 px. Labels are small caps style (11.5 px, letter spacing 0.09em) in muted brown.

## Spacing and shape

- 4 px base: 4, 8, 12, 16, 20, 24, 32, 40, 56, 72.
- Radius: 10 inputs, 999 pills, tabs and buttons, 14 to 16 items and rows, 20 cards, 28 large panels.
- Glass: blur 22 px with saturation 140 percent, a translucent warm fill, a hairline brown border at 10 percent, a white inner top
  highlight and three soft shadows (1 px, 10 px, 28 px).
- Background: cream with three large blurred shapes (latte, sand, a little teal) drifting very slowly (48 to 70 s) and a light grain.

## Motion tokens

| Token | Value | Used for |
| --- | --- | --- |
| `--t-fast` | 140 ms | hover colour, press |
| `--t-base` | 240 ms | lift, focus, answer pills |
| `--t-slow` | 480 ms | section and "why and how" open, tab pill slide, toasts, the tick drawing in |
| `--t-count` | 650 ms | numbers counting, rings and bars filling |
| `--ease-out` | cubic-bezier(0.22, 1, 0.36, 1) | almost everything |
| `--ease-spring` | cubic-bezier(0.34, 1.56, 0.64, 1) | ticks, toasts, small pops |

`prefers-reduced-motion: reduce` turns off the drifting shapes, the counting, the chart drawing and the processing delay; changes
still show at once.

## Interactions

1. Buttons and cards lift 1 to 2 px on hover, scale to 0.97 on press, and show a soft glow where you clicked.
2. Every button that does something (export, print, save results, add prompt, save details, start my own) shows a spinner and a
   light shimmer for about half a second, then a tick that draws itself, then settles. Clicking again while busy does nothing.
3. Answering an item: the pill slides to your choice, the round mark on the left turns teal and draws a tick for Yes, gets a
   terracotta ring for No and a dashed ring for Not sure. The score ring, section ring, points, answered bar and top fixes update at
   once with count ups.
4. Clicking a top fix opens its section, scrolls to the item and pulses a teal halo around it.
5. The two tabs are a segmented control with an espresso pill that slides between them (arrow keys work).
6. The share chart draws its line from left to right, then the dots and labels fade in. Bars grow from zero.
7. Recording results: Named turns the row a faint teal, Not named disables the position field. A position that is not a whole
   number turns the field terracotta with a small shake and the last good value is kept.
8. Toasts confirm export, print, save, import, add, remove and start over. Removing a prompt, deleting a date, importing, loading
   the sample and starting over all offer Undo.
9. The privacy note in the top bar turns terracotta if the browser blocks saving.
