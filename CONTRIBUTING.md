# Contributing

Thanks for taking a look at Glass Skin.

## 开发方式

1. 把仓库目录以 `link:` 装进一个 DSH profile：`plugin_manager(action="install_bundle", target="<仓库目录>")`。
2. 改 `client.js` 后 `Ctrl+R` 即可看到；改 `index.js`（宿主半）需要重启 DSH。
3. 设置页 →「玻璃肌肤」→「设计说明与诊断」可以看宿主钩子是否命中。

## 提交前

```powershell
node tools/verify.mjs
npm install
npm run typecheck
```

必须全过（结构回归 42/42 + 迁移 1/1 + `ALL PACKAGE CHECKS PASSED`，类型检查零错误）。`tsc` 只在开发/CI 使用，不进入运行时与发布包。

## 规则

- **材质与排版是冻结的**。请先读 [DESIGN.md](DESIGN.md)：每条规则都有判据和反例，改动需要同时更新对应断言。
- 壁纸是唯一可变输入：任何切换都只能重写 `--dsh-glass-wallpaper` 一个自定义属性。
- 不要在运行时重建材质：不允许 SVG 位移滤镜、定时轮询、节点重挂载或按状态删除 `backdrop-filter`。
- 新增选择器前先确认宿主类名；DSH 升级会让它们失效，设置页诊断用来发现这一点。
- 一条改动配一条断言：结构回归是文本级检查，能防回归，但不替代真窗口里的观感验收。

## 提交信息

用一句话说明「用户能感知的变化」，必要时在正文写判据与验证结果。
