# pound worker

The site is static, so it has nowhere to send a finished drawing. This is that
somewhere: it takes the png from `/colour/`, parks it in KV, and opens a GitHub
issue with the image showing inline.

It publishes nothing. The issue still needs the `approved` label before
`.github/workflows/community.yml` puts a dog on the profile.

## Deploying it

```sh
cd worker
npx wrangler kv namespace create POUND     # paste the id into wrangler.toml
npx wrangler secret put GITHUB_TOKEN       # see below
npx wrangler deploy
```

`wrangler deploy` prints the worker's URL. Put that URL in two places:

- `oekaki/oekaki.js` — the `WORKER` constant at the top.
- `.github/scripts/process-issue.js` — the `WORKER_ORIGIN` constant at the top.

Then rebuild and push.

## The GitHub token

A fine-grained personal access token, scoped to `ookpassant/ookpassant` only,
with one permission: **Issues → Read and write**. Nothing else. It cannot push
code, so the worst a leak does is let someone open issues on one repository.

Set an expiry you'll actually notice, and rotate it with
`npx wrangler secret put GITHUB_TOKEN`.

## Turnstile (recommended, not required)

Without it the only protection is a rate limit of 5 submissions per IP per hour.
To add the check:

1. Cloudflare dashboard → Turnstile → add a widget for `chelseahopkins.co.uk`.
2. `npx wrangler secret put TURNSTILE_SECRET` with the secret key.
3. Put the **site** key in `oekaki/oekaki.js` as `TURNSTILE_SITE_KEY`.

The worker skips verification while `TURNSTILE_SECRET` is unset, so the order
doesn't matter — set the secret last and it starts enforcing.

## What it stores

Only the png, under a random id, for 60 days, plus an hourly counter per IP that
expires after an hour. No addresses, no names, nothing that outlives the issue.
Approving a submission copies a re-encoded 400×400 png into the repo, so the KV
copy expiring later doesn't matter.

## Local run

```sh
npx wrangler dev
```

`http://localhost:8080` is already in the worker's allowed origins, so serving
`_site/` there lets you test the whole round trip.
