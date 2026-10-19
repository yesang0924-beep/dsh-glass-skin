// @ts-check
/**
 * dsh-glass-skin — Client half (DSH Web UI).
 *
 * 3.0 "阅读工作台" — the same cold-blue + warm-amber freezer glow, now built as
 * a small design system instead of a recoloured background:
 *
 *   · material ladder   environment → work → action (four surface steps)
 *   · reading scale     markdown body +2px over the user's content size, 1.8 leading
 *   · one accent law    ice blue owns interaction, amber only ever decorates
 *   · one elevation set cool-ink shadows, no black drop shadows
 *
 * Two user-selected modes share the palette:
 *   · ambient (default) — wallpaper keeps its composition and edge glow;
 *   · focus             — wallpaper recedes, surfaces settle, same aesthetics.
 *
 * Extension points used, and why:
 *   · `ctx.theme.overrideTokens` for the ~60 alias/specific colour tokens — the
 *     ThemePresenter's public layer, light/dark aware;
 *   · this plugin's own stylesheet (higher specificity than the base theme) for
 *     typography, shape and scene rules, which are not colour and therefore not
 *     theme tokens. Overriding them through `overrideTokens` would be silently
 *     ineffective wherever the base sheet declares the same variable on `body`.
 *   · `settings.section` for the mode picker.
 * No business component is replaced; nothing here shadows shipped UI.
 */
window.__ModuleLoader__.load({
  id: 'dsh-glass-skin',
  factory(require) {
    const SOURCE = 'dsh-glass-skin';
    const VERSION = '6.0.2';
    const WALLPAPER_DEFAULT_URL = '/api/dsh-glass-skin/assets?f=wallpaper.jpg';
    const MODE_KEY = 'dsh-glass-skin:mode';
    const MODES = ['ambient', 'focus'];

    let React = null;
    try {
      React = require('react');
    } catch (error) {
      console.warn('[dsh-glass-skin] react unavailable; settings section skipped', error);
    }

    /**
     * Colour layer. Three material tiers, deliberately:
     *   environment  → bg-base, the scene itself
     *   work         → layer-1/2/3, panels you read and work on
     *   action       → overlay / menu / input / toast, surfaces you operate
     * Ice blue owns selection, links and focus; amber never carries state.
     */
    const AMBIENT_TOKENS = {
      // ── environment ──────────────────────────────────────────────────────
      '--dsw-alias-bg-base': { light: 'rgba(244, 250, 254, 0.18)', dark: 'rgba(8, 14, 22, 0.12)' },
      '--dsw-alias-bg-mask-1': { light: 'rgba(12, 22, 32, 0.38)', dark: 'rgba(2, 6, 10, 0.68)' },
      '--dsw-alias-bg-skeleton': { light: 'rgba(216, 231, 241, 0.72)', dark: 'rgba(34, 52, 71, 0.54)' },

      // ── work: four steps, one hairline each ──────────────────────────────
      '--dsw-alias-bg-layer-1': { light: 'rgba(255, 255, 255, 0.70)', dark: 'rgba(20, 32, 45, 0.70)' },
      '--dsw-alias-bg-layer-2': { light: 'rgba(238, 246, 252, 0.76)', dark: 'rgba(28, 43, 59, 0.68)' },
      '--dsw-alias-bg-layer-3': { light: 'rgba(230, 241, 249, 0.84)', dark: 'rgba(32, 49, 67, 0.78)' },
      '--dsw-alias-bg-module-platform': { light: 'rgba(255, 255, 255, 0.68)', dark: 'rgba(23, 36, 51, 0.72)' },
      '--dsw-alias-bg-multi-select': { light: 'rgba(255, 255, 255, 0.76)', dark: 'rgba(25, 40, 56, 0.76)' },

      '--dsw-alias-border-l1': { light: 'rgba(56, 92, 118, 0.14)', dark: 'rgba(166, 199, 221, 0.12)' },
      '--dsw-alias-border-l2': { light: 'rgba(56, 92, 118, 0.26)', dark: 'rgba(168, 204, 228, 0.20)' },
      '--dsw-alias-border-l3': { light: 'rgba(56, 92, 118, 0.20)', dark: 'rgba(168, 204, 228, 0.17)' },
      '--dsw-alias-border-l4': { light: 'rgba(56, 92, 118, 0.28)', dark: 'rgba(168, 204, 228, 0.24)' },

      // ── text: three levels, no fourth ────────────────────────────────────
      '--dsw-alias-label-primary': { light: '#0d1b26', dark: '#eaf4fb' },
      '--dsw-alias-label-secondary': { light: '#45616f', dark: '#b9ccdc' },
      '--dsw-alias-label-tertiary': { light: '#5a7385', dark: '#9db2c4' },
      '--dsw-alias-label-caption': { light: '#566f80', dark: '#9db2c4' },
      '--dsw-alias-label-dimmed': { light: '#6d8494', dark: '#879caf' },
      '--dsw-alias-label-primary-foreground': { light: '#f6fcff', dark: '#06202c' },

      // ── accents ──────────────────────────────────────────────────────────
      '--dsw-alias-brand-primary': { light: '#1f6a88', dark: '#9ed6f0' },
      '--dsw-alias-state-business-primary': { light: '#2c7fa3', dark: '#9ed6f0' },
      '--dsw-alias-link': { light: '#1d6a89', dark: '#a8ddf3' },
      '--dsw-alias-state-error-primary': { light: '#c04154', dark: '#f08a92' },
      '--dsw-alias-state-idle-primary': { light: '#8fa1ae', dark: '#8fa3b3' },
      '--dsw-alias-state-success-primary': { light: '#16886c', dark: '#7fd9bd' },
      '--dsw-alias-state-warn-primary': { light: '#9a6516', dark: '#f0c37e' },
      '--dsw-alias-button-primary-fill': { light: '#24708f', dark: '#8fd1ee' },
      '--dsw-alias-button-primary-hover': { light: '#1f607b', dark: '#a8ddf3' },
      '--dsw-alias-button-primary-dimmed': { light: 'rgba(36, 112, 143, 0.45)', dark: 'rgba(143, 209, 238, 0.40)' },
      /* The composer's send / stop key is the host's "info" button. The key itself
   wears the shared glass recipe below; these two tokens are the colour guard,
   so any other "info" control resolves to the theme's primary pair and never
   to the host's static #7aaaff. */
      '--dsw-alias-button-info-fill': { light: '#24708f', dark: '#8fd1ee' },
      '--dsw-alias-button-info-hover': { light: '#1f607b', dark: '#a8ddf3' },

      // ── sidebar: one active item, the rest recedes ───────────────────────
      '--dsw-specific-sidebar-fill': { light: 'rgba(249, 253, 255, 0.50)', dark: 'rgba(8, 14, 21, 0.44)' },
      '--dsw-specific-sidebar-nav-item-active': { light: 'rgba(255, 255, 255, 0.82)', dark: 'rgba(34, 51, 69, 0.86)' },
      '--dsw-specific-sidebar-nav-item-hover': { light: 'rgba(255, 255, 255, 0.48)', dark: 'rgba(28, 43, 59, 0.52)' },
      '--dsw-specific-sidebar-nav-item-active-accent': { light: 'rgba(184, 222, 240, 0.86)', dark: 'rgba(54, 84, 110, 0.78)' },

      // ── action: menus are glass, dialogs are nearly solid ────────────────
      /* 4.9: the same menu fill (0.92 near-black) is shared by the account menu
         and the composer's + / slash menu. Beside the 0.46 composer it read as
         a black plate. 0.84 in cool slate keeps the menu legible — the 24px
         blur still hides the photograph — without becoming a second material. */
      '--dsw-alias-bg-overlay': { light: 'rgba(252, 254, 255, 0.97)', dark: 'rgba(12, 20, 30, 0.96)' },
      '--dsw-specific-input-major': { light: 'rgba(255, 255, 255, 0.84)', dark: 'rgba(14, 24, 36, 0.88)' },
      '--dsw-specific-menu': { light: 'rgba(255, 255, 255, 0.90)', dark: 'rgba(23, 38, 54, 0.78)' },
      '--dsw-menu-surface-fill': { light: 'rgba(255, 255, 255, 0.90)', dark: 'rgba(23, 38, 54, 0.78)' },
      '--dsw-alias-menu-group-header-fill': { light: 'rgba(255, 255, 255, 0.95)', dark: 'rgba(23, 38, 54, 0.92)' },
      '--dsw-specific-selector': { light: 'rgba(255, 255, 255, 0.72)', dark: 'rgba(25, 40, 56, 0.74)' },
      '--dsw-specific-tip': { light: 'rgba(240, 248, 253, 0.78)', dark: 'rgba(20, 33, 48, 0.78)' },
      '--dsw-alias-button-floating-fill': { light: 'rgba(255, 255, 255, 0.80)', dark: 'rgba(17, 29, 42, 0.84)' },
      '--dsw-alias-button-floating-hover': { light: 'rgba(255, 255, 255, 0.92)', dark: 'rgba(24, 39, 55, 0.92)' },
      '--dsw-alias-button-elevated-fill': { light: 'rgba(255, 255, 255, 0.88)', dark: 'rgba(25, 40, 56, 0.88)' },
      '--dsw-alias-toast-bg': { light: 'rgba(25, 45, 61, 0.95)', dark: 'rgba(10, 18, 27, 0.96)' },
      '--dsw-alias-tooltip-bg': { light: 'rgba(20, 38, 52, 0.96)', dark: 'rgba(8, 15, 23, 0.97)' },
      '--dsw-alias-turn-trigger-bg': { light: 'rgba(255, 255, 255, 0.72)', dark: 'rgba(22, 36, 51, 0.72)' },
      '--dsw-alias-turn-trigger-bg-hover': { light: 'rgba(255, 255, 255, 0.88)', dark: 'rgba(29, 45, 62, 0.84)' },

      // ── settings cards ───────────────────────────────────────────────────
      '--dsw-alias-settings-card-fill': { light: 'rgba(255, 255, 255, 0.72)', dark: 'rgba(21, 34, 48, 0.74)' },
      '--dsw-alias-settings-card-stroke': { light: 'rgba(56, 92, 118, 0.12)', dark: 'rgba(168, 204, 228, 0.10)' },

      // ── conversation ─────────────────────────────────────────────────────
      '--dsw-specific-bubble': { light: 'rgba(255, 255, 255, 0.66)', dark: 'rgba(30, 48, 68, 0.58)' },
      '--dsw-specific-bubble-highlight': { light: 'rgba(212, 235, 247, 0.92)', dark: 'rgba(52, 86, 118, 0.60)' },
      /* Cool slate, not near-black: a code block is the steadiest surface in the
         transcript, but it still belongs to the same photograph.
         4.9.2: the banner shares the block's own fill instead of sitting 6%
         deeper. A sticky header a shade heavier than its own block reads as a
         second material stacked on the block; one value gives one surface with a
         hairline inside it. 0.66 sits between the bubble (0.58, read) and the
         menu (0.78, operate) — the "read for a long time" step of the ladder. */
      '--dsw-alias-markdown-code-block': { light: 'rgba(240, 247, 252, 0.80)', dark: 'rgba(21, 34, 49, 0.66)' },
      '--dsw-alias-markdown-code-block-banner': { light: 'rgba(240, 247, 252, 0.80)', dark: 'rgba(21, 34, 49, 0.66)' },
      '--dsw-alias-markdown-inline-code': { light: 'rgba(229, 241, 248, 0.96)', dark: 'rgba(30, 47, 66, 0.72)' },
      '--dsw-alias-markdown-tag': { light: 'rgba(214, 234, 245, 0.92)', dark: 'rgba(38, 60, 82, 0.72)' },
      '--dsw-alias-markdown-citation': { light: '#8a5a20', dark: '#e5b571' },

      // ── interaction washes ───────────────────────────────────────────────
      '--dsw-alias-interactive-bg-hover': { light: 'rgba(36, 112, 143, 0.08)', dark: 'rgba(158, 214, 240, 0.09)' },
      '--dsw-alias-interactive-bg-hover-solid': { light: 'rgba(36, 112, 143, 0.12)', dark: 'rgba(158, 214, 240, 0.13)' },
      '--dsw-alias-interactive-bg-active': { light: 'rgba(36, 112, 143, 0.15)', dark: 'rgba(158, 214, 240, 0.17)' },

      // ── skin-owned accents (also the live marker for `Theme.listTokens`) ─
      '--dsh-glass-skin-frost': { light: '#7fb6cf', dark: '#9ed6f0' },
      '--dsh-glass-skin-ember': { light: '#b97c3f', dark: '#f0c37e' },

      // Scrollbars come in two families: plain surfaces read `-l1`, the sidebar
      // and the composer card re-declare `-l2` locally. Both must be themed or
      // the sidebar keeps the stock grey thumb.
      '--dsw-alias-scrollbar-bg-l2': { light: 'rgba(56, 92, 118, 0.22)', dark: 'rgba(166, 199, 221, 0.16)' },
      '--dsw-alias-scrollbar-hover-l2': { light: 'rgba(31, 106, 136, 0.38)', dark: 'rgba(158, 214, 240, 0.34)' },

      // ── secondary surfaces: scrims, toolbars, the thinking strip ─────────
      // The stock palette is already a cool neutral scale, so most aliases can
      // stay. These are the ones that ship as pure black/grey or a foreign blue.
      '--dsw-alias-bg-mask-2': { light: 'rgba(12, 22, 32, 0.12)', dark: 'rgba(2, 6, 10, 0.20)' },
      '--dsw-alias-bg-mask-3': { light: 'rgba(6, 14, 22, 0.48)', dark: 'rgba(1, 4, 8, 0.48)' },
      '--dsw-alias-bg-mask-photo': { light: 'rgba(4, 10, 16, 0.88)', dark: 'rgba(2, 6, 10, 0.90)' },
      '--dsw-alias-bg-mask-drop': { light: 'rgba(244, 250, 254, 0.72)', dark: 'rgba(18, 28, 38, 0.72)' },
      '--dsw-alias-bg-document-selection': { light: 'rgba(127, 182, 207, 0.38)', dark: 'rgba(158, 214, 240, 0.28)' },
      '--dsw-alias-bg-document-preview': { light: 'rgba(255, 255, 255, 0.72)', dark: 'rgba(18, 29, 41, 0.80)' },
      '--dsw-alias-label-document-preview': { light: '#45616f', dark: '#b9ccdc' },
      '--dsw-alias-button-tool-bar-fill': { light: 'rgba(56, 80, 98, 0.50)', dark: 'rgba(56, 80, 98, 0.52)' },
      '--dsw-alias-button-tool-bar-fill-invisible': { light: 'rgba(10, 20, 30, 0.34)', dark: 'rgba(4, 10, 16, 0.38)' },
      '--dsw-alias-button-tool-bar-hover': { light: 'rgba(56, 80, 98, 0.60)', dark: 'rgba(70, 100, 122, 0.62)' },
      '--dsw-alias-interactive-bg-hover-accent': { light: 'rgba(36, 112, 143, 0.10)', dark: 'rgba(158, 214, 240, 0.14)' },
      '--dsw-linear-gradient-think': {
        light: 'linear-gradient(180deg, #f4f9fd 20.19%, #f4f9fd00 100%)',
        dark: 'linear-gradient(180deg, #14202c 20.19%, #14202c00 100%)',
      },
      '--dsw-linear-think-select': {
        light: 'linear-gradient(180deg, #eaf3f9 20.19%, #eaf3f900 100%)',
        dark: 'linear-gradient(180deg, #1b2a3a 20.19%, #1b2a3a00 100%)',
      },

      // ── interaction chrome: focus, glass, second shadow tier ─────────────
      // The stock focus ring resolves to `transparent` in the light palette, so
      // keyboard focus is invisible there; this restores it.
      '--dsw-focus-ring-color': { light: '#2c7fa3', dark: '#9ed6f0' },
      /* The scrim ships as `--dsw-mask-blur: none`, which is why a settings dialog
         let the wallpaper's lettering read straight through it. Blur keeps the
         ambient colour and loses the recognisable content — the plan's exact ask. */
      '--dsw-mask-blur': { light: 'blur(18px) saturate(125%)', dark: 'blur(20px) saturate(120%)' },
      /* Menu glyphs used a bluish-800 that out-shouted their labels. */
      '--dsw-alias-menu-icon': { light: '#45616f', dark: '#9db2c4' },
      '--dsw-menu-backdrop-filter': { light: 'blur(24px) saturate(165%)', dark: 'blur(24px) saturate(165%)' },
      '--dsw-shadow-lv1-blur': {
        light: '0 4px 12px 0 rgba(6, 18, 30, 0.05)',
        dark: '0 4px 12px 0 rgba(0, 6, 12, 0.34)',
      },
    };

    /** Focus mode: same palette, steadier surfaces, wallpaper almost hidden. */
    const FOCUS_OVERRIDES = {
      '--dsw-alias-bg-base': { light: 'rgba(246, 250, 253, 0.78)', dark: 'rgba(9, 15, 23, 0.72)' },
      '--dsw-alias-bg-layer-1': { light: 'rgba(255, 255, 255, 0.88)', dark: 'rgba(18, 29, 41, 0.88)' },
      '--dsw-alias-bg-layer-2': { light: 'rgba(241, 247, 252, 0.90)', dark: 'rgba(24, 38, 53, 0.88)' },
      '--dsw-alias-bg-layer-3': { light: 'rgba(234, 243, 250, 0.94)', dark: 'rgba(29, 45, 62, 0.92)' },
      '--dsw-alias-bg-overlay': { light: 'rgba(252, 254, 255, 0.99)', dark: 'rgba(12, 20, 30, 0.98)' },
      '--dsw-alias-bg-module-platform': { light: 'rgba(255, 255, 255, 0.86)', dark: 'rgba(21, 34, 48, 0.88)' },
      '--dsw-alias-bg-multi-select': { light: 'rgba(255, 255, 255, 0.90)', dark: 'rgba(23, 37, 52, 0.90)' },
      '--dsw-specific-sidebar-fill': { light: 'rgba(249, 253, 255, 0.75)', dark: 'rgba(9, 15, 22, 0.78)' },
      '--dsw-specific-sidebar-nav-item-active': { light: 'rgba(255, 255, 255, 0.92)', dark: 'rgba(35, 53, 72, 0.92)' },
      '--dsw-specific-sidebar-nav-item-hover': { light: 'rgba(255, 255, 255, 0.66)', dark: 'rgba(29, 45, 62, 0.72)' },
      '--dsw-specific-input-major': { light: 'rgba(255, 255, 255, 0.94)', dark: 'rgba(13, 23, 35, 0.95)' },
      '--dsw-specific-menu': { light: 'rgba(255, 255, 255, 0.94)', dark: 'rgba(21, 35, 50, 0.90)' },
      '--dsw-menu-surface-fill': { light: 'rgba(255, 255, 255, 0.94)', dark: 'rgba(21, 35, 50, 0.90)' },
      '--dsw-alias-menu-group-header-fill': { light: 'rgba(255, 255, 255, 0.97)', dark: 'rgba(21, 35, 50, 0.95)' },
      '--dsw-specific-bubble': { light: 'rgba(255, 255, 255, 0.92)', dark: 'rgba(26, 41, 58, 0.88)' },
      '--dsw-alias-markdown-code-block': { light: 'rgba(244, 249, 253, 0.94)', dark: 'rgba(23, 37, 52, 0.86)' },
      '--dsw-alias-markdown-code-block-banner': { light: 'rgba(244, 249, 253, 0.94)', dark: 'rgba(23, 37, 52, 0.86)' },
      '--dsw-alias-settings-card-fill': { light: 'rgba(255, 255, 255, 0.88)', dark: 'rgba(20, 33, 47, 0.90)' },
      '--dsw-alias-turn-trigger-bg': { light: 'rgba(255, 255, 255, 0.86)', dark: 'rgba(21, 34, 48, 0.88)' },
    };

    function tokensFor(mode) {
      if (mode !== 'focus') return AMBIENT_TOKENS;
      const tokens = { ...AMBIENT_TOKENS };
      for (const [name, value] of Object.entries(FOCUS_OVERRIDES)) tokens[name] = value;
      return tokens;
    }

    function readMode() {
      try {
        const stored = window.localStorage.getItem(MODE_KEY);
        return MODES.includes(stored) ? stored : 'ambient';
      } catch {
        return 'ambient';
      }
    }

    function persistMode(mode) {
      try {
        window.localStorage.setItem(MODE_KEY, mode);
      } catch {
        /* storage can be unavailable (private mode, quota); the mode still lives for this page */
      }
    }

    let currentMode = 'ambient';
    let themeService = null;
    let disposeTokens = null;
    const modeListeners = new Set();

    function emitMode() {
      for (const listener of modeListeners) {
        try {
          listener(currentMode);
        } catch (error) {
          console.warn('[dsh-glass-skin] mode listener failed', error);
        }
      }
    }

    function subscribeMode(listener) {
      modeListeners.add(listener);
      return () => modeListeners.delete(listener);
    }

    function paintMode(mode) {
      if (!MODES.includes(mode)) return;
      currentMode = mode;
      if (document.body !== null) document.body.dataset.dshGlassMode = mode;
      document.documentElement.dataset.dshGlassMode = mode;
      if (themeService !== null) {
        disposeTokens = themeService.overrideTokens(SOURCE, tokensFor(mode));
      }
      // The glass layer used to be re-asserted here; the canvas alpha now has
      // its own layer (`applySceneTokens`) that a mode change must re-stack the
      // same way.
      applySceneTokens();
      nudgeChrome();
    }

    /* ── scene: how present the photograph is ───────────────────────────────
       This used to be welded to the glass switch. The composer can only refract
       something, and the canvas paints `--dsw-alias-bg-base` over the photo, so
       turning glass on used to lift the whole canvas (0.12 → 0.02) as a side
       effect. Two decisions were riding on one switch — how present the scene
       is, and how the composer is made — and the second silently rewrote the
       first for the entire window.

       They are separate knobs now. `clear` is exactly what glass-on used to
       produce, so a default install looks the same while the coupling is gone;
       `balanced` is the old glass-off canvas; `quiet` is a step beyond it.

       `--dsw-alias-bg-base` is painted by THREE nested shells (frame → center
       column → conversation root), so alpha compounds: 1 − (1 − a)³. That is
       why these numbers stay small — 0.12 already reads as ~0.32.

       The reading veil in `body::after` is deliberately NOT part of this
       switch: legibility has to stay constant at every scene level. Scene only
       decides how much of the photograph the work surfaces let through. */
    const SCENE_KEY = 'dsh-glass-skin:scene';
    const SCENES = ['clear', 'balanced', 'quiet'];
    const SCENE_BASE = {
      clear: {
        ambient: { light: 'rgba(246, 250, 253, 0.05)', dark: 'rgba(8, 14, 22, 0.02)' },
        focus: { light: 'rgba(246, 250, 253, 0.18)', dark: 'rgba(9, 15, 23, 0.10)' },
      },
      balanced: {
        ambient: { light: 'rgba(246, 250, 253, 0.18)', dark: 'rgba(8, 14, 22, 0.12)' },
        focus: { light: 'rgba(246, 250, 253, 0.40)', dark: 'rgba(9, 15, 23, 0.26)' },
      },
      quiet: {
        ambient: { light: 'rgba(246, 250, 253, 0.42)', dark: 'rgba(8, 14, 22, 0.30)' },
        focus: { light: 'rgba(246, 250, 253, 0.68)', dark: 'rgba(9, 15, 23, 0.52)' },
      },
    };
    let currentScene = 'clear';
    let disposeSceneTokens = null;
    const sceneListeners = new Set();

    function readScene() {
      try {
        const stored = window.localStorage.getItem(SCENE_KEY);
        return SCENES.includes(stored) ? stored : 'clear';
      } catch {
        return 'clear';
      }
    }

    function persistScene(scene) {
      try {
        window.localStorage.setItem(SCENE_KEY, scene);
      } catch {
        /* storage unavailable; the choice still lives for this page */
      }
    }

    function emitScene() {
      for (const listener of sceneListeners) {
        try {
          listener(currentScene);
        } catch (error) {
          console.warn('[dsh-glass-skin] scene listener failed', error);
        }
      }
    }

    function subscribeScene(listener) {
      sceneListeners.add(listener);
      return () => sceneListeners.delete(listener);
    }

    /* ── the one switchable input: the photograph ────────────────────────────
       5.0 freeze. Materials, typography, states and scene levels are fixed;
       the wallpaper is the single parameter a "new theme" changes. It reaches
       the page through exactly one custom property, so a swap cannot rebuild a
       material, and the property is rewritten only when the value actually
       changes — a theme switch must not cause a decode flicker.
       An empty value means the packaged default image in assets/. */
    const WALLPAPER_KEY = 'dsh-glass-skin:wallpaper';
    const WALLPAPERS_URL = '/api/dsh-glass-skin/wallpapers';
    const WALLPAPER_MAX_BYTES = 32 * 1024 * 1024;
    /* One path segment, no separators or Windows-reserved characters. Unicode is
       allowed, so a file called 冰柜.jpg can be picked in settings. Mirrors the
       host-side validator in index.js. */
    const WALLPAPER_FILE = /^[^\\/:*?"<>|\u0000-\u001f]{1,128}$/u;
    const WALLPAPER_EXT = /\.(?:jpe?g|png|webp)$/i;
    /* A corrupt or very large image must not leave the page on the old photo
       forever; after this long, fall back and clear the stale pointer. */
    const WALLPAPER_DECODE_TIMEOUT = 8000;
    let currentWallpaper = '';
    /* Every paint gets a generation. A slow decode from an earlier click must not
       win the race against the user's latest choice. */
    let wallpaperPaintGeneration = 0;
    const wallpaperListeners = new Set();

    function normalizeWallpaper(value) {
      if (typeof value !== 'string') return '';
      if (value.startsWith('.') || value.endsWith('.') || value.endsWith(' ')) return '';
      return WALLPAPER_FILE.test(value) && WALLPAPER_EXT.test(value) ? value : '';
    }

    function wallpaperUrl(file) {
      const safe = normalizeWallpaper(file);
      return safe === ''
        ? WALLPAPER_DEFAULT_URL
        : `/api/dsh-glass-skin/assets?f=wallpapers/${encodeURIComponent(safe)}`;
    }

    function readWallpaper() {
      try {
        return normalizeWallpaper(window.localStorage.getItem(WALLPAPER_KEY));
      } catch {
        return '';
      }
    }

    function persistWallpaper(value) {
      try {
        if (value === '') window.localStorage.removeItem(WALLPAPER_KEY);
        else window.localStorage.setItem(WALLPAPER_KEY, value);
      } catch {
        /* storage unavailable; the choice still lives for this page */
      }
    }

    function emitWallpaper() {
      for (const listener of wallpaperListeners) {
        try {
          listener(currentWallpaper);
        } catch (error) {
          console.warn('[dsh-glass-skin] wallpaper listener failed', error);
        }
      }
    }

    function subscribeWallpaper(listener) {
      wallpaperListeners.add(listener);
      return () => wallpaperListeners.delete(listener);
    }

    /* 5.3 · A local readback for the settings panel: sample the selected photo
       at 32x20 and report its average luminance and spread. This is advice for
       the scene control, never an automatic change — the photograph is still
       the only thing a wallpaper switch touches. */
    let currentWallpaperInfo = null;
    const wallpaperInfoListeners = new Set();

    function analyzeWallpaperImage(image) {
      try {
        if (typeof document?.createElement !== 'function') return null;
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 20;
        const context = canvas.getContext?.('2d', { willReadFrequently: true });
        if (context === null || context === undefined) return null;
        context.drawImage(image, 0, 0, 32, 20);
        const pixels = context.getImageData(0, 0, 32, 20).data;
        let sum = 0;
        let sumSq = 0;
        let count = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const luminance = 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
          sum += luminance;
          sumSq += luminance * luminance;
          count += 1;
        }
        if (count === 0) return null;
        const mean = sum / count;
        const spread = Math.sqrt(Math.max(0, sumSq / count - mean * mean));
        return {
          luminance: Math.round(mean),
          contrast: Math.round(spread),
          tone: mean < 70 ? 'dark' : mean > 175 ? 'bright' : 'balanced',
        };
      } catch {
        // Cross-origin / tainted canvas / headless host: no advice, no failure.
        return null;
      }
    }

    function emitWallpaperInfo() {
      for (const listener of wallpaperInfoListeners) {
        try {
          listener(currentWallpaperInfo);
        } catch (error) {
          console.warn('[dsh-glass-skin] wallpaper info listener failed', error);
        }
      }
    }

    function subscribeWallpaperInfo(listener) {
      wallpaperInfoListeners.add(listener);
      return () => wallpaperInfoListeners.delete(listener);
    }

    /* The only DOM effect of a wallpaper swap: one custom property on <body>.
       No token, material or layout rule is rebuilt, so "换壁纸" really does mean
       "换一张背景". */
    function writeWallpaperProperty(url) {
      try {
        const style = document.body?.style;
        if (style === undefined || typeof style.setProperty !== 'function') return;
        const next = `url("${url}")`;
        const current = typeof style.getPropertyValue === 'function'
          ? style.getPropertyValue('--dsh-glass-wallpaper')
          : '';
        if (current !== next) style.setProperty('--dsh-glass-wallpaper', next);
      } catch {
        /* headless host: the stylesheet default still paints */
      }
    }

    /* Swap only after the new file decodes: dropping the old photo first would
       show a blank gradient frame between the two. A file that fails — or never
       decodes — falls back to the packaged default and clears the stored name,
       instead of leaving a dead pointer that fails again on every boot. */
    function paintWallpaper(value) {
      const file = normalizeWallpaper(value);
      const url = wallpaperUrl(file);
      const generation = ++wallpaperPaintGeneration;
      let settled = false;
      let timer = 0;
      const isCurrent = () => generation === wallpaperPaintGeneration;
      const finish = (ok, info = null) => {
        if (settled) return;
        settled = true;
        if (timer !== 0) window.clearTimeout(timer);
        if (!isCurrent()) return;
        if (!ok) {
          console.warn('[dsh-glass-skin] wallpaper unavailable, using the packaged default:', file);
          persistWallpaper('');
          // The host copy must be cleared too, or the next boot adopts the dead
          // name and flashes the default before failing again.
          pushHostState({ wallpaper: '' });
          currentWallpaper = '';
          currentWallpaperInfo = null;
          writeWallpaperProperty(WALLPAPER_DEFAULT_URL);
          emitWallpaper();
          emitWallpaperInfo();
          return;
        }
        currentWallpaper = file;
        currentWallpaperInfo = info;
        writeWallpaperProperty(url);
        emitWallpaper();
        emitWallpaperInfo();
      };
      if (file === '' || typeof window.Image !== 'function') {
        finish(true, null);
        return;
      }
      const probe = new window.Image();
      timer = window.setTimeout(() => finish(false), WALLPAPER_DECODE_TIMEOUT);
      probe.onload = () => finish(true, analyzeWallpaperImage(probe));
      probe.onerror = () => finish(false);
      probe.src = url;
    }

    function setWallpaper(value) {
      const file = normalizeWallpaper(value);
      if (file === currentWallpaper) return;
      touchedKeys.add('wallpaper');
      persistWallpaper(file);
      pushHostState({ wallpaper: file });
      paintWallpaper(file);
    }

    /* WINDOW material choice, separate from the composer's glass switch. It is
       glass-only now: the creator asked for a transparent window and judged the
       follow-the-system alternative unnecessary, so the option is removed rather
       than hidden. A stored "system" from an older build folds back to glass on
       read; the attribute it drives is still referenced by the reduce-transparency
       fallback rule, which simply never matches any more. */
    const TRANSPARENCY_KEY = 'dsh-glass-skin:transparency';
    const TRANSPARENCIES = ['glass'];
    let currentTransparency = 'glass';
    const transparencyListeners = new Set();

    function readTransparency() {
      try {
        const stored = window.localStorage.getItem(TRANSPARENCY_KEY);
        return TRANSPARENCIES.includes(stored) ? stored : 'glass';
      } catch {
        return 'glass';
      }
    }

    function persistTransparency(value) {
      try { window.localStorage.setItem(TRANSPARENCY_KEY, value); } catch { /* page-local fallback */ }
    }

    function paintTransparency(value) {
      if (!TRANSPARENCIES.includes(value)) return;
      currentTransparency = value;
      if (document.body !== null) document.body.dataset.dshGlassTransparency = value;
    }

    function emitTransparency() {
      for (const listener of transparencyListeners) listener(currentTransparency);
    }

    function subscribeTransparency(listener) {
      transparencyListeners.add(listener);
      return () => transparencyListeners.delete(listener);
    }

    function setTransparency(value) {
      if (!TRANSPARENCIES.includes(value)) return;
      touchedKeys.add('transparency');
      persistTransparency(value);
      pushHostState({ transparency: value });
      paintTransparency(value);
      emitTransparency();
    }

    /* Its own token layer, stacked last, so a mode change (which re-stacks the
       mode layer) cannot win the canvas alpha back. */
    function applySceneTokens() {
      if (disposeSceneTokens !== null) {
        disposeSceneTokens();
        disposeSceneTokens = null;
      }
      if (themeService === null) return;
      const level = SCENE_BASE[currentScene] ?? SCENE_BASE.clear;
      disposeSceneTokens = themeService.overrideTokens(`${SOURCE}:scene`, {
        '--dsw-alias-bg-base': level[currentMode === 'focus' ? 'focus' : 'ambient'],
      });
    }

    function paintScene(scene) {
      if (!SCENES.includes(scene)) return;
      currentScene = scene;
      if (document.body !== null) document.body.dataset.dshGlassScene = scene;
      document.documentElement.dataset.dshGlassScene = scene;
      applySceneTokens();
      nudgeChrome();
    }

    function setScene(scene) {
      if (!SCENES.includes(scene)) return;
      persistScene(scene);
      touchedKeys.add('scene');
      pushHostState({ scene });
      paintScene(scene);
      emitScene();
    }

    function setMode(mode) {
      if (!MODES.includes(mode)) return;
      persistMode(mode);
      touchedKeys.add('mode');
      pushHostState({ mode });
      paintMode(mode);
      emitMode();
    }

    /* ── glass is a stylesheet material, not a runtime effect ───────────────
       4.9.11 stability pass. Until 4.9.10 the composer's glass carried an SVG
       feDisplacementMap through `backdrop-filter: url(#…)`: a canvas-built
       displacement map, an feImage, a ResizeObserver that rewrote the filter
       region, and a 1.2 s interval that remounted the chain whenever the host
       re-created the composer node.

       Each of those is a re-rasterisation trigger on the compositor. The
       displacement map is decoded asynchronously (an feImage that is not ready
       yet contributes nothing), the region changes on every wrap while typing,
       and a remount drops the filter for the frames between teardown and mount.
       Chromium answers by painting that card's backdrop unfiltered for a frame —
       which is what "the card flickers between clear and frosted" looks like.

       The material is pure CSS now: one fixed blur/saturate list that never
       changes at runtime, so the compositor keeps a single cached sample and the
       filter cannot be rebuilt behind the user's back. The rim bend the
       displacement map bought is already carried by the card's own 135° sweep,
       its lit top edge and its 0.5px rim. No SVG, no observer, no interval, no
       mount race, and nothing left that a host re-render can detach. */
    // The host stamps `data-composer-card` on the input card; the hashed class
    // stays only as a fallback for a build that does not.
    const GLASS_CARD_SELECTORS = ['[data-composer-card]', '.RlGAzG_card'];

    /** The host stamps `data-composer-card` on the input card element itself. */
    function findComposer() {
      for (const selector of GLASS_CARD_SELECTORS) {
        const node = document.querySelector(selector);
        if (node !== null) return node;
      }
      return null;
    }

    /* 5.3 · Host-hook audit. DSH ships hashed class names, so a version bump can
       silently detach a material rule. These are the hooks the stylesheet
       actually targets; the settings panel reports them as a one-glance check
       after an upgrade. Conditional regions (code block, dock, card) are listed
       as "not on this page" instead of failures. */
    const HOOKS = [
      { key: 'frame', label: '窗口框架', selector: '.BynINW_frame', required: true },
      { key: 'center', label: '正文列', selector: '.BynINW_centerCol', required: true },
      { key: 'sidebar', label: '侧栏', selector: '.BynINW_sidebarCol', required: true },
      { key: 'sessionList', label: '会话列表', selector: '._2H3hWW_root', required: true },
      {
        key: 'composer',
        label: '输入框',
        selector: '[data-composer-card], .RlGAzG_card',
        required: true,
        settingsBlind: true,
      },
      {
        key: 'settings',
        label: '设置弹窗',
        selector: '[role="dialog"][data-shortcut-modal="settings"], [role="dialog"]:not([data-team-panel])',
        required: true,
      },
      { key: 'team', label: '智能体团队', selector: '[data-team-panel]', required: false },
      { key: 'titlebarAttr', label: '标题栏属性', selector: 'html[data-windows-titlebar]', required: false },
      { key: 'rightbar', label: '右侧工作台', selector: '.BynINW_rightbarCol', required: false },
      { key: 'code', label: '代码块', selector: '.md-code-block', required: false },
      { key: 'dock', label: '文档预览', selector: '[data-document-preview]', required: false },
      { key: 'card', label: '交付/任务卡', selector: '.flL80G_root, .kuvljq_card', required: false },
    ];

    function hookHealth() {
      const settingsOpen = document.querySelector('[role="dialog"]:not([data-team-panel])') !== null;
      return HOOKS.map((hook) => {
        let found = false;
        try {
          found = document.querySelector(hook.selector) !== null;
        } catch {
          found = false;
        }
        return {
          key: hook.key,
          label: hook.label,
          selector: hook.selector,
          required: hook.required,
          found,
          // The settings panel replaces the main page; a missing composer here
          // is not evidence of a broken selector.
          blind: found === false && hook.settingsBlind === true && settingsOpen,
        };
      });
    }

    /** Read only material properties, never conversation text or credentials. */
    function shellDiagnostics() {
      const plane = (selector, pseudo = null) => {
        const node = document.querySelector(selector);
        if (node === null) return { found: false };
        const style = window.getComputedStyle(node, pseudo);
        return {
          found: true,
          background: style.backgroundColor,
          image: style.backgroundImage,
          blur: style.backdropFilter || /** @type {any} */ (style).webkitBackdropFilter || 'none',
          z: style.zIndex,
        };
      };
      const bodyStyle = window.getComputedStyle(document.body);
      const reduced = typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
      return {
        version: VERSION,
        styleVersion: bodyStyle.getPropertyValue('--dsh-glass-style-version').trim(),
        mode: currentMode,
        scene: currentScene,
        transparency: currentTransparency,
        // Which file the page believes it is showing; support can compare this
        // with the `wallpaper` plane below without reading localStorage.
        wallpaperFile: currentWallpaper,
        wallpaperInfo: currentWallpaperInfo,
        hooks: hookHealth(),
        reduced,
        reducedApplied: reduced && currentTransparency !== 'glass',
        blurSupported: window.CSS?.supports?.('backdrop-filter', 'blur(1px)') === true
          || window.CSS?.supports?.('-webkit-backdrop-filter', 'blur(1px)') === true,
        body: plane('body'),
        wallpaper: plane('body', '::before'),
        veil: plane('body', '::after'),
        frame: plane('.BynINW_frame'),
        sidebar: plane('.BynINW_sidebarCol', '::before'),
        sidebarRoot: plane('._2H3hWW_root'),
        titlebar: plane('.BynINW_frame', '::before'),
      };
    }

    /** What a user can read back to us when the material looks absent. */
    function glassDiagnostics() {
      const card = findComposer();
      let computed = 'no card';
      if (card !== null) {
        const style = window.getComputedStyle(card);
        computed = style.backdropFilter || /** @type {any} */ (style).webkitBackdropFilter || 'empty';
      }
      return {
        shell: shellDiagnostics(),
        card: card !== null,
        computed,
        // Native caption buttons remain a separate Desktop-shell surface.
        origin: typeof window.location === 'object' ? `${window.location.protocol}//${window.location.host}` : '?',
      };
    }

    function paintGlass() {
      if (document.body !== null) document.body.dataset.dshGlassGlass = 'on';
    }

    /* ── durable preferences across the shell's random port ────────────────
       The Desktop shell assigns a fresh port on every launch, so the origin
       changes and localStorage starts empty again (observed here:
       127.0.0.1:64500 → 127.0.0.1:49270). The host half keeps a tiny JSON file
       instead. This is the client side of that seam: paint from localStorage
       first for the first frame, then adopt the host value for any key the user
       has not touched this session. */
    const HOST_STATE_URL = '/api/dsh-glass-skin/state';
    const touchedKeys = new Set();
    let hostStateGeneration = 0;

    function pushHostState(patch) {
      if (typeof window.fetch !== 'function') return;
      try {
        window.fetch(HOST_STATE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op: 'set', patch }),
        }).catch(() => {});
      } catch {
        /* host route unavailable — localStorage stays the only store */
      }
    }

    async function adoptHostState(generation = hostStateGeneration) {
      if (typeof window.fetch !== 'function') return;
      let state = null;
      try {
        const response = await window.fetch(HOST_STATE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op: 'get' }),
        });
        if (!response.ok) return;
        state = await response.json();
      } catch {
        return;
      }
      if (generation !== hostStateGeneration || state === null || typeof state !== 'object') return;
      if (!touchedKeys.has('mode') && MODES.includes(state.mode) && state.mode !== currentMode) {
        persistMode(state.mode);
        paintMode(state.mode);
        emitMode();
      }
      // No glass branch: the host may still hold "glass: false" from an older
      // build, and adopting it would turn the material off behind the user's back.
      if (!touchedKeys.has('scene') && SCENES.includes(state.scene) && state.scene !== currentScene) {
        persistScene(state.scene);
        paintScene(state.scene);
        emitScene();
      }
      if (!touchedKeys.has('transparency') && TRANSPARENCIES.includes(state.transparency)) {
        persistTransparency(state.transparency);
        if (state.transparency !== currentTransparency) {
          paintTransparency(state.transparency);
          emitTransparency();
        }
      }
      if (!touchedKeys.has('wallpaper') && typeof state.wallpaper === 'string') {
        const next = normalizeWallpaper(state.wallpaper);
        if (next !== currentWallpaper) {
          persistWallpaper(next);
          paintWallpaper(next);
        }
      }
    }

    /* ── scheme mirror ──────────────────────────────────────────────────────
       Every dark rule below used to key off the host's `body[data-ds-dark-theme]`.
       That attribute belongs to the host's ThemePresenter, and its dispose()
       removes it — so on a theme-layer remount the attribute is briefly absent
       and a dark skin silently falls back to the light constants. (Same failure
       dsh-dream-skin documents in its round-18 note.)
       We now read the scheme from the theme service itself and stamp OUR OWN
       attribute on <html>. Rules accept either source, so a host that stops
       publishing the attribute costs nothing. */
    let lastScheme = 'light';

    function paintScheme(snapshot) {
      let next = null;
      if (snapshot !== undefined && snapshot !== null) {
        next = snapshot.active?.colorScheme ?? null;
      } else {
        try {
          next = themeService?.getTheme?.()?.active?.colorScheme ?? null;
        } catch {
          next = null;
        }
      }
      if (next !== 'dark' && next !== 'light') {
        // Service unavailable: trust the host attribute only in the dark
        // direction — an absent attribute is not evidence of light.
        const hostSaysDark = document.body !== null
          && typeof document.body.hasAttribute === 'function'
          && document.body.hasAttribute('data-ds-dark-theme');
        next = hostSaysDark ? 'dark' : lastScheme;
      }
      lastScheme = next;
      document.documentElement.dataset.dshGlassScheme = next;
      nudgeChrome();
    }

    /* The shell only re-measures the probe when <body>'s style attribute or
       <head> changes, so nudge it once after a repaint; without this the chrome
       keeps whatever it read at boot. */
    let chromeNudgeTimer = 0;

    function nudgeChrome() {
      if (chromeNudgeTimer !== 0) return;
      chromeNudgeTimer = window.setTimeout(() => {
        chromeNudgeTimer = 0;
        if (document.body !== null) {
          document.body.style.setProperty('--dsh-glass-chrome', String(Date.now()));
        }
      }, 120);
    }

    const CSS = `
/* ════════════════════════════════════════════════════════════════════════
   1 · 场景层 — wallpaper keeps its composition; the reading field is a
   separate veil so focus mode can dim the photo without weakening text.
   ════════════════════════════════════════════════════════════════════════ */
html {
  background-color: #070e16;
}

/* Own the scene's stacking order. Negative wallpaper planes must belong to
   body, rather than fall behind body's canvas/background in the root context.
   z-index creates no containing block for viewport-fixed controls; do NOT put
   filter, backdrop-filter, transform, contain or isolation on this ancestor. */
html body {
  --dsh-glass-style-version: "${VERSION}";
  /* The only image the theme ever injects. A "new theme" is this value and
     nothing else: no material, type or state rule reads from it. */
  --dsh-glass-wallpaper: url("${WALLPAPER_DEFAULT_URL}");
  position: relative;
  z-index: 0;
}

body::before {
  content: "";
  position: fixed;
  inset: -18px;
  z-index: -2;
  pointer-events: none;
  background-image:
    radial-gradient(92% 62% at 12% 0%,
      color-mix(in srgb, var(--dsh-glass-skin-frost, #7fb6cf) 34%, transparent),
      transparent 62%),
    radial-gradient(96% 68% at 88% 100%,
      color-mix(in srgb, var(--dsh-glass-skin-ember, #b97c3f) 26%, transparent),
      transparent 64%),
    linear-gradient(180deg,
      rgba(248, 252, 255, 0.08) 0%,
      rgba(248, 252, 255, 0.02) 42%,
      rgba(248, 252, 255, 0.12) 100%),
    var(--dsh-glass-wallpaper);
  background-position: 0 0, 0 0, 0 0, 50% 38%;
  background-size: 100% 100%, 100% 100%, 100% 100%, cover;
  background-repeat: no-repeat;
  filter: blur(1.5px) saturate(1.3) brightness(1.03) contrast(1.08);
}

html[data-dsh-glass-scheme="dark"] body::before,
body[data-ds-dark-theme]::before {
  background-image:
    radial-gradient(92% 62% at 12% 0%,
      color-mix(in srgb, var(--dsh-glass-skin-frost, #9ed6f0) 26%, transparent),
      transparent 60%),
    radial-gradient(96% 68% at 88% 100%,
      color-mix(in srgb, var(--dsh-glass-skin-ember, #f0c37e) 22%, transparent),
      transparent 62%),
    linear-gradient(180deg,
      rgba(5, 10, 16, 0.03) 0%,
      rgba(5, 10, 16, 0.00) 40%,
      rgba(5, 10, 16, 0.07) 100%),
    var(--dsh-glass-wallpaper);
  filter: blur(1.5px) saturate(1.36) brightness(1.02) contrast(1.12);
}

/* Composition, not a crop: the focal point moves with the window ratio so a
   narrowed window does not slice the subject out of frame. */
@media (min-aspect-ratio: 21/9) {
  body::before { background-position: 0 0, 0 0, 0 0, 50% 32%; }
}
@media (max-aspect-ratio: 16/10) {
  body::before { background-position: 0 0, 0 0, 0 0, 50% 44%; }
}
@media (max-aspect-ratio: 5/4) {
  body::before { background-position: 0 0, 0 0, 0 0, 62% 46%; }
}

body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    linear-gradient(90deg,
      rgba(250, 253, 255, 0.02) 0%,
      rgba(250, 253, 255, 0.18) 15%,
      rgba(250, 253, 255, 0.18) 85%,
      rgba(250, 253, 255, 0.02) 100%),
    radial-gradient(56% 60% at 52% 44%,
      rgba(250, 253, 255, 0.16) 0%,
      rgba(250, 253, 255, 0.06) 58%,
      rgba(250, 253, 255, 0) 80%),
    linear-gradient(180deg,
      rgba(250, 253, 255, 0.04) 0%,
      rgba(250, 253, 255, 0) 26%,
      rgba(250, 253, 255, 0.04) 100%);
}

html[data-dsh-glass-scheme="dark"] body::after,
body[data-ds-dark-theme]::after {
  background:
    linear-gradient(90deg,
      rgba(4, 9, 15, 0.01) 0%,
      rgba(4, 9, 15, 0.12) 15%,
      rgba(4, 9, 15, 0.12) 85%,
      rgba(4, 9, 15, 0.01) 100%),
    radial-gradient(58% 62% at 52% 44%,
      rgba(4, 9, 15, 0.10) 0%,
      rgba(4, 9, 15, 0.04) 58%,
      rgba(4, 9, 15, 0) 80%),
    linear-gradient(180deg,
      rgba(4, 9, 15, 0.04) 0%,
      rgba(4, 9, 15, 0.01) 26%,
      rgba(4, 9, 15, 0.07) 100%);
}

/* A narrow window loses the side gutters, so the veil widens to keep the
   text column on the same footing. */
@media (max-width: 1000px) {
  body::after {
    background:
      linear-gradient(90deg,
        rgba(250, 253, 255, 0.04) 0%,
        rgba(250, 253, 255, 0.30) 10%,
        rgba(250, 253, 255, 0.30) 90%,
        rgba(250, 253, 255, 0.04) 100%),
      linear-gradient(180deg,
        rgba(250, 253, 255, 0.08) 0%,
        rgba(250, 253, 255, 0) 26%,
        rgba(250, 253, 255, 0.06) 100%);
  }
  html[data-dsh-glass-scheme="dark"] body::after,
  body[data-ds-dark-theme]::after {
    background:
      linear-gradient(90deg,
        rgba(4, 9, 15, 0.03) 0%,
        rgba(4, 9, 15, 0.20) 10%,
        rgba(4, 9, 15, 0.20) 90%,
        rgba(4, 9, 15, 0.03) 100%),
      linear-gradient(180deg,
        rgba(4, 9, 15, 0.08) 0%,
        rgba(4, 9, 15, 0.01) 26%,
        rgba(4, 9, 15, 0.12) 100%);
  }
}

/* Focus mode: the photo recedes to an edge tint; the reading field stays calm. */
body[data-dsh-glass-mode="focus"]::before {
  opacity: 0.18;
  filter: blur(10px) saturate(0.72) brightness(0.92) contrast(0.98);
}

html[data-dsh-glass-scheme="dark"] body[data-dsh-glass-mode="focus"]::before,
body[data-ds-dark-theme][data-dsh-glass-mode="focus"]::before {
  opacity: 0.24;
  filter: blur(10px) saturate(0.76) brightness(0.62) contrast(1.02);
}

body[data-dsh-glass-mode="focus"]::after {
  background:
    radial-gradient(60% 66% at 52% 44%,
      rgba(250, 253, 255, 0.92) 0%,
      rgba(250, 253, 255, 0.80) 62%,
      rgba(250, 253, 255, 0.54) 100%),
    linear-gradient(180deg,
      rgba(250, 253, 255, 0.72) 0%,
      rgba(250, 253, 255, 0.48) 26%,
      rgba(250, 253, 255, 0.68) 100%);
}

html[data-dsh-glass-scheme="dark"] body[data-dsh-glass-mode="focus"]::after,
body[data-ds-dark-theme][data-dsh-glass-mode="focus"]::after {
  background:
    radial-gradient(62% 68% at 52% 44%,
      rgba(4, 9, 15, 0.90) 0%,
      rgba(4, 9, 15, 0.80) 62%,
      rgba(4, 9, 15, 0.56) 100%),
    linear-gradient(180deg,
      rgba(4, 9, 15, 0.74) 0%,
      rgba(4, 9, 15, 0.50) 26%,
      rgba(4, 9, 15, 0.70) 100%);
}

/* ════════════════════════════════════════════════════════════════════════
   2 · 阅读标尺 — the base theme keys reading typography off CSS variables
   declared on \`body\`. These rules sit one element higher (\`html body\`), so
   they win by specificity instead of by stylesheet order.

   Sizes are expressed *relative to the user's content font size*: the skin
   never overrides a preference, it lifts the reading voice above the UI
   voice. Raising the size also shortens the measure — with a fixed column
   width, 14px → 16px takes a long answer from ~51 to ~45 CJK glyphs per
   line, which is the actual comfort lever.
   ════════════════════════════════════════════════════════════════════════ */
html body {
  --dsh-glass-read: calc(var(--dsh-content-font-size, 14px) + 2px);
  --dsh-glass-read-lead: 1.8;

  /* body text */
  --dsw-font-markdown-base: 400 var(--dsh-glass-read) / var(--dsh-glass-read-lead) var(--dsw-font-family);
  --dsw-font-markdown-base-font-size: var(--dsh-glass-read);
  --dsw-font-markdown-base-line-height: var(--dsh-glass-read-lead);

  --dsw-font-markdown-base-strong: 600 var(--dsh-glass-read) / var(--dsh-glass-read-lead) var(--dsw-font-family);
  --dsw-font-markdown-base-strong-font-size: var(--dsh-glass-read);
  --dsw-font-markdown-base-strong-line-height: var(--dsh-glass-read-lead);

  --dsw-font-markdown-base-italic: italic 400 var(--dsh-glass-read) / var(--dsh-glass-read-lead) var(--dsw-font-family);
  --dsw-font-markdown-base-italic-font-size: var(--dsh-glass-read);
  --dsw-font-markdown-base-italic-line-height: var(--dsh-glass-read-lead);

  --dsw-font-markdown-base-strong-italic: italic 600 var(--dsh-glass-read) / var(--dsh-glass-read-lead) var(--dsw-font-family);
  --dsw-font-markdown-base-strong-italic-font-size: var(--dsh-glass-read);
  --dsw-font-markdown-base-strong-italic-line-height: var(--dsh-glass-read-lead);

  /* headings: 22 / 20 / 18 / 17 over a 16px body — a ladder, not a jump */
  --dsw-font-markdown-h1: 700 calc(var(--dsh-glass-read) + 6px) / 1.3 var(--dsw-font-family);
  --dsw-font-markdown-h1-font-size: calc(var(--dsh-glass-read) + 6px);
  --dsw-font-markdown-h1-line-height: 1.3;

  --dsw-font-markdown-h2: 700 calc(var(--dsh-glass-read) + 4px) / 1.35 var(--dsw-font-family);
  --dsw-font-markdown-h2-font-size: calc(var(--dsh-glass-read) + 4px);
  --dsw-font-markdown-h2-line-height: 1.35;

  --dsw-font-markdown-h3: 700 calc(var(--dsh-glass-read) + 2px) / 1.4 var(--dsw-font-family);
  --dsw-font-markdown-h3-font-size: calc(var(--dsh-glass-read) + 2px);
  --dsw-font-markdown-h3-line-height: 1.4;

  --dsw-font-markdown-h4: 600 calc(var(--dsh-glass-read) + 1px) / 1.5 var(--dsw-font-family);
  --dsw-font-markdown-h4-font-size: calc(var(--dsh-glass-read) + 1px);
  --dsw-font-markdown-h4-line-height: 1.5;

  /* tables: one step under the body, never a 13px footnote */
  --dsw-font-markdown-table: 400 calc(var(--dsh-glass-read) - 2px) / 1.6 var(--dsw-font-family);
  --dsw-font-markdown-table-font-size: calc(var(--dsh-glass-read) - 2px);
  --dsw-font-markdown-table-line-height: 1.6;
  --dsw-font-markdown-table-head-font-size: calc(var(--dsh-glass-read) - 2px);
  --dsw-font-markdown-table-head-line-height: 1.6;

  /* captions */
  --dsw-font-markdown-small: 400 calc(var(--dsh-glass-read) - 3px) / 1.7 var(--dsw-font-family);
  --dsw-font-markdown-small-font-size: calc(var(--dsh-glass-read) - 3px);
  --dsw-font-markdown-small-line-height: 1.7;
  --dsw-font-markdown-small-strong-font-size: calc(var(--dsh-glass-read) - 3px);
  --dsw-font-markdown-small-strong-line-height: 1.7;

  /* code: users set this separately, so keep their step and lift it once */
  --dsw-font-markdown-code: calc(var(--dsh-code-font-size, 11px) + 1px) / 1.6 var(--ds-font-family-code);
  --dsw-font-markdown-code-font-size: calc(var(--dsh-code-font-size, 11px) + 1px);
  --dsw-font-markdown-code-line-height: 1.6;
  --dsw-font-markdown-code-block-font-size: calc(var(--dsh-code-font-size, 11px) + 2px);

  /* ══════════════════════════════════════════════════════════════════════
     3 · 材质 — elevation is cool ink, never neutral black; on dark glass a
     hairline replaces the drop shadow that would otherwise vanish.
     ══════════════════════════════════════════════════════════════════════ */
  --dsw-shadow-lv1: 0 1px 2px rgba(6, 18, 30, 0.05), 0 2px 8px rgba(6, 18, 30, 0.06);
  --dsw-shadow-lv2: 0 2px 6px rgba(6, 18, 30, 0.06), 0 10px 24px rgba(6, 18, 30, 0.09);
  --dsw-shadow-lv3: 0 0 0 0.5px rgba(6, 18, 30, 0.08), 0 18px 44px rgba(6, 18, 30, 0.14);

  --dsw-alias-scrollbar-bg-l1: rgba(56, 92, 118, 0.28);
  --dsw-alias-scrollbar-hover-l1: rgba(31, 106, 136, 0.46);
}

html[data-dsh-glass-scheme="dark"] body,
html body[data-ds-dark-theme] {
  --dsw-shadow-lv1: 0 1px 2px rgba(0, 6, 12, 0.34), 0 2px 10px rgba(0, 6, 12, 0.24);
  --dsw-shadow-lv2: 0 4px 14px rgba(0, 6, 12, 0.40), 0 2px 6px rgba(0, 6, 12, 0.30);
  --dsw-shadow-lv3: 0 0 0 0.5px rgba(166, 199, 221, 0.12), 0 20px 48px rgba(0, 6, 12, 0.55);

  --dsw-alias-scrollbar-bg-l1: rgba(166, 199, 221, 0.20);
  --dsw-alias-scrollbar-hover-l1: rgba(158, 214, 240, 0.40);
}

/* ════════════════════════════════════════════════════════════════════════
   4 · 版面 — the host sizes the transcript by window share
   (\`--dsh-chat-user-width\` falls back to column * .64, clamped 680–920px), so a
   2560px window gets ~920px columns and ~57 CJK glyphs per line. Declaring the
   hook turns the measure into a fixed 44 glyphs instead: the text column stops
   widening with the window, and the composer card (host: column + 32px) keeps
   tracking it automatically.
   ════════════════════════════════════════════════════════════════════════ */
html body {
  --dsh-glass-measure: 44;
  --dsh-chat-user-width: calc(var(--dsh-glass-read) * var(--dsh-glass-measure));
  --dsh-chat-flow-gap: 8px;
}

/* Elevation is declared by the base theme on \`body, body *\`, i.e. on every
   element, so it has to be overridden at the same depth or inheritance loses. */
html body * {
  --dsw-elevation-panel: var(--dsw-elevation-stroke), 0 3px 8px rgba(6, 18, 30, 0.035), 0 0 16px rgba(6, 18, 30, 0.025);
  --dsw-elevation-prominent: var(--dsw-elevation-stroke), 0 4px 10px rgba(6, 18, 30, 0.05), 0 0 20px rgba(6, 18, 30, 0.04);
  --dsw-elevation-soft: var(--dsw-elevation-stroke), 0 5px 16px rgba(6, 18, 30, 0.04), 0 0 24px rgba(6, 18, 30, 0.03);
}

/* Selection belongs to the same cool family as links and focus. */
::selection {
  background-color: color-mix(in srgb, var(--dsh-glass-skin-frost, #7fb6cf) 34%, transparent);
  color: inherit;
}

/* ════════════════════════════════════════════════════════════════════════
   5 · 侧栏层级 — the host paints the selected session row with the *same*
   token as hover (\`--dsw-alias-interactive-bg-hover\`), so "where am I" is
   almost invisible. The session list already exposes role=tree / role=treeitem
   / aria-selected, so the distinction is restored on that accessibility
   contract instead of a hashed class name: a soft wash plus a 2px ice marker
   (the brief's "柔和底色 + 细小标记，不用大块高亮").
   ════════════════════════════════════════════════════════════════════════ */
[role="tree"] [role="treeitem"][aria-selected="true"] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent);
  box-shadow: inset 2px 0 0 var(--dsw-alias-brand-primary);
}

[role="tree"] [role="treeitem"][aria-selected="true"]:hover {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent);
}

/* Keyboard navigation: the host paints no focus for session rows, so tabbing
   through the list was invisible. The ring sits inside the row (offset -2) and
   follows the row's own radius, so it cannot push the list around. */
[role="tree"] [role="treeitem"]:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary));
  outline-offset: -2px;
}

/* The user's own message is body text too. The host renders it at the UI
   content size (14px/22px) while answers follow the reading scale, so the same
   conversation showed two text voices. One measure, one leading. */
html body .cJsG2q_bubble {
  font-size: var(--dsh-glass-read);
  line-height: var(--dsh-glass-read-lead);
  /* Same family as everything else, one stop lighter: the photograph tints it,
     the blur drops its detail, and the text keeps its own solid colour. */
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 11%, transparent) 0%,
      transparent 52%,
      color-mix(in srgb, var(--dsh-glass-skin-ember) 6%, transparent) 100%),
    var(--dsw-specific-bubble);
  color: var(--dsw-alias-label-primary);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 18%, transparent),
    inset 0 0 0 0.5px var(--dsw-alias-border-l2),
    0 2px 10px rgba(6, 18, 30, 0.10);
  backdrop-filter: blur(14px) saturate(155%);
  -webkit-backdrop-filter: blur(14px) saturate(155%);
}

/* ════════════════════════════════════════════════════════════════════════
   6 · 设置页 — the skin's own surface, so it also serves as the type sample.
   ════════════════════════════════════════════════════════════════════════ */
.dsh-glass-section {
  box-sizing: border-box;
  width: 100%;
  max-width: 760px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 6px 0 40px;
}

.dsh-glass-head h2 {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: var(--dsw-font-l-20-font-size, 20px);
  line-height: var(--dsw-font-l-20-line-height, 28px);
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Version stamp: tells you at a glance which build of the skin is loaded,
   which is the difference between "the switch is missing" and "the page is old". */
.dsh-glass-version {
  margin-left: 8px;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--dsw-font-xxs-12-font-size, 12px);
  font-weight: 500;
  letter-spacing: 0.02em;
  vertical-align: 2px;
}

.dsh-glass-head p {
  margin: 6px 0 0;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--dsw-font-s-14-font-size, 14px);
  line-height: var(--dsw-font-s-14-line-height, 22px);
  max-width: 58ch;
}

.dsh-glass-modes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.dsh-glass-mode {
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  margin: 0;
  padding: 14px 14px 16px;
  border: 0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
  border-radius: var(--dsw-radius-lg, 16px);
  background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1));
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  appearance: none;
  transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
}

.dsh-glass-mode:hover {
  border-color: var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
}

.dsh-glass-mode.is-selected {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 58%, var(--dsw-alias-border-l2));
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1)));
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-brand-primary) 46%, transparent);
}

.dsh-glass-mode:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
}

.dsh-glass-preview {
  position: relative;
  height: 96px;
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md, 12px);
  background: #121d29;
}

.dsh-glass-preview::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(58% 56% at 16% 8%,
      rgba(158, 214, 240, 0.55), transparent 62%),
    radial-gradient(62% 58% at 86% 92%,
      rgba(240, 195, 126, 0.34), transparent 64%),
    linear-gradient(145deg, #2b4055 0%, #0d151f 56%, #2a241f 100%);
}

.dsh-glass-preview[data-mode="focus"]::before {
  background:
    radial-gradient(58% 56% at 16% 8%,
      rgba(158, 214, 240, 0.14), transparent 62%),
    radial-gradient(62% 58% at 86% 92%,
      rgba(240, 195, 126, 0.12), transparent 64%),
    linear-gradient(145deg, #1a2836 0%, #0e1721 56%, #181d24 100%);
}

.dsh-glass-preview::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(56% 62% at 52% 46%,
      rgba(5, 10, 16, 0.46), rgba(5, 10, 16, 0.12) 70%, transparent 84%);
}

.dsh-glass-preview[data-mode="focus"]::after {
  background: radial-gradient(60% 66% at 52% 46%,
      rgba(5, 10, 16, 0.82), rgba(5, 10, 16, 0.58) 70%, rgba(5, 10, 16, 0.34) 100%);
}

.dsh-glass-preview-bar {
  position: absolute;
  left: 16%;
  height: 5px;
  border-radius: 3px;
  background: rgba(234, 244, 251, 0.86);
}

.dsh-glass-preview-bar:nth-child(1) { top: 36%; width: 44%; }
.dsh-glass-preview-bar:nth-child(2) { top: 50%; width: 56%; opacity: 0.72; }
.dsh-glass-preview-bar:nth-child(3) { top: 64%; width: 34%; opacity: 0.52; }

.dsh-glass-preview[data-mode="focus"] .dsh-glass-preview-bar {
  background: rgba(234, 244, 251, 0.92);
}

.dsh-glass-mode-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dsw-alias-label-primary);
  font-size: var(--dsw-font-s-strong-14-font-size, 14px);
  line-height: var(--dsw-font-s-strong-14-line-height, 22px);
  font-weight: 600;
}

.dsh-glass-badge {
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent);
  color: var(--dsw-alias-brand-primary);
  font-size: 11px;
  font-weight: 500;
  line-height: 17px;
}

.dsh-glass-mode-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: var(--dsw-font-xxs-12-font-size, 12px);
  line-height: var(--dsw-font-xxs-12-line-height, 19px);
}

.dsh-glass-radio {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 16px;
  height: 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 50%;
  background: var(--dsw-alias-bg-layer-1);
}

.dsh-glass-mode.is-selected .dsh-glass-radio {
  border-color: transparent;
  background: var(--dsw-alias-brand-primary);
  box-shadow: inset 0 0 0 3.5px var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1));
}

/* Type specimen: the reading scale shown at its real size, on the same
   surface the conversation uses. */
.dsh-glass-specimen {
  margin: 0;
  padding: 18px 20px 20px;
  border: 0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
  border-radius: var(--dsw-radius-lg, 16px);
  background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1));
}

.dsh-glass-specimen-label {
  display: block;
  margin-bottom: 10px;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--dsw-font-xxs-12-font-size, 12px);
  line-height: var(--dsw-font-xxs-12-line-height, 19px);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dsh-glass-specimen-body {
  margin: 0;
  max-width: 34em;
  color: var(--dsw-alias-label-primary);
  font-size: var(--dsh-glass-read);
  line-height: var(--dsh-glass-read-lead);
}

.dsh-glass-specimen-body strong {
  font-weight: 600;
}

.dsh-glass-rules {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(196px, 1fr));
  gap: 10px;
  margin: 0;
}

.dsh-glass-rule {
  padding: 12px 13px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md, 12px);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 62%, transparent);
}

.dsh-glass-rule dt {
  margin: 0 0 4px;
  color: var(--dsw-alias-label-primary);
  font-size: var(--dsw-font-xs-strong-13-font-size, 13px);
  line-height: var(--dsw-font-xs-strong-13-line-height, 20px);
  font-weight: 600;
}

.dsh-glass-rule dd {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--dsw-font-xxs-12-font-size, 12px);
  line-height: var(--dsw-font-xxs-12-line-height, 19px);
}

.dsh-glass-note {
  margin: 0;
  padding-top: 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: var(--dsw-font-xxs-12-font-size, 12px);
  line-height: var(--dsw-font-xxs-12-line-height, 19px);
}

/* First screen = the three choices plus one real type sample. The style guide
   and the switch diagnostics sit behind a single disclosure instead of
   competing with the controls. Native <details>, so it works without JS. */
.dsh-glass-more {
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md, 12px);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 42%, transparent);
}

.dsh-glass-more-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 14px;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--dsw-font-xs-strong-13-font-size, 13px);
  font-weight: 500;
  line-height: 20px;
  list-style: none;
  cursor: pointer;
}

.dsh-glass-more-summary::-webkit-details-marker { display: none; }

.dsh-glass-more-summary::after {
  content: "";
  width: 7px;
  height: 7px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg) translateY(-2px);
  opacity: 0.7;
  transition: transform 160ms ease;
}

.dsh-glass-more[open] .dsh-glass-more-summary::after {
  transform: rotate(225deg) translateY(-2px);
}

.dsh-glass-more-summary:hover { color: var(--dsw-alias-label-primary); }

.dsh-glass-more-summary:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary));
  outline-offset: -2px;
  border-radius: var(--dsw-radius-md, 12px);
}

.dsh-glass-more-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px 14px 14px;
}

@media (prefers-reduced-motion: reduce) {
  .dsh-glass-more-summary::after { transition: none; }
}

/* (4.9.6) The liquid-glass switch row was removed from this panel — glass is the
   material now, not an option. Its .dsh-glass-glass* rules went with it. */

/* Scene concentration: three stops on one axis, not three unrelated buttons.
   It decides only how much photograph the work surfaces let through; the
   reading veil is deliberately constant, so no stop can make the text harder
   to read — it changes the mood, never the legibility. */
.dsh-glass-scene {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  margin: 0;
  padding: 12px 14px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md, 12px);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 58%, transparent);
}

.dsh-glass-scene-text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dsh-glass-scene-title {
  color: var(--dsw-alias-label-primary);
  font-size: var(--dsw-font-xs-strong-13-font-size, 13px);
  font-weight: 600;
  line-height: var(--dsw-font-xs-strong-13-line-height, 20px);
}

.dsh-glass-scene-desc {
  color: var(--dsw-alias-label-secondary);
  font-size: var(--dsw-font-xxs-12-font-size, 12px);
  line-height: var(--dsw-font-xxs-12-line-height, 19px);
}

/* ── 5.0 · the wallpaper picker: the one swappable input ──────────────────
   Everything else on this panel changes how the material behaves; this row
   changes only the photograph. Keeping it a plain grid of buttons means the
   field can grow one image at a time without any layout branch. */
.dsh-glass-wallpaper {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md, 12px);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 58%, transparent);
}

.dsh-glass-walls {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 8px;
}

.dsh-glass-wall {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 5px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}

.dsh-glass-wall:hover {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dsh-glass-wall.is-selected {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 58%, var(--dsw-alias-border-l2));
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent);
  color: var(--dsw-alias-label-primary);
}

.dsh-glass-wall-swatch {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2);
}

.dsh-glass-wall-builtin {
  background:
    radial-gradient(70% 80% at 20% 10%, color-mix(in srgb, var(--dsh-glass-skin-frost) 52%, transparent), transparent 70%),
    radial-gradient(70% 80% at 85% 95%, color-mix(in srgb, var(--dsh-glass-skin-ember) 40%, transparent), transparent 70%),
    #0a121c;
}

.dsh-glass-wall-name {
  overflow: hidden;
  color: inherit;
  font-size: 11px;
  line-height: 15px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 5.2 · one refresh affordance beside the drop-folder note. The list is read
   per mount, so a file copied in while the app runs needs this button rather
   than a page reload. */
.dsh-glass-wall-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dsh-glass-wall-foot .dsh-glass-note {
  flex: 1 1 240px;
  padding-top: 0;
}

.dsh-glass-wall-info {
  padding-top: 0;
}

/* Drop target: the whole wallpaper card becomes the import surface. */
.dsh-glass-wallpaper.is-dragging {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 65%, var(--dsw-alias-border-l2));
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent);
}

.dsh-glass-wallpaper.is-dragging .dsh-glass-walls {
  outline: 1px dashed color-mix(in srgb, var(--dsw-alias-brand-primary) 70%, transparent);
  outline-offset: 4px;
  border-radius: 6px;
}

.dsh-glass-refresh {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-link);
  font: inherit;
  font-size: var(--dsw-font-xxs-12-font-size, 12px);
  line-height: 18px;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}

.dsh-glass-refresh:hover {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dsh-glass-refresh:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
}

.dsh-glass-wall-error {
  color: var(--dsw-alias-state-error-primary);
}

@media (prefers-reduced-motion: reduce) {
  .dsh-glass-refresh { transition: none; }
}

.dsh-glass-seg {
  display: inline-flex;
  flex: none;
  padding: 2px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover-solid);
}

.dsh-glass-seg-btn {
  min-width: 54px;
  padding: 4px 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: var(--dsw-font-xxs-12-font-size, 12px);
  line-height: 19px;
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease;
}

.dsh-glass-seg-btn:hover {
  color: var(--dsw-alias-label-primary);
}

.dsh-glass-seg-btn.is-selected {
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 1px 2px rgba(2, 8, 14, 0.18);
}

.dsh-glass-seg-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
}

@media (prefers-reduced-motion: reduce) {
  .dsh-glass-seg-btn { transition: none; }
}

.dsh-glass-switch {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover-solid);
  transition: background 160ms ease;
}

.dsh-glass-switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--dsw-alias-label-primary-foreground);
  transition: transform 160ms ease;
}

.dsh-glass-switch[data-on="true"] {
  background: var(--dsw-alias-brand-primary);
}

.dsh-glass-switch[data-on="true"]::after {
  transform: translateX(14px);
}

/* Read-back line: with no browser control on the build side, this is how the
   switch reports which link of the chain is broken. */
.dsh-glass-diag {
  margin: -8px 0 0;
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
  font-size: 11px;
  line-height: 17px;
  color: var(--dsw-alias-label-tertiary);
  word-break: break-all;
}

/* 5.3 · host-hook audit: one line of pills, each colored by what it means. */
.dsh-glass-diag-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.dsh-glass-hooks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: -2px 0 2px;
}

.dsh-glass-hook {
  padding: 1px 7px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 17px;
}

.dsh-glass-hook.is-ok {
  color: var(--dsw-alias-state-success-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 38%, transparent);
}

.dsh-glass-hook.is-missing {
  color: var(--dsw-alias-state-error-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 38%, transparent);
}

.dsh-glass-hook.is-blind,
.dsh-glass-hook.is-idle {
  color: var(--dsw-alias-label-tertiary);
}

/* Palette strip: the colour rules shown as the tokens they actually are, so
   the page is a live style guide rather than a description of one. */
.dsh-glass-swatches {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
  gap: 8px;
  margin: 0;
}

.dsh-glass-swatch {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md, 12px);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 58%, transparent);
}

.dsh-glass-dot {
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent);
}

.dsh-glass-swatch-name {
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
  font-size: var(--dsw-font-xxs-12-font-size, 12px);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .dsh-glass-mode,
  .dsh-glass-radio,
  .dsh-glass-preview-bar {
    transition: none;
  }
}

@media (max-width: 720px) {
  .dsh-glass-modes { grid-template-columns: minmax(0, 1fr); }
  .dsh-glass-rules { grid-template-columns: minmax(0, 1fr); }
}

/* ════════════════════════════════════════════════════════════════════════
   7 · 宿主几何层（build-pinned）

   Everything above talks to the host through theme tokens, --dsh-* variables
   and ARIA/theme attributes. This section is the one exception: header height,
   the sidebar caption size and the deliverable cards' material are hardcoded
   inside the host's CSS modules, so they can only be reached through their
   hashed class names.

   Discipline: these selectors are pinned to the shipped build. After a DSH
   upgrade they simply stop matching and the affected surfaces fall back to
   stock — nothing inverts, nothing misaligns. Re-extract and re-calibrate with
   skins/_tools/README.md once the new build is unpacked.
   ════════════════════════════════════════════════════════════════════════ */

/* Header: it is a 76px band only when tabs are present (the host zeroes the
   floor otherwise), so the compression is scoped to exactly that case. */
html .Dc7zOa_header:has(.Dc7zOa_tabs) {
  min-height: 64px;
  padding-top: 8px;
}

/* Sidebar: session time is set at 10px, which is unreadable in Chinese;
   lift it to the host's own smallest real step (11px). Tabular figures keep the
   timestamps from jittering as the list updates. */
html .hIlkoa_time {
  font-size: 11px;
  line-height: 17px;
  font-variant-numeric: tabular-nums;
}

/* "New session" is 38px tall while every panel row is 36px; align the grid.
   Material: faint ice tint, hairline, lit top edge — a control that belongs to
   the glass around it. It stays quiet at rest and gains presence on hover. */
html ._2H3hWW_newSession {
  height: 36px;
  justify-content: center;
  gap: 8px;
  color: var(--dsw-alias-label-primary);
  background:
    linear-gradient(180deg,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 16%, transparent),
      color-mix(in srgb, var(--dsh-glass-skin-frost) 7%, transparent));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 22%, transparent),
    inset 0 0 0 0.5px var(--dsw-alias-border-l2);
  transition: background 150ms ease, box-shadow 150ms ease;
}
html ._2H3hWW_newSession:hover {
  background:
    linear-gradient(180deg,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 26%, transparent),
      color-mix(in srgb, var(--dsh-glass-skin-frost) 12%, transparent));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 30%, transparent),
    inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  html ._2H3hWW_newSession { transition: none; }
}

/* One photograph, one material. The title bar, the sidebar and the transcript
   all paint the same two-layer stack over body::before: bg-base over
   sidebar-fill. 4.9.0 removed the sidebar's own coat, 4.9.7 removed the title
   bar's, so there is no shell fill, rim or blur left to keep in sync and no
   second wallpaper anywhere. The scene token still owns the only level knob. */

/* Keep the original frame + center tint under the transcript, in the SAME
   compositing order; the title bar's own rule below paints that same stack.
   The scene token remains owned exclusively by applySceneTokens. */
html[data-windows-titlebar] .BynINW_frame {
  background: transparent;
}
html[data-windows-titlebar] .BynINW_centerCol {
  background:
    linear-gradient(var(--dsw-alias-bg-base), var(--dsw-alias-bg-base)),
    var(--dsw-specific-sidebar-fill);
  /* The host rounds this corner to 16px, which cuts a notch out of the split
     and makes the transcript read as a card floating beside the sidebar. The
     two columns are one surface now, so the corner is square. */
  border-top-left-radius: 0;
}

/* ── right dock: the code/document column is a work surface, not the photo ──
   The host paints \`.BynINW_rightbarCol\` with \`--dsw-alias-bg-base\`, i.e. the
   *environment* layer: 0.02 ink at the default "clear" stop. The text preview
   then puts thousands of lines of syntax colour straight onto the wallpaper,
   and the bright patches behind the code are what reads as "flashy". This
   column is a work surface, so it takes the work ladder's own fill — one shade
   deeper than a panel, almost as deep as a code block — plus the frost wash.

   It deliberately does NOT add backdrop-filter: the column is large and
   scrolls, so sampling the photograph on every scroll frame would be the
   expensive choice, not the pretty one. The ink stays light enough that the
   scene is still felt at the edges, and the scene stop still owns the level. */
html body {
  --dsh-glass-dock-fill: rgba(13, 22, 32, 0.82);
  --dsh-glass-dock-code: rgba(6, 12, 19, 0.28);
  --dsh-glass-dock-rim: rgba(166, 199, 221, 0.10);
}
html body[data-dsh-glass-scene="balanced"] {
  --dsh-glass-dock-fill: rgba(12, 21, 31, 0.86);
}
html body[data-dsh-glass-scene="quiet"] {
  --dsh-glass-dock-fill: rgba(11, 19, 29, 0.90);
}
html body[data-dsh-glass-mode="focus"] {
  --dsh-glass-dock-fill: rgba(9, 16, 24, 0.92);
  --dsh-glass-dock-code: rgba(4, 9, 15, 0.30);
}
html[data-dsh-glass-scheme="light"] body {
  --dsh-glass-dock-fill: rgba(247, 251, 255, 0.84);
  --dsh-glass-dock-code: rgba(226, 238, 248, 0.34);
  --dsh-glass-dock-rim: rgba(56, 92, 118, 0.14);
}
html[data-dsh-glass-scheme="light"] body[data-dsh-glass-scene="balanced"] {
  --dsh-glass-dock-fill: rgba(248, 252, 255, 0.88);
}
html[data-dsh-glass-scheme="light"] body[data-dsh-glass-scene="quiet"] {
  --dsh-glass-dock-fill: rgba(248, 252, 255, 0.92);
}
html[data-dsh-glass-scheme="light"] body[data-dsh-glass-mode="focus"] {
  --dsh-glass-dock-fill: rgba(249, 253, 255, 0.94);
}

html body .BynINW_rightbarCol,
html[data-platform="darwin"] .BynINW_rightbarCol {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--dsh-glass-skin-frost) 7%, transparent), transparent 52%),
    var(--dsh-glass-dock-fill);
  box-shadow: inset 0.5px 0 var(--dsh-glass-dock-rim);
}

/* The code view is transparent by host default (\`--dsl-code-block-background:
   transparent\`), which is right on a solid panel and wrong on a photograph.
   One more coat gives syntax colour the same slate whatever the wallpaper does. */
html body [data-document-preview] [data-code-preview] {
  background: var(--dsh-glass-dock-code);
}

/* Opening the dock animates the grid track width. While a document preview is
   mounted we skip that window and land at the final width: the material does
   the "arriving", and there is no frame in which the code column is mid-slide.
   Precaution, not a measured root cause — a 2,700-line synthetic A/B showed no
   meaningful frame-time difference, so the real cost lives in the host (the
   preview's auto-refresh re-reads and re-highlights the whole file). */
html .BynINW_frame[data-animating]:has([data-document-preview]) {
  transition: none;
}

/* Never put a filter on the sidebar ancestor: backdrop-filter would establish a
   containing block for fixed descendants. The Windows toggle and collapsed New
   Session must stay viewport-positioned in the title bar. A z-index stacking
   context alone does not rebase them. */
html .BynINW_sidebarCol {
  position: relative;
  z-index: 0;
  background: transparent;
  /* One pane, no seam: the stock .5px border and the old inset rim were the
     visible line between the sidebar and the transcript. */
  border-right: none;
}
/* Beat Darwin's platform-specific paints as well, including its dark rule. */
html[data-platform="darwin"] .BynINW_sidebarCol,
html[data-platform="darwin"] body[data-ds-dark-theme] .BynINW_sidebarCol {
  background: transparent;
}
html .BynINW_sidebarCol ._2H3hWW_root {
  background: transparent;
  /* Small timestamps/captions need a firmer ink on the thinner glass. */
  --dsw-alias-label-tertiary: var(--dsw-alias-label-secondary);
  --dsw-alias-label-caption: var(--dsw-alias-label-secondary);
}
html[data-dsh-glass-scheme="dark"] .BynINW_sidebarCol ._2H3hWW_root,
html body[data-ds-dark-theme] .BynINW_sidebarCol ._2H3hWW_root {
  --dsw-alias-label-secondary: #d3e3ef;
  text-shadow: 0 1px 3px rgba(0, 6, 12, 0.8);
}
/* The sidebar is the transcript's material, not a card beside it: the scene
   base over one work-layer coat — the exact composite .BynINW_centerCol has
   painted since 4.7. Same wallpaper, same weight, same sharpness on both sides
   of the split. No frost, no cool/warm wash, no rim: a frosted coat of its own
   was what made the left column read as a separate panel. */
html .BynINW_sidebarCol::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    linear-gradient(var(--dsw-alias-bg-base), var(--dsw-alias-bg-base)),
    var(--dsw-specific-sidebar-fill);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
}

/* The session list closes with a 24px bottom fade: a background of
   linear-gradient(to bottom, transparent, var(--dsw-specific-sidebar-fill)).
   On the default opaque sidebar that token is the sidebar's own surface, so the
   fade is invisible. This skin redefines it as the *ink* the content planes are
   painted with over the photograph, so the fade adds a second ink coat — a dark
   band over the last visible row. It belongs to no row state: the row under it
   is a plain .hIlkoa_sessionRow with aria-selected="false" and no state class,
   which is why the band stays put when the pointer leaves. The list already
   ends at the footer, so the fade has nothing left to hide; remove it and keep
   the footer edge as crisp as every other edge in this skin. */
html ._9lTDKa_fade {
  display: none;
}

/* The title bar is the top 40px of the same surface, not a frosted cap.
   4.9.7: it used to be the last place that kept its own recipe — a 0.32 ink
   coat, a 14px sample of the photograph and a cool/warm wash. On a window
   whose page below is sharp, that band read as a second material: a lighter,
   blurred strip sitting on top of the workspace. It now paints exactly what
   .BynINW_centerCol and the sidebar's ::before paint — one bg-base coat over
   the sidebar fill over the one fixed wallpaper — with no sampler, no wash and
   no lit top line. Same stack, same sharpness, so the seam has nothing left to
   draw itself with. The host still owns the band's geometry and drag region. */
html[data-windows-titlebar] .BynINW_frame:before {
  background:
    linear-gradient(var(--dsw-alias-bg-base), var(--dsw-alias-bg-base)),
    var(--dsw-specific-sidebar-fill);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
}

/* Without backdrop sampling, the transparent seats need a steadier fill, or
   text would fight the photograph. The title bar is not in this list any more:
   it is the page's own surface, so the scene token alone decides its weight.
   Neither path filters fixed controls. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  html body,
  html body[data-dsh-glass-mode="focus"] {
    /* Without sampling, the lighter fills would let text fight the photo. */
    --dsw-specific-bubble: rgba(255, 255, 255, 0.92);
    --dsw-alias-markdown-code-block: rgba(241, 247, 252, 0.95);
    --dsw-alias-markdown-code-block-banner: rgba(232, 242, 249, 0.97);
  }
  html[data-dsh-glass-scheme="dark"] body,
  html body[data-ds-dark-theme],
  html[data-dsh-glass-scheme="dark"] body[data-dsh-glass-mode="focus"],
  html body[data-ds-dark-theme][data-dsh-glass-mode="focus"] {
    --dsw-specific-bubble: rgba(24, 39, 57, 0.90);
    --dsw-alias-markdown-code-block: rgba(17, 29, 42, 0.92);
    --dsw-alias-markdown-code-block-banner: rgba(24, 38, 53, 0.94);
  }
}

/* Native window buttons (Windows): the Desktop shell measures a hidden probe
   span whose background is --dsw-specific-sidebar-fill and whose glyph colour
   is --dsw-alias-label-primary, then pushes the pair to the main process over
   the dsh-desktop:windows-appearance channel, which calls
   setTitleBarOverlay().

   Windows paints that whole caption region as ONE rectangle, and it drops the
   alpha channel: shipping rgba(83, 89, 106, 0.94) produced exactly
   rgb(83, 89, 106) in the capture — no blend with the title bar behind it. A
   fully transparent value is the exception: nothing gets painted, the bar keeps
   its own glass, and the three glyphs sit on it. So the recipe is to hand the
   shell *nothing*; any colour here can only ever be a flat slab over a live
   photograph. Selector keys off the probe's own inline style, the only handle
   it exposes. */
body > span[style*="--dsw-specific-sidebar-fill"] {
  --dsw-specific-sidebar-fill: rgba(0, 0, 0, 0);
  --dsw-alias-label-primary: #f2f8ff;
}
html[data-dsh-glass-scheme="light"] body > span[style*="--dsw-specific-sidebar-fill"] {
  /* Same nothing in light mode; only the glyphs flip to dark ink. */
  --dsw-specific-sidebar-fill: rgba(0, 0, 0, 0);
  --dsw-alias-label-primary: #0d1b26;
}

/* Deliverable and change cards paint themselves with static neutrals
   (#fafafa light / #212123 dark) and never meet the theme. Point them at the
   work layer instead, so results read as part of the same workspace. */
html .flL80G_root,
html[data-dsh-glass-scheme="dark"] .flL80G_root,
html body[data-ds-dark-theme] .flL80G_root {
  --deliverable-fill: var(--dsw-alias-bg-layer-1);
  --deliverable-hover: var(--dsw-alias-bg-layer-2);
}

html .kuvljq_card,
html[data-dsh-glass-scheme="dark"] .kuvljq_card,
html body[data-ds-dark-theme] .kuvljq_card {
  --changes-fill: var(--dsw-alias-bg-layer-2);
  --changes-hover: var(--dsw-alias-bg-layer-3);
}

/* Same 10px problem on the card subtitle. */
html .flL80G_description {
  font-size: 11px;
  line-height: 17px;
}

/* ── composer: one recipe, four states ─────────────────────────────────────
   Two levels, one family. The base level is part of the theme — hairline,
   lit top edge, cool-ink elevation — and it is present whatever the switch
   says, because turning an effect off must leave a designed card rather than
   the stock one. Glass adds the lighter fill, the backdrop filter and the
   diagonal sweep; it no longer touches the canvas — that is the scene setting.

   The card exposes four variables (fill / top edge / rim / bottom edge) and
   every state rewrites only the ones it owns. Before this, base and glass each
   spelled out their own full shadow list, so focus and disabled would have
   become a third and fourth drifting material.

   The sweep lives in the card's BACKGROUND, never in an overlay: background
   paints behind the content, so glare cannot wash over the sentence being
   typed. The previous ::after + mix-blend-mode: screen did exactly that. */
html body [data-composer-card] {
  --dsh-glass-card-fill: color-mix(in srgb, var(--dsw-specific-input-major) 92%, transparent);
  --dsh-glass-card-top: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
  --dsh-glass-card-rim: color-mix(in srgb, var(--dsw-alias-border-l2) 85%, transparent);
  --dsh-glass-card-bottom: inset 0 -1px 0 transparent;
  background: var(--dsh-glass-card-fill);
  box-shadow:
    var(--dsh-glass-card-bottom),
    inset 0 1px 0 var(--dsh-glass-card-top),
    inset 0 0 0 0.5px var(--dsh-glass-card-rim),
    var(--dsw-elevation-soft);
  transition: box-shadow 160ms ease;
}

/* Focus: the same card with an icier rim — not an outer halo. A 2px ring around
   a 44-glyph card reads as an error state; the rim brightening is enough to say
   "you are here", and it never touches layout. */
html body [data-composer-card]:focus-within {
  --dsh-glass-card-top: color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, transparent);
  --dsh-glass-card-rim: color-mix(in srgb, var(--dsw-alias-brand-primary) 46%, transparent);
}

/* Disabled: inert, not glassy. Keyed off the host's own class through :has(),
   so a build that keeps that class keeps the state. */
html body [data-composer-card]:has(.RlGAzG_inputDisabled) {
  --dsh-glass-card-fill: color-mix(in srgb, var(--dsw-specific-input-major) 96%, transparent);
  --dsh-glass-card-top: transparent;
  --dsh-glass-card-rim: color-mix(in srgb, var(--dsw-alias-border-l1) 80%, transparent);
  --dsh-glass-card-bottom: inset 0 -1px 0 transparent;
  /* 4.9.11: the disabled state no longer deletes the backdrop filter. The 96%
     fill already hides whatever is behind it, and deleting the filter made a
     transient host disable (a permission prompt, a reconnect) flip the card
     between frosted and clear instead of only changing its fill. */
  cursor: not-allowed;
}

/* Glass level: only the variables change. */
body[data-dsh-glass-glass="on"] [data-composer-card] {
  --dsh-glass-card-fill:
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.26) 0%,
      rgba(255, 255, 255, 0.05) 26%,
      transparent 46%,
      transparent 66%,
      rgba(158, 214, 240, 0.12) 100%
    ),
    color-mix(in srgb, var(--dsw-specific-input-major) 46%, transparent);
  --dsh-glass-card-top: rgba(255, 255, 255, 0.6);
  --dsh-glass-card-rim: rgba(255, 255, 255, 0.22);
  --dsh-glass-card-bottom: inset 0 -1px 0 color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent);
  /* One fixed filter list, never url(#svg) and never rewritten at runtime:
     a backdrop filter that is rebuilt (async image decode, region updates,
     remount) is painted unfiltered for a frame, which reads as the card
     flickering between clear and frosted. See the 4.9.11 note in the script. */
  backdrop-filter: blur(10px) saturate(180%) contrast(1.05) brightness(1.02);
  -webkit-backdrop-filter: blur(10px) saturate(180%) contrast(1.05) brightness(1.02);
}

/* On paper the white side of the sweep disappears; the frost tint takes its
   place, so the card still reads as glass rather than a white rectangle.
   The :not(:has(disabled)) guard keeps the inert state winnable: the light
   rule carries three class-level parts and would otherwise out-rank it. */
html[data-dsh-glass-scheme="light"] body[data-dsh-glass-glass="on"] [data-composer-card]:not(:has(.RlGAzG_inputDisabled)) {
  --dsh-glass-card-fill:
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.62) 0%,
      rgba(127, 182, 207, 0.10) 32%,
      transparent 50%,
      transparent 70%,
      rgba(127, 182, 207, 0.22) 100%
    ),
    color-mix(in srgb, var(--dsw-specific-input-major) 46%, transparent);
}

/* ── 5.1 · liquid glass on the composer, and nowhere else ──────────────────
   The article's three-layer recipe, rewritten to survive this theme's rules:
   the card's backdrop-filter stays one fixed list (never a url() filter), and
   the material is never rebuilt at runtime. The refraction is a filtered
   pseudo-element whose feTurbulence noise is rastered once — no SMIL, no
   observer, no interval, no remount race. Flow is a registered custom
   property sweeping a highlight under the text, 18 s, one small card.
   Scope is the composer: the sidebar, dock and dialogs keep static materials. */
@property --dsh-glass-liquid-x {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}

body[data-dsh-glass-glass="on"] [data-composer-card] {
  position: relative;
  isolation: isolate;
}

body[data-dsh-glass-glass="on"] [data-composer-card]::before,
body[data-dsh-glass-glass="on"] [data-composer-card]::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  border-radius: inherit;
}

/* Static refraction: the data-URI filter is resolved from the stylesheet, so a
   host re-render cannot detach it. The mask fades the layer before the card's
   rounded edge, which also hides displacement seams.

   5.1.1: light only, no ribs. The layer used to carry a 1px repeating stripe at
   a 6px pitch; displacement turns any periodic line into a contour map, so the
   whole card read as engraved marble ("莫名其妙的纹路") instead of glass. Broad
   gradients are formless under the same warp, so the refraction stays as slow
   light pooling while nothing is drawn on the surface. */
body[data-dsh-glass-glass="on"] [data-composer-card]::before {
  background:
    radial-gradient(62% 80% at 18% 12%,
      color-mix(in srgb, var(--dsh-glass-skin-frost, #9ed6f0) 24%, transparent), transparent 70%),
    radial-gradient(58% 74% at 82% 88%,
      color-mix(in srgb, var(--dsh-glass-skin-ember, #f0c37e) 18%, transparent), transparent 72%),
    linear-gradient(104deg,
      rgba(255, 255, 255, 0.050) 0%,
      rgba(255, 255, 255, 0.014) 38%,
      rgba(255, 255, 255, 0.042) 66%,
      rgba(255, 255, 255, 0.010) 100%);
  filter: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%3E%3Cfilter%20id%3D'r'%20x%3D'0%25'%20y%3D'0%25'%20width%3D'100%25'%20height%3D'100%25'%20color-interpolation-filters%3D'sRGB'%3E%3CfeTurbulence%20type%3D'fractalNoise'%20baseFrequency%3D'0.018%200.030'%20numOctaves%3D'2'%20seed%3D'7'%20result%3D'n'%2F%3E%3CfeDisplacementMap%20in%3D'SourceGraphic'%20in2%3D'n'%20scale%3D'20'%20xChannelSelector%3D'R'%20yChannelSelector%3D'G'%2F%3E%3C%2Ffilter%3E%3C%2Fsvg%3E#r");
  mix-blend-mode: screen;
  opacity: 0.52;
  -webkit-mask-image: radial-gradient(ellipse 88% 125% at 50% 50%, #000 58%, transparent 100%);
  mask-image: radial-gradient(ellipse 88% 125% at 50% 50%, #000 58%, transparent 100%);
}

/* Flow: one highlight crossing the card every 18 s, under every glyph. */
body[data-dsh-glass-glass="on"] [data-composer-card]::after {
  background: linear-gradient(112deg,
    rgba(255, 255, 255, 0) 40%,
    rgba(255, 255, 255, 0.13) 50%,
    rgba(255, 255, 255, 0) 60%);
  background-size: 220% 100%;
  background-position: var(--dsh-glass-liquid-x) 50%;
  animation: dsh-glass-liquid-sweep 18s ease-in-out infinite;
}

@keyframes dsh-glass-liquid-sweep {
  0%   { --dsh-glass-liquid-x: 0%; }
  50%  { --dsh-glass-liquid-x: 100%; }
  100% { --dsh-glass-liquid-x: 0%; }
}

/* On paper the white refraction disappears; a cool multiply tint and a
   frost-coloured sweep take its place. Only the fill variables change. */
html[data-dsh-glass-scheme="light"] body[data-dsh-glass-glass="on"] [data-composer-card]::before {
  background:
    radial-gradient(62% 80% at 18% 12%, rgba(127, 182, 207, 0.20), transparent 70%),
    radial-gradient(58% 74% at 82% 88%, rgba(185, 124, 63, 0.10), transparent 72%),
    linear-gradient(104deg,
      rgba(18, 54, 84, 0.030) 0%,
      rgba(18, 54, 84, 0.008) 40%,
      rgba(18, 54, 84, 0.026) 68%,
      rgba(18, 54, 84, 0.006) 100%);
  mix-blend-mode: multiply;
  opacity: 0.50;
}

html[data-dsh-glass-scheme="light"] body[data-dsh-glass-glass="on"] [data-composer-card]::after {
  background-image: linear-gradient(112deg,
    rgba(127, 182, 207, 0) 40%,
    rgba(127, 182, 207, 0.20) 50%,
    rgba(127, 182, 207, 0) 60%);
}

@media (prefers-reduced-motion: reduce) {
  body[data-dsh-glass-glass="on"] [data-composer-card]::after { animation: none; }
}

/* Keyboard focus inside the composer: the host styles none of these controls,
   so this is the first visible focus in the dock (attach, model, permission,
   send, stop). Outline follows the radius, so it costs no layout. */
html body [data-composer-card] button:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary));
  outline-offset: 2px;
}

/* The caret is ink, not state. The host paints it with the business-state
   colour — its "running" tone — so in dark mode
   the caret is the same ice blue as the primary button, links and the focus
   ring: the loudest colour in the window, on the one thing that blinks while
   you type. DESIGN §1 gives cool ink to text and ice to state, so the caret
   resolves inside the ink family — the glyph colour mixed a quarter towards
   frost — instead: still high-contrast on the card (well above 7:1 on both
   paper and the dark card), no longer a second send button blinking at you.
   The :not() keeps the host's chip rule win-able — it sets
   "caret-color: #0000" while a composer chip is selected, and this selector
   would otherwise out-rank it and leave a visible caret there. */
html body [data-composer-card] .RlGAzG_input:not([data-composer-chip-selected]) {
  caret-color: color-mix(in srgb, var(--dsw-alias-label-primary) 74%, var(--dsh-glass-skin-frost));
}

@media (prefers-reduced-motion: reduce) {
  html body [data-composer-card] { transition: none; }
}

/* ── the two controls on the card: one glass recipe ───────────────────────
   The + and the send key are the same object at two sizes: a key sitting on
   the composer glass. The send key arrived as a solid periwinkle disc (the
   host's info fill + a hard-coded #fff); it now shares this exact recipe, so
   the composer has one material and one rim language. Glass is the material;
   the fill is translucent, the photo still moves under it. */
html body [data-composer-card] .RlGAzG_add,
html body [data-composer-card] .RlGAzG_primary {
  color: var(--dsw-alias-label-primary);
  background:
    linear-gradient(135deg,
      color-mix(in srgb, #ffffff 14%, transparent) 0%,
      transparent 52%,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 14%, transparent) 100%),
    color-mix(in srgb, var(--dsw-specific-input-major) 58%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 16%, transparent),
    inset 0 0 0 0.5px var(--dsw-alias-border-l2);
  /* Only properties that can interpolate cleanly. The fill is a gradient, and a
     gradient cannot be transitioned: keeping background in this list made the
     key interpolate its colour while the gradient flipped at full strength, so
     hover read as two different materials a frame apart. The lift is carried by
     the shadow and the icon colour instead; the sweep switches once, instantly. */
  transition: box-shadow 150ms ease, color 150ms ease;
}

html body [data-composer-card] .RlGAzG_add:hover:not(:disabled),
html body [data-composer-card] .RlGAzG_primary:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  background:
    linear-gradient(135deg,
      color-mix(in srgb, #ffffff 22%, transparent) 0%,
      transparent 52%,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 20%, transparent) 100%),
    color-mix(in srgb, var(--dsw-specific-input-major) 70%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 22%, transparent),
    inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-brand-primary) 28%, transparent);
}

/* Glass level: the card drops to ~0.46 ink, so both controls follow it down.
   A button that stays twice as solid as its own surface stops reading as part
   of that surface. The rim and the icon keep them findable at 28/34px. */
html body[data-dsh-glass-glass="on"] [data-composer-card] .RlGAzG_add:not(:disabled),
html body[data-dsh-glass-glass="on"] [data-composer-card] .RlGAzG_primary:not(:disabled) {
  background:
    linear-gradient(135deg,
      color-mix(in srgb, #ffffff 18%, transparent) 0%,
      transparent 52%,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 16%, transparent) 100%),
    color-mix(in srgb, var(--dsw-specific-input-major) 46%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 20%, transparent),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.20);
}

html body[data-dsh-glass-glass="on"] [data-composer-card] .RlGAzG_add:hover:not(:disabled),
html body[data-dsh-glass-glass="on"] [data-composer-card] .RlGAzG_primary:hover:not(:disabled) {
  background:
    linear-gradient(135deg,
      color-mix(in srgb, #ffffff 26%, transparent) 0%,
      transparent 52%,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 22%, transparent) 100%),
    color-mix(in srgb, var(--dsw-specific-input-major) 62%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 26%, transparent),
    inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-brand-primary) 32%, transparent);
}

html body [data-composer-card] .RlGAzG_add:disabled,
html body [data-composer-card] .RlGAzG_primary:disabled {
  /* The host dims the send key with opacity:.4; the glass recipe already
     dims it, and doubling the two made the disabled key vanish. */
  opacity: 1;
  color: var(--dsw-alias-label-dimmed);
  background: color-mix(in srgb, var(--dsw-specific-input-major) 40%, transparent);
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-border-l1);
}

@media (prefers-reduced-motion: reduce) {
  html body [data-composer-card] .RlGAzG_add,
  html body [data-composer-card] .RlGAzG_primary { transition: none; }
}

/* ════════════════════════════════════════════════════════════════════════
   8 · 组件层 — one material family, four weights

   Every rule below keys off a hook the host exposes on purpose: a data-testid,
   a role, an aria-* fact, or the .md-code-block class the markdown renderer
   ships itself. No hashed class is pinned here, so a DSH upgrade either keeps
   matching or the rule quietly stops applying.

   The weights are the design: a message you read is lightest, a code block is
   the steadiest thing you read, a task card is a control, and a menu or a
   dialog has to hide whatever is behind it. Same gradients, same rim language.
   ════════════════════════════════════════════════════════════════════════ */

/* ── code block: slate glass, not a hole in the page ─────────────────────
   The surface colour is the token above; this only adds the rim, the faint lit
   edge and the banner's own division. Horizontal scrolling is the host's. */
html body .md-code-block {
  box-shadow:
    inset 0 0 0 0.5px var(--dsw-alias-border-l2),
    inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent),
    var(--dsw-elevation-soft);
  /* Blur radius follows AREA, not a single house number. 4.9.2 pushed this to
     14px to match the bubble, and that is what turned the block into a slab: at
     14px the photograph has no structure left, so a large panel becomes a flat
     grey rectangle pasted on the page. A 30px bubble can afford 14px because
     nothing about it is meant to be seen through. At 6px the shelves, the face
     and the jacket lines survive, and the block reads as frosted glass. */
  backdrop-filter: blur(6px) saturate(155%);
  -webkit-backdrop-filter: blur(6px) saturate(155%);
}

/* ── syntax: the code block speaks the page's language, not Open Color ────
   Shiki renders with the css-variables theme (variablePrefix "--shiki-"), so
   every token reaches the page as color: var(--shiki-token-*). That makes the
   palette reachable without touching a component class — the one place in the
   code block the skin had left alone.

   The host's defaults are Open Color: keyword #d6336c, string #2f9e44, function
   #6741d9. On a page where every other surface was pulled into cool ink, those
   were the only fully saturated colours left, which is exactly why the code
   surface read as a foreign patch. These values keep every hue apart — a
   keyword must still read as a keyword, a string as a string — and spend the
   difference on saturation instead: ice for structure and literals, ember for
   parameters, and the prose's own three text levels for comments, punctuation
   and links, so code uses the same hierarchy as the sentences around it.

   The host declares its light set on :root (0,1,0) and its dark set on
   body[data-ds-dark-theme] (0,1,1); one extra element out-ranks both. */
html body {
  --shiki-token-constant: #1f6a88;
  --shiki-token-string: #33704a;
  --shiki-token-comment: #74889a;
  --shiki-token-keyword: #96445c;
  --shiki-token-parameter: #8f4d14;
  --shiki-token-function: #585196;
  --shiki-token-string-expression: #2c6642;
  --shiki-token-punctuation: #4e6472;
  --shiki-token-link: #1d6a89;
}

html[data-dsh-glass-scheme="dark"] body,
html body[data-ds-dark-theme] {
  --shiki-token-constant: #9ed6f0;
  --shiki-token-string: #8fcca3;
  --shiki-token-comment: #7e93a6;
  --shiki-token-keyword: #e0a2b3;
  --shiki-token-parameter: #e0a878;
  --shiki-token-function: #b4a8e6;
  --shiki-token-string-expression: #a3dcb5;
  --shiki-token-punctuation: #a8bccd;
  --shiki-token-link: #a8ddf3;
}

/* The sticky banner wrap paints the canvas colour behind itself, which on a
   glass page reads as a solid strip laid over the photograph. */
html body .md-code-block > div:has(> [data-code-block-banner]) {
  background-color: transparent;
}

html body .md-code-block [data-code-block-banner] {
  /* Same fill as the block it heads: the header is not a second material.
     It stays readable over scrolling code through its own backdrop blur rather
     than a heavier fill — which is exactly what made it read as a plate laid on
     top of the block, and what the 0.82 fill was compensating for. */
  background: transparent;
  backdrop-filter: blur(6px) saturate(155%);
  -webkit-backdrop-filter: blur(6px) saturate(155%);
  box-shadow: inset 0 -0.5px var(--dsw-alias-border-l1);
  padding: 7px 14px;
}

/* The language is an annotation; the copy control is the one clear affordance. */
html body .md-code-block [data-code-block-banner] > span {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 18px;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}

html body .md-code-block [data-code-block-banner] button {
  color: var(--dsw-alias-label-secondary);
  border-radius: var(--dsw-radius-sm, 8px);
  padding: 1px 6px;
  min-height: 20px;
  transition: color 140ms ease, background-color 140ms ease;
}

html body .md-code-block [data-code-block-banner] button:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

html body .md-code-block [data-code-block-banner] button:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary));
  outline-offset: 1px;
}

/* ── task card: a control, not a dark slab ───────────────────────────────
   The dock is the one surface that appears while work is happening, so it keeps
   the strongest accent — but its own body is still glass, and the three voices
   inside it (title / counts / task text) are separated by weight and colour
   instead of by another layer of fill. */
html body [data-testid="todo-panel"] {
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 11%, transparent) 0%,
      transparent 56%,
      color-mix(in srgb, var(--dsh-glass-skin-ember) 5%, transparent) 100%),
    color-mix(in srgb, var(--dsw-specific-menu) 72%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent),
    inset 0 0 0 0.5px var(--dsw-alias-border-l2),
    var(--dsw-elevation-panel);
  /* Same saturate as the other content surfaces (4.9.2); the 16px radius stays
     because this one floats above the transcript rather than sitting in it. */
  backdrop-filter: blur(16px) saturate(155%);
  -webkit-backdrop-filter: blur(16px) saturate(155%);
}

/* Structure follows the host's own header order: lead, title, progress, chevron. */
html body [data-testid="todo-panel"] > div > button {
  gap: 9px;
}

html body [data-testid="todo-panel"] > div > button > span:nth-child(2) {
  font-weight: 600;
}

html body [data-testid="todo-panel"] > div > button > span:nth-child(3) {
  font-size: 12px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
}

/* Long items wrap and stay aligned to their first line instead of being cut. */
html body [data-testid="todo-panel"] li[data-status] {
  align-items: flex-start;
}

html body [data-testid="todo-panel"] li[data-status] > span:first-child {
  margin-top: 2px;
}

html body [data-testid="todo-panel"] li[data-status] > span:last-child {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  overflow-wrap: anywhere;
}

/* Status, not decoration: running is the only thing that moves, so it keeps the
   ice accent; finished work steps back; waiting stays neutral. */
html body [data-testid="todo-panel"] li[data-status="in_progress"] > span:first-child {
  color: var(--dsw-alias-brand-primary);
}

html body [data-testid="todo-panel"] li[data-status="in_progress"] > span:last-child {
  color: var(--dsw-alias-label-primary);
}

html body [data-testid="todo-panel"] li[data-status="completed"] > span:first-child,
html body [data-testid="todo-panel"] li[data-status="completed"] > span:last-child {
  color: var(--dsw-alias-label-tertiary);
}

html body [data-testid="todo-panel"] li[data-status="pending"] > span:first-child {
  color: var(--dsw-alias-label-dimmed);
}

html body [data-testid="todo-panel"] li[data-status="pending"] > span:last-child {
  color: var(--dsw-alias-label-secondary);
}

/* ── account menu: one grid for icon, label and shortcut ─────────────────
   The menu is an operating surface, so it stays the most opaque thing on the
   page — but its rows get the same spacing language as everything else, and
   the shortcut column becomes a real column instead of a trailing accident. */
/* The shared surface paints its fill on an inner material layer at z-index:-1,
   so an inset light line on the surface would sit *under* that layer and never
   show. That is why earlier rounds still read as a flat plate: the rim existed
   in the stylesheet but not on the screen. Edge light belongs on the material
   itself; the surface keeps only the outer elevation. */
html body [data-menu-material] {
  box-shadow: var(--dsw-elevation-prominent);
}

/* One sheen for both the account menu and the composer's + / slash menu: a lit
   top edge, a cool diagonal wash and a frost rim, so the two menus read as the
   same glass as the composer card instead of two black plates. */
html body [data-menu-material] > [aria-hidden="true"]:first-child {
  background-image:
    linear-gradient(180deg,
      color-mix(in srgb, #ffffff 8%, transparent) 0%,
      transparent 30%),
    linear-gradient(135deg,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 9%, transparent) 0%,
      transparent 52%,
      color-mix(in srgb, var(--dsh-glass-skin-ember) 2%, transparent) 100%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 20%, transparent),
    inset 0 0 0 0.5px color-mix(in srgb, var(--dsh-glass-skin-frost) 26%, transparent);
}

html[data-dsh-glass-scheme="light"] body [data-menu-material] > [aria-hidden="true"]:first-child {
  background-image:
    linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, transparent 44%),
    linear-gradient(135deg,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 7%, transparent) 0%,
      transparent 56%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-border-l2) 88%, transparent);
}

/* Flex, not grid: a menu row may carry one, two or three children (label
   alone, icon+label, icon+label+shortcut). The host already gives the label
   flex:1, so fixing the icon box and the gap is enough to align every column —
   and a label-only row keeps its natural width instead of being squeezed into
   a 16px track. */
html body [data-menu-material] [role="menuitem"] {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 30px;
  padding: 4px 10px;
  border-radius: var(--dsw-radius-sm, 8px);
  line-height: 20px;
}

html body [data-menu-material] [role="menuitem"] > span:first-child:has(svg) {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--dsw-alias-label-tertiary);
}

/* Shortcuts are aria-hidden by construction, which makes them addressable
   without touching a hashed class name. */
html body [data-menu-material] [role="menuitem"] > span[aria-hidden="true"] {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  padding-left: 8px;
}

html body [data-menu-material] [role="separator"] {
  height: 0.5px;
  margin: 6px 4px;
  background: color-mix(in srgb, var(--dsw-alias-border-l2) 72%, transparent);
}

/* Signing out is not the menu's loudest colour. The host marks it with a
   danger class whose readable suffix survives CSS-module hashing, so this
   stays pinned to meaning rather than to a hash: neutral at rest, error tone
   only when pointed at. */
html body [data-menu-material] [role="menuitem"][class*="danger"] {
  color: var(--dsw-alias-label-secondary);
}

html body [data-menu-material] [role="menuitem"][class*="danger"] > span:first-child:has(svg) {
  color: var(--dsw-alias-label-tertiary);
}

html body [data-menu-material] [role="menuitem"][class*="danger"]:hover:not(:disabled),
html body [data-menu-material] [role="menuitem"][class*="danger"]:focus-visible {
  color: var(--dsw-alias-state-error-primary);
}

html body [data-menu-material] [role="menuitem"][class*="danger"]:hover:not(:disabled) > span:first-child:has(svg),
html body [data-menu-material] [role="menuitem"][class*="danger"]:focus-visible > span:first-child:has(svg) {
  color: var(--dsw-alias-state-error-primary);
}

/* ── dialogs: one material at every size ─────────────────────────────────
   A dialog has to hide what is behind it, but hiding is the scrim's job; the
   panel only has to be the same glass the rest of the product uses. The stock
   pair (scrim blur 20px, panel blur 22px) blurred the same backdrop twice and
   left a uniform field — measured inside the settings dialog: rgb(28,39,53)
   where the wallpaper point was rgb(91,73,75). 4.9.5 settled the radius
   question: blur follows AREA, and 6px is what keeps a large panel a sheet of
   frosted glass instead of a board. The fill is the same slate as the
   layer-2 / menu family, plus the family's 135° sheen, rim and lit top edge.

   5.0.3: the small dialogs (rename, confirmations) join the same recipe — they
   are the same surface at a smaller size, not a second material.

   5.3.1: the agent-team roster is a role=dialog element too, but it is a *popover*:
   the host already paints its own material layer (::before, fill
   --dsw-specific-menu + menu blur). Painting the dialog fill underneath it
   stacked two opacities on one surface — measured rgb(27,42,59) where the menu
   family resolves to rgb(41,50,61) at the same point — and blurred the same
   backdrop twice. It is excluded here and joins the operating-surface recipe
   below instead. */
html body [role="dialog"]:not([data-team-panel]) {
  --dsh-glass-dialog-fill: rgba(28, 43, 59, 0.62);
  --dsh-glass-dialog-sheen: rgba(255, 255, 255, 0.06);
  background:
    linear-gradient(135deg, var(--dsh-glass-dialog-sheen), transparent 46%),
    var(--dsh-glass-dialog-fill);
  backdrop-filter: blur(6px) saturate(155%);
  -webkit-backdrop-filter: blur(6px) saturate(155%);
  box-shadow:
    inset 0 0 0 0.5px var(--dsw-alias-border-l2),
    inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent),
    var(--dsw-elevation-prominent);
}

/* The settings page stacks cards inside this panel. A second 0.74 fill over the
   0.62 panel reads as another plate — and, measured, *darker* than its own
   parent. Inside the dialog the card is a tint on the panel: one material, two
   heights. Every page in this dialog, host sections and our own, inherits it
   through the settings-card token. */
html body [role="dialog"][data-shortcut-modal="settings"] {
  --dsh-glass-dialog-card: rgba(174, 205, 228, 0.09);
  --dsw-alias-settings-card-fill: var(--dsh-glass-dialog-card);
}

/* Scrim for every dialog: dim enough to lose the lettering, 10px of blur so the
   panel still has a photograph to frost. Stock is a 20px blur under a 0.68 ink
   — which erases exactly the structure the panel would otherwise show.

   Two host structures exist: the settings shell paints its ink on the mask
   element itself, while the shared modal primitive paints it on the mask's
   ::after (._mask_o6lrb_18:after). Overriding only the element produced two
   inks in the primitive — measured rgb(13,17,23) over a rgb(113,81,87) wallpaper
   in the rename dialog, i.e. 0.87 ink instead of 0.58. Both layers are pinned
   here so either structure ends up with exactly one scrim. */
html body [role="presentation"]:has(> [role="dialog"]) > [aria-hidden="true"] {
  background: rgba(4, 10, 16, 0.58);
  backdrop-filter: blur(10px) saturate(130%);
  -webkit-backdrop-filter: blur(10px) saturate(130%);
}

html body [role="presentation"]:has(> [role="dialog"]) > [aria-hidden="true"]::after {
  background: transparent;
}

html[data-dsh-glass-scheme="light"] body [role="dialog"]:not([data-team-panel]) {
  --dsh-glass-dialog-fill: rgba(255, 255, 255, 0.82);
  --dsh-glass-dialog-sheen: rgba(255, 255, 255, 0.5);
}

html[data-dsh-glass-scheme="light"] body [role="dialog"][data-shortcut-modal="settings"] {
  --dsh-glass-dialog-card: rgba(255, 255, 255, 0.64);
}

html[data-dsh-glass-scheme="light"] body [role="presentation"]:has(> [role="dialog"]) > [aria-hidden="true"] {
  background: rgba(12, 22, 32, 0.36);
}

html[data-dsh-glass-scheme="light"] body [role="presentation"]:has(> [role="dialog"]) > [aria-hidden="true"]::after {
  background: transparent;
}

/* ── agent-team popover: an operating surface, not a dialog in a menu ─────
   The roster/task panel portals itself to <body> and owns a ::before material
   layer, so the fill comes from the menu token and the radius from its own
   size. Two leftover plates were measurable: the dialog fill underneath made
   the glass 0.92 where the menu family is 0.78, and the host rows
   (--dsw-alias-bg-layer-2, 0.68) sat on that panel as 0.93 cards — visible
   only as a slightly darker rectangle with no material of its own.

   Blur follows area (4.9.5): this panel reaches 500x680, so it takes the
   large-panel radius, not the 24px a 200px menu can hide behind. Rows and task
   cards become one frost tint over the glass, the same "one material, two
   heights" rule the settings dialog already uses. */
html body [data-team-panel] {
  --dsh-glass-team-card: rgba(174, 205, 228, 0.09);
}

html body [data-team-panel]::before {
  backdrop-filter: blur(6px) saturate(155%);
  -webkit-backdrop-filter: blur(6px) saturate(155%);
  background-image:
    linear-gradient(180deg,
      color-mix(in srgb, #ffffff 8%, transparent) 0%,
      transparent 30%),
    linear-gradient(135deg,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 9%, transparent) 0%,
      transparent 52%,
      color-mix(in srgb, var(--dsh-glass-skin-ember) 2%, transparent) 100%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 20%, transparent),
    inset 0 0 0 0.5px color-mix(in srgb, var(--dsh-glass-skin-frost) 26%, transparent);
}

html body [data-team-panel] button[class*="member"],
html body [data-team-panel] article[class*="task"] {
  background: var(--dsh-glass-team-card);
}

html[data-dsh-glass-scheme="light"] body [data-team-panel] {
  --dsh-glass-team-card: rgba(255, 255, 255, 0.64);
}

html[data-dsh-glass-scheme="light"] body [data-team-panel]::before {
  background-image:
    linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, transparent 44%),
    linear-gradient(135deg,
      color-mix(in srgb, var(--dsh-glass-skin-frost) 7%, transparent) 0%,
      transparent 56%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.85),
    inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-border-l2) 88%, transparent);
}

/* If the settings navigation marks its rows with aria-current, the selected row
   takes the ice accent; a build that does not use the attribute simply keeps
   its own styling. */
html body [role="dialog"] [aria-current="page"] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
  color: var(--dsw-alias-label-primary);
}

/* The Oh Story plugin paints a full onboarding card over every blank session.
   It has no dismiss control of its own and it hides the wallpaper, so this skin
   drops it. Its class is a stable, namespaced name; the workbench itself is
   untouched. Delete this block to bring it back. */
.oh-story-welcome {
  display: none !important;
}
`;

    /* One stylesheet node, rewritten in place. Removing and appending a fresh
       node leaves a frame in which the page has no skin at all — every frosted
       surface goes clear and then comes back, which is indistinguishable from
       the material flickering. Re-apply is now a text update on the same node. */
    let styleNode = null;
    let styleGeneration = 0;

    function applyStyle() {
      if (styleNode !== null && styleNode.isConnected) {
        if (styleNode.textContent !== CSS) styleNode.textContent = CSS;
        return styleNode;
      }
      const style = document.createElement('style');
      style.setAttribute('data-dsh-skin', SOURCE);
      style.textContent = CSS;
      document.head.append(style);
      styleNode = style;
      return style;
    }

    function ModeCard(props) {
      const { mode, title, description, selected, badge, onSelect } = props;
      return React.createElement(
        'button',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': selected,
          className: `dsh-glass-mode${selected ? ' is-selected' : ''}`,
          onClick: () => onSelect(mode),
        },
        React.createElement('span', { className: 'dsh-glass-radio', 'aria-hidden': 'true' }),
        React.createElement(
          'span',
          { className: 'dsh-glass-preview', 'data-mode': mode, 'aria-hidden': 'true' },
          React.createElement('span', { className: 'dsh-glass-preview-bar' }),
          React.createElement('span', { className: 'dsh-glass-preview-bar' }),
          React.createElement('span', { className: 'dsh-glass-preview-bar' }),
        ),
        React.createElement(
          'span',
          { className: 'dsh-glass-mode-title' },
          title,
          badge ? React.createElement('span', { className: 'dsh-glass-badge' }, badge) : null,
        ),
        React.createElement('span', { className: 'dsh-glass-mode-desc' }, description),
      );
    }

    function Rule(props) {
      return React.createElement(
        'div',
        { className: 'dsh-glass-rule' },
        React.createElement('dt', null, props.term),
        React.createElement('dd', null, props.text),
      );
    }

    function Swatch(props) {
      return React.createElement(
        'div',
        { className: 'dsh-glass-swatch' },
        React.createElement('span', {
          className: 'dsh-glass-dot',
          style: { background: props.tone },
          'aria-hidden': 'true',
        }),
        React.createElement('span', { className: 'dsh-glass-swatch-name' }, props.name),
      );
    }

    function GlassSection() {
      const [mode, setLocalMode] = React.useState(currentMode);
      const [scene, setLocalScene] = React.useState(currentScene);
      const [transparency, setLocalTransparency] = React.useState(currentTransparency);
      const [wallpaper, setLocalWallpaper] = React.useState(currentWallpaper);
      const [wallpaperInfo, setLocalWallpaperInfo] = React.useState(currentWallpaperInfo);
      const [walls, setWalls] = React.useState([]);
      const [wallsError, setWallsError] = React.useState(false);
      const [wallsNonce, setWallsNonce] = React.useState(0);
      const [uploading, setUploading] = React.useState(false);
      const [uploadNote, setUploadNote] = React.useState('');
      const [uploadOk, setUploadOk] = React.useState(null);
      const [dragActive, setDragActive] = React.useState(false);
      const [copyState, setCopyState] = React.useState('');
      const [diag, setDiag] = React.useState(null);
      React.useEffect(() => subscribeMode(setLocalMode), []);
      React.useEffect(() => subscribeScene(setLocalScene), []);
      React.useEffect(() => subscribeTransparency(setLocalTransparency), []);
      React.useEffect(() => subscribeWallpaper(setLocalWallpaper), []);
      React.useEffect(() => subscribeWallpaperInfo(setLocalWallpaperInfo), []);
      React.useEffect(() => {
        // The folder is read per open and per refresh, so a photo dropped in
        // while the app runs shows up without a page reload.
        let alive = true;
        if (typeof window.fetch !== 'function') {
          setWallsError(true);
          return () => { alive = false; };
        }
        setWallsError(false);
        window.fetch(WALLPAPERS_URL)
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => {
            if (!alive) return;
            if (data === null || !Array.isArray(data.walls)) {
              setWallsError(true);
              return;
            }
            setWalls(data.walls.filter((entry) => entry !== null && typeof entry?.file === 'string'));
          })
          .catch(() => {
            if (alive) setWallsError(true);
          });
        return () => { alive = false; };
      }, [wallsNonce]);
      React.useEffect(() => {
        const timer = window.setTimeout(() => setDiag(glassDiagnostics()), 1200);
        return () => window.clearTimeout(timer);
      }, [mode, scene, transparency]);
      const choose = (next) => {
        setMode(next);
        setLocalMode(next);
      };
      const importWallpaper = async (file) => {
        if (file === null || typeof file !== 'object' || uploading) return;
        if (typeof window.fetch !== 'function') {
          setUploadNote('当前环境不支持导入，请把图片放进 ~/.dsh/dsh-glass-skin/wallpapers/。');
          return;
        }
        const name = typeof file.name === 'string' && file.name !== '' ? file.name : 'wallpaper';
        const typeOk = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
          || /\.(?:jpe?g|png|webp)$/i.test(name);
        if (!typeOk) {
          setUploadOk(false);
          setUploadNote('只支持 jpg / jpeg / png / webp。');
          return;
        }
        if (typeof file.size === 'number' && file.size > WALLPAPER_MAX_BYTES) {
          setUploadOk(false);
          setUploadNote('图片超过 32MB，请先压小。');
          return;
        }
        setUploading(true);
        setUploadOk(null);
        setUploadNote('导入中…');
        try {
          const response = await window.fetch(WALLPAPERS_URL, {
            method: 'POST',
            headers: {
              'content-type': file.type || 'application/octet-stream',
              // Header values must be ASCII; the host decodes the name back.
              'x-dsh-glass-name': encodeURIComponent(name),
            },
            body: file,
          });
          const text = await response.text();
          let data = null;
          try {
            data = JSON.parse(text);
          } catch {
            // The old host (before a restart) answers 404/HTML; report the code
            // instead of a JSON parse error.
            data = null;
          }
          if (!response.ok || data?.ok !== true) {
            throw new Error(data?.error ?? `导入失败（HTTP ${response.status}）`);
          }
          setWallsNonce((nonce) => nonce + 1);
          setWallpaper(data.file);
          setUploadOk(true);
          setUploadNote(`已导入 ${data.file}`);
        } catch (error) {
          setUploadOk(false);
          setUploadNote(`导入失败：${error?.message ?? error}`);
        } finally {
          setUploading(false);
        }
      };
      const copyReport = async () => {
        const text = JSON.stringify(diag, null, 2);
        let ok = false;
        try {
          if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            ok = true;
          }
        } catch {
          ok = false;
        }
        if (!ok) {
          try {
            const area = document.createElement('textarea');
            area.value = text;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.append(area);
            area.select();
            ok = document.execCommand('copy');
            area.remove();
          } catch {
            ok = false;
          }
        }
        setCopyState(ok ? '已复制' : '复制失败');
        window.setTimeout(() => setCopyState(''), 1800);
      };
      const onDragOver = (event) => {
        event.preventDefault();
        if (!dragActive) setDragActive(true);
      };
      const onDragLeave = (event) => {
        event.preventDefault();
        // Moving between children fires dragleave; only leaving the card counts.
        if (event.currentTarget?.contains?.(event.relatedTarget)) return;
        setDragActive(false);
      };
      const onDrop = (event) => {
        event.preventDefault();
        setDragActive(false);
        const file = event.dataTransfer?.files?.[0] ?? null;
        if (file !== null) void importWallpaper(file);
      };
      const hooks = diag?.shell?.hooks ?? [];
      const requiredHooks = hooks.filter((hook) => hook.required);
      const requiredOk = requiredHooks.filter((hook) => hook.found).length;
      const requiredBlind = requiredHooks.filter((hook) => hook.blind).length;
      const optionalHooks = hooks.filter((hook) => !hook.required);
      const optionalOk = optionalHooks.filter((hook) => hook.found).length;
      return React.createElement(
        'section',
        { className: 'dsh-glass-section', 'aria-label': '玻璃肌肤' },
        React.createElement(
          'header',
          { className: 'dsh-glass-head' },
          React.createElement('h2', null, '玻璃肌肤', React.createElement('span', { className: 'dsh-glass-version' }, `v${VERSION}`)),
          React.createElement(
            'p',
            null,
            '冷色空间、暖色点睛、细腻材质、舒展排版。两种模式共用同一套视觉规则，只改变壁纸的存在感，不改变发送、模型选择、权限和工具行为。',
          ),
        ),
        React.createElement(
          'div',
          { className: 'dsh-glass-modes', role: 'radiogroup', 'aria-label': '壁纸模式' },
          React.createElement(ModeCard, {
            mode: 'ambient',
            title: '氛围模式',
            description: '壁纸保留构图、冷雾与暖光；正文压在一层稳定的阅读纱上。适合日常对话。',
            badge: '默认',
            selected: mode === 'ambient',
            onSelect: choose,
          }),
          React.createElement(ModeCard, {
            mode: 'focus',
            title: '专注模式',
            description: '壁纸退到近乎不可见，面板底色更实、更稳。适合写章、审稿、拆书与阅读长报告。',
            selected: mode === 'focus',
            onSelect: choose,
          }),
        ),
        React.createElement(
          'div',
          { className: 'dsh-glass-scene' },
          React.createElement(
            'div',
            { className: 'dsh-glass-scene-text' },
            React.createElement('span', { className: 'dsh-glass-scene-title' }, '场景浓度'),
            React.createElement(
              'span',
              { className: 'dsh-glass-scene-desc' },
              (SCENE_OPTIONS.find((option) => option.value === scene) ?? SCENE_OPTIONS[0]).desc,
            ),
          ),
          React.createElement(
            'div',
            { className: 'dsh-glass-seg', role: 'radiogroup', 'aria-label': '场景浓度' },
            ...SCENE_OPTIONS.map((option) => React.createElement(
              'button',
              {
                key: option.value,
                type: 'button',
                role: 'radio',
                'aria-checked': scene === option.value,
                className: `dsh-glass-seg-btn${scene === option.value ? ' is-selected' : ''}`,
                onClick: () => setScene(option.value),
              },
              option.title,
            )),
          ),
        ),
        React.createElement(
          'div',
          {
            className: `dsh-glass-wallpaper${dragActive ? ' is-dragging' : ''}`,
            onDragOver,
            onDragLeave,
            onDrop,
          },
          React.createElement(
            'div',
            { className: 'dsh-glass-scene-text' },
            React.createElement('span', { className: 'dsh-glass-scene-title' }, '壁纸'),
            React.createElement(
              'span',
              { className: 'dsh-glass-scene-desc' },
              '换一张图就是换一个主题：材质、排版、状态与场景规则全部保持不变。',
            ),
          ),
          React.createElement(
            'div',
            { className: 'dsh-glass-walls' },
            React.createElement(
              'button',
              {
                type: 'button',
                className: `dsh-glass-wall${wallpaper === '' ? ' is-selected' : ''}`,
                onClick: () => setWallpaper(''),
                title: '内置壁纸',
              },
              React.createElement('span', { className: 'dsh-glass-wall-swatch dsh-glass-wall-builtin', 'aria-hidden': 'true' }),
              React.createElement('span', { className: 'dsh-glass-wall-name' }, '内置壁纸'),
            ),
            ...walls.map((entry) => React.createElement(
              'button',
              {
                key: entry.file,
                type: 'button',
                className: `dsh-glass-wall${wallpaper === entry.file ? ' is-selected' : ''}`,
                onClick: () => setWallpaper(entry.file),
                title: `${entry.file} · ${entry.source === 'user' ? '我的壁纸' : '内置'}`,
              },
              React.createElement('img', {
                className: 'dsh-glass-wall-swatch',
                src: `/api/dsh-glass-skin/assets?f=wallpapers/${encodeURIComponent(entry.file)}`,
                alt: '',
                loading: 'lazy',
                decoding: 'async',
              }),
              React.createElement('span', { className: 'dsh-glass-wall-name' }, entry.file.replace(/\.[^.]+$/, '')),
            )),
          ),
          React.createElement(
            'div',
            { className: 'dsh-glass-wall-foot' },
            React.createElement(
              'p',
              { className: 'dsh-glass-note' },
              '拖入图片，或点「导入图片」；也可以放进 ~/.dsh/dsh-glass-skin/wallpapers/ 后刷新。',
            ),
            React.createElement(
              'label',
              { className: 'dsh-glass-refresh', title: '导入 jpg / png / webp 图片' },
              uploading ? '导入中…' : '导入图片',
              React.createElement('input', {
                type: 'file',
                accept: 'image/jpeg,image/png,image/webp',
                style: { display: 'none' },
                disabled: uploading,
                onChange: (event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = '';
                  if (file !== null) void importWallpaper(file);
                },
              }),
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'dsh-glass-refresh',
                onClick: () => setWallsNonce((nonce) => nonce + 1),
              },
              '刷新',
            ),
          ),
          uploadNote === ''
            ? null
            : React.createElement(
                'p',
                { className: `dsh-glass-note ${uploadOk === false ? 'dsh-glass-wall-error' : 'dsh-glass-wall-info'}` },
                uploadNote,
              ),
          React.createElement(
            'p',
            { className: 'dsh-glass-note dsh-glass-wall-info' },
            wallpaper === ''
              ? '当前：内置壁纸（默认）。'
              : wallpaperInfo === null
                ? `当前：${wallpaper} · 像素分析暂时不可用，不影响使用。`
                : `当前：${wallpaper} · 亮度 ${wallpaperInfo.luminance}/255 · 对比 ${wallpaperInfo.contrast} · ${
                    wallpaperInfo.tone === 'bright'
                      ? '画面偏亮，建议用「标准」或「沉静」让正文更稳。'
                      : wallpaperInfo.tone === 'dark'
                        ? '画面偏暗，清透/标准都稳；沉静会更沉。'
                        : '亮度适中，三种场景都可以。'
                  }`,
          ),
          wallsError
            ? React.createElement(
                'p',
                { className: 'dsh-glass-note dsh-glass-wall-error' },
                '壁纸目录暂时读不到，点刷新重试。',
              )
            : null,
        ),
        React.createElement(
          'div',
          { className: 'dsh-glass-scene' },
          React.createElement(
            'div',
            { className: 'dsh-glass-scene-text' },
            React.createElement('span', { className: 'dsh-glass-scene-title' }, '窗口玻璃'),
            React.createElement(
              'span',
              { className: 'dsh-glass-scene-desc' },
              '本主题始终使用通透顶栏与侧栏，不受系统“减少透明效果”压黑；不修改系统设置。',
            ),
          ),
          React.createElement(
            'div',
            { className: 'dsh-glass-seg', role: 'radiogroup', 'aria-label': '窗口玻璃' },
            ...[{ value: 'glass', label: '通透玻璃' }].map((option) => React.createElement(
              'button',
              {
                key: option.value,
                type: 'button',
                role: 'radio',
                'aria-checked': transparency === option.value,
                className: `dsh-glass-seg-btn${transparency === option.value ? ' is-selected' : ''}`,
                onClick: () => setTransparency(option.value),
              },
              option.label,
            )),
          ),
        ),
        React.createElement(
          'div',
          { className: 'dsh-glass-specimen' },
          React.createElement(
            'span',
            { className: 'dsh-glass-specimen-label' },
            '阅读标尺 · 随你的字号设置变化',
          ),
          React.createElement(
            'p',
            { className: 'dsh-glass-specimen-body' },
            '正文比你设置的界面字号高两档，行距 1.8，标题按 22 / 20 / 18 / 17 逐级收窄。',
            React.createElement('strong', null, '字大一点，每行字就少一点'),
            '，长回答读起来才不费眼。',
          ),
        ),
        React.createElement(
          'details',
          { className: 'dsh-glass-more' },
          React.createElement('summary', { className: 'dsh-glass-more-summary' }, '设计说明与诊断'),
          React.createElement(
            'div',
            { className: 'dsh-glass-more-body' },
            diag !== null && diag.shell
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(
                    'div',
                    { className: 'dsh-glass-diag-head' },
                    React.createElement(
                      'p',
                      { className: 'dsh-glass-note dsh-glass-diag' },
                      `宿主钩子：必需 ${requiredOk}/${requiredHooks.length} 命中${requiredBlind > 0 ? ` · ${requiredBlind} 项在设置页不可见` : ''} · 可观测 ${optionalOk}/${optionalHooks.length} 出现`,
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'dsh-glass-refresh',
                        onClick: copyReport,
                      },
                      copyState || '复制报告',
                    ),
                  ),
                  React.createElement(
                    'div',
                    { className: 'dsh-glass-hooks' },
                    ...hooks.map((hook) => React.createElement(
                      'span',
                      {
                        key: hook.key,
                        className: `dsh-glass-hook is-${hook.found ? 'ok' : hook.blind ? 'blind' : hook.required ? 'missing' : 'idle'}`,
                        title: hook.found
                          ? '命中'
                          : hook.blind
                            ? '设置页中不可见，未验证'
                            : hook.required
                              ? '未命中：宿主可能改了这个选择器'
                              : '当前页面没有这个区域',
                      },
                      `${hook.found ? '✓' : hook.blind ? '?' : hook.required ? '!' : '–'} ${hook.label}`,
                    )),
                  ),
                  React.createElement(
                    'p',
                    { className: 'dsh-glass-note dsh-glass-diag' },
                    `窗口材质：脚本 v${diag.shell.version} · 样式 ${diag.shell.styleVersion || '未命中'} · 模式 ${diag.shell.mode} · 场景 ${diag.shell.scene} · 系统减少透明 ${diag.shell.reduced ? '是' : '否'} · 窗口选择 ${diag.shell.transparency === 'glass' ? '通透玻璃' : '跟随系统'} · 实际遵循减少透明 ${diag.shell.reducedApplied ? '是' : '否'} · 磨砂支持 ${diag.shell.blurSupported ? '是' : '否'} · 侧栏 ${diag.shell.sidebar.found ? '命中' : '未命中'} · 顶栏 ${diag.shell.titlebar.found ? '命中' : '未命中'}（与正文同材质）`,
                  ),
                  React.createElement(
                    'pre',
                    { className: 'dsh-glass-note dsh-glass-diag', style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 'inherit' } },
                    JSON.stringify(diag.shell, null, 2),
                  ),
                )
              : null,
            diag !== null
              ? React.createElement(
                  'p',
                  { className: 'dsh-glass-note dsh-glass-diag' },
                  `诊断：卡片${diag.card ? '✓' : '✗'} · 材质 ${diag.card ? diag.computed : '未命中'} · 窗口源 ${diag.origin}${diag.card ? '' : '（设置页打开时输入框不在页面上，这一行反映的是打开设置之前的状态）'}`,
                )
              : null,
            React.createElement(
              'div',
              { className: 'dsh-glass-swatches', 'aria-label': '色板' },
              React.createElement(Swatch, { name: '冰蓝 · 交互', tone: 'var(--dsw-alias-brand-primary)' }),
              React.createElement(Swatch, { name: '琥珀 · 环境', tone: 'var(--dsh-glass-skin-ember)' }),
              React.createElement(Swatch, { name: '成功', tone: 'var(--dsw-alias-state-success-primary)' }),
              React.createElement(Swatch, { name: '警告', tone: 'var(--dsw-alias-state-warn-primary)' }),
              React.createElement(Swatch, { name: '失败', tone: 'var(--dsw-alias-state-error-primary)' }),
            ),
            React.createElement(
              'dl',
              { className: 'dsh-glass-rules' },
              React.createElement(Rule, {
                term: '三层材质',
                text: '环境层是壁纸与光；工作层半透明、能感到背景；操作层（输入框、菜单、弹窗）底色更实。',
              }),
              React.createElement(Rule, {
                term: '冷暖分工',
                text: '冰蓝负责选中、链接与焦点；暖琥珀只做环境光与少量装饰，不承担任何状态含义。',
              }),
              React.createElement(Rule, {
                term: '行宽锁定',
                text: '正文列宽固定为 44 个字，不再随窗口变宽；输入框自动跟住同一列。',
              }),
              React.createElement(Rule, {
                term: '冷墨投影',
                text: '阴影取自冷墨色而非纯黑；深色界面改用细边缘，避免投影在暗玻璃上消失。',
              }),
            ),
          ),
        ),
        React.createElement(
          'p',
          { className: 'dsh-glass-note' },
          '模式、场景浓度与玻璃材质都会记住。阅读标尺跟随「外观」里的字号设置，不覆盖它。',
        ),
      );
    }

    /* A render-time mistake in this panel used to leave the settings page blank:
       the host's SlotErrorBoundary draws an empty div, which reads as "the
       section vanished". Keep the theme running and show the error instead. The
       smoke harness has no React.Component, so it mounts the plain section. */
    let SettingsSection = GlassSection;
    if (React !== null && typeof React.Component === 'function') {
      class GlassErrorBoundary extends React.Component {
        constructor(props) {
          super(props);
          this.state = { error: null };
        }

        static getDerivedStateFromError(error) {
          return { error };
        }

        componentDidCatch(error, info) {
          console.error('[dsh-glass-skin] settings panel failed', error, info);
        }

        render() {
          if (this.state.error !== null) {
            return React.createElement(
              'section',
              { className: 'dsh-glass-section', 'aria-label': '玻璃肌肤' },
              React.createElement(
                'header',
                { className: 'dsh-glass-head' },
                React.createElement('h2', null, '玻璃肌肤'),
                React.createElement(
                  'p',
                  null,
                  '设置面板渲染失败。主题本身仍在运行；把下面这行发给维护者即可定位。',
                ),
              ),
              React.createElement(
                'p',
                { className: 'dsh-glass-note dsh-glass-wall-error' },
                String(this.state.error?.message ?? this.state.error),
              ),
            );
          }
          return this.props.children;
        }
      }
      SettingsSection = function GlassSettings() {
        return React.createElement(
          GlassErrorBoundary,
          null,
          React.createElement(GlassSection, null),
        );
      };
    }

    /* Copy for the scene stops. The description follows the current stop, so the
       row explains what the user just chose instead of listing three essays. */
    const SCENE_OPTIONS = [
      { value: 'clear', title: '清透', desc: '壁纸清晰可辨，正文压在一层稳定的阅读纱上。' },
      { value: 'balanced', title: '标准', desc: '一层薄纱盖住画面，场景还在，底色更稳。' },
      { value: 'quiet', title: '沉静', desc: '壁纸退成背景色，适合长时间读长文与表格。' },
    ];

    function apply(ctx) {
      const preferenceGeneration = ++hostStateGeneration;
      touchedKeys.clear();
      currentMode = readMode();
      currentScene = readScene();
      currentTransparency = readTransparency();
      paintTransparency(currentTransparency);
      ctx.effect(() => () => {
        if (hostStateGeneration !== preferenceGeneration) return;
        hostStateGeneration += 1;
        if (document.body !== null) delete document.body.dataset.dshGlassTransparency;
        transparencyListeners.clear();
      }, 'dsh-glass-skin: window material preference');
      console.info?.(`[dsh-glass-skin] v${VERSION} applied`);
      themeService = typeof ctx.theme?.overrideTokens === 'function'
        ? ctx.theme
        : ctx.get?.('theme') ?? null;

      // Mirror the scheme before the first paint, then follow every change.
      paintScheme();
      ctx.effect(() => {
        const onTheme = (snapshot) => paintScheme(snapshot);
        const dispose = ctx.on?.('theme/change', onTheme);
        return () => {
          if (typeof dispose === 'function') dispose();
        };
      }, 'dsh-glass-skin: scheme mirror');

      // Paint before the effect so the first frame already has the right field.
      paintScene(currentScene);
      paintMode(currentMode);
      paintWallpaper(readWallpaper());

      paintGlass();
      void adoptHostState();
      ctx.effect(() => () => {
        if (disposeSceneTokens !== null) {
          disposeSceneTokens();
          disposeSceneTokens = null;
        }
      }, 'dsh-glass-skin: scene token teardown');

      if (themeService !== null) {
        ctx.effect(() => () => {
          disposeTokens?.();
          disposeTokens = null;
        }, 'dsh-glass-skin: theme token layer');
      } else {
        console.warn('[dsh-glass-skin] theme service unavailable; wallpaper only');
      }

      ctx.effect(() => {
        const generation = ++styleGeneration;
        const style = applyStyle();
        return () => {
          // A re-apply superseded this effect; the node now belongs to the newer
          // generation and must survive this cleanup.
          if (generation !== styleGeneration) return;
          style.remove();
          if (styleNode === style) styleNode = null;
        };
      }, 'dsh-glass-skin: scene + reading scale stylesheet');

      ctx.effect(() => {
        const onStorage = (event) => {
          if (event.key === TRANSPARENCY_KEY) {
            touchedKeys.add('transparency');
            const value = readTransparency();
            if (value !== currentTransparency) {
              paintTransparency(value);
              emitTransparency();
            }
            return;
          }
          if (event.key === SCENE_KEY) {
            const nextScene = readScene();
            if (nextScene === currentScene) return;
            paintScene(nextScene);
            emitScene();
            return;
          }
          if (event.key === WALLPAPER_KEY) {
            const nextWallpaper = readWallpaper();
            if (nextWallpaper === currentWallpaper) return;
            paintWallpaper(nextWallpaper);
            return;
          }
          if (event.key !== MODE_KEY) return;
          const next = readMode();
          if (next === currentMode) return;
          paintMode(next);
          emitMode();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
      }, 'dsh-glass-skin: mode storage sync');

      if (React !== null && ctx.slots !== undefined) {
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'glass-skin',
          order: 46,
          label: () => '玻璃肌肤',
        }, SettingsSection));
      }
    }

    return { inject: ['theme', 'slots'], apply };
  },
});


