// Turns a scan into a base the colouring board can use.
//
//   npm i --no-save sharp
//   node paddock/prepare.js ~/scans/horse.jpg paddock/bases/horse.png
//
// A scan comes in grey and slightly grubby: the paper is never quite white and
// there's grain in the flat areas. That matters here because the board
// composites the lineart with multiply, so any grey in the "white" shows up as
// a film over the colour underneath. This lifts the paper to pure white,
// deepens the marks, trims the margin, and caps the size — while leaving the
// soft edges of the brushwork alone, since flattening those to hard black is
// what makes charcoal look like clip art.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error('usage: node paddock/prepare.js <scan> <paddock/bases/name.png>');
  process.exit(1);
}

// Anything at or above this is paper and becomes pure white. Raise it if the
// scan is dingy and a grey film survives; lower it if faint brushwork is
// vanishing.
const PAPER = 236;
// Anything at or below this is a confident mark and becomes solid black.
const INK = 60;
const MAX_SIDE = 1400;

(async () => {
  const src = sharp(input).flatten({ background: '#ffffff' }).greyscale();

  // Stretch the range so PAPER..255 all lands on white and 0..INK on black,
  // with a straight ramp between the two. The ramp is what keeps the edges soft.
  const ramp = Buffer.from(Array.from({ length: 256 }, (_, v) => {
    if (v >= PAPER) return 255;
    if (v <= INK) return 0;
    return Math.round(((v - INK) / (PAPER - INK)) * 255);
  }));

  const cleaned = await src.linear(1, 0).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
  const px = cleaned.data;
  for (let i = 0; i < px.length; i++) px[i] = ramp[px[i]];

  let img = sharp(px, {
    raw: { width: cleaned.info.width, height: cleaned.info.height, channels: 1 },
  });

  // Trim the paper margin, then put a small even one back so brushwork that
  // runs to the edge isn't clipped against the canvas border.
  img = sharp(await img.png().toBuffer())
    .trim({ background: '#ffffff', threshold: 8 })
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: '#ffffff' });

  const meta = await sharp(await img.png().toBuffer()).metadata();
  const scale = Math.min(1, MAX_SIDE / Math.max(meta.width, meta.height));

  fs.mkdirSync(path.dirname(output), { recursive: true });
  const done = await sharp(await img.png().toBuffer())
    .resize(Math.round(meta.width * scale), Math.round(meta.height * scale), { kernel: 'lanczos3' })
    .toColourspace('b-w')
    .png({ compressionLevel: 9 })
    .toFile(output);

  console.log(`${path.basename(output)}  ${done.width}×${done.height}  ${Math.round(done.size / 1024)}KB`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
