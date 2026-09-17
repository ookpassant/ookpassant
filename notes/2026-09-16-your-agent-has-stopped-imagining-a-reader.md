---
title: Your Agent Has Stopped Imagining a Reader
summary: you're absolutely right! this article stinks.
category: essay
order: 20
---

The next section is 300 words of technically correct prose with no reader in mind. Underneath it is the same incident in 100.

---

## The incident

It's worth noting at the outset that feature flag registries occupy a load-bearing position in the operational surface area of any over-the-air deployment topology — not merely as documentation, but as a first-class artefact whose fallback semantics are, crucially, orthogonal to runtime state. In Whimsee's case, the registry lived in CLAUDE.md, a file that enumerated all sixty-three flags with mechanical precision and recorded each flag's resolution-time fallback: the behaviour the client exhibits before PostHog's evaluation contract completes, or when degraded connectivity means it never does.

Let's be clear about the failure mode here. This isn't a case of the flags misbehaving; it's a case of the fallback-as-truth contract collapsing into a state-registry drift vector. On 9 August, tester-facing change notes were authored — with grim determination — from the registry rather than the dashboard, asserting that two flags (`map_vector` and `nature_themes`) were disabled. Both had been at 100% rollout for over a week. The registry was not wrong about what it recorded; it was wrong about what the reader believed it recorded. This isn't a documentation bug, it's an epistemic boundary violation.

The blast radius was non-trivial but contained. The keeper — which is to say, the founder — identified the divergence before any tester-originated escalation, preventing a compounding trust-erosion footgun across the beta cohort's mental model, the registry's implied invariants, and the dashboard's ground truth. The remediation was threefold: annotate every registry line with an explicit "fallback" marker, establish the dashboard as the sole source of state, and treat prose registries as descriptive rather than authoritative.

Crucially, the same drift pattern recurred between the analytics audit document and the deployed configuration: the audit asserted no session replay on web, while replay was enabled for blog-engagement telemetry. This isn't an isolated incident; it's a systemic property of context maintained in prose. The real question is not whether such documents drift, but how quickly, and whether the drift surface is instrumented.

---

## What that said

I keep a list of my feature flags in a markdown file. It says what each flag does when the app can't reach PostHog, not whether the flag is currently on. On 9 August I wrote tester notes from that list and told people two features were off. Both had been at 100% for a week. Nobody caught it but me. I've since written "fallback" next to every line so I stop reading the file as if it were the dashboard.

The same thing happened with my analytics notes. They still said there was no session replay on the website after I'd turned it on to see whether people read the blog.

Files describing a system drift from the system. That's the whole incident.

---

## What I think it means

At the end of August, Jina Yoon wrote [a good piece](https://posthog.com/newsletter/fix-your-agents) about subtracting context so agents can think. The line I keep coming back to is: for each line in your AGENTS.md, if you can't name the failure it prevents, delete it. I'd like to steal that and point it the other way.

For each sentence your agent writes, if you can't name the reader it's for, it shouldn't be there.

Every sentence in "The incident" is defensible and not one of them is for anyone. "Load-bearing" is a word you use when you're not sure the sentence would stand up without it. "Non-trivial" is a number you didn't look up. "This isn't X, it's Y" is a rhythm, not necessarily a distinction, and it appears three times because it feels like thinking. "State-registry drift vector" is four nouns doing the work of none.

Claudish is what writing sounds like when the writer has stopped imagining a reader. A lot of agent prose is now written for other agents: context goes in, a plan comes out, another agent reads it, and by the time a human sees anything the prose has been through three rounds of nobody.

We had this before. Corporate-speak is what people wrote when they were writing for their manager instead of the customer. Same failure, manager swapped for subagent.

I'd built a tool for this before the dialect had a name. It's a skill that runs Wikipedia's "signs of AI writing" list over a draft and flags the tells: the -ing phrases that add fake depth, the rule-of-three lists, the sententious little closer at the end of every section, the em dashes.[^1] I made it because I hated reading my own AI-assisted drafts, and I've used it on every post since, including this one.

If you're editing your AGENTS.md because of Jina's piece, do the same pass on the last thing your agent wrote for a human. Count the sentences you can name a reader for.

---

[^1]: The skill isn't public, but I'll share it if you ask. It's based on [the field guide maintained by WikiProject AI Cleanup](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), which uses real examples from Wikipedia. The page is descriptive rather than prescriptive; I use it as an editing checklist, not an AI detector.
