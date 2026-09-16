// turns a plaintext note into the encrypted file that gets committed.
//
//   npm run lock -- drafts/2026-09-16-something.md
//
// the plaintext never enters the repo. keep it in drafts/ (gitignored) or in
// Drive; this script only reads it. what lands in notes/ is ciphertext.
//
// front matter it cares about:
//   lock: true        required, or there is nothing to do here
//   listed: true      title and summary stay readable, body is encrypted
//   listed: false     title is encrypted too and the file gets an opaque name
//   slug: xyz         for hidden notes, keeps the URL stable across re-locks
//   hint: ...         shown on the lock screen, public either way
//
// the passphrase comes from SITE_LOCK_PASS, or it asks. it is never written
// anywhere. changing it means re-running this on every locked note.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const { parse, bool, serialise } = require('./lib/frontmatter');
const { render } = require('./lib/markdown');
const { seal, open } = require('./lib/lockbox');

const NOTES = path.join(__dirname, 'notes');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // mute the echo so the passphrase does not end up in a screen share or a
    // terminal scrollback that outlives the session.
    rl._writeToOutput = function (s) { if (s.trim() && !s.includes(question)) return; rl.output.write(s); };
    rl.question(question, (answer) => { rl.output.write('\n'); rl.close(); resolve(answer); });
  });
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const source = args[0];
  if (!source) {
    console.error('usage: npm run lock -- <path-to-plaintext.md>');
    process.exit(1);
  }
  if (!fs.existsSync(source)) {
    console.error(`no such file: ${source}`);
    process.exit(1);
  }

  const { data, body } = parse(fs.readFileSync(source, 'utf8'));

  if (!bool(data.lock)) {
    console.error(`${source} is not marked "lock: true" — refusing to guess. add it to the front matter.`);
    process.exit(1);
  }
  if (!data.title) {
    console.error(`${source} has no title.`);
    process.exit(1);
  }

  const listed = bool(data.listed, true);
  const stamp = source.match(/(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  const date = data.date || (stamp ? stamp[1] : null);
  if (!date) {
    console.error(`${source} needs a date, in the filename as YYYY-MM-DD-slug.md or in the front matter.`);
    process.exit(1);
  }

  const passphrase = process.env.SITE_LOCK_PASS || (await ask('passphrase: '));
  if (!passphrase) {
    console.error('no passphrase given.');
    process.exit(1);
  }
  if (passphrase.length < 12) {
    console.error('that passphrase is too short to publish ciphertext against. use several random words.');
    process.exit(1);
  }

  const html = render(body);

  // what stays readable in the public repo, and what goes inside the envelope,
  // is the whole difference between a listed note and a hidden one.
  const secret = listed
    ? { body: html }
    : { title: data.title, summary: data.summary || '', category: data.category || 'note', date, body: html };

  const envelope = seal(JSON.stringify(secret), passphrase);

  if (open(envelope, passphrase) !== JSON.stringify(secret)) {
    console.error('the sealed note did not open again. refusing to write it.');
    process.exit(1);
  }

  const slug = data.slug || (listed ? stamp && stamp[2] : crypto.randomBytes(5).toString('hex'));
  if (!slug) {
    console.error('could not work out a slug. name the file YYYY-MM-DD-slug.md or set slug in the front matter.');
    process.exit(1);
  }

  // a listed note keeps the fields the index needs in cleartext, `order` among
  // them: drop it and the note silently sorts to the end of its group.
  const meta = listed
    ? {
        title: data.title, summary: data.summary || '', category: data.category || 'note', date,
        ...(data.order !== undefined ? { order: data.order } : {}),
        lock: true, listed: true, ...(data.hint ? { hint: data.hint } : {}),
      }
    : { lock: true, listed: false, ...(data.hint ? { hint: data.hint } : {}) };

  const out = path.join(NOTES, listed ? `${date}-${slug}.md.enc` : `_${slug}.enc`);
  fs.mkdirSync(NOTES, { recursive: true });
  fs.writeFileSync(out, serialise(meta) + JSON.stringify(envelope) + '\n');

  console.log(`\nlocked  ${path.relative(__dirname, out)}`);
  console.log(`url     /notes/${slug}/`);
  if (!listed) {
    console.log(`title   ${data.title}  (encrypted — the repo does not know this)`);
    console.log('\nkeep a note of that slug somewhere that is not this repo.');
    console.log(`to keep the URL stable when you re-lock, put "slug: ${slug}" in the plaintext front matter.`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
