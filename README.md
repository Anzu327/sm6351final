# Chelyabinsk · 车里雅宾斯克陨石

在 Finder 双击 **打开 Demo.command** 启动本地预览。先点 **Enter Site**，下滚经过俄罗斯火球开场、钟表隧道、陨石科普、火球减速和冲击波到达时间图。看完最后一段陨石科普后继续下滚，即可进入同页的车里雅宾斯克事件重建。在重建开头向上滚可返回前半段。脚本使用 Python 3，关闭终端或按 Ctrl+C 停止。

同一预览地址的 `/visitors.html` 可直接打开 VISITORS，下滚或按左右方向键切换章节，穿过石环进入太阳系。整合版的材质分析圆框展示主陨石，重建页原档案可通过 `/visitors.html#specimen` 直达。`/index.html` 可打开独立陨石 Demo。下列操作说明针对独立 Demo。构建后的 `dist/` 包含整合入口、两个 Demo 页面和本地资源。

- 从空白开场下滚，斜向切换揭开陨石场景。继续下滚时镜头下降，陨石从画面上方离开，随后穿过三道圆环。向上滚可反向重走。
- 陨石周围的线网随三维节点漂移和重连。光标划过模型表面时，奶油色和浅蓝色的柔光会沿石面扩散后逐步衰减。
- 点击陨石或 **CLICK TO EXPLORE**，镜头在画面中心完成 1.25 秒的放大，短暂停顿后，陨石才移到详情左侧。拖动模型可旋转，右侧档案可以独立滚动。点击关闭、按 Esc 或浏览器返回会恢复原来的滚动位置。
- 键盘可用 ↑、↓、Page Up / Down，Home 返回空白开场，End 到穿环结尾。需要 WebGL 2，使用桌面 Chrome 查看。

## 开发

运行 `npm ci` 和 `npm run dev`，访问 `/story/index.html` 从头查看整合版。整合页从 `story/index.html` 构建，本地素材及滚动脚本位于 `public/story/`。修改后用 `npm run build` 更新 `dist/`，也可用 `npm run preview` 查看构建。收到的 `visitors-illustrated-v3(1).html` 是原始附件。

地球章节采用新的 MetBull 2024-10 公开镜像：82,854 条陨石目录记录，其中 50,951 条有可用坐标，31,903 条无坐标仍可搜索。包括 76,372 条 Official、6,385 条 Provisional、97 条 Relict*；伪陨石、陨石坑等 771 条原始档案不参与统计。选中记录可查看命名状态。数据来源、固定版本和清理规则见 [目录来源说明](src/data/README.md)。

飞行动画抽样展示各批次的代表记录，所有可定位记录均计入区域放射线，约 30 秒播放时间完成一轮目录揭示。流星大小、拖尾与落点闪光仍按回收质量区分；空中路径、顺序和落点光效为示意，Found 记录并非目击事件。SHOW ALL COUNTS 可立即展示当前选择的完整区域分布。循环不重复计数，关闭档案会保留当前筛选。档案内的 **Field Notes** 提供资料来源与读图说明。

区域放射线使用 H3 第 4 级分箱和 YlOrRd 色带。线宽约为各蜂窝单元直径的 80%，随单元大小变化。线长以地球半径为单位，采用 0.008 + 0.73 × (记录数 ÷ (记录数 + 800))^0.72，让零散记录贴近球面并压缩极密集区域的高度。线色随对数数量从金黄经橙色变为红色。统计反映目录采集与发现分布。

用 `node scripts/check-earth-catalogue.mjs` 核对目录条数、坐标、质量单位、区域总数、线长范围、完整揭示、暂停和循环计数。

从 **04 EARTH** 继续下滚，地球转正、放射线退回表面，球面热力层随地球展开成 **05 MAP** 的 Equal Earth 等面积世界地图。向上滚可收回。平面图显示完整目录的 50,951 条有坐标记录，每条权重为 1。热力层使用球面高斯核和 0.9° 带宽，在深蓝夜色底图上，以蓝紫、青绿、黄橙至红色呈现由低到高的密度。本项目用对数色标显示每 100,000 km² 的估计记录数，并将密度预先烘焙成纹理。目录更新后用 `python scripts/build-meteorite-heatmap.py` 重建纹理，生成脚本使用 NumPy、SciPy 和 Pillow。

在 **05 MAP** 点洲界内的陆地可放大，再次点选当前洲或按 Escape 可返回全图。局部放大使用全图的密度纹理及色标。点击区采用 [Natural Earth 1:110m Admin 0](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/) 的概化轮廓，欧亚分界作近似处理。若更新轮廓，用 Shapely 2 运行 `python scripts/build-continent-outlines.py <countries.geojson>`。

七大洲的放大视图共展示 35 条配有标本照片的精选记录。点击水滴图钉可查看档案，卡片展示日期或记录年份、分类、目录质量、坐标、照片及署名。放大时可直接点地图上可见的其他大洲。

## 场景与素材

钟表使用 Blender 建模并导出为 GLB。中央钟的表壳随滚动转动，两根指针按 12:1 的角速度倒走。

- Kamensk-Uralsky 行车记录仪视频由 Aleksandr Ivanov 拍摄，本地版本调整了尺寸并移除了音轨。[Wikimedia Commons 原片](https://commons.wikimedia.org/wiki/File:Взрыв_метеорита_над_Челябинском_15_02_2013_avi-iCawTYPtehk.ogv) · [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)
- Yekaterinburg 固定监控视频的本地版本调整了尺寸并移除了音轨。[Wikimedia Commons 原片与复用说明](https://commons.wikimedia.org/wiki/File:Chelyabinsk_meteor_security_camera_footage,_Yekaterinburg.webm)
- 手机环新增的七段短片裁自用户提供的《卫报》新闻合辑，保留画幅和原音。播放器默认静音。各镜头的原始拍摄者及复用许可尚未核实。[《卫报》报道](https://www.theguardian.com/world/video/2013/feb/15/meteor-shards-russia-explosion-video)

展品通过垂直镜头路径衔接三道圆环。滚动采用两级缓动，转场使用视差和径向畸变。陨石周围的线网有 18 个节点，每点最多 3 条连接，连接线在 0.35 秒内伸缩。表面光效使用 UV 轨迹和双缓冲扩散。

背景和模型使用纸面颗粒、分层着色和绘制轮廓。展品与圆环使用项目中的 `chelyabinsk-main-mass.glb` 和 `transition-rings.glb`，样本资料来自 [Meteoritical Bulletin](https://www.lpi.usra.edu/meteor/metbull.php?code=57165)。

表面效果使用随构建提供的 `surface-flow.png` 和 `surface-facets.png`，材质采用与场景一致的纸面色调。

太阳系章节从 `public/visitors/solar/` 加载 GLB 模型和 WebP 纹理，包含太阳、行星、地球海面与云层和碎石。轨道使用圆柱几何、噪声贴图和双面着色。

太阳系地球的海陆分布采用 [Natural Earth 1:10m Land v5.1.1](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/)。本地 `earth-geography.webp` 是 4096 × 2048 等经纬贴图，红通道用于裁切凸起的陆地层，绿、蓝通道由海岸距离生成，分别驱动近岸水纹和深浅色带。

开场镜头使用 30° 视角和 −13° 横滚，滚动通过太阳和地球两组镜头姿态插值。末段地球旋转至中央、靠近并覆盖整个视口，在全覆盖时衔接档案地球，再拉远至交互视图；向上滚动可反向重走。覆盖距离按视口对角线计算。整张画布使用纸纹，轮廓根据深度和色差做笔边扰动。按住画面拖动可绕太阳查看。松手保留角度，继续滚动回到故事镜头。

太阳系章节包含星点、太阳粒子和沿闭合样条运动并自转的碎石。彗尾色带按 12 fps 更新，横掠 20 秒后间隔 2 秒。后期使用径向色散和 4 fps 的轮廓扰动。
