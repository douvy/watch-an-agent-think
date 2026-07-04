# Design Spec

Palette + type = pokeport tokens (law). Structure + register = Zed references
in `reference/` (7 screenshots, 2026-07-04). Where the two conflict, pokeport
palette wins; Zed structure wins.

## Tokens (locked — from pokeport, already in globals.css)

- bg `#000000`, surface `#0a0a0a`, border `#252525`, hover `#151515`
- accent green `#22c55e`, negative `#ef4444`, warning `#f59e0b`
- text `#b8bdc7`, muted `#8b8b95`, headers `#fbfbfb`, link `#62a5ff`
- Inter (UI micro-text) + JetBrains Mono

## Structure — steal from Zed refs

- **Blueprint grid is the signature move**: hairline dividers with small
  `+`/diamond markers at cell intersections; dotted frames around the player;
  ruler ticks along page margins. Hand-drafted, measured. (refs 01, 03, 07)
- **Hairline cells, no card backgrounds**: features/panels divided by 1px
  borders, content sits directly on bg. (refs 03, 05)
- **Mono-forward density**: body/explanatory copy leans mono, not sans.
  Inter only for nav/micro-labels. Tiny uppercase `.label` captions. (all refs)
- **Agent panel = our action stream** (ref 02, the key one): tool calls as
  quiet indented mono lines with a small icon ("Read …", "Search …"),
  thoughts as short prose blocks between them, user task in a bordered block
  at top. Our tool_call/thought events render in exactly this language.
- **Kbd chips**: single-letter shortcuts in small bordered squares — use for
  play/pause (Space) and scenario switching (1/2/3). (refs 01, 06)
- **Stats treatment**: large mono numerals + muted label under — use for the
  context gauge readout (e.g. `6,800 / 8,000 tokens`). (ref 04)

## Player-specific

- Three panels in one blueprint-framed shell: mind (plan/thoughts),
  action stream (terminal-register blocks), context gauge (bar + mono numeral).
- Plan death: steps gray to muted, block collapses on a spring; replacement
  plan grows in beneath. Green accent reserved for success beats
  (tests pass, 200, done) — scarcity keeps it loud.
- Errors: `--accent-negative` left border on tool_result blocks, not red fills.
- Compaction: completed blocks physically squeeze into a single summary card;
  gauge numeral drops live.
- All motion: `lib/spring.ts` presets only. No CSS easing anywhere.
