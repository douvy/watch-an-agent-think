# How Agents Think

A single-page site that teaches how AI agents work by letting you watch
one think. Three hand-scripted runs play out inside a terminal-style
window with a plan, tool calls, a memory gauge, and inner thoughts, on a
timeline you can scrub like a video. Live at
[howagentsthink.com](https://howagentsthink.com).

![Scrubbing the timeline backwards through a plan death](docs/scrub.gif)

**Project status: Shipped.** All three runs, the choice branches, and the
finale are done. Remaining changes are copy and pacing fixes.

**Why build this?** Most explanations of AI agents are either marketing
or papers. I wanted the thing itself to be visible: the loop, the tool
calls, the memory filling up, the plan dying and getting rebuilt. One run
takes about a minute and teaches one true thing. All three teach the real
vocabulary: agent, tool, agentic loop, hallucination, context window,
compacting.

**Why is the whole UI a pure function of time?** Everything on screen
renders from `stateAt(scenario, ms, choices)`, with no accumulated
animation state anywhere. Every other design decision falls out of this
one: scrub to any millisecond and the screen is correct, and dragging
backward is real. The later agent doesn't exist yet, including the
ending.

## How it works

**Runs are data, not recordings.** Each run is a hand-written script in
`data/*.ts`: timestamped events (plan, tool_call, thought, choice,
compact, done). Every everyday run has a code twin with the same timing
skeleton, lesson, and verdict, so the same story plays as "what's in my
fridge?" or as a failing test suite.

**Motion is closed-form.** Springs are evaluated analytically at any `ms`
(see `lib/spring.ts`), so scrubbing, playing, and jumping produce the
exact same frames. The few wall-clock exceptions, like text entrances,
are documented where they live.

**The scripts are tested.** `lib/timeline.test.ts` enforces the
mechanics: narration length caps, token budgets, twin symmetry, branch
integrity, one voice per beat.

## Development

```sh
npm install
npm run dev     # http://localhost:3000
npm test        # timeline + spring tests
npm run build
npm run smoke   # real-browser smoke test against a prod build
```

Design notes live in [`docs/`](docs/), including the
[curriculum](docs/curriculum.md): the facts the site teaches and the
rules every line of copy has to pass.
