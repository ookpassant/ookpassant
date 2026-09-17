// the one markdown renderer. build.js uses it for public notes; lock.js uses it
// for locked ones, because a locked note is encrypted as rendered HTML — the
// browser gets no markdown parser, it just decrypts and inserts.
//
// keep this file the single source of truth for how a note becomes HTML. if the
// two ever diverge, a locked note starts rendering differently from a public one
// and you will not notice until somebody tells you.

const fs = require('fs');
const path = require('path');

const md = require('markdown-it')({ html: true, linkify: true, typographer: true })
  .use(require('markdown-it-footnote'));

// read a jpeg's real width and height out of its SOF marker. worth the twenty
// lines: the attributes stop the page jumping when a photo loads, and the ratio
// lets css cap a tall photo's height without squashing it. capping height on the
// image itself does squash it — max-width resolves the width first, then
// max-height resolves the height, and the two do not agree.
function jpegSize(file) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return null;
  }
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xda) return null;
    const len = buf.readUInt16BE(i + 2);
    // SOF0/1/2/9/10, but not DHT (c4), DAC (cc) or the RSTn range
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

// footnotes: markdown-it-footnote's default block is a bare <hr> plus an <ol>.
// we want a labelled section, because at narrow widths the notes are endnotes
// and an unlabelled list at the foot of a long essay reads as debris.
md.renderer.rules.footnote_block_open = () =>
  '<section class="endnotes" aria-label="notes">\n<h2 class="endnotes-head">notes</h2>\n<ol class="endnotes-list">\n';
md.renderer.rules.footnote_block_close = () => '</ol>\n</section>\n';

// a paragraph that is nothing but [diagram: ...] is a note to self about art that
// does not exist yet. render it as a visible empty plate rather than as body
// text, so an unfinished drawing looks unfinished instead of looking like prose.
const PLATE = /<p>\s*\[diagram:\s*([\s\S]*?)\]\s*<\/p>/gi;

function plates(html) {
  return html.replace(PLATE, (_, note) =>
    `<figure class="diagram diagram--empty" role="img" aria-label="diagram not yet drawn: ${note.trim()}">` +
    `<div class="diagram-frame"><span class="diagram-mark">i'm doodling this</span></div>` +
    `<figcaption>${note.trim()}</figcaption></figure>`);
}

// a paragraph that is nothing but [video: <youtube url or id> | title] becomes
// an embedded player. youtube-nocookie means youtube is not told who the reader
// is until they press play, and loading="lazy" means the player is not fetched
// at all for someone who never scrolls that far.
//
// the text after the pipe is the frame's accessible name, not a visible caption.
// the player already shows the video's own title and channel, so printing it
// again underneath just says the same thing twice in a smaller font.
const VIDEO = /<p>\s*\[video:([\s\S]*?)\]\s*<\/p>/gi;
// linkify turns a bare url into an <a> before this runs, so strip tags first and
// pull the id out of whichever youtube url shape was pasted.
const YOUTUBE_ID = /(?:youtu\.be\/|[?&]v=|\/embed\/|^)([A-Za-z0-9_-]{11})(?:[?&#]|$)/;

function videos(html) {
  return html.replace(VIDEO, (whole, inner) => {
    const [ref, ...rest] = inner.replace(/<[^>]+>/g, '').split('|');
    const found = YOUTUBE_ID.exec(ref.trim());
    // an id we cannot read is left on the page as written. a silently swallowed
    // embed is a hole nobody notices until a reader mentions the gap.
    if (!found) return whole;
    const title = rest.join('|').replace(/&[a-z]+;|["<>]/gi, ' ').trim() || 'embedded video';
    return `<figure class="video">` +
      `<div class="video-frame">` +
      `<iframe src="https://www.youtube-nocookie.com/embed/${found[1]}" title="${title}" ` +
      `loading="lazy" referrerpolicy="strict-origin-when-cross-origin" ` +
      `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ` +
      `allowfullscreen></iframe>` +
      `</div>` +
      `</figure>`;
  });
}

// a paragraph that is nothing but [photo: file.jpg | alt text | caption] becomes
// a framed photograph. the alt text is not optional: a photo carrying an
// argument, like the one of the puddle, says nothing at all to a reader using a
// screen reader unless somebody writes down what is in it. the caption is.
const PHOTO = /<p>\s*\[photo:([\s\S]*?)\]\s*<\/p>/gi;

function photos(html) {
  return html.replace(PHOTO, (whole, inner) => {
    const [file, alt, ...rest] = inner.replace(/<[^>]+>/g, '').split('|').map((s) => s.trim());
    // as with [video:], an unreadable one stays on the page as written rather
    // than disappearing quietly.
    if (!file || !alt) return whole;
    const caption = rest.join('|').trim();
    const size = jpegSize(path.join(__dirname, '..', 'assets', 'notes', file));
    const dims = size ? ` width="${size.width}" height="${size.height}"` : '';
    // --ratio is width over height. the stylesheet turns it into a max-width, so
    // a tall photo is limited by its height and a wide one by the column.
    const ratio = size ? ` style="--ratio:${(size.width / size.height).toFixed(4)}"` : '';
    return `<figure class="photo">` +
      `<img src="/assets/notes/${file}" alt="${alt.replace(/"/g, '&quot;')}"${dims}${ratio} loading="lazy" decoding="async">` +
      (caption ? `<figcaption>${caption}</figcaption>` : '') +
      `</figure>`;
  });
}

// a table of four columns does not fit a phone, and the choice is between
// squeezing it until the words break one letter to a line and letting it scroll
// sideways inside its own box. wrap each one so it can scroll.
function tables(html) {
  return html.replace(/<table>([\s\S]*?)<\/table>/g,
    (whole) => `<div class="table-scroll" tabindex="0" role="region" aria-label="table, scrolls sideways">${whole}</div>`);
}

// render markdown to the HTML that actually goes on the page.
function render(body) {
  return tables(photos(videos(plates(md.render(body)))));
}

// does this note carry footnotes? the sidenote layout only loads for ones that do.
function hasFootnotes(html) {
  return html.includes('class="endnotes"');
}

module.exports = { render, hasFootnotes };
