// builds the site into _site/: copies the static files, renders the notes, and
// fills the notes list, homepage, README block, sitemap, feed and llms.txt.
//
//   npm install   (once)
//   npm run build
//
// a public note is notes/YYYY-MM-DD-slug.md with front matter:
//
//   ---
//   title: how this site is put together
//   summary: one line, shown in lists.
//   category: build
//   ---
//
// optional: date (overrides the filename), slug, draft: true, order (lower
// sorts first; notes without one come after, newest first).
//
// a locked note is not written here — it is produced by lock.js and arrives as
// notes/*.md.enc (listed: title and summary readable, body encrypted) or
// notes/_*.enc (hidden: everything encrypted, opaque filename). this file never
// sees their plaintext and cannot decrypt them. it only has to be careful not
// to leak what little it does know: a locked body never reaches the feed, and a
// hidden note appears in no list, feed, sitemap or llms.txt at all.

const fs = require('fs');
const path = require('path');

const { parse, bool } = require('./lib/frontmatter');
const { render } = require('./lib/markdown');

const ROOT = __dirname;
const OUT = path.join(ROOT, '_site');
const SITE = 'https://chelseahopkins.co.uk';
const README_NOTES = 5;

const SKIP = new Set([
  '_site', 'node_modules', '.git', '.github', '.githooks', 'templates', 'lib', 'drafts',
  'build.js', 'lock.js', 'package.json', 'package-lock.json', '.gitignore', 'README.md',
]);

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const nice = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : ''));

// ---------- collect notes ----------

const notesDir = path.join(ROOT, 'notes');
const files = fs.existsSync(notesDir) ? fs.readdirSync(notesDir) : [];

function readPublic(file) {
  const { data, body } = parse(fs.readFileSync(path.join(notesDir, file), 'utf8'));
  if (bool(data.draft)) return null;
  const m = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  const date = data.date || (m ? m[1] : null);
  if (!date) throw new Error(`note ${file} needs a date in its filename (YYYY-MM-DD-slug.md) or front matter`);
  const slug = data.slug || (m ? m[2] : file.replace(/\.md$/, ''));
  return {
    file, slug, date, listed: bool(data.listed, true), locked: false,
    order: data.order !== undefined ? Number(data.order) : Infinity,
    category: data.category || 'note',
    title: data.title || slug.replace(/-/g, ' '),
    summary: data.summary || '',
    html: render(body),
    url: `/notes/${slug}/`,
  };
}

function readLocked(file) {
  const { data, body } = parse(fs.readFileSync(path.join(notesDir, file), 'utf8'));
  const listed = bool(data.listed, true);
  const m = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md\.enc$/);
  const slug = listed ? (m ? m[2] : file.replace(/\.md\.enc$/, '')) : file.replace(/^_/, '').replace(/\.enc$/, '');
  const date = data.date || (m ? m[1] : null);
  if (listed && !date) throw new Error(`listed locked note ${file} needs a date`);

  let envelope;
  try {
    envelope = JSON.parse(body.trim());
  } catch (e) {
    throw new Error(`${file} does not contain a readable envelope — re-run lock.js on it`);
  }

  return {
    file, slug, listed, locked: true,
    date: date || '',
    order: data.order !== undefined ? Number(data.order) : Infinity,
    // a hidden note tells the public nothing. the template shows a generic
    // heading until the browser opens the envelope and replaces it.
    category: listed ? (data.category || 'note') : '',
    title: listed ? (data.title || slug.replace(/-/g, ' ')) : 'a locked note',
    summary: listed ? (data.summary || '') : '',
    hint: data.hint || '',
    envelope: JSON.stringify(envelope),
    url: `/notes/${slug}/`,
  };
}

const all = files
  .map((f) => {
    if (f.endsWith('.md.enc') || (f.startsWith('_') && f.endsWith('.enc'))) return readLocked(f);
    if (f.endsWith('.md')) return readPublic(f);
    return null;
  })
  .filter(Boolean)
  .sort((a, b) => (a.order - b.order) || b.date.localeCompare(a.date) || a.file.localeCompare(b.file));

const slugs = new Set();
for (const n of all) {
  if (slugs.has(n.slug)) throw new Error(`two notes both want /notes/${n.slug}/ — one of them needs a different slug`);
  slugs.add(n.slug);
}

// everything a stranger is allowed to know exists
const listed = all.filter((n) => n.listed);

// ---------- copy static files ----------

fs.rmSync(OUT, { recursive: true, force: true });
function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (src === ROOT && SKIP.has(name)) continue;
      // note sources of every kind stay out of the built site. the plaintext
      // ones would be duplicates; the encrypted ones would be a second copy of
      // the ciphertext sitting at a guessable URL.
      if (path.basename(src) === 'notes' && /\.(md|enc)$/.test(name)) continue;
      copy(path.join(src, name), path.join(dst, name));
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}
copy(ROOT, OUT);

// ---------- note pages ----------

const noteTpl = fs.readFileSync(path.join(ROOT, 'templates', 'note.html'), 'utf8');
const listTpl = fs.readFileSync(path.join(ROOT, 'templates', 'notes-index.html'), 'utf8');
const lockTpl = fs.readFileSync(path.join(ROOT, 'templates', 'locked.html'), 'utf8');

const entry = (n) => `<li class="entry${n.locked ? ' entry--locked' : ''}">` +
  `<a href="${n.url}">` +
  `<span class="entry-when">${n.date ? esc(nice(n.date)) : ''}${n.locked ? '<span class="entry-lock" aria-label="locked">locked</span>' : ''}</span>` +
  `<b class="entry-title">${esc(n.title)}</b>` +
  (n.summary ? `<p class="entry-summary">${esc(n.summary)}</p>` : '') +
  `</a></li>`;

for (const n of all) {
  const dir = path.join(OUT, 'notes', n.slug);
  fs.mkdirSync(dir, { recursive: true });

  const content = n.locked
    ? fill(lockTpl, {
        hint: n.hint ? `<p class="lock-hint">${esc(n.hint)}</p>` : '',
        envelope: n.envelope,
      })
    : `<div class="note-body">${n.html}</div>`;

  fs.writeFileSync(path.join(dir, 'index.html'), fill(noteTpl, {
    title: esc(n.title),
    summary: esc(n.summary),
    // a hidden note must not describe itself to a crawler or a link preview
    robots: n.listed ? 'index,follow' : 'noindex,nofollow',
    iso: n.date,
    when: n.date ? `    <p class="note-when"><time datetime="${n.date}">${nice(n.date)}</time></p>` : '',
    category: n.category ? ` · ${esc(n.category)}` : '',
    url: SITE + n.url,
    content,
  }));
}

// ---------- notes index, grouped by category ----------

const order = [];
const byCategory = new Map();
for (const n of listed) {
  if (!byCategory.has(n.category)) { byCategory.set(n.category, []); order.push(n.category); }
  byCategory.get(n.category).push(n);
}

const groups = order.map((category) => {
  const items = byCategory.get(category);
  return `<section class="group">\n<h2 class="group-head">${esc(category)}<span class="group-count">${items.length}</span></h2>\n` +
    `<ol class="entries">\n${items.map(entry).join('\n')}\n</ol>\n</section>`;
}).join('\n');

fs.mkdirSync(path.join(OUT, 'notes'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'notes', 'index.html'), fill(listTpl, {
  groups: listed.length ? groups : '<p class="prose">nothing here yet.</p>',
  count: String(listed.length),
}));

// ---------- homepage ----------

const indexPath = path.join(OUT, 'index.html');
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(/<!-- notes:start -->[\s\S]*?<!-- notes:end -->/,
  listed.length
    ? `<!-- notes:start --><ol class="entries">${listed.slice(0, 6).map(entry).join('\n')}</ol>` +
      (listed.length > 6 ? `<p class="prose small"><a href="/notes/">all ${listed.length} notes</a></p>` : '') +
      `<!-- notes:end -->`
    : '<!-- notes:start --><p class="prose">nothing written up yet.</p><!-- notes:end -->');
fs.writeFileSync(indexPath, index);

// ---------- github profile readme ----------
// written back into the repo, not into _site/. the workflow commits it only if
// this actually changed something.

const readmePath = path.join(ROOT, 'README.md');
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, 'utf8');
  const block = listed.slice(0, README_NOTES)
    .map((n) => `- [${n.title}](${SITE}${n.url})${n.summary ? ` — ${n.summary}` : ''}`)
    .join('\n');
  const next = readme.replace(/<!-- notes:start -->[\s\S]*?<!-- notes:end -->/,
    `<!-- notes:start -->\n${block || '_nothing written up yet._'}\n<!-- notes:end -->`);
  if (next !== readme) fs.writeFileSync(readmePath, next);
}

// ---------- sitemap ----------

const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, lastmod: listed[0] ? listed[0].date : today, freq: 'monthly' },
  ...(listed.length ? [{ loc: `${SITE}/notes/`, lastmod: listed[0].date, freq: 'weekly' }] : []),
  ...listed.map((n) => ({ loc: SITE + n.url, lastmod: n.date, freq: 'yearly' })),
];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.freq}</changefreq></url>`).join('\n') +
  `\n</urlset>\n`);

// ---------- feed ----------
// a locked note gets a title, a link and its summary. it does not get content:
// the whole point of the lock is that the body needs a passphrase, and a feed
// reader is exactly the kind of thing that would cheerfully cache it forever.

fs.writeFileSync(path.join(OUT, 'feed.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n` +
  `  <title>chelsea hopkins · field notes</title>\n  <link href="${SITE}/feed.xml" rel="self"/>\n  <link href="${SITE}/"/>\n  <id>${SITE}/</id>\n` +
  `  <updated>${listed[0] ? listed[0].date : today}T00:00:00Z</updated>\n  <author><name>chelsea hopkins</name></author>\n` +
  listed.map((n) => `  <entry>\n    <title>${esc(n.title)}</title>\n    <link href="${SITE}${n.url}"/>\n    <id>${SITE}${n.url}</id>\n    <updated>${n.date}T00:00:00Z</updated>\n    <summary>${esc(n.summary)}</summary>` +
    (n.locked ? '' : `\n    <content type="html">${esc(n.html)}</content>`) +
    `\n  </entry>`).join('\n') +
  `\n</feed>\n`);

// ---------- llms.txt ----------

const llmsPath = path.join(OUT, 'llms.txt');
if (fs.existsSync(llmsPath) && listed.length) {
  let llms = fs.readFileSync(llmsPath, 'utf8');
  const section = `## notes\n\n${listed.map((n) => `- ${n.title}: ${n.summary} ${SITE}${n.url}`.trim()).join('\n')}\n`;
  llms = /^## notes\n[\s\S]*?(?=^## |\s*$)/m.test(llms)
    ? llms.replace(/^## notes\n[\s\S]*?(?=^## |\s*$)/m, section + '\n')
    : llms.replace(/^## elsewhere/m, section + '\n## elsewhere');
  fs.writeFileSync(llmsPath, llms);
}

const lockedCount = all.filter((n) => n.locked).length;
const hidden = all.length - listed.length;
console.log(
  `built ${all.length} note${all.length === 1 ? '' : 's'} into ${path.relative(ROOT, OUT)}/` +
  (lockedCount ? ` · ${lockedCount} locked` : '') +
  (hidden ? ` · ${hidden} unlisted` : ''),
);
