# getvocal-claude-skills

Internal Claude Code skills for GetVocal, distributed as a **plugin marketplace**.

## What's here

- `.claude-plugin/marketplace.json` — the marketplace catalog Claude Code reads.
- `getvocal-page-builder/` — the plugin. Its flagship skill, **draft-page**, turns
  a supplied content document into a ready-to-review Sanity **draft** page
  (webinar / event / landing) on getvocal.ai. It never publishes.

## Who uses it

The marketing team, via Claude Code in the desktop app. They install nothing —
an admin wires their machines to this repo once via managed settings.

## Rollout & updates

See **`getvocal-page-builder/ROLLOUT.md`** for:
- the one-time IT/admin setup (managed settings + Sanity write token + read access),
- the ongoing "edit → bump version → push" update loop (no IT, no marketer action),
- how the live block catalog reaches a marketer with no repo checked out.

## Updating

Edit the skill under `getvocal-page-builder/`, bump the `version` in
`getvocal-page-builder/.claude-plugin/plugin.json`, and push. Auto-update carries
it to every marketer's machine. Nothing here contains secrets — the Sanity write
token is injected separately via managed settings.
