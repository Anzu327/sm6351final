# 项目规范 / Product specification

## 最新视觉决定（优先于提案和旧版概念）
目标是沉浸式 3D 数据叙事，不是图文展览页。首屏没有品牌、标题、导航或正文，只有中心陨石和底部 Scroll 提示。用户先观察，再通过镜头获得空间关系。后续采用 Globe.gl 的真实纹理球体与交互，不照搬示例中的随机彩色柱子。

配色：背景 #030509，正文 #e7e7e3，次要信息 #939ba5，陨石点 #dbd5c6，火流星点 #b7c9d5，选中记录使用克制的浅金色。字体使用系统无衬线与 Georgia；正文在地球阶段才出现。不要加亮色仪表盘、霓虹或巨大发光轨迹。

[已选视觉参考](design-target.jpg)表达镜头顺序，不是天体位置的事实依据。参考图的示例地球点位不作数据使用；实际位置必须使用 catalog ID 对应的真实坐标。陨石模型为程序化几何与材质，不称为真实扫描或精确复原，也不在主画面额外标注。

## 镜头时序与鼠标
开场滚动段默认 500svh，其中实际受控距离为 400svh，进度统一为 0–4：
- 0–0.35：只有 Sikhote-Alin，小幅慢转，可用鼠标拖拽旋转。
- 0.35–1.45：Fukang 与 Black Beauty 从后方靠近两侧。
- 1.45–1.8：三颗同框，保留观察时间。
- 1.8–2.8：两颗同伴分别向左右远离。
- 2.3–2.95：主角缩小并隐藏。
- 2.95–3.8：Globe.gl 地球出现并拉近可读尺度，主角对应的地理点得到强调；没有 3D 陨石遮挡地球。
- 3.8–4：地球构图稳定，再进入文字叙事。

按滚动位置直接计算每帧状态，支持逆向滚动与跳章，不做一次性入场动画。启用 reduced motion 时取消自动旋转、缩短滚动距离，仍保留可读叙事。

地球叙事阶段可拖拽旋转，滚轮继续推进故事。进入 atlas 后滚轮缩放，页面不滚动；Return to story 恢复原滚动位置。加减按钮供触屏与键盘用户缩放。

**地球可见后，陨石模型仅在 hover 预览中出现。** 三位主角可从数据点或底部姓名入口唤起；Black Beauty 没有地图坐标，因此从姓名/搜索列表进入。普通记录显示真实字段与详情，不将三位主角的模型冒充任意记录的外形。离开目标或按 Escape 收起预览，手机以点按选择代替 hover。

## 四段英文叙事
1. **One among many.** Sikhote-Alin: observed fall on 12 February 1947 in eastern Russia. One event produced fragments. The map point is a catalog record, not the precise location of the displayed fragment.
2. **A window inside.** Fukang: found near Fukang, China in 2000. Its pallasite cut face exposes olivine crystals within iron-nickel metal. Crystal effects belong to the polished section, not a glowing natural crust.
3. **Black Beauty.** NWA 7034: a Martian basaltic breccia, found in 2011. A memorable nickname leads to a scientific origin story. Do not invent a precise recovery location.
4. **Follow your curiosity.** Transition from three protagonists into the atlas. Conclude that a discovery map reflects both visitors and human discovery/recording effort.

Each chapter exposes an authoritative source link. There is no narration audio or autoplay sound.

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
- nasa:23593 — Sikhote-Alin, 46.16 / 134.65333.
- nasa:34491 — Fukang, 44.43333 / 87.63333.
- nasa:54831 — Northwest Africa 7034 / Black Beauty, coordinates unavailable.

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
Geometry uses a dense indexed smooth mesh, explicit concave pit intersections for the iron specimen, physically based material response and authored mineral albedo textures. Texture maps use filtering and mipmaps; avoid nearest-neighbor pixel noise or unlit white faceted placeholders. The pallasite cut face and crust can be toggled from its atlas detail while previewing; the model still hides when hover/focus ends.

The exact Sikhote-Alin scan found at Museum Wales / Sketchfab (8eaab162b9144299ad42104c386ac5b5) reports isDownloadable=false. It was not copied, scraped or mislabeled as a bundled model. Current geometries remain authored approximations, with no visible scan disclaimer requested by the owner. A future licensed specimen scan must match the actual hero identity; do not substitute a different meteorite while keeping its name.
