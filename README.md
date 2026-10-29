# Traces from Space
An English, scroll-driven 3D meteorite story and source-backed global atlas for SM6351. Team: SpaceUHK.

The opening contains **one meteorite and a small Scroll hint only**. Two companions join as you scroll, then move apart. The central fragment recedes before Earth appears. Once Earth is visible, the specimen models stay hidden until a featured record is hovered (or selected on touch).

## Start here
- [Agent instructions](AGENTS.md)
- [Story, design, interaction and data contract](docs/PROJECT_SPEC.md)
- [Team handoff and verification ledger](docs/HANDOFF.md)
- [Material asset provenance](docs/ASSETS.md)
- [Selected motion storyboard](docs/design-target.jpg)
- [Snapshot manifest](public/data/manifest.json)
- [Verification workflow](.github/workflows/verify.yml)
- [GitHub Actions](https://github.com/Anzu327/sm6351final/actions)

## Running
Node 22.12 or newer is required.
```sh
npm install
npm run dev
```
After the first CI run records package-lock.json, use `npm ci`.
```sh
npm run typecheck
npm run check:data
npm run build
npx playwright install chromium
npm test
```
The owner requested GitHub API-only edits for this delivery; no local checkout or project edits were used. Running commands above is for teammates who choose to work locally. GitHub Pages deployment is configured in `.github/workflows/deploy-pages.yml`. Repository Pages settings must use **GitHub Actions**. See [deployment status and recovery](docs/DEPLOYMENT.md).

## Real data, bundled with the site
- 45,716 meteorite records from the historical NASA Meteorite Landings catalog; 32,186 have usable locations.
- 1,074 NASA/JPL fireball events acquired on 2026-10-29; 888 have locations.
- All records remain searchable, including those without coordinates. The 2026 acquisition date is **not** the meteorite catalog's coverage end.
- Masses and energy use separate units and legends. A catalog meteorite mass can include many recovered fragments.
- NWA 7034 / Black Beauty has a 0,0 placeholder in the original catalog. It has **no map pin**.

Raw source files are in `data/raw/`; normalized browser shards are in `public/data/`. `npm run check:data` reproduces normalization from the raw files and compares every record. See [credits](docs/CREDITS.md).

## Verification evidence
The workflow checks types, complete datasets, production build, and Playwright browser behavior on a remote GitHub runner. It saves screenshots and the build as artifacts. For main pushes, it records screenshots, the npm lockfile and `docs/qa/run.json` through the GitHub API, provided main has not advanced. The evidence JSON identifies the **source commit actually tested**. A green build alone does not establish visual fidelity.

Latest checked source: `71d3fe2999fa8b6fbae189677db3b92921909a05`. [Verification run](https://github.com/Anzu327/sm6351final/actions/runs/40818270037) succeeded: type/data/build checks passed; Playwright recorded four direct passes and one capture case passing on retry. The visual comparison and remaining scope limits are in [design-qa.md](design-qa.md).
