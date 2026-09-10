---
title: a human veto on ai social posts
summary: how jackdaw drafts in your voice, waits for you, and publishes to ten platforms without a single platform adapter.
category: build
---

[jackdaw](https://heyjackdaw.com) drafts social posts, shows them to you, and does nothing until you say so. nobody's coming to run your socials, so it does the writing and you keep the veto. this is how that's built, including the two places where the neat version of the story isn't quite true.

## the veto is a field

i expected to build a status column. draft, approved, published, the usual. instead the whole approval model is one nullable field on a proposal:

```ts
/** ISO time after which the proposal auto-queues; null = manual approval only. */
deadline: string | null;
```

null means a human has to act. a timestamp means a human has until then. everything else is just which list the thing sits in.

there's a dial for how much review sits between drafting and the queue: hands-on, batch, veto, full. on hands-on the nightly run does nothing at all and every draft waits for a tap. on veto and full, a proposal gets a window, twelve hours by default, and if no objection is heard it queues itself. so at those settings the veto is a window rather than a gate, and the notification becomes the safety mechanism. there's a comment in the code that calls it the most important message the engine sends, and says it must not depend on a channel the tenant might not have. telegram if you've got it. email if you haven't.

## nothing is ever told to publish now

the publishing api offers four modes. draft, queue, schedule, publish now. the application only ever constructs two of them. every path that creates a post builds a draft or a queue entry, and the queue publishes at a slot time. "publish now" exists in the client's type definitions and nowhere else. that's on purpose. i'd rather the dangerous call be unwritable than trust myself to remember not to write it.

approval covers pixels too. for carousels, claude writes the words and picks a layout, and that's all it's allowed to do. you see the copy before anything renders. you can't approve a slide you haven't seen.

## ten platforms, zero adapters

instagram, tiktok, twitter, threads, bluesky, linkedin, facebook, reddit, youtube, pinterest. i assumed that meant ten adapter files. there are none. publishing goes through one vendor client, and the differences between platforms live in three places: a prose note per platform that the model reads while drafting, a short list of which platforms need media, and a per-target override at post time.

the prose is where the real logic is. twitter's note is about 280 characters including hashtags. linkedin's is the longest by a mile, and includes an instruction not to write a stack of one-line paragraphs, which is the most recognisable ai shape on that platform. the only platform that gets an actual branch in code is linkedin, because a swipeable carousel there has to be a pdf document rather than a set of images.

## retries, honestly

every create call carries a fresh request id in a header, and the vendor treats a replay of the same id as the same post. the response can come back as a new post or an existing one, and the code handles both the same way. behind that, the vendor also rejects identical content to the same account within a day. so a network retry can't double-post. a person hammering the button twice? caught by the second defence, not the first. i'd rather say that plainly than claim more than the header does.

## what "learns what lands" actually means

three loops, all ending in the same system prompt.

engagement comes back from published posts. after every ten new posts, or thirty days, a report runs: median engagement per platform, with and without media. claude turns that into at most five bullets, and those bullets ride in every subsequent draft. under twenty posts the block labels itself as early hints, weak signals not rules, so the model doesn't over-fit to a fortnight.

corrections can be pinned. when you refine a draft in telegram, one tap turns that refinement into a standing rule, and standing rules override everything, including the tone profile. one of them is enforced in code as well as in prompt. if you've ever said no hashtags, a regex strips them after generation, because the model drifts.

facts about the business are kept separately from voice and capped at forty, because the whole list rides in every prompt and would otherwise quietly become the largest cost per draft.

and the honest gap. rejections teach nothing. skipping a proposal deletes it. the system learns from what the audience did with what you published, not from which drafts you chose over which. that's a later problem.

## small things i'm fond of

the base prompt is fifty lines of rules against sounding like a machine, grouped by how they fail. one test: read the draft without its first line and without its last line, and if it reads better, cut them. another: repeat a noun rather than reaching for a synonym, because swapping words to dodge repetition is a machine habit.

em dashes are stripped in code after generation. everywhere, including the headlines in the renderer.

when the model answers in prose instead of json, usually to ask for more context, that isn't treated as an error. it's shown as jackdaw talking.

every drafting path claims an idea from your monthly allowance up front and refunds it if nothing was produced. nobody should lose an idea to somebody else's outage.
