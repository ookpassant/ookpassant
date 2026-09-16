// the one markdown renderer. build.js uses it for public notes; lock.js uses it
// for locked ones, because a locked note is encrypted as rendered HTML — the
// browser gets no markdown parser, it just decrypts and inserts.
//
// keep this file the single source of truth for how a note becomes HTML. if the
// two ever diverge, a locked note starts rendering differently from a public one
// and you will not notice until somebody tells you.

const md = require('markdown-it')({ html: true, linkify: true, typographer: true })
  .use(require('markdown-it-footnote'));

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

// a table of four columns does not fit a phone, and the choice is between
// squeezing it until the words break one letter to a line and letting it scroll
// sideways inside its own box. wrap each one so it can scroll.
function tables(html) {
  return html.replace(/<table>([\s\S]*?)<\/table>/g,
    (whole) => `<div class="table-scroll" tabindex="0" role="region" aria-label="table, scrolls sideways">${whole}</div>`);
}

// render markdown to the HTML that actually goes on the page.
function render(body) {
  return tables(videos(plates(md.render(body))));
}

// does this note carry footnotes? the sidenote layout only loads for ones that do.
function hasFootnotes(html) {
  return html.includes('class="endnotes"');
}

module.exports = { render, hasFootnotes };
