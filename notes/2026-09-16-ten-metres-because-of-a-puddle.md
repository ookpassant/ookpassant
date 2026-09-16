---
title: I picked 10 metres because of a puddle
summary: Never show a button the server will refuse.
category: build
order: 30
---

Every distance in Whimsee is a guess. Whimsee is a side project, a GPS discovery app I built to learn, and it's built on walking to a place and having something happen when you're close enough: a hidden thing reveals itself and you can dig it up, or a spot tells you what it is and shows you a photo. None of the "close enough" numbers were measured, tested or calibrated. I picked them on feel and then bolted an engineering margin underneath.

This is a post about those numbers, where they came from, and the one design rule that fell out of them which I'd now put in any app that depends on a phone knowing where it is. It's also a post about the GPS accuracy data I built a whole logging system to collect, switched on, and then collected exactly one of.

I've walked most of the ground the app is built for, which is the Forest of Dean: tree cover, steep valleys, and the scowles,[^1] which eat GPS for breakfast. So the guesses aren't uninformed. But they're still guesses, and I'd rather say so than pretend there was a spreadsheet.

## None of the distances came from measurement

The spec I was working from asked for a dig radius of about 3 metres. That became 10, by my own ruling on 6 July, on feel. The spot radius is 40 metres, ruled on 3 July with a note in the code saying spots are places rather than buried things so they get to be more generous. The hunt ignores any fix worse than 35 metres. The create screen calls a fix strong under 5, good to 10, and drifting past that.

| Guidance band | Distance |
|---|---|
| Hot | within 10m |
| Warm | within 100m |
| Cool | within 300m |
| Cold | beyond |

Every one of those is a founder ruling with a comment next to it. None of them is a number I could defend with data, and I want to be upfront about that because the rest of the post is about what you do when that's true.

## The server is looser than the phone, on purpose

Here's the rule, and it's the thing I'd copy out of this post if I were you.

| Action | Phone shows the button at | Server accepts at | Offline sync accepts at |
|---|---|---|---|
| Dig up a glimmer | 10m | 15m | 25m |
| Visit a spot | 40m | 60m | n/a |

The client and the server don't agree on the radius, and the server is always looser. The comment in the code says it outright: so a dig shown here never fails server verification over GPS noise. The phone decides whether to show you the button, and it's strict. The server decides whether to honour the tap, and it's forgiving by 50%, because between the phone drawing the button and the server checking the fix, the fix can drift, and nothing is worse than being told you're close enough and then being told you weren't. The offline number is looser again, two and a half times the phone's, because a queued dig is being checked against a fix taken minutes or hours before.

Never show a button the server will refuse. That's the whole design. Every "how close" number in the app is really two numbers with a gap between them, and the gap is where GPS lives.

[diagram: the ladder. Phone 10 → server 15 → offline 25, and phone 40 → server 60, drawn as steps. Your hand.]

## Ten metres, because three felt like a fight

So why 10 and not 3?

Because 3 felt fussy. When I tried it, standing on the actual spot in the actual wood, 3 metres meant that if the thing had drifted slightly over a fence when it was planted, or a puddle was bigger than it had been that morning, you couldn't reach it. You'd be standing there watching a dot refuse to warm up, knowing full well you were in the right place.

In testing I had a lot of finds fail, and a couple where I had to be standing exactly on the spot for it to work, and it felt bad. That's the whole basis for the number. Not accuracy, feel. The question I was actually answering was whether reaching the thing felt like a discovery or like a fight with the phone, and at 3 metres it was a fight.

I'd defend that as a method, for this kind of app. The metric a GPS game runs on isn't how precisely you can locate someone, it's whether the moment of arrival lands. 10 metres lands. The server takes 15 so the landing can't be taken back.

## The app withdrew a claim it couldn't keep

The number that actually hurt wasn't a radius. It was a single location fix.

On 26 July a tester, out in fields and woods, marked a spot and the pin landed across the river. On another occasion, a mile north of where they were standing. Their workaround was to open Google Maps alongside to steady it, and their suggestion was a draggable map so they could confirm the pin before saving. What the app had said, in its own copy, was "marked exactly where you stand". What was true was a mile off, permanently, because a spot is forever.

That report produced `spot_location_confirm`, and the size of the fix tells you how bad I judged the problem to be. Marking a spot went from one balanced-accuracy fix to a best-for-navigation watch that runs while the form is open. It got the same strong-good-drifting label the create screen already had, a draggable pin with a satellite toggle, and the accuracy ring drawn on the map so you can see the circle the phone thinks you're in. And the copy changed from "marked exactly where you stand" to "check the pin sits exactly right".

That last one is the bit I'd point at. Phones don't know exactly where you stand, and an app that says they do is going to be wrong in a wood, permanently, in a way you can't undo.

## The reviewer's iPad had no GPS

The App Review iPad Air had no GPS chip at all. Every fix it produced was coarser than the 35 metre guard, so the hunt sat on "Listening…" forever, and the reviewer would have seen an app that does nothing.

I'd built the whole thing around fixes a phone in a field can produce. It hadn't occurred to me that the first stranger to run it would be on a device that can't produce one. So there's now a demo mode that exists purely so a reviewer on a desk can see the app work. The desk breaks assumptions the ground doesn't, and the ground breaks assumptions the desk doesn't, and you have to build for both.

## Warm and cold was never a concession

You might reasonably assume the warm-and-cold guidance, where a spot tells you you're getting warmer rather than putting a pin on a map, was forced by the accuracy problem. It wasn't, and I know that because the accuracy argument has been made to me twice and lost both times.

The spec had spots as precise, pinnable places. I changed that on 8 July, and the reason in the record is safeguarding, not hardware. The home page promises never an exact pin, and spots needed to keep that promise, and it turned out you could find one by feel anyway because the hidden things cluster around them. Two flags went in the same day: one blurs, one guides.

Then on 7 August two separate people argued that the map weakened the gate, and I went the other way on place. The map now draws every spot as a star at its exact point, unvisited ones included. What stays gated is the words and the photo, which you only get by standing there. The ruling is in the project file so I stop re-arguing it with myself: the gate is about words and photos, not about place.

So the fuzzy guidance is a design conviction that has outranked the hardware argument, not a workaround for it. If the phones got perfect tomorrow, the spots would still be warm and cold.

## Who shouldn't copy this

- Anything where precision is the product. Delivery, navigation, anything with a courier. A 50% server margin is a feature for a discovery game and a lawsuit for a logistics app.
- Anything where a false positive costs money. My worst case is someone digging up nothing. If yours is a refund, be strict on both ends and eat the bad experience.
- Anything indoors. None of these numbers survive a building.

## I turned the logger on and never went for a walk

Which brings me to the confession, which turned out not to be the confession I thought I was making.

There's a flag in the app called `gps_field_log`. When it's on, and only for me or a moderator walking, it fires a `gps_field_fix` event every 20 seconds carrying the accuracy in metres, a band from excellent to unusable, and a five-character geohash, never a coordinate. The file header explains what it's for: canopy, valleys, the scowles, with Bathurst Park included as open parkland to be the clean baseline the bad numbers get compared against. It ends with a line I wrote and then apparently forgot: you cannot reconstruct what accuracy a phone had last September, so a pilot that runs without this yields nothing.

The flag falls back to off. When I asked an agent to audit the code before writing this, it couldn't tell me whether the rollout had ever been ramped, and neither could I from memory.

> **Prompt I used:** What does Whimsee actually make someone do with their body, and what are the radii and where did the numbers come from. What does the field log collect and is there any data. Was warm/cold guidance forced by the accuracy numbers or was it a design decision.

So I went and looked it up properly, and I had it backwards. It was ramped. `gps_field_log` has been on at 100% since 31 July, seven weeks, and in that time it has fired exactly once.[^2] One event, on 12 August at 15:48: accuracy 19.0 metres, band fair, a geohash five characters wide. That is the entire Forest of Dean GPS dataset.

The flag was never the problem. Underneath it sits a second gate I wrote myself and then stopped thinking about: the log only runs for an admin or a moderator, because I'd ruled that collecting this from wanderers would need a DPIA amendment I didn't fancy writing. So the only person `gps_field_log` was ever going to record was me. It has been switched on, correctly, at full rollout, for seven weeks, waiting for me to go outside with my own app open. I didn't.

Which is the same shape as the kill switch that couldn't be reached. I built a switch, documented it, and this time even checked it was on, and it still produced nothing, because the thing standing between me and the outcome was never the switch. It was the gate underneath it. Last time that gate was a native module that died before JavaScript ran. This time it was me.

So the honest position is still that the Forest of Dean GPS numbers don't exist yet, but not for the reason I was about to give you. Every radius in this post is a guess, and the post you'd actually want, the one with a chart of accuracy under canopy against accuracy in the park, is one I can only write after a fortnight of walks. The instrument has been running the whole time. It was waiting for me.

One measurement in, for whatever it's worth: 19 metres, fair band, on a walk I don't specifically remember taking. That's a fix good enough to hunt on, comfortably inside the 35 metre guard, and it is a sample of one, which is not a finding. It's a promise that the next fifty will arrive.

I'm doing the walks. If you've got accuracy numbers from somewhere with trees, I'd like to see them next to mine.

---

[^1]: Scowles are natural: sunken, mossy, tree-rooted hollows in the limestone, though there's evidence iron was mined out of some of them a long time ago. They're beautiful, and they're a terrible GPS dead zone, because the rock is iron-rich and there's almost no sky.

[^2]: Checked in the dashboard on 15 September. Created 31 July, ramped to 100% the same day, and never modified since.

---

*Whimsee is a free side project. The audit was Claude Code reading the repo. The rulings, and the puddle, were mine.*
