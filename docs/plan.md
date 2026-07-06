# Watch an AI Agent Think — Build Plan

Single-page explorable: three hand-scripted agent runs on a scrubbable timeline —
planning, tool calls, failure, recovery, context pressure. ~3 min of content,
static site, shipped at hour 10. Footer: "Design engineer. I make AI comprehensible."

## Locked decisions (not up for debate on build day)

- Design system: pokeport tokens (black / #0a0a0a / #252525 / green accent, Inter + JetBrains Mono). Dark only.
- All motion via `lib/spring.ts` — no CSS easing, no animation libraries. The solver is the flex.
- **Two modes:** play mode = springs animate between event states; scrub mode = state
  derived instantly from scrub position, no springs. Reverse scrubbing is free because
  scrubbing never animates.
- Everything on screen is a pure function of (scenario, timeline position).
- Event schema: `plan_step | tool_call | tool_result | error | replan | compact | done`,
  each with `at` (ms), `tokensAfter`. Context gauge interpolates between events — no tick events.
- Layout: three panels — agent's mind (plan/reasoning), action stream (terminal blocks),
  context gauge. Tabs for scenarios.
- Mobile: same player, one prop — auto-play with progress bar + tap-to-jump chapters.
- No real LLM anywhere. No backend. Deploy: Vercel, static.

## The three scenarios

1. **The Loop** (~45s) — "find why tests fail, fix it": plan → read file → spot bug →
   edit → tests green → stop. Teaches think → act → observe → repeat.
2. **The Recovery** (~60s) — tool result comes back wrong → old plan grays and dies →
   new plan grows → different approach converges. **The shareable moment.**
3. **The Pressure** (~60s) — long task, context gauge fills → agent compacts (steps
   compress into a summary block) → converges. Teaches why long tasks are hard.

## Checklist

### H0 — Tonight (done unless unchecked)
- [x] Spring solver secured: `lib/spring.ts` + `lib/spring.test.ts`, 5/5 passing (`npm test`)
- [x] Scaffold: copied zed-next-app, ported pokeport design tokens, stripped
      framer-motion / radix / cva / old components
- [x] git init + initial commit, pushed: github.com/douvy/how-agents-think
- [x] Three scenario scripts drafted, reviewed by second model, five line-level
      edits applied, typed in `data/*.ts` (schema in `lib/timeline.ts`)
- [x] Reference folder: 7 Zed screenshots in `reference/`, synthesis in
      `docs/design.md` (pokeport palette is law, Zed structure wins)
- [ ] Kill-switch check before sleep: scripts exciting? If not → spring playground fallback

### H1–2 — Schema + shell + static scenario 1
- [ ] `lib/timeline.ts`: event types + `stateAt(script, ms)` — pure, tested
- [x] Scenario scripts in `data/*.ts`, typed (done in H0)
- [ ] Page shell: three panels + tabs + footer, token classes only
- [ ] Scenario 1 renders fully from its JSON at 1440px and 390px
- [ ] **Gate: screenshots of both widths. Stop-loss: 15 turns.**

### H3–5 — The player
- [ ] Playback clock (rAF) driving `stateAt`; play/pause
- [ ] Scrubber: drag sets time, state derives instantly (no springs in scrub mode)
- [ ] Springs on event transitions in play mode: tool-call blocks stream in,
      plan steps check off
- [ ] Scenario 2: plan-death (gray/collapse) + replan growth
- [ ] **Gate: screen recording of full scrub forward AND backward. Stop-loss: 25 turns.**
- [ ] H4 decision gate (10 min max): if scrubbing fights, cut to play/pause + chapter jumps

### H6–7 — Scenarios 2+3 + gauge + mobile
- [ ] Scenario 3: context gauge fill + compaction visual (steps compress to summary block)
- [ ] Gauge interpolates `tokensAfter` between events
- [ ] Mobile mode: auto-play, progress bar, tap-to-jump chapters (same player, one prop)
- [ ] **Gate: recordings of all three scenarios, desktop + mobile. Stop-loss: 20 turns.**

### H8 — Copy + share surface
- [ ] Copy pass: dry, declarative, Zed register
- [ ] Deep-link state: `?s=2&t=34` (read on load, update on scrub)
- [ ] OG image: mid-scrub frame of scenario 2 (plan graying out)
- [ ] Favicon, meta, footer: "Design engineer. I make AI comprehensible."

### H9 — Ship
- [ ] Punch-list pass (your taste notes)
- [ ] Perf: no layout thrash on scrub (transform/opacity only), Lighthouse sanity check
- [ ] `npm run lint && npm run build && npm test`
- [ ] Deploy to Vercel, verify OG card in validator

### H10 — Buffer. Something will eat it.

## Launch (day after)
- Scenario-2 recording as the hook: "watch an AI agent's plan fail and regrow"
- Post to X + aggregators, pin to profile
- Sequel: devtools launch kit (~12 blocks, 3 pages, ⌘K palette) sold to this audience
