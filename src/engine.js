import {
  VERSION,
  GRID,
  CLASSES,
  WEAPONS,
  ARMORS,
  RELICS,
  TALENTS,
  SKILLS,
  ENEMIES,
  DISTRICTS,
  EVENTS,
  MODIFIERS,
  CONTRACTS,
} from './content.js';
import { RUNES, COMPANIONS, ENCOUNTERS, LAYOUTS, OBJECTIVES } from './expansion.js';

export const clone = (value) => JSON.parse(JSON.stringify(value));
export const runeFor = (s) => s.hero.runes?.[s.hero.weapon] || 'none';
// Mantém tabuleiro, intenções, RNG e recursos de campanhas da versão original.
export function migrateSave(value) {
  if (value?.version !== 1) return value;
  const s = clone(value);
  if (!s.hero || !s.quests) return value;
  s.version = VERSION;
  s.hero.runes = {};
  s.hero.ownedRunes = [];
  s.hero.companion = null;
  s.hero.roster = s.quests.rescue ? ['mara'] : [];
  s.quests.ivo = 0;
  s.quests.silence = 0;
  s.codex = {};
  if (s.expedition) s.expedition.scouted = [];
  if (s.combat) {
    s.combat.objective = { kind: 'eliminate', objects: [], complete: false };
    s.combat.companionUsed = false;
    s.combat.player.root = 0;
    for (const e of s.combat.enemies) s.codex[e.kind] ||= { seen: 1, kills: 0 };
  }
  return s;
}
export const key = (x, y) => `${x},${y}`;
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const inside = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;
export const adjacent = (p) =>
  [
    { x: p.x + 1, y: p.y },
    { x: p.x - 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x, y: p.y - 1 },
  ].filter((q) => inside(q.x, q.y));
export function random(s) {
  s.rng = (s.rng ^ (s.rng << 13)) >>> 0;
  s.rng = (s.rng ^ (s.rng >>> 17)) >>> 0;
  s.rng = (s.rng ^ (s.rng << 5)) >>> 0;
  return s.rng / 4294967296;
}
const pick = (s, arr) => arr[Math.floor(random(s) * arr.length)];
export function log(s, text, type = 'info') {
  s.log.push({ text, type, seq: ++s.sequence });
  if (s.log.length > 70) s.log.shift();
}
export function stats(s) {
  const h = s.hero,
    cl = CLASSES[h.origin],
    level = h.level - 1;
  return {
    maxHp: Math.max(22, cl.hp + level * 4 + (h.talents.includes('bulwark') ? 8 : 0) - h.wounds * 3),
    maxVigor: cl.vigor + ARMORS[h.armor].vigor + Math.floor(level / 3),
    armor: ARMORS[h.armor].armor,
    power: cl.power + Math.floor(level / 2),
    damage:
      WEAPONS[h.weapon].damage +
      (h.upgrades[h.weapon] || 0) * 2 +
      Math.floor(level / 2) +
      RUNES[runeFor(s)].damage,
  };
}
export function createGame(origin = 'guard', name = 'Condenado', seed = Date.now()) {
  if (!Object.hasOwn(CLASSES, origin)) throw new Error('Origem inválida.');
  const s = {
    version: VERSION,
    rng: seed >>> 0 || 1,
    sequence: 0,
    screen: 'hub',
    log: [],
    journal: [
      'O sino tocou treze vezes. Na última, os mortos responderam. Você acordou entre os que não tinham língua.',
    ],
    hero: {
      name: String(name || 'Condenado')
        .trim()
        .slice(0, 24),
      origin,
      level: 1,
      xp: 0,
      points: 1,
      hp: 1,
      vigor: 1,
      wounds: 0,
      corruption: 0,
      weapon: CLASSES[origin].weapon,
      armor: 'rags',
      relic: 'none',
      ownedWeapons: [CLASSES[origin].weapon],
      ownedArmor: ['rags'],
      ownedRelics: [],
      upgrades: {},
      runes: {},
      ownedRunes: [],
      companion: null,
      roster: [],
      talents: [...CLASSES[origin].talents],
      skills: [...CLASSES[origin].skills],
    },
    stash: { bones: 30, scrap: 4, ichor: 0 },
    supplies: { flask: 3, oil: 1, bomb: 1 },
    seals: [],
    flags: {},
    quests: { rescue: 0, relic: 0, hunt: 0, ivo: 0, silence: 0 },
    codex: {},
    claimed: [],
    expedition: null,
    combat: null,
    room: null,
    corpse: null,
    ending: null,
    meta: { deaths: 0, kills: 0, expeditions: 0, clears: 0, bestVigil: 0 },
    options: { sound: false, motion: true },
    notice: '',
    lastSave: 0,
  };
  s.hero.hp = stats(s).maxHp;
  s.hero.vigor = stats(s).maxVigor;
  log(s, 'Ossuário alcançado. Escolha uma rota. Menus não consomem tempo.');
  return s;
}
export function xpNeeded(s) {
  return 24 + (s.hero.level - 1) * 18;
}
export function gainXP(s, amount) {
  s.hero.xp += amount;
  while (s.hero.xp >= xpNeeded(s) && s.hero.level < 20) {
    s.hero.xp -= xpNeeded(s);
    s.hero.level++;
    s.hero.points++;
    s.hero.hp = Math.min(stats(s).maxHp, s.hero.hp + 8);
    log(s, `Nível ${s.hero.level}. +1 talento; feridas fecham em 8 vida.`, 'good');
  }
}
function currency(s) {
  return s.expedition ? s.expedition.bag : s.stash;
}
function award(s, bones = 0, scrap = 0, ichor = 0) {
  const c = currency(s);
  c.bones += bones;
  c.scrap += scrap;
  c.ichor += ichor;
}
function funds(s, kind) {
  return s.stash[kind] + (s.expedition?.bag[kind] || 0);
}
export function discount(s) {
  return Math.min(4, Math.max(0, s.flags.reputation || 0));
}
export function price(s, kind) {
  return kind === 'flask'
    ? Math.max(4, (s.claimed.includes('rescue') ? 6 : 10) - discount(s))
    : kind === 'merchantRelic'
      ? 35 - discount(s) * 2
      : kind === 'merchantBomb'
        ? 12 - discount(s)
        : 0;
}
function pay(s, kind, n) {
  if (funds(s, kind) < n)
    throw new Error(`Faltam ${n - funds(s, kind)} ${kind === 'bones' ? 'ossos' : 'sucatas'}.`);
  const c = currency(s),
    used = Math.min(c[kind], n);
  c[kind] -= used;
  if (used < n) s.stash[kind] -= n - used;
}
function heal(s, n) {
  s.hero.hp = Math.min(stats(s).maxHp, s.hero.hp + n);
}
function addRelic(s, id) {
  if (!s.hero.ownedRelics.includes(id)) {
    s.hero.ownedRelics.push(id);
    log(s, `Relíquia encontrada: ${RELICS[id].name}. Equipe no inventário.`, 'good');
  } else award(s, 12, 2);
}
function relicQuest(s) {
  s.quests.relic = Math.min(3, s.quests.relic + 1);
}
export function makeRoutes(s, district = s.expedition?.district || 'gutters') {
  const route = [];
  for (let depth = 0; depth < 6; depth++) {
    const options =
      depth === 0
        ? ['battle', 'event']
        : depth === 2
          ? ['camp', 'battle', 'event']
          : depth === 4
            ? ['elite', 'camp', 'merchant']
            : [pick(s, ['battle', 'elite']), pick(s, ['event', 'cache', 'merchant'])];
    if (depth === 5) options.splice(0, options.length, 'camp', 'elite', 'cache');
    route.push(
      [...new Set(options)].map((type, i) => ({
        id: `${depth}-${i}`,
        type,
        seed: Math.floor(random(s) * 1e9),
        encounter: ['battle', 'elite'].includes(type)
          ? pick(
              s,
              Object.keys(ENCOUNTERS).filter((id) => ENCOUNTERS[id].district === district),
            )
          : null,
      })),
    );
  }
  route.push([{ id: '6-0', type: 'boss', seed: Math.floor(random(s) * 1e9) }]);
  return route;
}
function startExpedition(s, id, vigil = 0) {
  if (!Number.isSafeInteger(vigil) || vigil < 0) throw new Error('Número de Vigília inválido.');
  const district = DISTRICTS.find((d) => d.id === id);
  if (!district) throw new Error('Distrito desconhecido.');
  if (id === 'cathedral' && s.seals.length < 3) throw new Error('A Catedral exige os três selos.');
  if (vigil && !s.ending) throw new Error('A Vigília se abre após o desfecho.');
  s.meta.expeditions++;
  s.expedition = {
    district: id,
    depth: 0,
    routes: makeRoutes(s, id),
    scouted: [],
    bag: { bones: 0, scrap: 0, ichor: 0 },
    light: 9,
    modifier: clone(vigil ? pick(s, MODIFIERS.slice(1)) : MODIFIERS[0]),
    vigil: Math.max(0, vigil),
    seen: [],
    recoverable: s.corpse?.district === id,
  };
  s.hero.vigor = stats(s).maxVigor;
  s.screen = 'route';
  s.room = null;
  if (!s.flags[`entered-${id}`]) {
    s.journal.push(district.intro);
    s.flags[`entered-${id}`] = true;
  }
  log(s, `Expedição: ${district.name}. Retirar-se entre encontros deposita todos os espólios.`);
}
function returnHome(s, success = false) {
  if (s.expedition) for (const k of ['bones', 'scrap', 'ichor']) s.stash[k] += s.expedition.bag[k];
  s.expedition = null;
  s.combat = null;
  s.room = null;
  s.screen = 'hub';
  s.hero.vigor = stats(s).maxVigor;
  log(
    s,
    success
      ? 'Você volta com o selo e deposita os espólios.'
      : 'Você recua vivo. Espólios depositados.',
    'good',
  );
}
function die(s) {
  s.meta.deaths++;
  s.hero.wounds = Math.min(5, s.hero.wounds + 1);
  s.corpse = s.expedition
    ? { district: s.expedition.district, bag: clone(s.expedition.bag) }
    : null;
  s.expedition = null;
  s.combat = null;
  s.room = null;
  s.screen = 'death';
  s.hero.corruption = Math.max(0, s.hero.corruption - 2);
  s.hero.hp = stats(s).maxHp;
  s.hero.vigor = stats(s).maxVigor;
  s.supplies.flask = Math.max(2, s.supplies.flask);
  log(
    s,
    'Você morreu. Uma cicatriz permanece; os espólios ficaram no cadáver. Equipamento, talentos e selos sobreviveram.',
    'bad',
  );
}
export function tileAt(s, p) {
  return s.combat?.terrain[key(p.x, p.y)] || 'stone';
}
export function enemyAt(s, p) {
  return s.combat?.enemies.find((e) => e.hp > 0 && e.x === p.x && e.y === p.y);
}
const isBlocked = (s, p, ignoreUnits = false) =>
  !inside(p.x, p.y) || ['wall', 'pit'].includes(tileAt(s, p)) || (!ignoreUnits && !!enemyAt(s, p));
export function line(a, b) {
  let x = a.x,
    y = a.y;
  const out = [],
    dx = Math.abs(b.x - x),
    dy = -Math.abs(b.y - y),
    sx = x < b.x ? 1 : -1,
    sy = y < b.y ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < GRID * 2; i++) {
    out.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e = 2 * err;
    if (e >= dy) {
      err += dy;
      x += sx;
    }
    if (e <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}
export function visible(s, a, b) {
  return line(a, b)
    .slice(1, -1)
    .every((p) => tileAt(s, p) !== 'wall');
}
function pathToward(s, e, p, steps = 1) {
  const queue = [{ p: { x: e.x, y: e.y }, path: [] }],
    seen = new Set([key(e.x, e.y)]);
  let best = queue[0];
  while (queue.length) {
    const c = queue.shift();
    if (distance(c.p, p) < distance(best.p, p)) best = c;
    if (distance(c.p, p) === 1) {
      best = c;
      break;
    }
    for (const n of adjacent(c.p).sort((a, b) => distance(a, p) - distance(b, p))) {
      const k = key(n.x, n.y);
      if (seen.has(k) || isBlocked(s, n) || distance(n, p) === 0) continue;
      seen.add(k);
      queue.push({ p: n, path: [...c.path, n] });
    }
  }
  return best.path[Math.min(steps, best.path.length) - 1] || { x: e.x, y: e.y };
}
export function startBattle(s, type = 'battle', encounterId = null) {
  const ex = s.expedition,
    d = DISTRICTS.find((d) => d.id === ex.district),
    depth = ex.depth;
  s.combat = {
    type,
    turn: 1,
    ap: ex.scouted?.includes(depth) ? 3 : 2,
    player: { x: 2, y: 5, bleed: 0, guard: 0, counter: false, root: 0 },
    enemies: [],
    terrain: {},
    usedResolve: false,
    damageTaken: 0,
    actions: 0,
    history: [],
    companionUsed: false,
    encounter: encounterId,
    objective: { kind: 'eliminate', objects: [], complete: false },
  };
  s.hero.vigor = stats(s).maxVigor;
  const c = s.combat;
  const encounter = ENCOUNTERS[encounterId];
  if (encounter && type !== 'boss') {
    const layout = LAYOUTS[encounter.layout];
    for (const [list, tile] of [
      ['walls', 'wall'],
      ['pits', 'pit'],
      ['oil', 'oil'],
    ])
      for (const k of layout[list]) c.terrain[k] = tile;
    c.objective.kind = encounter.objective;
    if (encounter.objective === 'ritual')
      c.objective.objects = [
        { x: 0, y: 2, active: true },
        { x: 5, y: 2, active: true },
      ];
    if (encounter.objective === 'rescue')
      c.objective.objects = [{ x: 4, y: 2, active: true, hp: 12 }];
    if (encounter.objective === 'supplies') c.objective.objects = [{ x: 3, y: 3, active: true }];
    if (encounter.objective === 'siege') c.objective.objects = [{ x: 2, y: 5, active: true }];
    for (const o of c.objective.objects) delete c.terrain[key(o.x, o.y)];
  } else {
    c.terrain['1,2'] = 'wall';
    c.terrain['4,3'] = 'wall';
    for (let i = 0; i < 7; i++) {
      const p = { x: Math.floor(random(s) * GRID), y: 1 + Math.floor(random(s) * 4) };
      if ((p.x === 2 && p.y >= 4) || c.terrain[key(p.x, p.y)]) continue;
      c.terrain[key(p.x, p.y)] = ex.modifier.id === 'ember' && i % 2 === 0 ? 'fire' : d.terrain;
    }
  }
  const count =
    type === 'boss'
      ? 1
      : Math.min(4, (depth < 2 ? 2 : 3) + (type === 'elite' ? 1 : 0) + (ex.light === 0 ? 1 : 0));
  const slots = [
    { x: 2, y: 1 },
    { x: 4, y: 0 },
    { x: 0, y: 1 },
    { x: 5, y: 2 },
  ];
  const foes = encounter && type !== 'boss' ? [...encounter.foes] : null;
  if (encounter && ex.modifier.id === 'ember') {
    const candidates = [
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 2 },
      { x: 1, y: 4 },
    ];
    for (const p of candidates
      .filter(
        (p) =>
          !['wall', 'pit'].includes(tileAt(s, p)) &&
          !c.objective.objects.some((o) => distance(o, p) === 0),
      )
      .slice(0, 2))
      c.terrain[key(p.x, p.y)] = 'fire';
  }
  if (foes && type === 'elite' && foes.length < 4) foes.push(d.enemies[0]);
  if (foes && ex.light === 0 && foes.length < 4) foes.push(d.enemies[0]);
  for (let i = 0; i < (foes?.length || count); i++)
    spawn(
      s,
      foes ? foes[i] : type === 'boss' ? d.boss : pick(s, d.enemies),
      slots[i],
      type === 'elite',
    );
  // Nunca gere um inimigo isolado por abismos: uma build corpo a corpo deve alcançar todos.
  const reached = new Set(),
    queue = [c.player];
  while (queue.length) {
    const p = queue.shift(),
      k = key(p.x, p.y);
    if (reached.has(k) || ['wall', 'pit'].includes(tileAt(s, p))) continue;
    reached.add(k);
    queue.push(...adjacent(p).filter((n) => !reached.has(key(n.x, n.y))));
  }
  if (c.enemies.some((e) => !reached.has(key(e.x, e.y))))
    for (const k of Object.keys(c.terrain)) if (c.terrain[k] === 'pit') delete c.terrain[k];
  s.screen = 'combat';
  planIntents(s);
  log(
    s,
    type === 'boss'
      ? `O guardião desperta: ${ENEMIES[d.boss].name}.`
      : 'O silêncio acaba. Leia as intenções antes de agir.',
    'bad',
  );
}
function spawn(s, kind, p, elite = false) {
  const ex = s.expedition,
    def = ENEMIES[kind],
    scale = (DISTRICTS.find((d) => d.id === ex.district).level - 1) * 2 + ex.vigil * 3;
  delete s.combat.terrain[key(p.x, p.y)];
  const e = {
    id: `e${s.sequence}-${s.combat.turn}-${s.combat.enemies.length}`,
    kind,
    ...p,
    hp: def.hp + scale + (elite ? 5 : 0),
    maxHp: def.hp + scale + (elite ? 5 : 0),
    armor: def.armor + (ex.modifier.id === 'iron' ? 1 : 0),
    damage: def.damage + Math.floor(ex.vigil / 2) + (ex.modifier.id === 'frenzy' ? 2 : 0),
    bleed: 0,
    burn: 0,
    stun: 0,
    intent: null,
    rewarded: false,
  };
  s.combat.enemies.push(e);
  s.codex[kind] ||= { seen: 0, kills: 0 };
  s.codex[kind].seen++;
  return e;
}
function cross(p, r = 1) {
  return [
    { x: p.x, y: p.y },
    ...Array.from({ length: r }, (_, i) => i + 1).flatMap((n) => [
      { x: p.x + n, y: p.y },
      { x: p.x - n, y: p.y },
      { x: p.x, y: p.y + n },
      { x: p.x, y: p.y - n },
    ]),
  ].filter((p) => inside(p.x, p.y));
}
function row(p) {
  return Array.from({ length: GRID }, (_, x) => ({ x, y: p.y }));
}
function col(p) {
  return Array.from({ length: GRID }, (_, y) => ({ x: p.x, y }));
}
export function planIntents(s) {
  const c = s.combat,
    p = c.player;
  for (const e of c.enemies.filter((e) => e.hp > 0)) {
    const def = ENEMIES[e.kind],
      ai = def.ai,
      dist = distance(e, p),
      phase = e.hp <= e.maxHp / 2,
      turn = c.turn;
    let intent = { kind: 'attack', label: 'Golpear', cells: [], damage: e.damage };
    if (e.stun) {
      e.intent = { kind: 'stun', label: 'Interrompido', cells: [], damage: 0 };
      continue;
    }
    if (ai === 'healer') {
      const ally = c.enemies
        .filter((a) => a !== e && a.hp > 0 && a.hp < a.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      intent = ally
        ? {
            kind: 'heal',
            label: `Costurar · ${ENEMIES[ally.kind].name} +9`,
            ally: ally.id,
            cells: [{ x: ally.x, y: ally.y }],
            damage: 0,
          }
        : { ...intent, label: 'Profanar · cruz', cells: cross(p), magic: true };
    } else if (ai === 'bomber') {
      intent =
        dist <= 2
          ? { ...intent, label: 'Detonar · cruz', cells: cross(e, 2), explode: true }
          : {
              kind: 'move',
              label: 'Correr · 2 casas',
              dest: pathToward(s, e, p, 2),
              cells: [],
              damage: 0,
            };
    } else if (ai === 'archer' || ai === 'gaoler') {
      if (visible(s, e, p)) {
        intent.cells = line(e, p).slice(1);
        intent.label = ai === 'gaoler' ? 'Correntes · linha' : 'Disparo · linha';
        if (ai === 'gaoler') intent.root = 2;
      } else
        intent = {
          kind: 'move',
          label: 'Buscar ângulo',
          dest: pathToward(s, e, p, 1),
          cells: [],
          damage: 0,
        };
    } else if (ai === 'caster') {
      intent.cells = cross(p);
      intent.label = 'Profanar · cruz';
      intent.corruption = 1;
      intent.magic = true;
    } else if (ai === 'brute' && (e.x === p.x || e.y === p.y) && dist > 1 && !e.blockedCharge) {
      intent.cells = line(e, p).slice(1);
      intent.label = 'Investida';
      intent.charge = true;
    } else if (ai.startsWith('boss')) {
      if (ai === 'bossButcher') {
        if (turn % 3 === 1) {
          intent.cells = e.x === p.x ? col(p) : row(p);
          intent.label = 'Guilhotina · linha';
          intent.damage += 3;
        } else if (turn % 3 === 2) {
          intent.cells = cross(p, phase ? 2 : 1);
          intent.label = 'Gancho · cruz';
          intent.bleed = 2;
        } else {
          intent.cells = cross(e, 2);
          intent.label = 'Retalhar · área próxima';
        }
        if (phase) intent.fire = true;
      } else if (ai === 'bossAbbess') {
        if (turn % 3 === 0 && c.enemies.filter((e) => e.hp > 0).length < 4) {
          intent = { kind: 'summon', label: 'Parir sanguessuga', cells: [], damage: 0 };
        } else {
          intent.cells = [...cross(p), ...(phase ? cross({ x: 5 - p.x, y: 5 - p.y }) : [])];
          intent.label = phase ? 'Praga · duas cruzes' : 'Praga · cruz';
          intent.bleed = 2;
        }
      } else if (ai === 'bossWarden') {
        intent.cells = turn % 2 === 1 ? row(p) : col(p);
        intent.label = turn % 2 === 1 ? 'Esmagar · fileira' : 'Sentença · coluna';
        intent.drain = phase ? 3 : 1;
      } else {
        if (turn % 4 === 0 && c.enemies.filter((e) => e.hp > 0).length < 4) {
          intent = { kind: 'summon', label: 'Convocar o coro', cells: [], damage: 0 };
        } else {
          intent.cells = phase ? (turn % 2 ? row(p) : col(p)) : cross(p);
          intent.label = phase ? 'Badalada · linha' : 'Último nome · cruz';
          intent.corruption = 2;
        }
      }
    } else if (dist <= 1 || (ai === 'hound' && dist <= 2 && visible(s, e, p))) {
      intent.cells = [{ x: p.x, y: p.y }];
      intent.label =
        ai === 'hound' ? 'Salto · mordida' : ai === 'leech' ? 'Drenar sangue' : 'Golpear';
      intent.bleed = ai === 'hound' ? 1 : 0;
      intent.leech = ai === 'leech';
    } else
      intent = {
        kind: 'move',
        label: ai === 'hound' ? 'Correr · 2 casas' : 'Aproximar · 1 casa',
        dest: pathToward(s, e, p, ai === 'hound' ? 2 : 1),
        cells: [],
        damage: 0,
      };
    if (intent.dest) intent.cells = [intent.dest];
    // Intenção fixa também anuncia a fuga de um chão em chamas.
    if (tileAt(s, e) === 'fire') {
      const escape = adjacent(e)
        .filter((t) => !isBlocked(s, t) && distance(t, p) > 0 && tileAt(s, t) !== 'fire')
        .sort((a, b) => distance(a, p) - distance(b, p))[0];
      if (escape) {
        if (intent.kind === 'move') {
          intent.dest = escape;
          intent.cells = [escape];
        } else intent.moveAfter = escape;
        intent.label += ' · sair do fogo';
      }
    }
    if (intent.kind === 'move') e.blockedCharge = false;
    e.intent = intent;
  }
}
export function threatened(s, p) {
  return (
    s.combat?.enemies.filter(
      (e) =>
        e.hp > 0 &&
        e.intent?.kind === 'attack' &&
        e.intent.cells.some((t) => t.x === p.x && t.y === p.y),
    ) || []
  );
}
export function skillCost(s, id) {
  const sk = SKILLS[id],
    weapon = WEAPONS[s.hero.weapon];
  if (!sk) return { ap: 99, stamina: 99 };
  return {
    ap: sk.ap,
    stamina:
      (['strike', 'heavy', 'lunge'].includes(id) ? RUNES[runeFor(s)].vigor : 0) +
      (['move', 'blink', 'lunge'].includes(id) ? s.combat?.player.root || 0 : 0) +
      (id === 'strike'
        ? weapon.cost
        : id === 'heavy'
          ? weapon.cost + 2
          : id === 'guard' && s.hero.talents.includes('bulwark')
            ? 0
            : sk.stamina),
  };
}
export function availableSkills(s) {
  return [
    'move',
    'strike',
    'heavy',
    'guard',
    'shove',
    ...s.hero.skills,
    'flask',
    'oil',
    'bomb',
    ...(s.combat?.objective.objects.some((o) => o.active) ? ['interact'] : []),
    ...(s.hero.companion && s.combat && !s.combat.companionUsed
      ? [COMPANIONS[s.hero.companion].skill]
      : []),
  ].filter((v, i, a) => a.indexOf(v) === i);
}
export function targetValid(s, id, target) {
  const c = s.combat;
  if (!c || !SKILLS[id]) return false;
  const sk = SKILLS[id],
    p = c.player,
    w = WEAPONS[s.hero.weapon];
  if (sk.target === 'self') return true;
  if (
    !target ||
    !Number.isInteger(target.x) ||
    !Number.isInteger(target.y) ||
    !inside(target.x, target.y)
  )
    return false;
  if (sk.target === 'enemy' && !enemyAt(s, target)) return false;
  const dist = distance(p, target),
    range = ['strike', 'heavy'].includes(id) ? w.range : sk.range || 1;
  if (dist > range || (dist === 0 && ['move', 'blink'].includes(id))) return false;
  if (id === 'interact')
    return (
      c.objective.objects.some(
        (o) => o.active && o.x === target.x && o.y === target.y && !enemyAt(s, o),
      ) &&
      (c.objective.kind !== 'siege' || c.turn >= 6)
    );
  if (id === 'silence') {
    const intent = enemyAt(s, target).intent;
    return (
      ['heal', 'summon'].includes(intent.kind) ||
      (intent.kind === 'attack' &&
        (intent.magic ||
          ['caster', 'healer', 'bossAbbess', 'bossBell'].includes(
            ENEMIES[enemyAt(s, target).kind].ai,
          )))
    );
  }
  if (['strike', 'heavy'].includes(id) && w.range === 2 && p.x !== target.x && p.y !== target.y)
    return false;
  if (id === 'move') return !isBlocked(s, target);
  if (id === 'blink') return !isBlocked(s, target);
  if (id === 'lunge') {
    if (p.x !== target.x && p.y !== target.y) return false;
    return line(p, target)
      .slice(1, -1)
      .every((t) => !isBlocked(s, t));
  }
  return visible(s, p, target);
}
export function preview(s, id, target) {
  if (!s.combat) return '';
  const c = skillCost(s, id),
    e = target && enemyAt(s, target),
    w = WEAPONS[s.hero.weapon];
  let damage = 0;
  if (['strike', 'heavy', 'lunge'].includes(id)) {
    damage =
      stats(s).damage +
      (id === 'heavy' ? 7 : id === 'lunge' ? 3 : 0) +
      (s.combat.player.counter
        ? 3 + (s.hero.talents.includes('sentinel') ? 5 : 0) + (runeFor(s) === 'echo' ? 3 : 0)
        : 0);
    if (e && s.hero.talents.includes('predator') && e.hp < e.maxHp / 2) damage += 4;
  } else
    damage =
      id === 'bash'
        ? 5
        : id === 'reap'
          ? 12 + (e?.bleed || 0) * 3
          : id === 'blood'
            ? 11 +
              (runeFor(s) === 'salt' ? 3 : 0) +
              stats(s).power +
              (s.hero.talents.includes('abyss')
                ? Math.min(8, s.hero.corruption + (runeFor(s) === 'salt' ? 2 : 1))
                : 0)
            : id === 'spark'
              ? 7 + fireBonus(s)
              : id === 'bomb'
                ? 13
                : id === 'quake'
                  ? 8
                  : id === 'hook'
                    ? 4
                    : id === 'silence'
                      ? 6 + stats(s).power
                      : 0;
  if (id === 'hook' && e) {
    const dx = s.combat.player.x - e.x,
      dy = s.combat.player.y - e.y;
    const dest = {
      x: e.x + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0),
      y: e.y + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0),
    };
    if (isBlocked(s, dest) || distance(dest, s.combat.player) === 0) damage = 8;
  }
  if (e && damage && !['reap', 'blood', 'silence'].includes(id))
    damage = Math.max(
      1,
      damage -
        (id === 'spark'
          ? Math.floor(e.armor / 2)
          : ['bash', 'bomb', 'hook'].includes(id)
            ? Math.max(0, e.armor - (id === 'hook' ? 1 : 2))
            : e.armor) -
        (id === 'spark' ? 0 : ward(s, e)),
    );
  return `${c.ap} ${c.ap > 1 ? 'ações' : 'ação'} · ${c.stamina} vigor${damage ? ` · ${damage} dano${w.bleed && ['strike', 'heavy', 'lunge'].includes(id) ? ' + Sangramento' : ''}` : ''}`;
}
function fireBonus(s) {
  return (
    stats(s).power +
    (s.hero.talents.includes('pyromancer') ? 2 : 0) +
    (s.hero.relic === 'coal' ? 2 : 0) +
    (runeFor(s) === 'salt' ? 3 : 0)
  );
}
function interrupt(s, e) {
  e.stun = 1;
  e.intent = { kind: 'stun', cells: [], label: 'Interrompido', damage: 0 };
  if (s.hero.relic === 'bell') s.hero.vigor = Math.min(stats(s).maxVigor, s.hero.vigor + 2);
}
export function ward(s, e) {
  return s.combat.enemies.some(
    (a) => a !== e && a.hp > 0 && ENEMIES[a.kind].role === 'ward' && distance(a, e) === 1,
  )
    ? 3
    : 0;
}
function hitEnemy(s, e, n, { pure = false, fire = false } = {}) {
  if (!e || e.hp <= 0) return;
  const dmg = Math.max(1, n - (pure ? 0 : fire ? Math.floor(e.armor / 2) : e.armor + ward(s, e)));
  e.hp = Math.max(0, e.hp - dmg);
  log(s, `${ENEMIES[e.kind].name}: −${dmg} vida${fire ? ' · fogo' : ''}.`, 'hit');
  if (fire) {
    e.burn = Math.max(e.burn, 2);
    if (e.hp <= 0 && s.hero.talents.includes('communion')) heal(s, 2);
  }
  rewardKills(s);
}
function rewardKills(s) {
  for (const e of s.combat.enemies)
    if (e.hp <= 0 && !e.rewarded) {
      e.rewarded = true;
      s.meta.kills++;
      s.quests.hunt = Math.min(12, s.quests.hunt + 1);
      if (['cantor', 'stitcher', 'gaoler'].includes(e.kind))
        s.quests.silence = Math.min(6, s.quests.silence + 1);
      s.codex[e.kind] ||= { seen: 1, kills: 0 };
      s.codex[e.kind].kills++;
      gainXP(s, ENEMIES[e.kind].xp);
      if (s.hero.relic === 'chalice') heal(s, 3);
      if (s.hero.talents.includes('predator'))
        s.hero.vigor = Math.min(stats(s).maxVigor, s.hero.vigor + 2);
      log(s, `${ENEMIES[e.kind].name} morreu.`, 'good');
    }
}
function playerDamage(s, n, pure = false) {
  const c = s.combat,
    p = c?.player;
  let dmg = Math.max(0, n - (pure ? 0 : stats(s).armor));
  if (p && !pure && p.guard > 0) {
    const blocked = Math.min(dmg, p.guard);
    dmg -= blocked;
    p.guard -= blocked;
    if (blocked) {
      p.counter = true;
      log(s, `Aparo: ${blocked} dano bloqueado. Contra-ataque preparado.`, 'good');
    }
  }
  s.hero.hp -= dmg;
  if (c) c.damageTaken += dmg;
  if (dmg) log(s, `Você perde ${dmg} vida.`, 'bad');
  if (s.hero.hp <= 0 && c && s.hero.talents.includes('resolve') && !c.usedResolve) {
    s.hero.hp = 1;
    c.usedResolve = true;
    for (const e of c.enemies) interrupt(s, e);
    log(
      s,
      'Última sentinela: você se recusa a cair. Todas as intenções foram interrompidas.',
      'good',
    );
  }
  return dmg;
}
function terrainDamage(s, unit, player = false) {
  const t = tileAt(s, unit);
  if (t === 'fire') {
    if (player && s.hero.relic === 'coal') return;
    if (player) playerDamage(s, 5, true);
    else hitEnemy(s, unit, 5, { pure: true, fire: true });
  }
}
function ignite(s, p, impact = 7 + fireBonus(s), affected = new Set()) {
  const queue = [p],
    seen = new Set();
  while (queue.length) {
    const q = queue.shift(),
      k = key(q.x, q.y);
    if (seen.has(k) || affected.has(k)) continue;
    seen.add(k);
    const isOil = tileAt(s, q) === 'oil';
    if (tileAt(s, q) === 'wall' || tileAt(s, q) === 'pit') continue;
    s.combat.terrain[k] = 'fire';
    affected.add(k);
    const e = enemyAt(s, q);
    if (e) hitEnemy(s, e, impact, { fire: true });
    harmPrisoner(s, [q], impact);
    if (isOil) for (const n of adjacent(q)) if (tileAt(s, n) === 'oil') queue.push(n);
  }
}
function interact(s, t) {
  const objective = s.combat.objective;
  const o = objective.objects.find((o) => o.active && o.x === t.x && o.y === t.y);
  o.active = false;
  if (objective.kind === 'ritual') {
    log(s, 'Uma âncora se rompe. O ritual perde uma voz.', 'good');
    if (objective.objects.every((o) => !o.active)) {
      objective.complete = true;
      award(s, 12, 2);
      gainXP(s, 18);
    }
  } else if (objective.kind === 'rescue') {
    s.quests.ivo = 1;
    award(s, 8, 1);
    gainXP(s, 10);
    log(s, 'Você abre as correntes. Ivo foge para o Ossuário.', 'good');
  } else if (objective.kind === 'supplies') {
    s.supplies.flask++;
    s.supplies.bomb++;
    log(s, 'Provisões recolhidas: +1 bálsamo, +1 bomba.', 'good');
  } else if (objective.kind === 'siege') {
    objective.complete = true;
    gainXP(s, 18);
    award(s, 8, 2);
    log(s, 'A porta cede. Você cruza antes da próxima onda.', 'good');
  }
}
function harmPrisoner(s, cells, damage) {
  if (s.combat.objective.kind !== 'rescue') return;
  const o = s.combat.objective.objects[0];
  if (!o.active || !cells.some((p) => p.x === o.x && p.y === o.y)) return;
  o.hp = Math.max(0, o.hp - damage);
  if (!o.hp) {
    o.active = false;
    log(s, 'O prisioneiro morre nas correntes. Você perdeu este resgate.', 'bad');
  } else log(s, `O prisioneiro perde ${damage} vida; restam ${o.hp}.`, 'bad');
}
function reinforce(s) {
  const c = s.combat;
  if (c.objective.kind !== 'siege' || ![3, 5].includes(c.turn)) return;
  const district = DISTRICTS.find((d) => d.id === s.expedition.district);
  for (let i = 0; i < 2; i++) {
    const slot = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 1 },
    ].find((p) => !isBlocked(s, p) && distance(p, c.player) > 0);
    if (slot)
      spawn(
        s,
        c.turn === 5 && i === 0 ? 'gaoler' : district.enemies[i % district.enemies.length],
        slot,
      );
  }
  log(s, `Turno ${c.turn}: reforços atravessam a porta.`, 'bad');
}
function recruit(s) {
  for (const [id, def] of Object.entries(COMPANIONS))
    if (s.quests[def.require] >= CONTRACTS[def.require].target && !s.hero.roster.includes(id)) {
      s.hero.roster.push(id);
      s.journal.push(
        `${def.name} encontra abrigo no Ossuário. Agora você pode escolher sua companhia antes de partir.`,
      );
      log(s, `Companhia disponível: ${def.name}.`, 'good');
    }
}
function performSkill(s, id, t) {
  const c = s.combat;
  if (!c || s.screen !== 'combat') throw new Error('Nenhum combate ativo.');
  if (
    ['suture', 'hook', 'silence'].includes(id) &&
    (!s.hero.companion || COMPANIONS[s.hero.companion].skill !== id || c.companionUsed)
  )
    throw new Error('A ordem da companhia não está disponível.');
  if (!availableSkills(s).includes(id)) throw new Error('Habilidade não aprendida.');
  const cost = skillCost(s, id);
  if (c.ap < cost.ap) throw new Error('Ações insuficientes. Encerre o turno para recuperar ações.');
  if (s.hero.vigor < cost.stamina)
    throw new Error('Vigor insuficiente. Encerre o turno para recuperar 3 vigor.');
  if (!targetValid(s, id, t)) throw new Error('Alvo fora de alcance ou bloqueado.');
  if (['flask', 'oil', 'bomb'].includes(id) && s.supplies[id] <= 0)
    throw new Error('Você não tem esse consumível.');
  if (id === 'blood' && s.hero.hp <= (s.hero.talents.includes('tithe') ? 3 : 5))
    throw new Error('Você não tem sangue suficiente para sobreviver ao rito.');
  c.ap -= cost.ap;
  s.hero.vigor -= cost.stamina;
  c.actions++;
  const p = c.player,
    e = t && enemyAt(s, t),
    w = WEAPONS[s.hero.weapon];
  if (id === 'move' || id === 'blink') {
    p.root = 0;
    p.x = t.x;
    p.y = t.y;
    terrainDamage(s, p, true);
    log(s, id === 'blink' ? 'Você atravessa a sombra.' : 'Você muda de posição.');
  } else if (['strike', 'heavy', 'lunge'].includes(id)) {
    const rune = runeFor(s);
    if (id === 'lunge') {
      p.root = 0;
      const steps = line(p, e);
      if (steps.length > 2) {
        const end = steps[steps.length - 2];
        p.x = end.x;
        p.y = end.y;
        terrainDamage(s, p, true);
      }
    }
    let damage = stats(s).damage + (id === 'heavy' ? 7 : id === 'lunge' ? 3 : 0);
    if (p.counter) {
      damage += 3 + (s.hero.talents.includes('sentinel') ? 5 : 0) + (rune === 'echo' ? 3 : 0);
      if (rune === 'echo') interrupt(s, e);
      p.counter = false;
    }
    if (s.hero.talents.includes('predator') && e.hp < e.maxHp / 2) damage += 4;
    hitEnemy(s, e, damage);
    e.bleed +=
      (w.bleed || 0) +
      (s.hero.talents.includes('bloodletter') ? 1 : 0) +
      (s.hero.relic === 'fang' ? 1 : 0);
    if (rune === 'blood') e.bleed += 2;
    if (rune === 'frost' && e.intent.kind === 'move') interrupt(s, e);
    if (rune === 'hunger') heal(s, 3);
    if (rune === 'ember' && id === 'heavy') {
      const affected = new Set();
      for (const tile of cross(t)) ignite(s, tile, 4, affected);
    }
    if (w.break) e.armor = Math.max(0, e.armor - w.break);
    if (id === 'heavy' && s.hero.weapon === 'maul') interrupt(s, e);
  } else if (id === 'guard') {
    p.guard += 8 + (s.hero.talents.includes('sentinel') ? 4 : 0);
    log(s, `Postura firme. ${p.guard} dano será bloqueado.`);
  } else if (id === 'shove') {
    hitEnemy(s, e, 2);
    const dest = { x: e.x + (e.x - p.x), y: e.y + (e.y - p.y) };
    if (tileAt(s, dest) === 'pit') {
      e.hp = 0;
      rewardKills(s);
      log(s, 'O abismo engole o corpo.', 'good');
    } else if (!inside(dest.x, dest.y) || tileAt(s, dest) === 'wall' || enemyAt(s, dest)) {
      hitEnemy(s, e, 4, { pure: true });
      interrupt(s, e);
      log(s, 'Colisão! Intenção interrompida.', 'good');
    } else {
      e.x = dest.x;
      e.y = dest.y;
      terrainDamage(s, e);
    }
  } else if (id === 'bash') {
    e.armor = Math.max(0, e.armor - 2);
    hitEnemy(s, e, 5);
    interrupt(s, e);
    log(s, 'Ruptura: armadura quebrada e intenção cancelada.', 'good');
  } else if (id === 'flask') {
    s.supplies.flask--;
    heal(s, 20);
    p.bleed = 0;
    if (s.hero.talents.includes('communion'))
      s.hero.corruption = Math.max(0, s.hero.corruption - 2);
    log(s, 'Bálsamo: +20 vida; Sangramento removido.', 'good');
  } else if (id === 'spark') {
    ignite(s, t);
  } else if (id === 'reap') {
    hitEnemy(s, e, 12 + e.bleed * 3, { pure: true });
    e.bleed = 0;
  } else if (id === 'blood') {
    s.hero.hp -= s.hero.talents.includes('tithe') ? 3 : 5;
    s.hero.corruption += runeFor(s) === 'salt' ? 2 : 1;
    hitEnemy(
      s,
      e,
      11 +
        stats(s).power +
        (runeFor(s) === 'salt' ? 3 : 0) +
        (s.hero.talents.includes('abyss') ? Math.min(8, s.hero.corruption) : 0),
      { pure: true },
    );
    log(s, `O sino aceita seu dízimo. +${runeFor(s) === 'salt' ? 2 : 1} Corrupção.`, 'bad');
  } else if (id === 'quake') {
    for (const e of c.enemies.filter((e) => e.hp > 0 && distance(e, p) <= 1)) {
      hitEnemy(s, e, 8);
      interrupt(s, e);
    }
  } else if (id === 'oil') {
    s.supplies.oil--;
    for (const n of cross(t)) {
      if (!['wall', 'pit', 'fire'].includes(tileAt(s, n))) c.terrain[key(n.x, n.y)] = 'oil';
    }
    log(s, 'Óleo derramado. Use Brasa para espalhar fogo.');
  } else if (id === 'bomb') {
    s.supplies.bomb--;
    const affected = new Set();
    for (const n of cross(t)) {
      const enemy = enemyAt(s, n);
      if (enemy) {
        enemy.armor = Math.max(0, enemy.armor - 2);
        hitEnemy(s, enemy, 13);
      }
      if (tileAt(s, n) === 'oil') ignite(s, n, 7 + fireBonus(s), affected);
    }
    harmPrisoner(s, cross(t), 7);
    log(s, 'A bomba estilhaça o chão e a armadura.', 'hit');
  } else if (id === 'interact') {
    interact(s, t);
  } else if (id === 'suture') {
    c.companionUsed = true;
    heal(s, 12);
    p.bleed = 0;
    log(s, 'Mara fecha suas feridas. A ordem da companhia foi usada.', 'good');
  } else if (id === 'hook') {
    c.companionUsed = true;
    e.armor = Math.max(0, e.armor - 1);
    const dx = p.x - e.x,
      dy = p.y - e.y;
    const dest = {
      x: e.x + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0),
      y: e.y + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0),
    };
    const collision = isBlocked(s, dest) || distance(dest, p) === 0;
    hitEnemy(s, e, collision ? 8 : 4);
    if (collision) interrupt(s, e);
    else {
      e.x = dest.x;
      e.y = dest.y;
      terrainDamage(s, e);
    }
    log(s, 'Ivo recolhe suas correntes. A ordem da companhia foi usada.', 'good');
  } else if (id === 'silence') {
    c.companionUsed = true;
    s.hero.corruption++;
    interrupt(s, e);
    hitEnemy(s, e, 6 + stats(s).power, { pure: true });
    log(s, 'Sibila engole uma voz. +1 Corrupção; ordem usada.', 'bad');
  }
  if (s.hero.hp <= 0) {
    die(s);
    return;
  }
  checkVictory(s);
}
function checkVictory(s) {
  const c = s.combat;
  if (!c) return false;
  if (c.objective.kind === 'siege' && !c.objective.complete) return false;
  if (!c.objective.complete && c.enemies.some((e) => e.hp > 0)) return false;
  const ex = s.expedition,
    type = c.type,
    mult = ex.modifier.id === 'normal' ? 1 : 1.3;
  const bones = Math.round(
      (type === 'boss' ? 55 : type === 'elite' ? 28 : 14 + ex.depth * 2) * mult,
    ),
    scrap = type === 'boss' ? 8 : type === 'elite' ? 5 : 3;
  award(s, bones, scrap, type === 'boss' ? 2 : 0);
  s.hero.vigor = stats(s).maxVigor;
  if (type === 'elite')
    addRelic(
      s,
      pick(
        s,
        Object.keys(RELICS).filter((k) => k !== 'none'),
      ),
    );
  if (type === 'boss') {
    const d = DISTRICTS.find((d) => d.id === ex.district);
    s.meta.clears++;
    s.meta.bestVigil = Math.max(s.meta.bestVigil, ex.vigil);
    if (!s.flags[`cleared-${d.id}`]) {
      s.journal.push(d.lore);
      s.flags[`cleared-${d.id}`] = true;
    }
    if (!s.seals.includes(d.id) && d.id !== 'cathedral') {
      s.seals.push(d.id);
      s.hero.points++;
      log(s, `${d.seal} conquistado. +1 talento permanente.`, 'good');
    }
    s.room = { type: 'victory', title: d.seal, text: d.lore };
    s.screen = d.id === 'cathedral' && !s.ending ? 'endingChoice' : 'victory';
  } else {
    s.room = {
      type: 'reward',
      title: 'O silêncio volta',
      text: `${bones} ossos e ${scrap} sucatas nos espólios. A experiência já pertence a você.`,
      bones,
      scrap,
    };
    s.screen = 'reward';
  }
  s.combat = null;
  log(s, `Confronto vencido. +${bones} ossos · +${scrap} sucata.`, 'good');
  return true;
}
function endTurn(s) {
  const c = s.combat;
  if (!c || s.screen !== 'combat') throw new Error('Nenhum combate ativo.');
  const p = c.player;
  c.damageTaken = 0;
  // Sangramento mata antes da intenção; é uma estratégia de controle, não só dano extra.
  for (const e of c.enemies.filter((e) => e.hp > 0)) {
    if (e.bleed) {
      hitEnemy(s, e, e.bleed, { pure: true });
      e.bleed = Math.max(0, e.bleed - 1);
    }
    if (e.burn && e.hp > 0) {
      hitEnemy(s, e, 3, { pure: true });
      e.burn--;
    }
  }
  if (checkVictory(s)) return;
  for (const e of [...c.enemies].filter((e) => e.hp > 0)) {
    if (e.stun) {
      e.stun--;
      terrainDamage(s, e);
      continue;
    }
    const intent = e.intent;
    if (intent.kind === 'move') {
      if (!isBlocked(s, intent.dest) && distance(intent.dest, p) > 0) {
        e.x = intent.dest.x;
        e.y = intent.dest.y;
      }
      terrainDamage(s, e);
      continue;
    }
    if (intent.kind === 'heal') {
      const ally = c.enemies.find((a) => a.id === intent.ally && a.hp > 0);
      if (ally) {
        ally.hp = Math.min(ally.maxHp, ally.hp + 9);
        log(s, 'A costureira repara 9 vida do aliado.', 'bad');
      }
    }
    if (intent.kind === 'summon') {
      const slot = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 0, y: 2 },
        { x: 5, y: 2 },
      ].find((t) => !isBlocked(s, t) && distance(t, p) > 0);
      if (slot) {
        spawn(s, e.kind === 'abbess' ? 'leech' : 'cantor', slot);
        log(s, 'Uma nova boca responde ao sino.', 'bad');
      }
      continue;
    }
    if (intent.kind !== 'attack') {
      terrainDamage(s, e);
      continue;
    }
    if (intent.charge && intent.cells.some((t) => tileAt(s, t) === 'wall')) {
      e.stun = 1;
      e.blockedCharge = true;
      log(s, 'A investida se rompe no pilar.', 'good');
      continue;
    }
    const hits = intent.cells.some((t) => t.x === p.x && t.y === p.y);
    if (hits) {
      const damage = playerDamage(s, intent.damage);
      if (damage > 0) {
        if (intent.bleed) p.bleed += intent.bleed;
        if (intent.corruption) s.hero.corruption += intent.corruption;
        if (intent.root) p.root = Math.max(p.root, intent.root);
        if (intent.drain) s.hero.vigor = Math.max(0, s.hero.vigor - intent.drain);
        if (intent.leech) e.hp = Math.min(e.maxHp, e.hp + 5);
      }
    } else log(s, `${ENEMIES[e.kind].name} erra.`, 'good');
    // A congregação não discrimina corpos: posicionamento permite fogo amigo.
    for (const other of c.enemies.filter((other) => other !== e && other.hp > 0))
      if (intent.cells.some((t) => t.x === other.x && t.y === other.y)) {
        if (intent.explode) other.armor = Math.max(0, other.armor - 1);
        hitEnemy(s, other, Math.ceil(intent.damage / 2));
      }
    harmPrisoner(s, intent.cells, Math.ceil(intent.damage / 2));
    if (intent.explode) {
      for (const t of intent.cells) if (tileAt(s, t) === 'oil') ignite(s, t, 4);
      e.hp = 0;
      rewardKills(s);
    }
    if (intent.fire)
      for (const t of intent.cells)
        if (!['wall', 'pit'].includes(tileAt(s, t))) c.terrain[key(t.x, t.y)] = 'fire';
    if (intent.moveAfter && !isBlocked(s, intent.moveAfter) && distance(intent.moveAfter, p) > 0) {
      e.x = intent.moveAfter.x;
      e.y = intent.moveAfter.y;
    }
    if (e.hp > 0) terrainDamage(s, e);
    if (s.hero.hp <= 0) {
      die(s);
      return;
    }
  }
  if (p.bleed) {
    playerDamage(s, p.bleed, true);
    p.bleed = Math.max(0, p.bleed - 1);
  }
  terrainDamage(s, p, true);
  const prisoner = c.objective.kind === 'rescue' && c.objective.objects[0];
  if (prisoner?.active && tileAt(s, prisoner) === 'fire') harmPrisoner(s, [prisoner], 5);
  if (s.hero.corruption >= (s.hero.talents.includes('abyss') ? 9 : 6)) {
    playerDamage(s, 2, true);
    log(s, 'A Corrupção cobra 2 vida. Purifique-se em um abrigo.', 'bad');
  }
  if (s.hero.hp <= 0) {
    die(s);
    return;
  }
  if (s.hero.relic === 'eye' && c.damageTaken === 0) heal(s, 3);
  if (checkVictory(s)) return;
  c.turn++;
  c.ap = 2;
  p.guard = 0;
  s.hero.vigor = Math.min(stats(s).maxVigor, s.hero.vigor + 3 + (c.actions === 0 ? 2 : 0));
  c.actions = 0;
  reinforce(s);
  // Invocações em batalhas longas não acumulam corpos ilimitados no save.
  if (c.enemies.length > 20) c.enemies = c.enemies.filter((e) => e.hp > 0 || !e.rewarded);
  planIntents(s);
  log(s, `Turno ${c.turn}: +3 vigor. Novas intenções anunciadas.`);
}
function enterNode(s, id) {
  const ex = s.expedition;
  if (!ex || s.screen !== 'route') throw new Error('Você não pode escolher uma rota agora.');
  const node = ex.routes[ex.depth]?.find((n) => n.id === id);
  if (!node) throw new Error('Rota inválida.');
  ex.light = Math.max(0, ex.light - (ex.modifier.id === 'scarce' ? 2 : 1));
  ex.seen.push(node.type);
  if (ex.recoverable && ex.depth === 2 && s.corpse) {
    for (const k of ['bones', 'scrap', 'ichor']) ex.bag[k] += s.corpse.bag[k];
    s.corpse = null;
    ex.recoverable = false;
    log(s, 'Você recuperou os espólios do seu cadáver.', 'good');
  }
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
    startBattle(s, node.type, node.encounter || null);
    return;
  }
  if (node.type === 'event') {
    const index = DISTRICTS.findIndex((d) => d.id === ex.district);
    let options = Object.keys(EVENTS).filter(
      (k) =>
        (EVENTS[k].district === undefined || EVENTS[k].district === index) &&
        !(k === 'well' && s.quests.rescue),
    );
    if (index === 0 && !s.quests.rescue) options = ['well', ...options, 'well'];
    const id = pick(s, options);
    s.room = { type: 'event', event: id };
  } else if (node.type === 'cache')
    s.room = {
      type: 'cache',
      weapon: pick(s, Object.keys(WEAPONS)),
      relic: pick(
        s,
        Object.keys(RELICS).filter((k) => k !== 'none'),
      ),
    };
  else if (node.type === 'merchant')
    s.room = {
      type: 'merchant',
      relic: pick(
        s,
        Object.keys(RELICS).filter((k) => k !== 'none'),
      ),
    };
  else s.room = { type: 'camp' };
  s.screen = 'room';
  log(
    s,
    `Etapa ${ex.depth + 1}: ${node.type === 'event' ? EVENTS[s.room.event].name : node.type === 'camp' ? 'Abrigo encontrado' : 'Uma oportunidade na ruína'}.`,
  );
}
function nextRoute(s) {
  if (!s.expedition) throw new Error('Sem expedição.');
  s.expedition.depth++;
  s.room = null;
  s.screen = 'route';
}
function eventEffect(s, effect) {
  const h = s.hero,
    ex = s.expedition;
  const hurt = (n) => {
    if (h.hp <= n) throw new Error('Essa escolha mataria você. Cure-se ou escolha outra via.');
    h.hp -= n;
  };
  const light = (n) => {
    if (ex.light < n) throw new Error('Luz insuficiente para essa alternativa.');
    ex.light -= n;
  };
  const corrupt = (n) => (h.corruption = Math.max(0, h.corruption + n));
  const rep = (n) => (s.flags.reputation = (s.flags.reputation || 0) + n);
  switch (effect) {
    case 'rescue':
      hurt(7);
      s.quests.rescue = 1;
      rep(2);
      log(s, 'Mara volta ao Ossuário. Ela sabe fazer bálsamos.', 'good');
      break;
    case 'rescuePay':
      pay(s, 'bones', 20);
      s.quests.rescue = 1;
      rep(1);
      break;
    case 'abandon':
      ex.light = Math.min(12, ex.light + 3);
      break;
    case 'bones':
      hurt(4);
      award(s, 18);
      break;
    case 'scrap':
      award(s, 0, 3);
      break;
    case 'cleanse':
      light(1);
      corrupt(-2);
      break;
    case 'altar': {
      const flag = `altar-${ex.district}`;
      if (s.flags[flag])
        throw new Error('Este distrito já recebeu seu sangue. Escolha outra oferta.');
      hurt(6);
      h.points++;
      corrupt(2);
      s.flags[flag] = true;
      break;
    }
    case 'dismantle':
      award(s, 0, 5);
      relicQuest(s);
      break;
    case 'remember':
      corrupt(-2);
      gainXP(s, 8);
      break;
    case 'giveFlask':
      if (!s.supplies.flask) throw new Error('Sem bálsamos.');
      s.supplies.flask--;
      rep(2);
      award(s, 20);
      break;
    case 'escort':
      light(2);
      rep(1);
      gainXP(s, 12);
      break;
    case 'leave':
      break;
    case 'fang':
      addRelic(s, 'fang');
      corrupt(2);
      break;
    case 'wash':
      pay(s, 'bones', 10);
      corrupt(-3);
      heal(s, 10);
      break;
    case 'relic':
      relicQuest(s);
      award(s, 0, 3);
      break;
    case 'disarm':
      light(1);
      s.supplies.bomb++;
      award(s, 0, 4);
      break;
    case 'force':
      hurt(8);
      award(s, 15);
      break;
    case 'detour':
      light(2);
      break;
    case 'confess':
      corrupt(2);
      gainXP(s, 18);
      break;
    case 'silence':
      heal(s, 5);
      break;
    case 'surgery':
      if (!h.wounds) throw new Error('Você não tem cicatrizes.');
      pay(s, 'bones', 25);
      h.wounds--;
      heal(s, 12);
      break;
    case 'buyFlask':
      pay(s, 'bones', 12);
      s.supplies.flask++;
      break;
    case 'patch':
      pay(s, 'scrap', 4);
      heal(s, 16);
      break;
    case 'spear':
      if (!h.ownedWeapons.includes('spear')) h.ownedWeapons.push('spear');
      else award(s, 10);
      corrupt(1);
      break;
    case 'coffin':
      hurt(6);
      relicQuest(s);
      award(s, 18);
      break;
    case 'bury':
      light(1);
      corrupt(-2);
      rep(1);
      break;
    case 'coal':
      hurt(8);
      addRelic(s, 'coal');
      break;
    case 'oil':
      s.supplies.oil += 2;
      s.supplies.bomb++;
      break;
    case 'pyre':
      light(2);
      gainXP(s, 10);
      corrupt(-2);
      break;
    case 'mercy':
      hurt(5);
      award(s, 0, 5);
      rep(1);
      break;
    case 'key':
      award(s, 25);
      corrupt(2);
      break;
    case 'free':
      pay(s, 'scrap', 4);
      relicQuest(s);
      gainXP(s, 15);
      break;
    case 'quiet':
      light(1);
      gainXP(s, 12);
      break;
    case 'fragment':
      hurt(7);
      relicQuest(s);
      corrupt(1);
      break;
    case 'answer':
      gainXP(s, 25);
      corrupt(3);
      break;
    default:
      throw new Error('Escolha desconhecida.');
  }
}
function roomChoice(s, id) {
  const r = s.room;
  if (s.screen !== 'room' || !r) throw new Error('A escolha não está disponível.');
  if (r.type === 'event') {
    const choice = EVENTS[r.event].choices[id];
    if (!choice) throw new Error('Escolha inválida.');
    eventEffect(s, choice.effect);
    log(s, choice.label);
    nextRoute(s);
  } else if (r.type === 'camp') {
    if (id === 'rest') {
      heal(s, 24);
      log(s, 'Você dorme com a arma na mão. +24 vida.', 'good');
    } else if (id === 'light') {
      s.expedition.light = Math.min(12, s.expedition.light + 5);
      s.supplies.flask++;
      log(s, 'Você recolhe velas e bálsamo. +5 luz · +1 bálsamo.', 'good');
    } else if (id === 'purify') {
      s.hero.corruption = Math.max(0, s.hero.corruption - 4);
      s.hero.wounds = Math.max(0, s.hero.wounds - 1);
      heal(s, 6);
      log(s, 'A água fria leva 4 Corrupção e uma cicatriz.', 'good');
    } else throw new Error('Escolha inválida.');
    nextRoute(s);
  } else if (r.type === 'cache') {
    if (id === 'supplies') {
      s.supplies.flask += 2;
      s.supplies.bomb++;
      log(s, '+2 bálsamos · +1 bomba.', 'good');
    } else if (id === 'weapon') {
      if (!s.hero.ownedWeapons.includes(r.weapon)) s.hero.ownedWeapons.push(r.weapon);
      else award(s, 0, 5);
      log(s, `Você recolhe ${WEAPONS[r.weapon].name}.`, 'good');
    } else if (id === 'relic') {
      addRelic(s, r.relic);
      relicQuest(s);
    } else throw new Error('Escolha inválida.');
    nextRoute(s);
  } else if (r.type === 'merchant') {
    if (id === 'leave') {
      nextRoute(s);
      return;
    }
    if (id === 'relic') {
      pay(s, 'bones', price(s, 'merchantRelic'));
      addRelic(s, r.relic);
    } else if (id === 'flask') {
      pay(s, 'bones', price(s, 'flask'));
      s.supplies.flask++;
    } else if (id === 'bomb') {
      pay(s, 'bones', price(s, 'merchantBomb'));
      s.supplies.bomb++;
    } else throw new Error('Escolha inválida.');
    log(s, 'Troca concluída. Você ainda pode comprar ou seguir.', 'good');
  }
}
function learn(s, id) {
  if (s.combat) throw new Error('Aprenda talentos entre confrontos.');
  const t = TALENTS[id];
  if (!Object.hasOwn(TALENTS, id)) throw new Error('Talento desconhecido.');
  if (s.hero.talents.includes(id)) throw new Error('Talento já aprendido.');
  if (t.requires && !s.hero.talents.includes(t.requires))
    throw new Error('Aprenda o talento anterior primeiro.');
  if (s.hero.points < t.cost) throw new Error('Pontos de talento insuficientes.');
  s.hero.points -= t.cost;
  s.hero.talents.push(id);
  if (t.skill && !s.hero.skills.includes(t.skill)) s.hero.skills.push(t.skill);
  log(s, `Talento aprendido: ${t.name}.`, 'good');
}
function shop(s, kind, id) {
  if (s.screen !== 'hub') throw new Error('Serviço disponível apenas no Ossuário.');
  if (kind === 'weapon') {
    const def = WEAPONS[id];
    if (!Object.hasOwn(WEAPONS, id)) throw new Error('Arma desconhecida.');
    if (s.hero.ownedWeapons.includes(id)) throw new Error('Arma já possuída.');
    pay(s, 'bones', def.price);
    s.hero.ownedWeapons.push(id);
  } else if (kind === 'armor') {
    const def = ARMORS[id];
    if (!Object.hasOwn(ARMORS, id)) throw new Error('Armadura desconhecida.');
    if (s.hero.ownedArmor.includes(id)) throw new Error('Armadura já possuída.');
    pay(s, 'bones', def.price);
    s.hero.ownedArmor.push(id);
  } else if (kind === 'flask') {
    pay(s, 'bones', price(s, 'flask'));
    s.supplies.flask++;
  } else if (kind === 'bomb') {
    pay(s, 'bones', 14);
    pay(s, 'scrap', 2);
    s.supplies.bomb++;
  } else if (kind === 'oil') {
    pay(s, 'bones', 6);
    s.supplies.oil++;
  } else if (kind === 'upgrade') {
    const level = s.hero.upgrades[s.hero.weapon] || 0,
      cap = s.claimed.includes('hunt') ? 3 : 2;
    if (level >= cap) throw new Error(`Melhoria máxima ${cap}. O contrato de caça libera III.`);
    pay(s, 'scrap', WEAPONS[s.hero.weapon].scrap + level * 4);
    pay(s, 'bones', 15 + level * 10);
    s.hero.upgrades[s.hero.weapon] = level + 1;
  } else if (kind === 'rest') {
    heal(s, stats(s).maxHp);
    s.hero.vigor = stats(s).maxVigor;
    s.supplies.flask = Math.max(2, s.supplies.flask);
  } else if (kind === 'surgery') {
    if (!s.hero.wounds) throw new Error('Nenhuma cicatriz para tratar.');
    pay(s, 'bones', 20);
    s.hero.wounds--;
    heal(s, 10);
  } else if (kind === 'purify') {
    if (!s.hero.corruption) throw new Error('Você já está purificado.');
    pay(s, 'bones', 10);
    s.hero.corruption = 0;
  } else if (kind === 'sacrament') {
    pay(s, 'ichor', 3);
    pay(s, 'bones', 30);
    s.hero.points++;
    log(s, 'Sacramento: o ícor vira memória. +1 ponto de talento permanente.', 'good');
  } else if (kind === 'transfusion') {
    if (!s.hero.wounds && !s.hero.corruption) throw new Error('Você não tem marcas para remover.');
    pay(s, 'ichor', 2);
    s.hero.wounds = 0;
    s.hero.corruption = 0;
    heal(s, stats(s).maxHp);
    log(s, 'Transfusão: todas as cicatrizes e Corrupção removidas.', 'good');
  } else throw new Error('Serviço inválido.');
  log(
    s,
    kind === 'rest' ? 'Descanso completo. Pelo menos 2 bálsamos preparados.' : 'Serviço concluído.',
    'good',
  );
}
function equip(s, kind, id) {
  if (s.combat) throw new Error('Troque equipamento fora do combate.');
  const owns =
    kind === 'weapon'
      ? s.hero.ownedWeapons
      : kind === 'armor'
        ? s.hero.ownedArmor
        : kind === 'relic'
          ? s.hero.ownedRelics
          : null;
  if (!owns || (!owns.includes(id) && !(kind === 'relic' && id === 'none')))
    throw new Error('Equipamento não possuído.');
  s.hero[kind] = id;
  s.hero.vigor = Math.min(s.hero.vigor, stats(s).maxVigor);
  log(s, 'Equipamento alterado.');
}
function claim(s, id) {
  if (s.screen !== 'hub') throw new Error('Receba contratos no Ossuário.');
  const contract = CONTRACTS[id];
  if (!contract || !Object.hasOwn(CONTRACTS, id) || s.quests[id] < contract.target)
    throw new Error('Contrato ainda incompleto.');
  if (s.claimed.includes(id)) throw new Error('Recompensa já recebida.');
  s.claimed.push(id);
  award(s, contract.reward, id === 'hunt' ? 12 : 0);
  gainXP(s, 12);
  if (id === 'relic') addRelic(s, 'chalice');
  log(s, 'Contrato concluído. Recompensa depositada.', 'good');
}
function engrave(s, id, craft = false) {
  if (s.combat) throw new Error('Grave runas entre confrontos.');
  if (!Object.hasOwn(RUNES, id)) throw new Error('Gravação desconhecida.');
  if (craft) {
    if (s.screen !== 'hub') throw new Error('Crie runas na forja do Ossuário.');
    if (id === 'none' || s.hero.ownedRunes.includes(id)) throw new Error('Runa já conhecida.');
    for (const [kind, cost] of Object.entries(RUNES[id].cost)) pay(s, kind, cost);
    s.hero.ownedRunes.push(id);
  } else if (id !== 'none' && !s.hero.ownedRunes.includes(id))
    throw new Error('Runa não possuída.');
  s.hero.runes[s.hero.weapon] = id;
  log(s, `${WEAPONS[s.hero.weapon].name}: ${RUNES[id].name}.`, 'good');
}
// A transação trabalha em uma cópia: entrada inválida não altera turno, RNG ou recursos.
export function act(state, action) {
  const s = clone(state);
  s.notice = '';
  try {
    switch (action.type) {
      case 'depart':
        if (s.screen !== 'hub') throw new Error('Volte ao refúgio primeiro.');
        startExpedition(s, action.id, action.vigil);
        break;
      case 'node':
        enterNode(s, action.id);
        break;
      case 'scout': {
        const ex = s.expedition;
        if (!ex || s.screen !== 'route') throw new Error('Reconheça uma rota entre encontros.');
        if (ex.scouted.includes(ex.depth)) throw new Error('Etapa já reconhecida.');
        if (ex.light < 1) throw new Error('É preciso 1 luz para reconhecer.');
        ex.light--;
        ex.scouted.push(ex.depth);
        log(
          s,
          'Reconhecimento: formações reveladas; próximo confronto desta etapa começa com 3 ações.',
          'good',
        );
        break;
      }
      case 'engrave':
        engrave(s, action.id, true);
        break;
      case 'rune':
        engrave(s, action.id);
        break;
      case 'companion':
        if (s.screen !== 'hub') throw new Error('Escolha sua companhia no Ossuário.');
        if (action.id !== null && !s.hero.roster.includes(action.id))
          throw new Error('Companhia ainda indisponível.');
        s.hero.companion = action.id;
        log(
          s,
          action.id
            ? `${COMPANIONS[action.id].name} acompanha sua próxima expedição.`
            : 'Você seguirá sozinho.',
        );
        break;
      case 'skill':
        performSkill(s, action.id, action.target);
        break;
      case 'endTurn':
        endTurn(s);
        break;
      case 'room':
        roomChoice(s, action.id);
        break;
      case 'continue':
        if (s.screen !== 'reward') throw new Error('Sem recompensa pendente.');
        nextRoute(s);
        break;
      case 'retreat':
        if (s.combat || !s.expedition || !['route', 'reward', 'room'].includes(s.screen))
          throw new Error('Você só pode recuar entre confrontos.');
        returnHome(s);
        break;
      case 'home':
        if (!['victory', 'death', 'ending'].includes(s.screen))
          throw new Error('Você não pode voltar agora.');
        returnHome(s, s.screen === 'victory');
        break;
      case 'ending': {
        if (s.screen !== 'endingChoice' || !['break', 'bind'].includes(action.id))
          throw new Error('Final inválido.');
        s.ending = action.id;
        s.screen = 'ending';
        s.hero.points += 2;
        const text =
          action.id === 'break'
            ? 'Você entrega seu nome ao metal e quebra o sino. Os mortos finalmente caem. Ninguém recordará quem salvou Véspera. No Ossuário, Mara deixa uma vela junto de uma cadeira vazia. A cidade terá de aprender a viver sem você.'
            : 'Você arranca o badalo e costura o sino ao próprio peito. Os mortos obedecem ao seu silêncio. Véspera vive, sob sua vigília. A cada noite, um novo nome bate contra suas costelas. Você jamais poderá dormir.';
        s.journal.push(text);
        s.room = {
          type: 'ending',
          title: action.id === 'break' ? 'Um nome a menos' : 'A vigília eterna',
          text,
        };
        log(
          s,
          'Campanha concluída. A Vigília abre expedições com modificadores e dificuldade crescente.',
          'good',
        );
        break;
      }
      case 'learn':
        learn(s, action.id);
        break;
      case 'shop':
        shop(s, action.kind, action.id);
        break;
      case 'equip':
        equip(s, action.kind, action.id);
        break;
      case 'claim':
        claim(s, action.id);
        break;
      case 'option':
        if (!['sound', 'motion'].includes(action.id)) throw new Error('Opção inválida.');
        s.options[action.id] = !!action.value;
        break;
      default:
        throw new Error('Ação desconhecida.');
    }
    s.hero.hp = Math.min(s.hero.hp, stats(s).maxHp);
    s.hero.vigor = Math.min(s.hero.vigor, stats(s).maxVigor);
    recruit(s);
    return { state: s, ok: true };
  } catch (error) {
    return { state: { ...state, notice: error.message }, ok: false, error: error.message };
  }
}
export function validateSave(s) {
  const integer = (n, max = 1_000_000) => Number.isSafeInteger(n) && n >= 0 && n <= max;
  const record = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const coordinates = (p) => record(p) && integer(p.x, 5) && integer(p.y, 5);
  const wallet = (o) => record(o) && ['bones', 'scrap', 'ichor'].every((k) => integer(o[k]));
  if (
    !s ||
    s.version !== VERSION ||
    !Object.hasOwn(CLASSES, s.hero?.origin) ||
    !Object.hasOwn(WEAPONS, s.hero?.weapon) ||
    !Object.hasOwn(ARMORS, s.hero?.armor) ||
    !Object.hasOwn(RELICS, s.hero?.relic)
  )
    return false;
  if (
    !Array.isArray(s.hero.talents) ||
    !Array.isArray(s.hero.skills) ||
    !Array.isArray(s.seals) ||
    !Array.isArray(s.log) ||
    !Array.isArray(s.journal)
  )
    return false;
  if (
    !s.stash ||
    !s.supplies ||
    !s.meta ||
    !s.quests ||
    !s.flags ||
    !s.options ||
    !Number.isFinite(s.rng)
  )
    return false;
  if (
    ![
      'hub',
      'route',
      'combat',
      'room',
      'reward',
      'victory',
      'endingChoice',
      'ending',
      'death',
    ].includes(s.screen)
  )
    return false;
  if (
    !Number.isFinite(s.hero.hp) ||
    s.hero.hp < 1 ||
    s.hero.hp > 1000 ||
    !Number.isFinite(s.hero.level) ||
    s.hero.level < 1 ||
    s.hero.level > 20
  )
    return false;
  if (
    s.hero.talents.some((id) => !Object.hasOwn(TALENTS, id)) ||
    s.hero.skills.some((id) => !Object.hasOwn(SKILLS, id))
  )
    return false;
  if (
    s.expedition &&
    (!DISTRICTS.some((d) => d.id === s.expedition.district) ||
      !Array.isArray(s.expedition.routes) ||
      !s.expedition.bag)
  )
    return false;
  if (
    ['route', 'combat', 'room', 'reward', 'victory', 'endingChoice'].includes(s.screen) &&
    !s.expedition
  )
    return false;
  if (
    s.screen === 'combat' &&
    (!s.combat ||
      !Array.isArray(s.combat.enemies) ||
      s.combat.enemies.some((e) => !Object.hasOwn(ENEMIES, e.kind)))
  )
    return false;
  const h = s.hero;
  if (
    typeof h.name !== 'string' ||
    h.name.length > 24 ||
    !integer(h.wounds, 5) ||
    !integer(h.corruption) ||
    !integer(h.vigor, 100) ||
    !integer(h.points) ||
    !integer(h.xp) ||
    !record(h.upgrades)
  )
    return false;
  if (
    !Array.isArray(h.ownedWeapons) ||
    !h.ownedWeapons.includes(h.weapon) ||
    h.ownedWeapons.some((id) => !Object.hasOwn(WEAPONS, id))
  )
    return false;
  if (
    !Array.isArray(h.ownedArmor) ||
    !h.ownedArmor.includes(h.armor) ||
    h.ownedArmor.some((id) => !Object.hasOwn(ARMORS, id))
  )
    return false;
  if (
    !Array.isArray(h.ownedRelics) ||
    h.ownedRelics.some((id) => !Object.hasOwn(RELICS, id)) ||
    (h.relic !== 'none' && !h.ownedRelics.includes(h.relic))
  )
    return false;
  if (Object.entries(h.upgrades).some(([id, n]) => !Object.hasOwn(WEAPONS, id) || !integer(n, 3)))
    return false;
  if (!wallet(s.stash) || !['flask', 'oil', 'bomb'].every((k) => integer(s.supplies[k])))
    return false;
  if (
    !integer(s.sequence) ||
    !integer(s.rng, 4294967295) ||
    s.rng === 0 ||
    !s.seals.every((id) => ['gutters', 'abbey', 'prison'].includes(id)) ||
    new Set(s.seals).size !== s.seals.length
  )
    return false;
  if (
    !record(s.flags) ||
    !record(s.quests) ||
    !Object.keys(CONTRACTS).every((k) => integer(s.quests[k])) ||
    !Array.isArray(s.claimed) ||
    !s.claimed.every((id) => Object.hasOwn(CONTRACTS, id))
  )
    return false;
  if (
    !['deaths', 'kills', 'expeditions', 'clears', 'bestVigil'].every((k) => integer(s.meta[k])) ||
    !['sound', 'motion'].every((k) => typeof s.options[k] === 'boolean')
  )
    return false;
  if (
    s.journal.some((t) => typeof t !== 'string') ||
    s.log.some(
      (l) =>
        !record(l) ||
        typeof l.text !== 'string' ||
        !integer(l.seq) ||
        !['info', 'good', 'bad', 'hit'].includes(l.type),
    )
  )
    return false;
  if (![null, 'break', 'bind'].includes(s.ending)) return false;
  if (
    !Array.isArray(h.ownedRunes) ||
    h.ownedRunes.some((id) => !Object.hasOwn(RUNES, id) || id === 'none') ||
    !record(h.runes) ||
    Object.entries(h.runes).some(
      ([weapon, id]) =>
        !h.ownedWeapons.includes(weapon) || (id !== 'none' && !h.ownedRunes.includes(id)),
    )
  )
    return false;
  if (
    !Array.isArray(h.roster) ||
    h.roster.some((id) => !Object.hasOwn(COMPANIONS, id)) ||
    (h.companion !== null && !h.roster.includes(h.companion))
  )
    return false;
  if (
    !record(s.codex) ||
    Object.entries(s.codex).some(
      ([id, entry]) =>
        !Object.hasOwn(ENEMIES, id) ||
        !record(entry) ||
        !integer(entry.seen) ||
        !integer(entry.kills),
    )
  )
    return false;
  if (h.hp > stats(s).maxHp || h.vigor > stats(s).maxVigor) return false;
  if (s.corpse && (!wallet(s.corpse.bag) || !DISTRICTS.some((d) => d.id === s.corpse.district)))
    return false;
  if (s.expedition) {
    const ex = s.expedition;
    if (
      !wallet(ex.bag) ||
      !integer(ex.depth, 6) ||
      !integer(ex.light, 12) ||
      !integer(ex.vigil) ||
      !record(ex.modifier) ||
      !MODIFIERS.some((m) => m.id === ex.modifier.id) ||
      ex.routes.length !== 7
    )
      return false;
    if (
      !Array.isArray(ex.scouted) ||
      ex.scouted.some((n) => !integer(n, 6)) ||
      new Set(ex.scouted).size !== ex.scouted.length
    )
      return false;
    if (
      ex.routes.some(
        (row) =>
          !Array.isArray(row) ||
          row.length < 1 ||
          row.length > 3 ||
          row.some(
            (n) =>
              !record(n) ||
              typeof n.id !== 'string' ||
              !['battle', 'elite', 'event', 'cache', 'camp', 'merchant', 'boss'].includes(n.type) ||
              (n.encounter &&
                (!Object.hasOwn(ENCOUNTERS, n.encounter) ||
                  ENCOUNTERS[n.encounter].district !== ex.district)),
          ),
      )
    )
      return false;
  }
  if (s.combat) {
    const c = s.combat;
    if (
      s.screen !== 'combat' ||
      !['battle', 'elite', 'boss'].includes(c.type) ||
      !integer(c.actions) ||
      !integer(c.player?.bleed) ||
      !integer(c.player?.guard) ||
      typeof c.player?.counter !== 'boolean'
    )
      return false;
    if (
      !integer(c.ap, c.turn === 1 && s.expedition.scouted.includes(s.expedition.depth) ? 3 : 2) ||
      !integer(c.turn) ||
      !coordinates(c.player) ||
      !record(c.terrain) ||
      !Array.isArray(c.enemies) ||
      c.enemies.length > 30
    )
      return false;
    if (
      !record(c.objective) ||
      !Object.hasOwn(OBJECTIVES, c.objective.kind) ||
      typeof c.objective.complete !== 'boolean' ||
      !Array.isArray(c.objective.objects) ||
      c.objective.objects.length > 2 ||
      c.objective.objects.some(
        (o) =>
          !coordinates(o) ||
          typeof o.active !== 'boolean' ||
          (c.objective.kind === 'rescue' && !integer(o.hp, 12)),
      ) ||
      typeof c.companionUsed !== 'boolean' ||
      !integer(c.player.root, 2)
    )
      return false;
    const objectCount =
      c.objective.kind === 'eliminate' ? 0 : c.objective.kind === 'ritual' ? 2 : 1;
    if (c.objective.objects.length !== objectCount) return false;
    if (
      Object.entries(c.terrain).some(
        ([k, v]) =>
          !/^\d,\d$/.test(k) || !['wall', 'pit', 'oil', 'fire', 'blood', 'stone'].includes(v),
      )
    )
      return false;
    if (
      c.enemies.some(
        (e) =>
          !coordinates(e) ||
          !integer(e.hp) ||
          !integer(e.maxHp) ||
          e.hp > e.maxHp ||
          !integer(e.armor) ||
          !integer(e.bleed) ||
          !integer(e.burn) ||
          !integer(e.damage) ||
          !integer(e.stun, 1) ||
          typeof e.rewarded !== 'boolean' ||
          typeof e.id !== 'string' ||
          !record(e.intent) ||
          !['attack', 'move', 'summon', 'stun', 'heal'].includes(e.intent.kind) ||
          !integer(e.intent.damage) ||
          (e.intent.kind === 'move' && !coordinates(e.intent.dest)) ||
          (e.intent.moveAfter && !coordinates(e.intent.moveAfter)) ||
          (e.intent.kind === 'heal' && typeof e.intent.ally !== 'string') ||
          !Array.isArray(e.intent.cells) ||
          e.intent.cells.some((p) => !coordinates(p)),
      )
    )
      return false;
  }
  if (s.screen === 'room') {
    if (!record(s.room) || !['event', 'camp', 'cache', 'merchant'].includes(s.room.type))
      return false;
    if (s.room.type === 'event' && !EVENTS[s.room.event]) return false;
    if (s.room.type === 'cache' && (!WEAPONS[s.room.weapon] || !RELICS[s.room.relic])) return false;
    if (s.room.type === 'merchant' && !RELICS[s.room.relic]) return false;
  }
  return true;
}
