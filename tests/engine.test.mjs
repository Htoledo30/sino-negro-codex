import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  act,
  stats,
  startBattle,
  planIntents,
  clone,
  targetValid,
  preview,
  validateSave,
} from '../src/engine.js';
import { CLASSES, ENEMIES } from '../src/content.js';
import { encode, decode, save, load, SAVE_KEY, BACKUP_KEY } from '../src/storage.js';
const action = (s, a) => {
  const result = act(s, a);
  assert.equal(result.ok, true, result.error);
  return result.state;
};
function battle(origin = 'guard', seed = 42) {
  let s = createGame(origin, 'Teste', seed);
  s = action(s, { type: 'depart', id: 'gutters' });
  startBattle(s);
  return s;
}
function foe(s, kind = 'soldier', x = 2, y = 4) {
  const d = ENEMIES[kind];
  s.combat.enemies = [
    {
      id: 'test',
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
    },
  ];
  planIntents(s);
  return s.combat.enemies[0];
}
test('as três origens criam personagens com identidade e saves válidos', () => {
  for (const id of Object.keys(CLASSES)) {
    const s = createGame(id, 'A', 5);
    assert.equal(s.hero.hp, stats(s).maxHp);
    assert.equal(validateSave(s), true);
    assert.equal(s.hero.skills.length, 1);
    assert.deepEqual(decode(encode(s)), s);
  }
});
test('RNG e mapa reproduzíveis, sem rerrolagem no reload', () => {
  const a = action(createGame('guard', 'A', 99), { type: 'depart', id: 'gutters' }),
    b = action(createGame('guard', 'A', 99), { type: 'depart', id: 'gutters' });
  assert.deepEqual(a.expedition.routes, b.expedition.routes);
  assert.deepEqual(decode(encode(a)).expedition.routes, a.expedition.routes);
});
test('ações inválidas são atômicas; não gastam vigor, AP ou RNG', () => {
  const s = battle(),
    before = clone(s);
  const result = act(s, { type: 'skill', id: 'move', target: { x: 5, y: 0 } });
  assert.equal(result.ok, false);
  delete result.state.notice;
  delete before.notice;
  assert.deepEqual(result.state, before);
});
test('movimento evita intenção fixa', () => {
  let s = battle();
  foe(s);
  const hp = s.hero.hp;
  s = action(s, { type: 'skill', id: 'move', target: { x: 3, y: 5 } });
  s = action(s, { type: 'endTurn' });
  assert.equal(s.hero.hp, hp);
  assert.equal(s.combat.turn, 2);
});
test('aparo bloqueia e prepara contra-ataque, que é consumido no ataque', () => {
  let s = battle();
  foe(s);
  const hp = s.hero.hp;
  s = action(s, { type: 'skill', id: 'guard' });
  s = action(s, { type: 'endTurn' });
  assert.equal(s.hero.hp, hp);
  assert.equal(s.combat.player.counter, true);
  const enemyHp = s.combat.enemies[0].hp;
  s = action(s, { type: 'skill', id: 'strike', target: { x: 2, y: 4 } });
  assert.ok(s.combat.enemies[0].hp <= enemyHp - 14);
  assert.equal(s.combat.player.counter, false);
});
test('Ruptura quebra armadura e cancela golpe anunciado', () => {
  let s = battle();
  foe(s);
  const hp = s.hero.hp;
  s = action(s, { type: 'skill', id: 'bash', target: { x: 2, y: 4 } });
  assert.equal(s.combat.enemies[0].armor, 1);
  s = action(s, { type: 'endTurn' });
  assert.equal(s.hero.hp, hp);
  assert.equal(s.combat.enemies[0].stun, 0);
});
test('Sangramento ignora armadura e é resolvido antes da intenção fatal', () => {
  let s = battle('butcher');
  const e = foe(s);
  e.hp = 3;
  e.bleed = 4;
  const hp = s.hero.hp;
  s = action(s, { type: 'endTurn' });
  assert.equal(s.screen, 'reward');
  assert.equal(s.hero.hp, hp);
  assert.equal(s.meta.kills, 1);
});
test('óleo conectado + Brasa espalha fogo e dano sem atravessar pedra', () => {
  let s = battle('heretic');
  foe(s, 'husk', 2, 3);
  s.combat.terrain = { '2,3': 'oil', '3,3': 'oil', '4,3': 'oil' };
  s = action(s, { type: 'skill', id: 'spark', target: { x: 2, y: 3 } });
  assert.equal(s.combat.terrain['4,3'], 'fire');
  assert.equal(s.combat.enemies[0].burn, 2);
  assert.ok(s.combat.enemies[0].hp < 18);
});
test('empurrão no abismo mata; colisão interrompe', () => {
  let s = battle();
  foe(s, 'brute');
  s.combat.terrain['2,3'] = 'pit';
  s = action(s, { type: 'skill', id: 'shove', target: { x: 2, y: 4 } });
  assert.equal(s.screen, 'reward');
  let b = battle();
  foe(b, 'brute');
  b.combat.terrain['2,3'] = 'wall';
  b = action(b, { type: 'skill', id: 'shove', target: { x: 2, y: 4 } });
  assert.equal(b.combat.enemies[0].stun, 1);
});
test('alcance da lança e linha de visão da besta', () => {
  const s = battle();
  s.hero.weapon = 'spear';
  foe(s, 'husk', 2, 3);
  assert.equal(targetValid(s, 'strike', { x: 2, y: 3 }), true);
  assert.equal(targetValid(s, 'strike', { x: 3, y: 4 }), false);
  s.hero.weapon = 'crossbow';
  s.combat.terrain['2,4'] = 'wall';
  assert.equal(targetValid(s, 'strike', { x: 2, y: 3 }), false);
});
test('magia exige sangue suficiente e corrupção cobra vida', () => {
  let s = battle('heretic');
  foe(s);
  s.hero.skills.push('blood');
  s.hero.hp = 5;
  assert.equal(act(s, { type: 'skill', id: 'blood', target: { x: 2, y: 4 } }).ok, false);
  s.hero.hp = 30;
  s.hero.corruption = 6;
  s = action(s, { type: 'skill', id: 'move', target: { x: 3, y: 5 } });
  s = action(s, { type: 'endTurn' });
  assert.equal(s.hero.hp, 28);
});
test('compras, equipamento, melhorias e talentos têm efeito concreto', () => {
  let s = createGame();
  s.stash.bones = 200;
  s.stash.scrap = 50;
  s = action(s, { type: 'shop', kind: 'weapon', id: 'maul' });
  s = action(s, { type: 'equip', kind: 'weapon', id: 'maul' });
  const damage = stats(s).damage;
  s = action(s, { type: 'shop', kind: 'upgrade' });
  assert.equal(stats(s).damage, damage + 2);
  s = action(s, { type: 'learn', id: 'bulwark' });
  assert.equal(stats(s).maxHp, 58);
  assert.equal(s.hero.points, 0);
});
test('morte mantém equipamento, deixa cadáver, recuperação e retirada depositam', () => {
  let s = battle();
  foe(s, 'brute');
  s.hero.hp = 1;
  s.expedition.bag.bones = 37;
  s = action(s, { type: 'endTurn' });
  assert.equal(s.screen, 'death');
  assert.equal(s.hero.wounds, 1);
  assert.equal(s.corpse.bag.bones, 37);
  assert.equal(s.hero.weapon, 'sword');
  s = action(s, { type: 'home' });
  s = action(s, { type: 'depart', id: 'gutters' });
  s.expedition.depth = 2;
  s.expedition.routes[2] = [{ id: 'recovery', type: 'camp' }];
  s = action(s, { type: 'node', id: 'recovery' });
  assert.equal(s.corpse, null);
  assert.equal(s.expedition.bag.bones, 37);
  s = action(s, { type: 'retreat' });
  assert.equal(s.stash.bones, 67);
});
test('Última sentinela impede um dano fatal uma vez por combate', () => {
  let s = battle();
  foe(s, 'brute');
  s.hero.talents.push('resolve');
  s.hero.hp = 1;
  s = action(s, { type: 'endTurn' });
  assert.equal(s.screen, 'combat');
  assert.equal(s.hero.hp, 1);
  assert.equal(s.combat.usedResolve, true);
  s = action(s, { type: 'endTurn' });
  assert.equal(s.screen, 'combat');
  s = action(s, { type: 'endTurn' });
  assert.equal(s.screen, 'death');
});
test('cache e eventos avançam; altar só concede talento uma vez por distrito', () => {
  let s = action(createGame(), { type: 'depart', id: 'gutters' });
  s.screen = 'room';
  s.room = { type: 'event', event: 'altar' };
  const points = s.hero.points;
  s = action(s, { type: 'room', id: 0 });
  assert.equal(s.hero.points, points + 1);
  assert.equal(s.expedition.depth, 1);
  s.screen = 'room';
  s.room = { type: 'event', event: 'altar' };
  assert.equal(act(s, { type: 'room', id: 0 }).ok, false);
  s = action(s, { type: 'room', id: 1 });
  assert.equal(s.quests.relic, 1);
});
test('bosses têm fases distintas e finais abrem vigília', () => {
  for (const kind of ['executioner', 'abbess', 'warden', 'bellfather']) {
    const s = battle();
    foe(s, kind, 2, 1);
    const initial = clone(s.combat.enemies[0].intent);
    s.combat.enemies[0].hp = 10;
    planIntents(s);
    assert.ok(s.combat.enemies[0].intent.cells.length);
    if (kind === 'abbess' || kind === 'bellfather')
      assert.notDeepEqual(s.combat.enemies[0].intent.cells, initial.cells);
  }
  for (const ending of ['break', 'bind']) {
    let s = battle();
    s.screen = 'endingChoice';
    s.combat = null;
    s = action(s, { type: 'ending', id: ending });
    assert.equal(s.ending, ending);
    s = action(s, { type: 'home' });
    s = action(s, { type: 'depart', id: 'gutters', vigil: 1 });
    assert.equal(s.expedition.vigil, 1);
    assert.notEqual(s.expedition.modifier.id, 'normal');
  }
});
test('save com checksum corrompido é rejeitado e backup recupera a campanha', () => {
  const mem = new Map(),
    storage = { getItem: (k) => mem.get(k) || null, setItem: (k, v) => mem.set(k, v) };
  const s = createGame();
  save(s, storage);
  s.hero.hp--;
  save(s, storage);
  mem.set(SAVE_KEY, 'lixo');
  const restored = load(storage);
  assert.equal(restored.recovered, true);
  assert.equal(restored.state.hero.hp, 50);
  assert.throws(() => decode(encode(s).replace('checksum', 'damaged')));
  assert.ok(mem.get(BACKUP_KEY));
});
test('armazenamento indisponível reporta erro e não finge sucesso', () => {
  assert.equal(
    save(createGame(), {
      getItem: () => null,
      setItem: () => {
        throw new Error('Quota');
      },
    }).ok,
    false,
  );
});
test('cruzes guardam coordenadas independentes e nunca criam referência circular', () => {
  let s = battle('heretic');
  foe(s, 'executioner', 2, 1);
  s.combat.turn = 3;
  planIntents(s);
  assert.doesNotThrow(() => encode(s));
  foe(s, 'cantor', 2, 1);
  const intent = clone(s.combat.enemies[0].intent.cells);
  s = action(s, { type: 'skill', id: 'move', target: { x: 3, y: 5 } });
  assert.deepEqual(s.combat.enemies[0].intent.cells, intent);
});
test('ícor cria talentos ou remove marcas; confiança reduz preços', () => {
  let s = createGame();
  s.stash.ichor = 5;
  s.stash.bones = 80;
  s = action(s, { type: 'shop', kind: 'sacrament' });
  assert.equal(s.hero.points, 2);
  assert.equal(s.stash.ichor, 2);
  s.hero.wounds = 3;
  s.hero.corruption = 7;
  s = action(s, { type: 'shop', kind: 'transfusion' });
  assert.equal(s.hero.wounds, 0);
  assert.equal(s.hero.corruption, 0);
  assert.equal(s.hero.hp, 50);
  s.flags.reputation = 4;
  const bones = s.stash.bones;
  s = action(s, { type: 'shop', kind: 'flask' });
  assert.equal(s.stash.bones, bones - 6);
});
test('todos os eventos têm saída e efeitos de cada alternativa são implementados', async () => {
  const { EVENTS } = await import('../src/content.js');
  for (const [id, event] of Object.entries(EVENTS))
    for (let i = 0; i < event.choices.length; i++) {
      let s = action(createGame(), { type: 'depart', id: 'gutters' });
      s.screen = 'room';
      s.room = { type: 'event', event: id };
      s.hero.wounds = 1;
      s.supplies.flask = 3;
      s.stash.bones = 200;
      s.stash.scrap = 100;
      const result = act(s, { type: 'room', id: i });
      assert.equal(result.ok, true, `${id} opção ${i}: ${result.error}`);
      assert.equal(result.state.screen, 'route');
      assert.equal(result.state.expedition.depth, 1);
    }
});
test('saves com campos ausentes ou recursos inválidos são rejeitados antes do render', () => {
  for (const field of ['ownedWeapons', 'ownedArmor', 'ownedRelics', 'upgrades']) {
    const s = createGame();
    delete s.hero[field];
    assert.equal(validateSave(s), false);
  }
  const s = createGame();
  s.supplies.flask = -1;
  assert.equal(validateSave(s), false);
});
test('Quebra-ossos atinge e interrompe adjacentes; Ceifar consome Sangramento', () => {
  let s = battle();
  foe(s, 'brute');
  s.hero.skills.push('quake', 'reap');
  s = action(s, { type: 'skill', id: 'quake' });
  assert.equal(s.combat.enemies[0].stun, 1);
  s = action(s, { type: 'endTurn' });
  s.combat.enemies[0].bleed = 3;
  const hp = s.combat.enemies[0].hp;
  s = action(s, { type: 'skill', id: 'reap', target: { x: 2, y: 4 } });
  assert.equal(s.combat.enemies[0].hp, hp - 21);
  assert.equal(s.combat.enemies[0].bleed, 0);
});
