// The adoption board at /paddock/.
//
// Every horse carries the date it was let free. Thirty days later, if nobody
// has adopted it, it goes to the glue factory — and stays there, because the
// joke doesn't work if you can pay the ransom late.
//
// Counts live in the worker, not in the repo, so the page fetches them. A build
// only happens on push, and the clock doesn't care about pushes.

const WORKER = 'https://paddock.ookpassant.workers.dev';
const DAYS = 30;
const DAY = 86_400_000;

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
    }

    button.addEventListener('click', () => take(slug, card, button, tally, clock));
  }

  document.getElementById('board').hidden = looking === 0;
  document.getElementById('nothing-looking').hidden = looking !== 0;
  document.getElementById('glue').hidden = doomed === 0;
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
  } catch (err) {
    button.textContent = was;
    button.disabled = false;
    clock.textContent = String(err.message);
  }
}
