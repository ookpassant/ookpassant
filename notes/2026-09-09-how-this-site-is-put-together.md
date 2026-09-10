---
title: how this site is put together
summary: one html file on github pages, fonts served from the site itself, analytics with no cookies, and a short script that turns markdown into these notes.
category: build
---

this site used to be wordpress. one page, a theme, a page builder, a hosting bill, and a plugin update every time i looked at it. all that for a page whose job is to say who i am and how to reach me.

now it's an html file, a stylesheet and a script. github pages serves them. the domain points at github. there's no server of mine anywhere in the chain, which means there's nothing for me to patch at eleven at night.

## the shape of it

the copy is typed straight into the html. the same repo holds my github profile page, so the two can't wander apart without me noticing.

it's laid out like a field guide, with plates and numbered chapters, because everything i make seems to have an animal in it and once you've noticed that you can't un-notice it.

## fonts

fraunces for the display type, source serif for the body, jetbrains mono for the labels. all three are served from here rather than from google, in latin subsets only, so the whole set is under a megabyte and the page makes no third-party requests. none. i checked.

## analytics, no banner

posthog is on it, because posthog is on everything i make now. it runs cookieless. memory persistence, no person profile until someone identifies themselves, no session recording. nothing gets written to the visitor's browser, so there's nothing to ask consent for, and the trade-off is that a returning visitor looks like a new one. for a page like this i can live with that.

beyond pageviews i track three things by name. someone clicked email. someone left for another site. and which section they were in when they did it. that's the whole funnel.

## these notes

a note is a markdown file with a title and a summary at the top. i push it and a node script, about a hundred lines, turns it into a page in this design, adds it to the list on the homepage, the sitemap, the feed and the llms.txt. github actions runs the script. i never see the output, and so far i haven't needed to.
