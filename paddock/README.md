# hold your horsies

colour it in, let it free, someone will adopt it. thirty days unadopted and the
horse goes to the glue factory (greyed out on the page — nothing is deleted).

`bases/` holds the horses people colour in. `bases.json` says which ones the
board offers, in order. `horses/` is written by the workflow and shouldn't be
edited by hand.

## the base

`bases/horse.png` is a **placeholder** — a grey box at roughly the right
proportions. Replace it with the charcoal horse, same filename.

Any size, any shape. The board reads the file's own dimensions and shapes the
canvas to suit, so a tall drawing stays tall.

## preparing a scan

Scans come in grey. The board composites the lineart with multiply, so grey in
the "white" sits over the colour underneath like a film. Run each one through:

```sh
npm i --no-save sharp
node paddock/prepare.js ~/scans/horse.jpg paddock/bases/horse.png
```

Paper to pure white, marks deepened, margin trimmed, size capped. Soft brush
edges are left alone — flattening those to hard black makes charcoal look like
clip art.

If a grey film survives, raise `PAPER` in that script. If faint brushwork
disappears, lower it.

## adding a second horse

Drop the png in `bases/` and add a line to `bases.json`:

```json
{ "id": "rearing", "file": "rearing.png", "name": "up on its back legs" }
```

A chooser appears on the board as soon as there's more than one; with a single
base it stays hidden. `id` is recorded against every submission, so keep it
stable once it's live. `name` shows under the thumbnail.

## the clock

Each horse carries a `freed` date. `/paddock/adopt.js` works out on page load
whether it's safe, running out, or glue, using adoption counts fetched live from
the worker — a build only happens on push and the clock doesn't care about
pushes.

The README can't do that, so it's a snapshot. `.github/workflows/glue.yml`
re-renders it daily and commits if anything moved.

## pardoning a horse

There's no undo in the game, but there is one here: adjust its `freed` date in
`data/paddock.json` and re-render. Nobody will know.

## removing a colouring

Delete its png from `horses/`, delete its entry from `data/paddock.json`, then
run `node .github/scripts/render-readme.js` and commit.
