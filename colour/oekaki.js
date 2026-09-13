// The colouring board at /colour/.
//
// Two layers. The paint layer is a plain canvas you draw on. The lineart sits
// on top of it, composited with multiply, so white in the base goes transparent
// and only the black lines survive — which means the base can be any png with a
// white background and the lines always stay on top of the colour.
//
// Set these two after deploying the worker (see worker/README.md).
const WORKER = 'https://pound.ookpassant.workers.dev';
const TURNSTILE_SITE_KEY = '';

const BASE = '/pound/base.png';
const SIZE = 800;

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

paint.width = paint.height = lines.width = lines.height = SIZE;

const state = {
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

const UNDO_DEPTH = 12;

function snapshot() {
  state.undo.push(pctx.getImageData(0, 0, SIZE, SIZE));
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
  state.redo.push(pctx.getImageData(0, 0, SIZE, SIZE));
  pctx.putImageData(prev, 0, 0);
  refreshHistory();
}

function redo() {
  const next = state.redo.pop();
  if (!next) return;
  state.undo.push(pctx.getImageData(0, 0, SIZE, SIZE));
  pctx.putImageData(next, 0, 0);
  refreshHistory();
}

// ---------- pointer position ----------

function at(event) {
  const box = paint.getBoundingClientRect();
  return {
    x: Math.round(((event.clientX - box.left) / box.width) * SIZE),
    y: Math.round(((event.clientY - box.top) / box.height) * SIZE),
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

/**
 * Fills against what you can actually see, not against the paint layer alone —
 * otherwise every fill would spill straight through the lineart, which is
 * transparent as far as the paint layer is concerned.
 */
function bucket(start) {
  if (start.x < 0 || start.y < 0 || start.x >= SIZE || start.y >= SIZE) return;

  const flat = document.createElement('canvas');
  flat.width = flat.height = SIZE;
  const fctx = flat.getContext('2d', { willReadFrequently: true });
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, SIZE, SIZE);
  fctx.drawImage(paint, 0, 0);
  fctx.globalCompositeOperation = 'multiply';
  fctx.drawImage(lines, 0, 0);

  const seen = fctx.getImageData(0, 0, SIZE, SIZE).data;
  const out = pctx.getImageData(0, 0, SIZE, SIZE);
  const px = out.data;

  const head = (start.y * SIZE + start.x) * 4;
  const target = [seen[head], seen[head + 1], seen[head + 2]];

  const fill = hexToRgb(state.colour);
  const tolerance = 42 * 42 * 3;

  const matches = (i) => {
    const dr = seen[i] - target[0];
    const dg = seen[i + 1] - target[1];
    const db = seen[i + 2] - target[2];
    return dr * dr + dg * dg + db * db <= tolerance;
  };

  const done = new Uint8Array(SIZE * SIZE);
  const stack = [start.y * SIZE + start.x];

  while (stack.length) {
    let cell = stack.pop();
    if (done[cell]) continue;

    // walk left and right along this row, then push the rows above and below
    const row = Math.floor(cell / SIZE);
    let left = cell;
    while (left % SIZE > 0 && !done[left - 1] && matches((left - 1) * 4)) left--;
    let right = cell;
    while (right % SIZE < SIZE - 1 && !done[right + 1] && matches((right + 1) * 4)) right++;

    for (let i = left; i <= right; i++) {
      done[i] = 1;
      const p = i * 4;
      px[p] = fill.r; px[p + 1] = fill.g; px[p + 2] = fill.b; px[p + 3] = 255;
      if (row > 0) { const up = i - SIZE; if (!done[up] && matches(up * 4)) stack.push(up); }
      if (row < SIZE - 1) { const down = i + SIZE; if (!done[down] && matches(down * 4)) stack.push(down); }
    }
  }

  pctx.putImageData(out, 0, 0);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
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

// tools
for (const button of document.querySelectorAll('[data-tool]')) {
  button.addEventListener('click', () => {
    state.tool = button.dataset.tool;
    for (const b of document.querySelectorAll('[data-tool]')) {
      b.setAttribute('aria-pressed', String(b === button));
    }
    paint.dataset.tool = state.tool;
  });
}

// swatches
const swatchBox = $('swatches');
SWATCHES.forEach((hex, i) => {
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
});

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
  if (!confirm('Clear the whole thing and start again?')) return;
  snapshot();
  pctx.clearRect(0, 0, SIZE, SIZE);
});

document.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea')) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
  }
});

// ---------- export ----------

function flatten() {
  const out = document.createElement('canvas');
  out.width = out.height = SIZE;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fdf9f1';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(paint, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lines, 0, 0);
  return out;
}

$('download').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = 'my-dog.png';
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

function hasPaint() {
  const { data } = pctx.getImageData(0, 0, SIZE, SIZE);
  for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 8) return true;
  return false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!hasPaint()) return say("there's no colour on him yet.", 'bad');

  const button = $('submit');
  button.disabled = true;
  say('sending…');

  const turnstile = TURNSTILE_SITE_KEY && window.turnstile
    ? window.turnstile.getResponse()
    : '';

  try {
    const res = await fetch(`${WORKER}/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: $('dog-name').value,
        artist: $('artist').value,
        link: $('link').value,
        turnstile,
        png: flatten().toDataURL('image/png'),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'that did not go through');
    form.hidden = true;
    say(`${$('dog-name').value} is on chelsea's desk. she looks through them by hand, so give her a day or two.`, 'good');
  } catch (err) {
    // A failed fetch reads as "Failed to fetch", which tells nobody anything.
    const offline = err instanceof TypeError;
    say(offline
      ? "couldn't reach the pound just now. your drawing is still here — check your connection and try again, or save it and send it another way."
      : String(err.message), 'bad');
    button.disabled = false;
    if (TURNSTILE_SITE_KEY && window.turnstile) window.turnstile.reset();
  }
});

// ---------- boot ----------

const base = new Image();
base.crossOrigin = 'anonymous';
base.onload = () => {
  lctx.clearRect(0, 0, SIZE, SIZE);
  lctx.drawImage(base, 0, 0, SIZE, SIZE);
  state.ready = true;
  $('board').dataset.ready = 'true';
  refreshHistory();
};
base.onerror = () => say('the dog would not load. try refreshing.', 'bad');
base.src = BASE;

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
