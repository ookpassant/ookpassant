# paddock worker

The site is static and has nowhere to send a finished drawing. This is that
somewhere: takes the png from `/colour/`, parks it in KV, opens a GitHub issue
with the image inline.

It publishes nothing. The issue still needs the `approved` label before
`.github/workflows/community.yml` puts a horse on the profile.

## Deploying it

```sh
cd worker
npx wrangler kv namespace create PADDOCK     # paste the id into wrangler.toml
npx wrangler secret put GITHUB_TOKEN       # see below
npx wrangler deploy
```

`wrangler deploy` prints the worker's URL. Put that URL in two places:

- `colour/oekaki.js` — the `WORKER` constant at the top.
- `.github/scripts/process-issue.js` — the `WORKER_ORIGIN` constant at the top.

Then rebuild and push.

## The GitHub token

Fine-grained, scoped to `ookpassant/ookpassant`, one permission: **Issues →
Read and write**. It can't push code, so a leak means someone can open issues on
one repo.

Set an expiry you'll notice. Rotate with `npx wrangler secret put GITHUB_TOKEN`.

## Turnstile (recommended, not required)

Without it the only protection is a rate limit of 5 submissions per IP per hour.
To add the check:

1. Cloudflare dashboard → Turnstile → add a widget for `chelseahopkins.co.uk`.
2. `npx wrangler secret put TURNSTILE_SECRET` with the secret key.
3. Put the **site** key in `colour/oekaki.js` as `TURNSTILE_SITE_KEY`.

The worker skips verification while `TURNSTILE_SECRET` is unset. Set the secret
last and it starts enforcing.

## What it stores

The png under a random id for 60 days, and an hourly counter per IP. Nothing
else. Approving copies a re-encoded 400×400 png into the repo, so the KV copy
expiring later doesn't matter.

## Local run

```sh
npx wrangler dev
```

`http://localhost:8080` is in the worker's allowed origins, so serving `_site/`
there tests the whole round trip.
