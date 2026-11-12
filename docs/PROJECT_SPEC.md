# 项目规范 / Product specification

## 最新视觉决定（优先于提案和旧版概念）
目标是沉浸式 3D 数据叙事，不是图文展览页。首屏没有品牌、标题、导航或正文，只有中心陨石和底部 Scroll 提示。用户先观察，再通过镜头获得空间关系。后续采用 Globe.gl 的真实纹理球体与交互，不照搬示例中的随机彩色柱子。

配色：背景 #030509，正文 #e7e7e3，次要信息 #939ba5，陨石点 #dbd5c6，火流星点 #b7c9d5，选中记录使用克制的浅金色。字体使用系统无衬线与 Georgia；正文在地球阶段才出现。不要加亮色仪表盘、霓虹或巨大发光轨迹。

[已选视觉参考](design-target.jpg)表达镜头顺序，不是天体位置的事实依据。参考图的示例地球点位不作数据使用；实际位置必须使用 catalog ID 对应的真实坐标。陨石模型为程序化几何与材质，不称为真实扫描或精确复原，也不在主画面额外标注。

## 镜头时序与鼠标
开场高度为 300svh，实际受控距离为 200svh。先观察和拖动 Chelyabinsk 碎片，随后它缩向地球上目录点的投影。目录点接住碎片，地球拉近。富康和霍巴在各自的章节才首次出现。第一章只显示主角的当前记录，进入下一章时才淡入完整点集。

滚动可逆。地球叙事阶段可拖拽旋转，滚轮继续推进故事。章节之间的短镜头可被拖拽或跳章打断。进入 atlas 后滚轮缩放，Return to story 恢复原滚动位置。减少动态效果模式使用静态构图，跳过镜头转动、文字位移和选点微光。

地图按可见点的屏幕距离选点。鼠标命中半径为 10 CSS 像素，触屏为 22 CSS 像素。点的视觉尺寸继续编码质量或能量。选中后显示实心标记和细环，地图点选成功时出现一次短促放射效果。React Bits 的 Animated Content 和 Click Spark 是章节入场和选点效果的设计参考。

故事中的富康和霍巴模型由章节按钮打开，可用 Escape 或切章关闭。图鉴继续支持从地球数据点、姓名入口和列表预览主角模型。Black Beauty 可通过搜索查看，无可用坐标。

## 四段英文叙事
1. **Chelyabinsk: One event, two records.** 地面目录记录与 JPL 火球最亮点分别用圆点和菱形表示，后者的观测高度约为 23.3 km。两个坐标表达各自数据源的含义。
2. **A window inside.** 通过 Inspect the cut 查看富康橄榄石和铁镍金属的抛光剖面。
3. **A change of scale.** 通过 Compare the scale 查看霍巴模型，并将目录所附资料中的 2.95 m 宽度和 1.75 m 人体身高参照并列。
4. **Follow your curiosity.** 进入完整图鉴，比较陨石目录与火球观测。

## Data contract and provenance
Meteorite:
```ts
{ id: string; sourceId: string; name: string; classification: string;
  nameType: string; status: 'Fell'|'Found'; year: number|null;
  rawYear: string|null; lat: number|null; lng: number|null;
  massG: number|null; issues: string[] }
```
Fireball:
```ts
{ id: string; name: string; date: string; year: number;
  lat: number|null; lng: number|null; energyKt: number|null;
  radiatedEnergyJ: number|null; altitudeKm: number|null }
```
Units are grams, UTC ISO timestamps, degrees, kilotons TNT, joules, and kilometers. Every displayed count derives from the current filtered records. Header filters apply to a complete layer, not a random sample. The record list is paginated in batches of 30; the map and charts use the full filtered layer.

Stable protagonists:
- nasa:57165 — Chelyabinsk, 54.81667 / 61.11667. JPL peak-brightness record: `jpl:2013-02-15 03:20:26`.
- nasa:34491 — Fukang, 44.43333 / 87.63333.
- nasa:11890 — Hoba, −19.58333 / 17.91667.

Meteorites: NASA historical catalog, fetched through the preserved CSV in stef molin's pandas-workshop at commit 45e34fb30ffcecc9fe0b4d71b83fd991a69ccde1. Its documentation identifies NASA as the source. Primary NASA download failed in this environment; the transport is recorded transparently in the manifest. The original Git blob SHA is 76b222ef72144595b2d4692d0c965e7934264451.

Fireballs: direct NASA/JPL API response, version 1.2, acquired 2026-10-29. Parse rows using the supplied fields array; coordinate signs come from lat-dir / lon-dir. Coordinates refer to peak brightness, not ground impact or meteorite discovery. Do not merge the layers into claimed event matches.

Cleaning:
- Keep every record and stable source ID.
- Empty, impossible and 0,0 placeholder coordinates become null; true zero latitude OR longitude stays valid.
- Years outside this meteorite snapshot's 860–2013 window become null with an issue; retain rawYear.
- Non-positive mass becomes null. A small point represents unknown mass, never a zero-mass claim.
- Fell year means observed fall; Found year means discovery. Preserve original classification and name type.
- The raw catalog mass may be recovered total material rather than one fragment. Never compare it to a fictional model's physical size.
- Raw source files, normalized shards, issue counts and source metadata remain in the repository. No live data request is needed during browsing.
- A failed snapshot load produces an explicit error and retry; no fabricated filler data.

## Delivery and verification
GitHub API writes to main only for this delivery. Local project cloning/editing and public deployment were not authorized. GitHub Actions runs on the source commit and records screenshots plus the npm dependency lock through the GitHub API. The evidence commit may have no separate CI run; docs/qa/run.json points to the source SHA actually checked. If main advances, the workflow skips the evidence commit rather than mixing revisions.

Tests cover scrolling in both directions, model rotation, hover-only previews, search/filters, Black Beauty without a pin, layer-specific units, missing data, failed-load retry, mobile layout, reduced motion and WebGL failure. Browser screenshots require human/agent visual review; test success alone is insufficient.

## Model realism and material assets
Geometry uses a dense indexed smooth mesh, explicit concave pit intersections for the procedural specimens, physically based material response and authored mineral albedo textures. Texture maps use filtering and mipmaps; avoid nearest-neighbor pixel noise or unlit white faceted placeholders. The pallasite cut face and crust can be toggled from its atlas detail while previewing; the model still hides when hover/focus ends.

An earlier Sikhote-Alin scan found at Museum Wales / Sketchfab (8eaab162b9144299ad42104c386ac5b5) reports isDownloadable=false. It was not copied, scraped or mislabeled as a bundled model. Current geometries remain authored approximations, with no visible scan disclaimer requested by the owner. A future licensed specimen scan must match the actual hero identity; do not substitute a different meteorite while keeping its name.
