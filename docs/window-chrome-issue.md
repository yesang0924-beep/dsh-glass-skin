# 窗口三键的底板：它不能"调色"，只能"不画"

> 结论先行：Windows 把最小化 / 最大化 / 关闭画在同一块矩形里，并且**丢弃 alpha**——
> 交给它 `rgba(83, 89, 106, 0.94)`，屏幕上就是一块纯 `rgb(83, 89, 106)`，和底下的顶栏毫无混合。
> 唯一让这块板消失的办法是把颜色交成**全透明**。4.9.5 的运行构建就是这样：
> 三键直接落在顶栏上，跟左边的顶栏是同一个面（4.9.7 起顶栏本身也并入了正文材质，
> 所以三键、顶栏、正文三者是同一张面）。

## 现象

右上角三键底下有一块比邻近顶栏更亮、更灰的矩形，边界是硬直边；壁纸在它左边照常透出来。

## 实测（2026-10-18，运行中的 4.9.x 桌面窗口，1941×1243）

| 交给 `setTitleBarOverlay` 的颜色 | 屏幕取样（同一窗口位置、同一裁切） |
|---|---|
| `rgba(83, 89, 106, 0.94)` | 三键容器整块 205×60 设备像素**恒为 rgb(83,89,106)**，逐行一致；左侧顶栏是 rgb(58..67, 56..79, 74..119)，在容器左边缘一跳 |
| `rgba(0, 0, 0, 0)` | 容器区域不再是一块纯色：随壁纸从左到右 **rgb(58..67, 56..79, 74..119)**，与相邻顶栏连续 |

取样方式：`tools/grab-window.ps1` 把目标窗口前置后整窗拷贝（`foreground=True`），再逐像素读 PNG。
两帧同窗口尺寸。证据图：`4.9.5-caption-before.png` / `4.9.5-caption-after.png`（320×70 顶右角裁切）。

## 机制

1. preload（`lib/preload-app.cjs`）创建一个隐藏探针 span，背景取 `--dsw-specific-sidebar-fill`、
   文字色取 `--dsw-alias-label-primary`；用 1×1 canvas 归一化成 `rgba(r, g, b, a)`。
2. 通过 `dsh-desktop:windows-appearance` 发给主进程。
3. 主进程 `setTitleBarOverlay({ color, symbolColor })` 把它交给 Windows 的 caption 容器。
4. Windows **整块填充** caption 容器、**丢掉 alpha**；alpha 为 0 时不绘制这块矩形。

所以"跟顶栏一致"只有一条路：**别给它颜色**。任何不透明或半透明的值都只会变成压在照片上的一块实心板；
之前按"壁纸顶带均值 + 壳层填充"推导 rgb(83,89,106) 的思路，本质上是在给一块板选颜色，方向就是错的。

## 皮肤侧现在怎么做

```css
body > span[style*="--dsw-specific-sidebar-fill"] {
  --dsw-specific-sidebar-fill: rgba(0, 0, 0, 0);   /* 交白卷：系统不画 */
  --dsw-alias-label-primary: #f2f8ff;              /* 深色模式符号 */
}
html[data-dsh-glass-scheme="light"] body > span[style*="--dsw-specific-sidebar-fill"] {
  --dsw-specific-sidebar-fill: rgba(0, 0, 0, 0);
  --dsw-alias-label-primary: #0d1b26;              /* 浅色模式符号 */
}
```

只改这两个变量，探针的其它用途（侧栏填充色）不受影响。

> 4.9.7：顶栏不再是磨砂盖板，改成与正文同一套合成（`bg-base` 叠 `sidebar-fill`，无采样）。
> 这条"交白卷"的规则不变——三键仍落在顶栏的页面上，只是那页现在与正文同材质。

## 门禁与回归

- `tools/window-chrome-color.ps1 -Check`：探针必须交透明色、深浅两套符号色保留、旧实心值不得再出现在声明里。
- `tools/continuous-glass.test.mjs` → `the native caption region is handed nothing to paint`：结构层面同样锁死。
- `tools/measure-regions.ps1` 的「caption plate / band step」仍可用来做气味测试：两块均值差 ≤6 即说明没有矩形盖在带子上。

## 旧追查记录（已作废，保留作教训）

更早的版本认为「消息在主进程被来源守卫丢掉」，理由是主窗口跑在 `http://127.0.0.1:<port>`、
而 `main.js` 只放行 `dsh-app://app/`，并据此建议放宽来源判定、把颜色规范成 hex。
4.9.x 实测该判断不成立：颜色确实生效了——正因为生效，屏幕上才会出现那块 rgb(83,89,106) 的板。
真正的问题是 **Windows 丢掉 alpha**，不是消息没到。放宽来源守卫、改 hex 都不会让板变成玻璃。

教训：把「没有变化」当成「链路断了」之前，先确认改动本身有没有可能被平台吞掉。
