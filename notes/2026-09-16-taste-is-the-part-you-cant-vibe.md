---
title: Taste is the part you can't vibe
summary: What an arts degree does for a builder that a bootcamp doesn't.
category: essay
order: 40
---

I have an illustration degree, a day job in comms, and a side project in both stores that I built on my own with an agent doing most of the typing, because I get restless. I'm not an engineer and I'm not going to pretend the code is beautiful. The app is good, it's good for reasons that have nothing to do with the code, and the reason it's good is three years of standing in a room being told my work was wrong.

[photo: mushrooms-moss.jpg | a cluster of honey-coloured mushrooms growing out of bright green moss, the wood behind them thrown out of focus]

That's the claim. Building things has got cheap. Knowing what's wrong with the thing you built hasn't, and the second one is the job now.

## 1. What a crit actually teaches

If you didn't do an art degree, here's how it works. Every week or two you pin your work on a wall next to everyone else's and the room takes it apart. Not the technique, mostly. The technique is the bit you can learn from a book. What the room takes apart is whether the thing does what you said it would do, whether anyone would care, whether you've made the safe version, and whether you can tell the difference between what you meant and what's on the wall.

The harshest crit I ever got was five words. "It's a bit DeviantArt, isn't it." I'd pinned up something I was proud of and someone looked at it for about four seconds and said that, and they were right, and it changed how I draw for good. I'd been drawing what I thought people wanted to see. Everything since has been made because it felt right to me, and if you want to know what that did to the work, it's the difference between the app I built and the app I'd have built for the market.

You do that for three years. By the end you have a reflex, and the reflex is the useful thing. It isn't "I can draw". It's that when something is wrong you feel it before you can explain it, and you've learned to trust the feeling and go looking for the reason rather than the other way round.

I know what it costs me when I don't. Every time I've ignored that feeling it's because I was playing it safe, making the version I thought was wanted rather than the one I knew was right, and it has cost me. Roles I wanted. Opportunities I'd have called dream ones at the time. I've metaphorically shot myself in the foot enough times now to recognise the shape of it, and these days when the feeling shows up and I'm tempted to override it, I look back at the last few times I did and learn hard from them.

Engineers get code review, which is the same mechanism pointed at a different object. Review teaches you taste in code, what's clean, what'll bite you, what's clever in the bad way. It teaches you much less about whether the thing the code makes is any good, because that's not what's on the wall. That's the gap an arts background fills, and it's a gap that matters more every month, because the code is increasingly not the hard part.

## 2. Taste in a codebase looks like naming

The first place I'd point to isn't a screen. It's the event names.

Whimsee's core loop is five analytics events: `app_open`, `hunt_started`, `dig_zone_arrived`, `glimmer_found`, and then either `glimmer_kept_forever` or `glimmer_floated_away`. Planting something is `glimmer_hidden`. Declining a find is `find_declined`. A photo that failed the rules is `photo_rejected`.

Read those in order and you can follow a walk as a story. That was the point. An engineer would probably have written `treasure_collected` and `treasure_discarded` and been correct, and I'd have hated it, because the whole app is built on the idea that these things aren't treasure, they're small and they drift away if you don't keep them. The event names carry the same idea the copy carries. When I look at a funnel I'm reading the same language the person on the trail is reading.[^1]

The same goes for the rest of the vocabulary. Glimmers, lanterns, wandering, keepers. The four colour themes are Sunbeam, Moss, Bluebell and Rosehip, not light, dark, blue and pink. Your own plants show on the map as papercut stars. None of this is decoration. It's the thing I spent three years learning to do: decide what something is, and then make every part of it agree.

## 3. Taste in the decisions looks like feel

I've written elsewhere about the two decisions people ask me about most, so briefly. The spec said three metres for a dig and I made it ten because at three a puddle could put a find out of reach and that felt bad. I redesigned the intro screens, put them live, and killed them twenty minutes later because the swipe felt like a series of statements instead of a journey in.

Both of those are crit reflexes. Neither has a number behind it. In both cases I felt the thing was wrong and then went and found the reason, and in both cases the reason held up. I'd defend "it felt bad" as a method, with one condition, which is that you then do the work to find out why. Feel without the follow-up is just preference. Feel with it is taste.

There's a third one that I think about more. The app's home page promises never an exact pin. When I built the spots feature, the spec had them as precise, pinnable places, and I changed it to warm-and-cold guidance for that reason alone. Two people later argued the map weakened the gate and asked me to blur it. I went the other way and drew every spot at its exact point, because I'd worked out that the promise was about the words and the photo, which you only get by standing there, and not about the place. That's not an accuracy decision or a safety decision. It's knowing what the thing is, and holding the line on it against people who were arguing in good faith.

## 4. What the agent can't do

Most of Whimsee was typed by Claude Code. I'm not shy about that and I'm not going to pretend it makes me a developer. It made the building cheap enough that the whole job moved.

When the agent writes the code, every hour I have goes on what to build, what to call it, whether it's right, and what to cut. Those are the things the crit taught me. They're also, as far as I can tell, the things the agent is worst at, not because it can't produce a plausible answer but because it can't tell which of its plausible answers is the one this app needs. It'll give you `treasure_collected` and it'll give you `glimmer_kept_forever`, and it'll argue for either with equal confidence, and somebody has to know.

Here's the honest bit. I had to send the first draft of nearly every post I've written this month back for sounding like the tool that drafted it. The reflex that catches that is the same one that catches the wrong event name. If you can't feel when the thing in front of you isn't yours, the agent will happily give you something that isn't, forever, and it'll be fine, and nobody will love it.

## 5. So what do you do with this

If you're an engineer, I'm not telling you to go to art school. I'm telling you the crit is a mechanism and you can run it on anything. Put the thing you built, not the code, in front of people who'll tell you it's wrong, and practise trusting the feeling before you have the reason.

If you're a builder without an engineering background, I'm telling you the thing you were worried was a gap is the point. The scarce skill now isn't producing the app. It's being the person in the room who knows the app is wrong, and why, and what it should have been called.

And if you've got a good crit story, wrong on the wall and how you found out why, I'd like to hear it.

---

[^1]: The analytics audit put it as "disciplined instrumentation, almost no readout", which stung and was fair. Seventy-two events and, at the time, one wired to a decision. I'd still name them the way I named them. The readout comes when there's enough signal, and when it does, it'll be in the right language.

---

*Whimsee is a free side project. The illustration degree is from Trinity Saint David. The crit was Tuesdays.*
