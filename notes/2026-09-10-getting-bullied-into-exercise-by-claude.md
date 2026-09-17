---
title: Getting Bullied into Exercise by Claude
summary: A Claude Code skill sets one short desk exercise before a long task, then asks whether you did it.
category: build
---

I sit down to write code and stand up several hours later. [Minimum Viable Exercise](https://github.com/ookpassant/minimum-viable-exercise) is a Claude Code skill designed to interrupt that pattern.

When Claude is about to start a long task, the skill tells it to give me one short exercise first. Claude then does the work and asks whether I exercised when it comes back.

It cannot see me, start a timer or know whether I am lying. Mild disappointment is the entire enforcement mechanism.

## What the skill contains

A Claude Code skill starts with a folder containing a `SKILL.md` file. The file has YAML frontmatter describing when the skill is relevant, followed by instructions written in Markdown.

This particular skill contains no executable code and calls no API. It is a written procedure for Claude to follow.

The description is important because Claude uses it to decide whether to load the skill automatically. Mine describes long-running work such as coding, document production and research. In effect: if I am about to sit still while Claude works, give me something physical to do.

That trigger is guidance, not a deterministic hook. Claude decides whether the skill is relevant, so it may occasionally miss a task or invoke the skill at an odd moment. It can also be run directly with its slash command.

## What happens when it runs

Before starting the requested work, Claude provides:

- One exercise.
- A number of repetitions or a duration.
- One form cue.
- One dry line about completing it.

Then it starts the actual task without waiting for an answer. When the work is finished, it asks once whether I did the exercise.

The tone is specified as carefully as the behaviour: dry, deadpan and mildly competitive. It should not sound like a cheerful fitness coach, and it should not turn ninety seconds of movement into a motivational speech.

The skill puts it more bluntly:

> The exercise is happening. The only variable is whether the user completes it.

## The exercise bank

There are twenty exercises, all designed to be done beside a desk in less than ninety seconds. They include seated leg raises, desk push-ups and glute squeezes, described in the file as “completely invisible. Zero excuses.”

There are also star jumps for occasions when nobody is watching.

The list keeps the instruction concrete. Without it, Claude would have to invent a suitable exercise every time, and the tone and difficulty would drift. The bank also makes it easier to remove anything that needs equipment or takes too long.

## The check-in is the product

The exercise suggestion is easy. The follow-up is what turns it into a small accountability system.

If I did it, Claude gives one dry acknowledgement. If I did not, it gives one line of mild judgement and then delivers the work anyway. If I ignore the question, the instruction is equally short:

> I'll take the silence as a no.

Nothing is logged and there is no streak. The skill asks once, reacts once and moves on.

## What writing it taught me

Most of the useful work went into defining what Claude should not do:

- One exercise, not a routine.
- One form cue, not a lesson.
- One line of judgement, not a lecture.
- No chirpy coach voice.
- Do not hold the requested work hostage while waiting for an answer.
- Do not forget the check-in.

Writing the skill felt less like programming than writing a good brief. The mechanism is simple. The result depends on specifying the moment, behaviour, tone and stopping point clearly enough that Claude can reproduce them.

The skill is [available on GitHub](https://github.com/ookpassant/minimum-viable-exercise). Your assistant will be slightly disappointed in you.
