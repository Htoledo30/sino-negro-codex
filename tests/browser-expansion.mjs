// Cenários de interface isolados usam fixtures importadas pelo mesmo fluxo do jogador.
// A campanha completa sem injeção permanece em browser-campaign.mjs.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createGame, act, startBattle, clone, stats } from '../src/engine.js';
import { encode, decode } from '../src/storage.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, '.browsers');
const { chromium, webkit } = await import('@playwright/test');
const server = spawn(process.execPath, ['scripts/serve.mjs', '--dir', 'dist', '--port', '4176'], {
  cwd: root,
  stdio: 'pipe',
});
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
});
await mkdir(path.join(root, 'test-results'), { recursive: true });
const results = [];
try {
  for (const [name, type] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const browser = await type.launch(),
      context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      }),
      page = await context.newPage(),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const tap = async (selector) => page.locator(selector).tap();
    const read = async () =>
      decode(await page.evaluate(() => localStorage.getItem('sino-negro-save-v1')));
    async function restore(s) {
      const file = path.join(root, `test-results/${name}-fixture.json`);
      await writeFile(file, encode(s));
      await tap('[data-modal="menu"]');
      await tap('[data-modal="import"]');
      await page.locator('#import-file').setInputFiles(file);
      await tap('[data-restore]');
    }
    async function use(id, target) {
      const el = page.locator(`[data-skill="${id}"]`);
      if (await el.isVisible()) await el.tap();
      else {
        await tap('[data-modal="arsenal"]');
        await tap(`[role="dialog"] [data-skill="${id}"]`);
      }
      if (target) await tap(`[data-tile="${target.x},${target.y}"]`);
      await tap('[data-confirm]');
    }
    async function overflow() {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.goto('http://127.0.0.1:4176/');
    const legacy = JSON.parse(
      await readFile(path.join(root, 'tests/fixtures/legacy-combat.json'), 'utf8'),
    );
    await restore(legacy);
    assert.equal((await read()).version, 2);
    assert.deepEqual((await read()).combat.enemies, legacy.combat.enemies);
    await use('move', { x: 4, y: 5 });
    assert.equal((await read()).combat.ap, 0);
    await page.reload();
    assert.equal((await read()).combat.player.x, 4);
    let hub;
    for (let seed = 1; seed < 200; seed++) {
      const s = createGame('guard', 'Companhia', seed);
      if (
        act(s, { type: 'depart', id: 'gutters' }).state.expedition.routes[0][0].encounter ===
        'gutters_ritual'
      ) {
        hub = s;
        break;
      }
    }
    hub.stash = { bones: 500, scrap: 200, ichor: 30 };
    hub.quests.rescue = 1;
    hub.quests.ivo = 1;
    hub.quests.silence = 6;
    hub = act(hub, { type: 'shop', kind: 'rest' }).state;
    await restore(hub);
    await tap('[data-tab="gear"]');
    await tap('[data-action="companion"][data-id="mara"]');
    await page.locator('[data-tab="forge"]').first().tap();
    await tap('[data-action="engrave"][data-id="blood"]');
    assert.equal((await read()).hero.runes.sword, 'blood');
    await page.screenshot({
      path: path.join(root, `${'test-results/'}${name}-runes.png`),
      fullPage: true,
    });
    await overflow();
    await tap('[data-tab="map"]');
    await tap('[data-depart="gutters"]');
    await tap('[data-start-expedition]');
    await tap('[data-action="scout"]');
    assert.equal((await read()).expedition.light, 8);
    await tap('[data-action="node"][data-id="0-0"]');
    assert.equal((await read()).combat.ap, 3);
    assert.equal((await read()).combat.objective.kind, 'ritual');
    assert.ok(
      await page.evaluate(
        () =>
          document.querySelector('.board').getBoundingClientRect().bottom <=
          document.querySelector('.control-area').getBoundingClientRect().top,
      ),
      'As seis fileiras ficam acima da barra de ações em 390×844',
    );
    await overflow();
    await page.screenshot({
      path: path.join(root, `test-results/${name}-ritual.png`),
      fullPage: true,
    });
    await use('suture');
    assert.equal((await read()).combat.companionUsed, true);
    let ritual = await read();
    ritual.combat.player.x = 0;
    ritual.combat.player.y = 3;
    ritual.combat.ap = 2;
    await restore(ritual);
    await use('interact', { x: 0, y: 2 });
    assert.equal((await read()).combat.objective.objects[0].active, false);
    ritual = await read();
    ritual.combat.player.x = 5;
    ritual.combat.player.y = 3;
    await restore(ritual);
    await use('interact', { x: 5, y: 2 });
    assert.equal((await read()).screen, 'reward');
    await tap('[data-modal="retreat"]');
    await tap('[data-retreat]');
    await tap('[data-tab="journal"]');
    await page.locator('.bestiary-entry').first().locator('summary').tap();
    await overflow();
    for (const [id, kind, pos, target] of [
      ['gutters_rescue', 'rescue', { x: 4, y: 3 }, { x: 4, y: 2 }],
      ['gutters_pyre', 'supplies', { x: 3, y: 4 }, { x: 3, y: 3 }],
      ['abbey_siege', 'siege', { x: 2, y: 5 }, { x: 2, y: 5 }],
    ]) {
      let s = act(createGame(), {
        type: 'depart',
        id: id.startsWith('abbey') ? 'abbey' : 'gutters',
      }).state;
      startBattle(s, 'battle', id);
      Object.assign(s.combat.player, pos);
      if (kind === 'siege') {
        s.combat.turn = 6;
      }
      await restore(s);
      await overflow();
      await page.screenshot({
        path: path.join(root, `test-results/${name}-${kind}.png`),
        fullPage: true,
      });
      await use('interact', target);
      s = await read();
      if (kind === 'rescue') assert.ok(s.hero.roster.includes('ivo'));
      if (kind === 'supplies') assert.equal(s.supplies.bomb, 2);
      if (kind === 'siege') assert.equal(s.screen, 'reward');
    }
    const preserved = await read();
    await page.reload();
    const reloaded = await read();
    assert.deepEqual({ ...reloaded, lastSave: 0 }, { ...preserved, lastSave: 0 });
    assert.deepEqual(errors, []);
    results.push({
      browser: name,
      passed: true,
      checks: [
        'migração v1 por importação',
        'runas por toque',
        'companhia e ordem',
        'reconhecimento e AP extra',
        'âncoras',
        'resgate',
        'provisões',
        'saída do cerco',
        'bestiário',
        'reload',
        'sem overflow',
      ],
    });
    await browser.close();
    console.log(`${name}: expansão aprovada por toque`);
  }
  await writeFile(
    path.join(root, 'test-results/browser-expansion-report.json'),
    JSON.stringify(results, null, 2),
  );
} finally {
  server.kill();
}
