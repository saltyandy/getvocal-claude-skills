---
name: draft-page
description: >-
  Create a Sanity DRAFT page on getvocal.ai from a supplied content document —
  webinar pages, in-person/online event sign-up pages, and general landing
  pages. Use this whenever a marketer pastes (or links) the written content for
  a page and wants it assembled into a ready-to-review draft in Sanity Studio.
  The draft is never published; it returns a Studio link for a human to check.
when_to_use: >-
  Trigger when the user supplies marketing content (event details, webinar
  description, speaker bios, landing-page copy) and asks to build/create/draft a
  page, sign-up page, registration page, or landing page in Sanity.
argument-hint: "[paste the content document + say what kind of page you want]"
allowed-tools: Bash(node *)
---

# Draft a GetVocal page from a content document

You assemble a **Sanity draft** of a `page` document from content the user
supplies, then hand back a Studio link for review. You never publish.

## Hard rule: content document is required

A page is **always** built from a supplied content document. The user must
paste the content (or give a Google Drive doc you can read). If no content
document is present, **stop and ask for it** — do not invent page copy from
thin air. Facts (headlines, body, agenda, bios) come from the document; your
job is to *structure* them into blocks, not to author them.

You may still *compose* design from existing shipped pages (e.g. "use the about
section from the homepage"), but the written content for the new page comes from
the supplied document.

## Connection facts (not secret)

- Project ID: `j6rx508d`
- Dataset: `production`
- API version: `v2025-05-08`
- Studio: `https://getvocal.sanity.studio`
- Write token: read from env `SANITY_API_WRITE_TOKEN` by the script. Never print
  it, never hardcode it. If the script reports the token is missing, tell the
  user it must be set in their Claude Code env (managed settings on enterprise).

## Required top-level page fields (the schema enforces these)

The `page` document (`apps/studio/schemaTypes/documents/page.ts`) makes these
**required** — a draft missing them is invalid and can't be published:
- `title` (string)
- `slug.current` — leading-slash path, kebab-case, unique (e.g. `/webinar-foo`).
  Reserved prefixes `/blog` and `/customers` are rejected. The script warns if the
  slug already exists.
- `pageType` — one of the enum values below. **Pick the right one:**

  | value      | label               | use for                                   |
  |------------|---------------------|-------------------------------------------|
  | `leadgen`  | Lead Gen            | **webinars**, gated/CTA-led landing pages |
  | `abm`      | ABM / Events        | **in-person / hybrid events**             |
  | `core`     | Core Page           | general marketing/content landing pages   |
  | `industry` | Industry            | industry-vertical pages                   |
  | `solution` | Solution            | solution/product pages                    |
  | `legal`    | Legal & Compliance  | legal / policy pages                      |
  | `tests`    | Tests               | throwaway test pages                      |

`description` (SEO meta) is not strictly required but Studio warns outside
**140–160 characters** — aim for that range, not just "under 160".

## Block selection — read this before you assemble anything

The reference files describe block *shapes*, but the **codebase is the source of
truth** for which blocks are real, current, and how they're actually composed.
This set changes as the design system evolves, so **never trust a hardcoded block
list (including the example names in these reference files) — always pull the live
list first.** Five rules:

1. **Get the live block list before choosing anything — run the `blocks` command.**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/draft-page/scripts/sanity.mjs" blocks
   ```
   It parses the codebase at runtime (the manifest `BLOCKS[]` +
   `BLOCK_COMPONENTS`) and returns the **current** truth — so it's always right,
   even right after the design system is changed. Read its `legend`, then:
   - Emit a `_type` ONLY from the `placeable` list (those render — anything else
     is an error card). `notPlaceableTypes` are v2-only explorations with no
     schema; `deprecated` are killed. Never emit from either.
   - If a placeable row has **`supersededBy`**, emit that replacement instead
     (e.g. `mediaCards`/`calloutCards`/`industryCards` → `cards`; `cta`/`hero2` →
     `hero`). A row with no `supersededBy` — even one marked `v2Status: "merged"`,
     like `hero` — is still the live placeable option; use it.
   - Prefer higher `uses` (proven) and read each row's `notes` (it often names the
     right variant, e.g. which `cards` variant to use).

2. **Treat the `blocks` output, not your memory, as the catalog.** The reference
   files name specific blocks as *illustrations*; the command is authoritative. If
   a block you remember isn't in `placeable`, it's gone — pick the nearest current
   one from the list. If the document/page references a block in `registryOnly`
   (renders but not yet catalogued in the manifest), it's usable but unproven —
   use it only if it clearly fits.

3. **Don't blindly copy a document's `pageBuilder[]`.** A doc's array can be a
   legacy layout that no longer matches what the live page renders. The homepage
   (`/`) is the worst offender: `app/page.tsx` is a hardcoded v2 tree fed by
   `queryHomePageV2Data` — it does NOT render `homePage.pageBuilder[]`. So
   `homePage.pageBuilder` is stale junk; never source sections from it. To
   replicate a section you saw on a live page, find how that route actually
   renders it (route file → component → block `_type`) and reuse the **current**
   block, not whatever old array is sitting in the document.

4. **Respect self-contained blocks — never wrap them.** Some blocks already own
   their eyebrow + heading + subtitle (their own hero) and their full content.
   Do NOT prepend a `hero` or duplicate their copy in a `richTextContent` in
   front of them. The clearest case: `webinarRegistration` is the page's hero +
   schedule + takeaways + speakers + form in one block — lead with it, don't
   stack a hero and an overview on top. Same for `eventDetails`, `assetPreview`,
   `assetDelivery`. Don't reach for bare `hero` blocks as generic section
   headers; use a purpose-built block (e.g. `featureWithMedia`, `cards`).

5. **Break up walls of text — don't dump prose into one `richTextContent`.**
   A multi-paragraph slab (e.g. an "Overview") rendered as a single
   `richTextContent` reads as a grey wall and looks unfinished. Before emitting a
   long prose block, mine it for structure the document already contains and
   render that visually instead:
   - **Numbers/metrics in the copy** (e.g. "300,000 interactions", "8 minutes",
     "€2.4M annual") → a `statsBlock` (fragment-backed — create a `stats` doc with
     value/label pairs and reference it; see "Fragment-backed blocks"). A 3-stat
     strip beats burying the figures in a sentence.
   - **A punchy framing line / thesis** → put it in the **next block's own
     eyebrow + heading + description** fields (most current blocks carry these).
     Don't add a standalone opener block and don't make it paragraph one of a text
     block. (Confirm the right approach against the live `blocks` output — a
     dedicated "opener" block may be deprecated.)
   - **A list of points / benefits / steps** → `cards` (a variant) or
     `featureColumnsBlock`, one card per point.
   - Keep at most a short lead-in or closing paragraph as actual `richTextContent`.
   Faithfulness rule still holds: only restructure copy/numbers that are **in the
   document** — restructuring is fine, inventing stats or claims is not.

## Workflow

Follow these steps in order.

### 0. Pull the live block list (do this first, every time)
Before assembling, get the current catalog — don't rely on memory or the example
names in the reference files, which drift as the design system changes:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/draft-page/scripts/sanity.mjs" blocks
```
It returns what's `placeable` (with live `verdict`/`v2Status`/`uses`/`notes`/
`supersededBy`), what's `deprecated`, and what's `registryOnly`. Choose blocks
from `placeable` per the Block selection rules. The command works **with or
without** the website repo: it sources the catalog from the local checkout if
present, otherwise a published catalog URL, otherwise a snapshot bundled with the
skill — check the `origin` field to see which (a `bundled` origin may lag the live
site). You never need to read the source files yourself.

If the user references a section on an existing page ("the compliance section
from the homepage"), trace how that page renders it in code rather than copying a
stale `pageBuilder[]`. If a near-identical page already exists (e.g. another
webinar), query it for the *current* shape of the key blocks and reuse those —
that's the best source for proven field values.

### 1. Ingest the content document
Read the supplied content. If it's a Google Drive link and the Drive tools are
available, fetch it; otherwise use the pasted text. Identify: page intent, title,
key copy, any event/webinar facts (dates, venue, speakers), and CTAs.

### 1b. Ask for missing page-level essentials (don't guess, don't silently TODO)
A few fields shape the whole page and the editor will notice if they're wrong:
the **page title**, the **SEO meta description** (`description`, target 140–160
chars), and the **slug**. If the document does NOT make one of these explicit,
**ask the user a quick question** rather than inventing it or leaving a `TODO:`
they have to hunt for. Use the AskUserQuestion tool with concrete suggested
options drawn from the document (e.g. propose 2–3 title phrasings, or a generated
meta description for them to approve/tweak). This is the one place a short
question is worth it — title/SEO are high-leverage and a marketer has an instant
opinion. Everything else still follows "build directly" (Step 4). Don't batch
this into a block-list approval; ask only about the missing essential(s), then
proceed.

`pageType` does NOT need a question — infer it from the archetype (webinar →
`leadgen`, event → `abm`, landing → `core`/`leadgen`; see the table above).

### 2. Classify the page type
Pick the closest archetype from `reference/page-types.md`:
- **webinar** — online talk + registration form
- **event** — in-person / hybrid event with venue + sign-up
- **landing** — general marketing/lead-gen page
Load that archetype's recommended block sequence.

### 3. Assemble the pageBuilder blocks
Build the block array using `reference/blocks.md` for the exact field shapes.
- Fill every field you can from the content document.
- If the user asked to pull a section from an existing page, query it (see
  "Reading existing pages") and copy that block, then replace its copy with the
  user's content unless they said to keep it verbatim.
- For any required fact the document does NOT provide (event date, venue
  address, ticket/registration URL), do NOT guess. Insert a clearly marked
  `TODO:` in the relevant text field, and collect these into a list to show
  the user.

#### Resolving references (speakers, forms, fragments) — try before you TODO
Reference fields (`person`, `form`, `faqFragment`, `stats`) need a real document
`_ref`. Don't fabricate one — but don't reflexively TODO it either. **First query
for an existing doc by the name in the content document**, and only TODO if you
can't resolve or create it:
```bash
# speaker → person doc
node "${CLAUDE_PLUGIN_ROOT}/skills/draft-page/scripts/sanity.mjs" query \
  '*[_type=="person" && name match "Jane*"]{_id, name, role}'
# the sign-up form (list a few, pick the right one by title)
node "${CLAUDE_PLUGIN_ROOT}/skills/draft-page/scripts/sanity.mjs" query \
  '*[_type=="form"]{_id, title}'
```
If you find the doc, use its `_id` as the `_ref`. For a **form/faqFragment/stats**
you can't resolve, omit it and add a TODO (these are wired in Studio). For a
**speaker with no `person` doc yet**, create one — see below. Never invent a `_ref`.

#### Speakers & images — wire dropped photos straight into Sanity
The marketer can just drop a photo into the chat (which gives you a local file
path) or paste an image URL. Don't TODO it — turn it into a real asset, and for a
new speaker, into a real `person`:

1. **Upload the image** (works for a local path *or* a URL):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/draft-page/scripts/sanity.mjs" \
     upload-asset "/Users/andy/Desktop/GV Photos/jane.jpg" "Jane Doe headshot"
   ```
   It prints an `image-…` asset id. (Speaker photos often live in the
   `GV Photos` working directory.) Use that id as an image `asset._ref`, or:
2. **Create the speaker** (only if no `person` doc already matched the query
   above). Write a small JSON and run `create-person`:
   ```bash
   # /tmp/person.json:
   # { "name": "Jane Doe", "role": "VP Sales", "bio": "…",
   #   "image": "image-…", "linkedIn": "https://…" }
   node "${CLAUDE_PLUGIN_ROOT}/skills/draft-page/scripts/sanity.mjs" \
     create-person /tmp/person.json
   ```
   It writes a **draft** `person` and prints the id to drop into the block's
   `speakers` array as `{ "_type": "reference", "_ref": "<id>" }`. (It's a draft;
   Studio offers to publish it alongside the page.) `name` is required; `role`,
   `bio`, `image`, and socials are filled from whatever the marketer gave you.

Only fall back to a TODO when there's genuinely no photo/URL and no existing doc —
never fabricate an `image-…` or person `_ref`.

### 4. Build directly — do NOT show a planned outline first
The user is a **marketer**, not an engineer. A block-by-block outline of the
planned page (`Hero → Event details → …`) means nothing to them and just adds a
confirmation round-trip. **Skip it.** Once you've assembled the blocks (Step 3),
go straight to writing the draft. The draft is never published and is fully
editable in Studio, so there's no risk in building it without a pre-confirmation.
The review happens in Studio, on the real page, not in chat.

(Exception: if the page type itself is genuinely ambiguous — e.g. you can't tell
whether it's a webinar or an in-person event — ask that one targeted question
before building. Never ask the user to approve a block list.)

### 5. Write the draft
Write the full page JSON to a temp file, then run the script:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/draft-page/scripts/sanity.mjs" create-draft /tmp/draft-page.json
```

The page JSON shape:
```json
{
  "_type": "page",
  "title": "…",
  "slug": { "_type": "slug", "current": "/your-slug" },
  "pageType": "leadgen",
  "description": "140–160 char meta description",
  "pageBuilder": [ { "_type": "webinarRegistration", ... }, ... ]
}
```
`pageType` must be one of the enum values (see "Required top-level page fields" —
webinar→`leadgen`, event→`abm`, landing→`core`/`leadgen`). You do NOT need to add
`_id` or `_key` values — the script generates the draft id and fills any missing
`_key`s recursively. Choose a sensible kebab-case slug under the right prefix
(e.g. `/webinar-…`, `/event-…`). If the slug already exists the script warns you;
pick another before the user publishes.

### 6. Hand it back (lead with the visual preview)
The script prints two links: a **👁 Preview** link (Presentation mode — the draft
rendered as the real page, click-to-edit) and an **✏️ Edit** link (the field
editor). Give the marketer a short, non-technical handback:
1. The **Preview link first** — that's what they want to look at.
2. A one-line summary of what you built (page type + headline sections in plain
   words, e.g. "registration page with the agenda, three speakers, and the form").
3. A short **TODO checklist** of anything you couldn't fill (unresolved form,
   missing date, image you didn't have) — each as a concrete "you'll need to add
   X in Studio" line, not raw field names.
4. The reminder: it's a **draft**, nothing is live until they publish from Studio.

Do not dump the JSON, the draft id, or block `_type`s at them — those mean
nothing to a marketer.

## Reading existing pages (for composition)
To pull a section from a shipped page, query first:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/draft-page/scripts/sanity.mjs" query \
  '*[_type == "page" && slug.current == "/agent-builder"][0]{title, pageBuilder}'
```
Copy the block object(s) you need into the new page's `pageBuilder`. The script
strips/regenerates `_key`s on write, so you can copy verbatim.

⚠️ Before copying, check the block's `_type` against the live `blocks` output
(Step 0): it must be in `placeable`, and if it has a `supersededBy`, swap to that
replacement. A live-looking page can still carry a legacy/merged block in its
array. Query a page that is genuinely current for the archetype you need — and
never source homepage sections from `homePage.pageBuilder` (it's the stale legacy
array; the live `/` is a hardcoded v2 tree, see Block selection §3).

## References
- `reference/blocks.md` — exact field shape of every block you'll construct
  (shapes only — currency comes from the `blocks` command, not the names there)
- `reference/page-types.md` — archetype block sequences + required-fact checklists
- The `blocks` command — the live, authoritative list of placeable blocks; run it
  first and whenever you're unsure whether a block is current.
