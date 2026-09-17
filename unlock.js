// opens a note locked by lock.js and prints the plaintext.
//
//   SITE_LOCK_PASS='...' node unlock.js notes/2026-09-16-something.md.enc
//   node unlock.js notes/2026-09-16-something.md.enc        (asks, echo muted)
//
// prints to stdout. redirect it into drafts/ (gitignored) if you want it on
// disk; this script never writes anything itself.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { parse, serialise } = require('./lib/frontmatter');
const { open } = require('./lib/lockbox');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = function (s) { if (s.trim() && !s.includes(question)) return; rl.output.write(s); };
    rl.question(question, (answer) => { rl.output.write('\n'); rl.close(); resolve(answer); });
  });
}

async function main() {
  const source = process.argv.slice(2).filter((a) => a !== '--')[0];
  if (!source) {
    console.error('usage: node unlock.js <path-to-note.md.enc>');
    process.exit(1);
  }
  if (!fs.existsSync(source)) {
    console.error(`no such file: ${source}`);
    process.exit(1);
  }

  const { data, body } = parse(fs.readFileSync(source, 'utf8'));

  let envelope;
  try {
    envelope = JSON.parse(body.trim());
  } catch {
    console.error(`${source} does not contain a readable envelope.`);
    process.exit(1);
  }

  const passphrase = process.env.SITE_LOCK_PASS || (await ask('passphrase: '));
  if (!passphrase) {
    console.error('no passphrase given.');
    process.exit(1);
  }

  let secret;
  try {
    secret = JSON.parse(open(envelope, passphrase));
  } catch {
    // GCM fails the auth tag on a wrong key, so this is the only signal there is.
    console.error('that passphrase did not open it.');
    process.exit(1);
  }

  // a listed note keeps its metadata in cleartext; a hidden one carries it
  // inside the envelope. either way, reassemble the whole note.
  //
  // `lock: true` stays in the output on purpose. it is what .githooks/pre-commit
  // greps for, so if this plaintext ever gets saved into the repo and staged,
  // the guard still catches it. it is also what lock.js requires to re-seal.
  const meta = { ...data, ...secret };
  delete meta.body;

  process.stdout.write(serialise(meta) + secret.body + '\n');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
