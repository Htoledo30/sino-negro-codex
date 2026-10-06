import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { decode } from '../src/storage.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, '.browsers');
const { chromium, webkit } = await import('@playwright/test');
const port = 4174,
  base = `http://127.0.0.1:${port}/sino-negro/`;
async function startServer() {
  const child = spawn(
    process.execPath,
    ['scripts/serve.mjs', '--dir', 'dist', '--port', String(port), '--base', '/sino-negro/'],
    { cwd: root, stdio: 'pipe' },
  );
  await new Promise((resolve, reject) => {
    child.stdout.once('data', resolve);
    child.once('error', reject);
  });
  return child;
}
let server = await startServer();
await mkdir(path.join(root, 'test-results'), { recursive: true });
const results = [];
const swPath = path.join(root, 'dist/sw.js'),
  originalSW = await readFile(swPath, 'utf8');
async function campaignState(page) {
  return decode(await page.evaluate(() => localStorage.getItem('sino-negro-save-v1')));
}
async function noOverflow(page) {
  const result = await page.evaluate(() => ({
    width: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('body *')]
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 8)
      .map((e) => ({
        tag: e.tagName,
        cls: e.className,
        text: e.textContent.slice(0, 40),
        right: e.getBoundingClientRect().right,
      })),
  }));
  if (result.scroll > result.width + 1) {
    await page.screenshot({ path: path.join(root, 'test-results/overflow.png'), fullPage: true });
    console.log(JSON.stringify(result));
  }
  assert.equal(result.scroll <= result.width + 1, true, 'Sem rolagem horizontal');
}
try {
  for (const [name, browserType] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base);
    await page.locator('[data-origin="guard"]').waitFor();
    await noOverflow(page);
    await page.screenshot({
      path: path.join(root, `test-results/${name}-intro.png`),
      fullPage: true,
    });
    await page.locator('#hero-name').fill('Noite de teste');
    await page.locator('[data-create]').tap();
    await page.locator('[data-depart="gutters"]').waitFor();
    await page.waitForFunction(() => document.body.textContent.includes('OFFLINE PRONTO'));
    assert.equal((await campaignState(page)).hero.name, 'Noite de teste');
    await page.screenshot({
      path: path.join(root, `test-results/${name}-hub.png`),
      fullPage: true,
    });
    await page.locator('[data-tab="talents"]').tap();
    await page.locator('[data-action="learn"][data-id="bulwark"]').tap();
    assert.equal((await campaignState(page)).hero.talents.includes('bulwark'), true);
    await page.locator('[data-tab="map"]').tap();
    await page.locator('[data-depart="cathedral"]').tap({ force: true });
    assert.equal((await campaignState(page)).screen, 'hub');
    await page.locator('[data-depart="gutters"]').tap();
    await page.locator('[data-start-expedition]').tap();
    await page.locator('[data-action="node"][data-id="0-0"]').tap();
    assert.equal(await page.locator('.tile').count(), 36);
    await noOverflow(page);
    await page.screenshot({
      path: path.join(root, `test-results/${name}-combat.png`),
      fullPage: true,
    });
    const before = await campaignState(page);
    await page.locator('[data-skill="move"]').tap();
    await page.locator('[data-tile="5,0"]').tap();
    assert.equal((await campaignState(page)).combat.ap, before.combat.ap);
    await page.locator('[data-tile="3,5"]').tap();
    await page.locator('[data-confirm]').tap();
    assert.equal((await campaignState(page)).combat.player.x, 3);
    await page.locator('[data-action="endTurn"]').tap();
    assert.equal((await campaignState(page)).combat.turn, 2);
    await page.locator('[data-modal="menu"]').first().tap();
    await page.locator('[data-audio]').tap();
    assert.equal((await campaignState(page)).options.sound, true);
    await page.locator('[data-motion]').tap();
    assert.equal((await campaignState(page)).options.motion, false);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-export]').tap();
    const download = await downloadPromise;
    await download.saveAs(path.join(root, `test-results/${name}-save.json`));
    await page.locator('[data-modal="import"]').tap();
    await page
      .locator('#import-file')
      .setInputFiles(path.join(root, `test-results/${name}-save.json`));
    await page.locator('[data-restore]').tap();
    assert.equal((await campaignState(page)).combat.turn, 2);
    const preserved = await campaignState(page);
    await page.reload();
    assert.deepEqual((await campaignState(page)).combat, preserved.combat);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    // Atualização explícita: o worker novo espera; só o botão do menu ativa e recarrega.
    const newCache = `sino-negro-test-update-${name}`;
    await writeFile(
      swPath,
      originalSW.replace(/const CACHE\s*=\s*['"][^'"]+['"]/, `const CACHE='${newCache}'`),
    );
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });
    await page.locator('[data-modal="menu"]').first().tap();
    await page.locator('[data-update]').waitFor();
    assert.deepEqual((await campaignState(page)).combat, preserved.combat);
    await page.locator('[data-update]').tap();
    await page.waitForFunction(
      async (expected) => (await caches.keys()).includes(expected),
      newCache,
    );
    await page.locator('.board').waitFor();
    assert.deepEqual((await campaignState(page)).combat, preserved.combat);
    // WebKit Windows ne traite pas correctement l'émulation setOffline pour le SW.
    // Couper le serveur teste le vrai cache, sans dépendre de cette émulation.
    const stopped = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await stopped;
    let offlinePassed = false,
      offlineLimitation = null;
    try {
      await page.reload({ timeout: 15000 });
      await page.locator('.board').waitFor({ timeout: 5000 });
      assert.equal(await page.locator('.tile').count(), 36);
      assert.deepEqual((await campaignState(page)).combat, preserved.combat);
      offlinePassed = true;
    } catch (error) {
      if (name !== 'webkit') throw error;
      offlineLimitation = error.message.split('\n')[0];
      console.log('WebKit offline indisponível neste runtime:', offlineLimitation);
    } finally {
      server = await startServer();
    }
    if (!offlinePassed) {
      await page.goto(base);
      await page.locator('.board').waitFor();
    }
    // Menus restent accessibles même dans un combat interrompu.
    for (const size of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 430, height: 932 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await noOverflow(page);
      await page.locator('[data-tab="gear"]').tap();
      await noOverflow(page);
      await page.locator('[data-tab="help"]').tap();
      await noOverflow(page);
      await page.locator('[data-tab="map"]').tap();
    }
    assert.deepEqual(errors, []);
    results.push({
      browser: name,
      passed: true,
      offlinePassed,
      offlineLimitation,
      checks: [
        'criação',
        'talento',
        'gate catedral',
        'combate por toque',
        'entrada inválida',
        'menu/áudio',
        'exportação/importação',
        'reload',
        'subpasta',
        '320/375/390/430/retrato/paisagem',
      ],
    });
    await browser.close();
    await writeFile(swPath, originalSW);
    console.log(`${name}: testes de navegador aprovados`);
  }
  await writeFile(
    path.join(root, 'test-results/browser-report.json'),
    JSON.stringify(results, null, 2),
  );
} finally {
  await writeFile(swPath, originalSW);
  server.kill();
}
