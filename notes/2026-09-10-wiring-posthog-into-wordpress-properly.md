---
title: wiring posthog into wordpress properly
summary: consent that actually gates, woocommerce events that don't double-count, a first-party proxy that can't be abused, and analytics inside wp-admin.
---

i put posthog on everything i make. for years the wordpress half of that was a snippet pasted into a theme, which works until someone changes the theme, or asks about cookies, or wants to know what the site did last week without logging into a second dashboard. [pressed-hog](https://github.com/ookpassant/pressed-hog) is the plugin i wrote so i'd stop doing it badly.

it's a hedgehog with a wordpress plugin in it. here is what it turned out to need.

## a wizard, because settings pages get ignored

activation opens a four-step setup: pick your region, paste your project key, choose tracking and consent, send a test event. the key is validated live, from the server, against your posthog host, so you find out it's wrong before you've forgotten which tab you copied it from. everything the wizard sets is editable later in a normal settings page. the wizard exists because nobody reads the normal settings page.

## consent that gates, not decorates

three modes. none: track immediately. a built-in banner: posthog starts with `opt_out_capturing_by_default` set, and nothing is captured until someone accepts. external: bring your own consent plugin, and tracking starts when a cookie you name takes a value you name, or when your plugin calls `window.pressedHog.grantConsent()`.

the important bit is that "opted out" is posthog's own opted-out state, not a wrapper that delays loading the script. it means the library is present, the identify call is queued, and accepting the banner flips one switch.

## woocommerce events that don't lie

three events: product added to cart, checkout started, order completed. the last one carries totals and line items and is the one that goes wrong on most installs, because the thank-you page gets refreshed. so it's deduplicated with a flag written to the order, and it only fires when the order key in the url matches the order, the same check woocommerce's own thank-you page does. you can't enumerate order ids and read totals out of the analytics.

## the proxy, and what it refuses to do

ad blockers block posthog's domains. the fix is to serve it from your own: a rewrite rule turns `yoursite.com/phog/…` into a server-side relay to your posthog host, forwarding the visitor's ip so geolocation still works.

a proxy on a wordpress site is a thing that gets abused, so this one is narrow. it only relays to the host you configured. it only accepts a fixed list of first path segments, the ones posthog actually uses: `static`, `e`, `i`, `decide`, `capture`, `batch`, `array`, `s`, `flags`. anything else is refused. the request body is capped, the upstream timeout is five seconds. it cannot be pointed at another host and it cannot be used to fetch things. for a very busy site you'd put a cdn in front instead, and the readme says so.

## analytics where the client already is

most people who run a wordpress site will not log into posthog. so there's a posthog page inside wp-admin: pageviews, unique visitors, change against the previous period, a traffic chart, top pages, referrers and devices over seven, thirty or ninety days. it's queried server-side from posthog's query api and cached for five minutes. the personal api key that makes this work is stored non-autoloaded so it never rides along in the object cache on public requests, and it never appears in page html.

## the rest

feature flags evaluated server-side, with a shortcode and a php helper, so you can gate content in a template. qr codes with utm tags and a unique id per code, generated in the browser so the url never goes to a third party. role exclusions so admins and editors don't pollute the numbers.

## the security review

before i published it i ran an adversarial review: separate agents attacking each surface, each finding re-verified by a sceptical pass. ssrf through the proxy, header injection, xss, and injection into the analytics queries were all looked at specifically. the hardening in this note is what came out of that. i'd recommend the exercise for any plugin that makes outbound requests on behalf of a site.
