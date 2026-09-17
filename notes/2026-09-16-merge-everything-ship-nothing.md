---
title: Merge everything. Ship nothing.
summary: How one person runs a release process with 62 feature flags.
category: build
order: 10
---

I have 62 feature flags in a side project: 37 on mobile, 22 on the website, and 3 that both ends read. The project is Whimsee, a GPS discovery app I built on evenings because I wanted it to exist and wanted to learn how. When I wrote most of the flags it had no users. It's in both stores now, and the number has gone up rather than down, which I'm aware is the wrong direction.

[photo: forest-window.jpg | a stained-glass panel hung from a timber frame across a leaf-covered forest path, autumn beech on one side and dark conifers on the other]

The picture of feature flags most people carry around is the canary: a new checkout rolled out to five percent of a million people while someone watches the error rate. I had nobody to roll out to. So what were they for?

The answer has a name, and I didn't know it. Engineers split flags into roughly four kinds (Pete Hodgson's write-up on Martin Fowler's site is the one everyone points to). Release toggles let unfinished code sit on main, switched off. Experiment toggles run A/B tests. Ops toggles kill things that misbehave. Permission toggles decide who gets to see what.

What I'd built was mostly the first kind, on nearly everything, with a lot of the third mixed in. Trunk-based development, arrived at by accident, through pure trial and error, by someone who had never heard the phrase.

Which matters, because I'm not a traditionally taught developer. I have an illustration degree and a day job in comms, and this is one of the things I build to stay interested. So I came at it backwards: built the thing, then went looking for what it's called, and found a textbook pattern that I'd then kept pushing past the point where the textbook stops. The pushing-past is the interesting part. It's also where I'm least sure I'm right, so if you're an engineer reading this with your head in your hands, I do want to hear why.

Here's how flags ended up being the release mechanism for a solo Expo app, told through three of mine, what PostHog thinks of the pile, and the rule I've only just noticed I don't have.

## Ship everything. Flip what's live.

Whimsee is an Expo app, and Expo ships updates over the air. You merge to main and the JavaScript goes out to installed phones without a release build, an App Store review, or anything else in the way. In practice that means main is production, because there isn't a staging environment to hide unfinished work in.

So the question I had early on was how you merge things that aren't finished, and the answer I landed on was a flag on almost everything. Not on the risky features or the big ones, on each feature individually, so that any one of them can be turned on, turned off, and turned back on again without touching a build. The code goes out with the merge. The feature waits until I say so.

That's exactly what a release toggle is for. The odd part is doing it for nearly every feature, alone, with nobody to coordinate with but myself.

It was a decision rather than a habit that crept up on me. I wanted a way to test things on myself in the real build, on my own phone, standing in an actual wood, and once the flag is what separates "code that's on main" from "thing a person can see", branches stop being where work in progress lives.

Sixty-odd flags need a list, so there's a registry file in the repo. Each entry is a paragraph rather than a row: what the flag gates, which end reads it, and what the code falls back to if PostHog can't be reached. Not every flag has one, and only about a third of the entries say anything at all about when the flag should come out, which becomes relevant later. It's the thing I read instead of the dashboard. When I say registry in this post, I mean that file, not PostHog's flag list.

[diagram: main → OTA → phones, with the flag drawn as the switch between "merged" and "live". Your hand.]

## A flag lands faster than an update

There's a detail about Expo that makes flags more than a convenience, and it took me a while to fully appreciate it.

An over-the-air update doesn't arrive when you merge it. By default the app downloads the new bundle the next time it's opened, and then runs it the time after that. So to actually see a change, a person has to close the app and reopen it, and then close it and reopen it again. Twice. And there is no good way to tell people that. You can't push a notification saying "please quit the app twice to see the thing", and even if you could, nobody would.

Yes, I know about reloadAsync. You can fetch the update on launch and restart the app into it straight away. I chose not to, because a restart a few seconds after opening the app is exactly the kind of thing that makes people think it's broken, and because a network fetch on every launch is a poor trade for an app whose whole point is that you're outdoors, often without signal. Whimsee waits for the update to arrive on its own.

A flag doesn't have that problem. Flip it in the PostHog dashboard and the app picks it up on its next flag fetch, which for most people is the next time they open it. One open, not two, and no explaining. For a solo app where the users are people who've wandered into it rather than a team who'll read your release notes, that's the difference between a feature landing and a feature landing eventually, for some people, once they happen to restart.

So the code still goes out over the air, in the background, whenever it goes. The moment a feature becomes visible is a flag flip, and that's a moment I control.

## Test on yourself, then on one other person

The mechanics of "test on myself" changed as the app got users, and all three versions are useful if you're building alone.

When there were no users at all, I just flipped flags at 100%. There's nobody to protect, so a flag is a switch you throw from a dashboard instead of from a commit, and it saved me a rebuild every time I wanted to see whether the new map felt right on a real phone.

Once there were some users, I started targeting my own person ID. The flag was on for me and off for everyone else, and I was running the unreleased thing inside the same production build everyone else had. No separate test build and no TestFlight track for my bad ideas, just me walking around the Forest with the future switched on and nobody else any the wiser.

That worked the other way too. An early user suggested a feature, so I built it, targeted his person ID, and he had it on his phone before anyone else with a direct line to tell me what was wrong with it. The person who asked for the thing got to be the person who tested it, and it stayed invisible to everyone else until he'd had his say.

Once the app went public, the same flags targeted a group of testers who'd agreed to see broken things, so a feature got a small real audience before it got everyone. Through all of that the flag never changed and the code never changed. Only who could see it did.

All of that is past tense, and I only found out how completely when I went and looked at the dashboard for this post. Not one of the 64 flags in the dashboard targets a person or a group today. Every single one is at 100%, at 0%, or switched off. The targeting was scaffolding, and it turns out I took it down each time it had done its job, without ever noticing that was a thing I was doing.

## Three flags, three different jobs

| Flag | What it gates | Fallback | What happened |
|---|---|---|---|
| `blog_trail_lantern` | "Light the lantern" card on a field note | Off | Still held on main, unramped since 22 August, waiting on a trail to be planted |
| `intro_redesign` | New onboarding copy and swipe | Off | Created, ramped to 100%, deleted twenty minutes later |
| `photo_compression` | Downscale photos before the 5MB check | On | Kill switch that couldn't be reached, because the build died before JavaScript ran |

### A flag can hold back a promise

`blog_trail_lantern` wasn't protecting against a bug. The card is real, finished code. It sits at the foot of a field note on the Whimsee blog and says want to walk this, light the lantern, with a QR code and a button that takes you to the trail. It merged to main on 22 August and then sat there with the flag off, marked do not ramp, for weeks, and neither reason had anything to do with whether the code worked. The trail the article was written about hadn't been planted yet. And the Forest of Dean Local History Society hadn't got back to me about whether I could write about it at all.

Without a flag there are only two moves and I didn't like either. I could leave it on a branch, where it would rot, because main took fifteen-odd blog commits in that window including changes to the parser the lantern's build-time checks live inside, and that branch would have been a mess to merge by the time the society replied. Or I could ship it live, and someone on a laptop would scan a QR, drive to Cinderford, and stand in a wood where nothing was planted, on a trail I hadn't been given permission to write about.

The flag let the code age along with main while the promise waited on a human being.

And this is where I have to correct myself, in the post about registries that disagree with reality. When I started writing this section I told you the lantern was live. It isn't. I went and checked while pulling the numbers for this piece, and `blog_trail_lantern` was created on 22 August at 0% rollout and has not been touched since. One entry in its whole activity log, no ramp, nothing. The article it hangs off is still sitting in a drafts folder, held back until the ground is seeded. The card has been finished and merged for over three weeks and no human being has ever seen it.

I had shipped it in the only place that really counts, which is my own head, and the dashboard had no idea. That's the exact failure this post is about, happening inside the post about it. The registry describes flags, it doesn't prove them. Neither, it turns out, does the person who wrote them.

### A flag can undo a bad twenty minutes

On 23 July I redesigned the intro screens, the ones you see the first time you open the app. New copy, new swipe. It went out behind a flag, I put it live, and it was wrong. The swipe really didn't feel right. It felt like a series of statements instead of a journey in. That was the whole review.

The activity log is less flattering than my memory. I created the flag at 12:54, ramped it to 100%, and deleted it at 13:14. It was live to everyone for fourteen of those twenty minutes, and I never targeted my own phone with it at all. So what the flag bought me wasn't a private trial. It was the deletion: there was nothing left for the switch to switch, so the flag went with the feature. It's the only one of the three you won't find in my dashboard, and the only one that got a proper ending, and I got there by hating the thing rather than by having a rule.

### A flag can't gate linkage

This is the one that bit, and it's the one I'd want you to take away if you take anything.

`photo_compression` downscales a photo before the 5MB check, and it shipped as a kill switch: flag on by default, with a note in my registry saying to turn it off if the compressor misbehaved. The compressor did misbehave, and the switch turned out to be irrelevant.

The compressor came with a native module, `expo-image-manipulator`, and its version was one patch step out from `expo-modules-core`. It referenced symbols that core didn't export, so 0.2.0 build 5 died at launch, on every device, every time, before a line of JavaScript had run. No JavaScript means PostHog was never reached, which means the flag was never read, which means the off switch I'd carefully documented was decoration.

The part that actually stung was that having the switch there made adding a native module feel reversible when it wasn't. The real mitigation isn't a flag at all, it's launching any build with a new native module from TestFlight before you submit it, which I do now.

[diagram: what a flag can reach. JS and behaviour inside the line. Native linkage, dyld, the binary itself outside it. Keep it rough.]

## Who shouldn't do this

- Teams with a staging environment and a release train. You're probably running a tidier version of this already, with a tenth of the flags.
- Anything where the feature has to be off the instant you say so. A flag lands on the next fetch, not on the flip, and for me that's fine.
- Anyone who won't write down when a flag comes out. Which, as it turns out, includes me.

## I have a rule for putting them in and half a rule for taking them out

My rule for putting flags in is simple and I'd defend it. Almost every individual feature gets one, so it can be tested, turned on, turned off, and turned on again without a rebuild, and so the moment it becomes visible is one I choose.

For taking them out, I thought I had nothing. Then I read my own flag descriptions in PostHog properly and found I'd been writing exit conditions all along, just the wrong kind. The demo door App Review asked for says to turn it off once Apple approves the app. `testers_page` says to retire it when the test round ends. `blog_trail_lantern` says do not ramp until the trail is planted and the society says yes. Six flags carry a permanent tag and a note saying never retire, never ramp below 100: the age gate, the location badge, spots showing a rough area instead of a pin, quiet blocking, text size, and cookieless web analytics.

Every one of those conditions is about switching a flag off. Not one says when the flag, and the if-statement wrapped around it, should be deleted. That demo door is the proof. Apple approved the app, I switched that flag off on 25 August exactly as the note told me to, and the app has asked PostHog for it on every sign-in since, because the read is still in the door. Off is not gone.

The descriptions themselves have the same problem. `keep_light` says "currently 0%, raise to try". It's at 100%. `testers_page` says to retire it when the test round ends. The round ended and it's still on. I wrote those notes to future me, and future me read them as the truth instead of as a to-do. So the registry describing flags without proving them isn't a problem with my registry file. It's a problem with any description of a flag that isn't the flag.

So that's one half of the gap: exit conditions that stop at off. The other half is what's actually in the code, and I only saw that because I asked an agent to audit it before I wrote this.

> **Prompt I used:** Pull every feature flag from the code, not from the registry file. The registry describes flags, it doesn't prove them. For each one tell me what it gates and whether there's still a live read anywhere. Then tell me which ones are dead.

It found 4 flags with no reads anywhere, still sitting in the dashboard. 1 that's retired but can't be deleted, because a page still reads it with the fallback set to on and removing the flag would bring the page back from the dead. 2 flags in the code that never made it into the registry at all, and 1 registry entry describing a state the code had moved on from three commits earlier. That was 8 of 63 on the day, or one flag in eight where the registry and the code disagreed, in an app one person maintains.

It's 6 of 62 now, and only 2 of those are dead flags. Two of the four got deleted outright after the audit, which is the cheerful part of this: the list got shorter because somebody finally read it.

PostHog has its own opinion on the pile, which I also hadn't looked at. The flag list has a stale filter, and on my project it picks out four: two partner workshop pages, the lantern grounds chooser, and the old waitlist page. All four are web pages almost nobody has opened in a month. That's a different question from the one the audit asked, and I think you need both. The dashboard can tell you nobody has asked for a flag lately. Only the code can tell you nothing is able to ask. Until this week I'd looked at neither.

The two dead flags still in the dashboard are worth looking at, because they're wrong in opposite directions. `photo-glimmers` is the oldest flag in the project, created on 5 July, and it has spent ten weeks sitting at 100%. The read came out of the code weeks ago. Nothing on main asks for it. And yet PostHog logged eleven calls to it in the last fortnight, the most recent on 15 September, which took me a minute. The likeliest answer is a phone still running a bundle from before the read was removed, because an over-the-air update only lands when someone opens the app, and some people don't. So the flag is dead on main and alive on somebody's phone, and the dashboard is faithfully reporting the phone. It's also the only flag I ever named with a hyphen instead of an underscore, which is very likely why my eye has slid off it every time.

Then the mirror image, which turned up in the code rather than the dashboard. `mobile_journal_theme` was read by the app for nine days in July and never existed in PostHog at all. For nine days the app asked for a flag that had never been created and quietly took the fallback every single time. Nobody noticed, because there was nothing to notice, which is precisely how `photo_compression` failed. PostHog's VS Code extension has a category for exactly this, flag keys in your code that don't exist in the project, which I found out about after the fact. A flag nothing reads is untidy. Code reading a flag that was never there is the same bug as a kill switch you can't reach.

Here's the rest of the dashboard as it actually stands, which I'd also never looked at all in one go:

| State | Flags |
|---|---|
| On, 100% | 58 |
| On, 0% | 2 |
| Switched off | 4 |
| Partially rolled out | 0 |
| Targeted at a person or group | 0 |

Sixty-four flags in the dashboard against 62 with a live read in the code, and the gap is the two dead ones. Between 16 and 25 August I flipped four: two ramped from 0 to 100, and two switched off after the store release. Nothing has moved since.

So here's the rule I'm adopting as of writing this, and I'd take a better one if you've got it.

Every flag gets a type on the day it's created, and the type decides how it dies. Hodgson's split does most of the work. A release flag exists to hide unfinished work, so once it has sat at 100% through a store release, the if-statement comes out of the code and then the flag comes out of PostHog, in that order, because deleting the flag first flips every read to its fallback. A kill switch has to answer one question on day one: is it guarding a rollout, or a thing that's going to stay? If it's guarding a rollout, like `photo_compression`, it dies with the release flags. If it's guarding a page people have been emailed a link to, it's permanent, and it gets called that instead of sitting in the pile pretending it might come out one day. A permanent flag says so in its tag and gets looked at once a quarter, to check it still deserves the word. And whatever the type, the exit gets written down on day one, and the exit is the day it's deleted, not the day it's switched off.

Flags that fall back to on get reviewed first, because they're the ones that fail open when a phone can't reach PostHog, which is exactly when nobody's looking. That one I hadn't thought about until the audit. A flag that falls back to on is a promise that the feature works without you, and it's worth checking it's still a promise you mean.

## Fifty-eight switches, or fifty-eight settings

Here's the thing I can't stop turning over. 58 of 64 at 100%. Nothing targeted at anyone. Nothing flipped since 25 August. My first instinct was to call that configuration: a release mechanism that had quietly stopped releasing anything, each flag with a switch attached that nobody is reaching for.

I'm less sure now, because of the update lag. A flag flip reaches a phone on the next open. An over-the-air fix needs two. So a flag sitting at 100% is still the fastest way I have to turn off anything that lives in JavaScript, and those 58 look a lot like off switches I just haven't needed yet. `photo_compression` is the warning about what that promise is worth when the problem is native. For everything above that line, the switch works.

What I actually have, then, is three piles wearing the same label. Six flags I mean to keep forever. Some number of kill switches I'd reach for on a bad day. And a heap of release flags that finished their job weeks ago and were never told. Sorting those apart is the real work, and it's what the removal rule is for. I put a flag on everything because I had nobody to roll out to. I've still got nearly all of them because I never decided which ones were switches and which ones were just on.

If you've got a better removal rule, I want it. Reply here, or find me in the PostHog Discord as Sea.

---

*Whimsee is a free side project. The flags are PostHog. The audit was Claude Code reading the repo, and the calls about what to do with what it found were mine. Next time I'd start with PostHog's stale filter and its VS Code extension, which would have got me a good part of the way there.*
