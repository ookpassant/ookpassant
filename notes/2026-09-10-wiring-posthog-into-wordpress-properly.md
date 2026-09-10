---
title: wiring posthog into wordpress properly
summary: consent that really gates, an order event that doesn't double-count, a proxy that can't be turned against you, and analytics inside wp-admin.
category: build
---

i found posthog this year, building [whimsee](https://whimsee.co.uk), and liked it enough that i wanted it on the wordpress sites i look after too. the existing options amounted to a snippet pasted into a theme. that works right up until someone changes the theme, or asks about cookies, or wants to know what the site did last week without logging into a second dashboard. so i wrote [pressed-hog](https://github.com/ookpassant/pressed-hog).

it's a hedgehog with a wordpress plugin in it. here's what it turned out to need.

## a wizard

activation opens a four-step setup. pick your region, paste your project key, choose tracking and consent, send a test event. the key gets checked live, from the server, against your posthog host, so you find out it's wrong before you've forgotten which tab you copied it from. everything the wizard sets is editable later on a normal settings page. the wizard exists because nobody reads the normal settings page.

## consent

three modes. none, which tracks immediately. a built-in banner, where posthog starts with `opt_out_capturing_by_default` set and captures nothing until someone accepts. and external, where you bring your own consent plugin and tracking starts when a cookie you name takes a value you name, or when your plugin calls `window.pressedHog.grantConsent()`.

the important bit is that "opted out" is posthog's own opted-out state, not a wrapper that delays loading the script. the library is present, the identify call is queued, and accepting the banner flips one switch.

## the woocommerce order event

three events: product added to cart, checkout started, order completed. the last one carries totals and line items, and it's the one that goes wrong on most installs because people refresh the thank-you page. so it's deduplicated with a flag written to the order, and it only fires when the order key in the url matches the order, which is the same check woocommerce's own thank-you page does. nobody can walk through order ids and read totals out of your analytics.

## the proxy

ad blockers block posthog's domains. the fix is to serve it from your own. a rewrite rule turns `yoursite.com/phog/…` into a server-side relay to your posthog host, forwarding the visitor's ip so geolocation still works.

a proxy on a wordpress site is a thing that gets abused, so this one is narrow. it relays only to the host you configured. it accepts only a fixed list of first path segments, the ones posthog actually uses: `static`, `e`, `i`, `decide`, `capture`, `batch`, `array`, `s`, `flags`. anything else is refused. the request body is capped and the upstream timeout is five seconds. it can't be pointed at another host and it can't be used to fetch things. very busy site? put a cdn in front instead. the readme says so.

## analytics where the client already is

most people who run a wordpress site will never log into posthog. so there's a posthog page inside wp-admin. pageviews, unique visitors, change against the previous period, a traffic chart, top pages, referrers and devices, over seven, thirty or ninety days. it's queried server-side from posthog's query api and cached for five minutes. the personal api key that makes it work is stored non-autoloaded, so it never rides along in the object cache on public requests, and it never appears in page html.

## and the rest

feature flags evaluated server-side, with a shortcode and a php helper, so you can gate content in a template. qr codes with utm tags and a unique id per code, generated in the browser so the url never goes to a third party. role exclusions, so admins and editors don't pollute the numbers.

## the review

before publishing i ran an adversarial review: separate agents attacking each surface, each finding re-verified by a sceptical pass. ssrf through the proxy, header injection, xss, and injection into the analytics queries were all looked at specifically. the hardening above is what came out of it.
