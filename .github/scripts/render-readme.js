// Rewrites the paddock and log book blocks in README.md from data/*.json.
//   node .github/scripts/render-readme.js
// Safe to run any time; it only touches text between the marker comments.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPO = 'ookpassant/ookpassant';
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
function renderPaddock(horses) {
  if (!horses.length) {
    return '<p><em>nothing in here yet.</em></p>';
  }
  const cell = (h) => [
    '<td align="center" width="25%" valign="top">',
    `<img src="paddock/horses/${d.slug}.png" alt="${esc(d.name)}, coloured in" width="150"><br>`,
    `<b>${esc(d.name)}</b><br>`,
    // The artist names themselves in the colouring form, so they aren't
    // necessarily a GitHub account. Only link where they gave us somewhere.
    d.link
      ? `<sub>coloured by <a href="${esc(d.link)}">${esc(d.artist)}</a></sub>`
      : `<sub>coloured by ${esc(d.artist)}</sub>`,
    '</td>',
  ].join('\n');

  const rows = [];
  for (let i = 0; i < horses.length; i += PER_ROW) {
    const group = horses.slice(i, i + PER_ROW);
    const pad = Array(PER_ROW - group.length).fill('<td width="25%"></td>');
    rows.push('<tr>\n' + group.map(cell).concat(pad).join('\n') + '\n</tr>');
  }
  const count = horses.length === 1 ? 'one horse' : `${horses.length} horses`;
  return `<table>\n${rows.join('\n')}\n</table>\n\n<sub>${count}. more at <a href="https://chelseahopkins.co.uk/paddock/">chelseahopkins.co.uk/paddock</a>. colouring belongs to whoever is named under it.</sub>`;
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
const readmePath = path.join(ROOT, 'README.md');
let readme = fs.readFileSync(readmePath, 'utf8');
readme = replaceBlock(readme, 'paddock', renderPaddock(read('data/paddock.json')));
readme = replaceBlock(readme, 'logbook', renderLog(read('data/logbook.json')));
fs.writeFileSync(readmePath, readme);
console.log('README rendered');
