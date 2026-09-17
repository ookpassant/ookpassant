---
title: A human veto on AI social posts
summary: How Jackdaw drafts in your voice, gives you a review window, and publishes to ten platforms through one vendor.
category: build
---

[Jackdaw](https://heyjackdaw.com) drafts social posts and puts a human decision between the draft and the queue. How firm that gate is depends on the setting: sometimes it waits indefinitely, and sometimes silence becomes approval after a deadline.

This is how that works, how one publishing client reaches ten platforms, and where the neat version of both claims stops being true.

## The veto is a field

I expected to build a status column: draft, approved, published, the usual. Instead, the approval model starts with one nullable field on a proposal:

```ts
/** ISO time after which the proposal auto-queues; null = manual approval only. */
deadline: string | null;
```

`null` means a human must act. A timestamp means a human has until then. The rest is which list the proposal currently sits in.

There's a dial for how much review happens between drafting and the queue. In hands-on mode, the nightly run does nothing and every draft waits for a tap. In veto and full modes, a proposal gets a window, twelve hours by default, and queues itself if nobody objects.

So the human veto is not always a gate. Sometimes it is a deadline.

That makes the notification part of the safety mechanism. A comment in the code calls it the most important message the engine sends and says it must not depend on a channel the tenant might not have: Telegram when connected, email otherwise.

## The application never asks to publish now

The vendor API offers four modes: draft, queue, schedule and publish now. Jackdaw constructs only drafts and queue entries. The queue publishes them at a slot time.

`publish now` still exists in the vendor client's types, so it is not literally impossible to call. It is absent from every application path. Publishing immediately would require someone to add a new path rather than accidentally select the wrong existing option.

Approval includes rendered carousels. Claude writes the words and chooses a layout, but the post cannot queue until the rendered slides have been shown for review. The model does not get to approve its own pixels.

## One publisher, not ten adapters

Instagram, TikTok, Twitter, Threads, Bluesky, LinkedIn, Facebook, Reddit, YouTube and Pinterest all go through one vendor client. Jackdaw has no separate API adapter for each platform.

That does not mean the platforms are identical. Their differences live in four places:

- A drafting note for each platform
- A list of platforms that require media
- Per-target overrides when the post is created
- One code branch for LinkedIn carousels, which the publishing flow sends as PDF documents rather than image sets

The prose notes carry most of the variation. Twitter's note covers its standard character limit, including hashtags. LinkedIn's is the longest and explicitly bans the stack of one-line paragraphs that makes so much AI copy recognisable there.

There are no platform-specific publishing clients. There is still platform-specific product logic.

## Retries, honestly

Each create request carries a fresh request ID. Replaying the same ID returns the same vendor post, and Jackdaw handles a new or existing post the same way. The vendor also rejects identical content sent to the same account within a day.

That means a network retry should not double-post. A person submitting the same content twice is caught by the separate duplicate-content check, not by the request ID. The distinction matters when deciding what the system actually guarantees.

## What “learns what lands” means

Three feedback loops end up in the drafting prompt.

Engagement comes back from published posts. After ten new posts, or thirty days, a report calculates median engagement by platform and compares posts with and without media. Claude turns that into no more than five bullets for later drafts. Below twenty published posts, the block labels them as early hints rather than rules.

Corrections can become standing instructions. When you refine a draft in Telegram, one tap can pin the correction, and pinned instructions outrank the tone profile. One preference is enforced after generation too: if you have said no hashtags, a regex removes them because the model drifts.

Facts about the business are stored separately from voice and capped at forty. The whole list travels in every prompt, so leaving it unbounded would quietly increase the cost of every draft.

There is one important gap. Rejections teach nothing. Skipping a proposal deletes it, so Jackdaw learns from how audiences respond to published posts but not from the drafts a person refused. “Learns what lands” currently means published performance and corrections, not preference learning from every decision.

## Small things I'm fond of

The base prompt contains fifty lines of rules against sounding like a machine, grouped by failure. One test says to read the draft without its first and last lines and cut them if it improves. Another says to repeat a noun rather than reach for a synonym, because swapping words merely to avoid repetition is a machine habit.

Em dashes are removed after generation, including from carousel headlines. When the model responds in prose instead of JSON, usually because it needs more context, Jackdaw shows that response as a message rather than treating it as a failed draft.

Every drafting path claims one idea from the monthly allowance before starting and refunds it if no draft is produced. An outage does not spend the customer's allowance.

The honest version is less tidy than the product line. Jackdaw can draft, learn from published performance and send posts to ten platforms through one vendor. In hands-on mode, nothing queues without approval. In veto modes, doing nothing is itself a decision once the window closes.
