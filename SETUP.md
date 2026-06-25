# Setup — draft-page skill (for first-time install)

One-time setup. ~2 minutes. No git knowledge needed.

## 1. Install the skill (in Claude Code)

Paste these two lines:

```
/plugin marketplace add saltyandy/getvocal-claude-skills
/plugin install getvocal-page-builder@getvocal-skills
```

## 2. Add the Sanity token (in Terminal)

Paste this, replacing `PASTE_THE_SANITY_TOKEN_HERE` with the real token
(keep the single quotes around it):

```bash
TOKEN='PASTE_THE_SANITY_TOKEN_HERE' node -e 'const fs=require("fs"),os=require("os"),p=require("path");const d=p.join(os.homedir(),".claude"),f=p.join(d,"settings.json");fs.mkdirSync(d,{recursive:true});let s={};try{s=JSON.parse(fs.readFileSync(f,"utf8"))}catch{}s.env=s.env||{};s.env.SANITY_API_WRITE_TOKEN=process.env.TOKEN;fs.writeFileSync(f,JSON.stringify(s,null,2)+"\n");console.log("✅ Token saved to "+f)'
```

It safely adds the token without touching any other settings.

## 3. Restart Claude Code

Done. To use it, just describe what you want — e.g. paste the content for a
webinar page and ask Claude to build a draft.

## Notes

- The same token works for everyone — no per-person token.
- Updates are automatic; you never reinstall.
- Requires `node` (check with `node -v`).
