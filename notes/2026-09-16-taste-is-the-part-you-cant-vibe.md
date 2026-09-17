---
title: Taste is the part you can't vibe
summary: What an illustration degree taught me about building with an agent.
category: essay
order: 40
---

I have an illustration degree, a day job in comms, and a side project in both stores that I built on my own with an agent doing most of the typing, because I get restless. I'm not an engineer and I'm not going to pretend the code is beautiful. The part of the app I trust myself to judge came from three years of standing in a room being told my work was wrong.

[photo: mushrooms-moss.jpg | a cluster of honey-coloured mushrooms growing out of bright green moss, the wood behind them thrown out of focus]

Building things has got cheap. Knowing what's wrong with the thing you built hasn't.

## 1. What a crit actually teaches

If you didn't do an art degree, here's how it works. Every week or two you pin your work on a wall next to everyone else's and the room takes it apart. Not the technique, mostly. You can learn technique from a book. The room asks whether the thing does what you said it would, whether anyone would care, whether you've made the safe version, and whether you can tell the difference between what you meant and what's on the wall.

The harshest crit I ever got was five words:

> It's a bit DeviantArt, isn't it.

I'd pinned up something I was proud of. Someone looked at it for about four seconds and said that. They were right, and it changed how I draw. I'd been drawing what I thought people wanted to see. Everything since has been made because it felt right to me.

Do that for three years and you develop a reflex. When something is wrong, you feel it before you can explain it. The training is learning to trust that feeling long enough to find the reason.

I've ignored it when I was making the safe version I thought other people wanted. These days, when the feeling shows up and I'm tempted to override it, I investigate it instead.

The closest engineering equivalent I know is code review: repeated exposure to other people's judgement until you recognise what is clean, what will bite you, and what is clever in the bad way. But code review usually judges the code. A crit puts the thing the code makes on the wall.

## 2. Taste in a codebase looks like naming

The first place I'd point to isn't a screen. It's the event names.

Whimsee's core loop appears in events such as `app_open`, `hunt_started`, `dig_zone_arrived`, `glimmer_found`, and then either `glimmer_kept_forever` or `glimmer_floated_away`. Planting something is `glimmer_hidden`. Declining a find is `find_declined`. A photo that failed the rules is `photo_rejected`.

Read them in order and you can follow a walk as a story. That was the point. I could have called them `treasure_collected` and `treasure_discarded` and been technically correct. I'd have hated it. The app is built on the idea that these things aren't treasure. They're small, and they drift away if you don't keep them. The event names use the same language as the person on the trail.[^1]

The rest of the vocabulary works the same way: glimmers, lanterns, wandering, keepers. The four colour themes are Sunbeam, Moss, Bluebell and Rosehip, not light, dark, blue and pink. Your own plants appear on the map as papercut stars.

That isn't decoration. It is deciding what something is, then making every part of it agree.

## 3. Taste in the decisions looks like feel

I've written elsewhere about the two decisions people ask me about most, so briefly. The spec said three metres for a dig and I made it ten because a puddle could put a find out of reach. I redesigned the intro screens, put them live, and killed them twenty minutes later because the swipe felt like a series of statements rather than a journey into the app.

Neither decision began with a number. I felt that something was wrong, then found the reason. I'd defend that as a method with one condition: you have to do the second part. Feel without investigation is preference. Feel followed by investigation is trained judgement.

There's a third decision I think about more. The home page promised never to hand over an exact pin for hidden content, so I changed the original spots spec from precise pins to warm-and-cold guidance.

Later, two people argued that showing every spot at its real position on the map weakened that gate and asked me to blur them. I disagreed. The map could show that a place existed; the words and photo would still appear only when someone stood there. So I drew the stars at their real positions and kept the content gated.

## 4. What the agent can't do

Most of Whimsee was typed by Claude Code. I'm not shy about that, and I'm not going to pretend it makes me a developer. It made building cheap enough that my time moved elsewhere.

When the agent writes the code, my hours go on what to build, what to call it, whether it's right, and what to cut. Those are the things the crit taught me. The agent can produce plausible answers to all of them, but it has no stake in which answer this app needs. It'll give you `treasure_collected` or `glimmer_kept_forever` and argue for either with equal confidence. Somebody has to choose.

I sent back the first draft of nearly every post I wrote this month because it sounded like the tool that drafted it. The reflex that catches that is the same one that catches the wrong event name: this is competent, but it isn't mine.

## 5. So what do you do with this

If you're an engineer, I'm not telling you to go to art school. A crit is a mechanism you can use on anything. Put the product, not only the code, in front of people who will tell you what's wrong. When something feels off, don't dismiss the feeling or stop at it. Find out why.

If you're building without an engineering background, the gap you're worried about may not be the only thing you bring. Agents have made a first version easier to produce. Judging that version, deciding what belongs, and recognising when something technically correct is wrong are still human work.

If you've got a good crit story — what was wrong on the wall and how you found out why — I'd like to hear it.

---

[^1]: The analytics audit put it as "disciplined instrumentation, almost no readout", which stung and was fair. Seventy-two events and, at the time, one wired to a decision. I'd still name them the same way. The readout comes when there's enough signal, and when it does, it'll be in the right language.

---

*Whimsee is a free side project. The illustration degree is from Trinity Saint David. The crit was Tuesdays.*
