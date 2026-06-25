# Block field reference

Exact shapes of the `pageBuilder` blocks you construct. Only `_type` is shown as
literal; you supply `_key` is optional (the script fills missing ones). Fields
marked **required** must be present or the draft will be invalid in Studio.

## Conventions

- **Portable Text** (`richHeading`, `richText`, etc.) is an array of block
  objects. Minimal paragraph:
  ```json
  [{ "_type": "block", "style": "normal",
     "children": [{ "_type": "span", "text": "Hello", "marks": [] }] }]
  ```
  Styles: `normal | h2 | h3 | h4 | blockquote`. Decorator marks: `strong`, `em`,
  `code`. `richHeading` uses only blocks + decorators (no images/quotes/buttons).
- **Button** object:
  ```json
  { "_type": "button", "text": "Save my seat", "variant": "default",
    "url": { "type": "external", "external": "https://…", "openInNewTab": true } }
  ```
  `variant`: default | secondary | accent | outline | link.
  `url.type`: internal (needs a page reference) | external (full URL) | anchor.
  Prefer `external` URLs from the content doc; use `anchor` (e.g. `#register`) to
  jump to the form on the same page.
- **Reference** (speaker, form): `{ "_type": "reference", "_ref": "<docId>" }`.
  Only use a `_ref` you actually resolved via a query. Otherwise omit + add TODO.
- **Image**: `{ "_type": "image", "asset": { "_type": "reference", "_ref": "image-…" } }`.
  Don't fabricate asset ids. If you have a usable image URL, upload it first with
  `sanity.mjs upload-asset <url> [alt]` and use the printed `image-…` id (see
  SKILL "Images"). Only omit + TODO an image when no URL exists.

## hero
```json
{ "_type": "hero",
  "eyebrow": "string?",
  "richHeading": "PortableText?",
  "description": "string?",
  "buttons": "Button[]?",
  "minHeight": "number?" }
```

## eventDetails  (in-person/hybrid event facts)
```json
{ "_type": "eventDetails",
  "eyebrow": "string?",
  "richHeading": "PortableText?",
  "startsAt": "ISO datetime (required)",
  "endsAt": "ISO datetime?",
  "timezone": "e.g. CET",
  "venueName": "string?",
  "venueAddress": "multi-line string?",
  "agenda": [ { "time": "09:00", "title": "string (required)", "description": "string?" } ],
  "speakers": "reference[]? to person docs",
  "buttons": "Button[]?" }
```

## eventDates  (one or more session instances / cities)
```json
{ "_type": "eventDates",
  "eyebrow": "string?", "richHeading": "PortableText?", "description": "string?",
  "instances": [ {
    "city": "string (required)", "country": "string?", "venueName": "string?",
    "startsAt": "ISO datetime (required)", "endsAt": "ISO datetime?",
    "timezoneLabel": "string?",
    "status": "upcoming | soldOut | closed",
    "cta": "Button?" } ] }
```

## eventMap
```json
{ "_type": "eventMap",
  "eyebrow": "string?", "richHeading": "PortableText?",
  "venueName": "string (required)", "venueAddress": "string (required)",
  "lat": "number?", "lng": "number?", "mapZoom": "number? default 14",
  "directionsUrl": "url?" }
```

## webinarRegistration  (online talk + form) — SELF-CONTAINED, IT IS THE HERO
**Do not put a `hero` or an overview `richTextContent` in front of this.** It
already renders eyebrow + title + subtitle + schedule + takeaways + speakers +
form as the top of the page. Lead the page with it. Put the document's "What
you'll learn" bullets in `learnItems`, not in a separate prose block.
```json
{ "_type": "webinarRegistration",
  "eyebrow": "string?", "richHeading": "PortableText?", "subtitle": "string?",
  "startsAt": "ISO datetime (required)", "endsAt": "ISO datetime?",
  "timezone": "e.g. CET",
  "format": "online | hybrid | inPerson",
  "joinNote": "e.g. Live on Zoom · recording sent",
  "learnTitle": "default: What you'll learn",
  "learnItems": [ { "title": "string (required)", "description": "string?" } ],
  "speakers": "reference[]? to person docs",
  "form": "reference (required) to a form doc",
  "formHeading": "default: Save your seat",
  "trustNote": "string?" }
```
Note: `form` is required. If you can't resolve a form `_ref`, build the page but
flag a TODO — the editor links the form in Studio before publishing.

## cards  (flexible card grid / showcase)
```json
{ "_type": "cards",
  "variant": "default|outlined|tile|expandable|kinetic|showcase|bento|proof|industry|snap|reveal|decoIndex|team",
  "showHeader": true,
  "eyebrow": "string?", "richHeading": "PortableText?", "description": "string?",
  "alignment": "left | center", "columns": "2-4",
  "cards": [ {
    "title": "string (required)", "description": "string?",
    "mediaType": "image | icon | rive | video | codeBlock | none",
    "icon": "lucide-icon name (when mediaType=icon)",
    "image": "Image (when mediaType=image)",
    "url": "CustomUrl?" } ] }
```
Good for "speakers" lists (`team` variant) and feature/benefit grids.

## richTextContent  (long-form body copy)
```json
{ "_type": "richTextContent",
  "label": "internal CMS label (required)",
  "contentAlignment": "left | center",
  "textAlignment": "left | center",
  "richText": "PortableText (required)" }
```
Use for the body of the content document, the "about GetVocal" paragraph, etc.

## Fragment-backed blocks — build the fragment, never fake it inline
Some blocks render nothing on their own: they hold a single **required reference**
to a library "fragment" document, and that fragment carries the real content.
Known ones:
- `faqAccordion` → required `faqFragment` ref (the Q&As live on a `faqFragment` doc)
- `statsBlock` → required `stats` ref (the value/label pairs live on a `stats` doc)

For these you MUST follow the proper process: **look up an existing fragment doc
(query `*[_type=="faqFragment"]` / `*[_type=="stats"]`) and reference it, or create
the fragment doc and reference it by id.** Do NOT substitute an inline imitation
(e.g. dumping FAQs into a `richTextContent`, or faking a stat strip with `cards`) —
that was an explicit correction. If you can't or shouldn't create the fragment,
OMIT the section and flag it as a TODO rather than faking it.

Creating a fragment is a separate write from the page draft. The skill's
`sanity.mjs create-draft` only writes the page, so create the fragment with a small
`@sanity/client` `createOrReplace` (model it on
`apps/studio/scripts/migrations/seed-webinar-governed-ai.mjs`, which creates a
`person`) and reference the resulting id from the block.

## Which blocks are current is NOT in this file — run the command
This file documents block *shapes* only. **Do not treat the block names here as a
current allow-list** — they're examples and they drift. The authoritative, live
answer to "what can I place, and what replaced what" comes from:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/draft-page/scripts/sanity.mjs" blocks
```
It parses `BLOCK_COMPONENTS` (what renders) and the design-system manifest (live
verdict / status / uses / migration notes) every run, so it reflects the latest
state of the design system. Emit only `_type`s in its `placeable` list, follow
any `supersededBy` (e.g. legacy card grids → `cards`; `cta`/`hero2` → `hero`),
and never emit anything in `deprecated` or `notPlaceableTypes`. If a block you
expect isn't there, it's been killed or merged — pick the current replacement the
command points to. The same goes for any legacy block sitting in an existing
document's `pageBuilder[]`: check it against `blocks` before copying it.
