// Structural regression checks, NOT browser rendering or contrast evidence.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';

// Host tests write a real preference file. Point DSH_HOME at a throw-away
// directory before index.js is imported, so a test can never touch the user's
// actual ~/.dsh/dsh-glass-skin.json.
const testHome = mkdtempSync(path.join(tmpdir(), 'dsh-glass-skin-test-'));
process.env.DSH_HOME = testHome;
after(() => {
  rmSync(testHome, { recursive: true, force: true });
});

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const start = source.indexOf('const CSS = `');
const end = source.lastIndexOf('`;');
const css = source.slice(start + 'const CSS = `'.length, end)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  // Resolve the literal substitutions before parsing CSS rule braces.
  .replaceAll('${VERSION}', manifest.version)
  .replaceAll('${WALLPAPER_DEFAULT_URL}', '/api/dsh-glass-skin/assets?f=wallpaper.jpg')
  .replaceAll('${WALLPAPER}', '/api/dsh-glass-skin/assets?f=wallpaper.jpg');
function rule(selector) {
  const at = css.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `missing rule: ${selector}`);
  return css.slice(at + selector.length + 2, css.indexOf('}', at));
}

test('client marker, stylesheet marker and package version agree', () => {
  assert.ok(source.includes(`const VERSION = '${manifest.version}'`));
  assert.ok(css.includes(`--dsh-glass-style-version: "${manifest.version}";`));
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
});

test('scene planes are explicitly ordered without filtering fixed-control ancestors', () => {
  assert.match(rule('html body'), /position:\s*relative/);
  assert.match(rule('html body'), /z-index:\s*0/);
  assert.doesNotMatch(rule('html body'), /(?:backdrop-filter|\bfilter|\btransform|\bcontain|\bisolation)\s*:/);
  assert.match(rule('body::before'), /z-index:\s*-2/);
  assert.match(rule('body::after'), /z-index:\s*-1/);
});

test('the title bar is the page material, not a frosted cap', () => {
  const band = rule('html[data-windows-titlebar] .BynINW_frame:before');
  // 4.9.7: exactly the stack .BynINW_centerCol and the sidebar paint.
  assert.match(band, /linear-gradient\(var\(--dsw-alias-bg-base\), var\(--dsw-alias-bg-base\)\),\s*var\(--dsw-specific-sidebar-fill\)/);
  assert.match(band, /backdrop-filter:\s*none/);
  assert.match(band, /box-shadow:\s*none/);
  assert.doesNotMatch(band, /url\(|\bopacity\s*:|shell-/);
  // The shell layer is gone, not merely hidden: no rule may declare it again.
  assert.doesNotMatch(source, /--dsh-glass-shell-(?:fill|edge|cool|warm|top|blur|rim)/);
});

test('the session list no longer paints a bottom fade over the last row', () => {
  // 4.9.8: the host fades the list into --dsw-specific-sidebar-fill, which this
  // skin redefines as the ink used over the photograph. On a transparent pane
  // that is a second coat, not a surface, and it reads as a stray shadow on the
  // last visible row. The fade is removed rather than recoloured.
  const fade = rule('html ._9lTDKa_fade');
  assert.match(fade, /display:\s*none/);
  assert.doesNotMatch(css, /linear-gradient\(to bottom, transparent, var\(--dsw-specific-sidebar-fill\)\)/);
});

test('Windows shell and sidebar content do not add duplicate coats', () => {
  assert.match(rule('html[data-windows-titlebar] .BynINW_frame'), /background:\s*transparent/);
  assert.match(rule('html .BynINW_sidebarCol'), /background:\s*transparent/);
  assert.match(rule('html .BynINW_sidebarCol ._2H3hWW_root'), /background:\s*transparent/);
  assert.match(rule('html[data-platform="darwin"] .BynINW_sidebarCol,\nhtml[data-platform="darwin"] body[data-ds-dark-theme] .BynINW_sidebarCol'), /background:\s*transparent/);
});

test('transcript retains original center-over-frame colour compositing order', () => {
  assert.match(rule('html[data-windows-titlebar] .BynINW_centerCol'), /linear-gradient\(var\(--dsw-alias-bg-base\), var\(--dsw-alias-bg-base\)\),\s*var\(--dsw-specific-sidebar-fill\)/);
  // The host's 16px top-left notch would re-cut the split into two cards.
  assert.match(rule('html[data-windows-titlebar] .BynINW_centerCol'), /border-top-left-radius:\s*0/);
});

test('fixed-position sidebar controls never acquire a filtered ancestor', () => {
  for (const selector of ['html .BynINW_sidebarCol', 'html .BynINW_sidebarCol ._2H3hWW_root', 'html[data-windows-titlebar] .BynINW_frame']) {
    assert.doesNotMatch(rule(selector), /(?:backdrop-filter|\bfilter|\btransform|\bcontain|\bwill-change)\s*:/);
  }
  assert.match(rule('html .BynINW_sidebarCol::before'), /pointer-events:\s*none/);
  assert.match(rule('html .BynINW_sidebarCol::before'), /z-index:\s*-1/);
});

test('the sidebar is the transcript material and the split has no border', () => {
  const side = rule('html .BynINW_sidebarCol::before');
  assert.match(side, /linear-gradient\(var\(--dsw-alias-bg-base\), var\(--dsw-alias-bg-base\)\),\s*var\(--dsw-specific-sidebar-fill\)/);
  assert.match(side, /backdrop-filter:\s*none/);
  assert.match(side, /box-shadow:\s*none/);
  assert.doesNotMatch(side, /url\(|\bopacity\s*:/);
  // No divider on the split: the border and the old rim were the seam.
  assert.match(rule('html .BynINW_sidebarCol'), /border-right:\s*none/);
});

test('window preference is independent, persisted, validated and cleaned up', () => {
  const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  // 4.9.4: "follow system" is gone; the array carries one value and old saves
  // fold back to glass through the same `includes` check.
  assert.match(source, /const TRANSPARENCIES = \['glass'\]/);
  assert.match(source, /function readTransparency\(\)[\s\S]*?stored : 'glass'/);
  assert.match(source, /document\.body\.dataset\.dshGlassTransparency = value/);
  assert.match(source, /delete document\.body\.dataset\.dshGlassTransparency/);
  assert.match(source, /pushHostState\(\{ transparency: value \}\)/);
  assert.match(source, /TRANSPARENCIES\.includes\(state\.transparency\)/);
  assert.match(source, /event\.key === TRANSPARENCY_KEY/);
  assert.match(host, /'scene', 'transparency'/);
  assert.match(host, /key === 'transparency' && value === 'glass'/);
  const unsupportedStart = css.indexOf('@supports not ((backdrop-filter:');
  const unsupported = css.slice(unsupportedStart, css.indexOf('\n}', unsupportedStart) + 2);
  assert.doesNotMatch(unsupported, /dsh-glass-transparency/);
});

test('the no-backdrop fallback carries the seats, and no OS branch resurrects a coat', () => {
  const at = css.indexOf('@supports not ((backdrop-filter:');
  assert.notEqual(at, -1);
  let depth = 0;
  let end = at;
  for (let i = at; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  const unsupported = css.slice(at, end);
  assert.match(unsupported, /--dsw-specific-bubble:\s*rgba\(255, 255, 255, 0\.92\)/);
  assert.match(unsupported, /--dsw-specific-bubble:\s*rgba\(24, 39, 57, 0\.90\)/);
  assert.match(unsupported, /--dsw-alias-markdown-code-block:\s*rgba\(241, 247, 252, 0\.95\)/);
  assert.doesNotMatch(unsupported, /--dsh-glass-shell-/);
  // The shell layer is deleted, so there is no reduced-transparency branch for
  // it to re-enter through: the scene token owns the page's weight alone.
  assert.doesNotMatch(css, /prefers-reduced-transparency/);
});

// ── 4.8 · one background, four material weights ─────────────────────────────
// These are still structural checks. They pin the *design decisions* (a ladder
// of fills, solid text, no near-black patch), not the pixels: only a real
// screen can answer "is this pleasant".
function block(selector) {
  const at = css.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `missing rule: ${selector}`);
  let depth = 0;
  for (let i = at + selector.length; i < css.length; i++) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(at, i + 1);
    }
  }
  throw new Error(`unbalanced rule: ${selector}`);
}

function token(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`'${escaped}': \\{ light: '([^']+)', dark: '([^']+)' \\}`).exec(source);
  assert.ok(m, `missing token: ${name}`);
  return { light: m[1], dark: m[2] };
}

function rgba(value) {
  const m = /rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(value);
  assert.ok(m, `not an rgba() colour: ${value}`);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: Number(m[4]) };
}

const mean = (c) => (c.r + c.g + c.b) / 3;

test('the user message is tinted glass over the scene, not a heavy plate', () => {
  const bubble = rgba(token('--dsw-specific-bubble').dark);
  const bubbleLight = rgba(token('--dsw-specific-bubble').light);
  assert.ok(bubble.a < 0.7, `dark bubble alpha ${bubble.a} still reads as a slab`);
  assert.ok(bubbleLight.a < 0.8, `light bubble alpha ${bubbleLight.a} still reads as a slab`);
  const rule_ = block('html body .cJsG2q_bubble');
  assert.match(rule_, /linear-gradient\(135deg/);
  assert.match(rule_, /inset 0 1px 0/);
  assert.match(rule_, /inset 0 0 0 0\.5px/);
  assert.match(rule_, /backdrop-filter:\s*blur\(/);
  // Text keeps its own solid colour: never dim the container to fake depth.
  assert.doesNotMatch(rule_, /\bopacity\s*:/);
  assert.match(rule_, /color:\s*var\(--dsw-alias-label-primary\)/);
});

test('the code block is cool slate, and the banner shares its fill', () => {
  const surface = rgba(token('--dsw-alias-markdown-code-block').dark);
  const banner = rgba(token('--dsw-alias-markdown-code-block-banner').dark);
  assert.ok(mean(surface) >= 26, `code block mean ${mean(surface)} is still a near-black patch`);
  // 4.9.2 retired the "banner is a second, more opaque plate" model: one surface
  // has one opacity. The banner is told apart by its own hairline and by the
  // backdrop blur that keeps scrolling code from showing through it.
  assert.deepEqual(banner, surface, 'banner must reuse the block fill, not stack another coat');

  const codeBlock = block('html body .md-code-block');
  assert.match(codeBlock, /inset 0 0 0 0\.5px var\(--dsw-alias-border-l2\)/);
  assert.match(codeBlock, /inset 0 1px 0/);
  // Horizontal scrolling belongs to the host; the skin must not clip it.
  assert.doesNotMatch(codeBlock, /overflow/);

  const bannerRule = block('html body .md-code-block [data-code-block-banner]');
  // 4.9.2: the banner paints nothing of its own; it blurs the code that scrolls
  // under it instead of putting a second, darker plate on the block.
  assert.match(bannerRule, /background:\s*transparent/);
  assert.match(bannerRule, /backdrop-filter:\s*blur\(/);
  const label = block('html body .md-code-block [data-code-block-banner] > span');
  assert.match(label, /color:\s*var\(--dsw-alias-label-tertiary\)/);
  const copy = block('html body .md-code-block [data-code-block-banner] button');
  assert.match(copy, /color:\s*var\(--dsw-alias-label-secondary\)/);
});

test('the dialog scrim actually blurs the scene behind it', () => {
  const mask = token('--dsw-mask-blur');
  assert.match(mask.light, /blur\(/);
  assert.match(mask.dark, /blur\(/);
  assert.notEqual(mask.dark.trim(), 'none');
  const dialog = block('html body [role="dialog"]:not([data-team-panel])');
  assert.match(dialog, /backdrop-filter:\s*blur\(/);
  assert.match(dialog, /inset 0 0 0 0\.5px/);
});

test('the agent-team popover is one operating surface, not a dialog inside a menu', () => {
  // The roster panel carries role="dialog" but is portal'd as a popover and
  // owns its own material layer. The generic dialog fill used to paint
  // underneath it, stacking 0.62 under 0.78 (a 0.92 plate) and blurring the
  // same backdrop twice.
  assert.match(css, /\[role="dialog"\]:not\(\[data-team-panel\]\) \{/);
  assert.doesNotMatch(css, /html body \[role="dialog"\] \{\n/);

  const panel = block('html body [data-team-panel]::before');
  // Area sets the radius (4.9.5): this panel reaches 500x680, so the 24px menu
  // value would flatten the photograph into a uniform field.
  assert.match(panel, /blur\(6px\) saturate\(155%\)/);
  assert.doesNotMatch(panel, /blur\(24px\)/);
  assert.match(panel, /linear-gradient\(180deg/);
  assert.match(panel, /linear-gradient\(135deg/);
  assert.match(panel, /inset 0 1px 0/);
  assert.match(panel, /inset 0 0 0 0\.5px/);

  // Rows and task cards are one tint on that glass. The host's layer-2 fill at
  // 0.68 over 0.78 made them 0.93 cards — a hole in the material, not a height.
  const rows = block('html body [data-team-panel] button[class*="member"],\nhtml body [data-team-panel] article[class*="task"]');
  assert.match(rows, /background:\s*var\(--dsh-glass-team-card\)/);
  assert.doesNotMatch(rows, /--dsw-alias-bg-layer-2/);
  assert.match(block('html body [data-team-panel]'), /--dsh-glass-team-card:\s*rgba\(174, 205, 228, 0\.09\)/);
  assert.match(block('html[data-dsh-glass-scheme="light"] body [data-team-panel]'), /rgba\(255, 255, 255, 0\.64\)/);
});

test('the task card separates title, counts and body, and wraps long items', () => {
  const card = block('html body [data-testid="todo-panel"]');
  assert.match(card, /color-mix\(in srgb, var\(--dsw-specific-menu\) 72%, transparent\)/);
  assert.match(card, /backdrop-filter:\s*blur\(/);

  const wrap = block('html body [data-testid="todo-panel"] li[data-status] > span:last-child');
  assert.match(wrap, /white-space:\s*normal/);
  assert.match(wrap, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(wrap, /text-overflow:\s*ellipsis/);

  assert.match(css, /li\[data-status="in_progress"\] > span:first-child \{\s*color: var\(--dsw-alias-brand-primary\)/);
  assert.match(css, /li\[data-status="completed"\] > span:last-child \{\s*color: var\(--dsw-alias-label-tertiary\)/);
  assert.match(css, /li\[data-status="pending"\] > span:last-child \{\s*color: var\(--dsw-alias-label-secondary\)/);
});

test('the account menu shares one grid and keeps sign-out quiet until hover', () => {
  const item = block('html body [data-menu-material] [role="menuitem"]');
  assert.match(item, /display:\s*flex/);
  assert.match(item, /gap:\s*10px/);
  // A label-only row must not be squeezed into a fixed icon track.
  assert.doesNotMatch(item, /grid-template-columns/);
  const icon = block('html body [data-menu-material] [role="menuitem"] > span:first-child:has(svg)');
  assert.match(icon, /width:\s*16px/);
  const shortcut = block('html body [data-menu-material] [role="menuitem"] > span[aria-hidden="true"]');
  assert.match(shortcut, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /\[data-menu-material\] \[role="separator"\] \{/);
  const quiet = block('html body [data-menu-material] [role="menuitem"][class*="danger"]');
  assert.match(quiet, /color:\s*var\(--dsw-alias-label-secondary\)/);
  assert.match(css, /\[class\*="danger"\]:hover:not\(:disabled\),?[\s\S]{0,120}?color: var\(--dsw-alias-state-error-primary\)/);
});

test('menu glass carries its own lit edge, not a shadow hidden under the material', () => {
  const surface = block('html body [data-menu-material]');
  assert.match(surface, /box-shadow:\s*var\(--dsw-elevation-prominent\)/);
  assert.doesNotMatch(surface, /inset 0 1px 0/);
  const material = block('html body [data-menu-material] > [aria-hidden="true"]:first-child');
  assert.match(material, /linear-gradient\(180deg/);
  assert.match(material, /linear-gradient\(135deg/);
  assert.match(material, /inset 0 1px 0/);
  assert.match(material, /inset 0 0 0 0\.5px/);
  const fill = rgba(token('--dsw-menu-surface-fill').dark);
  assert.ok(fill.a <= 0.86, `menu fill ${fill.a} is back to a plate`);
});

test('"new session" is centred, ice-tinted and quiet until hover', () => {
  const button = block('html ._2H3hWW_newSession');
  assert.match(button, /justify-content:\s*center/);
  assert.match(button, /--dsh-glass-skin-frost/);
  assert.match(button, /inset 0 1px 0/);
  assert.match(button, /inset 0 0 0 0\.5px/);
  assert.match(css, /html \._2H3hWW_newSession:hover \{/);
});

test('the send key wears the same glass recipe as the + control', () => {
  // 4.9.10: 4.9.9 only recoloured the send key; it stayed a solid disc. The
  // missing piece was the material, so the key now shares the + control's
  // rule instead of carrying a recipe of its own.
  const shared = 'html body [data-composer-card] .RlGAzG_add,\nhtml body [data-composer-card] .RlGAzG_primary';
  const rule_ = block(shared);
  assert.match(rule_, /linear-gradient\(135deg/);
  assert.match(rule_, /var\(--dsw-specific-input-major\)/);
  assert.match(rule_, /inset 0 1px 0/);
  assert.match(rule_, /inset 0 0 0 0\.5px/);
  assert.match(rule_, /color:\s*var\(--dsw-alias-label-primary\)/);
  // No separate solid rule may reintroduce a flat disc.
  assert.doesNotMatch(css, /html body \.RlGAzG_primary \{/);
  // The info token stays mapped so no host brand blue can leak from a fill.
  assert.deepEqual(token('--dsw-alias-button-info-fill'), token('--dsw-alias-button-primary-fill'));
});

// 4.9.4: Windows paints the caption region as one rectangle and drops alpha —
// a capture proved rgba(83,89,106,.94) arrived as rgb(83,89,106) with no blend
// against the bar behind it. A fully transparent value is the one input that
// paints nothing, so the three glyphs sit on the bar's own glass. Both schemes
// must ship transparency; the old flat plate must not come back.
test('the native caption region is handed nothing to paint', () => {
  const plate = block('body > span[style*="--dsw-specific-sidebar-fill"]');
  assert.match(plate, /--dsw-specific-sidebar-fill:\s*rgba\(0, 0, 0, 0\)/);
  assert.match(plate, /--dsw-alias-label-primary:\s*#f2f8ff/);
  const light = block('html[data-dsh-glass-scheme="light"] body > span[style*="--dsw-specific-sidebar-fill"]');
  assert.match(light, /--dsw-specific-sidebar-fill:\s*rgba\(0, 0, 0, 0\)/);
  assert.match(light, /--dsw-alias-label-primary:\s*#0d1b26/);
  assert.doesNotMatch(css, /83, 89, 106/);
  assert.doesNotMatch(css, /160, 166, 181/);
});

// ── 4.9.11 · stability: the material may not be rebuilt at runtime ───────────
// A backdrop filter that is re-created (async image decode, region rewrites,
// remounts) is painted unfiltered for a frame — on screen that is the card
// flickering between clear and frosted. These checks pin the shape of the fix,
// not the pixels: the CSS must own the whole material.
test('the composer glass is one static CSS filter, never an SVG chain', () => {
  // Comments explain the retired chain by name; only executable code counts.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const glassCard = block('body[data-dsh-glass-glass="on"] [data-composer-card]');
  assert.match(glassCard, /backdrop-filter:\s*blur\(10px\) saturate\(180%\)/);
  assert.doesNotMatch(glassCard, /url\(/);
  // 5.1: the only SVG left is a *static* data-URI filter on a child pseudo.
  // It is resolved from the stylesheet, so no observer, poll or mount can
  // detach it; `backdrop-filter` itself still never takes a url().
  assert.doesNotMatch(code, /feImage|buildDisplacementMap/);
  assert.equal((code.match(/feDisplacementMap/g) || []).length, 1);
  assert.match(code, /url\("data:image\/svg\+xml,[^"]*feDisplacementMap/);
  assert.doesNotMatch(code, /<animate/);
  // The SVG machinery, its resize observer and its 1.2s remount poll are gone.
  assert.doesNotMatch(code, /GLASS_FILTER_ID|attachGlass|mountGlass|teardownGlass|glassFrame|glassRetry/);
  assert.doesNotMatch(code, /setInterval/);
});

test('5.1 liquid glass is static noise plus one registered sweep', () => {
  assert.match(css, /@property --dsh-glass-liquid-x\s*\{\s*syntax:\s*'<percentage>';/);
  // Both glass layers are negative-z children: above the card fill, under text.
  const shared = block('body[data-dsh-glass-glass="on"] [data-composer-card]::before,\nbody[data-dsh-glass-glass="on"] [data-composer-card]::after');
  assert.match(shared, /z-index:\s*-1/);
  assert.match(shared, /pointer-events:\s*none/);
  const before = rule('body[data-dsh-glass-glass="on"] [data-composer-card]::before');
  assert.match(before, /filter:\s*url\("data:image\/svg\+xml/);
  assert.match(css, /\[data-composer-card\]::after\s*\{[^}]*background-position:\s*var\(--dsh-glass-liquid-x\)/);
  assert.match(css, /\[data-composer-card\]::after\s*\{[^}]*animation:\s*dsh-glass-liquid-sweep/);
  assert.match(css, /@keyframes dsh-glass-liquid-sweep/);
  // Reduced motion stops the sweep; the static refraction layer stays.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,160}\[data-composer-card\]::after \{ animation: none; \}/);
});

test('no backdrop-filter anywhere resolves through url()', () => {
  const values = [...css.matchAll(/(?:-webkit-)?backdrop-filter:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(values.length >= 6, `only ${values.length} backdrop declarations found`);
  for (const value of values) assert.doesNotMatch(value, /url\(/, `backdrop-filter: ${value}`);
});

test('the stylesheet is rewritten in place, never removed and re-added', () => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // Removing the <style> node and appending a new one leaves one frame with no
  // skin: every frosted surface goes clear and comes back.
  assert.match(code, /styleNode !== null && styleNode\.isConnected/);
  assert.match(code, /if \(generation !== styleGeneration\) return;/);
});

// ── 5.0 · freeze: the wallpaper is the only swappable input ─────────────────
test('the wallpaper is the only image the theme injects', () => {
  const body = rule('html body');
  assert.match(body, /--dsh-glass-wallpaper:\s*url\("\/api\/dsh-glass-skin\/assets\?f=wallpaper\.jpg"\)/);
  const scene = block('body::before');
  assert.match(scene, /var\(--dsh-glass-wallpaper\)/);
  const dark = block('html[data-dsh-glass-scheme="dark"] body::before,\nbody[data-ds-dark-theme]::before');
  assert.match(dark, /var\(--dsh-glass-wallpaper\)/);
  // Exactly one *image* URL in the whole sheet: the default wallpaper. The 5.1
  // refraction filter is a data:image/svg+xml URL resolved by the engine, not a
  // fetched picture, so it is counted separately and pinned to one.
  const urls = [...css.matchAll(/url\("([^"]*)"\)/g)].map((m) => m[1]);
  const images = urls.filter((u) => !u.startsWith('data:image/svg+xml'));
  assert.deepEqual(images, ['/api/dsh-glass-skin/assets?f=wallpaper.jpg']);
  assert.equal(urls.filter((u) => u.startsWith('data:image/svg+xml')).length, 1);
});

test('a wallpaper swap is one custom property, never a rebuilt material', () => {
  assert.match(source, /const WALLPAPER_KEY = 'dsh-glass-skin:wallpaper'/);
  assert.match(source, /style\.setProperty\('--dsh-glass-wallpaper'/);
  assert.match(source, /pushHostState\(\{ wallpaper: file \}\)/);
  // Swap after decode, fall back to the packaged image on error.
  assert.match(source, /probe\.onload = \(\) => finish\(true, analyzeWallpaperImage\(probe\)\)/);
  assert.match(source, /probe\.onerror = \(\) => finish\(false\)/);
});

test('a wallpaper swap cannot race an older decode or keep a dead pointer', () => {
  // Two quick clicks: the first decode may finish last, and must lose.
  assert.match(source, /let wallpaperPaintGeneration = 0/);
  assert.match(source, /generation === wallpaperPaintGeneration/);
  assert.match(source, /const WALLPAPER_DECODE_TIMEOUT = \d+/);
  // A missing file is cleared in the durable copy, not re-adopted on every boot.
  assert.match(source, /pushHostState\(\{ wallpaper: '' \}\)/);
});

test('selecting a wallpaper touches only the wallpaper key', () => {
  const at = source.indexOf('function setWallpaper(value) {');
  assert.notEqual(at, -1, 'setWallpaper not found');
  const end = source.indexOf('\n    }', at);
  const body = source.slice(at, end);
  assert.match(body, /pushHostState\(\{ wallpaper: file \}\)/);
  assert.doesNotMatch(body, /setMode|paintMode|setScene|paintScene|setTransparency|paintTransparency|overrideTokens|dataset/);
});

test('wallpaper names accept any language but never a path', () => {
  assert.match(source, /const WALLPAPER_FILE = .*\/u;/);
  assert.doesNotMatch(source, /\[A-Za-z0-9\]\[A-Za-z0-9\._-\]/);
  const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.match(host, /const WALLPAPER_NAME = .*\/u;/);
  assert.match(host, /\\u0000-\\u001f/);
  assert.match(host, /WALLPAPER_EXT/);
});

test('preferences are written atomically and serialised', () => {
  const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.match(host, /let stateQueue = Promise\.resolve\(\)/);
  assert.match(host, /await handle\.sync\(\)/);
  assert.match(host, /await rename\(temp, file\)/);
  assert.match(host, /\.corrupt-\$\{Date\.now\(\)\}/);
  // A read stream error must not escape as an unhandled 'error' event.
  assert.match(host, /stream\.on\('error'/);
});

test('the settings panel audits host hooks and can copy the report', () => {
  assert.match(source, /const HOOKS = \[/);
  assert.match(source, /function hookHealth\(\)/);
  assert.match(source, /\.BynINW_frame/);
  assert.match(source, /\.BynINW_sidebarCol/);
  assert.match(source, /\[data-composer-card\], \.RlGAzG_card/);
  assert.match(source, /settingsBlind/);
  assert.match(source, /selector: hook\.selector/);
  assert.match(source, /hooks: hookHealth\(\)/);
  assert.match(source, /navigator\.clipboard/);
  assert.match(source, /复制报告/);
});

test('a wallpaper reports luminance and contrast without changing the scene', () => {
  assert.match(source, /function analyzeWallpaperImage\(image\)/);
  assert.match(source, /0\.2126 \* pixels\[index\]/);
  assert.match(source, /currentWallpaperInfo/);
  assert.match(source, /subscribeWallpaperInfo/);
  assert.match(source, /画面偏亮，建议用「标准」或「沉静」/);
  // The hint is advice; the wallpaper path still cannot call a scene setter.
  const at = source.indexOf('function setWallpaper(value) {');
  const end = source.indexOf('\n    }', at);
  assert.doesNotMatch(source.slice(at, end), /setScene|paintScene/);
});

test('wallpaper import validates bytes, size and names', () => {
  const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.match(host, /const MAX_UPLOAD_BYTES = \d+ \* 1024 \* 1024/);
  assert.match(host, /function detectImageExt\(buffer\)/);
  assert.match(host, /function safeUploadName\(value, ext\)/);
  assert.match(host, /if \(req\.method === 'POST'\)/);
  assert.match(host, /x-dsh-glass-name/);
  assert.match(host, /writeFileAtomic\(path\.join\(USER_WALLPAPERS_DIR, file\)/);
  // The client offers a drop surface and a file input.
  assert.match(source, /is-dragging/);
  assert.match(source, /onDrop/);
  assert.match(source, /type: 'file'/);
});

test('the settings panel falls back to an error note instead of a blank slot', () => {
  assert.match(source, /class GlassErrorBoundary extends React\.Component/);
  assert.match(source, /getDerivedStateFromError/);
  assert.match(source, /SettingsSection = function GlassSettings/);
});

test('the host lists and validates real wallpaper files only', () => {
  const host = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.match(host, /'mode', 'scene', 'transparency', 'wallpaper'/);
  assert.match(host, /USER_WALLPAPERS_DIR/);
  assert.match(host, /PACKAGED_WALLPAPERS_DIR/);
  assert.match(host, /'\/api\/dsh-glass-skin\/wallpapers'/);
  // Replacing wallpaper.jpg in place must show on the next reload.
  assert.match(host, /'Cache-Control': 'no-cache'/);
  assert.match(host, /if-none-match/);
});

test('the wallpapers route answers with a JSON list even when the folder is empty', async () => {
  const { apply } = await import('../index.js');
  const routes = new Map();
  const webServer = {
    register: (route) => {
      routes.set(route.path, route.handler);
      return () => {};
    },
  };
  apply({
    inject: (_names, fn) => fn({ get: () => webServer, effect: () => {} }),
    effect: () => {},
    logger: { info: () => {} },
  });
  const handler = routes.get('/api/dsh-glass-skin/wallpapers');
  assert.equal(typeof handler, 'function', 'wallpapers route not registered');
  const res = {
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body ?? ''; },
  };
  await handler({ method: 'GET', url: '/api/dsh-glass-skin/wallpapers' }, res);
  assert.equal(res.status, 200);
  const data = JSON.parse(res.body);
  assert.ok(Array.isArray(data.walls));
  // The folder holds only notes right now; anything listed must be a real image.
  for (const entry of data.walls) assert.match(entry.file, /\.(?:jpe?g|png|webp)$/i);
});

async function mountHost() {
  const { apply } = await import('../index.js');
  const routes = new Map();
  const webServer = {
    register: (route) => {
      routes.set(route.path, route.handler);
      return () => {};
    },
  };
  apply({
    inject: (_names, fn) => fn({ get: () => webServer, effect: () => {} }),
    effect: () => {},
    logger: { info: () => {}, warn: () => {} },
  });
  return routes;
}

function receiver() {
  const chunks = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  sink.status = 0;
  sink.headers = {};
  sink.chunks = chunks;
  sink.writeHead = (status, headers) => {
    sink.status = status;
    sink.headers = headers;
  };
  return sink;
}

async function postJson(handler, body) {
  const sink = receiver();
  const req = {
    method: 'POST',
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(body));
    },
  };
  handler(req, sink);
  await once(sink, 'finish');
  return { status: sink.status, body: JSON.parse(Buffer.concat(sink.chunks).toString('utf8')) };
}

async function postBinary(handler, body, headers = {}) {
  const sink = receiver();
  const req = {
    method: 'POST',
    headers,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body);
    },
  };
  handler(req, sink);
  await once(sink, 'finish');
  return { status: sink.status, body: JSON.parse(Buffer.concat(sink.chunks).toString('utf8')) };
}

// A real 1x1 PNG, so the upload path sees the same signature the browser sends.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

test('the state route accepts only known keys and real wallpapers', async () => {
  const routes = await mountHost();
  const handler = routes.get('/api/dsh-glass-skin/state');
  assert.equal(typeof handler, 'function', 'state route not registered');
  const dir = path.join(testHome, 'dsh-glass-skin', 'wallpapers');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, '冰柜 暖光.jpg'), 'not really a jpeg');

  const result = await postJson(handler, {
    op: 'set',
    patch: {
      mode: 'ambient',
      scene: 'quiet',
      transparency: 'glass',
      wallpaper: '冰柜 暖光.jpg',
      // Removed and unknown keys must not be written back.
      glass: false,
      unscoped: 'x',
    },
  });
  assert.equal(result.status, 200);
  const stored = JSON.parse(readFileSync(path.join(testHome, 'dsh-glass-skin.json'), 'utf8'));
  assert.deepEqual(Object.keys(stored).sort(), ['mode', 'scene', 'transparency', 'wallpaper']);
  assert.equal(stored.wallpaper, '冰柜 暖光.jpg');

  const rejected = await postJson(handler, {
    op: 'set',
    patch: {
      mode: 'nope',
      scene: 'nope',
      transparency: 'system',
      wallpaper: '../../etc/passwd',
    },
  });
  assert.equal(rejected.status, 200);
  const stored2 = JSON.parse(readFileSync(path.join(testHome, 'dsh-glass-skin.json'), 'utf8'));
  assert.equal(stored2.mode, 'ambient');
  assert.equal(stored2.scene, 'quiet');
  assert.equal(stored2.transparency, 'glass');
  assert.equal(stored2.wallpaper, '冰柜 暖光.jpg');
});

test('a user wallpaper is served from the user folder, and traversal is rejected', async () => {
  const routes = await mountHost();
  const handler = routes.get('/api/dsh-glass-skin/assets');
  assert.equal(typeof handler, 'function', 'assets route not registered');
  const dir = path.join(testHome, 'dsh-glass-skin', 'wallpapers');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, '冰柜 暖光.jpg'), 'user-copy');

  const sink = receiver();
  handler({
    method: 'GET',
    url: `/api/dsh-glass-skin/assets?f=${encodeURIComponent('wallpapers/冰柜 暖光.jpg')}`,
    headers: {},
  }, sink);
  await once(sink, 'finish');
  assert.equal(sink.status, 200);
  assert.equal(Buffer.concat(sink.chunks).toString('utf8'), 'user-copy');
  assert.equal(sink.headers['Content-Type'], 'image/jpeg');

  const escaped = receiver();
  handler({
    method: 'GET',
    url: `/api/dsh-glass-skin/assets?f=${encodeURIComponent('wallpapers/../../dsh-glass-skin.json')}`,
    headers: {},
  }, escaped);
  await once(escaped, 'finish');
  assert.equal(escaped.status, 404);
});

test('the wallpapers route reports user images with their source', async () => {
  const routes = await mountHost();
  const handler = routes.get('/api/dsh-glass-skin/wallpapers');
  const dir = path.join(testHome, 'dsh-glass-skin', 'wallpapers');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, '列表测试.png'), 'png');
  const res = receiver();
  handler({ method: 'GET', url: '/api/dsh-glass-skin/wallpapers' }, res);
  await once(res, 'finish');
  assert.equal(res.status, 200);
  const data = JSON.parse(Buffer.concat(res.chunks).toString('utf8'));
  const entry = data.walls.find((wall) => wall.file === '列表测试.png');
  assert.ok(entry, 'user wallpaper missing from the list');
  assert.equal(entry.source, 'user');
});

test('the upload route stores a validated image and sanitises the name', async () => {
  const routes = await mountHost();
  const handler = routes.get('/api/dsh-glass-skin/wallpapers');
  assert.equal(typeof handler, 'function', 'wallpapers route not registered');
  const result = await postBinary(handler, PNG_1X1, {
    'content-type': 'image/png',
    'x-dsh-glass-name': encodeURIComponent('../../导入 测试.png'),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.file, '导入 测试.png');
  const stored = readFileSync(path.join(testHome, 'dsh-glass-skin', 'wallpapers', result.body.file));
  assert.ok(stored.equals(PNG_1X1));
  const list = receiver();
  handler({ method: 'GET', url: '/api/dsh-glass-skin/wallpapers', headers: {} }, list);
  await once(list, 'finish');
  const data = JSON.parse(Buffer.concat(list.chunks).toString('utf8'));
  assert.ok(data.walls.some((wall) => wall.file === result.body.file && wall.source === 'user'));
});

test('the upload route rejects non-images and oversized declarations', async () => {
  const routes = await mountHost();
  const handler = routes.get('/api/dsh-glass-skin/wallpapers');
  const text = await postBinary(handler, Buffer.from('not an image'), {
    'content-type': 'image/png',
    'x-dsh-glass-name': 'fake.png',
  });
  assert.equal(text.status, 415);
  const huge = await postBinary(handler, Buffer.alloc(0), {
    'content-type': 'image/png',
    'content-length': String(33 * 1024 * 1024),
  });
  assert.equal(huge.status, 413);
});

test('a transient disabled state cannot flip the composer between clear and frosted', () => {
  const disabled = block('html body [data-composer-card]:has(.RlGAzG_inputDisabled)');
  // The 96% fill already hides the backdrop; deleting the filter only made the
  // card switch materials when the host briefly disabled the input.
  assert.doesNotMatch(disabled, /backdrop-filter/);
  // The key controls transition only interpolable properties: a gradient cannot
  // be transitioned, so `background` in this list split one hover into two
  // materials a frame apart.
  const key = block('html body [data-composer-card] .RlGAzG_add,\nhtml body [data-composer-card] .RlGAzG_primary');
  const transition = /transition:\s*([^;]+);/.exec(key);
  assert.ok(transition, 'missing transition on the composer keys');
  assert.doesNotMatch(transition[1], /background/);
});

