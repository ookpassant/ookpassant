// The adoption board at /paddock/.
//
// Every horse carries the date it was let free. Thirty days later, if nobody
// has adopted it, it goes to the glue factory — and stays there, because the
// joke doesn't work if you can pay the ransom late.
//
// Counts live in the worker, not in the repo, so the page fetches them. A build
// only happens on push, and the clock doesn't care about pushes.

const WORKER = 'https://paddock.ookpassant.workers.dev';
const SITE = 'https://chelseahopkins.co.uk';
const DAYS = 30;
const DAY = 86_400_000;
const BADGE = 150;

const board = document.getElementById('board');
if (board) run();

function daysSince(iso) {
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / DAY);
}

function gluedOn(iso) {
  const then = Date.parse(`${iso}T00:00:00Z`);
  return new Date(then + DAYS * DAY).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Whoever adopted what, so a reload doesn't offer you the same button again. */
function remembered() {
  try { return new Set(JSON.parse(localStorage.getItem('adopted') || '[]')); }
  catch { return new Set(); }
}

function remember(slug) {
  try {
    const mine = remembered();
    mine.add(slug);
    localStorage.setItem('adopted', JSON.stringify([...mine]));
  } catch { /* private window, or storage is off. the worker still knows. */ }
}

async function run() {
  const cards = [...board.querySelectorAll('.horse')];
  if (!cards.length) return;

  let counts = {};
  let reachable = true;
  try {
    const res = await fetch(`${WORKER}/counts`);
    if (!res.ok) throw new Error(String(res.status));
    counts = await res.json();
  } catch {
    reachable = false;
  }

  const mine = remembered();
  const glue = document.getElementById('glue-list');
  let doomed = 0;
  let looking = 0;

  for (const card of cards) {
    const slug = card.dataset.slug;
    const freed = card.dataset.freed;
    const count = Number(counts[slug] || 0);
    const age = daysSince(freed);
    const left = DAYS - age;

    const tally = card.querySelector('.tally');
    const button = card.querySelector('.adopt');
    const clock = card.querySelector('.clock');

    // Without the worker there is no count, so nothing can be declared doomed.
    if (!reachable) {
      clock.textContent = 'counting later';
      button.disabled = true;
      looking += 1;
      continue;
    }

    tally.textContent = count === 1 ? '1 adoption' : `${count} adoptions`;

    if (count === 0 && left <= 0) {
      card.classList.add('glued');
      clock.textContent = `went to glue on ${gluedOn(freed)}`;
      button.textContent = 'too late';
      button.disabled = true;
      glue.append(card);
      doomed += 1;
      continue;
    }

    looking += 1;

    if (count > 0) {
      clock.textContent = 'safe';
      card.classList.add('safe');
    } else if (left === 1) {
      clock.textContent = 'one day left';
      card.classList.add('urgent');
    } else {
      clock.textContent = `${left} days left`;
      if (left <= 7) card.classList.add('urgent');
    }

    if (mine.has(slug)) {
      button.textContent = 'adopted';
      button.disabled = true;
      papers(card);
    }

    button.addEventListener('click', () => take(slug, card, button, tally, clock));
  }

  document.getElementById('board').hidden = looking === 0;
  document.getElementById('nothing-looking').hidden = looking !== 0;
  document.getElementById('glue').hidden = doomed === 0;
  stable();
}

// ---------- adoption papers ----------

/** The whole point of an adoptable: code to paste somewhere that isn't here. */
function snippet(format, slug, name) {
  const img = `${SITE}/paddock/horses/${slug}.png`;
  const home = `${SITE}/paddock/`;
  if (format === 'html') {
    return `<a href="${home}"><img src="${img}" alt="${name}, adopted" width="${BADGE}"></a>`;
  }
  if (format === 'bbcode') {
    return `[url=${home}][img]${img}[/img][/url]`;
  }
  return `[![${name}](${img})](${home})`;
}

function papers(card) {
  const box = card.querySelector('.papers');
  if (!box || box.dataset.wired) return;
  box.dataset.wired = '1';
  box.hidden = false;

  const slug = card.dataset.slug;
  const name = card.querySelector('b').textContent;
  const pick = box.querySelector('select');
  const out = box.querySelector('textarea');
  const copy = box.querySelector('.copy');

  const refresh = () => { out.value = snippet(pick.value, slug, name); };
  refresh();

  pick.addEventListener('change', refresh);
  copy.addEventListener('click', async () => {
    out.select();
    try {
      await navigator.clipboard.writeText(out.value);
    } catch {
      document.execCommand('copy'); // older browsers, and anywhere clipboard is blocked
    }
    copy.textContent = 'copied';
    setTimeout(() => { copy.textContent = 'copy'; }, 1600);
  });
}

/**
 * Everything this browser has adopted, in one block, for a profile readme.
 * Runs again after every adoption, so it reads the adopted set fresh each time
 * rather than closing over the list it saw first.
 */
function stable() {
  const wrap = document.getElementById('stable');
  if (!wrap) return;

  const pick = wrap.querySelector('select');
  const out = wrap.querySelector('textarea');
  const copy = wrap.querySelector('.copy');

  const refresh = () => {
    const mine = remembered();
    const cards = [...document.querySelectorAll('.horse')].filter((c) => mine.has(c.dataset.slug));
    if (!cards.length) return false;
    wrap.hidden = false;
    wrap.querySelector('.count').textContent =
      cards.length === 1 ? 'one horse' : `${cards.length} horses`;
    out.value = cards
      .map((c) => snippet(pick.value, c.dataset.slug, c.querySelector('b').textContent))
      .join(pick.value === 'markdown' ? ' ' : '\n');
    out.rows = Math.min(6, cards.length + 1);
    return true;
  };

  if (!refresh()) return;

  if (wrap.dataset.wired) return;
  wrap.dataset.wired = '1';

  pick.addEventListener('change', refresh);
  copy.addEventListener('click', async () => {
    out.select();
    try {
      await navigator.clipboard.writeText(out.value);
    } catch {
      document.execCommand('copy'); // older browsers, and anywhere clipboard is blocked
    }
    copy.textContent = 'copied';
    setTimeout(() => { copy.textContent = 'copy the lot'; }, 1600);
  });
}

async function take(slug, card, button, tally, clock) {
  button.disabled = true;
  const was = button.textContent;
  button.textContent = 'adopting';
  try {
    const res = await fetch(`${WORKER}/adopt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'no good');
    remember(slug);
    button.textContent = 'adopted';
    tally.textContent = data.count === 1 ? '1 adoption' : `${data.count} adoptions`;
    clock.textContent = 'safe';
    card.classList.remove('urgent');
    card.classList.add('safe');
    papers(card);
    stable();
  } catch (err) {
    button.textContent = was;
    button.disabled = false;
    clock.textContent = String(err.message);
  }
}
