---
title: how this site is put together
summary: a static page on github pages, self-hosted fonts, cookieless analytics, and a fifty-line build script for these notes.
---

this site used to be wordpress. one page, a theme, a page builder, a hosting bill, and a plugin update every time i looked at it. for a page that says who i am and how to reach me, that's a lot of moving parts.

now it's three files.

## the shape of it

one html file, one stylesheet, one script. the copy is written straight into the html, the same copy that's on my [github profile](https://github.com/ookpassant), and they live in the same repo so they can't drift apart. github pages serves it. the domain points at github. there's no server of mine anywhere in the chain.

it's laid out as a field guide because everything i make seems to have an animal in it. jackdaw, hedgehog, courser. i noticed the pattern late and leaned in.

## fonts

fraunces for the display type, source serif for the body, jetbrains mono for the labels. they're served from the site itself rather than from google, in latin subsets only, so the whole set is under a megabyte and the page makes no third-party requests at all.

## analytics without a banner

posthog is on it, because posthog is on everything i make. it runs cookieless: memory persistence, no person profiles until someone identifies themselves, no session recording. nothing is written to the visitor's browser, so there's nothing to ask consent for. the trade-off is that returning visitors look like new ones. for a site like this, that's fine.

on top of pageviews there are three named events: someone clicked the hire button, someone clicked email, someone left for another site. that's the whole funnel.

## these notes

a note is a markdown file with a title and a summary at the top. push it and a small node script turns it into a page in the same design, adds it to the list on the homepage, the sitemap, the feed and the llms.txt. github actions runs the script. i never see the output.

that's it. no framework, no build tool beyond one script, nothing to update. if it's still working in five years i'll be pleased but not surprised.
