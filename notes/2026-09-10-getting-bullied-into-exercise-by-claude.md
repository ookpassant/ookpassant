---
title: getting bullied into exercise by claude
summary: a claude code skill is a markdown file. this one makes claude set you a desk workout while it works, then check up on you.
category: build
---

i sit down to write code and stand up several hours later. [minimum-viable-exercise](https://github.com/ookpassant/minimum-viable-exercise) is a claude code skill that makes the tool i'm sitting in front of do something about that.

## what a skill actually is

a folder with a markdown file in it. the file has a short header that tells claude when the skill applies, and then plain instructions. no code, no api. you install it and claude reads it whenever the description matches what's about to happen.

the trick in this one is the trigger. it fires before any task claude reckons will take a while: long code, documents, research. the header says so in words. "if there's a delay coming, use it."

## what it does

before starting the work, claude names one exercise, gives a rep count or a duration, adds a form cue and one dry line. then it gets on with the job without waiting for you. when it comes back with the result, it asks whether you did it. once.

the tone is the point and the file is blunt about it. dry, deadpan, mildly competitive. not cheerful. not optional-feeling. "the exercise is happening. the only variable is whether the user completes it."

there's a bank of twenty exercises, all doable at a desk in under ninety seconds. seated leg raises. desk push-ups. glute squeezes, which the file describes as "completely invisible. zero excuses." star jumps, if nobody's watching.

## the check-in

this is the whole bit, and the file says so. if you did it, one dry acknowledgement. if you didn't, one line of mild judgement and then the work anyway. if you ignore the question altogether: "i'll take the silence as a no."

## what i learned writing it

most of the file is about what not to do. one exercise, not three. one line of judgement, not a lecture. no coach voice. never skip the check. writing a good skill turned out to be writing a good brief, and briefs are the part of my job i've done longest.

it's on github. your assistant will be slightly disappointed in you.
