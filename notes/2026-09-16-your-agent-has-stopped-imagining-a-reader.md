---
title: Your agent has stopped imagining a reader
summary: This post is technically correct and you will not be able to read it.
category: essay
order: 70
---

Everything in the next four hundred words is true. It happened to me in August, it's in my commit history, and every claim would survive a fact-check. I've also written it in the dialect people have started calling Claudish,[^1] which means you will not be able to read it. Try anyway. Then I'll translate, and then I'll tell you what I think it means.

---

## The incident

It's worth noting at the outset that feature flag registries occupy a load-bearing position in the operational surface area of any over-the-air deployment topology — not merely as documentation, but as a first-class artefact whose fallback semantics are, crucially, orthogonal to runtime state. In Whimsee's case, the registry lived in CLAUDE.md, a file that enumerated all sixty-three flags with mechanical precision, and which — importantly — recorded for each flag its resolution-time fallback: the behaviour the client exhibits before PostHog's evaluation contract completes, or in the degraded-connectivity path where it never does.

Let's be clear about the failure mode here. This isn't a case of the flags misbehaving; it's a case of the fallback-as-truth contract silently collapsing into a state-registry drift vector. On 9 August, tester-facing change notes were authored — with grim determination — from the registry rather than from the dashboard, asserting that two flags (`map_vector` and `nature_themes`) were disabled. Both had, in practice, been at 100% rollout for over a week. The registry was not wrong about what it recorded; it was wrong about what the reader believed it recorded. This isn't a documentation bug, it's an epistemic boundary violation.

The blast radius was non-trivial but contained. The keeper — which is to say, the founder — identified the divergence prior to any tester-originated escalation, thereby preventing what would otherwise have constituted a compounding trust-erosion footgun across the beta cohort's mental model, the registry's implied invariants, and the dashboard's ground truth. The remediation was threefold: annotate every registry line with an explicit "fallback" marker, establish the dashboard as the sole source of state, and, going forward, treat prose registries as descriptive rather than authoritative.

Crucially, the same drift pattern recurred at the boundary between the analytics audit document and the deployed configuration: the audit asserted no session replay on web, while replay was, in practice, enabled for blog-engagement telemetry. This isn't an isolated incident; it's a systemic property of context maintained in prose. The real question is not whether such documents drift, but how quickly, and whether the drift surface is instrumented.

---

## What that said

I keep a list of my feature flags in a markdown file. The list says what each flag does when the app can't reach PostHog, which is not the same as saying whether the flag is on. On 9 August I wrote tester notes from the list, told people two features were off, and both had been on at 100% for a week. Nobody caught it but me. I've since written "fallback" next to every line so I stop reading the file as if it were the dashboard.

The same thing happened with my analytics notes, which still said no session replay on the website when I'd turned it on to see if people read the blog. Files describing a system drift from the system. That's it. That's the whole incident.

---

## What I think it means

Jina Yoon wrote a good piece a couple of weeks ago about subtracting context so agents can think, and the line I keep coming back to is: for each line in your AGENTS.md, if you can't name the failure it prevents, delete it. I'd like to steal it and point it the other way.

For each sentence your agent writes, if you can't name the reader it's for, it shouldn't be there. That's what the parody above is missing. Every sentence in it is defensible and not one of them is for anyone. "Load-bearing" is a word you use when you're not sure the sentence would stand up without it. "Non-trivial" is a number you didn't look up. "This isn't X, it's Y" is a rhythm, not a distinction, and it turns up three times in four paragraphs because it feels like thinking. The compound nouns, state-registry drift vector and the rest, are what a model produces when it's optimising for the next model in the chain rather than the person at the end of it.

That's the thing I'd actually argue. Claudish isn't a training glitch and it isn't laziness. It's what writing sounds like when the writer has stopped imagining a reader, and agents mostly write for other agents now. The context goes in, the plan comes out, another agent reads the plan, and by the time a human sees any of it the prose has been through three rounds of nobody. We had this before. Corporate-speak is what people wrote when they were writing for their manager instead of the customer. Same failure, with the manager swapped for a subagent.

Which is also why Jina's subtraction point is the right instinct, just aimed at the input side. Her team strips context so the model can think clearly. The same discipline on the output side is a person with a red pen asking who each sentence is for, and mostly it's for the reader, and mostly the fix is deleting.

I'd built a tool for this before the dialect had a name. A skill that runs Wikipedia's "signs of AI writing" list over a draft and flags the tells: the -ing phrases that add fake depth, the rule-of-three lists, the sententious little closer at the end of every section, the em dashes.[^2] I made it because I hated reading my own AI-assisted drafts, and I've used it on every post I've written since, including this one.[^3]

If you're editing your AGENTS.md this month because of Jina's piece, do the same pass on the last thing your agent wrote for a human. Count the sentences you can name a reader for. It'll be fewer than you'd like, and every one you cut will make the rest sound like a person.

---

[^1]: Jina would like a word with whoever coined "unhobbling". I'd like a word with whoever coined "Claudish", but I've used it four times now so the word is with me.

[^2]: The skill isn't public, but I'll share it if you ask. It's built on the list maintained by WikiProject AI Cleanup, which is worth reading on its own, because it was written by people who've cleaned up thousands of examples and have no interest in being polite about it.

[^3]: The first draft of this post came back from Claude, and I sent it back for being too Claude. Twice.
