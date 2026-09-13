// Rewrites the paddock and log book blocks in README.md from data/*.json.
//   node .github/scripts/render-readme.js
// Safe to run any time; it only touches text between the marker comments.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPO = 'ookpassant/ookpassant';
const WORKER_ORIGIN = 'https://paddock.ookpassant.workers.dev';
const PER_ROW = 4;
const LOG_SHOWN = 30;

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const read = (f) => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
  catch { return []; }
};

function replaceBlock(src, name, inner) {
  const re = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(src)) throw new Error(`README is missing the ${name} markers`);
  return src.replace(re, `$1\n${inner}\n$2`);
}

// ---------- the paddock ----------

// A README can't run javascript, so unlike the site this is a snapshot: whoever
// was safe, doomed or already glue at the moment it was rendered. The daily
// re-render in .github/workflows/glue.yml is what keeps it roughly honest.
const DAYS = 30;
const DAY = 86_400_000;

const daysSince = (iso) => {
  const then = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(then) ? 0 : Math.floor((Date.now() - then) / DAY);
};

/** Adoption counts live in the worker. No worker, no verdicts. */
async function adoptions() {
  try {
    const res = await fetch(`${WORKER_ORIGIN}/counts`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (err) {
    console.log('could not reach the worker for counts:', err.message);
    return null;
  }
}

function cell(h, status) {
  return [
    '<td align="center" width="25%" valign="top">',
    `<img src="paddock/horses/${esc(h.slug)}.png" alt="${esc(h.name)}, coloured in" width="150"><br>`,
    `<b>${esc(h.name)}</b><br>`,
    // The artist names themselves in the colouring form, so they aren't
    // necessarily a GitHub account. Only link where they gave us somewhere.
    h.link
      ? `<sub>coloured by <a href="${esc(h.link)}">${esc(h.artist)}</a></sub><br>`
      : `<sub>coloured by ${esc(h.artist)}</sub><br>`,
    `<sub>${status}</sub>`,
    '</td>',
  ].join('\n');
}

function table(horses, status) {
  const rows = [];
  for (let i = 0; i < horses.length; i += PER_ROW) {
    const group = horses.slice(i, i + PER_ROW);
    const pad = Array(PER_ROW - group.length).fill('<td width="25%"></td>');
    rows.push('<tr>\n' + group.map((h) => cell(h, status(h))).concat(pad).join('\n') + '\n</tr>');
  }
  return `<table>\n${rows.join('\n')}\n</table>`;
}

function renderPaddock(horses, counts) {
  if (!horses.length) {
    return '<p><em>nothing loose yet.</em></p>';
  }

  const link = '<a href="https://chelseahopkins.co.uk/paddock/">chelseahopkins.co.uk/paddock</a>';

  if (!counts) {
    return `${table(horses, () => '&nbsp;')}\n\n<sub>adopt them at ${link}.</sub>`;
  }

  const glue = [];
  const loose = [];
  for (const h of horses) {
    const taken = Number(counts[h.slug] || 0);
    const left = DAYS - daysSince(h.freed || '');
    (taken === 0 && left <= 0 ? glue : loose).push({ ...h, taken, left });
  }

  const status = (h) => {
    if (h.taken === 1) return 'adopted once';
    if (h.taken > 1) return `adopted ${h.taken} times`;
    if (h.left === 1) return '<b>one day left</b>';
    return `<b>${h.left} days left</b>`;
  };

  const parts = [];
  if (loose.length) {
    parts.push(table(loose, status));
    parts.push(`<sub>adopt them at ${link}. one adoption keeps a horse out of the glue factory.</sub>`);
  } else {
    parts.push('<p><em>nobody left to adopt.</em></p>');
  }

  if (glue.length) {
    parts.push('<h4>the glue factory</h4>');
    parts.push(table(glue, () => 'nobody came'));
  }

  return parts.join('\n\n');
}

// ---------- the log book ----------
function renderLog(entries) {
  if (!entries.length) {
    return '<p><em>nobody has signed it yet.</em></p>';
  }
  const shown = entries.slice(0, LOG_SHOWN);
  const lines = shown.map((e) => {
    const bits = [`**${esc(e.name)}**`];
    if (e.where) bits.push(esc(e.where));
    const head = bits.join(', ');
    return e.note ? `- ${head} · ${esc(e.note)}` : `- ${head}`;
  });
  const more = entries.length > shown.length
    ? `\n\n<sub>${entries.length} sightings logged, showing the most recent ${shown.length}.</sub>`
    : `\n\n<sub>${entries.length} ${entries.length === 1 ? 'sighting' : 'sightings'} logged.</sub>`;
  return lines.join('\n') + more;
}

// ---------- write ----------
(async () => {
  const horses = read('data/paddock.json');
  const counts = horses.length ? await adoptions() : null;

  const readmePath = path.join(ROOT, 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf8');
  readme = replaceBlock(readme, 'paddock', renderPaddock(horses, counts));
  readme = replaceBlock(readme, 'logbook', renderLog(read('data/logbook.json')));
  fs.writeFileSync(readmePath, readme);
  console.log('README rendered');
})();
