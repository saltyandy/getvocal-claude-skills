# Page archetypes

Pick the closest archetype, then adapt to what the content document actually
contains. Each lists a recommended block sequence and the facts that, if missing
from the document, must become visible `TODO:` markers (never guesses).

## webinar
Online talk with a registration form.

**`webinarRegistration` is self-contained — it IS the hero.** It already renders
the eyebrow, title (`richHeading`), subtitle, date/time/format, the "What you'll
learn" takeaways, speaker cards, and the sign-up form. So **lead with it** — do
NOT precede it with a separate `hero` or restate the same copy in a
`richTextContent` overview (that's duplication and was a real mistake).

Block sequence:
1. `webinarRegistration` — the whole top of the page: eyebrow, title, subtitle,
   schedule, `learnItems` (put the doc's "What you'll learn" here, not in prose),
   `speakers`, `form`. This is the conversion block AND the hero.
2. *(optional)* supporting sections BELOW the fold, only if the document has
   content for them and a current block fits — e.g. a speaker bio via
   `featureWithMedia`, social proof via `caseStudies`, FAQs via `faqAccordion`,
   a platform stat strip via `statsBlock`. `faqAccordion` and `statsBlock` are
   **fragment-backed** — build/reference the `faqFragment` / `stats` doc the
   proper way; never fake them inline (see blocks.md "Fragment-backed blocks").
   Pull "what GetVocal does" / compliance from a current source (see Block
   selection §3), never from `homePage.pageBuilder`.

Note: the registration `<section>` has no `#register` anchor id and `customUrl`
has no anchor type, so an anchor CTA can't link to it yet (1-line component
change needed). Since the block leads the page, a hero CTA is unnecessary anyway.

Required facts → TODO if absent:
- `startsAt` (date + time + timezone) — required field
- `form` reference (the HubSpot/Sanity form to link) — required field
- speaker references (query existing `person` docs first) or names + bios

`pageType`: `leadgen`. Slug prefix: `/webinar-…`.

## event
In-person or hybrid event with a venue and sign-up.

Block sequence:
1. `hero` — eyebrow ("Event" / city), title, date+city line, anchor → `#register`
2. `eventDetails` — date/time, venue, agenda, speakers
3. `richTextContent` — about the event / why attend (from the document)
4. `eventMap` — venue location (if an address is supplied)
5. `webinarRegistration` (`format: inPerson`) OR `formBlock` — sign-up

Required facts → TODO if absent:
- `startsAt` (date + time + timezone)
- `venueName` + `venueAddress`
- registration/ticket URL or a form reference
- speaker references or names + bios

`pageType`: `abm` (the "ABM / Events" type — use this for in-person/hybrid
events, not `leadgen`). Slug prefix: `/event-…`.

## landing
General marketing / lead-gen page composed from the document (and optionally
sections pulled from existing shipped pages).

Block sequence (adapt freely to the content):
1. `hero` — headline + sub + primary CTA
2. `features` / `cards` / `featureWithMedia` — the body, one block per section of
   the document
3. `caseStudies` or a `cards` `proof` variant — social proof (if provided)
4. closing call to action — `formBlock` (gated/lead capture) or a centered `hero`
   with a button. **Do NOT use the `cta` block — it's deprecated** (manifest
   verdict "Merge", folded into Hero V2 `layout=centered`).

Required facts → TODO if absent:
- primary CTA destination (URL or form)
- any stats/quotes referenced but not given

`pageType`: `core` (general) or `leadgen` (gated/CTA-led). Slug: descriptive
kebab-case.

## Composing from existing pages
When the user says "use the X section from the Y page", query page Y, copy the
matching block(s) into the new page, then replace the copy with the document's
content unless told to keep it verbatim. The "what GetVocal is / about" section
is typically best pulled from the homepage (`/`) or an industry page.
