// Campanha real por toque no WebKit. O planejador consulta o estado salvo,
// mas todas as mudanças são feitas por botões visíveis da interface.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { decode } from '../src/storage.js';
import { act, stats } from '../src/engine.js';
import { EVENTS } from '../src/content.js';
import { planTurn } from './campaign.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, '.browsers');
const { webkit } = await import('@playwright/test'),
  port = 4175;
const server = spawn(
  process.execPath,
  ['scripts/serve.mjs', '--dir', 'dist', '--port', String(port)],
  { cwd: root, stdio: 'pipe' },
);
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
});
const browser = await webkit.launch(),
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  }),
  page = await context.newPage(),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  Date.now = () => 20261006;
});
const read = async () =>
  decode(await page.evaluate(() => localStorage.getItem('sino-negro-save-v1')));
const tap = async (selector) => {
  const el = page.locator(selector);
  await el.tap();
};
async function prepare() {
  await tap('[data-tab="map"]');
  let s = await read();
  for (const id of ['hunt', 'rescue', 'relic'])
    if (!s.claimed.includes(id) && s.quests[id] >= (id === 'hunt' ? 12 : id === 'relic' ? 3 : 1)) {
      await tap(`[data-action="claim"][data-id="${id}"]`);
      s = await read();
    }
  await tap('[data-action="shop"][data-kind="rest"]');
  await tap('[data-tab="talents"]');
  for (const id of [
    'executioner',
    'dancer',
    'predator',
    'sentinel',
    'bulwark',
    'pyromancer',
    'communion',
  ]) {
    const el = page.locator(`[data-action="learn"][data-id="${id}"]`);
    if ((await el.count()) && (await el.isEnabled())) await el.tap();
  }
  await tap('[data-tab="map"]');
  await tap('[data-tab="forge"]');
  s = await read();
  if (s.hero.corruption >= 4 && s.stash.bones >= 10)
    await tap('[data-action="shop"][data-kind="purify"]');
  s = await read();
  if (s.stash.bones >= 55 && !s.hero.ownedArmor.includes('plate'))
    await tap('[data-action="shop"][data-kind="armor"][data-id="plate"]');
  for (let i = 0; i < 3; i++) {
    s = await read();
    const r = act(s, { type: 'shop', kind: 'upgrade' });
    if (r.ok) await tap('[data-action="shop"][data-kind="upgrade"]');
  }
  s = await read();
  while (s.supplies.flask < 4 && s.stash.bones >= 15) {
    await tap('[data-action="shop"][data-kind="flask"]');
    s = await read();
  }
  await tap('[data-tab="gear"]');
  s = await read();
  if (s.hero.ownedArmor.includes('plate') && s.hero.armor !== 'plate')
    await tap('[data-action="equip"][data-kind="armor"][data-id="plate"]');
  s = await read();
  const relic = s.hero.ownedRelics.includes('chalice') ? 'chalice' : s.hero.ownedRelics[0];
  if (relic && s.hero.relic !== relic)
    await tap(`[data-action="equip"][data-kind="relic"][data-id="${relic}"]`);
  await tap('[data-tab="map"]');
}
try {
  await page.goto(`http://127.0.0.1:${port}/`);
  await tap('[data-origin="butcher"]');
  await tap('[data-create]');
  const order = ['gutters', 'abbey', 'prison', 'cathedral', 'gutters'];
  let index = 0,
    turns = 0,
    steps = 0,
    attempts = 0;
  while (index < order.length && steps++ < 450) {
    let s = await read();
    if (s.screen === 'hub') {
      if (index < 3 && s.seals.includes(order[index])) index++;
      if (index === 3 && s.ending) index++;
      if (index === 4 && s.meta.bestVigil === 1) {
        index++;
        break;
      }
      await prepare();
      if (index === 4) await tap('[data-vigil="1"]');
      else {
        await tap(`[data-depart="${order[index]}"]`);
        await tap('[data-start-expedition]');
      }
      attempts++;
    } else if (s.screen === 'route') {
      const priority =
        s.hero.hp < stats(s).maxHp * 0.6
          ? ['camp', 'cache', 'event', 'battle', 'merchant', 'elite', 'boss']
          : ['battle', 'camp', 'cache', 'event', 'elite', 'merchant', 'boss'];
      const node = [...s.expedition.routes[s.expedition.depth]].sort(
        (a, b) => priority.indexOf(a.type) - priority.indexOf(b.type),
      )[0];
      await tap(`[data-action="node"][data-id="${node.id}"]`);
    } else if (s.screen === 'combat') {
      const best = planTurn(s);
      for (const action of best.seq) {
        if (action.type === 'endTurn') {
          await tap('[data-action="endTurn"]');
          continue;
        }
        const el = page.locator(`[data-skill="${action.id}"]`);
        if (await el.isVisible()) await el.tap();
        else {
          await tap('[data-modal="arsenal"]');
          await tap(`[role="dialog"] [data-skill="${action.id}"]`);
        }
        if (action.target) await tap(`[data-tile="${action.target.x},${action.target.y}"]`);
        await tap('[data-confirm]');
      }
      turns++;
      if (turns % 20 === 0)
        console.log(
          `WebKit por toque: ${order[index]} · ${turns} turnos · nível ${(await read()).hero.level}`,
        );
    } else if (s.screen === 'room') {
      const room = s.room;
      let id;
      if (room.type === 'camp')
        id = s.hero.corruption >= 5 ? 'purify' : s.hero.hp < stats(s).maxHp - 15 ? 'rest' : 'light';
      else if (room.type === 'cache') id = s.supplies.flask < 3 ? 'supplies' : 'relic';
      else if (room.type === 'merchant') id = 'leave';
      else {
        const all = EVENTS[room.event].choices
          .map((c, i) => ({ i, r: act(s, { type: 'room', id: i }) }))
          .filter((o) => o.r.ok);
        all.sort(
          (a, b) =>
            b.r.state.hero.hp +
            b.r.state.hero.points * 12 +
            b.r.state.quests.rescue * 15 -
            b.r.state.hero.corruption * 3 -
            (a.r.state.hero.hp +
              a.r.state.hero.points * 12 +
              a.r.state.quests.rescue * 15 -
              a.r.state.hero.corruption * 3),
        );
        id = all[0].i;
      }
      await tap(`[data-action="room"][data-id="${id}"]`);
    } else if (s.screen === 'reward') await tap('[data-action="continue"]');
    else if (s.screen === 'endingChoice') {
      await page.screenshot({
        path: path.join(root, 'test-results/webkit-final-choice.png'),
        fullPage: true,
      });
      await tap('[data-action="ending"][data-id="bind"]');
    } else if (['victory', 'ending', 'death'].includes(s.screen)) {
      if (s.screen === 'ending')
        await page.screenshot({
          path: path.join(root, 'test-results/webkit-ending.png'),
          fullPage: true,
        });
      await tap('[data-action="home"]');
    } else throw new Error(`Tela não tratada: ${s.screen}`);
  }
  const s = await read();
  assert.equal(s.seals.length, 3);
  assert.equal(s.ending, 'bind');
  assert.equal(s.meta.bestVigil, 1);
  assert.equal(s.screen, 'hub');
  assert.deepEqual(errors, []);
  await page.reload();
  assert.equal((await read()).ending, 'bind');
  await mkdir(path.join(root, 'test-results'), { recursive: true });
  const report = {
    browser: 'webkit',
    input: 'toque',
    complete: true,
    seals: s.seals,
    ending: s.ending,
    vigil: 1,
    level: s.hero.level,
    turns,
    attempts,
    deaths: s.meta.deaths,
  };
  await writeFile(
    path.join(root, 'test-results/browser-campaign-report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.kill();
}
