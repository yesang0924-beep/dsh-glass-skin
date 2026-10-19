// One-time adoption of the data written under the pre-6.0 package name.
// Like the structure suite, this is a behavioural check, not visual evidence.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';

// Point DSH_HOME at a throw-away directory before index.js is imported, so this
// suite can never read or write the user's real ~/.dsh.
const home = mkdtempSync(path.join(tmpdir(), 'dsh-glass-skin-migration-'));
process.env.DSH_HOME = home;
after(() => {
  rmSync(home, { recursive: true, force: true });
});

// A real 1x1 PNG; the migration only copies, but a real file keeps the fixture
// honest about what the picker will later try to decode.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);
const LEGACY_STATE = { mode: 'focus', scene: 'quiet', wallpaper: '旧照片.png' };
const legacyDir = path.join(home, 'dsh-skin-icebox', 'wallpapers');
mkdirSync(legacyDir, { recursive: true });
writeFileSync(path.join(legacyDir, '旧照片.png'), PNG_1X1);
writeFileSync(path.join(home, 'dsh-skin-icebox.json'), JSON.stringify(LEGACY_STATE));

const { apply } = await import('../index.js');

function mount() {
  const routes = new Map();
  apply({
    inject: (_names, fn) => fn({
      get: () => ({
        register: (route) => {
          routes.set(route.path, route.handler);
          return () => {};
        },
      }),
      effect: () => {},
    }),
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
  sink.chunks = chunks;
  sink.writeHead = (status) => { sink.status = status; };
  return sink;
}

test('the pre-6.0 preferences and wallpapers are adopted exactly once', async () => {
  const routes = mount();

  const copiedWallpaper = path.join(home, 'dsh-glass-skin', 'wallpapers', '旧照片.png');
  assert.equal(existsSync(copiedWallpaper), true, 'legacy wallpaper was not copied');
  assert.deepEqual(
    JSON.parse(readFileSync(path.join(home, 'dsh-glass-skin.json'), 'utf8')),
    LEGACY_STATE,
    'legacy preference file was not adopted',
  );
  assert.equal(
    existsSync(path.join(home, 'dsh-glass-skin', '.migrated-from-icebox')),
    true,
    'migration marker was not written',
  );

  // The adopted image is a real entry in the picker, not just a file on disk.
  const list = receiver();
  await routes.get('/api/dsh-glass-skin/wallpapers')(
    { method: 'GET', url: '/api/dsh-glass-skin/wallpapers' },
    list,
  );
  const body = JSON.parse(Buffer.concat(list.chunks).toString('utf8'));
  assert.ok(body.walls.some((entry) => entry.file === '旧照片.png' && entry.source === 'user'));

  // Once the marker exists the migration is over: a wallpaper the user deletes
  // afterwards must stay deleted instead of reappearing on the next launch.
  unlinkSync(copiedWallpaper);
  mount();
  assert.equal(existsSync(copiedWallpaper), false, 'migration ran a second time');
});
