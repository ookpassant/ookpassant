---
title: A human veto on AI social posts
summary: How Jackdaw drafts in your voice, gives you a review window, and publishes to ten platforms through one vendor.
category: build
---

[jackdaw](https://heyjackdaw.com) drafts social posts and puts a human decision between the draft and the queue. how firm that gate is depends on the setting: sometimes it waits indefinitely, and sometimes silence becomes approval after a deadline.

this is how that works, how one publishing client reaches ten platforms, and where the neat version of both claims stops being true.

## the veto is a field

i expected to build a status column: draft, approved, published, the usual. instead, the approval model starts with one nullable field on a proposal:

```ts
/** ISO time after which the proposal auto-queues; null = manual approval only. */
deadline: string | null;
```

`null` means a human must act. a timestamp means a human has until then. the rest is which list the proposal currently sits in.

there's a dial for how much review happens between drafting and the queue. in hands-on mode, the nightly run does nothing and every draft waits for a tap. in veto and full modes, a proposal gets a window, twelve hours by default, and queues itself if nobody objects.

so the human veto is not always a gate. sometimes it is a deadline.

that makes the notification part of the safety mechanism. a comment in the code calls it the most important message the engine sends and says it must not depend on a channel the tenant might not have: telegram when connected, email otherwise.

## the application never asks to publish now

the vendor api offers four modes: draft, queue, schedule and publish now. jackdaw constructs only drafts and queue entries. the queue publishes them at a slot time.

`publish now` still exists in the vendor client's types, so it is not literally impossible to call. it is absent from every application path. publishing immediately would require someone to add a new path rather than accidentally select the wrong existing option.

approval includes rendered carousels. claude writes the words and chooses a layout, but the post cannot queue until the rendered slides have been shown for review. the model does not get to approve its own pixels.

## one publisher, not ten adapters

instagram, tiktok, twitter, threads, bluesky, linkedin, facebook, reddit, youtube and pinterest all go through one vendor client. jackdaw has no separate api adapter for each platform.

that does not mean the platforms are identical. their differences live in four places:

- a drafting note for each platform
- a list of platforms that require media
- per-target overrides when the post is created
- one code branch for linkedin carousels, which the publishing flow sends as pdf documents rather than image sets

the prose notes carry most of the variation. twitter's note covers its standard character limit, including hashtags. linkedin's is the longest and explicitly bans the stack of one-line paragraphs that makes so much ai copy recognisable there.

there are no platform-specific publishing clients. there is still platform-specific product logic.

## retries, honestly

each create request carries a fresh request id. replaying the same id returns the same vendor post, and jackdaw handles a new or existing post the same way. the vendor also rejects identical content sent to the same account within a day.

that means a network retry should not double-post. a person submitting the same content twice is caught by the separate duplicate-content check, not by the request id. the distinction matters when deciding what the system actually guarantees.

## what “learns what lands” means

three feedback loops end up in the drafting prompt.

engagement comes back from published posts. after ten new posts, or thirty days, a report calculates median engagement by platform and compares posts with and without media. claude turns that into no more than five bullets for later drafts. below twenty published posts, the block labels them as early hints rather than rules.

corrections can become standing instructions. when you refine a draft in telegram, one tap can pin the correction, and pinned instructions outrank the tone profile. one preference is enforced after generation too: if you have said no hashtags, a regex removes them because the model drifts.

facts about the business are stored separately from voice and capped at forty. the whole list travels in every prompt, so leaving it unbounded would quietly increase the cost of every draft.

there is one important gap. rejections teach nothing. skipping a proposal deletes it, so jackdaw learns from how audiences respond to published posts but not from the drafts a person refused. “learns what lands” currently means published performance and corrections, not preference learning from every decision.

## small things i'm fond of

the base prompt contains fifty lines of rules against sounding like a machine, grouped by failure. one test says to read the draft without its first and last lines and cut them if it improves. another says to repeat a noun rather than reach for a synonym, because swapping words merely to avoid repetition is a machine habit.

em dashes are removed after generation, including from carousel headlines. when the model responds in prose instead of json, usually because it needs more context, jackdaw shows that response as a message rather than treating it as a failed draft.

every drafting path claims one idea from the monthly allowance before starting and refunds it if no draft is produced. an outage does not spend the customer's allowance.

the honest version is less tidy than the product line. jackdaw can draft, learn from published performance and send posts to ten platforms through one vendor. in hands-on mode, nothing queues without approval. in veto modes, doing nothing is itself a decision once the window closes.
