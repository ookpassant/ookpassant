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
//
// a shop item is shop/anything.md with front matter:
//
//   ---
//   title: oki keyring
//   price: 6.50
//   category: keyrings
//   image: oki-keyring.jpg      (a file in assets/shop/)
//   alt: what is in the photo
//   buy: https://buy.stripe.com/...
//   ---
//   a line or two about it.
//
// optional: sold: true, order (lower sorts first), draft: true. `image` can be
// several files separated by commas; the first is the one on the shelf. each
// item gets its own page at /shop/<filename without the number>/. `nopost` is
// a second checkout url for the same item without postage, for someone who
// will be handed it in person; it shows as a second button. `buy` is any
// checkout url (a stripe payment link, an etsy listing); without one the button
// becomes an email-to-order link. items marked example: true are stand-ins:
// they show only while there are no real items, on a page that says so and
// stays out of search engines and the site's own links. shop/_info.md is the
// small print under the items.

const fs = require('fs');
const path = require('path');

const { parse, bool } = require('./lib/frontmatter');
const { render } = require('./lib/markdown');

const ROOT = __dirname;
const OUT = path.join(ROOT, '_site');
const SITE = 'https://chelseahopkins.co.uk';
const README_NOTES = 5;

// holding mode. while this is true the homepage is holding.html instead of
// index.html. everything else is built as usual: the notes, their index, the
// feed, the sitemap and the README block all stay live. set it to false to
// bring the full homepage back.
const HOLDING = true;

const SKIP = new Set([
  'holding.html',
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
  if (bool(data.draft)) return null;
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
      // shop items are rendered into /shop/ below; their sources stay behind too.
      if (src === path.join(ROOT, 'shop') && /\.md$/.test(name)) continue;
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

// no date on an entry. the notes carry one so they can be sorted, fed and
// listed in the sitemap, but a reader does not get told when a thing was
// published, so a run of posts written in one week does not read as one week.
//
// the grouped /notes/ index has the category as its section heading already.
// the homepage's flat list has nothing, so it takes the category as a label:
// without it every row is title and summary and they blur together.
const entry = (n, { showCategory = false } = {}) =>
  `<li class="entry${n.locked ? ' entry--locked' : ''}">` +
  `<a href="${n.url}">` +
  (showCategory && n.category ? `<span class="entry-cat">${esc(n.category)}</span>` : '') +
  `<b class="entry-title">${esc(n.title)}</b>` +
  (n.locked ? `<span class="entry-lock" aria-label="locked">locked</span>` : '') +
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

// ---------- shop ----------

const shopDir = path.join(ROOT, 'shop');
const shopFiles = fs.existsSync(shopDir) ? fs.readdirSync(shopDir).filter((f) => f.endsWith('.md')).sort() : [];

const money = (n) => `£${Number.isInteger(n) ? n : n.toFixed(2)}`;

const items = shopFiles.filter((f) => !f.startsWith('_')).map((file) => {
  const { data, body } = parse(fs.readFileSync(path.join(shopDir, file), 'utf8'));
  if (bool(data.draft)) return null;
  const price = Number(String(data.price || '').replace(/^£/, ''));
  if (!data.title) throw new Error(`shop/${file} needs a title`);
  if (!(price > 0)) throw new Error(`shop/${file} needs a price, in pounds (price: 6.50)`);
  for (const key of ['buy', 'nopost']) {
    if (data[key] && !/^https:\/\//.test(data[key])) throw new Error(`shop/${file}: ${key} must be a full https:// link`);
  }
  const images = String(data.image || '').split(',').map((f) => f.trim()).filter(Boolean);
  for (const f of images) {
    if (!fs.existsSync(path.join(ROOT, 'assets', 'shop', f))) throw new Error(`shop/${file} wants assets/shop/${f}, which is not there`);
  }
  if (images.length && !data.alt) throw new Error(`shop/${file} has a photo, so it needs alt text (alt: what is in it)`);
  return {
    file, price,
    slug: file.replace(/\.md$/, '').replace(/^\d+-/, ''),
    title: data.title,
    category: data.category || 'other things',
    images,
    alt: data.alt || '',
    summary: body.trim().split(/\n\s*\n/)[0].replace(/\s+/g, ' '),
    buy: data.buy || '',
    nopost: data.nopost || '',
    sold: bool(data.sold),
    example: bool(data.example),
    order: data.order !== undefined ? Number(data.order) : Infinity,
    html: render(body),
  };
}).filter(Boolean)
  // sold things sink to the end of their shelf, so what can be bought leads.
  .sort((a, b) => (a.sold - b.sold) || (a.order - b.order) || a.file.localeCompare(b.file));

const itemSlugs = new Set();
for (const i of items) {
  if (itemSlugs.has(i.slug)) throw new Error(`two shop items both want /shop/${i.slug}/ — rename one of the files`);
  itemSlugs.add(i.slug);
}

// the stand-ins step aside the moment there is one real thing to sell.
const realItems = items.filter((i) => !i.example);
const shopOpen = realItems.length > 0;
const onSale = shopOpen ? realItems : items;

function buyButton(i) {
  if (i.sold) return `<span class="item-buy item-buy--off">sold</span>`;
  if (!shopOpen) return `<span class="item-buy item-buy--off">not on sale yet</span>`;
  if (i.buy) {
    return `<a class="item-buy" href="${esc(i.buy)}" data-item="${esc(i.slug)}">buy · ${money(i.price)} + £2 postage</a>` +
      (i.nopost
        ? `<a class="item-buy item-buy--second" href="${esc(i.nopost)}" data-item="${esc(i.slug)}" data-how="no-postage">i don't need postage · ${money(i.price)}</a>` +
          `<p class="item-buy-note">no postage is for when i'll be handing it to you. i'll email you to sort it out.</p>`
        : '');
  }
  return `<a class="item-buy mail" data-u="hello" data-d="chelseahopkins.co.uk" data-s="${esc(`order: ${i.title}`)}" data-item="${esc(i.slug)}" href="#">email to order</a>`;
}

const photo = (i, file, lazy) => (file
  ? `<img class="item-photo" src="/assets/shop/${esc(file)}" alt="${esc(i.alt)}" width="800" height="800"${lazy ? ' loading="lazy"' : ''} decoding="async">`
  : `<div class="item-photo doodle" role="img" aria-label="no photo yet"><span class="doodle-label">photo to come</span></div>`);

// the shelf shows a photo, a name and a price, two to a row on a phone. the
// words and the button live on the item's own page.
const item = (i) =>
  `<li class="item${i.sold ? ' item--sold' : ''}"><a href="/shop/${esc(i.slug)}/">` +
  `<span class="item-frame">${photo(i, i.images[0], true)}${i.sold ? '<span class="item-flag">sold</span>' : ''}</span>` +
  `<span class="item-title">${esc(i.title)}</span>` +
  `<span class="item-price">${money(i.price)}</span>` +
  `</a></li>`;

const shelves = [];
for (const i of onSale) {
  let shelf = shelves.find((s) => s.category === i.category);
  if (!shelf) shelves.push(shelf = { category: i.category, items: [] });
  shelf.items.push(i);
}

// the catch-all shelf goes last, whatever was listed first.
shelves.sort((a, b) => (a.category === 'other things') - (b.category === 'other things'));

const infoPath = path.join(shopDir, '_info.md');
const shopInfo = fs.existsSync(infoPath) ? render(parse(fs.readFileSync(infoPath, 'utf8')).body) : '';

const shelfId = (category) => category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const shopRobots = shopOpen ? 'index,follow' : 'noindex,nofollow';
const shopNotice = shopOpen || !items.length ? '' : '<p class="shop-notice"><b>not open yet.</b> these are stand-ins to show how the shelves will look. nothing here can be bought.</p>';

fs.mkdirSync(path.join(OUT, 'shop'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'shop', 'index.html'), fill(fs.readFileSync(path.join(ROOT, 'templates', 'shop.html'), 'utf8'), {
  robots: shopRobots,
  count: shopOpen ? ` · ${onSale.length}` : '',
  notice: shopNotice,
  // with one shelf there is nowhere to jump to.
  nav: shelves.length > 1
    ? `<nav class="shelf-nav" aria-label="shelves">${shelves.map((s) => `<a href="#${shelfId(s.category)}">${esc(s.category)}</a>`).join('')}</nav>`
    : '',
  shelves: onSale.length
    ? shelves.map((s) => `<section class="group" id="${shelfId(s.category)}">\n<h2 class="group-head">${esc(s.category)}<span class="group-count">${s.items.length}</span></h2>\n` +
        `<ul class="items">\n${s.items.map(item).join('\n')}\n</ul>\n</section>`).join('\n')
    : '<p class="prose">nothing on the shelves yet.</p>',
  info: shopInfo ? `<section class="shop-info note-body">\n${shopInfo}</section>` : '',
}));

const itemTpl = fs.readFileSync(path.join(ROOT, 'templates', 'shop-item.html'), 'utf8');
for (const i of onSale) {
  const url = `${SITE}/shop/${i.slug}/`;
  const image = i.images[0] ? `${SITE}/assets/shop/${i.images[0]}` : '';
  const dir = path.join(OUT, 'shop', i.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), fill(itemTpl, {
    title: esc(i.title),
    summary: esc(i.summary),
    robots: shopRobots,
    url,
    ogimage: image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">` : '',
    jsonld: JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Product', name: i.title, description: i.summary, url,
      ...(image ? { image } : {}),
      offers: {
        '@type': 'Offer', price: i.price.toFixed(2), priceCurrency: 'GBP', url,
        availability: `https://schema.org/${i.sold ? 'SoldOut' : 'InStock'}`,
      },
    }).replace(/</g, '\\u003c'),
    category: esc(i.category),
    shelf: shelves.length > 1 ? `#${shelfId(i.category)}` : '',
    notice: shopNotice,
    photos: i.images.length ? i.images.map((f, n) => photo(i, f, n > 0)).join('\n') : photo(i, '', false),
    price: money(i.price),
    about: i.html,
    buy: buyButton(i),
    sold: i.sold ? ' item-page--sold' : '',
  }));
}

// ---------- homepage ----------

const indexPath = path.join(OUT, 'index.html');
let index = fs.readFileSync(HOLDING ? path.join(ROOT, 'holding.html') : indexPath, 'utf8');
index = index.replace(/<!-- notes:start -->[\s\S]*?<!-- notes:end -->/,
  listed.length
    ? `<!-- notes:start --><ol class="entries">${listed.slice(0, 6).map((n) => entry(n, { showCategory: true })).join('\n')}</ol>` +
      (listed.length > 6 ? `<p class="prose small"><a href="/notes/">all ${listed.length} notes</a></p>` : '') +
      `<!-- notes:end -->`
    : '<!-- notes:start --><p class="prose">nothing written up yet.</p><!-- notes:end -->');
// the way into the shop appears once there is something real in it.
index = index.replace(/<!-- shop-link:(.*?) -->/g, (_, link) => (shopOpen ? link : ''));
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
  { loc: `${SITE}/about/`, lastmod: today, freq: 'monthly' },
  ...(shopOpen ? [{ loc: `${SITE}/shop/`, lastmod: today, freq: 'weekly' }] : []),
  ...(shopOpen ? onSale.map((i) => ({ loc: `${SITE}/shop/${i.slug}/`, lastmod: today, freq: 'weekly' })) : []),
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
  `  <title>chelsea hopkins · scribblings</title>\n  <link href="${SITE}/feed.xml" rel="self"/>\n  <link href="${SITE}/"/>\n  <id>${SITE}/</id>\n` +
  `  <updated>${listed[0] ? listed[0].date : today}T00:00:00Z</updated>\n  <author><name>chelsea hopkins</name></author>\n` +
  listed.map((n) => `  <entry>\n    <title>${esc(n.title)}</title>\n    <link href="${SITE}${n.url}"/>\n    <id>${SITE}${n.url}</id>\n    <updated>${n.date}T00:00:00Z</updated>\n    <summary>${esc(n.summary)}</summary>` +
    (n.locked ? '' : `\n    <content type="html">${esc(n.html)}</content>`) +
    `\n  </entry>`).join('\n') +
  `\n</feed>\n`);

// ---------- llms.txt ----------

const llmsPath = path.join(OUT, 'llms.txt');
if (fs.existsSync(llmsPath) && listed.length) {
  let llms = fs.readFileSync(llmsPath, 'utf8');
  const section = `## scribblings\n\n${listed.map((n) => `- ${n.title}: ${n.summary} ${SITE}${n.url}`.trim()).join('\n')}\n`;
  llms = /^## scribblings\n[\s\S]*?(?=^## |\s*$)/m.test(llms)
    ? llms.replace(/^## scribblings\n[\s\S]*?(?=^## |\s*$)/m, section + '\n')
    : llms.replace(/^## elsewhere/m, section + '\n## elsewhere');
  fs.writeFileSync(llmsPath, llms);
}

const lockedCount = all.filter((n) => n.locked).length;
const hidden = all.length - listed.length;
console.log(
  `built ${all.length} note${all.length === 1 ? '' : 's'} into ${path.relative(ROOT, OUT)}/` +
  (lockedCount ? ` · ${lockedCount} locked` : '') +
  (hidden ? ` · ${hidden} unlisted` : '') +
  (shopOpen ? ` · ${onSale.length} in the shop` : items.length ? ' · shop shows stand-ins only' : '') +
  (HOLDING ? ' · homepage is the holding page' : ''),
);
