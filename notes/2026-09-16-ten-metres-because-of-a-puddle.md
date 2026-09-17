---
title: I Picked 10 Metres Because of a Puddle
summary: Never show a button the server will refuse.
category: build
order: 30
---

Every distance in Whimsee is a guess.

Whimsee is a GPS discovery app I built as a side project. You walk to a place and, when you're close enough, something happens: a hidden thing reveals itself and you can dig it up, or a spot tells you what it is and shows you a photo.

None of the "close enough" numbers were measured or calibrated. I picked them on feel, then added an engineering margin underneath.

This is a post about where those numbers came from, and the design rule I'd now use in any app that depends on a phone knowing where it is.

It's also about the GPS accuracy logging system I built, switched on, and then collected exactly one event from.

[photo: boots-in-brook.jpg | black wellingtons standing in a shallow stony brook, clear water running over the toes, teal waterproof trousers above | the puddle, roughly.]

I've walked most of the ground the app is built for, which is the Forest of Dean: tree cover, steep valleys, and the scowles,[^1] which are terrible for GPS. So the guesses aren't completely uninformed. But they're still guesses, and I'd rather say that than pretend there was a spreadsheet.

## None of the distances came from measurement

The spec asked for a dig radius of about 3 metres. I changed that to 10 after trying it outside.

The spot radius is 40 metres. Spots are places rather than buried things, so I made them more generous. The hunt ignores any fix worse than 35 metres. The create screen calls a fix strong under 5 metres, good to 10, and drifting past that.

| Guidance band | Distance |
|---|---|
| Hot | within 10m |
| Warm | within 100m |
| Cool | within 300m |
| Cold | beyond |

None of those numbers came from data. They were product decisions, and the rest of this post is about what you do when that's true.

## The server is looser than the phone, on purpose

Here's the rule I'd copy out of this post:

| Action | Phone shows the button at | Server accepts at | Offline sync accepts at |
|---|---|---|---|
| Dig up a glimmer | 10m | 15m | 25m |
| Visit a spot | 40m | 60m | n/a |

The client and server don't use the same radius. The server is always looser.

The phone decides whether to show you the button, and it's strict. The server decides whether to honour the tap, and it's forgiving by 50%.

That's because the location fix can drift between the phone drawing the button and the server checking it. If the app has already told you you're close enough, the server shouldn't immediately tell you that you aren't.

The offline number is looser again because a queued dig may be checked against a fix taken minutes or hours earlier.

Never show a button the server will refuse.

Every "how close" number in the app is really two numbers with some tolerance between them. That's where the GPS uncertainty goes.

[diagram: the ladder. Phone 10 → server 15 → offline 25, and phone 40 → server 60, drawn as steps. Your hand.]

## Ten metres, because three felt like a fight

So why 10 and not 3?

Because 3 metres was annoying in practice.

Standing on the actual spot in the actual wood, it meant that if the location had drifted slightly over a fence when it was planted, or a puddle was bigger than it had been that morning, you couldn't reach it. You'd be standing in the right place watching a dot refuse to warm up.

In testing I had a lot of finds fail, including a couple where I had to stand almost exactly on the spot for them to work.

That was the basis for changing it. I wasn't trying to find the most accurate number. I was trying to make reaching something feel like a discovery rather than a fight with the phone.

For this kind of app, I think that's a reasonable way to choose the threshold. The useful metric isn't how precisely I can locate someone. It's whether the moment of arrival works.

Ten metres did.

## The app withdrew a claim it couldn't keep

The number that actually caused problems wasn't a radius. It was a single location fix.

A tester, out in fields and woods, marked a spot and the pin landed across the river. On another occasion it landed about a mile north of where they were standing.

Their workaround was to open Google Maps alongside the app to steady the location. Their suggestion was better: let them move the pin and confirm it before saving.

The app's copy at the time said:

> marked exactly where you stand

That was a promise the phone couldn't reliably keep.

Marking a spot went from taking one balanced-accuracy fix to running a best-for-navigation watch while the form is open. It also got the same strong-good-drifting accuracy label used elsewhere, a draggable pin, a satellite toggle, and an accuracy ring showing the area the phone thinks you're in.

The copy changed too:

> check the pin sits exactly right

That's the important part.

Phones don't know exactly where you stand. If the location being saved is permanent, the interface should let the user correct it.

## The App Review device couldn't get a good fix

The device used for App Review couldn't produce a location fix inside the app's 35 metre guard.

The hunt therefore sat on "Listening…" forever, which meant the reviewer could have opened the app and seen something that appeared to do nothing.

I'd built the whole thing around the kind of fixes a phone in a field can produce. It hadn't occurred to me that the first stranger to run it might be sitting at a desk on hardware that couldn't produce one.

So there's now a demo mode specifically so App Review can see the app work without relying on a good GPS fix.

Testing outside catches one class of assumptions. Testing on the reviewer's device catches another.

## Warm and cold wasn't a workaround

You might reasonably assume the warm-and-cold guidance exists because GPS isn't accurate enough to show a precise location.

It doesn't.

The original spec had spots as precise, pinnable places. I changed that for safeguarding reasons. The home page promises never to give an exact pin for the content itself, and the app already had enough contextual clues for people to find spots without one.

Later, I changed the map so every spot appears as a star at its actual location, including unvisited ones.

What stays gated is the content: the words and photo only appear once you're physically there.

So the warm-and-cold guidance is a product choice rather than a workaround for bad GPS. If phone location became perfect tomorrow, I'd still keep it.

## Who shouldn't copy this

- Anything where precision is the product. Delivery, navigation, courier apps: a generous server margin would be a serious bug.
- Anything where a false positive costs money. My worst case is someone digging up nothing. If yours is a refund, the trade-off is different.
- Anything indoors. None of these numbers survive a building.

## I turned the logger on and never went for a walk

There's a flag in the app called `gps_field_log`.

When it's on, and only for an admin or moderator, it fires a `gps_field_fix` event every 20 seconds. It records the accuracy in metres, a band from excellent to unusable, and a five-character geohash rather than precise coordinates.

The idea was to collect real numbers under tree cover, in valleys and scowles, then compare them with open parkland.

Before writing this post, I asked an agent to audit the code. It couldn't tell me whether the flag had ever been ramped, and I couldn't remember either.

> **Prompt I used:** What does Whimsee actually make someone do with their body, and what are the radii and where did the numbers come from. What does the field log collect and is there any data. Was warm/cold guidance forced by the accuracy numbers or was it a design decision.

So I checked properly.

The flag had been on at 100% since 31 July. In seven weeks, it had fired exactly once.[^2]

One event: accuracy 19.0 metres, band fair, with a five-character geohash.

That is the entire Forest of Dean GPS dataset.

The rollout wasn't the problem. The event only fires for an admin or moderator because I'd decided that collecting it from normal users would require a privacy review I didn't want to do for a side project.

In practice, that meant it was mostly waiting for me.

I built the logger, switched it on, and then didn't go outside with my own app open.

So the honest position is that I still don't have real Forest of Dean GPS data.

Every radius in this post is a guess. The more useful follow-up would be a chart comparing location accuracy under canopy with accuracy in open ground, and I can't write that yet.

The one measurement I do have is 19 metres. That's good enough for the hunt and comfortably inside the 35 metre guard, but a sample of one isn't a finding.

I'm doing the walks. If you've got accuracy numbers from somewhere with trees, I'd like to see them next to mine.

---

[^1]: Scowles are sunken, mossy, tree-rooted hollows in the limestone, some shaped by historic iron mining. They're beautiful and terrible for GPS: steep sides, dense tree cover, and very little open sky.

[^2]: Checked in the dashboard on 15 September. Created 31 July, ramped to 100% the same day, and never modified since.

---

*Whimsee is a free side project. The audit was Claude Code reading the repo. The rulings, and the puddle, were mine.*
