// Joueur tactique de validation : choisit uniquement des actions publiques du moteur.
// Aucun HP, seal, loot ou niveau n'est injecté pour atteindre la conclusion.
import {
  createGame,
  act,
  stats,
  availableSkills,
  targetValid,
  skillCost,
  distance,
  clone,
} from '../src/engine.js';
import { SKILLS, EVENTS } from '../src/content.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { decode, encode } from '../src/storage.js';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const step = (s, a) => {
  const r = act(s, a);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
function actions(s) {
  const out = [],
    c = s.combat,
    positions = [];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) positions.push({ x, y });
  for (const id of availableSkills(s)) {
    const sk = SKILLS[id],
      cost = skillCost(s, id);
    if (cost.ap > c.ap || cost.stamina > s.hero.vigor) continue;
    if (['flask', 'bomb', 'oil'].includes(id) && s.supplies[id] === 0) continue;
    if (id === 'flask' && s.hero.hp > stats(s).maxHp - 14) continue;
    if (id === 'oil') continue; // O teste unitário cobre a cadeia de óleo/fogo.
    if (sk.target === 'self') {
      out.push({ type: 'skill', id });
      continue;
    }
    for (const target of positions) {
      if (!targetValid(s, id, target)) continue;
      if (
        ['spark', 'bomb'].includes(id) &&
        !c.enemies.some((e) => e.hp > 0 && distance(e, target) <= (id === 'bomb' ? 1 : 0))
      )
        continue;
      out.push({ type: 'skill', id, target });
    }
  }
  return out;
}
const visited = new Map();
function pathDistance(s) {
  const p = s.combat.player,
    enemies = s.combat.enemies.filter((e) => e.hp > 0),
    queue = [{ ...p, d: 0 }],
    seen = new Set();
  while (queue.length) {
    const q = queue.shift(),
      k = `${q.x},${q.y}`;
    if (
      seen.has(k) ||
      q.x < 0 ||
      q.y < 0 ||
      q.x >= 6 ||
      q.y >= 6 ||
      ['wall', 'pit'].includes(s.combat.terrain[k])
    )
      continue;
    seen.add(k);
    if (enemies.some((e) => distance(e, q) <= 1)) return q.d;
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ])
      queue.push({ x: q.x + dx, y: q.y + dy, d: q.d + 1 });
  }
  return 12;
}
function score(s, initial) {
  if (s.screen === 'death') return -100000;
  if (s.screen !== 'combat') return 10000 + s.hero.hp * 4 + s.supplies.flask * 18;
  const c = s.combat,
    enemyHp = c.enemies.filter((e) => e.hp > 0).reduce((n, e) => n + e.hp, 0),
    debuff = c.enemies
      .filter((e) => e.hp > 0)
      .reduce((n, e) => n + e.bleed * 1.8 + e.burn * 1.5, 0),
    near = pathDistance(s),
    repeat = visited.get(`${c.player.x},${c.player.y}:${enemyHp}`) || 0;
  return (
    s.hero.hp * 4 +
    s.hero.vigor * 0.6 +
    s.supplies.flask * 26 +
    s.supplies.bomb * 18 -
    enemyHp * 1.8 +
    debuff -
    s.hero.corruption * 2 +
    (s.meta.kills - initial.meta.kills) * 16 -
    near * 2 -
    c.player.bleed * 5 +
    (c.player.counter ? 4 : 0) -
    Math.min(10, repeat) * 4
  );
}
export function planTurn(s) {
  const choices = [],
    expanded = [{ state: s, seq: [] }];
  let beam = expanded;
  for (let depth = 0; depth < 2; depth++) {
    const next = [];
    for (const node of beam) {
      const ended =
        node.state.screen === 'combat'
          ? act(node.state, { type: 'endTurn' })
          : { state: node.state, ok: true };
      if (ended.ok)
        choices.push({
          state: ended.state,
          seq: [...node.seq, ...(node.state.screen === 'combat' ? [{ type: 'endTurn' }] : [])],
          score: score(ended.state, s),
        });
      if (node.state.screen !== 'combat') continue;
      for (const a of actions(node.state)) {
        const r = act(node.state, a);
        if (!r.ok) continue;
        if (r.state.screen !== 'combat') {
          choices.push({ state: r.state, seq: [...node.seq, a], score: score(r.state, s) });
          continue;
        }
        const final = act(r.state, { type: 'endTurn' });
        if (!final.ok) continue;
        next.push({ state: r.state, seq: [...node.seq, a], score: score(final.state, s) });
      }
    }
    beam = next.sort((a, b) => b.score - a.score).slice(0, 10);
  }
  for (const node of beam) {
    const r = act(node.state, { type: 'endTurn' });
    if (r.ok)
      choices.push({
        state: r.state,
        seq: [...node.seq, { type: 'endTurn' }],
        score: score(r.state, s),
      });
  }
  choices.sort((a, b) => b.score - a.score);
  assert.ok(choices.length);
  return choices[0];
}
function prepare(s) {
  s = step(s, { type: 'shop', kind: 'rest' });
  if (s.hero.corruption >= 4 && s.stash.bones >= 10) s = step(s, { type: 'shop', kind: 'purify' });
  while (s.hero.wounds && s.stash.bones >= 20) s = step(s, { type: 'shop', kind: 'surgery' });
  for (const id of ['rescue', 'relic', 'hunt'])
    if (!s.claimed.includes(id) && s.quests[id] >= (id === 'hunt' ? 12 : id === 'relic' ? 3 : 1))
      s = step(s, { type: 'claim', id });
  const paths =
    s.hero.origin === 'guard'
      ? ['bulwark', 'breaker', 'resolve', 'bloodletter', 'executioner', 'pyromancer', 'communion']
      : s.hero.origin === 'butcher'
        ? ['executioner', 'dancer', 'predator', 'sentinel', 'bulwark', 'pyromancer', 'communion']
        : ['tithe', 'communion', 'abyss', 'sentinel', 'bulwark', 'bloodletter'];
  for (const id of paths) {
    const result = act(s, { type: 'learn', id });
    if (result.ok) s = result.state;
  }
  if (s.stash.bones >= 55 && !s.hero.ownedArmor.includes('plate'))
    s = step(s, { type: 'shop', kind: 'armor', id: 'plate' });
  if (s.hero.ownedArmor.includes('plate'))
    s = step(s, { type: 'equip', kind: 'armor', id: 'plate' });
  for (let i = 0; i < 3; i++) {
    const r = act(s, { type: 'shop', kind: 'upgrade' });
    if (r.ok) s = r.state;
  }
  if (s.hero.ownedRelics.includes('chalice'))
    s = step(s, { type: 'equip', kind: 'relic', id: 'chalice' });
  else if (s.hero.ownedRelics.length)
    s = step(s, { type: 'equip', kind: 'relic', id: s.hero.ownedRelics[0] });
  while (s.supplies.flask < 4 && s.stash.bones >= 15) s = step(s, { type: 'shop', kind: 'flask' });
  return s;
}
function expedition(s, id, vigil = 0) {
  s = step(s, { type: 'depart', id, vigil });
  let turns = 0,
    steps = 0;
  while (s.expedition && steps++ < 160) {
    if (s.screen === 'route') {
      const nodes = s.expedition.routes[s.expedition.depth];
      const priority =
        s.hero.hp < stats(s).maxHp * 0.6
          ? ['camp', 'cache', 'event', 'battle', 'merchant', 'elite', 'boss']
          : ['battle', 'camp', 'cache', 'event', 'elite', 'merchant', 'boss'];
      const node = [...nodes].sort(
        (a, b) => priority.indexOf(a.type) - priority.indexOf(b.type),
      )[0];
      s = step(s, { type: 'node', id: node.id });
    } else if (s.screen === 'combat') {
      if (s.combat.turn === 1) visited.clear();
      const enemyHp = s.combat.enemies.filter((e) => e.hp > 0).reduce((n, e) => n + e.hp, 0),
        position = `${s.combat.player.x},${s.combat.player.y}:${enemyHp}`;
      visited.set(position, (visited.get(position) || 0) + 1);
      const best = planTurn(s);
      for (const a of best.seq) s = step(s, a);
      turns++;
      if (turns === 80)
        console.log(
          'Diagnóstico',
          JSON.stringify({
            hp: s.hero.hp,
            vigor: s.hero.vigor,
            p: s.combat?.player,
            enemies: s.combat?.enemies.map((e) => ({ kind: e.kind, hp: e.hp, x: e.x, y: e.y })),
            seq: best.seq,
            depth: s.expedition?.depth,
          }),
        );
      if (turns > 170) throw new Error(`Combate sem término: ${s.hero.origin} ${id}`);
    } else if (s.screen === 'room') {
      const room = s.room;
      if (room.type === 'camp')
        s = step(s, {
          type: 'room',
          id:
            s.hero.corruption >= 5 ? 'purify' : s.hero.hp < stats(s).maxHp - 15 ? 'rest' : 'light',
        });
      else if (room.type === 'cache')
        s = step(s, { type: 'room', id: s.supplies.flask < 3 ? 'supplies' : 'relic' });
      else if (room.type === 'merchant') s = step(s, { type: 'room', id: 'leave' });
      else {
        const all = EVENTS[room.event].choices
          .map((c, i) => ({ i, r: act(s, { type: 'room', id: i }) }))
          .filter((o) => o.r.ok);
        assert.ok(all.length, `Evento sem saída: ${room.event}`);
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
        s = all[0].r.state;
      }
    } else if (s.screen === 'reward') s = step(s, { type: 'continue' });
    else if (s.screen === 'victory') s = step(s, { type: 'home' });
    else if (s.screen === 'endingChoice') {
      s = step(s, { type: 'ending', id: s.hero.origin === 'butcher' ? 'bind' : 'break' });
      s = step(s, { type: 'home' });
    } else break;
    if (s.screen === 'death') {
      s = step(s, { type: 'home' });
      break;
    }
  }
  assert.ok(!s.expedition, 'Uma expedição deve terminar em vitória, retirada ou morte');
  return { state: s, turns };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = [];
  for (const origin of ['guard', 'butcher', 'heretic']) {
    let s = createGame(origin, `Campanha ${origin}`, 20261006),
      attempt = 0,
      totalTurns = 0;
    for (const district of ['gutters', 'abbey', 'prison', 'cathedral']) {
      let won = false;
      for (let i = 0; i < 5; i++) {
        s = prepare(s);
        const r = expedition(s, district);
        s = r.state;
        totalTurns += r.turns;
        attempt++;
        console.log(
          `${origin}: ${district} tentativa ${i + 1} · nível ${s.hero.level} · mortes ${s.meta.deaths} · selos ${s.seals.length} · turnos ${r.turns}`,
        );
        if (district === 'cathedral' ? !!s.ending : s.seals.includes(district)) {
          won = true;
          break;
        }
      }
      assert.equal(
        won,
        true,
        `${origin} deve conseguir concluir ${district} em até cinco expedições`,
      );
      s = decode(encode(s)); // O save atravessa cada distrito, sem perder progressão.
    }
    assert.equal(s.seals.length, 3);
    assert.ok(s.ending);
    assert.equal(s.screen, 'hub');
    s = prepare(s);
    const again = expedition(s, 'gutters', 1);
    s = again.state;
    totalTurns += again.turns;
    assert.equal(s.meta.bestVigil, 1, 'Um novo ciclo de Vigília é jogável até o fim');
    results.push({
      origin,
      complete: true,
      ending: s.ending,
      level: s.hero.level,
      attempts: attempt,
      deaths: s.meta.deaths,
      kills: s.meta.kills,
      totalTurns,
      vigil: s.meta.bestVigil,
    });
  }
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/campaign-report.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
