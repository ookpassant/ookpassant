// The paddock's letterbox.
//
// The site is static, so it has nowhere to POST a drawing. This worker is that
// somewhere. It takes a finished colouring from /colour/, parks the png in KV,
// and opens a GitHub issue with the image showing inline so Chelsea can look
// through submissions and label the ones she wants.
//
// Nothing here publishes anything. The issue still needs the "approved" label
// before the Action puts a horse on the profile.
//
// Bindings (see wrangler.toml):
//   PADDOCK          KV namespace, holds the pngs and the rate-limit counters
//   GITHUB_TOKEN   secret, fine-grained PAT with issues:write on the repo
//   TURNSTILE_SECRET  secret, optional. Without it the turnstile check is skipped.

const REPO = 'ookpassant/ookpassant';
const MAX_PNG = 2 * 1024 * 1024;
const KEEP_DAYS = 60;
const RATE_LIMIT = 5;         // let-it-free submissions per ip per hour
const ADOPT_LIMIT = 40;       // adoptions per ip per hour
const ADOPT_REMEMBER = 400;   // days an "this ip already adopted that one" marker lives
const ALLOWED_ORIGINS = new Set([
  'https://chelseahopkins.co.uk',
  'https://www.chelseahopkins.co.uk',
  'http://localhost:8080',
]);

// ---------- small helpers ----------

/** Same allowlist the Action uses. Anything else is dropped, not escaped. */
function clean(value, max) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\p{L}\p{N} .,!?'&():+/-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

function safeLink(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length > 200) return '';
  return /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(\/[\w\-./?%&=+#~]*)?$/i.test(raw) ? raw : '';
}

function cors(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://chelseahopkins.co.uk';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    'vary': 'origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(origin) },
  });
}

/** Decode base64 without pulling in a library. */
function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Read width and height straight out of the PNG's IHDR chunk. */
function pngSize(bytes) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function underRateLimit(env, ip, bucket = 'send', cap = RATE_LIMIT) {
  if (!ip) return true;
  const hour = Math.floor(Date.now() / 3_600_000);
  const key = `rl:${bucket}:${hour}:${ip}`;
  const seen = Number((await env.PADDOCK.get(key)) || 0);
  if (seen >= cap) return false;
  await env.PADDOCK.put(key, String(seen + 1), { expirationTtl: 3600 });
  return true;
}

/** An address is never stored, only a hash of it against the one horse. */
async function adopterKey(slug, ip) {
  const bytes = new TextEncoder().encode(`${slug}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `took:${slug}:${hex}`;
}

async function turnstileOk(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // not configured yet
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token || '');
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({ success: false }));
  return data.success === true;
}

// ---------- routes ----------

async function submit(request, env) {
  const origin = request.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'not from there.' }, 403, origin);

  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!(await underRateLimit(env, ip))) {
    return json({ error: 'too many. try in an hour.' }, 429, origin);
  }

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: "couldn't read that." }, 400, origin); }

  if (!(await turnstileOk(env, payload.turnstile, ip))) {
    return json({ error: 'robot check failed. try again.' }, 400, origin);
  }

  const name = clean(payload.name, 40);
  if (!name) return json({ error: 'it needs a name.' }, 400, origin);
  const artist = clean(payload.artist, 40);
  if (!artist) return json({ error: 'i need a name to credit.' }, 400, origin);
  const link = safeLink(payload.link);
  const base = clean(payload.base, 24);

  const b64 = String(payload.png || '').replace(/^data:image\/png;base64,/, '');
  if (!b64 || b64.length > MAX_PNG * 1.4) return json({ error: 'too big.' }, 413, origin);

  let bytes;
  try { bytes = fromBase64(b64); }
  catch { return json({ error: "that didn't arrive in one piece." }, 400, origin); }
  if (bytes.length > MAX_PNG) return json({ error: 'too big.' }, 413, origin);

  const size = pngSize(bytes);
  if (!size) return json({ error: "that's not a png." }, 400, origin);
  if (size.width > 2000 || size.height > 2000) return json({ error: 'too big.' }, 413, origin);

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  await env.PADDOCK.put(`img:${id}`, bytes, { expirationTtl: KEEP_DAYS * 86400 });

  const imageUrl = `${new URL(request.url).origin}/i/${id}.png`;
  const body = [
    '### horse name', '', name, '',
    '### which base', '', base || 'unknown', '',
    '### coloured by', '', artist, '',
    '### the colouring', '', `![${name}](${imageUrl})`, '',
    '### link back to you', '', link || '_No response_', '',
    '---', '',
    `<sub>From chelseahopkins.co.uk/colour. Image held ${KEEP_DAYS} days; approving copies a re-encoded png into the repo.</sub>`,
  ].join('\n');

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'paddock-worker',
    },
    body: JSON.stringify({ title: `[paddock] ${name}`, body, labels: ['paddock'] }),
  });

  if (!res.ok) {
    console.log('github rejected the issue', res.status, (await res.text()).slice(0, 300));
    await env.PADDOCK.delete(`img:${id}`);
    return json({ error: "didn't send. try again in a minute." }, 502, origin);
  }

  const issue = await res.json();
  return json({ ok: true, issue: issue.number, url: issue.html_url }, 200, origin);
}

// ---------- adopting ----------

/**
 * One adoption per address per horse, and the address is only ever kept as a
 * hash. A horse with one adoption is safe from the glue factory; the rest of
 * the count is just bragging.
 */
async function adopt(request, env) {
  const origin = request.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: 'not from there.' }, 403, origin);

  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!(await underRateLimit(env, ip, 'adopt', ADOPT_LIMIT))) {
    return json({ error: 'steady on. try in an hour.' }, 429, origin);
  }

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: "couldn't read that." }, 400, origin); }

  const slug = String(payload.slug || '');
  if (!/^[a-z0-9-]{1,50}$/.test(slug)) return json({ error: 'no such horse.' }, 400, origin);

  const mine = await adopterKey(slug, ip);
  const already = await env.PADDOCK.get(mine);
  const countKey = `adopt:${slug}`;
  let count = Number((await env.PADDOCK.get(countKey)) || 0);

  if (!already) {
    count += 1;
    await env.PADDOCK.put(countKey, String(count));
    await env.PADDOCK.put(mine, '1', { expirationTtl: ADOPT_REMEMBER * 86400 });
  }

  return json({ ok: true, slug, count, already: Boolean(already) }, 200, origin);
}

/** Every horse's adoption count, for the gallery and the README render. */
async function counts(request, env) {
  const origin = request.headers.get('origin') || '';
  const out = {};
  let cursor;
  do {
    const page = await env.PADDOCK.list({ prefix: 'adopt:', cursor });
    for (const key of page.keys) out[key.name.slice('adopt:'.length)] = 0;
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  await Promise.all(Object.keys(out).map(async (slug) => {
    out[slug] = Number((await env.PADDOCK.get(`adopt:${slug}`)) || 0);
  }));

  return new Response(JSON.stringify(out), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60',
      ...cors(origin),
    },
  });
}

async function image(id, env) {
  const bytes = await env.PADDOCK.get(`img:${id}`, { type: 'arrayBuffer' });
  if (!bytes) return new Response('gone', { status: 404 });
  return new Response(bytes, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=3600',
      'content-security-policy': "default-src 'none'; sandbox",
      'x-content-type-options': 'nosniff',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

    if (request.method === 'POST' && url.pathname === '/submit') return submit(request, env);
    if (request.method === 'POST' && url.pathname === '/adopt') return adopt(request, env);
    if (request.method === 'GET' && url.pathname === '/counts') return counts(request, env);

    const img = url.pathname.match(/^\/i\/([a-f0-9]{20})\.png$/);
    if (request.method === 'GET' && img) return image(img[1], env);

    return new Response('hold your horsies.', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    });
  },
};
