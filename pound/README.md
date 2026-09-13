# the pound

`base.png` is the dog people colour in. `base.svg` is the source it was rendered from.

## replacing the base

Draw over it, or draw something else entirely, and save the result as `base.png`.
Keep the filename — the README, the issue form and the raw link all point at it.

What makes a base easy to colour in:

- 1000×1000, square.
- Pure white fill inside the lines, so a bucket tool has somewhere to land.
- Closed shapes. Any gap in the lineart and the fill leaks out across the page.
- Thick, even lines. Around 10px at this size survives being scaled down to a
  150px thumbnail in the README.
- No shading, no texture, no background. That's the coloured-in bit.

## the rest of this folder

`dogs/` is written by the workflow, not by hand. Every approved submission is
re-encoded to a 400×400 png on the paper colour and dropped in there, named
after the slug in `data/pound.json`.

To remove a dog: delete its png, delete its entry from `data/pound.json`, then
run `node .github/scripts/render-readme.js` and commit.
