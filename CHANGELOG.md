# Changelog · dsh-glass-skin（玻璃肌肤）

本文件只记“用户能感知的变化”和“会影响稳定性/安装的改动”。材质与设计的完整依据在 `DESIGN.md`，冻结基线在 `docs/BASELINE-5.0.md`。

## 6.0.2 — 2026-10-19 · 作者署名改为 Leaf King

- 作者署名统一为 **Leaf King**：`package.json` 的 `author`、`LICENSE` 版权行、README 许可行与后续 git 提交作者。
- GitHub 登录名仍是 `yesang0924-beep`，仓库地址与 Releases 链接不变；GitHub 个人资料的显示名需在账号设置里单独修改。
- 运行时、材质、样式与功能与 6.0.1 完全相同，发布包仅元数据不同。

## 6.0.1 — 2026-10-19 · 类型检查门禁（运行时无变化）

- 新增 `npm run typecheck`：`index.js` / `client.js` 顶部 `// @ts-check`，用 JSDoc 标注 Cordis 上下文（`HostContext` / `HostScope` / `HostWebServer`）与宿主接口；`types.d.ts` 声明 `window.__ModuleLoader__`。
- `tsconfig.json` 只做 `--noEmit` 检查；`typescript` 与 `@types/node` 仅作 devDependency，CI 走 `npm ci → typecheck → verify`，运行时仍然零依赖。
- 首跑修掉两处类型问题：`CSSStyleDeclaration.webkitBackdropFilter` 改用显式断言，`Error.status` 改用交叉类型。
- 发布包 `dsh-glass-skin-6.0.1.tgz` 与源码一致；材质、样式、行为与 6.0.0 完全相同。

## 6.0.0 — 2026-10-19 · 改名 dsh-glass-skin，首次开源发布

**改名**

- 包名、仓库名与显示名统一为 **dsh-glass-skin / 玻璃肌肤**（原名 `dsh-skin-icebox` / 冰柜暖光）。材质、排版、颜色与布局**没有任何改动**；默认壁纸仍是那张深夜便利店冰柜。
- 内部标识同步更名，避免一个开源包里同时存在两套命名：CSS 自定义属性 `--dsh-icebox-*` → `--dsh-glass-*`，类名 `.dsh-icebox-*` → `.dsh-glass-*`，数据属性 `data-dsh-icebox-*` → `data-dsh-glass-*`，存储键 `dsh-skin-icebox:*` → `dsh-glass-skin:*`，路由 `/api/dsh-skin-icebox/*` → `/api/dsh-glass-skin/*`，偏好文件 `~/.dsh/dsh-skin-icebox.json` → `~/.dsh/dsh-glass-skin.json`，用户壁纸目录 `~/.dsh/dsh-skin-icebox/wallpapers/` → `~/.dsh/dsh-glass-skin/wallpapers/`。
- 设置页标题、locale 文案、图标语义与 LICENSE 署名一并更新。

**升级不丢数据**

- 首次启动会把旧名的偏好文件与用户壁纸**复制**一次到新位置，并写下 `~/.dsh/dsh-glass-skin/.migrated-from-icebox` 标记。旧目录原样保留，不会被删除或移动。
- 迁移只发生一次：标记存在后不再执行，用户之后删掉的壁纸不会在下次启动时复活。
- 新增 `tools/migration.test.mjs`，覆盖「复制偏好 + 复制壁纸 + 路由可见 + 只迁移一次」四件事。

**开源发布**

- 仓库：<https://github.com/yesang0924-beep/dsh-glass-skin>，MIT。
- 发布包 `dsh-glass-skin-6.0.0.tgz` 随 GitHub Release 提供，附 `SHA256SUMS.txt`。
- 保留 `docs/DEVLOG.md`（6.0 之前的逐版说明），README 改为面向使用者的安装/使用/自检结构。
- 验证：结构回归 **42/42**、迁移 **1/1**、`ALL PACKAGE CHECKS PASSED`。

## 5.3.1 — 2026-10-19 · 智能体团队浮层并入操作面材质

- 「智能体团队」浮层（成员 / 共享任务）此前同时命中 `[role="dialog"]` 的弹窗配方和宿主自带的菜单材质：面板先铺 0.62 弹窗填充，再叠 0.78 菜单填充，等效约 0.92，同一张背景还被模糊两次。实测面板 rgb(27,42,59)，而同一点菜单家族应为 rgb(41,50,61)。
- 该浮层改为**只走操作面配方**：一份菜单填充 + `blur(6px) saturate(155%)`（按面积取值，500×680 的面板不套用 200px 菜单的 24px）+ 同一套 135° 冰霜掠光、顶亮线与 0.5px rim。
- 成员行与任务卡不再用 `--dsw-alias-bg-layer-2`（0.68 叠在 0.78 上 ≈ 0.93 的硬片），改为同一块玻璃上的冰色微提亮 `rgba(174,205,228,0.09)`（浅色 `rgba(255,255,255,0.64)`），与设置弹窗里的卡片共用"一块材质两个高度"规则。
- 设置页诊断新增「智能体团队」条件钩子；设置弹窗判定排除该浮层，避免它打开时把输入框误标为未验证。
- 验证：结构回归 **42/42**；六门禁 ALL PASSED；fixture v5.3.1（新增团队浮层预览）。平背景合成复核：暗色浮层修复前 rgb(32,45,59)、成员行 rgb(33,48,64)（与面板几乎同色，卡片读不出来）；修复后浮层 rgb(43,51,61)、成员行 rgb(61,74,88)，同背景上 0.78 菜单家族的理论值为 rgb(41,49,60)。浅色浮层 rgb(237,237,237)、菜单 rgb(240,239,239)。对比图 `docs/shots/5.3.1-team-before.png` / `5.3.1-team-after.png`。
- 说明：标题栏「应用 / 编辑」下拉、输入框右键菜单是 Electron 主进程弹出的 **系统菜单**，不进入 DOM，CSS 无法着色，仍由 Windows 绘制。

## 5.3.0 — 2026-10-19 · 钩子自检、壁纸提示与拖放导入

**宿主钩子自检（升级后的一眼检查）**

- 设置页「设计说明与诊断」新增钩子清单：窗口框架 / 侧栏 / 会话列表 / 输入框 / 设置弹窗为必需；代码块 / 文档预览 / 交付卡为可观测。每个钩子显示 `✓` / `!` / `?` / `–`，汇总「必需 x/y 命中」。
- 输入框在设置页不可见时标为 `?`（未验证），不误报为失配；条件区域显示 `–`（当前页面没有）。
- 「复制报告」把完整 JSON 诊断写入剪贴板；剪贴板不可用时回退 `textarea + execCommand`。DSH 升级后先看这一行，再决定是否需要改选择器。

**壁纸亮度 / 对比提示**

- 选中壁纸时在本地用 32×20 画布取样，显示平均亮度、标准差与建议：偏亮 → 建议「标准」或「沉静」；偏暗 → 清透/标准都稳；适中 → 三种都可。
- 只是建议，**不自动切换场景**；换壁纸仍然只写 `--dsh-glass-wallpaper` 一个变量。

**拖放 / 导入图片**

- 设置页壁纸区可拖入图片，或点「导入图片」选择文件；Host 新增 `POST /api/dsh-glass-skin/wallpapers`。
- 只接受 JPEG / PNG / WebP（按 magic bytes 判断，不信任扩展名），上限 32MB；文件名清洗为单段、保留中文，重名自动加 `-2`。
- 原子写入（temp + fsync + rename）；上传成功后自动刷新列表并选中新图。
- 客户端先做类型/大小检查，Host 再做一次；失败显示具体原因。

**验证**

- 结构回归 **41/41**；六门禁 ALL PASSED；fixture v5.3.0。
- 新增上传路由测试：合法 PNG、路径穿越文件名、坏 magic、超限 `content-length`。

## 5.2.0 — 2026-10-19 · 封装与稳定性

**封装**

- 主题包自包含：`index.js` / `client.js` / 内置壁纸 / 许可证 / 变更记录 / 自检脚本都在包内；`npm pack` 产出的 tarball 可分发。安装时解包为目录后 `install_bundle`（本地目录是 link 语义），或用 pnpm `file:` 装进未链接该包的 profile；不要直接把 `.tgz` 交给 `install_bundle`，会留下 `file:` 说明符 + `link:` 锁定的混合状态。
- 用户壁纸目录移出安装包：`~/.dsh/dsh-glass-skin/wallpapers/`。升级/重装不会覆盖用户图片，只读安装目录也能换壁纸。
- 同名文件优先用用户目录；内置 `assets/wallpapers/` 作为随包发布的默认集。
- 新增 `LICENSE`、`CHANGELOG.md`、`tools/verify.mjs`；`package.json` 增加 `engines`、可选 `peerDependencies`、`test` / `verify` / `pack:release` 脚本。
- 版本号在 `package.json`、`client.js`、样式标记三处保持一致，由自检脚本核对。

**稳定性**

- 偏好文件改为“临时文件 + fsync + rename”原子写入，并把读改写串行化：连续快速切换不会互相覆盖，崩溃也不会留下半截 JSON。
- 损坏的 `~/.dsh/dsh-glass-skin.json` 会被移到 `.corrupt-<时间戳>` 旁路保留，路由继续可用。
- 图片响应给读取流挂 `error` 处理；壁纸在请求中途被删除/改名时只结束该响应，不再可能拖垮宿主进程。
- 路由注册逐个隔离：某一条路由冲突时其余路由仍会挂载。
- 壁纸文件名支持中文、空格与括号；分隔符、控制字符、Windows 保留字符仍被拒绝。
- 壁纸解码增加 8 秒上限；失败/超时会回退内置图，并把本地与宿主里的失效文件名一起清掉，避免每次启动重复闪回失败。
- 壁纸切换增加 generation 保护：先点 A 再点 B 时，A 的慢解码不会覆盖 B。
- 设置页增加渲染错误边界：面板渲染失败时显示错误信息，而不是一片空白。
- 壁纸列表增加“刷新”按钮，并显示列表读取失败的提示。

**不变**

- 不新增材质开关，不改冻结的模糊半径、透明度、排版与场景档位。
- 壁纸切换仍然只重写 `--dsh-glass-wallpaper` 一个自定义属性；模式、场景、令牌与布局都不参与换图。

## 5.1.1 — 2026-10-19

- 修复输入框液态玻璃的“等高线纹路”：折射层去掉 1px/6px 周期条纹，改为 4 档宽域渐变；`feDisplacementMap` 的 scale 与 baseFrequency 收敛。
- 结构回归 28/28。

## 5.1.0 — 2026-10-19

- 输入框液态玻璃：静态 data-URI 折射层 + 18 秒高光慢扫（只在输入框，且位于文字下方）。
- 新增 `prefers-reduced-motion` 下停止慢扫的规则。

## 5.0.3 — 2026-10-19

- 设置弹窗的玻璃配方扩到全部 `[role="dialog"]`；设置页卡片微提亮仍只限设置弹窗。

## 5.0.2 — 2026-10-19

- 设置弹窗改为“遮罩 10px 模糊 + 面板 6px 模糊”，去掉两层 20/22px 叠在同一张背景上的做法。
- 卡片改为冰色微提亮，不再比父面板更暗。

## 5.0.1 — 2026-10-18

- 修复设置页整块空白：诊断分支误用了 4.9.6 已删除的 `glass` 变量。
- `smoke-skin.mjs` 现在真正渲染一次设置组件并断言标题存在。

## 5.0.0 — 2026-10-18

- 冻结基线：材质、排版、状态与场景规则不再作为日常改动项；壁纸成为唯一可变参数。
- 壁纸只经 `--dsh-glass-wallpaper` 注入 `body::before` 最末层；切换等解码完成，失败回退内置图。
- Host 新增 `/api/dsh-glass-skin/wallpapers` 与 `wallpaper` 状态校验。
