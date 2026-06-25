# Rollout & updates — getvocal-page-builder skill

How this skill reaches the marketing team and how it gets updated. The golden
rule: **there is ONE source repo. IT wires machines to it once. After that,
updating the skill is just a push — no IT, nothing for the marketers to do.**

```
        ┌─────────────────────────┐
        │  Skill repo (the home)  │   ← you push updates here
        │  marketplace + plugin   │
        └────────────┬────────────┘
                     │  (managed settings point every machine here, ONCE)
        ┌────────────┴────────────┐
        │   Marketers' Claude     │   ← skill just appears, auto-updates
        │   Code desktop app      │
        └─────────────────────────┘
```

Three audiences, three jobs:
- **The skill owner (you / Claude on your behalf):** edit the skill, push. That's the whole update loop.
- **IT / Claude admin:** one-time managed-settings deployment. Touched again only if the *plumbing* changes (see §3).
- **Marketers:** nothing. They open Claude Code desktop and the skill is there.

---

## 0. Prerequisites (decide once)

- **Where the skill lives.** Recommended: a small **dedicated private repo** (e.g.
  `saltyandy/getvocal-claude-skills`) containing just this marketplace + plugin. Why
  dedicated: the read credential IT injects then grants machines access to *only
  the skill*, not the whole `getvocal-ai` website source. (Reusing `getvocal-ai`
  also works, but every marketer machine would then have read access to the
  entire codebase.)
- **The Sanity write token.** `SANITY_API_WRITE_TOKEN` is injected by IT via
  managed settings (§1). It is NEVER committed to the repo.
- **Marketers use Claude Code in the desktop app** (not the Claude.ai chat app).
  The skill runs `node` + Bash + the Sanity API, which only works in Claude Code.

---

## 1. One-time setup (IT / Claude admin)

Deploy managed settings to the marketing team's machines (via MDM). One config
does three things: installs + enables the plugin, injects the token, and grants
read access to the private skill repo.

**a) Managed settings file**
- macOS: `/Library/Application Support/ClaudeCode/managed-settings.json`
- (Windows/Linux: the equivalent managed-settings path for your MDM.)

```jsonc
{
  // 1. Tell Claude Code where the skill lives.
  "extraKnownMarketplaces": {
    "getvocal-skills": {
      "source": { "source": "github", "repo": "saltyandy/getvocal-claude-skills" },
      "autoUpdate": true                       // marketers get pushes automatically
    }
  },
  // 2. Force-enable the plugin for everyone (they can't disable it).
  "enabledPlugins": {
    "getvocal-page-builder@getvocal-skills": true
  },
  // 3. Inject the Sanity write token org-wide (never in the repo).
  "env": {
    "SANITY_API_WRITE_TOKEN": "<paste the production write token here>"
  }
}
```

**b) Read access to the private repo (so the clone succeeds with no per-user login)**
Provision a machine-level, read-only git credential for `saltyandy/getvocal-claude-skills`
through your MDM — e.g. a fine-grained PAT in a git credential helper, or an SSH
deploy key. This is what lets a marketer (who has never used git) get the plugin
with zero prompts. Scope it read-only and to that one repo.

**c) Verify on one machine**
Open Claude Code desktop → the plugin should auto-install. Confirm with
`/plugin` (it should list `getvocal-page-builder` as enabled), then have the user
try the skill on a throwaway draft.

> ⚠️ The exact managed-settings key names and file path have shifted across Claude
> Code releases. Confirm against the current docs before wide deployment:
> https://code.claude.com/docs/en/plugin-marketplaces and
> https://code.claude.com/docs/en/settings

---

## 2. Updating the skill (you — no IT, no marketer action)

The managed settings above only *point at* the repo; they don't contain the
skill. So changing the skill never touches managed settings.

1. Edit the skill files (`skills/draft-page/SKILL.md`, the `reference/` docs, or
   `scripts/sanity.mjs`). In practice: just ask Claude to make the change.
2. Bump the version in **two** places so the update is trackable:
   - `getvocal-page-builder/.claude-plugin/plugin.json` → `"version"`
   - the matching entry in `.claude-plugin/marketplace.json` (if it pins a version)
3. Commit and push to the skill repo's default branch.

That's it. With `autoUpdate: true`, every marketer's Claude Code picks up the new
version on its next session. Nobody reinstalls; IT hears nothing.

**Rollback:** revert the commit and push (or pin the previous version). Auto-update
converges everyone back.

**Note — block currency is automatic.** The skill reads the live design-system
block catalog at runtime, so adding/renaming/killing a website block needs **no
skill release at all**. You only cut a release (steps above) when you change the
skill's *instructions or script*.

### How the block catalog reaches a marketer (no repo on their machine)

The `blocks` command sources the catalog in priority order:
1. **Local repo** — only when run inside a `getvocal-ai` checkout (i.e. you/CI).
2. **Published URL** — `https://www.getvocal.ai/block-catalog.json` (override with
   `GETVOCAL_BLOCK_CATALOG_URL`). This is the marketer's live source.
3. **Bundled snapshot** — `skills/draft-page/block-catalog.json`, shipped in the
   plugin. Guaranteed fallback so the skill works even before the URL exists.

Two levels of freshness, pick what you want:
- **Good enough today (already working):** the bundled snapshot. Refresh it when
  the design system changes by running, in the repo:
  ```bash
  node skills/draft-page/scripts/sanity.mjs build-catalog
  ```
  then commit the regenerated `block-catalog.json` (it rides the normal skill
  push in §2). Marketers get it on next auto-update.
- **Zero-lag (optional, recommended later):** publish `block-catalog.json` at the
  URL above on each website deploy (a small build step that runs `build-catalog`
  and copies the JSON into the site's public assets). Then the catalog is always
  current with production and needs no skill release at all. Ask Claude to wire
  this into the web build when you're ready.

---

## 3. When IT IS needed again (rare — structural only)

- The skill **repo URL changes** (moved/renamed).
- The **Sanity token rotates** and must be re-injected.
- You add a **brand-new, separate plugin** that needs enabling (a *new* tool, not
  an update to this one).

Everyday content/script updates are never in this list.

---

## TL;DR

| Task | Who | How often |
|------|-----|-----------|
| Wire machines to the repo + token | IT | Once |
| Update the skill's behavior | You (or Claude) | Anytime — just push |
| Install / update on their machine | Marketers | Never — it's automatic |
