import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createGame,
  act,
  startBattle,
  planIntents,
  clone,
  validateSave,
  stats,
  skillCost,
  targetValid,
  preview,
  ward,
} from '../src/engine.js';
import { ENEMIES } from '../src/content.js';
import { ENCOUNTERS, RUNES } from '../src/expansion.js';
import { encode, decode } from '../src/storage.js';
const step = (s, a) => {
  const r = act(s, a);
  assert.ok(r.ok, r.error);
  assert.ok(validateSave(r.state));
  return r.state;
};
function battle(id = 'gutters_pack', origin = 'guard') {
  let s = step(createGame(origin, 'Expansão', 51), { type: 'depart', id: ENCOUNTERS[id].district });
  startBattle(s, 'battle', id);
  return s;
}
function foe(s, kind, x = 2, y = 4) {
  const d = ENEMIES[kind];
  const e = {
    id: `fixture-${s.combat.enemies.length}`,
    kind,
    x,
    y,
    hp: d.hp,
    maxHp: d.hp,
    armor: d.armor,
    damage: d.damage,
    bleed: 0,
    burn: 0,
    stun: 0,
    rewarded: false,
    intent: null,
  };
  s.combat.enemies.push(e);
  planIntents(s);
  return e;
}
test('save REAL da versão publicada migra sem alterar turno, intenções, posição ou rota', () => {
  const old = JSON.parse(readFileSync(new URL('./fixtures/legacy-combat.json', import.meta.url)));
  const s = decode(encode(old));
  assert.equal(s.version, 2);
  assert.equal(s.combat.ap, old.combat.ap);
  assert.deepEqual(s.combat.enemies, old.combat.enemies);
  assert.deepEqual(s.expedition.routes, old.expedition.routes);
  assert.deepEqual(s.stash, old.stash);
  assert.equal(s.rng, old.rng);
  assert.deepEqual(s.hero.roster, ['mara']);
  const moved = step(s, { type: 'skill', id: 'move', target: { x: 4, y: 5 } });
  assert.equal(moved.combat.ap, 0);
  assert.equal(moved.combat.player.x, 4);
  assert.deepEqual(decode(encode(moved)), moved);
});
test('todos os encontros autorais têm objetos e inimigos acessíveis, saves válidos e intenções copiáveis', () => {
  for (const id of Object.keys(ENCOUNTERS)) {
    let initial = createGame();
    if (ENCOUNTERS[id].district === 'cathedral') initial.seals = ['gutters', 'abbey', 'prison'];
    let s = step(initial, { type: 'depart', id: ENCOUNTERS[id].district });
    startBattle(s, 'battle', id);
    assert.ok(validateSave(s), id);
    const reached = new Set(),
      queue = [s.combat.player];
    while (queue.length) {
      const p = queue.shift(),
        k = `${p.x},${p.y}`;
      if (
        p.x < 0 ||
        p.x > 5 ||
        p.y < 0 ||
        p.y > 5 ||
        reached.has(k) ||
        ['pit', 'wall'].includes(s.combat.terrain[k])
      )
        continue;
      reached.add(k);
      for (const [x, y] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        queue.push({ x: p.x + x, y: p.y + y });
    }
    for (const p of [...s.combat.enemies, ...s.combat.objective.objects])
      assert.ok(reached.has(`${p.x},${p.y}`), id);
    assert.deepEqual(decode(encode(s)), s);
  }
});
test('reconhecimento consome luz uma vez, preserva formações e concede só o primeiro turno extra', () => {
  let s = step(createGame(), { type: 'depart', id: 'gutters' });
  const routes = clone(s.expedition.routes);
  s = step(s, { type: 'scout' });
  assert.equal(s.expedition.light, 8);
  assert.deepEqual(s.expedition.routes, routes);
  const rejected = act(s, { type: 'scout' });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.state.expedition.light, 8);
  s = step(s, { type: 'node', id: '0-0' });
  assert.equal(s.combat.ap, 3);
  s = step(s, { type: 'endTurn' });
  assert.equal(s.combat.ap, 2);
});
test('romper as duas âncoras permite vencer sem inventar mortes; interação inválida não gasta', () => {
  let s = battle('gutters_ritual');
  const before = clone(s);
  assert.equal(act(s, { type: 'skill', id: 'interact', target: { x: 2, y: 4 } }).ok, false);
  assert.deepEqual(s, before);
  for (const o of clone(s.combat.objective.objects)) {
    s.combat.player = { ...s.combat.player, x: o.x, y: o.y + 1 };
    s = step(s, { type: 'skill', id: 'interact', target: o });
  }
  assert.equal(s.screen, 'reward');
  assert.equal(s.meta.kills, 0);
  assert.equal(s.expedition.bag.bones, 26);
});
test('resgate libera Ivo; provisões só podem ser recolhidas uma vez', () => {
  let s = battle('gutters_rescue');
  s.combat.player.x = 4;
  s.combat.player.y = 3;
  s = step(s, { type: 'skill', id: 'interact', target: { x: 4, y: 2 } });
  assert.equal(s.quests.ivo, 1);
  assert.ok(s.hero.roster.includes('ivo'));
  s = battle('gutters_pyre');
  s.combat.player.x = 3;
  s.combat.player.y = 4;
  const flask = s.supplies.flask,
    bombs = s.supplies.bomb;
  s = step(s, { type: 'skill', id: 'interact', target: { x: 3, y: 3 } });
  assert.equal(s.supplies.flask, flask + 1);
  assert.equal(s.supplies.bomb, bombs + 1);
  assert.equal(act(s, { type: 'skill', id: 'interact', target: { x: 3, y: 3 } }).ok, false);
});
test('prisioneiro atingido por área morre; não pode ser salvo depois', () => {
  let s = battle('gutters_rescue');
  s.combat.enemies = [];
  const e = foe(s, 'cantor', 0, 0);
  e.intent = { kind: 'attack', cells: [{ x: 4, y: 2 }], label: 'Área de teste', damage: 24 };
  s = step(s, { type: 'endTurn' });
  assert.equal(s.combat.objective.objects[0].hp, 0);
  assert.equal(s.combat.objective.objects[0].active, false);
  assert.equal(s.quests.ivo, 0);
});
test('cerco não termina ao matar todos; reforços chegam e fuga exige turno seis', () => {
  let s = battle('abbey_siege');
  assert.equal(targetValid(s, 'interact', { x: 2, y: 5 }), false);
  for (const e of s.combat.enemies) {
    e.hp = 0;
    e.rewarded = true;
  }
  s = step(s, { type: 'endTurn' });
  assert.equal(s.screen, 'combat');
  s = step(s, { type: 'endTurn' });
  assert.equal(s.combat.turn, 3);
  assert.equal(s.combat.enemies.filter((e) => e.hp > 0).length, 2);
  while (s.combat.turn < 6) {
    for (const e of s.combat.enemies) {
      e.hp = 0;
      e.rewarded = true;
    }
    s = step(s, { type: 'endTurn' });
  }
  const kills = s.meta.kills;
  s = step(s, { type: 'skill', id: 'interact', target: { x: 2, y: 5 } });
  assert.equal(s.screen, 'reward');
  assert.equal(s.meta.kills, kills);
});
test('proteção adjacente reduz físico; rito ignora; puxar separa e quebra armadura', () => {
  let s = battle();
  s.combat.enemies = [];
  s.combat.terrain = {};
  const target = foe(s, 'soldier', 2, 3),
    protector = foe(s, 'bulwark', 3, 3);
  s.hero.roster = ['ivo'];
  s.hero.companion = 'ivo';
  assert.equal(ward(s, target), 3);
  const hp = target.hp;
  s = step(s, { type: 'skill', id: 'hook', target: { x: 2, y: 3 } });
  assert.equal(s.combat.enemies[0].y, 4);
  assert.equal(s.combat.enemies[0].hp, hp - 1);
  assert.equal(ward(s, s.combat.enemies[0]), 0);
  assert.equal(act(s, { type: 'skill', id: 'hook', target: { x: 2, y: 4 } }).ok, false);
});
test('costureira anuncia cura e interrupção a cancela; detonação pode ser interrompida', () => {
  let s = battle();
  s.combat.enemies = [];
  s.combat.terrain = {};
  const healer = foe(s, 'stitcher', 2, 4),
    ally = foe(s, 'husk', 0, 0);
  ally.hp -= 10;
  planIntents(s);
  assert.equal(healer.intent.kind, 'heal');
  s.hero.roster = ['sibyl'];
  s.hero.companion = 'sibyl';
  s = step(s, { type: 'skill', id: 'silence', target: { x: 2, y: 4 } });
  s = step(s, { type: 'endTurn' });
  assert.equal(s.combat.enemies[1].hp, ally.hp);
  assert.equal(s.hero.corruption, 1);
  s = battle();
  s.combat.enemies = [];
  s.combat.terrain = {};
  foe(s, 'bomber');
  assert.equal(s.combat.enemies[0].intent.explode, true);
  s = step(s, { type: 'skill', id: 'bash', target: { x: 2, y: 4 } });
  s = step(s, { type: 'endTurn' });
  assert.ok(s.combat.enemies[0].hp > 0);
});
test('correntes cobram movimento uma vez; aparo completo evita efeitos', () => {
  let s = battle();
  s.combat.enemies = [];
  s.combat.terrain = {};
  foe(s, 'gaoler');
  s = step(s, { type: 'endTurn' });
  assert.equal(s.combat.player.root, 2);
  assert.equal(skillCost(s, 'move').stamina, 3);
  s = step(s, { type: 'skill', id: 'move', target: { x: 3, y: 5 } });
  assert.equal(s.combat.player.root, 0);
  s = battle();
  s.combat.enemies = [];
  s.combat.terrain = {};
  foe(s, 'gaoler');
  s = step(s, { type: 'skill', id: 'guard' });
  s = step(s, { type: 'endTurn' });
  assert.equal(s.combat.player.root, 0);
});
test('runas são permanentes por arma; custo inválido é atômico; efeitos modificam ataques', () => {
  let s = createGame();
  s.stash = { bones: 500, scrap: 200, ichor: 30 };
  for (const id of Object.keys(RUNES).filter((id) => id !== 'none'))
    s = step(s, { type: 'engrave', id });
  assert.equal(s.hero.ownedRunes.length, 6);
  assert.equal(act(s, { type: 'engrave', id: 'blood' }).ok, false);
  s = step(s, { type: 'rune', id: 'blood' });
  s = step(s, { type: 'depart', id: 'gutters' });
  startBattle(s);
  s.combat.enemies = [];
  s.combat.terrain = {};
  foe(s, 'soldier');
  const base = skillCost(s, 'strike').stamina;
  s = step(s, { type: 'skill', id: 'strike', target: { x: 2, y: 4 } });
  assert.equal(s.combat.enemies[0].bleed, 2);
  assert.equal(base, 3);
  const poor = createGame(),
    wallet = clone(poor.stash);
  assert.equal(act(poor, { type: 'engrave', id: 'frost' }).ok, false);
  assert.deepEqual(poor.stash, wallet);
});
test('Mara usa uma ordem por combate; fogo anuncia fuga e causa dano ao permanecer', () => {
  let s = battle();
  s.hero.roster = ['mara'];
  s.hero.companion = 'mara';
  s.hero.hp -= 15;
  s.combat.player.bleed = 4;
  s = step(s, { type: 'skill', id: 'suture' });
  assert.equal(s.hero.hp, stats(s).maxHp - 3);
  assert.equal(s.combat.player.bleed, 0);
  assert.equal(act(s, { type: 'skill', id: 'suture' }).ok, false);
  s = battle();
  s.combat.enemies = [];
  s.combat.terrain = {};
  const e = foe(s, 'cantor', 0, 0);
  s.combat.terrain['0,0'] = 'fire';
  planIntents(s);
  assert.ok(e.intent.moveAfter);
  for (const tile of ['1,0', '0,1']) s.combat.terrain[tile] = 'wall';
  planIntents(s);
  const hp = e.hp;
  s = step(s, { type: 'endTurn' });
  assert.equal(s.combat.enemies[0].hp, hp - 5);
});
test('campos novos corrompidos e coordenadas fracionadas não são aceitos', () => {
  const base = battle();
  for (const mutate of [
    (s) => delete s.codex,
    (s) => (s.hero.runes.sword = 'bogus'),
    (s) => s.combat.objective.objects.push({ x: 1, y: 1, active: true }),
    (s) => (s.combat.player.root = 4),
    (s) => s.hero.roster.push('bogus'),
  ]) {
    const s = clone(base);
    mutate(s);
    assert.equal(validateSave(s), false);
  }
  assert.equal(targetValid(base, 'move', { x: 2.5, y: 5 }), false);
});
test('todas as gravações exercem seu efeito real e preservam seus custos', () => {
  const setup = (id, kind = 'bulwark', origin = 'guard') => {
    const s = battle('gutters_pack', origin);
    s.combat.enemies = [];
    s.combat.terrain = {};
    s.hero.ownedRunes = [id];
    s.hero.runes[s.hero.weapon] = id;
    foe(s, kind);
    return s;
  };
  let s = setup('frost');
  const base = stats(s).damage;
  assert.equal(base, 7);
  s.combat.enemies[0].intent = {
    kind: 'move',
    label: 'Aproximar',
    cells: [{ x: 3, y: 4 }],
    dest: { x: 3, y: 4 },
    damage: 0,
  };
  s = step(s, { type: 'skill', id: 'strike', target: { x: 2, y: 4 } });
  assert.equal(s.combat.enemies[0].intent.kind, 'stun');
  s = setup('frost');
  s = step(s, { type: 'skill', id: 'strike', target: { x: 2, y: 4 } });
  assert.equal(s.combat.enemies[0].intent.kind, 'attack');
  s = setup('hunger');
  s.hero.hp -= 10;
  s = step(s, { type: 'skill', id: 'strike', target: { x: 2, y: 4 } });
  assert.equal(s.hero.hp, stats(s).maxHp - 7);
  s = setup('echo');
  s.combat.player.counter = true;
  const hp = s.combat.enemies[0].hp;
  assert.match(preview(s, 'strike', { x: 2, y: 4 }), /18 dano/);
  s = step(s, { type: 'skill', id: 'strike', target: { x: 2, y: 4 } });
  assert.equal(s.combat.enemies[0].hp, hp - 18);
  assert.equal(s.combat.enemies[0].intent.kind, 'stun');
  s = setup('ember', 'brute');
  s.combat.terrain['2,4'] = 'oil';
  s.combat.terrain['3,4'] = 'oil';
  const ally = foe(s, 'bulwark', 3, 4),
    allyHp = ally.hp;
  s = step(s, { type: 'skill', id: 'heavy', target: { x: 2, y: 4 } });
  assert.equal(s.combat.terrain['3,4'], 'fire');
  // Uma cadeia de óleo e cruz sobrepostas não atingem o mesmo alvo duas vezes.
  assert.equal(s.combat.enemies[1].hp, allyHp - 3);
  s = setup('salt', 'bulwark', 'heretic');
  s.hero.skills.push('blood');
  const before = s.combat.enemies[0].hp,
    power = stats(s).power;
  s = step(s, { type: 'skill', id: 'blood', target: { x: 2, y: 4 } });
  assert.equal(s.hero.corruption, 2);
  assert.equal(s.combat.enemies[0].hp, before - (14 + power));
});
test('detonação mata o penitente, atinge aliados, quebra armadura e incendeia óleo', () => {
  let s = battle();
  s.combat.enemies = [];
  s.combat.terrain = {};
  const bomber = foe(s, 'bomber'),
    ally = foe(s, 'bulwark', 3, 4);
  const hp = ally.hp;
  s.combat.terrain['3,4'] = 'oil';
  planIntents(s);
  s = step(s, { type: 'endTurn' });
  assert.equal(s.combat.enemies[0].hp, 0);
  assert.equal(s.combat.enemies[1].armor, 1);
  assert.ok(s.combat.enemies[1].hp < hp - 7);
  assert.equal(s.combat.terrain['3,4'], 'fire');
  assert.equal(s.meta.kills, 1);
});
test('contratos novos pagam uma vez e a ordem exige o companheiro correto', () => {
  let s = createGame();
  s.quests.silence = 6;
  s = step(s, { type: 'claim', id: 'silence' });
  assert.equal(s.stash.bones, 75);
  assert.ok(s.hero.roster.includes('sibyl'));
  assert.equal(act(s, { type: 'claim', id: 'silence' }).ok, false);
  s = battle();
  s.hero.skills.push('suture');
  assert.equal(act(s, { type: 'skill', id: 'suture' }).ok, false);
});
test('modificador de cinzas também afeta arenas autorais; batalhas longas mantêm save válido', () => {
  let s = battle();
  s.expedition.modifier = { id: 'ember', name: 'Cinzas', desc: 'Teste' };
  startBattle(s, 'battle', 'gutters_ritual');
  assert.ok(Object.values(s.combat.terrain).filter((t) => t === 'fire').length >= 2);
  assert.ok(s.combat.objective.objects.every((o) => s.combat.terrain[`${o.x},${o.y}`] !== 'fire'));
  s = battle();
  for (let i = 0; i < 24; i++) {
    const e = foe(s, 'husk', 0, 0);
    e.hp = 0;
    e.rewarded = true;
  }
  s = step(s, { type: 'endTurn' });
  assert.ok(s.combat.enemies.length < 20);
  assert.deepEqual(decode(encode(s)), s);
});
test('identificadores herdados e intenções incompletas são rejeitados sem corromper recursos', () => {
  for (const a of [
    { type: 'shop', kind: 'weapon', id: 'constructor' },
    { type: 'learn', id: 'constructor' },
  ]) {
    const s = createGame();
    assert.equal(act(s, a).ok, false);
    assert.deepEqual(s.stash, { bones: 30, scrap: 4, ichor: 0 });
  }
  for (const change of [
    (s) => (s.hero.origin = 'constructor'),
    (s) => (s.combat.enemies[0].intent = { kind: 'move', cells: [], damage: 0 }),
    (s) => (s.combat.enemies[0].damage = -3),
  ]) {
    const s = battle();
    change(s);
    assert.equal(validateSave(s), false);
  }
});
test('falta de ícor identifica o material certo e não cobra ossos ou sucata', () => {
  const s = createGame();
  s.stash = { bones: 100, scrap: 30, ichor: 0 };
  const r = act(s, { type: 'engrave', id: 'frost' });
  assert.equal(r.ok, false);
  assert.match(r.error, /ícor/);
  assert.deepEqual(r.state.stash, s.stash);
});
