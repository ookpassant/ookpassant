# the paddock

`bases/` holds the horses people colour in. `bases.json` says which ones the
board offers, in order. `horses/` is written by the workflow and shouldn't be
edited by hand.

## the bases

The three files in `bases/` are **placeholders** — grey boxes at roughly the
right proportions so the board works before the real drawings land. Replace
them with the charcoal horses, keeping the filenames:

```
bases/grazing.png     head down, grazing
bases/bucking.png     kicking up
bases/charging.png    coming at you
```

Sizes don't need to match each other. The board reads each file's own
dimensions and shapes the canvas to suit, so a tall drawing stays tall.

## preparing a scan

Scans come in grey and slightly grubby. That matters here because the board
composites the lineart with multiply, so any grey in the "white" sits over the
colour underneath like a film. Run each one through:

```sh
npm i --no-save sharp
node paddock/prepare.js ~/scans/grazing.jpg paddock/bases/grazing.png
```

It lifts the paper to pure white, deepens the marks, trims the margin and caps
the size — while leaving the soft edges of the brushwork alone, because
flattening those to hard black is what makes charcoal look like clip art.

If a grey film survives, raise `PAPER` in that script. If faint brushwork
disappears, lower it.

## adding a fourth horse

Drop the png in `bases/` and add a line to `bases.json`:

```json
{ "id": "rearing", "file": "rearing.png", "name": "up on its back legs" }
```

`id` is recorded against every submission, so keep it stable once it's live.
`name` is what shows under the thumbnail on the board.

## removing a colouring

Delete its png from `horses/`, delete its entry from `data/paddock.json`, then
run `node .github/scripts/render-readme.js` and commit.
