// Turns an approved issue into data. Called by .github/workflows/community.yml
// once Chelsea puts the "approved" label on an issue. Nothing here runs, and
// nothing is committed, until that label is on.
//
// Reads from env: ISSUE_BODY, ISSUE_TITLE, ISSUE_NUMBER, ISSUE_USER
// Writes: data/*.json, paddock/horses/<slug>.png, a reply at OUTCOME_PATH,
//         and ok=true|false to GITHUB_OUTPUT.
//
// Everything that arrives in the issue body is untrusted. Text is stripped to
// a safe character set and length-capped here, then HTML-escaped again at
// render time. Images are re-encoded rather than copied, so nothing but
// pixels survives the trip.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const MAX_BYTES = 15 * 1024 * 1024;
const SPRITE = 400;
const PAPER = { r: 253, g: 249, b: 241, alpha: 1 };
// Set this to the deployed worker's origin (see worker/README.md). Drawings
// from /colour/ are parked there for sixty days and fetched once on approval.
const WORKER_ORIGIN = 'https://paddock.ookpassant.workers.dev';

// The image arrives as markdown — "![name](https://...)" — so this searches
// rather than anchors. The host and path prefix are still literal, so the only
// thing that can match is the worker or an attachment GitHub itself is hosting.
// A url that merely mentions one of these hosts inside a query string can't
// match, because the match has to begin at a word boundary and covers the host.
const ALLOWED_IMAGE_HOST = new RegExp(
  '(?<=^|[\\s(<"\'])https:\\/\\/(?:' + [
    escapeRe(WORKER_ORIGIN.replace(/^https:\/\//, '')) + '\\/i\\/[a-f0-9]{20}\\.png',
    'github\\.com\\/user-attachments\\/assets\\/[\\w-]+',
    'user-images\\.githubusercontent\\.com\\/[\\w\\-/.%]+',
    'raw\\.githubusercontent\\.com\\/[\\w\\-/.%]+',
  ].join('|') + ')'
);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const body = process.env.ISSUE_BODY || '';
const title = process.env.ISSUE_TITLE || '';
const user = (process.env.ISSUE_USER || '').replace(/[^\w-]/g, '');
const number = Number(process.env.ISSUE_NUMBER || 0);

// ---------- helpers ----------

/** Issue forms arrive as "### label\n\nvalue" blocks. */
function parseForm(src) {
  const out = {};
  const parts = src.split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    if (nl < 0) continue;
    out[part.slice(0, nl).trim().toLowerCase()] = part.slice(nl + 1).trim();
  }
  return out;
}

/** Strip to a safe set, collapse whitespace, cap length. */
function clean(value, max) {
  return String(value ?? '')
    .replace(/^_No response_$/i, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\p{L}\p{N} .,!?'&():+\/-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

function safeLink(value) {
  const raw = String(value ?? '').trim();
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(\/[\w\-./?%&=+#~]*)?$/i.test(raw)) return '';
  return raw.length > 200 ? '' : raw;
}

function slugify(name, seed) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const tag = crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 4);
  return `${base || 'horse'}-${tag}`;
}

function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
  catch { return []; }
}

function writeJson(rel, value) {
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(value, null, 2) + '\n');
}

function finish(ok, message) {
  const out = process.env.OUTCOME_PATH || path.join(ROOT, 'outcome.md');
  fs.writeFileSync(out, message.trim() + '\n');
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `ok=${ok ? 'true' : 'false'}\n`);
  }
  console.log(ok ? 'ok' : 'refused', '-', message.split('\n')[0]);
  process.exit(0);
}

// ---------- the paddock ----------

async function handleHorse(fields) {
  const name = clean(fields['horse name'], 40);
  if (!name) return finish(false, 'i could not read a name for this horse, so nothing was added.');

  const found = (fields['the colouring'] || '').match(ALLOWED_IMAGE_HOST);
  if (!found) return finish(false, 'i could not find the drawing on this one, so nothing was added.');

  const res = await fetch(found[0]);
  if (!res.ok) return finish(false, 'the image link would not load, so nothing was added.');
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/')) return finish(false, 'that attachment is not an image, so nothing was added.');

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) return finish(false, 'that image is bigger than 15mb. shrink it a bit and i will take another look.');

  const sharp = require('sharp');
  const meta = await sharp(buf).metadata();
  if (!['png', 'jpeg', 'jpg', 'webp', 'gif'].includes(String(meta.format))) {
    return finish(false, 'i can only take png, jpeg, webp or gif, so nothing was added.');
  }

  // Drawings sent from /colour/ come in under Chelsea's own token, so the issue
  // author is her. The artist names themselves in the form instead.
  const artist = clean(fields['coloured by'], 40) || user;
  if (!artist) return finish(false, 'i could not tell who coloured this one, so nothing was added.');

  const slug = slugify(name, number);
  const rel = `paddock/horses/${slug}.png`;
  await sharp(buf)
    .resize(SPRITE, SPRITE, { fit: 'contain', background: PAPER })
    .flatten({ background: PAPER })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, rel));

  const horses = readJson('data/paddock.json').filter((h) => h.issue !== number);
  horses.push({
    slug,
    name,
    artist,
    base: clean(fields['which base'], 24),
    link: safeLink(fields['link back to you']),
    issue: number,
    added: new Date().toISOString().slice(0, 10),
  });
  writeJson('data/paddock.json', horses);

  const url = `https://raw.githubusercontent.com/ookpassant/ookpassant/main/${rel}`;
  finish(true, [
    `${name} is in the paddock, coloured by ${artist} — on the profile and at`,
    'https://chelseahopkins.co.uk/paddock/ now.',
    '',
    'markdown, if you want to show them anywhere else:',
    '',
    '```markdown',
    `[![${name}](${url})](https://chelseahopkins.co.uk/paddock/)`,
    '```',
  ].join('\n'));
}

// ---------- the log book ----------

function handleSighting(fields) {
  const name = clean(fields['what to call you'], 40) || user;
  if (!name) return finish(false, 'i could not read a name for this one, so nothing was added.');
  const entry = {
    name,
    where: clean(fields['where are you writing from'], 40),
    note: clean(fields['one line'], 140),
    issue: number,
    added: new Date().toISOString().slice(0, 10),
  };
  const log = readJson('data/logbook.json').filter((e) => e.issue !== number);
  log.unshift(entry);
  writeJson('data/logbook.json', log);
  finish(true, 'signed. thank you for stopping by.');
}

// ---------- route ----------

(async () => {
  try {
    const fields = parseForm(body);
    if (/^\[paddock\]/i.test(title)) return await handleHorse(fields);
    if (/^\[log\]/i.test(title)) return handleSighting(fields);
    finish(false, 'this issue was not opened from one of the forms, so i left it alone.');
  } catch (err) {
    finish(false, `something went wrong handling this one, so nothing was added: ${String(err.message).slice(0, 200)}`);
  }
})();
