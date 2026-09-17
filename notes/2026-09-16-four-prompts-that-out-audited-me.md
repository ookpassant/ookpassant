---
title: 4 Prompts That Out-Audited Me
summary: Steal them. Then come and tell me what yours found.
category: build
order: 70
---

Four prompts found more problems in two of my repos than I had.

They found 8 of 63 feature flags disagreeing with their own registry, an offline analytics event that could never fire, child accounts with no child path through analytics, a GPS logger I'd switched on and then never walked with, and no way to connect a bad AI-generated caption to the model call that produced it.

[photo: dog-path.jpg | a black and tan dog standing still on a path in a dark pinewood, lit from the side, looking straight at the camera]

Three prompts ran against Whimsee, my GPS discovery app. The fourth ran against Jackdaw, which drafts and publishes social posts. Both are side projects. I'm not a developer; I have an illustration degree and a day job in comms. The useful part wasn't asking an agent to review the code. It was asking a narrow question and checking the answer.

Here are the prompts, what they found, and what changed.

## 1. Pull the flags from the code, not the registry

> Pull every feature flag from the code, not from the registry file. The registry describes flags, it doesn't prove them. For each one tell me what it gates and whether there's still a live read anywhere. Then tell me which ones are dead.

**What it found.** At the time, 63 flags had a live read: 38 on mobile, 22 on the web and 3 on both. Four more sat in the dashboard with no reads anywhere. One retired flag couldn't safely be deleted because a page still read it with its fallback set to on; removing the flag would bring the page back. Two flags in the code were missing from the registry, and one registry entry described a state the code had left three commits earlier.

**What I did.** I wrote the removal rule I'd never had and deleted two of the four dead flags. There are now 62 live reads against 64 flags in the dashboard.

Checking those numbers exposed another mistake. I had written that a flag holding back a blog card had gone live. It hadn't. It had been created at 0% and never touched. I had shipped it in my own head.

The important instruction is the first one: pull the evidence from the code and refuse the descriptive shortcut.

## 2. Read the analytics layer properly

> Read the analytics layer properly. What events do we capture and what's the rule for what counts. What happens to an event for a glimmer planted with no signal. What does analytics do for a child user. Is session replay on, and if not was that decided or forgotten.

**What it found.** Whimsee had 72 hand-written events and no page views, with a consistent rule I'd never documented: an event marks a decision or physical act, not a screen. It also found three problems. A glimmer planted without signal fired no event, ever. The `is_child` flag gated the interface in six places but never reached analytics. And my audit document said there was no session replay on the web when replay was on.

**What I did.** I fixed the offline event by firing it when the record is queued, with `offline: true`. I passed `is_child` through `identify()` so child accounts can be excluded from any insight with one filter. Then I corrected the audit document.

The live numbers raised another question. `glimmer_found` had fired 55 times in 90 days and every event had `offline: false`, despite five offline feature flags sitting at 100%. I still don't know whether the Forest has more signal than I give it credit for or whether the hunt side has the same bug I fixed on the planting side. It remains unresolved.

The useful phrase in this prompt is "decided or forgotten." It makes the audit distinguish a recorded choice from an absence.

## 3. Ask what the app does to a body

> What does Whimsee actually make someone do with their body, and what are the radii and where did the numbers come from. What does the field log collect and is there any data. Was warm/cold guidance forced by the accuracy numbers or was it a design decision.

**What it found.** None of Whimsee's distances came from measurement. The phone and server disagree on purpose: a dig appears at 10 metres and the server accepts it at 15, so GPS drift doesn't make the server refuse a button the phone has already shown. The field logger built to collect real accuracy numbers defaulted to off, and the code couldn't reveal whether it had ever been enabled.

**What I did.** I checked the dashboard. The logger had been at 100% since 31 July and had fired once in seven weeks: accuracy 19 metres, band fair. A keeper-only gate meant it could record almost nobody but me, and I hadn't taken the app for a walk.

Asking what the app makes somebody physically do pulls the audit away from implementation and towards the experience the numbers control.

## 4. Follow one post through every model call

> Read everything that talks to the Anthropic API. For each call site: what it's for, what goes into the prompt, whether there are retries or fallbacks, what happens on an error, and whether the call is logged, traced, or sent to PostHog in any form. Then follow one post from user action to published output and list every model call it makes in order. Tell me if there's any way, from what's recorded today, to work out which call produced a bad output after the fact. Finally, check whether PostHog's LLM observability or tracing is wired up anywhere, and if not, what the smallest change to add it would be.

**What it found.** Jackdaw had three call sites and made between two and five model calls per post, but recorded no way to tell which call produced a bad caption. Four catch blocks logged none of their failures. Nothing captured token usage or the stop reason, so a truncated response could look like bad model output. Two front ends replayed the same refinement conversation differently, and one included a turn the model had never seen. A prompt-cache marker also needed checking against a real response to establish whether it did anything.

**What I did.** The next change is a wrapper around every call. The idea ID can serve as its trace ID, and the stop-reason check is small. I won't make the cache claim until I've inspected a real response.

The sentence that did the work was this:

> Tell me if there's any way, from what's recorded today, to work out which call produced a bad output after the fact.

It makes the audit start with the evidence future-you will actually have.

## Then ask for the copyable version

This wasn't a fifth audit. It was a follow-up after prompt two, once I understood the analytics setup:

> Give me a minimal, copyable version of the PostHog setup with the app-specific parts taken out. Pin the versions, make sure it typechecks, and check the geohash helper against known reference values. Nothing in it should need a native module.

It produced a versions table, a client that can't throw into a render, and a geohash helper checked against London and Sydney. The result went into the repo and the tutorial links to it.

"Against known reference values" is the part I'd keep. Without it, the answer could simply claim the helper worked. With it, the answer had to show what it checked.

## What makes an audit prompt work

The four prompts share four moves.

Name the source of truth and refuse the shortcut. Read the call sites, not only the configuration. Pull flags from the code, not the registry.

Ask for absences. Which flags are dead? Which events never fire? What isn't logged? An audit that only describes what exists will miss half the problem.

Ask what can be reconstructed later. "From what's recorded today, could I explain this bad output after the fact?" is useful because it starts from the failure rather than the architecture.

Ask for the smallest fix. Not a roadmap: the minimum change you can make that afternoon.

Then read the answer for what the agent couldn't know. These audits could inspect my repos but not my PostHog dashboard, and they said so. When I later connected the dashboard and reran them, two answers changed. In both cases, the agent had accurately identified the limit; I had supplied the wrong assumption.

## Who shouldn't bother

- Anyone who will act on the answer without checking it. An audit tells you where to look, not what is true.
- Anyone looking for a report rather than a change. Without the smallest fix, this becomes a list of failures with no exit.
- Anyone unwilling to show the agent the relevant source. If it cannot inspect live configuration, treat that state as unknown rather than inviting it to guess.

If you run any of these on your own repo, I'd like to hear what they find. Particularly the dead flag count. I'm hoping it isn't just me.

---

*Whimsee and Jackdaw are side projects. The prompts are mine, the audits were Claude Code, and the things it found were also mine, unfortunately.*
