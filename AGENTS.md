# Agent entry point

## Owner requirements
- Be honest and critical. Point out errors; do not fabricate results or broaden responsibility beyond the task.
- This delivery uses **GitHub API-only writes to main**. Do not clone or edit a local project unless the owner separately authorizes a different workflow.
- Read README.md, docs/PROJECT_SPEC.md and docs/HANDOFF.md before changing anything.
- Do not send messages or open external issues on behalf of teammates without explicit authorization.

## Non-negotiable experience
1. First viewport: exactly one 3D meteorite plus a small down-scroll hint. No headings, logo, navigation, prose, coordinates or visible panels.
2. Scroll brings two other specimens into the scene; they subsequently leave to opposite sides. Then the main specimen shrinks away and Earth appears.
3. Earth view never continuously displays a 3D specimen. Hover a featured record to reveal its model; pointer exit or Escape hides it. Touch selection is the equivalent.
4. Space mood: almost-black background, muted realistic blue Earth, quiet off-white points. No rainbow, neon, colored columns or flashy HUD.
5. Scrolling is reversible and must not conflict with Earth rotation/zoom. Do not replace the timeline with timed autoplay.
6. Retain all real records, both layers, filters, missing-value handling, sources and factual distinctions.

## Architecture boundaries
- src/story.ts: source-backed copy, immutable hero IDs and chapter configuration.
- src/models.ts and src/scene.ts: geometry, lighting, shared WebGL scene, timeline, hover preview and picking.
- src/types.ts and src/data.ts: public data contract, loading and filters. Keep consumers and docs synchronized when changing the contract.
- src/main.ts and src/style.css: semantic UI, story/atlas mode, responsive layout, controls and accessibility.
- scripts/normalize.mjs: cleaning source of truth; scripts/check-data.mjs validates all records.
- tests and .github/workflows: remote checks, browser evidence and CI-generated dependency lock.

## Collaboration
Use separate feature branches after this initial delivery, with a PR describing behavior and checks. Do not rewrite other agents' uncommitted work or force-push. No fuzzy hero matching: use nasa:23593, nasa:34491, nasa:54831.
Coordinate schema changes before editing shared files. Keep work areas small; owners can divide work using HANDOFF.md.

## Definition of done
Typecheck, data verification, build and meaningful browser scenarios pass. Inspect the actual screenshots for silent opening, joined companions, sideward exit, Earth with no specimens, hover preview, atlas and mobile layout.
Record source SHA, test evidence and limitations. Never label an uninspected image as visually verified. Do not claim a public URL exists when only source/build artifacts were uploaded.
