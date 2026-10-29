# Material asset provenance

All three mineral textures were generated using the built-in image_gen tool, then resized and JPEG-encoded in memory and uploaded directly through the GitHub API. No local project edits were used. They are authored PBR color materials, **not specimen scans**. Geometry, lighting, bump response and rotation are real-time Three.js.

| Path | Purpose | Resolution |
| --- | --- | --- |
| public/assets/iron-albedo.jpg | Dark nickel-iron surface | 1024 × 1024 |
| public/assets/pallasite-albedo.jpg | Polished olivine / metal cut face | 1024 × 1024 |
| public/assets/breccia-albedo.jpg | Dark matrix with mineral / lithic inclusions | 1024 × 1024 |
| public/assets/earth.jpg | Bundled official three-globe example Earth texture | 2048 × 1024 |

Earth source and credits are in CREDITS.md. Exact generated dimensions may initially differ from the prompt; web versions use the resolutions above.

## Exact generation prompts

### Iron
Use case: photorealistic-natural. Asset type: production 1024 x 1024 seamless square PBR albedo texture, not a render of an object. Primary request: create a convincingly photographic weathered nickel-iron meteorite material tile, suitable for a dark Sikhote-Alin-like iron specimen. Entire frame must be continuous mineral surface to all four edges. Color palette: dark charcoal gunmetal, tiny variation in cold dark gray and extremely restrained brown oxidation. Materials/textures: natural fine fusion-crust flow marks, etched scuffs, mottled weathering, micro pits and worn patches at multiple spatial scales, irregular mineral grain rather than procedural pixel noise. Flat evenly diffuse illumination; no identifiable light direction, no baked directional shadows and NO specular reflections or hotspots. This is COLOR/ALBEDO only, geometry and PBR lighting will supply form. No object outline, no background, no floor, no horizon, no cracks that resemble landmass or lava, no glowing colors, no literal lunar craters, no text, no labels, no border or watermark. Real laboratory-scanned material appearance with realistic spatial variation and understated details. Seamlessly tileable edges. Keep values dark but retain distinguishable surface detail.

### Pallasite
Use case: scientific-educational. Asset type: square seamless PBR albedo material texture, 1024x1024 pixels. Generate a photorealistic top-down microscopic-to-macroscopic material view of a polished pallasite meteorite section for mapping onto an extruded interactive 3D Fukang-like specimen. The entire tile is mineral cut surface, edge-to-edge. Large and small irregular organically rounded olivine grains, muted olive green and smoky amber, embedded in a continuous silver-gray iron-nickel metal matrix. Some grains fractured with dark thin mineral cracks and tiny natural inclusions. Mix grain sizes substantially and use curved, irregular boundaries; avoid Voronoi diagrams, regular polygon tessellation, honeycomb or stained-glass geometric design. Flat evenly diffuse illumination with no directional shadows, no perspective, no strong specular or white highlights. Restrained realistic mineral palette, not a glowing gem. No background, no object silhouette, no outer edge, no text, no labels, no border, no scale, no neon, no lava. Natural geological material suitable as a physically based color/albedo texture; seamless tile continuation across opposite edges.

### Breccia
Use case: photorealistic-natural. Asset type: seamless square 1024x1024 PBR albedo texture for a 3D meteorite model. Primary request: an authored, physically convincing material inspired by Martian basaltic breccia such as Black Beauty, not a scientific scan. Fill the entire image with dense mineral surface viewed perfectly orthogonally. Near-black charcoal fine-grained basaltic matrix with natural irregular pale-gray mineral and lithic inclusions at varied tiny scales, most sub-millimeter speckles and a few larger millimeter clasts. Inclusions should be sparse and organically distributed, angular to rounded irregular natural grains, not dots, pebbles or geometric patterns. Subtle muted brown weathering. Dense nonporous stone. Flat diffuse even illumination for use as a base-color texture, no baked light gradients, highlights or shadows. Seamless tileable material at every edge. No object silhouette, no background, no moon craters, no holes, no lava, no glowing material, no text, no borders, no labels. Restrained realistic dark colors with enough tonal variation for a real-time renderer.

## Scan access check
The Museum Wales Sikhote-Alin model at https://sketchfab.com/3d-models/nickel-iron-meteorite-meteorit-haearn-nicel-8eaab162b9144299ad42104c386ac5b5 was checked via its public metadata API on 2026-10-29 and reported isDownloadable=false with no download asset. It was not bundled. Scientific references and generated materials remain separate.
