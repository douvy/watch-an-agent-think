# The Curriculum

This site is a course disguised as a toy. The design gets people to press
play; the curriculum is why they leave changed. Every narration line, thought,
caption, and takeaway either delivers a syllabus fact or gets out of the way.

**The promise:** after one run (~1 minute), the viewer can tell another person
one true thing about how AI agents work that they didn't know. After all
three, they can explain how an agent thinks — and they own the real
vocabulary: *agent*, *tool*, *agentic loop*, *hallucination*, *context
window*, *compacting*.

**The test for every line ("the dinner-table test"):** could a smart
12-year-old repeat this fact in their own words at dinner? If the line is
style with no fact, cut it. If the fact needs decoding, rewrite it.

---

## The syllabus

Eleven facts, plus two meta-facts. Each is true — nothing here would make an
Anthropic researcher wince. Fact 4 is backed by published interpretability
research (the "known answer" circuit misfiring; confabulation feeling
identical to recall from the inside). Fact 2 and the meta-facts are worded
around the global-workspace finding (2026): models do think in internal
activations without writing anything down, so we never claim "the text is
the thinking" or "nothing is hidden" — only that writing is what survives.

### Run 1 — The Loop (loop.ts / fridge.ts)

| # | fact | beat |
|---|------|------|
| 0 | An agent is an AI in a loop with tools. ("Language model" is true but defines one unknown with another — the vocab promise never included it.) | intro line (pristine frame) |
| 1 | The loop is: think → act → observe → repeat. It has a name — the agentic loop. | done |
| 2 | It thinks in its head too — but anything it doesn't write down is gone. The plan and transcript are the thoughts it kept. | plan |
| 3 | It has no eyes. Tools are its only senses; the world exists only in tool results. | first failing result |
| 4 | Inside, a memory and a guess feel identical — and it sounds confident either way. Answering from the guess is called a hallucination. That's why agents verify. | mid-run thought |
| 5 | Some decisions belong to the human. A good agent stops and asks. | choice gate |
| 6 | "Made" and "verified" are different states. An agent doesn't trust a fix until a check passes. | final check |

### Run 2 — A Plan Fails (recovery.ts / productive.ts)

| # | fact | beat |
|---|------|------|
| 7 | A plan is a theory, not knowledge. | plan |
| 8 | A failed check puts the whole plan under suspicion, not just the step. | failing check |
| 9 | Recovery = killing the plan and rebuilding every step from evidence. | plan_dead → new plan |

### Run 3 — Memory Fills Up (pressure.ts / apartments.ts)

| # | fact | beat |
|---|------|------|
| 10 | Memory is finite and has a name — the context window. Everything the agent reads has to fit. | plan + first result (gauge pointer) |
| 11 | Overflow doesn't slow the agent down. It loses work mid-thought. | keep-branch failure |
| 12 | Compacting = the agent rewriting its own memory: finished detail folds to a summary, room comes back. Forgetting well is a skill. | compact |

### Meta-facts (the product itself is the proof)

| # | fact | where |
|---|------|-------|
| M1 | The timeline is the agent's whole memory — an agent has no memory outside its transcript. Scrub back and the later agent doesn't exist yet. | done lines invite the scrub; finale card states it |
| M2 | Every step of the run is on screen — the whole run, start to finish. | done CTA ("drag it back") |

---

## Pedagogy rules

Distilled from the source material we calibrate against (Anthropic
announcement posts, the interpretability post, the Fable 5 launch, the
education-team roundtable, the IBM agents explainer):

1. **One fact per beat.** A beat that teaches two things teaches neither.
2. **State the fact flat, then its consequence.** "For an agent, if it's not
   written down and accessible, it doesn't exist." No rhythm tricks, no
   punchlines, no aphorisms. Boring reads as honest.
3. **Show the thing, then name it.** The IBM pattern: plain description
   first, then "this is called X." The viewer walks away owning the word.
   One or two new terms per run — three is a glossary, not a story.
4. **End by handing agency to the viewer.** The Fable close: "We know what
   it can do. The interesting part is what you'll do with it." The last beat
   belongs to the audience — here, that's the scrub-back invitation.
5. **Model uncertainty honestly.** "I was wrong. You call the next move."
   Educators say modeling not-knowing is the most powerful teaching act —
   and it's the truth about agents anyway.
6. **Everything must be true.** No fact goes in the script that the
   interpretability team couldn't sign. When a real finding exists (the
   hallucination mechanism, unfaithful reasoning, planning ahead), prefer
   its plain statement over anything invented.
7. **Confidence is the trap to teach around.** "You can't tell if an AI is
   bad at math if you are bad at math." The single most protective fact for
   a young viewer: the agent sounds exactly as sure when it's wrong.

## Register rules

- Plain modern speech. A younger reader finds it natural; nobody says
  "Dinner's on" or "From here it's discipline."
- Em-dash only when defining a term ("my memory — my context window").
  Everywhere else, use a period. Plain speech is short sentences; the dash
  is the tell of a line trying to sound composed.
- First person, present tense, concrete nouns.
- Narration never echoes its own tool output — it adds the fact the output
  can't show.
- Thoughts (italic, inner monologue) carry the longer facts; chapter lines
  stay under the 20-word cap; takeaways ≤72 chars, 2–3 lines.

## Mechanics (enforced by lib/timeline.test.ts)

- Chapter narration ≤20 words (dwell budget).
- Marquee speaks at every chapter turn and only there.
- Takeaways: 2–3 lines, ≤72 chars each.
- One voice per action beat; twins share timestamps, callIds, lessons,
  verdicts.

## Audit status

- Facts 2, 3, 5, 7, 8, 9, 11 — delivered in current scripts.
- Facts 1, 4, 6, 10, 12 — lines drafted, pending application (term-naming
  pass: agentic loop, hallucination, context window, compacting).
- Fact 0, M1, M2 — gaps: intro line, done lines, finale card.
