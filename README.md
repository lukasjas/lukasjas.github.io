# lukasjas.github.io

Personal site and blog. Static HTML, generated from markdown by a single Bun script.
No framework, no CI — the generated HTML is committed, and GitHub Pages serves it as-is.

## Write a post

Add a markdown file to `posts/`. Name it `YYYY-MM-DD-slug.md` — the date and slug come from the
filename unless front matter overrides them.

```markdown
---
title: The thread is the system of record
date: 2026-07-29
summary: One line for the listing page.
draft: false
---

Body starts here.
```

`draft: true` keeps it out of the build.

## Build and publish

```bash
bun install        # once
bun run build      # regenerates index.html, about/, blog/, blog/<slug>/
git add -A && git commit -m "post: ..." && git push
```

Live within a minute of the push.

## Preview locally

```bash
bun run serve      # http://localhost:3000
```

## Layout

```
build.ts       generator — front matter parsing, templates, output
styles.css     the whole design, ~200 lines, dark with a light variant
posts/         markdown source — the only thing you edit to publish
index.html     generated
blog/          generated
about/         generated — career and stack lists live at the top of build.ts
.nojekyll      stops GitHub running Jekyll over the output
```

Editing anything under `blog/`, `about/` or `index.html` by hand is pointless — the next build overwrites it.
Change `build.ts` or `styles.css` instead.
