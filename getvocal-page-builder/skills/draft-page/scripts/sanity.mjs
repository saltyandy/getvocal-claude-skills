#!/usr/bin/env node
// Self-contained Sanity helper for the draft-page skill.
//   node sanity.mjs query '<groq>'                -> prints query result JSON
//   node sanity.mjs create-draft <page.json>      -> writes a DRAFT page, prints links
//   node sanity.mjs blocks [--all]                -> live list of usable page-builder
//                                                    blocks, parsed from the codebase
//   node sanity.mjs upload-asset <urlOrPath> [alt]-> uploads an image (URL or local
//                                                    file), prints the asset _id
//   node sanity.mjs create-person <person.json>   -> writes a DRAFT person (speaker),
//                                                    prints the _id to reference
//
// Reads the write token from env SANITY_API_WRITE_TOKEN (never hardcoded).
// All connection values below are public (project id / dataset / studio host).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const PROJECT_ID = process.env.SANITY_PROJECT_ID || "j6rx508d";
const DATASET = process.env.SANITY_DATASET || "production";
const API_VERSION = "2025-05-08";
const STUDIO_HOST = process.env.SANITY_STUDIO_HOST || "getvocal.sanity.studio";
const TOKEN =
  process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_API_READ_TOKEN;

const API = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}`;

function requireToken() {
  if (!TOKEN) {
    console.error(
      "ERROR: SANITY_API_WRITE_TOKEN is not set in the environment.\n" +
        "On the enterprise account this is injected via managed settings.\n" +
        "For local testing, set it in ~/.claude/settings.json under \"env\"."
    );
    process.exit(2);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LIVE block registry — never a hardcoded list. The catalog is sourced, in
// priority order, from:
//   1. the local getvocal-ai checkout (freshest — used when you run this in-repo)
//   2. a published catalog URL (for marketers with no repo — set on each deploy)
//   3. a bundled block-catalog.json shipped with the plugin (guaranteed fallback)
// Source-of-truth files parsed for (1) and (3):
//   apps/web/src/app/design-system/master/manifest.tsx  (BLOCKS[] — verdict/status)
//   apps/web/src/components/block-components.ts          (BLOCK_COMPONENTS — renders)
// ─────────────────────────────────────────────────────────────────────────

const REL_MANIFEST = "apps/web/src/app/design-system/master/manifest.tsx";
const REL_REGISTRY = "apps/web/src/components/block-components.ts";

// Where marketers (no local repo) fetch the catalog. The website publishes this
// JSON on each deploy, so it stays current without a skill release. Override per
// environment with GETVOCAL_BLOCK_CATALOG_URL.
const CATALOG_URL =
  process.env.GETVOCAL_BLOCK_CATALOG_URL ||
  "https://www.getvocal.ai/block-catalog.json";

// Bundled snapshot shipped inside the plugin: skills/draft-page/block-catalog.json
// (one dir up from this scripts/ folder). Always present, so the skill never dies
// even before the website route exists. Refresh it with `build-catalog`.
const BUNDLED_CATALOG = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "block-catalog.json"
);

// Walk up from a set of starting dirs until we find the monorepo root (the dir
// that contains the manifest). Honors GETVOCAL_REPO_ROOT if set.
function findRepoRoot() {
  if (process.env.GETVOCAL_REPO_ROOT) return process.env.GETVOCAL_REPO_ROOT;
  const starts = [process.cwd(), dirname(fileURLToPath(import.meta.url))];
  for (const start of starts) {
    let dir = resolve(start);
    for (let i = 0; i < 12; i++) {
      if (existsSync(join(dir, REL_MANIFEST))) return dir;
      const up = dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return null;
}

// Placeable block keys = top-level keys of the BLOCK_COMPONENTS object.
// Matches `key: SomeComponent as …`, which every entry uses.
function parseRegistry(text) {
  const start = text.indexOf("BLOCK_COMPONENTS");
  const slice = start >= 0 ? text.slice(start) : text;
  const keys = new Set();
  for (const m of slice.matchAll(/([a-zA-Z]\w*):\s*[A-Za-z]\w*\s+as\b/g)) {
    keys.add(m[1]);
  }
  return keys;
}

// Parse the scalar fields of every BLOCKS[] entry without trying to parse the
// JSX render functions. We anchor on each quoted `type: "…"` (only data entries
// have that — the interface uses `type: string`) and read the fields that sit
// before that entry's `variants:` array.
function parseManifest(text) {
  const entries = [];
  const typeMatches = [...text.matchAll(/\btype:\s*"([^"]+)"/g)];
  for (let i = 0; i < typeMatches.length; i++) {
    const startIdx = typeMatches[i].index;
    const endIdx =
      i + 1 < typeMatches.length ? typeMatches[i + 1].index : text.length;
    const win = text.slice(startIdx, endIdx);
    const get = (re) => win.match(re)?.[1];
    entries.push({
      type: typeMatches[i][1],
      title: get(/\btitle:\s*"([^"]+)"/),
      category: get(/\bcategory:\s*"([^"]+)"/),
      verdict: get(/\bverdict:\s*"([^"]+)"/),
      v2Status: get(/\bv2Status:\s*"([^"]+)"/),
      uses: Number(get(/\buses:\s*(\d+)/)) || 0,
      notes: get(/\bnotes:\s*\n?\s*"([^"]*)"/),
    });
  }
  return entries;
}

// Deliberately NO hardcoded "recommended" list and no brittle verdict heuristic.
// The only DETERMINISTIC truths are:
//   • placeable  — the _type is a key in BLOCK_COMPONENTS, so it renders (no error
//                  card) and a non-`v2:` manifest type means a Sanity schema exists.
//   • deprecated — verdict "Kill" or v2Status "killed": unambiguously dead, there
//                  is a replacement. (NOT "merged": a merged block like `hero` is
//                  still the only placeable option until its v2 schema ships, so we
//                  never auto-hide it.)
// Everything else (verdict / v2Status / uses / notes) is the manifest's *advice* —
// surfaced verbatim so you and the model judge with the CURRENT data. Edit the
// manifest and this output changes with it.
function isDeprecated(entry) {
  return entry.verdict === "Kill" || entry.v2Status === "killed";
}

const CATALOG_LEGEND =
  "placeable = renders + has a schema (safe to emit). verdict/v2Status/uses/notes are the manifest's live advice — prefer high-`uses`, read `notes`. If a row has `supersededBy`, emit THAT block instead (a current replacement exists). A 'merged' row with no `supersededBy` is still the only placeable option — keep using it. Never emit anything in `deprecated` or `notPlaceableTypes`.";

// Build the catalog object by parsing the two source files in a local checkout.
function buildCatalogFromRepo(root) {
  const manifest = parseManifest(readFileSync(join(root, REL_MANIFEST), "utf8"));
  const placeableKeys = parseRegistry(
    readFileSync(join(root, REL_REGISTRY), "utf8")
  );

  const placeable = [];
  const deprecated = [];
  const notPlaceableTypes = [];
  for (const e of manifest) {
    const canPlace = !e.type.startsWith("v2:") && placeableKeys.has(e.type);
    if (!canPlace) {
      notPlaceableTypes.push(e.type); // v2:-only explorations or no schema
      continue;
    }
    const row = {
      type: e.type,
      title: e.title,
      category: e.category,
      verdict: e.verdict,
      v2Status: e.v2Status,
      uses: e.uses,
      notes: e.notes,
    };
    // If the manifest's own notes name a migration target (e.g. "rename
    // _type=cards") and that target itself renders, surface it — the model
    // should place the replacement, not this legacy block. Driven entirely by
    // your notes, so it stays correct as you re-catalogue blocks.
    const target = e.notes?.match(/_type\s*=\s*(\w+)/)?.[1];
    if (target && target !== e.type && placeableKeys.has(target)) {
      row.supersededBy = target;
    }
    if (isDeprecated(e)) deprecated.push(row);
    else placeable.push(row);
  }
  placeable.sort((a, b) => b.uses - a.uses);

  // Brand-new blocks: in the render registry but not yet in the manifest.
  const manifestTypes = new Set(manifest.map((e) => e.type));
  const registryOnly = [...placeableKeys].filter((k) => !manifestTypes.has(k));

  return {
    legend: CATALOG_LEGEND,
    counts: {
      placeable: placeable.length,
      deprecated: deprecated.length,
      registryOnly: registryOnly.length,
    },
    placeable,
    deprecated,
    registryOnly: registryOnly.length
      ? {
          types: registryOnly,
          note: "Renders but not catalogued in the manifest yet — confirm it's intended for new pages before using.",
        }
      : undefined,
    notPlaceableTypes,
  };
}

async function fetchCatalogFromUrl(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    // Sanity-check it looks like our catalog before trusting it.
    return Array.isArray(json?.placeable) ? json : null;
  } catch {
    return null;
  }
}

function loadBundledCatalog() {
  try {
    if (existsSync(BUNDLED_CATALOG)) {
      return JSON.parse(readFileSync(BUNDLED_CATALOG, "utf8"));
    }
  } catch {
    /* fall through */
  }
  return null;
}

// Resolve the catalog from the best available source (local repo → remote URL →
// bundled snapshot) and stamp where it came from so the reader knows its freshness.
async function loadCatalog() {
  const root = findRepoRoot();
  if (root) {
    const cat = buildCatalogFromRepo(root);
    cat.origin = { source: "local-repo", repoRoot: root };
    return cat;
  }
  const remote = await fetchCatalogFromUrl(CATALOG_URL);
  if (remote) {
    remote.origin = { source: "remote", url: CATALOG_URL };
    return remote;
  }
  const bundled = loadBundledCatalog();
  if (bundled) {
    bundled.origin = {
      source: "bundled",
      note: "Snapshot shipped with the skill — may lag the live site. Refresh with `build-catalog`.",
    };
    return bundled;
  }
  console.error(
    "ERROR: could not load a block catalog from any source.\n" +
      `  • no local repo (looked for ${REL_MANIFEST})\n` +
      `  • remote ${CATALOG_URL} unreachable\n` +
      `  • no bundled ${BUNDLED_CATALOG}\n` +
      "Run `build-catalog` in the repo to regenerate the bundled snapshot."
  );
  process.exit(1);
}

async function blocks(showAll) {
  const cat = await loadCatalog();
  if (!showAll) delete cat.notPlaceableTypes;
  console.log(JSON.stringify(cat, null, 2));
}

// Regenerate the bundled snapshot from the local checkout. Run this (or have CI
// run it) whenever the design system changes meaningfully, then commit the JSON.
function buildCatalog() {
  const root = findRepoRoot();
  if (!root) {
    console.error(
      `ERROR: build-catalog needs the repo (looked for ${REL_MANIFEST}).\n` +
        "Run it inside the getvocal-ai checkout, or set GETVOCAL_REPO_ROOT."
    );
    process.exit(1);
  }
  const cat = buildCatalogFromRepo(root);
  writeFileSync(BUNDLED_CATALOG, `${JSON.stringify(cat, null, 2)}\n`);
  console.log(`✅ Wrote bundled catalog: ${BUNDLED_CATALOG}`);
  console.log(
    `   ${cat.counts.placeable} placeable · ${cat.counts.deprecated} deprecated · ${cat.counts.registryOnly} registry-only`
  );
  console.log(
    "   Commit this file so marketers (no repo) get the current list; also\n" +
      "   publish it at the catalog URL on deploy for zero-lag freshness."
  );
}

// Recursively ensure every object inside an array has a stable _key.
function ensureKeys(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const withKeys = ensureKeys(item);
      if (withKeys && typeof withKeys === "object" && !Array.isArray(withKeys)) {
        if (!withKeys._key) withKeys._key = randomUUID().slice(0, 12);
      }
      return withKeys;
    });
  }
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) value[k] = ensureKeys(value[k]);
  }
  return value;
}

async function query(groq) {
  requireToken();
  const url = `${API}/data/query/${DATASET}?query=${encodeURIComponent(groq)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    console.error(`Query failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const json = await res.json();
  console.log(JSON.stringify(json.result, null, 2));
}

// Fetch raw GROQ result (no pretty-print) for internal checks.
async function rawQuery(groq) {
  const url = `${API}/data/query/${DATASET}?query=${encodeURIComponent(groq)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) return null;
  const json = await res.json();
  return json.result;
}

async function createDraft(filePath) {
  requireToken();
  let doc = JSON.parse(readFileSync(filePath, "utf8"));

  if (doc._type !== "page") {
    console.error(`ERROR: expected _type "page", got "${doc._type}".`);
    process.exit(1);
  }

  const slug = doc.slug?.current;

  // Warn (don't block) on a slug that already exists — publishing a second page
  // on the same path will fail Studio's uniqueness validation.
  if (slug) {
    const clash = await rawQuery(
      `*[_type == "page" && slug.current == "${slug}"][0]{_id, title}`
    );
    if (clash) {
      console.error(
        `⚠️  A page already uses slug "${slug}" (${clash.title || clash._id}).\n` +
          "   The draft will still be written, but pick a different slug before\n" +
          "   publishing or Studio will reject it as a duplicate."
      );
    }
  }

  // Generate the draft id. Studio opens the document via the bare (published) id.
  const baseId = randomUUID();
  doc._id = `drafts.${baseId}`;
  doc = ensureKeys(doc);

  const res = await fetch(
    `${API}/data/mutate/${DATASET}?returnIds=true&visibility=async`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ mutations: [{ createOrReplace: doc }] }),
    }
  );

  const body = await res.json();
  if (!res.ok) {
    console.error(`Draft write failed: ${res.status} ${JSON.stringify(body)}`);
    process.exit(1);
  }

  // Two links for the editor:
  //  - editLink  opens the field editor (edit copy, link refs, publish).
  //  - viewLink  opens Presentation mode = the draft rendered as the real page.
  //    This is the link a marketer actually wants: they SEE the page, click any
  //    element to edit it, and the unpublished draft shows via preview/draftMode.
  const editLink = `https://${STUDIO_HOST}/intent/edit/id=${baseId};type=page/`;
  const viewLink = slug
    ? `https://${STUDIO_HOST}/presentation?preview=${encodeURIComponent(slug)}`
    : null;
  console.log("✅ Draft created (NOT published).");
  console.log(`   Draft id:  ${doc._id}`);
  console.log(`   Title:     ${doc.title || "(untitled)"}`);
  console.log(`   Slug:      ${slug || "(none)"}`);
  if (viewLink) console.log(`   👁  Preview the page:   ${viewLink}`);
  console.log(`   ✏️  Edit the fields:    ${editLink}`);
}

const EXT_MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
};

// Read the image bytes from either a public URL or a LOCAL file path. This is
// what lets a marketer drag a speaker photo into the chat (which pastes its
// path) and have it land in Sanity.
async function readImageSource(src) {
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src);
    if (!res.ok) {
      console.error(`Could not fetch image: ${res.status} ${src}`);
      process.exit(1);
    }
    return {
      bytes: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") || "image/jpeg",
    };
  }
  const path = src.replace(/^file:\/\//, "");
  if (!existsSync(path)) {
    console.error(`No such image file: ${path}`);
    process.exit(1);
  }
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return {
    bytes: readFileSync(path),
    contentType: EXT_MIME[ext] || "application/octet-stream",
  };
}

// Upload an image (URL or local path) and print the asset _id to reference as
//   { "_type": "image", "asset": { "_type": "reference", "_ref": "<printed id>" } }
async function uploadAsset(src, alt) {
  requireToken();
  const { bytes, contentType } = await readImageSource(src);
  const res = await fetch(`${API}/assets/images/${DATASET}`, {
    method: "POST",
    headers: { "Content-Type": contentType, Authorization: `Bearer ${TOKEN}` },
    body: bytes,
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(`Asset upload failed: ${res.status} ${JSON.stringify(body)}`);
    process.exit(1);
  }
  const assetId = body.document?._id;
  console.log("✅ Image uploaded.");
  console.log(`   Asset _id: ${assetId}`);
  if (alt) console.log(`   (suggested alt: ${alt})`);
  console.log(
    `   Reference it as: { "_type": "image", "asset": { "_type": "reference", "_ref": "${assetId}" }${alt ? `, "alt": ${JSON.stringify(alt)}` : ""} }`
  );
  return assetId;
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Create a DRAFT person (speaker). Input JSON:
//   { "name": "Jane Doe", "role": "VP Sales", "bio": "…",
//     "image": "image-…",            // an asset id from upload-asset (optional)
//     "linkedIn": "https://…" }      // optional
// Prints the bare id to use as a speaker reference:
//   { "_type": "reference", "_ref": "<printed id>" }
async function createPerson(filePath) {
  requireToken();
  const input = JSON.parse(readFileSync(filePath, "utf8"));
  if (!input.name) {
    console.error('ERROR: person requires a "name".');
    process.exit(1);
  }
  const baseId = randomUUID();
  const doc = {
    _id: `drafts.${baseId}`,
    _type: "person",
    name: input.name,
    slug: { _type: "slug", current: input.slug || slugify(input.name) },
  };
  for (const f of ["role", "bio", "linkedIn", "x", "github", "website", "email"]) {
    if (input[f]) doc[f] = input[f];
  }
  if (input.image) {
    doc.image = {
      _type: "image",
      asset: { _type: "reference", _ref: input.image },
    };
  }

  const res = await fetch(
    `${API}/data/mutate/${DATASET}?returnIds=true&visibility=async`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ mutations: [{ createOrReplace: doc }] }),
    }
  );
  const body = await res.json();
  if (!res.ok) {
    console.error(`Person write failed: ${res.status} ${JSON.stringify(body)}`);
    process.exit(1);
  }
  console.log("✅ Person draft created (NOT published).");
  console.log(`   Person id: ${baseId}`);
  console.log(`   Name:      ${doc.name}`);
  console.log(
    `   Reference it in a speakers[] array as: { "_type": "reference", "_ref": "${baseId}" }`
  );
  console.log(
    "   Note: it's a DRAFT — when the marketer publishes the page, Studio will\n" +
      "   prompt to publish this person too."
  );
}

const [cmd, arg, arg2] = process.argv.slice(2);
if (cmd === "query" && arg) await query(arg);
else if (cmd === "create-draft" && arg) await createDraft(arg);
else if (cmd === "blocks") await blocks(arg === "--all");
else if (cmd === "build-catalog") buildCatalog();
else if (cmd === "upload-asset" && arg) await uploadAsset(arg, arg2);
else if (cmd === "create-person" && arg) await createPerson(arg);
else {
  console.error(
    "Usage:\n" +
      "  node sanity.mjs query '<groq>'\n" +
      "  node sanity.mjs create-draft <page.json>\n" +
      "  node sanity.mjs blocks [--all]            (live: local repo → URL → bundled)\n" +
      "  node sanity.mjs build-catalog             (regenerate the bundled snapshot)\n" +
      "  node sanity.mjs upload-asset <imageUrlOrPath> [altText]\n" +
      "  node sanity.mjs create-person <person.json>"
  );
  process.exit(64);
}
