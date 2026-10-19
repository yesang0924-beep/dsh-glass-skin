# 玻璃肌肤 5.0 · 冻结基线

日期：2026-10-18
版本：5.0.0（4.9.11 稳定化之后）
一句话：**界面是常量，壁纸是变量。**

> 6.0.0 只做改名（`dsh-skin-icebox` → `dsh-glass-skin`）与开源发布，材质常量、判据与本文一致。

---

## 一、这条基线承诺什么

- 同一套材质、排版、状态、场景规则，在换任何一张壁纸后都不变。
- 不做"半套"：没有隐藏开关，没有跟随系统分支，没有运行时可变的材质。
- 换风格 = 换一张图；改代码只用于修缺陷或宿主升级后的钩子校准。

## 二、换壁纸（唯一操作）

**多套轮流用**

1. 把图片放进 `~/.dsh/dsh-glass-skin/wallpapers/`（jpg / jpeg / png / webp，文件名可用中文）。
2. 打开设置 →「壁纸」→ 点选；用户目录里的同名文件优先于包内 `assets/wallpapers/`。
3. 选择写入 `~/.dsh/dsh-glass-skin.json`，重启后仍在；点「内置壁纸」换回。

**只换默认**

直接替换 `assets/wallpaper.jpg`，`Ctrl+R` 生效。

> 5.0 首次启用需要**重启一次 DSH**：新增的 Host 路由与资源缓存策略只在应用启动时加载。
> 之后换壁纸不再需要重启。

## 三、冻结清单（改动前先读 DESIGN §9）

| 层 | 冻结值 |
|---|---|
| 输入框玻璃 | `blur(10px) saturate(180%) contrast(1.05) brightness(1.02)`，静态 |
| 气泡 / 代码块 / banner | 14px / 6px / 6px |
| task 卡 / 菜单 / 弹窗 | 16px / 24px / 22px（设置弹窗按面积 6px + 遮罩 10px，见 DESIGN 5.0.2） |
| 正文 | `--dsh-glass-read`、行距 1.8、44 字列宽 |
| 场景 | clear / balanced / quiet，只改画布透明度 |
| 壁纸注入 | 仅 `--dsh-glass-wallpaper`，仅 `body::before` 最末层 |

**禁止**：`backdrop-filter: url(#…)`；脚本挂载/改写材质；在带模糊的面板上删除或恢复模糊；
把渐变写进 `transition`；新增第二个图片 `url()`；从壁纸自动取色。
（5.1 唯一例外：输入框 `::before` 的 data-URI 折射滤镜与 18s 慢扫，见 DESIGN §10。）

## 四、验收

```powershell
pwsh -File skins/_tools/verify.ps1
node tools/verify.mjs
node tools/continuous-glass.test.mjs
```

- 六门禁：syntax / stylesheet / syntax-host / mount / coverage / fixture
- 结构回归 36/36，其中三道冻结闸门：
  1. 整张样式表只有一张图片 `url()`（内置壁纸默认值；5.1 的折射滤镜是 data-URI，单独一条断言）；
  2. 壁纸切换必须经由单一 CSS 变量，且等解码完成、失败回退；
  3. Host 只列出用户目录与包内 `assets/wallpapers/` 里真实存在的图片，拒绝路径穿越（含真实调用三条路由的测试）。

## 五、已知边界

- 壁纸不参与取色：主题的冰蓝/琥珀是固定语言，照片偏绿或偏品红时冷暖叠光会显得脏。
  选图时保留冷暖对比与暗部最稳。
- 结构回归是"决定"的证据，不是像素证据；最终观感仍需实屏确认。

## 六、5.0.1 热修（2026-10-18 18:35）

设置页整块空白：`client.js` 里诊断块残留 `glass && diag !== null`，而 `glass` 是 4.9.6
删除液态玻璃开关时已经删掉的变量。渲染时抛 `ReferenceError: glass is not defined`，
宿主 `SlotErrorBoundary` 把一个空的 `data-slot-error` div 画进面板——标签还在导航里，
点进去却什么都没有。

- 修复：该分支改判 `diag !== null`（诊断对象本身已存在）。
- 门禁：`smoke-skin.mjs` 现在真正调用一次注册进去的 `settings.section` 组件并断言标题在树里。
  此前它只校验"注册成功"，所以这类渲染期错误能穿过全部六道门禁。
- 版本 5.0.0 → 5.0.1，便于在设置页标题上直接确认加载的是这一版。

## 七、5.0.2 设置弹窗材质（2026-10-19）

设置弹窗是最大的一块面（800×800），此前同时踩了两条已有规则：20px 遮罩 + 22px 面板两层模糊叠在同一张背景上（4.9.5 的"大面不能糊"），以及 0.68 面板上再叠 0.74 卡片、卡片比父面板更暗（"不叠自己"）。

- 遮罩：`rgba(4,10,16,0.58)` + `blur(10px) saturate(130%)` —— 去掉可辨认的字，保留环境色。
- 面板：`rgba(28,43,59,0.62)` + `blur(6px) saturate(155%)` + 135° 6% 白顶纱 + 0.5px rim + 1px 顶亮线。
- 卡片：`rgba(174,205,228,0.09)` 冰色微提亮，一块材质两个高度；浅色 `rgba(255,255,255,0.64)`。
- 作用域：宿主面板的 `[data-shortcut-modal="settings"]`；其他小弹窗仍是 22px。

细节与实测值见 DESIGN 5.0.2；修复前后截图 `docs/shots/settings-material-before.png` / `-after.png`。

5.0.3（2026-10-19）：同一配方扩到全部弹窗（选择器 [role="dialog"] + 遮罩 :has(> [role="dialog"])），重命名、确认框与设置弹窗同一块玻璃；设置页的卡片微提亮仍只限 [data-shortcut-modal="settings"]。

## 八、5.1 输入框液态玻璃（2026-10-19）

5.0 冻结后唯一一次材质开口，只作用于输入框卡片：

- 折射层：`::before` + 静态 data-URI `feTurbulence/feDisplacementMap`（`filter: url()`，非 `backdrop-filter`），无 SMIL、无 observer、无 interval。
- 流动层：`::after` + `@property --dsh-glass-liquid-x`，18s 慢扫，位于文字下方。
- 证据：夹具暗色 MAD 3.21 / 差>6 占 25.4%，浅色 MAD 2.46 / 19.6%；实屏 5s 两帧输入框区 MAD 4.72 / 28.7%，对照带 0.00。
- 边界与验收见 DESIGN §10；结构回归 28/28，六门禁 ALL PASSED。

## 九、5.2 封装与稳定性（2026-10-19）

5.2 不改冻结清单，只补“可分发 + 长期运行”的边界：

- 用户壁纸移到 `~/.dsh/dsh-glass-skin/wallpapers/`；包内 `assets/wallpapers/` 是默认集，同名用户目录优先。升级/重装不覆盖用户图片。
- 偏好文件原子写入（临时文件 + fsync + rename）并串行化；损坏文件移到 `.corrupt-<时间戳>`。
- 图片读取流挂错误处理；三条 Host 路由逐个注册，单条冲突不影响其余。
- 壁纸文件名支持中文/空格/括号，仍拒绝路径穿越与控制字符。
- 解码 8 秒上限；失败回退内置图并清掉失效指针；generation 防止旧解码覆盖新选择。
- 设置页渲染错误边界 + 壁纸列表刷新按钮。
- 结构回归 **36/36**，六门禁 ALL PASSED，fixture v5.2.0；`node tools/verify.mjs` 可在安装包内独立自检。
- 升级后仍需重启一次 DSH（Host 侧改动只在启动时加载）。

## 十、5.3 钩子自检、壁纸提示与导入（2026-10-19）

5.3 不改冻结清单，补的是「升级后能自查」与「换壁纸的日常路径」：

- 设置页诊断新增宿主钩子清单：必需 5 项（框架 / 侧栏 / 会话列表 / 输入框 / 设置弹窗）+ 条件 3 项（代码块 / 文档预览 / 交付卡）；`✓` 命中、`!` 失配、`?` 设置页不可见未验证、`–` 当前无该区域；一行汇总必需命中数，并可「复制报告」。
- 壁纸亮度/对比：选中时 32×20 本地取样，显示亮度、对比与场景建议；只建议，不自动改场景，不写状态。
- 拖放/导入：`POST /api/dsh-glass-skin/wallpapers` 接收原始图片字节；magic bytes 只认 JPEG/PNG/WebP，上限 32MB；文件名清洗为单段、保留中文、重名加 `-2`；temp+fsync+rename 原子写入，上传后自动刷新并选中。
- 结构回归 **41/41**，六门禁 ALL PASSED，fixture v5.3.0；新增四条上传路由真实调用测试。
- 升级后仍需重启一次 DSH（Host 侧改动只在启动时加载）。

