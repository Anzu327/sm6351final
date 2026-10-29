# Team handoff / 组员 Agent 接手说明

## Current state
Implemented in source:
- Silent one-stone opening, scroll-controlled companion join / sideward exit / Earth reveal.
- Single Globe.gl / Three.js renderer, procedural specimens, bundled Earth texture.
- No always-visible specimen in Earth view; featured-model hover/focus previews, touch selection.
- Four source-backed chapters, atlas mode with explicit return, source links.
- Complete meteorite and fireball snapshots, filtering, map picking, paginated lists, detail fields and linked D3 charts.
- Data load retry, WebGL fallback, mobile layout and reduced-motion support.
- Remote type/data/build/browser workflow with screenshot and production artifacts.

Verification: **pending initial remote workflow until docs/qa/run.json exists**. Read its sourceSha and runUrl before reporting anything verified. Initial implementation status does not imply a passed visual review.

## Work areas
| Area | Primary modules | Next agent should verify |
| --- | --- | --- |
| Data and science | src/types.ts, src/data.ts, scripts/, data/raw/, public/data/ | Reproducible normalization, stable hero IDs, missing coordinates, source-specific dates and units. Update PROJECT_SPEC with any schema change. |
| 3D and motion | src/models.ts, src/scene.ts | Inspect actual remote captures; check scale, material highlights, companion depth/side exit, globe handoff and hover preview position. Preserve single renderer and point batching. |
| Narrative and interface | src/story.ts, src/main.ts, src/style.css | First screen has no text except Scroll; prose starts only after Earth. Check labels, keyboard paths, mode switching and mobile panel readability. |
| Validation | tests/, .github/workflows/, docs/qa/ | Source SHA matches evidence; no page errors; screenshots actually inspected; do not equate build success with visual fidelity. |

Dependency order: agree on shared types and hero IDs first; then data / 3D / UI may be worked on independently; integrate before final browser verification. Use separate branches and PRs after this direct-to-main delivery. Do not edit shared contracts in parallel without coordination.

## Acceptance checklist
- [ ] Inspect opening-desktop and opening-mobile: one meteorite, only Scroll hint.
- [ ] Inspect companions-joined and companions-leaving: actual 3D depth and opposite-side exit.
- [ ] Inspect earth-handoff: no specimen models remain over Earth.
- [ ] Verify upward scroll reconstructs previous states.
- [ ] Hover a featured point/name to reveal the correct model; leave target / Escape hides it.
- [ ] Black Beauty is searchable and inspectable without a false map pin.
- [ ] Metadata and counts agree with the complete filtered dataset.
- [ ] Meteorite mass legend and JPL energy legend are distinct; time meanings are stated.
- [ ] Mobile inputs, results and map controls are reachable; no horizontal overflow.
- [ ] Failed data loads, reduced motion and absent WebGL remain usable.
- [ ] Record actual source commit, Actions URL, test results and screenshot review.

## Known boundaries
No public deployment, authentication, backend, audio, precise orbital reconstruction or true specimen scans. Only the three featured meteorites have specimen models. Missing mass/coordinates/year remain unknown. The historical NASA meteorite snapshot is not current through 2026.
Natural Earth political boundaries are not used to infer country statistics. Charts summarize observed catalog records, not estimated physical fall frequency.

## How to continue
1. Read AGENTS.md and PROJECT_SPEC.md.
2. Inspect the current main SHA and docs/qa/run.json.
3. Claim one work area in your PR description; list any shared-file edits.
4. Run the checks in README. For GitHub-only work, use the existing Actions workflow.
5. Update this ledger with concrete completed / verified / remaining work and links. Do not delete earlier limitations without evidence.
