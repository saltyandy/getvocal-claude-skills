# Desktop App Installation (workaround)

The `/plugin marketplace add` and `/plugin install` commands only work in an
interactive `claude` terminal session. In the desktop app they return
`/plugin isn't available in this environment.`

The desktop app shares the same plugin registry as the `claude` CLI, under
`~/.claude/plugins/`. We replicate what `/plugin install` does, **plus** the one
step that's easy to miss: a plugin must be explicitly *enabled* in
`~/.claude/settings.json` — registering it is not enough.

## One-shot script

Paste this whole block into Terminal. It clones the marketplace, caches the
plugin, registers it, and enables it.

```bash
node -e '
const fs=require("fs"),os=require("os"),p=require("path"),cp=require("child_process");
const home=os.homedir();
const repo="https://github.com/saltyandy/getvocal-claude-skills";
const mkt="getvocal-skills", plug="getvocal-page-builder";
const base=p.join(home,".claude","plugins");
const mktDir=p.join(base,"marketplaces","getvocal-claude-skills");

// 1. clone (or pull) the marketplace
if(!fs.existsSync(mktDir)) cp.execSync(`git clone ${repo} "${mktDir}"`,{stdio:"inherit"});
else cp.execSync(`git -C "${mktDir}" pull --ff-only`,{stdio:"inherit"});
const sha=cp.execSync(`git -C "${mktDir}" rev-parse HEAD`).toString().trim();
// use commit SHA as cache key (no version field in plugin.json — SHA auto-invalidates on push)
const ver=sha.slice(0,8);
const cacheDir=p.join(base,"cache",mkt,plug,ver);

// 2. copy plugin into cache
fs.mkdirSync(cacheDir,{recursive:true});
cp.execSync(`cp -R "${p.join(mktDir,plug)}/." "${cacheDir}/"`);

// 3. ensure plugin.json points at its skills dir
const pj=p.join(cacheDir,".claude-plugin","plugin.json");
const j=JSON.parse(fs.readFileSync(pj,"utf8"));
if(j.skills!=="./skills"){j.skills="./skills";fs.writeFileSync(pj,JSON.stringify(j,null,2)+"\n");}

// 4. register the marketplace
const km=p.join(base,"known_marketplaces.json");
let kmj={};try{kmj=JSON.parse(fs.readFileSync(km,"utf8"))}catch{}
kmj[mkt]={source:{source:"github",repo:"saltyandy/getvocal-claude-skills"},installLocation:mktDir,lastUpdated:new Date().toISOString()};
fs.writeFileSync(km,JSON.stringify(kmj,null,2)+"\n");

// 5. register the install
const ip=p.join(base,"installed_plugins.json");
let ipj={version:2,plugins:{}};try{ipj=JSON.parse(fs.readFileSync(ip,"utf8"))}catch{}
ipj.plugins=ipj.plugins||{};
ipj.plugins[`${plug}@${mkt}`]=[{scope:"user",installPath:cacheDir,version:ver,installedAt:new Date().toISOString(),lastUpdated:new Date().toISOString(),gitCommitSha:sha,commitSha:sha}];
fs.writeFileSync(ip,JSON.stringify(ipj,null,2)+"\n");

// 6. ENABLE it in settings.json (the step that is easy to miss)
const sf=p.join(home,".claude","settings.json");
let s={};try{s=JSON.parse(fs.readFileSync(sf,"utf8"))}catch{}
s.enabledPlugins=s.enabledPlugins||{};
s.enabledPlugins[`${plug}@${mkt}`]=true;
s.extraKnownMarketplaces=s.extraKnownMarketplaces||{};
s.extraKnownMarketplaces[mkt]={source:{source:"github",repo:"saltyandy/getvocal-claude-skills"}};
fs.writeFileSync(sf,JSON.stringify(s,null,2)+"\n");

console.log("✅ Installed and enabled getvocal-page-builder ("+sha.slice(0,7)+")");
'
```

## Verify

```bash
claude plugin list
```

You should see `getvocal-page-builder@getvocal-skills` with **Status: ✔ enabled**.
If it says `✘ disabled`, step 6 didn't take — check `enabledPlugins` in
`~/.claude/settings.json`.

## Restart

Fully quit and reopen the desktop app (not just the window). Then `/draft-page`
should appear in the command menu.

## Notes / gotchas

- **The enable flag is the real gotcha.** Adding the plugin to
  `installed_plugins.json` registers it but leaves it *disabled*. It only loads
  once `"<plugin>@<marketplace>": true` exists under `enabledPlugins` in
  `~/.claude/settings.json`.
- **`plugin.json` must declare `"skills": "./skills"`.** Without it the plugin
  loads but exposes no skills. The script patches this defensively; ideally fix
  it in the repo so fresh clones are correct.
- The `~/.claude/plugins/` path is shared by the desktop app and the `claude`
  CLI, so `claude plugin list` is a reliable way to check state.
```
