---
title: PostHog on Expo, no native modules
summary: No page views, no coordinates, nothing you didn't decide to send.
category: build
order: 80
---

Whimsee sends 72 hand-written events to PostHog and 0 page views. It's a GPS discovery app I built on my own as a side project, mostly to learn, and this is how PostHog is wired into it. It's the setup I'd hand to anyone starting an Expo app today, and it's opinionated. No provider, no autocapture, no session replay on mobile, no native modules, and an event stream where nothing arrives that I didn't decide to send.

[photo: bare-canopy.jpg | looking straight up through bare winter trees at a pale sky, branches crossing overhead]

Some of that is because Whimsee is an app that sends children into woods and I'd rather under-collect than explain myself to a regulator. Some of it is because a store build once died on every device before a line of JavaScript ran, and I'd like that to be the last time.

The copyable version, versions pinned and typechecked, is in the repo.[^1] Here's the why, and the three things I got wrong and fixed while writing this.

## Don't install the native peers

`posthog-react-native` is pure TypeScript. It has no native module of its own, which is the single most important fact about it and the one the docs don't shout about. Its optional peers do have native code.

| Package | What it adds | Installed here |
|---|---|---|
| `expo-file-system` | Storage backend for the queue | No |
| `expo-device` | Richer device context | No |
| `@posthog/react-native-plugin` | Native crash capture, session replay | No |
| `@react-native-async-storage/async-storage` | Fallback storage | Yes |
| `expo-constants` | App name, version, bundle ID | Yes |

Leave the first three out. The SDK feature-detects its way around them. Persistence falls back to AsyncStorage, device context comes from `expo-constants` and `Platform`, and error tracking stays at the JavaScript level. What you lose is small. What you gain is that an over-the-air update can never land on a binary whose native side disagrees with it.

The reason I'm firm about this is 0.2.0 build 5. I added `expo-image-manipulator` for a photo cache, its version was one patch out from `expo-modules-core`, and it referenced symbols core didn't export. The build died at dyld, on every device, every launch, and nothing about typecheck or lint could have caught it. That was one Expo module. The PostHog native peers are the same class of risk, and for an app that ships over the air, the fewer things that can disagree with the binary the better.

```bash
npx expo install posthog-react-native @react-native-async-storage/async-storage expo-constants
```

That's the whole install. It runs in Expo Go, in a dev build, and over the air.

## Build the client so it can't take the app down

Construct the client directly rather than through `<PostHogProvider>`, and wrap every call.

```ts
let client: PostHog | null = null;
if (KEY) {
  try {
    client = new PostHog(KEY, {
      host: HOST,
      persistence: 'file',
      captureAppLifecycleEvents: true,
      customAppProperties: { /* app name, version, os */ },
    });
  } catch (e) {
    console.warn('PostHog init failed:', e);
    client = null;
  }
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export function track(event: string, properties?: Record<string, Json>) {
  try { client?.capture(event, properties); } catch { /* never throw into the app */ }
}
```

`Record<string, unknown>` is the obvious signature there and it doesn't compile: the SDK wants values it can actually serialise. Typing it loosely lets a caller pass a `Date` to an event that can never carry one.

Construction sets up the queue and the AppState listeners, so even that gets a try. Analytics is never worth a boot crash, and an analytics library that can throw into a render is one that eventually will, on someone's phone, in a field, where you can't see it.

`captureAppLifecycleEvents: true` gives you Application Opened, Backgrounded, Installed and Updated for free. Those are the only free events in this setup. Everything else you write by hand, which brings us to the part that's actually a decision.

## Events mark a decision or a physical act, never a screen

With no provider there's no expo-router integration and no `$screen` event. All 72 of Whimsee's events are hand-written `track()` calls.[^2] That's a real trade and you should make it on purpose. You lose autocapture funnels and get nothing for nothing. You gain an event stream where nothing arrives you didn't choose to send, which matters when a screen name would itself tell me something about a person I don't want to know.

The rule I use for what counts as an event is that it marks a decision or something someone did with their body, never a screen they looked at. The core loop is five events end to end: `app_open`, `hunt_started`, `dig_zone_arrived`, `glimmer_found`, then either `glimmer_kept_forever` or `glimmer_floated_away`. Planting is `glimmer_hidden`. Everything else is a fork in that road, like `find_declined` or `photo_rejected`, which has 10 call sites and is the most instrumented thing in the app because the photo rules are where people hit friction.

That one deserves its numbers, because it's the best argument I've got for instrumenting a thing before you need it. In the last 90 days `photo_rejected` fired twice. Two refusals against 80 photo glimmers successfully planted, which is a rejection rate of 2.4%, and both of them landed on 3 and 8 August. `photo_compression` went live on 12 August, and in the five weeks since, the app has quietly shrunk 46 photos and refused none at all. Ten call sites, two events, and between them they show a fix working. The kill switch I couldn't reach when that build died turned out, in the end, to be guarding something that did exactly what it was meant to.

If you want the automatic version instead, wrap the app in `PostHogProvider` with `autocapture={{ captureScreens: true }}` and let it read the navigation state. I'd only do that if screen names in your app are boring, and in mine they aren't.

[diagram: the five-event loop as a path, with the forks drawn off it. Your hand.]

## Send the area, never the coordinate

Whimsee is a location app that never sends a coordinate to analytics. Every event that needs a place carries `area`, and `area` is a five-character geohash: a cell about 4.9km on a side, which is enough to say this part of the Forest is busy and far too blunt to point at a house.

```ts
track('glimmer_found', { area: coarseArea(lat, lon), content_type, offline, again });
```

The geohash is computed on the phone before anything leaves it, and it's standard geohash so it agrees with every other implementation.[^3] Content never travels either. `glimmer_found` carries what type of thing was found and whether it was found offline, enough to read a walk as a story, nothing that says what was found or where. If you're instrumenting anything with a location in it, this is the one section I'd copy without thinking too hard.

## Fire the event when the thing happens, not when it syncs

This one I found while writing this post, and it's embarrassing enough to be useful.

A glimmer planted with no signal, which under tree cover is most of them, goes into an offline queue and syncs later. The `glimmer_hidden` event was fired on the online path only, after a successful insert. The offline branch enqueued the plant and returned, and the sync function never fired anything either. So every plant made without signal was invisible to analytics, forever. Every plant-side number I'd been looking at was a count of plants made in signal.

It was worse than that, because the queued record had no timestamp. I couldn't have backdated the event at sync even if I'd wanted to.

The fix is to fire the event when the action is taken and let the SDK stamp it:

```ts
await enqueue(item);
track('glimmer_hidden', { offline: true });
```

The SDK's own queue already survives a dead zone and delivers with the right timestamp, so an event fired at enqueue arrives correctly whenever the phone finds signal. An event fired at sync arrives hours late and in the wrong place. Make `offline` a property rather than a separate event, so one funnel reads both paths. The hunt side had done this correctly from the start, which is how I knew what the plant side should look like.

And there's a companion to this on the find side, which I noticed while checking the fix, and which I can't resolve yet.

`glimmer_found` has carried an `offline` property from the beginning, which was the side that was already right. In the last 90 days it fired 55 times, and `offline` was false on every single one of them. Not missing, not defaulted. Explicitly false, 55 times out of 55.

Whimsee has five separate offline flags and all five are at 100%: packing an area before you set off, caching photo glimmers, writing those photos to disk, spots, and the signed-in profile answering from a local cache. That whole apparatus exists because people hunt under tree cover in the Forest of Dean, where there is frequently no signal at all. In 90 days it has not once been the path a find came down.

I don't know which of two things that is. Either the dead zones are less total than I think and people really are finding things in signal, or there's a second version of the plant-side bug sitting somewhere on the hunt side and I haven't found it. The difference between those is the difference between a feature nobody needs and a feature nobody can reach, and I can't tell them apart from a dashboard. So I'm writing it down as unresolved rather than picking the flattering one, which is the whole reason you keep a number you don't like.

## `persistence: 'file'` does not mean a file

This is the gotcha I'd most like the docs to have told me about.

The SDK's storage picker prefers `expo-file-system` when the binary links it, and only falls back to AsyncStorage when it doesn't. Which is fine, until you add `expo-file-system` for something unrelated. I added it for the photo cache. That silently moved the event queue, the cached feature flags and the anonymous distinct ID from AsyncStorage to a JSON file in the document directory, on store builds only, while over-the-air builds carried on using AsyncStorage.

Nothing crashed. The SDK feature-detects in both directions. But the first launch of the store build read an empty store, regenerated the anonymous ID, and ran on flag fallbacks until the first fetch came back.[^4] The comment I'd left in `analytics.ts` saying `'file'` picks the best available persistence, "here AsyncStorage", was the belief that turned out to be wrong.

If a signed-in person needs to stay the same person across that, re-identify from your own session on app open, and don't trust a config value to mean what it says when the modules underneath it can change.

## Tell PostHog which users are children

Whimsee has an age gate and child accounts, and until this week the analytics layer didn't know that. The `is_child` flag existed on the profile and gated the UI in 6 places, but `identify()` was called at 6 sites and none of them passed it. A paired child device fired the same events, under the same kind of identity, as an adult.

What protected a child was the general architecture: no content in any event, a 4.9km cell never a coordinate, no ad SDKs, pseudonymous identity, EU cloud. That's more than most, and it's still not the same as treating a child differently, and the ICO's Age Appropriate Design Code treats profiling off by default for children as a standard rather than a nicety.

The mechanism was already sitting there. I'd been stamping `internal: true` on identify for team accounts so PostHog's internal-and-test filter keeps us out of every insight. The same shape works for children. Pass `is_child: true` through `identify()` and you can hold every child out of every insight with one filter, without losing the safety events like `age_gate_blocked` that you do want. It's a one-file change and I made it while writing this section. If you're building anything a child might use, put that line in before you put anything else in.

## Who shouldn't do this

- Anyone who wants autocapture funnels for free. This setup gives you nothing you didn't write, and if your screens are boring, use the provider and turn things off instead.
- Anyone who needs native crash capture or mobile replay. Those need the plugin I've refused to install, and that's a real trade, not a free one.
- Anyone who doesn't have a reason for every event. Hand-written instrumentation with no rule for what counts is worse than autocapture, because it looks deliberate and isn't.

## What's missing, on purpose

There's no session replay on mobile. There is on the website, because I want to know whether people actually read the scribblings or bounce off the second paragraph, and a blog post is about as low-stakes as a replay gets. The app is different. Mobile replay needs exactly the native surface I've been avoiding, and the privacy argument is stronger than the crash one: a replay of the reveal screen is a replay of a glimmer's words, and a replay of a child's session is a replay of a child. I already have their location for the app to work, and watching someone move through it would still have felt wrong. That's not a logical distinction and I'm not going to pretend it is.

The thing replay is usually bought for, seeing why a flow failed, `plant_failed` does honestly. It carries an error name, a code and a 180-character message, and it grew those fields after my sister's gallery uploads failed on build 8 and all the telemetry could tell me was that the glimmer slipped away. I had database access and logs, so I found it. A stranger wouldn't have, so now the event says what went wrong.

And the honest bit. Whimsee has disciplined instrumentation and almost no readout. 72 carefully designed events and, at the last audit, 1 of them wired to a decision anyone was making, which is 1.4%. In the 30 days to 15 September, the funnel from `hunt_started` to `dig_zone_arrived` ran 44.3% to 5.1%,[^5] down at both steps since July, which looks like a catastrophe and is actually expected, because there aren't enough glimmers in the ground yet for most hunts to end in a dig. The part I'd rather point at is the bottom of that funnel: of the four people who reached the dig zone, all four revealed a glimmer, and all four went on to decide whether to keep it. Median time from arriving to revealing, thirty seconds. Nobody who arrives fails. The entire loss is in getting there.

I'd still build it this way. Build it before you need it, because when you do need it you'll wish you'd had it before. You can't reconstruct what accuracy a phone had last September, and you can't reconstruct which plants were made under trees either. Now you can.

> **Prompt I used for the audit:** Read the analytics layer properly. What events do we capture and what's the rule for what counts. What happens to an event for a glimmer planted with no signal. What does analytics do for a child user. Is session replay on, and if not was that decided or forgotten.

---

[^1]: [github.com/ookpassant/expo-min-setup](https://github.com/ookpassant/expo-min-setup). Two files, the versions it was pinned and typechecked against, and the reference values that prove the geohash. One of those values was wrong when it was first written, and the test is the only reason anyone found out.

[^2]: 72 events, 37 flags on mobile, and a registry file that disagrees with the code on three of them. The audit that found all of this was Claude Code reading the repo. The calls about what to change were mine.

[^3]: `coarseArea(51.5074, -0.1278)` is `gcpvj`, which is London. If yours says something else, your geohash is wrong.

[^4]: I noticed none of it. The app opened, it worked, and the only reason I know any of this happened is that I went looking while writing this post.

[^5]: That funnel filters out internal and test accounts, which includes mine. The raw event counts elsewhere in this post don't. On a project where the entire core loop is 296 hunts from 79 people, the gap between with-me and without-me isn't a rounding error, so it's worth knowing which of the two you're reading.

---

*Whimsee is a free side project. Analytics are PostHog on EU cloud, which is UK GDPR plus not having to think about it.*
