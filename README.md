# Chelyabinsk · 车里雅宾斯克陨石

在 Finder 双击 **打开 Demo.command** 启动本地预览。先点 **Enter Site**，下滚经过俄罗斯火球开场、钟表隧道、陨石科普、火球减速和冲击波到达时间图。看完最后一段陨石科普后继续下滚，即可进入同页的车里雅宾斯克事件重建。在重建开头向上滚可返回前半段。脚本使用 Python 3，关闭终端或按 Ctrl+C 停止。

同一预览地址的 `/visitors.html` 可直接打开 VISITORS，下滚或按左右方向键切换章节，穿过石环进入太阳系。整合版的材质分析圆框展示主陨石，重建页原档案可通过 `/visitors.html#specimen` 直达。`/index.html` 可打开独立陨石 Demo。下列操作说明针对独立 Demo。构建后的 `dist/` 包含整合入口、两个 Demo 页面和本地资源。

- 从空白开场下滚，斜向切换揭开陨石场景。继续下滚时镜头下降，陨石从画面上方离开，随后穿过三道圆环。向上滚可反向重走。
- 陨石周围的线网随三维节点漂移和重连。光标划过模型表面时，奶油色和浅蓝色的柔光会沿石面扩散后逐步衰减。
- 点击陨石或 **CLICK TO EXPLORE**，镜头在画面中心完成 1.25 秒的放大，短暂停顿后，陨石才移到详情左侧。拖动模型可旋转，右侧档案可以独立滚动。点击关闭、按 Esc 或浏览器返回会恢复原来的滚动位置。
- 键盘可用 ↑、↓、Page Up / Down，Home 返回空白开场，End 到穿环结尾。需要 WebGL 2，使用桌面 Chrome 查看。

## 开发

运行 `npm ci` 和 `npm run dev`，访问 `/sleep-well/index.html` 从头查看整合版。开场页面从 `sleep-well/opening.html` 构建，公开素材及原滚动脚本位于 `public/sleep-well/`。修改后用 `npm run build` 更新 `dist/`，也可用 `npm run preview` 查看构建。收到的 `visitors-illustrated-v3(1).html` 是原始附件。

地球章节采用新的 MetBull 2024-10 公开镜像：82,854 条陨石目录记录，其中 50,951 条有可用坐标，31,903 条无坐标仍可搜索。包括 76,372 条 Official、6,385 条 Provisional、97 条 Relict*；伪陨石、陨石坑等 771 条原始档案不参与统计。选中记录可查看命名状态。数据来源、固定版本和清理规则见 [目录来源说明](src/data/README.md)。

飞行动画抽样展示各批次的代表记录，所有可定位记录均计入区域放射线，约 30 秒播放时间完成一轮目录揭示。流星大小、拖尾与落点闪光仍按回收质量区分；空中路径、顺序和落点光效为示意，Found 记录并非目击事件。SHOW ALL COUNTS 可立即展示当前选择的完整区域分布。循环不重复计数，关闭档案会保留当前筛选。档案内的 **Field Notes** 提供资料来源与读图说明。

区域放射线采用 [Globe.gl World Population 源码](https://github.com/vasturiano/globe.gl/blob/master/example/world-population/index.html) 的 H3 第 4 级分箱和 YlOrRd 色带。线宽约为各蜂窝单元直径的 80%，随单元大小变化。线长以地球半径为单位，采用 0.008 + 0.73 × (记录数 ÷ (记录数 + 800))^0.72，让零散记录贴近球面并压缩极密集区域的高度。线色随对数数量从金黄经橙色变为红色。统计反映目录采集与发现分布。

用 `node scripts/check-earth-catalogue.mjs` 核对目录条数、坐标、质量单位、区域总数、线长范围、完整揭示、暂停和循环计数。

从 **04 EARTH** 继续下滚，地球转正、放射线退回表面，球面热力层随地球展开成 **05 MAP** 的 Equal Earth 等面积世界地图。向上滚可收回。平面图显示完整目录的 50,951 条有坐标记录，每条权重为 1。热力参考 [globe.gl Population Heatmap](https://globe.gl/example/population-heatmap/) 的球面高斯核和 0.9° 带宽，在深蓝夜色底图上，以蓝紫、青绿、黄橙至红色呈现由低到高的密度。本项目用对数色标显示每 100,000 km² 的估计记录数，并将密度预先烘焙成纹理。目录更新后用 `python scripts/build-meteorite-heatmap.py` 重建纹理，生成脚本使用 NumPy、SciPy 和 Pillow。

在 **05 MAP** 点洲界内的陆地或七洲按钮可放大，点 **World map** 或按 Escape 可返回全图。局部放大使用全图的密度纹理及色标。点击区采用 [Natural Earth 1:110m Admin 0](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/) 的概化轮廓，欧亚分界作近似处理。若更新轮廓，用 Shapely 2 运行 `python scripts/build-continent-outlines.py <countries.geojson>`。

七大洲的放大视图附有十四条精选陨石记录，涵盖目击坠落和发现样本。金色圆点按目录经纬度定位，点圆点或洲名下的按钮后，引线会从记录地点连到屏幕边缘的档案卡。卡片包含标本照片、日期、分类、简介和来源。图片按原宽高比缩放并转为 WebP，作者、原始文件和许可可从每张卡片查看。放大时可直接点其他洲的按钮或地图上可见的洲界，切换到对应视图。

## 参考范围

整合入口在用户提供的 Sleep Well Creatives 本地参考结构上改编。钟表使用 Blender 建模并导出为 GLB。中央钟的表壳随滚动转动，两根指针按 12:1 的角速度倒走。原设计、开发及 3D 素材由 Victor Work / Victor Costa 创作。[Sleep Well Creatives 原站](https://sleep-well-creatives.com/)

- Kamensk-Uralsky 行车记录仪视频由 Aleksandr Ivanov 拍摄，本地版本调整了尺寸并移除了音轨。[Wikimedia Commons 原片](https://commons.wikimedia.org/wiki/File:Взрыв_метеорита_над_Челябинском_15_02_2013_avi-iCawTYPtehk.ogv) · [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- Yekaterinburg 固定监控视频的本地版本调整了尺寸并移除了音轨。[Wikimedia Commons 原片与复用说明](https://commons.wikimedia.org/wiki/File:Chelyabinsk_meteor_security_camera_footage,_Yekaterinburg.webm)

滚轮换算、两级缓动、展品的垂直镜头路径、转场视差、穿环镜头关键帧和三次畸变节点依据 [Igloo](https://www.igloo.inc/) 的公开前端代码重建。开场采用占位空景，之后衔接一个本地展品和三道圆环。陨石周围的线网依据原站的 18 点、每点最多 3 条连接及 0.35 秒伸缩逻辑，表面采用原站的 UV 轨迹注入和双缓冲扩散机制。遮罩、扰动和着色按本地模型与插画风格重建。

背景和模型的纸面颗粒、分层着色和绘制轮廓参考 [The Monolith Project](https://themonolithproject.net/)。模型来自用户提供的 `chelyabinsk-main-mass.glb` 和 `igloo-transition-rings.glb`，样本资料来自 [Meteoritical Bulletin](https://www.lpi.usra.edu/meteor/metbull.php?code=57165)。

表面效果的参考贴图来自 Igloo 公开资源 [advect.png](https://www.igloo.inc/assets/images/cubes/advect.png) 和 [triangles_tiling.ktx2](https://www.igloo.inc/assets/images/igloo/triangles_tiling.ktx2)。两张贴图都随构建保存在本地。三角纹理由 KTX2 转为 PNG，材质用同一套纸面色调着色。

VISITORS 的太阳系章节参考 [Monolith 的公开发布脚本](https://themonolithproject.net/assets/index-Dqw2FXdk.js)中的 `SceneSolar`、`GasLineMaterial` 和 `Earth`。太阳、行星、地球海面与云层、碎石复用原站公开加载的模型和手绘纹理，并转换为本地 GLB 和 WebP。轨道依据原站圆柱几何、噪声贴图和双面着色实现。原始模型与纹理创作归属 [The Monolith Project 团队](https://themonolithproject.net/)。

太阳系地球的海陆分布采用 [Natural Earth 1:10m Land v5.1.1](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/)。本地 `earth-geography.webp` 是 4096 × 2048 等经纬贴图，红通道用于裁切凸起的陆地层，绿、蓝通道由海岸距离生成，分别驱动近岸水纹和深浅色带。

开场镜头使用 30° 视角和 −13° 横滚，滚动通过太阳和地球两组镜头姿态插值。末段地球旋转至中央、靠近并覆盖整个视口，在全覆盖时衔接档案地球，再拉远至交互视图；向上滚动可反向重走。覆盖距离按视口对角线计算。整张画布使用原站纸纹，轮廓根据深度和色差做笔边扰动。按住画面拖动可绕太阳查看。松手保留角度，继续滚动回到故事镜头。

太阳系的星点寿命、太阳粒子发射、碎石闭合样条和自转依据发布包中的 `Stars`、`Sun`、`AsteroidBelt` 与 `PositionSetSpline` 移植。彗尾使用原站噪声贴图、12 fps 色带更新和 20 秒横掠加 2 秒间隔，后期参考同一包中的三次径向色散和 4 fps 轮廓扰动。VISITORS 仍使用自己的场景渲染器、太阳环绕交互和地球档案。
