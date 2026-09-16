---
title: 4 prompts that out-audited me
summary: Steal them. Then come and tell me what yours found.
category: build
order: 30
draft: true
---

In one week, four prompts run against two of my repos found 8 of 63 feature flags disagreeing with their own registry, an analytics event that had never fired for anyone offline, an app with child accounts and no child path in its analytics, a GPS logger I'd built, switched on, and then never once walked with, and a prompt cache that's probably been doing nothing since I added it.

None of that came from a code review. I'm not a developer, I have an illustration degree and a day job in comms, and the two repos are side projects I build because I get restless. What found all of it was asking Claude Code the right question and reading the answer properly.

Every prompt is below, with what it found and what I did. The pattern that makes them work is at the end, and it's short.

## 1. Pull the flags from the code, not the registry

> Pull every feature flag from the code, not from the registry file. The registry describes flags, it doesn't prove them. For each one tell me what it gates and whether there's still a live read anywhere. Then tell me which ones are dead.

**What it found.** 63 flags with a live read at the time, 38 on mobile, 22 on the web, 3 on both. 4 with no reads anywhere, still sitting in the dashboard. 1 retired but undeletable, because a page still reads it with the fallback set to on, and removing it would bring the page back. 2 flags in the code that never made the registry. 1 registry entry describing a state the code left behind three commits ago.

**What I did.** Wrote the removal rule I'd never had, and put it in a post. Deleted two of the four dead flags outright, which is why it's 2 dead now, and 62 with a live read against 64 sitting in the dashboard.

Then, pulling the numbers for that post, I found the better finding. I had written that a flag holding back a blog card had gone live. It hadn't. It was created on 22 August at 0% rollout and has never been touched since. One entry in its entire activity log. I had shipped it in the only place that really counts, which is my own head, and the dashboard had no idea. The number that stuck was one flag in eight where my documentation and my code disagreed. The one that stung was the flag where my memory and the dashboard disagreed, inside the post about exactly that.

The first sentence is the whole prompt. "From the code, not from the registry" names the source of truth and refuses the shortcut. The agent's own first line back was that the registry describes flags, it doesn't prove them, which is the sentence I'd been avoiding for a year.

## 2. Read the analytics layer properly

> Read the analytics layer properly. What events do we capture and what's the rule for what counts. What happens to an event for a glimmer planted with no signal. What does analytics do for a child user. Is session replay on, and if not was that decided or forgotten.

**What it found.** 72 hand-written events and 0 page views, with a consistent rule underneath that I'd never written down: an event marks a decision or a physical act, never a screen. Then three things I didn't want to hear. A plant made with no signal fired no event, ever, and the queued record had no timestamp so it couldn't be backdated. The `is_child` flag gated the UI in six places and reached the analytics layer in none. And my audit doc said no session replay on the web while replay was on.

**What I did.** Fixed the offline event the same day, by firing it at enqueue with `offline: true`. Passed `is_child` through `identify()` so children can be held out of every insight with one filter. Corrected the audit doc, which was the same drift as the flag registry wearing a different hat.

There's a coda to this one. Once the numbers were in front of me, `glimmer_found` turned out to have fired 55 times in 90 days with `offline` false on every single one, despite five offline flags all sitting at 100%. I still don't know whether that's the Forest having more signal than I credit it with, or the same bug I'd just fixed on the plant side hiding on the hunt side. Writing down which of those you can't distinguish is the part people skip.

"Decided or forgotten" is the useful clause. It makes the agent distinguish between a choice with a record and an absence, and the answer to that question was different for web and mobile.

## 3. What does the app make someone do with their body

> What does Whimsee actually make someone do with their body, and what are the radii and where did the numbers come from. What does the field log collect and is there any data. Was warm/cold guidance forced by the accuracy numbers or was it a design decision.

**What it found.** Every distance in the app is a ruling on feel with a comment next to it, and none came from measurement. The client and server disagree on purpose, 10 metres on the phone and 15 on the server for a dig, so a button the phone shows never fails server verification over GPS noise. The field log I'd built to collect real accuracy numbers falls back to off, and the agent couldn't tell me whether it had ever been ramped. Neither could I.

**What I did.** Checked the dashboard, and I had it backwards. It had been ramped, on at 100% since 31 July, and in the seven weeks since it had fired exactly once: 19.0 metres, fair band, 12 August, one event from one person. The flag was never what was stopping it. Underneath it sits a keeper-only gate I wrote myself and then forgot about, so the only person the log could ever record was me, and I hadn't been out with it.

So I still wrote the post about guessing honestly rather than the post about data, because the data still doesn't exist. Just not for the reason I was about to give. The instrument had been running the whole time, waiting for me to go outside.

The first question is odd on purpose. Asking what the app makes a person physically do drags the answer away from the code and toward the thing the code is for, which is where the interesting numbers were.

## 4. Follow one post through every model call

> Read everything that talks to the Anthropic API. For each call site: what it's for, what goes into the prompt, whether there are retries or fallbacks, what happens on an error, and whether the call is logged, traced, or sent to PostHog in any form. Then follow one post from user action to published output and list every model call it makes in order. Tell me if there's any way, from what's recorded today, to work out which call produced a bad output after the fact. Finally, check whether PostHog's LLM observability or tracing is wired up anywhere, and if not, what the smallest change to add it would be.

**What it found.** Three call sites, two to five model calls per post, and no way to tell which call wrote a bad caption. Four catch blocks and not one of them logs a failed call. Nothing reads token usage or the stop reason, so a truncated response looks like the model producing nonsense. A prompt cache marker on a system prompt that's probably too short to cache, silently doing nothing. Two front ends that replay the same refine conversation differently, one of them including a turn the model never saw.

**What I did.** The wrapper's going in this week, the trace ID already exists as the idea ID, and the stop reason check is a one-liner. The cache claim gets verified against a real response before I say it out loud again.

"Tell me if there's any way, from what's recorded today, to work out which call produced a bad output after the fact" is the sentence that did the work. It forces the agent to reason about the future you, standing over a bad output, with only what the system kept.

## Then ask for the copyable version

This one isn't an audit and it wasn't a fresh prompt. It's the follow-up I sent in the same session as prompt 2, once I knew what the setup looked like, and it's the step that turns a list of your own mistakes into something a stranger can use. Next time I'd phrase it like this:

> Give me a minimal, copyable version of the PostHog setup with the app-specific parts taken out. Pin the versions, make sure it typechecks, and check the geohash helper against known reference values. Nothing in it should need a native module.

It produced the versions table, a client that can't throw into a render, a geohash function checked against London and Sydney, and a one-line note on what's deliberately not installed and why. It went in the repo and the tutorial links to it, so the post about my setup ends in something that isn't mine.

"Against known reference values" is the bit I'd keep. Without it, the agent would have told me the geohash worked. With it, it told me what it checked.

## What makes an audit prompt work

Reading the four back, the ones that found things share four moves.

Name the source of truth and refuse the shortcut. From the code, not the registry. From the call sites, not the config.

Ask for the absence, not just the presence. Which flags are dead. Which events never fire. What isn't logged. Agents are good at describing what's there and won't volunteer what isn't unless you ask.

Ask what future-you can reconstruct. "Is there any way, from what's recorded today, to work out X after the fact" is the single most productive question I've asked a model, because it's the question the system will actually be asked when something breaks.

Ask for the smallest fix. Not a plan, the minimum change. It stops the answer turning into a roadmap and gives you something to do that afternoon.

And one thing that isn't a prompt. Read the answer for what it didn't find. Every one of these audits was written by an agent that couldn't reach my PostHog dashboard, and each one said so rather than guessing. The moment it starts guessing at state it can't see, the audit is worth nothing, and you'll only notice if you're reading for it.

Which I can now put a number on, because I eventually connected the dashboard and re-ran the questions against live data. Two of the four answers changed. Both changed because I had been wrong, not because the agent had been. It had told me, accurately, that it couldn't see the rollout state, and in both cases the thing it couldn't see was the thing I was most confident about.

## Who shouldn't bother

- Anyone who'll act on the answer without checking it. Two of the findings above were things I had to verify myself before I'd say them in public. The audit tells you where to look, not what's true.
- Anyone whose registry, docs and code have never drifted. You don't exist, but if you did, prompt 1 would be a waste of your time.
- Anyone auditing a codebase they can't change. The point of asking for the smallest fix is that you make it. Otherwise it's a list of your own failures with no exit.

If you run any of these on your own repo, I'd like to hear what yours found. Particularly the dead flag count. I'm hoping it isn't just me.

---

*Whimsee and Jackdaw are side projects. The prompts are mine, the audits were Claude Code, and the things it found were also mine, unfortunately.*
