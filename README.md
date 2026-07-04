# KaitoDroid — indie portfolio

A terminal-styled, dark-default portfolio built with [Astro](https://astro.build).
Projects are plain markdown files, so adding or editing one never means touching
a component.

## Local development

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output -> ./dist
npm run preview  # serve the built ./dist locally
```

Node 20+ is required (pinned in `.nvmrc`).

---

## Project sync (recommended)

Instead of hand-authoring project files here, each project repo can **describe
itself** and the portfolio pulls them in. This keeps a project's metadata next
to its code.

**1. Add a descriptor to each project repo.** Drop a `.portfolio.md` file at the
repo root (or scaffold one with `node scripts/sync-projects.mjs init <repo-path>`):

```markdown
---
title: Beacon                          # required
tagline: status pages that explain     # required, one line
status: in-progress                    # required: idea | in-progress | active | archive
stack: [Go, HTMX, SQLite]              # required, non-empty
landing: https://beacon.tools          # optional → "Visit landing →" CTA
repo: https://github.com/you/beacon    # optional → "Source ↗" CTA
slug: beacon                           # optional → defaults to repo folder name
---

The text after the frontmatter is the long-form "THE IDEA" copy. Write as many
paragraphs as you like; `inline code` is styled.
```

> Note: there is **no `order`** field — display order is controlled centrally by
> the position of the repo in `portfolio.repos.json` below.

**2. List the repos to import** in **`portfolio.repos.json`** (paths are resolved
relative to the file; array order = grid order):

```json
{ "repos": ["../beacon", "../cinder", "/abs/path/to/project"] }
```

**3. Sync:**

```bash
npm run sync         # add new + update changed projects
npm run sync:prune   # also delete projects whose repo is no longer listed/valid
npm run sync:check   # dry run — report what would change, write nothing
npm run build        # authoritative schema validation (see below)
```

The script reads each `.portfolio.md`, validates it against the schema, and
writes `src/content/projects/<slug>.md`. A listed repo with a missing or invalid
descriptor is reported and skipped (and the command exits non-zero, so CI catches
misconfiguration).

---

## Adding a project manually

You can also skip the sync and author files directly. Every project is one
markdown file in **`src/content/projects/`**. The filename becomes the URL slug —
`inkwell.md` → `/projects/inkwell`.

> Heads up: a `npm run sync:prune` will delete hand-authored files whose slug
> isn't produced by a listed repo. Use plain `npm run sync` (no prune) if you mix
> both, or keep the project listed via a descriptor.

1. Create `src/content/projects/<slug>.md`.
2. Fill in the frontmatter (all fields below). The text *after* the frontmatter
   is the long-form **"THE IDEA"** copy on the detail page — write as many
   paragraphs as you like; `` `inline code` `` is styled.

```markdown
---
title: Beacon                       # display name
tagline: status pages that explain  # one-line description (shown everywhere)
status: in-progress                 # idea (blue) · in-progress (amber) · active (green) · archive (gray)
stack: [Go, HTMX, SQLite]           # first 3 tags show on the home grid card
landing: https://beacon.tools       # optional — adds the green "Visit landing →" button
repo: https://github.com/you/beacon # optional — adds the "Source ↗" button
order: 10                           # sort position on the home grid (lower = first)
---

The first paragraph becomes the intro under "THE IDEA".

Add more paragraphs for detail. Reference commands like `beacon init` inline.
```

That's it — no other file needs editing. The card appears on the homepage grid
under its status group and a detail page is generated automatically on the next
build. The per-status filter tabs and counts update themselves.

### Field reference

| field     | required | notes                                                  |
|-----------|----------|--------------------------------------------------------|
| `title`   | yes      | Project name.                                          |
| `tagline` | yes      | One line; used on cards, detail header, and `<meta>`.  |
| `status`  | yes      | `idea` \| `in-progress` \| `active` \| `archive` — drives the dot/badge color and groups the project on the home grid (archive de-emphasized). |
| `stack`   | yes      | Array of strings; home card shows the first 3.         |
| `landing` | no       | External URL → primary CTA button.                     |
| `repo`    | no       | External URL → secondary "Source ↗" button.            |
| `demo`    | no       | Image/gif URL or `/public` path → demo block on the detail page. |
| `shots`   | no       | Array of image URLs/paths → screenshot row on the detail page. |
| `order`   | yes      | Number; controls grid/list ordering.                   |

The schema is enforced at build time in `src/content.config.ts` — a missing or
mistyped field fails the build with a clear message.

### Real screenshots / demo

Media is opt-in via frontmatter — a project with no `demo`/`shots` renders no
media blocks (no empty placeholders). Drop assets in `public/` and reference
them:

```markdown
demo: /shots/beacon.gif
shots: [/shots/beacon-1.png, /shots/beacon-2.png]
```

---

## Deploy

The site is static (`./dist`) and served from the **root**, so it deploys to
both targets unchanged.

### GitHub Pages (automated)

Repo: **`KaiTeamTool/KaiTeamTool.github.io`** → live at
`https://kaiteamtool.github.io/`.

1. Push this project to that repo's `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source = GitHub
   Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`, which builds with
   Astro and publishes. (Trigger the first run manually from the **Actions** tab
   if needed.)

### Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**,
   pick the repo.
2. Build settings:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Node version comes from `.nvmrc` (20); if it complains, add an env var
     `NODE_VERSION = 20`.
3. Deploy → served at `https://<project>.pages.dev/`. Cloudflare rebuilds on
   every push automatically.

> Using both is fine — they build the same repo independently. If you later add
> a custom domain, set `site` in `astro.config.mjs` to it and add a
> `public/CNAME` file (GitHub Pages) and/or a custom domain in Cloudflare.
