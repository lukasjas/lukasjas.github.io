#!/usr/bin/env bun
// Static site generator. Reads posts/*.md, writes index.html, about/index.html,
// blog/index.html and blog/<slug>/index.html. Output is committed, so GitHub Pages serves it
// directly — no Actions workflow, nothing to debug in CI.

import { marked } from "marked";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = dirname(Bun.fileURLToPath(import.meta.url));
const POSTS_DIR = join(ROOT, "posts");

const SITE = {
  name: "Lukas Jasinskas",
  tagline: "Software developer who loves to build and explore.",
  url: "https://lukasjas.github.io",
  github: "https://github.com/lukasjas",
  email: "lukas.jasinskas77@gmail.com",
};

type Post = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  draft: boolean;
  html: string;
};

/** Minimal YAML front matter: `key: value` pairs between --- fences. */
function parseFrontMatter(raw: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {} as Record<string, string>, body: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim().replace(/^["']|["']$/g, "");
    if (key) meta[key] = value;
  }
  return { meta, body: raw.slice(match[0].length) };
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Long-form date, stable across machines — no locale surprises in the output. */
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function page({ title, description, body, path }: {
  title: string; description: string; body: string; path: string;
}) {
  const current = (href: string) => (path === href ? ` aria-current="page"` : "");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${SITE.url}${path}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${SITE.url}${path}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;700&display=swap">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header>
  <div>
    <a class="wordmark" href="/">${escape(SITE.name)}</a>
    <nav><a href="/about/"${current("/about/")}>About</a><a href="${SITE.github}">GitHub</a></nav>
  </div>
</header>
<main>
${body}
</main>
<footer>
  <div>
    <a href="mailto:${SITE.email}">${SITE.email}</a>
    <a href="${SITE.github}">github.com/lukasjas</a>
  </div>
</footer>
</body>
</html>
`;
}

async function loadPosts(): Promise<Post[]> {
  let files: string[];
  try {
    files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }

  const posts = await Promise.all(files.map(async (file) => {
    const raw = await readFile(join(POSTS_DIR, file), "utf8");
    const { meta, body } = parseFrontMatter(raw);
    // Filename `2026-07-29-my-post.md` supplies date and slug when front matter omits them.
    const stem = file.replace(/\.md$/, "");
    const dated = stem.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
    return {
      slug: meta.slug || (dated ? dated[2] : stem),
      title: meta.title || stem,
      date: meta.date || (dated ? dated[1] : ""),
      summary: meta.summary || "",
      draft: meta.draft === "true",
      html: await marked.parse(body),
    } satisfies Post;
  }));

  return posts.filter((p) => !p.draft).sort((a, b) => b.date.localeCompare(a.date));
}

function postListing(posts: Post[]) {
  if (!posts.length) return `<p class="empty">Nothing published yet.</p>`;
  return `<ul class="rows posts">
${posts.map((p) => `  <li>
    <time class="meta" datetime="${p.date}">${p.date.slice(0, 7)}</time>
    <a href="/blog/${p.slug}/">${escape(p.title)}</a>
    ${p.summary ? `<p>${escape(p.summary)}</p>` : ""}
  </li>`).join("\n")}
</ul>`;
}

async function write(path: string, html: string) {
  const out = join(ROOT, path);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  console.log(`  ${path}`);
}

const posts = await loadPosts();
console.log(`Building ${posts.length} post${posts.length === 1 ? "" : "s"}…`);

await write("index.html", page({
  title: SITE.name,
  description: SITE.tagline,
  path: "/",
  body: `<p class="label">Writing</p>
${postListing(posts.slice(0, 10))}
${posts.length > 10 ? `<p class="more"><a href="/blog">All posts →</a></p>` : ""}`,
}));

await write("about/index.html", page({
  title: `About — ${SITE.name}`,
  description: SITE.tagline,
  path: "/about/",
  body: `<article>
<h1>I'm a software developer who loves to build and explore.</h1>
<p>Any part of the universe will do. If it's made of matter, I'm interested.</p>
</article>`,
}));

await write("blog/index.html", page({
  title: `Blog — ${SITE.name}`,
  description: `Notes on field work, documentation, and the software in between.`,
  path: "/blog",
  body: `<p class="label">All writing</p>
${postListing(posts)}`,
}));

for (const post of posts) {
  await write(`blog/${post.slug}/index.html`, page({
    title: `${post.title} — ${SITE.name}`,
    description: post.summary || post.title,
    path: `/blog/${post.slug}/`,
    body: `<article>
<time datetime="${post.date}">${formatDate(post.date)}</time>
<h1>${escape(post.title)}</h1>
${post.html}
</article>
<p class="back"><a href="/">← All writing</a></p>`,
  }));
}

console.log("Done.");
