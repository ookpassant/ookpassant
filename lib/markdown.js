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

// render markdown to the HTML that actually goes on the page.
function render(body) {
  return plates(md.render(body));
}

// does this note carry footnotes? the sidenote layout only loads for ones that do.
function hasFootnotes(html) {
  return html.includes('class="endnotes"');
}

module.exports = { render, hasFootnotes };
