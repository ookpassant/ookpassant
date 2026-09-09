// builds the site into _site/: copies the static files, renders notes/*.md
// into pages, and fills the notes list, sitemap, feed and llms.txt.
//
//   npm install   (once)
//   node build.js
//
// a note is a markdown file named YYYY-MM-DD-slug.md with front matter:
//
//   ---
//   title: how this site is put together
//   summary: one line, shown in lists.
//   ---
//
// optional front matter: date (overrides the filename), slug, draft: true.

const fs = require('fs');
const path = require('path');
const md = require('markdown-it')({ html: true, linkify: true, typographer: true });

const ROOT = __dirname;
const OUT = path.join(ROOT, '_site');
const SITE = 'https://chelseahopkins.co.uk';
const SKIP = new Set(['_site', 'node_modules', '.git', '.github', 'templates', 'build.js', 'package.json', 'package-lock.json', '.gitignore']);

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const nice = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : ''));

function frontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return { data, body: m[2] };
}

// ---------- collect notes ----------
const notesDir = path.join(ROOT, 'notes');
const notes = fs.existsSync(notesDir)
  ? fs.readdirSync(notesDir).filter((f) => f.endsWith('.md')).map((f) => {
      const { data, body } = frontMatter(fs.readFileSync(path.join(notesDir, f), 'utf8'));
      if (String(data.draft) === 'true') return null;
      const m = f.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
      const date = data.date || (m ? m[1] : null);
      const slug = data.slug || (m ? m[2] : f.replace(/\.md$/, ''));
      if (!date) throw new Error(`note ${f} needs a date in its filename (YYYY-MM-DD-slug.md) or front matter`);
      return { file: f, slug, date, title: data.title || slug.replace(/-/g, ' '), summary: data.summary || '', html: md.render(body), url: `/notes/${slug}/` };
    }).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date))
  : [];

// ---------- copy static files ----------
fs.rmSync(OUT, { recursive: true, force: true });
function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (src === ROOT && SKIP.has(name)) continue;
      if (path.basename(src) === 'notes' && name.endsWith('.md')) continue;
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

const item = (n) => `<li><a href="${n.url}"><span class="when">${nice(n.date)}</span><b>${esc(n.title)}</b>${n.summary ? `<p>${esc(n.summary)}</p>` : ''}</a></li>`;

for (const n of notes) {
  const dir = path.join(OUT, 'notes', n.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), fill(noteTpl, {
    title: esc(n.title), summary: esc(n.summary), date: nice(n.date), iso: n.date,
    url: SITE + n.url, content: n.html,
  }));
}
fs.mkdirSync(path.join(OUT, 'notes'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'notes', 'index.html'), fill(listTpl, {
  list: notes.length ? `<ol class="notes">${notes.map(item).join('\n')}</ol>` : '<p class="prose">nothing here yet.</p>',
  count: String(notes.length),
}));

// ---------- homepage list ----------
const indexPath = path.join(OUT, 'index.html');
let index = fs.readFileSync(indexPath, 'utf8');
const latest = notes.slice(0, 5);
index = index.replace(/<!-- notes:start -->[\s\S]*?<!-- notes:end -->/,
  latest.length
    ? `<ol class="notes">${latest.map(item).join('\n')}</ol>${notes.length > latest.length ? `<p class="prose small"><a href="/notes/">all ${notes.length} notes</a></p>` : ''}`
    : '<p class="prose">nothing written up yet.</p>');
fs.writeFileSync(indexPath, index);

// ---------- sitemap ----------
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, lastmod: notes[0] ? notes[0].date : today, freq: 'monthly' },
  ...(notes.length ? [{ loc: `${SITE}/notes/`, lastmod: notes[0].date, freq: 'weekly' }] : []),
  ...notes.map((n) => ({ loc: SITE + n.url, lastmod: n.date, freq: 'yearly' })),
];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.freq}</changefreq></url>`).join('\n') +
  `\n</urlset>\n`);

// ---------- feed ----------
fs.writeFileSync(path.join(OUT, 'feed.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n` +
  `  <title>chelsea hopkins · field notes</title>\n  <link href="${SITE}/feed.xml" rel="self"/>\n  <link href="${SITE}/"/>\n  <id>${SITE}/</id>\n` +
  `  <updated>${notes[0] ? notes[0].date : today}T00:00:00Z</updated>\n  <author><name>chelsea hopkins</name></author>\n` +
  notes.map((n) => `  <entry>\n    <title>${esc(n.title)}</title>\n    <link href="${SITE}${n.url}"/>\n    <id>${SITE}${n.url}</id>\n    <updated>${n.date}T00:00:00Z</updated>\n    <summary>${esc(n.summary)}</summary>\n    <content type="html">${esc(n.html)}</content>\n  </entry>`).join('\n') +
  `\n</feed>\n`);

// ---------- llms.txt ----------
const llmsPath = path.join(OUT, 'llms.txt');
if (fs.existsSync(llmsPath) && notes.length) {
  let llms = fs.readFileSync(llmsPath, 'utf8');
  const section = `## notes\n\n${notes.map((n) => `- ${n.title}: ${n.summary} ${SITE}${n.url}`.trim()).join('\n')}\n`;
  llms = /^## notes\n[\s\S]*?(?=^## |\s*$)/m.test(llms)
    ? llms.replace(/^## notes\n[\s\S]*?(?=^## |\s*$)/m, section + '\n')
    : llms.replace(/^## elsewhere/m, section + '\n## elsewhere');
  fs.writeFileSync(llmsPath, llms);
}

console.log(`built ${notes.length} note${notes.length === 1 ? '' : 's'} into ${path.relative(ROOT, OUT)}/`);
