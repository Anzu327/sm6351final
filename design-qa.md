# Design QA

final result: passed

Verified source: 71d3fe2999fa8b6fbae189677db3b92921909a05. Remote run: https://github.com/Anzu327/sm6351final/actions/runs/40818270037. Typecheck, complete-data verification and production build passed. Browser result: four cases passed directly; the capture sequence passed on its configured retry after one 30-second screenshot timeout (Playwright reports one flaky case). All required functional assertions passed in the successful run. The screenshot retry remains a tooling reliability limitation, not a claim of a clean first-attempt run.

## Visual truth and capture
- Target: docs/design-target.jpg (1487 × 1058 pixels, a 2 × 2 storyboard). Source panels are approximately 744 × 529.
- Implementation: docs/qa/opening-desktop.png, companions-joined.png, companions-leaving.png, earth-handoff.png, hover-fukang.png, meteorite-atlas.png and atlas-mobile.png.
- Desktop: 1440 × 1024 CSS pixels, screenshot density 1. Mobile: 390 × 844 CSS pixels, density 1.
- The comparison puts the target and actual render in the same image: docs/qa/design-comparison.jpg. Panels are scaled proportionally into 720 × 512 slots; no image is stretched. Storyboard divider lines are presentation boundaries, not website chrome.
- Captures come from Playwright Chromium on a remote GitHub Actions runner using SwiftShader. The owner required GitHub API-only project writes, so no local checkout, development server or public deployment was used. The connected API was used to read screenshot evidence back from the private repository.

## Required fidelity surfaces
| Surface | Evidence and result |
| --- | --- |
| Fonts and copy | Opening shows only a small sans-serif Scroll hint. No title, logo, nav or prose is visible. Chapter display type is Georgia and reading/control text uses the system sans-serif. Website is English. |
| Layout and rhythm | Centered single specimen with generous negative space; two companions emerge on opposite sides, then leave. Globe occupies the reveal. Desktop atlas separates filters, globe and detail list; mobile has a contained globe above usable panels without horizontal overflow. |
| Colors and tokens | Near-black background, sparse stars, subdued mineral colors and a desaturated midnight-blue Earth. Off-white record points replace the reference example's colored columns. |
| Image / model quality | Replaced white faceted meshes and nearest-neighbor pixel noise with indexed smooth geometry, explicit concave iron pits, filtered authored mineral textures, controlled exposure and a bundled 2K Earth map. Geometry is authored, not a specimen scan; exact photogrammetric identity is not claimed. |
| State and interaction | Models disappear before Earth appears, and return only as featured hover/focus/touch previews. Exit and Escape clear previews. Dragging Earth suppresses previews; selecting a featured meteorite switches to the meteorite layer. |

## Comparison history
1. **P1: white faceted specimens.** Initial remote captures had visibly white polygonal surfaces. Fixed with denser geometry, joined normals, darker physical material response and controlled directional-light targets.
2. **P1: artificial noisy / regular surfaces.** The next comparison exposed pixel noise and an overly regular cut-face pattern. Fixed with filtered generated mineral albedos, explicit concave pits, natural mixed-scale olivine textures and removal of artificial separate breccia beads.
3. **P1: excessively saturated Earth.** Fixed with luminance-based desaturation and restrained blue-gray shading. Final reveal contains no rainbow columns or permanently visible specimen.
4. **P2: mobile globe crop.** Fixed through mobile-specific camera altitude and view offset. Controls and filters stay within the viewport.
5. **P2: incomplete cut-face interaction.** Added a Fukang exterior / cut-surface switch that remains subject to hover/focus visibility.
6. **Verification tooling:** Earlier complete functional assertions reached the final capture but a sequence of full-resolution software-GPU screenshots exceeded the original two-minute test budget. The capture sequence now has a three-minute budget, each screenshot retains a 30-second limit, and assertions remain intact.

## Full-view and focused inspection
The combined comparison covers the opening, three-specimen composition and Earth reveal. Full-resolution opening and Fukang hover captures were inspected for surface detail, edge quality and label placement. Desktop atlas, mobile opening and mobile atlas captures were inspected for reading order, line wrapping, map framing, filter controls and selected-record text.

## Intentional differences and limits
- The image concept is art direction, not a scientific specimen scan or geographic reference. Actual map positions use source IDs and catalog coordinates; the fictional concept's point placement is not reproduced.
- The owner's later instruction removes the concept's lingering stone and connector from the Earth view.
- The actual sky is sparser than the generated storyboard to preserve the restrained space mood.
- Only the three featured meteorites have authored models. Generic records do not borrow those models under a different specimen identity.
- Physical touch devices and hardware-GPU frame rate have not been benchmarked. Mobile layout and selection are checked in the browser.

## Handoff gate
The latest screenshots were read back from the run identified above and compared with the selected storyboard in one combined input. Native desktop/mobile framing, opening copy, palette, material treatment, hover visibility and atlas interactions were inspected. No actionable P0/P1/P2 layout or behavior issue remained in this review. Preserve the authored-model and physical-device limits above. This documentation-only completion commit does not change the checked application.
