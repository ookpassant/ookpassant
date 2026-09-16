// node half of the lock. the browser half is in unlock.js and the two have to
// agree exactly, so both are written against the same three constants below.
//
// AES-256-GCM, key derived with PBKDF2-SHA256. WebCrypto expects the GCM auth
// tag appended to the ciphertext, so that is how we store it — node hands the
// tag back separately and we concatenate.
//
// the ciphertext is published on a public site. that means an attacker can take
// it away and grind passphrases offline for as long as they like, with no rate
// limit and nobody watching. ITERATIONS is what makes each guess expensive; it
// is not what makes a weak passphrase safe. use several random words.

const crypto = require('crypto');

const ITERATIONS = 600000; // OWASP's PBKDF2-SHA256 floor
const SALT_BYTES = 16;
const IV_BYTES = 12; // 96 bits, the size GCM is specified for
const VERSION = 1;

function deriveKey(passphrase, salt) {
  return crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, 32, 'sha256');
}

// returns the JSON envelope that gets written into a .enc file and read back by
// the browser. everything in it is public except the plaintext it protects.
function seal(plaintext, passphrase) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    v: VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ct: Buffer.concat([body, cipher.getAuthTag()]).toString('base64'),
  };
}

// only used to verify a seal round-trips before we write it to disk. the site
// itself never opens an envelope in node.
function open(envelope, passphrase) {
  if (envelope.v !== VERSION) throw new Error(`unknown envelope version ${envelope.v}`);
  const ct = Buffer.from(envelope.ct, 'base64');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(passphrase, Buffer.from(envelope.salt, 'base64')),
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAuthTag(ct.subarray(ct.length - 16));
  return Buffer.concat([decipher.update(ct.subarray(0, ct.length - 16)), decipher.final()]).toString('utf8');
}

module.exports = { seal, open, ITERATIONS };
