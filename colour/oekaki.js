// The colouring board at /colour/.
//
// Two layers. The paint layer is a plain canvas you draw on. The lineart sits
// on top of it, composited with multiply, so white in the base goes transparent
// and only the drawn marks survive. That means brushwork can be as rough as you
// like — the lines always stay on top of the colour, and you can scribble past
// an edge without burying it.
//
// The bases are brush drawings, so the lines are open in places and the bucket
// will run out through a gap. That's expected; the brush is the main tool here.
//
// Set these two after deploying the worker (see worker/README.md).
const WORKER = 'https://paddock.ookpassant.workers.dev';
const TURNSTILE_SITE_KEY = '';

// Keeps the undo stack affordable on a phone: a tall base gets scaled down so
// no canvas is more than this many pixels.
const MAX_PIXELS = 800_000;
const UNDO_DEPTH = 10;

// A palette that suits the guide: paper and inks, then coats, then a few brights.
const SWATCHES = [
  '#fdf9f1', '#f0e4cc', '#dcc7a0', '#c9962e', '#a8721f', '#7a4f18',
  '#5c3a1e', '#3d2a18', '#2a251d', '#6b6355', '#9a9285', '#c8c2b6',
  '#44503f', '#6e8060', '#9db08f', '#c7d4b6', '#8ab2c8', '#4a7d99',
  '#3b5470', '#7a6a99', '#a8749a', '#c4576b', '#d4763f', '#e0b04a',
];

const $ = (id) => document.getElementById(id);

const paint = $('paint');
const lines = $('lines');
const pctx = paint.getContext('2d', { willReadFrequently: true });
const lctx = lines.getContext('2d', { willReadFrequently: true });

const state = {
  base: null,
  w: 0,
  h: 0,
  tool: 'brush',
  colour: '#c9962e',
  size: 18,
  drawing: false,
  last: null,
  undo: [],
  redo: [],
  ready: false,
};

// ---------- history ----------

function snapshot() {
  state.undo.push(pctx.getImageData(0, 0, state.w, state.h));
  if (state.undo.length > UNDO_DEPTH) state.undo.shift();
  state.redo.length = 0;
  refreshHistory();
}

function refreshHistory() {
  $('undo').disabled = state.undo.length === 0;
  $('redo').disabled = state.redo.length === 0;
}

function undo() {
  const prev = state.undo.pop();
  if (!prev) return;
  state.redo.push(pctx.getImageData(0, 0, state.w, state.h));
  pctx.putImageData(prev, 0, 0);
  refreshHistory();
}

function redo() {
  const next = state.redo.pop();
  if (!next) return;
  state.undo.push(pctx.getImageData(0, 0, state.w, state.h));
  pctx.putImageData(next, 0, 0);
  refreshHistory();
}

// ---------- pointer position ----------

function at(event) {
  const box = paint.getBoundingClientRect();
  return {
    x: Math.round(((event.clientX - box.left) / box.width) * state.w),
    y: Math.round(((event.clientY - box.top) / box.height) * state.h),
  };
}

// ---------- brush ----------

function stroke(from, to) {
  pctx.save();
  pctx.globalCompositeOperation = state.tool === 'eraser' ? 'destination-out' : 'source-over';
  pctx.strokeStyle = state.colour;
  pctx.lineWidth = state.size;
  pctx.lineCap = 'round';
  pctx.lineJoin = 'round';
  pctx.beginPath();
  pctx.moveTo(from.x, from.y);
  pctx.lineTo(to.x, to.y);
  pctx.stroke();
  pctx.restore();
}

// ---------- bucket ----------

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Fills against what you can actually see, not against the paint layer alone —
 * otherwise every fill would spill straight through the lineart, which is
 * transparent as far as the paint layer is concerned.
 */
function bucket(start) {
  const { w, h } = state;
  if (start.x < 0 || start.y < 0 || start.x >= w || start.y >= h) return;

  const flat = document.createElement('canvas');
  flat.width = w;
  flat.height = h;
  const fctx = flat.getContext('2d', { willReadFrequently: true });
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, w, h);
  fctx.drawImage(paint, 0, 0);
  fctx.globalCompositeOperation = 'multiply';
  fctx.drawImage(lines, 0, 0);

  const seen = fctx.getImageData(0, 0, w, h).data;
  const out = pctx.getImageData(0, 0, w, h);
  const px = out.data;

  const head = (start.y * w + start.x) * 4;
  const target = [seen[head], seen[head + 1], seen[head + 2]];
  const fill = hexToRgb(state.colour);
  const tolerance = 48 * 48 * 3;

  const matches = (i) => {
    const dr = seen[i] - target[0];
    const dg = seen[i + 1] - target[1];
    const db = seen[i + 2] - target[2];
    return dr * dr + dg * dg + db * db <= tolerance;
  };

  const done = new Uint8Array(w * h);
  const stack = [start.y * w + start.x];

  while (stack.length) {
    const cell = stack.pop();
    if (done[cell]) continue;
    const row = Math.floor(cell / w);

    let left = cell;
    while (left % w > 0 && !done[left - 1] && matches((left - 1) * 4)) left--;
    let right = cell;
    while (right % w < w - 1 && !done[right + 1] && matches((right + 1) * 4)) right++;

    for (let i = left; i <= right; i++) {
      done[i] = 1;
      const p = i * 4;
      px[p] = fill.r; px[p + 1] = fill.g; px[p + 2] = fill.b; px[p + 3] = 255;
      if (row > 0) { const up = i - w; if (!done[up] && matches(up * 4)) stack.push(up); }
      if (row < h - 1) { const down = i + w; if (!done[down] && matches(down * 4)) stack.push(down); }
    }
  }

  creep(done, px, fill, w, h);
  pctx.putImageData(out, 0, 0);
}

/**
 * Charcoal edges fade out over several pixels, so a fill that stops at the
 * first dark pixel leaves a pale rind around every shape. This pushes the
 * colour a couple of pixels further, under the line, where it doesn't show.
 */
function creep(done, px, fill, w, h) {
  for (let pass = 0; pass < 2; pass++) {
    const edge = [];
    for (let i = 0; i < done.length; i++) {
      if (done[i]) continue;
      const x = i % w;
      const y = (i / w) | 0;
      if ((x > 0 && done[i - 1] === 1) || (x < w - 1 && done[i + 1] === 1) ||
          (y > 0 && done[i - w] === 1) || (y < h - 1 && done[i + w] === 1)) {
        edge.push(i);
      }
    }
    for (const i of edge) {
      done[i] = 2;
      const p = i * 4;
      px[p] = fill.r; px[p + 1] = fill.g; px[p + 2] = fill.b; px[p + 3] = 255;
    }
    for (const i of edge) done[i] = 1;
  }
}

// ---------- events ----------

paint.addEventListener('pointerdown', (event) => {
  if (!state.ready) return;
  event.preventDefault();
  paint.setPointerCapture(event.pointerId);
  snapshot();
  const point = at(event);
  if (state.tool === 'bucket') {
    bucket(point);
    return;
  }
  state.drawing = true;
  state.last = point;
  stroke(point, point);
});

paint.addEventListener('pointermove', (event) => {
  if (!state.drawing) return;
  const point = at(event);
  stroke(state.last, point);
  state.last = point;
});

for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  paint.addEventListener(type, () => { state.drawing = false; state.last = null; });
}

for (const button of document.querySelectorAll('[data-tool]')) {
  button.addEventListener('click', () => {
    state.tool = button.dataset.tool;
    for (const b of document.querySelectorAll('[data-tool]')) {
      b.setAttribute('aria-pressed', String(b === button));
    }
    paint.dataset.tool = state.tool;
  });
}

const swatchBox = $('swatches');
for (const hex of SWATCHES) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch';
  b.style.setProperty('--c', hex);
  b.title = hex;
  b.setAttribute('aria-label', `colour ${hex}`);
  b.setAttribute('aria-pressed', String(hex === state.colour));
  b.addEventListener('click', () => {
    state.colour = hex;
    $('custom').value = hex;
    for (const s of swatchBox.children) s.setAttribute('aria-pressed', String(s === b));
  });
  swatchBox.append(b);
}

$('custom').addEventListener('input', (event) => {
  state.colour = event.target.value;
  for (const s of swatchBox.children) s.setAttribute('aria-pressed', 'false');
});

$('size').addEventListener('input', (event) => {
  state.size = Number(event.target.value);
  $('size-out').textContent = event.target.value;
});

$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);

$('clear').addEventListener('click', () => {
  if (painted() && !confirm('Wipe it and start again?')) return;
  snapshot();
  pctx.clearRect(0, 0, state.w, state.h);
});

document.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea')) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo(); else undo();
  }
});

// ---------- export ----------

function flatten() {
  const out = document.createElement('canvas');
  out.width = state.w;
  out.height = state.h;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fdf9f1';
  ctx.fillRect(0, 0, state.w, state.h);
  ctx.drawImage(paint, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lines, 0, 0);
  return out;
}

$('download').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `${state.base ? state.base.id : 'horse'}.png`;
  a.href = flatten().toDataURL('image/png');
  a.click();
});

// ---------- submitting ----------

const form = $('send');
const status = $('status');

function say(message, kind) {
  status.textContent = message;
  status.dataset.kind = kind || '';
}

function painted() {
  if (!state.ready) return false;
  const { data } = pctx.getImageData(0, 0, state.w, state.h);
  for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 8) return true;
  return false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!painted()) return say("you haven't coloured it in.", 'bad');

  const button = $('submit');
  button.disabled = true;
  say('sending');

  const turnstile = TURNSTILE_SITE_KEY && window.turnstile ? window.turnstile.getResponse() : '';

  try {
    const res = await fetch(`${WORKER}/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: $('horse-name').value,
        artist: $('artist').value,
        link: $('link').value,
        base: state.base ? state.base.id : '',
        turnstile,
        png: flatten().toDataURL('image/png'),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'that did not go through');
    form.hidden = true;
    say(`${$('horse-name').value} is away. thirty days to find a home.`, 'good');
  } catch (err) {
    // A failed fetch reads as "Failed to fetch", which tells nobody anything.
    const offline = err instanceof TypeError;
    say(offline
      ? "didn't send. your drawing is still here — try again, or save it."
      : String(err.message), 'bad');
    button.disabled = false;
    if (TURNSTILE_SITE_KEY && window.turnstile) window.turnstile.reset();
  }
});

// ---------- the bases ----------

function loadBase(entry) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`${entry.file} would not load`));
    img.src = `/paddock/bases/${entry.file}`;
  });
}

async function choose(entry, button) {
  if (state.base && state.base.id === entry.id) return;
  if (painted() && !confirm('Switching horse wipes this one. Carry on?')) return;

  $('board').dataset.ready = 'false';
  say('');

  let img;
  try { img = await loadBase(entry); }
  catch (err) { return say(String(err.message), 'bad'); }

  // Scale so the undo stack stays affordable, and keep the drawing's own shape.
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (img.naturalWidth * img.naturalHeight)));
  state.w = Math.max(1, Math.round(img.naturalWidth * scale));
  state.h = Math.max(1, Math.round(img.naturalHeight * scale));

  for (const canvas of [paint, lines]) {
    canvas.width = state.w;
    canvas.height = state.h;
  }
  $('stack').style.setProperty('--ratio', String(state.w / state.h));

  lctx.clearRect(0, 0, state.w, state.h);
  lctx.drawImage(img, 0, 0, state.w, state.h);
  pctx.clearRect(0, 0, state.w, state.h);

  state.base = entry;
  state.undo.length = 0;
  state.redo.length = 0;
  refreshHistory();
  state.ready = true;
  $('board').dataset.ready = 'true';

  for (const b of $('bases').children) b.setAttribute('aria-pressed', String(b === button));
  paint.setAttribute('aria-label', `Colouring canvas: ${entry.name}. Draw with a pointer, or use the tools.`);
}

async function boot() {
  let bases;
  try {
    const res = await fetch('/paddock/bases.json');
    bases = await res.json();
  } catch {
    return say('the horses would not load. refresh.', 'bad');
  }
  if (!Array.isArray(bases) || !bases.length) return say('no horses in here yet.', 'bad');

  const picker = $('bases');
  bases.forEach((entry, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'base';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<img src="/paddock/bases/${entry.file}" alt="" loading="lazy"><span>${entry.name}</span>`;
    b.addEventListener('click', () => choose(entry, b));
    picker.append(b);
    if (i === 0) choose(entry, b);
  });
}

boot();

if (TURNSTILE_SITE_KEY) {
  const holder = $('turnstile');
  holder.hidden = false;
  holder.dataset.sitekey = TURNSTILE_SITE_KEY;
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  s.async = true;
  s.defer = true;
  document.head.append(s);
}
