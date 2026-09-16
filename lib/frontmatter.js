// the same deliberately small front matter parser the site has always used:
// one `key: value` per line, no nesting, no lists. it is not YAML and does not
// want to be. quotes around a value are stripped so a summary can contain a colon.

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parse(src) {
  const m = src.match(FENCE);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return { data, body: m[2] };
}

// front matter values arrive as strings, so `listed: false` is the string
// "false", which is truthy. every boolean in this codebase goes through here.
const bool = (value, fallback = false) =>
  value === undefined ? fallback : String(value).trim().toLowerCase() === 'true';

function serialise(data) {
  return `---\n${Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n`;
}

module.exports = { parse, bool, serialise };
