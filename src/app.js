import {
  CLASSES,
  WEAPONS,
  ARMORS,
  RELICS,
  SKILLS,
  TALENTS,
  ENEMIES,
  DISTRICTS,
  EVENTS,
  NODE_TYPES,
  CONTRACTS,
  GRID,
} from './content.js';
import {
  act,
  createGame,
  stats,
  xpNeeded,
  key,
  enemyAt,
  tileAt,
  threatened,
  availableSkills,
  skillCost,
  targetValid,
  preview,
  price,
  discount,
  runeFor,
  ward,
} from './engine.js';
import { RUNES, COMPANIONS, ENCOUNTERS, LAYOUTS, OBJECTIVES } from './expansion.js';
import { load, save, encode, decode, SAVE_KEY } from './storage.js';
import { icon, figure, skyline } from './icons.js';
import { setAudio, tone } from './audio.js';
import { registerGameTools } from './webmcp.js';

const app = document.querySelector('#app'),
  modalRoot = document.querySelector('#modal-root'),
  toastEl = document.querySelector('#toast');
const loaded = load();
let state = loaded.state,
  origin = 'guard',
  tab = 'map',
  selected = null,
  target = null,
  modal = null,
  offlineReady = false,
  waitingWorker = null,
  saveError = false;
let toastTimer = null,
  lastFocus = null,
  modalScroll = 0;
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const choice = (label, hint, attrs = '', className = '') =>
  `<button class="choice ${className}" ${attrs}><strong>${label}</strong><small>${hint}</small></button>`;
const button = (label, attrs = '', className = '') =>
  `<button class="${className}" ${attrs}>${label}</button>`;
function toast(text, error = false) {
  clearTimeout(toastTimer);
  toastEl.textContent = text;
  toastEl.className = `visible ${error ? 'error' : ''}`;
  toastTimer = setTimeout(() => (toastEl.className = ''), 4500);
}
function persist() {
  if (!state) return true;
  const result = save(state);
  saveError = !result.ok;
  if (!result.ok) toast(result.error, true);
  return result.ok;
}
function send(action) {
  if (!state) return;
  const before = state.screen,
    result = act(state, action);
  if (!result.ok) {
    toast(result.error, true);
    tone('bad');
    return false;
  }
  state = result.state;
  selected = null;
  target = null;
  persist();
  if (state.screen !== before) {
    tab = 'map';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const latest = state.log.at(-1);
  tone(
    latest?.type === 'hit'
      ? 'hit'
      : latest?.type === 'bad'
        ? 'bad'
        : latest?.type === 'good'
          ? 'good'
          : 'click',
  );
  render();
  return true;
}
function title() {
  return `<div class="topline"><div><div class="brand">${icon('bell')} SINO NEGRO</div><div class="subbrand">VÉSPERA · A CONGREGAÇÃO · v2.0</div></div><button data-modal="menu" aria-label="Pausar e abrir menu">${icon('gear')}</button></div>`;
}
function hud() {
  const h = state.hero,
    s = stats(state),
    c = state.combat;
  return `<div class="hud"><div class="hud-head"><span class="hero-name">${esc(h.name)} <span class="muted">· ${CLASSES[h.origin].name}</span></span><span class="level">NV. ${h.level}</span></div><div class="meters"><div><div class="meter-label"><span>VIDA</span><span>${h.hp} / ${s.maxHp}</span></div><div class="meter"><span style="width:${(h.hp / s.maxHp) * 100}%"></span></div></div><div><div class="meter-label"><span>VIGOR</span><span>${h.vigor} / ${s.maxVigor}</span></div><div class="meter vigor"><span style="width:${(h.vigor / s.maxVigor) * 100}%"></span></div></div></div><div class="conditions"><span>${icon('shield', 'small')} <b>${s.armor}</b> proteção</span><span class="${h.corruption >= 6 ? 'warning' : ''}">${icon('drop', 'small')} <b>${h.corruption}</b> Corrupção</span>${h.wounds ? `<span class="warning">${h.wounds} cicatriz${h.wounds > 1 ? 'es' : ''} (−${h.wounds * 3} vida máx.)</span>` : ''}${c?.player.guard ? `<span class="green">Aparo ${c.player.guard}</span>` : ''}${c?.player.counter ? '<span class="gold">Contra-ataque pronto</span>' : ''}${c?.player.bleed ? `<span class="red">Sangramento ${c.player.bleed}</span>` : ''}</div></div>`;
}
function nav() {
  return `<nav class="nav" aria-label="Navegação principal">${[
    ['map', state.screen === 'hub' ? 'Ossuário' : 'Jornada', 'bell'],
    ['gear', 'Equipamento', 'blade'],
    ['talents', 'Talentos', 'star'],
    ['journal', 'Crônica', 'book'],
    ['help', 'Regras', 'eye'],
  ]
    .map(
      ([id, label, img]) =>
        `<button data-tab="${id}" class="${tab === id ? 'active' : ''}" aria-label="${label}">${icon(img)}<span>${label}${id === 'talents' && state.hero.points ? `<b class="badge">${state.hero.points}</b>` : ''}</span></button>`,
    )
    .join('')}</nav>`;
}
function resources() {
  const s = state.stash,
    bag = state.expedition?.bag;
  return `<div class="resource-strip">${[
    ['coins', 'bones', 'ossos'],
    ['hammer', 'scrap', 'sucata'],
    ['drop', 'ichor', 'ícor'],
  ]
    .map(
      ([img, id, label]) =>
        `<div class="resource">${icon(img)}<div><strong>${s[id]}${bag?.[id] ? ` <span class="gold">+${bag[id]}</span>` : ''}</strong><small>${label}${bag?.[id] ? ' · espólios' : ''}</small></div></div>`,
    )
    .join('')}</div>`;
}
function introduction() {
  return `<main class="shell intro">${title()}<div class="intro-art">${skyline()}</div><div class="intro-title"><div class="eyebrow">OS MORTOS RESPONDERAM. VOCÊ TAMBÉM.</div><h1>SINO NEGRO</h1><p>Na cidade de Véspera, a morte<br>é apenas o começo da sentença.</p></div><p class="intro-description">Atravesse as ruínas. Leia a intenção dos inimigos. Escolha onde sangrar — e quando voltar. Três selos guardam a origem do sino.</p><div class="section-head"><h2>Quem restou de você?</h2><span class="eyebrow">ESCOLHA SUA ORIGEM</span></div>${Object.entries(
    CLASSES,
  )
    .map(
      ([id, c]) =>
        `<button class="class-choice ${origin === id ? 'selected' : ''}" data-origin="${id}" aria-pressed="${origin === id}">${icon(c.icon)}<div><strong>${c.name}</strong><small>${c.tag}</small><p>${c.text}</p></div></button>`,
    )
    .join(
      '',
    )}<label class="name-label" for="hero-name">SEU NOME · OPCIONAL</label><input id="hero-name" maxlength="24" autocomplete="off" placeholder="Condenado" aria-label="Nome do personagem"><button class="primary full" data-create>Entrar no Ossuário ${icon('arrow', 'small')}</button><p class="legal-note">Violência, morte e horror. Sem anúncios, compras ou conexão obrigatória após preparar o modo offline.</p><button class="ghost install-link" data-modal="install">${icon('bell', 'small')} Instalar no iPhone</button>${loaded.error ? `<div class="hint danger-hint">${esc(loaded.error)} <button data-modal="menu">Importar save</button></div>` : ''}</main>`;
}
function hub() {
  return `<div class="section-head"><div><div class="eyebrow">O ÚLTIMO REFÚGIO</div><h2>Ossuário</h2><p>Aqui, nenhuma ação gasta turno. Descanse antes de partir.</p></div>${icon('camp', 'large')}</div><div class="city">${skyline()}<div class="city-status">${DISTRICTS.slice(
    0,
    3,
  )
    .map(
      (d) =>
        `<span class="seal ${state.seals.includes(d.id) ? 'owned' : ''}" title="${d.seal}">${icon(d.icon)}</span>`,
    )
    .join(
      '',
    )}</div><div class="city-caption"><h2>Véspera</h2><p>${state.ending ? 'O sino silenciou. As ruínas ainda respiram.' : `${state.seals.length} / 3 selos · alcance a Catedral`}</p></div></div>${resources()}<div class="button-row"><button class="primary" data-action="shop" data-kind="rest">${icon('camp', 'small')} Descansar · grátis</button><button data-tab="forge">${icon('hammer', 'small')} Forja & botica</button></div><div class="section-head"><div><div class="eyebrow">ESCOLHA A PRÓXIMA EXPEDIÇÃO</div><h2>A cidade não perdoa</h2></div></div><div class="districts">${DISTRICTS.map(
    (d) => {
      const locked = d.id === 'cathedral' && state.seals.length < 3;
      return `<button class="district ${locked ? 'locked' : ''}" style="--district-color:${d.color}" data-depart="${d.id}" ${locked ? 'aria-disabled="true"' : ''}>${icon(d.icon)}${state.seals.includes(d.id) ? `<span class="completed">${icon('check', 'small')}</span>` : ''}<strong>${d.name}</strong><small>${d.subtitle}</small><div class="district-meta"><span>${locked ? '3 selos necessários' : `Perigo ${d.level} · 7 etapas`}</span><span>${locked ? 'FECHADO' : 'PARTIR ↗'}</span></div></button>`;
    },
  ).join(
    '',
  )}</div>${state.ending ? `<div class="card" style="margin-top:18px"><h3>${icon('bell')} Vigília ${state.meta.bestVigil + 1}</h3><p>Nova expedição nas Valas com inimigos mais resistentes e uma regra de risco. Seus talentos e selos permanecem. O desafio cresce a cada vigília vencida.</p><button class="full" style="margin-top:12px" data-vigil="${state.meta.bestVigil + 1}">Começar Vigília ${state.meta.bestVigil + 1} →</button></div>` : ''}<div class="section-head"><h2>Os vivos têm dívidas</h2><span class="eyebrow">CONTRATOS</span></div>${contracts()}${state.corpse ? `<div class="hint danger-hint">Seu cadáver está em ${DISTRICTS.find((d) => d.id === state.corpse.district).name}. Alcance a terceira etapa nesse distrito para recuperar os espólios. Uma nova morte substitui o cadáver.</div>` : ''}<div class="saved-note">${saveError ? 'PROGRESSO NÃO GRAVADO · EXPORTE PELO MENU' : 'PROGRESSO SALVO NO DISPOSITIVO'} · ${offlineReady ? 'OFFLINE PRONTO' : 'PREPARANDO OFFLINE'}</div>`;
}
function contracts() {
  return (
    `<div class="hint">Confiança dos sobreviventes: ${state.flags.reputation || 0}. Ajudar os vivos reduz os preços de bálsamos e das trocas em ${discount(state)} ossos (até 4). Chefes deixam ícor: use-o na forja para ganhar talentos ou tratar todas as marcas.</div>` +
    Object.entries(CONTRACTS)
      .map(([id, c]) => {
        const n = state.quests[id],
          claimed = state.claimed.includes(id);
        return `<div class="card"><h3>${c.name}${claimed ? ` ${icon('check', 'small')}` : ''}</h3><p>${c.desc}</p><div class="quest-progress">${n} / ${c.target} · ${claimed ? 'RECOMPENSA RECEBIDA' : `${c.reward} ossos + 12 experiência`}</div>${n >= c.target && !claimed ? `<button class="primary full" style="margin-top:12px" data-action="claim" data-id="${id}">Receber recompensa</button>` : ''}</div>`;
      })
      .join('')
  );
}
function journeyHead() {
  const ex = state.expedition,
    d = DISTRICTS.find((d) => d.id === ex.district);
  return `<div class="expedition-head">${icon(d.icon)}<div><div class="eyebrow">EXPEDIÇÃO ${state.meta.expeditions}${ex.vigil ? ` · VIGÍLIA ${ex.vigil}` : ''}</div><h2>${d.name}</h2><p>${icon('sun', 'small')} ${ex.light} luz · etapa ${Math.min(7, ex.depth + 1)} / 7 · ${ex.modifier.name}</p></div></div>`;
}
function route() {
  const ex = state.expedition;
  return `${journeyHead()}<div class="depth-track" aria-label="Etapa ${ex.depth + 1} de 7">${Array.from({ length: 7 }, (_, i) => `<div class="depth-dot ${i < ex.depth ? 'done' : i === ex.depth ? 'current' : ''}"></div>`).join('')}</div><div class="section-head"><div><div class="eyebrow">UMA TRAVESSIA · −${ex.modifier.id === 'scarce' ? 2 : 1} LUZ</div><h2>${ex.depth === 6 ? 'O selo está à frente' : 'Qual risco vale a pena?'}</h2><p>A rota escolhida fecha as outras nesta etapa.</p></div></div>${ex.modifier.id !== 'normal' ? `<div class="hint danger-hint">${ex.modifier.desc}</div>` : ''}${ex.light <= 2 ? '<div class="hint danger-hint">A luz está acabando. Com luz zero, confrontos comuns ganham um inimigo extra. Abrigos podem repor velas.</div>' : ''}<div class="route-grid">${ex.routes[
    ex.depth
  ]
    .map((n, i) => {
      const def = NODE_TYPES[n.type],
        encounter = ENCOUNTERS[n.encounter];
      const disclosed = ex.scouted.includes(ex.depth);
      return `<button class="route-choice" data-action="node" data-id="${n.id}">${icon(def.icon)}<div><span class="route-number">ROTA ${String(i + 1).padStart(2, '0')} · ${def.name}</span><strong>${encounter?.name || def.name}</strong><p>${encounter?.desc || def.desc}</p>${encounter ? `<small class="encounter-preview">${LAYOUTS[encounter.layout].name} · ${OBJECTIVES[encounter.objective].name}${disclosed ? `<br>Formação: ${encounter.foes.map((id) => ENEMIES[id].name).join(' · ')}${n.type === 'elite' ? ' + reforço de elite' : ''}` : ''}</small>` : ''}</div></button>`;
    })
    .join(
      '',
    )}</div><div class="card scout-card"><h3>${icon('eye')} Reconhecimento</h3><p>${ex.scouted.includes(ex.depth) ? 'Formações reveladas. O confronto escolhido começa com 3 ações; os turnos seguintes têm 2.' : 'Gaste 1 luz para revelar as formações desta etapa e começar o confronto escolhido com 3 ações. A escuridão ainda pode trazer um inimigo extra.'}</p>${!ex.scouted.includes(ex.depth) ? button('Reconhecer · 1 luz', `data-action="scout" ${ex.light < 1 ? 'disabled' : ''}`) : ''}</div>${resources()}<div class="hint">${state.meta.expeditions === 1 && ex.depth === 0 ? 'No combate, você tem duas ações. As casas vermelhas mostram ataques que ocorrerão ao encerrar o turno. Mova-se, interrompa ou prepare um aparo.' : 'Os espólios destacados só se tornam seguros quando você retorna. Experiência, equipamento e talentos já pertencem a você.'}</div><button class="full ghost" data-modal="retreat">${icon('exit', 'small')} Retirar-se com os espólios</button>`;
}
function room() {
  const r = state.room;
  let titleText = '',
    text = '',
    img = 'eye',
    choices = '';
  if (r.type === 'event') {
    const event = EVENTS[r.event];
    titleText = event.name;
    text = event.text;
    choices = event.choices
      .map((c, i) => choice(c.label, c.hint, `data-action="room" data-id="${i}"`))
      .join('');
  }
  if (r.type === 'camp') {
    titleText = 'Fogo que não responde';
    text =
      'Você encontrou uma porta que ainda fecha. Há tempo para uma única preparação antes de seguir.';
    img = 'camp';
    choices =
      choice(
        'Dormir com a arma na mão',
        'Recupera 24 vida. Não repõe luz nem remove Corrupção.',
        'data-action="room" data-id="rest"',
      ) +
      choice(
        'Recolher velas e preparar bálsamo',
        '+5 luz (máximo 12) · +1 bálsamo.',
        'data-action="room" data-id="light"',
      ) +
      choice(
        'Lavar a marca do sino',
        '−4 Corrupção · remove 1 cicatriz · cura 6.',
        'data-action="room" data-id="purify"',
      );
  }
  if (r.type === 'cache') {
    titleText = 'O que o morto deixou';
    text =
      'Um relicário foi escondido sob uma pedra de sepultura. A tampa está rachada. Escolha um conjunto; o resto se desfaz ao abrir.';
    img = 'chest';
    choices =
      choice(
        'Provisões de vigília',
        '+2 bálsamos · +1 bomba.',
        'data-action="room" data-id="supplies"',
      ) +
      choice(
        WEAPONS[r.weapon].name,
        WEAPONS[r.weapon].desc + ' Arma repetida concede 5 sucata.',
        'data-action="room" data-id="weapon"',
      ) +
      choice(
        RELICS[r.relic].name,
        RELICS[r.relic].desc + ' +1 progresso em Os dentes da santa.',
        'data-action="room" data-id="relic"',
      );
  }
  if (r.type === 'merchant') {
    titleText = 'O contrabandista';
    text =
      '“Não pergunte de onde veio. Não diga para quem é.” O vendedor aceita ossos frescos ou os que você trouxe do refúgio.';
    img = 'coins';
    choices =
      choice(
        'Comprar um bálsamo',
        `${price(state, 'flask')} ossos · cura 20 vida quando usado.`,
        'data-action="room" data-id="flask"',
      ) +
      choice(
        'Comprar uma bomba',
        `${price(state, 'merchantBomb')} ossos · dano em cruz e quebra de armadura.`,
        'data-action="room" data-id="bomb"',
      ) +
      choice(
        RELICS[r.relic].name,
        `${price(state, 'merchantRelic')} ossos · ${RELICS[r.relic].desc}`,
        'data-action="room" data-id="relic"',
      ) +
      choice(
        'Fechar a troca e seguir',
        'Avança para a próxima etapa.',
        'data-action="room" data-id="leave"',
        'primary',
      );
  }
  return `<div class="story-room">${journeyHead()}<div class="room-art">${icon(img)}</div><div class="room-title"><div class="eyebrow">UMA ESCOLHA · CONSEQUÊNCIAS REAIS</div><h2>${titleText}</h2></div><p class="room-text">${text}</p>${r.type === 'merchant' ? resources() : ''}${choices}<button class="full ghost" data-modal="retreat">${icon('exit', 'small')} Voltar ao Ossuário</button></div>`;
}
function board() {
  const c = state.combat,
    p = c.player,
    tiles = [];
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const pos = { x, y },
        e = enemyAt(state, pos),
        hero = p.x === x && p.y === y,
        tile = tileAt(state, pos),
        threat = threatened(state, pos).length > 0,
        valid = selected && SKILLS[selected].target !== 'self' && targetValid(state, selected, pos),
        chosen = target?.x === x && target?.y === y;
      const object = c.objective.objects.find((o) => o.active && o.x === x && o.y === y);
      const movement = c.enemies.some(
        (e) =>
          e.hp > 0 &&
          ((e.intent?.dest?.x === x && e.intent.dest.y === y) ||
            (e.intent?.moveAfter?.x === x && e.intent.moveAfter.y === y)),
      );
      const health = hero ? state.hero.hp : e?.hp,
        max = hero ? stats(state).maxHp : e?.maxHp;
      const unit = hero ? 'player' : e ? ENEMIES[e.kind].glyph : null,
        conditions = e
          ? [e.stun ? '×' : '', e.bleed ? `↓${e.bleed}` : '', e.burn ? '♨' : '']
              .filter(Boolean)
              .join('')
          : hero && p.bleed
            ? `↓${p.bleed}`
            : '';
      const label = `Casa ${x + 1},${y + 1} · ${hero ? 'você' : e ? ENEMIES[e.kind].name : tile === 'wall' ? 'pilar' : tile === 'pit' ? 'abismo' : tile === 'oil' ? 'óleo' : tile === 'fire' ? 'fogo' : tile === 'blood' ? 'sangue' : 'pedra'}${object ? ` · ${OBJECTIVES[c.objective.kind].name}${object.hp ? ` · ${object.hp} vida` : ''}` : ''}${threat ? ' · ameaçada' : ''}${e ? ` · ${e.hp} vida` : ''}${valid ? ' · alvo válido' : ''}`;
      tiles.push(
        `<button class="tile ${tile} ${hero ? 'hero' : ''} ${e ? 'enemy' : ''} ${e && ENEMIES[e.kind].boss ? 'boss' : ''} ${threat ? 'threat' : ''} ${movement ? 'movement' : ''} ${valid ? 'valid' : ''} ${chosen ? 'chosen' : ''} ${object ? 'objective-tile' : ''}" data-tile="${key(x, y)}" aria-label="${esc(label)}" aria-pressed="${!!chosen}">${unit ? figure(unit) : ''}${object ? `<span class="object-marker">${icon(OBJECTIVES[c.objective.kind].icon, 'small')}${object.hp ? `<b>${object.hp}</b>` : ''}</span>` : ''}${conditions ? `<span class="unit-status">${conditions}</span>` : ''}${e?.armor ? `<span class="unit-label">${e.armor}◇${ward(state, e) ? '+3' : ''}</span>` : ''}${unit ? `<div class="unit-hp"><span style="width:${(health / max) * 100}%"></span></div>` : ''}</button>`,
      );
    }
  return `<div class="board-frame"><div class="board" role="group" aria-label="Tabuleiro tático de seis por seis">${tiles.join('')}</div></div><div class="legend"><span><i></i>Ataque anunciado</span><span><i class="path"></i>Destino inimigo</span><span><i class="block"></i>Pilar bloqueia</span></div>`;
}
function intents() {
  return `<div class="intent-list">${state.combat.enemies
    .filter((e) => e.hp > 0)
    .map(
      (e) =>
        `<button class="intent ${e.stun ? 'interrupted' : e.intent.kind === 'move' ? 'moving' : ''}" data-enemy="${e.id}">${figure(ENEMIES[e.kind].glyph)}<div><strong>${ENEMIES[e.kind].name} · ${e.hp}</strong><small>${e.intent.label}${e.intent.damage ? ` · ${e.intent.damage} dano` : ''}</small></div></button>`,
    )
    .join('')}</div>`;
}
function actionInfo() {
  if (!selected)
    return `<div class="action-info idle"><strong>Escolha uma ação; depois toque no alvo.</strong><p>Leia as casas vermelhas. Nada é gasto até confirmar. Toque no inimigo para conhecer suas regras.</p></div>`;
  const skill = SKILLS[selected],
    self = skill.target === 'self',
    ready = self || target;
  return `<div class="action-info"><div class="row spread"><strong>${skill.name === 'Cortar' ? WEAPONS[state.hero.weapon].name : skill.name}</strong><button class="ghost" data-cancel style="padding:3px;min-height:30px;width:30px;text-align:center" aria-label="Cancelar seleção">×</button></div><p><span class="skill-description">${skill.desc} </span>${preview(state, selected, target)}</p>${ready ? `<button class="primary full confirm" data-confirm>Confirmar ${self ? skill.name.toLowerCase() : `em ${target.x + 1},${target.y + 1}`} ${icon('check', 'small')}</button>` : `<p class="gold select-target">Toque em um alvo com borda verde.</p>`}</div>`;
}
function controls() {
  const c = state.combat,
    quick = [
      'move',
      'strike',
      'guard',
      availableSkills(state).includes('interact') ? 'interact' : state.hero.skills[0],
      'flask',
    ];
  return `${actionInfo()}<div class="actions">${availableSkills(state)
    .map((id) => {
      const sk = SKILLS[id],
        cost = skillCost(state, id),
        lack =
          c.ap < cost.ap ||
          state.hero.vigor < cost.stamina ||
          (['flask', 'oil', 'bomb'].includes(id) && !state.supplies[id]);
      return `<button class="ability ${quick.includes(id) ? 'quick' : 'expanded'} ${selected === id ? 'selected' : ''} ${lack ? 'unavailable' : ''}" data-skill="${id}" aria-pressed="${selected === id}">${icon(id === 'strike' ? WEAPONS[state.hero.weapon].icon : sk.icon)}<strong>${id === 'strike' ? (state.hero.weapon === 'crossbow' ? 'Disparar' : 'Atacar') : id === 'flask' ? `Cura ${state.supplies.flask}` : sk.name}</strong><small>${cost.ap} A · ${cost.stamina} vigor</small></button>`;
    })
    .join(
      '',
    )}<button class="ability more-skills" data-modal="arsenal">${icon('chest')}<strong>Arsenal</strong><small>${state.hero.companion && !c.companionUsed ? 'Ordem aliada' : 'Todas'}</small></button></div><button class="turn-button" data-action="endTurn"><div><strong>Encerrar turno</strong><small>Inimigos agem · +3 vigor${c.actions === 0 ? ' +2 por aguardar' : ''}</small></div>${icon('arrow')}</button>${c.ap === 0 ? '<div class="hint exhausted">Ações gastas. Encerre o turno.</div>' : ''}`;
}
function objectiveStatus() {
  const c = state.combat,
    o = c.objective,
    def = OBJECTIVES[o.kind];
  let progress = '';
  if (o.kind === 'ritual')
    progress = `${o.objects.filter((p) => !p.active).length} / 2 âncoras rompidas`;
  if (o.kind === 'rescue')
    progress = o.objects[0].active
      ? `Prisioneiro: ${o.objects[0].hp} vida`
      : o.objects[0].hp
        ? 'Prisioneiro salvo'
        : 'Prisioneiro perdido';
  if (o.kind === 'supplies')
    progress = o.objects[0].active ? 'Baú ainda fechado' : 'Provisões recolhidas';
  if (o.kind === 'siege')
    progress =
      c.turn < 6
        ? 'Porta abre no turno 6 · reforços nos turnos 3 e 5'
        : 'Porta aberta · use Interagir em 3,6';
  return `<div class="objective-status"><div>${icon(def.icon)}<strong>${def.name}</strong><span>${progress}</span></div>${o.kind !== 'eliminate' ? `<details><summary>Como cumprir</summary><p>${def.desc}</p></details>` : ''}${c.player.root ? '<small class="gold">Correntes: próximo movimento custa +2 vigor.</small>' : ''}${state.hero.companion ? `<small>Companhia: ${COMPANIONS[state.hero.companion].name} · ${c.companionUsed ? 'ordem já usada' : 'ordem disponível no Arsenal'}</small>` : ''}</div>`;
}
function combat() {
  const c = state.combat;
  const capacity =
    c.turn === 1 && state.expedition.scouted.includes(state.expedition.depth) ? 3 : 2;
  return `<div class="combat-layout"><div class="combat-top"><div><div class="eyebrow">${c.type === 'boss' ? 'GUARDIÃO DO SELO' : c.type === 'elite' ? 'CAÇADA · RISCO ALTO' : 'CONFRONTO'} · TURNO ${c.turn}</div><h2>${ENCOUNTERS[c.encounter]?.name || 'O próximo golpe é visível'}</h2></div><div class="ap" aria-label="${c.ap} ações restantes">${Array.from({ length: capacity }, (_, i) => `<i class="ap-dot ${i < c.ap ? '' : 'spent'}"></i>`).join('')} <span>${c.ap} / ${capacity}</span></div></div><div class="board-area">${objectiveStatus()}${board()}${intents()}</div><div class="control-area">${controls()}</div><div class="combat-log" aria-live="polite"><div class="eyebrow">ÚLTIMOS ACONTECIMENTOS</div>${state.log
    .slice(-5)
    .map((l) => `<p class="${l.type}">${esc(l.text)}</p>`)
    .join('')}</div></div>`;
}
function resolution() {
  const screen = state.screen,
    r = state.room;
  const death = screen === 'death',
    ending = screen === 'ending',
    final = screen === 'endingChoice';
  if (death)
    return `<div class="story-room"><div class="room-art red">${icon('skull')}</div><div class="room-title"><div class="eyebrow">MORTE ${state.meta.deaths} · A DÍVIDA PERMANECE</div><h2>O sino ainda sabe seu nome</h2></div><p class="room-text">Seu corpo ficou na ruína. Alguém o arrastou de volta até o Ossuário. A carne voltou; uma parte dela, não.</p><div class="hint danger-hint">${state.hero.wounds} cicatriz${state.hero.wounds > 1 ? 'es' : ''}: −${state.hero.wounds * 3} vida máxima. Recupere os espólios ao alcançar a terceira etapa do mesmo distrito. Uma nova morte substitui o cadáver.</div><p class="muted">Talentos, experiência, armas, contratos e selos permanecem. Seus bálsamos voltam a um mínimo de dois.</p><button class="primary full" data-action="home" style="margin-top:22px">Levantar-se no Ossuário</button></div>`;
  return `<div class="story-room"><div class="room-art">${icon(screen === 'reward' ? 'blade' : 'bell')}</div><div class="room-title"><div class="eyebrow">${ending ? 'CAMPANHA CONCLUÍDA' : final ? 'O ÚLTIMO NOME' : screen === 'victory' ? 'SELO CONQUISTADO' : 'CONFRONTO VENCIDO'}</div><h2>${r?.title || 'A congregação cala'}</h2></div><p class="room-text ${ending ? 'ending-text' : ''}">${r?.text || ''}</p>${final ? choice('Quebrar o sino', 'Seu nome será apagado. Os mortos poderão morrer. +2 talentos · abre a Vigília.', 'data-action="ending" data-id="break"', 'primary') + choice('Prender o sino ao próprio peito', 'A cidade viverá sob sua sentença. +2 talentos · abre a Vigília.', 'data-action="ending" data-id="bind"') : screen === 'reward' ? `<button class="primary full" data-action="continue">Continuar a expedição →</button><button class="ghost full" style="margin-top:10px" data-modal="retreat">Retirar-se com os espólios</button>` : `<button class="primary full" data-action="home">${ending ? 'Voltar ao Ossuário · Vigília desbloqueada' : 'Retornar com o selo e os espólios'}</button>`}${ending ? '<div class="hint">O desfecho está registrado na Crônica. As expedições continuam; a Vigília adiciona modificadores e inimigos mais fortes.</div>' : ''}</div>`;
}
function talents() {
  return `<div class="section-head"><div><div class="eyebrow">MISTURE OS CAMINHOS</div><h2>O que a dor ensina</h2><p>${state.hero.points} ponto${state.hero.points !== 1 ? 's' : ''} disponível${state.hero.points !== 1 ? 's' : ''} · experiência ${state.hero.xp} / ${xpNeeded(state)}</p></div>${icon('star', 'large')}</div><div class="hint">Cada nível concede 1 ponto. Selos inéditos concedem mais 1. Talentos mudam suas regras de combate; podem ser aprendidos entre encontros.</div>${[
    'Ferro',
    'Sangue',
    'Cinza',
  ]
    .map(
      (path) =>
        `<section class="talent-path"><h3>${path === 'Ferro' ? icon('shield') : path === 'Sangue' ? icon('drop') : icon('flame')} ${path}</h3>${Object.entries(
          TALENTS,
        )
          .filter(([, t]) => t.path === path)
          .map(([id, t]) => {
            const learned = state.hero.talents.includes(id),
              locked = t.requires && !state.hero.talents.includes(t.requires);
            return `<div class="talent ${learned ? 'learned' : locked ? 'locked' : ''}"><div><h3>${t.name}</h3><p>${t.desc}</p>${locked ? `<div class="requires">Requer ${TALENTS[t.requires].name}</div>` : ''}</div>${learned ? icon('check') : button(`${t.cost} PT`, `data-action="learn" data-id="${id}" ${locked || state.hero.points < t.cost || state.combat ? 'disabled' : ''}`, state.hero.points >= t.cost && !locked ? 'primary' : '')}</div>`;
          })
          .join('')}</section>`,
    )
    .join('')}`;
}
function gear() {
  const h = state.hero,
    s = stats(state);
  return `<div class="section-head"><div><div class="eyebrow">EQUIPAMENTO MUDA SUA ESTRATÉGIA</div><h2>Ferro, pele e restos</h2><p>${state.combat ? 'Trocas bloqueadas durante combate.' : 'Trocar entre encontros não consome turno ou luz.'}</p></div>${icon('blade', 'large')}</div><div class="stats-grid">${[
    [s.damage, 'DANO DA ARMA'],
    [s.armor, 'PROTEÇÃO POR GOLPE'],
    [s.maxHp, 'VIDA MÁXIMA'],
    [s.maxVigor, 'VIGOR MÁXIMO'],
    [s.power, 'PODER DOS RITOS'],
  ]
    .map(([n, label]) => `<div class="stat"><strong>${n}</strong><small>${label}</small></div>`)
    .join('')}</div><div class="section-head"><h2>Arsenal</h2></div>${h.ownedWeapons
    .map((id) => {
      const w = WEAPONS[id],
        up = h.upgrades[id] || 0,
        rune = RUNES[h.runes[id] || 'none'];
      return `<div class="card equipment-item">${icon(w.icon)}<div><h3>${w.name} ${up ? `+${up}` : ''}</h3><p>${w.desc}</p><div class="item-stats">${w.damage + up * 2 + Math.floor((h.level - 1) / 2) + rune.damage} dano · alcance ${w.range} · ${w.cost + rune.vigor} vigor</div><small class="gold">${rune.name}</small>${h.weapon === id ? '<div class="quest-progress">EQUIPADA</div>' : button('Equipar', `data-action="equip" data-kind="weapon" data-id="${id}" ${state.combat ? 'disabled' : ''}`)}</div></div>`;
    })
    .join(
      '',
    )}<div class="section-head"><h2>Proteção</h2></div>${h.ownedArmor.map((id) => `<div class="card equipment-item">${icon('shield')}<div><h3>${ARMORS[id].name}</h3><p>${ARMORS[id].desc}</p>${h.armor === id ? '<div class="quest-progress">EQUIPADA</div>' : button('Equipar', `data-action="equip" data-kind="armor" data-id="${id}" ${state.combat ? 'disabled' : ''}`)}</div></div>`).join('')}<div class="section-head"><h2>Relíquia · um espaço</h2></div>${h.ownedRelics.length ? h.ownedRelics.map((id) => `<div class="card equipment-item">${icon('eye')}<div><h3>${RELICS[id].name}</h3><p>${RELICS[id].desc}</p>${h.relic === id ? '<div class="quest-progress">EQUIPADA</div>' : button('Equipar', `data-action="equip" data-kind="relic" data-id="${id}" ${state.combat ? 'disabled' : ''}`)}</div></div>`).join('') : '<div class="hint">Relicários e caçadas podem conceder uma relíquia. Cada uma abre uma sinergia de build.</div>'}${h.relic !== 'none' ? button('Remover relíquia', 'data-action="equip" data-kind="relic" data-id="none"', 'ghost full') : ''}<div class="section-head"><h2>Provisões</h2></div><div class="card"><p>${state.supplies.flask} bálsamos · ${state.supplies.oil} óleos · ${state.supplies.bomb} bombas</p><p>São usadas por ações no combate. Prepare mais na botica ou escolha provisões nos relicários.</p></div>${state.screen === 'hub' ? button('Abrir forja e botica', 'data-tab="forge"', 'primary full') : ''}`;
}
function forge() {
  const h = state.hero,
    up = h.upgrades[h.weapon] || 0,
    w = WEAPONS[h.weapon];
  return `<div class="section-head"><div><div class="eyebrow">OSSO PAGA FERRO</div><h2>Forja & botica</h2><p>Compras e melhorias são permanentes. Não gastam tempo.</p></div>${icon('hammer', 'large')}</div>${resources()}<div class="card"><h3>${icon('hammer')} Melhorar ${w.name}</h3><p>Melhoria ${up} / ${state.claimed.includes('hunt') ? 3 : 2}. Cada melhoria acrescenta 2 dano. O contrato de caça libera III.</p><button class="full primary" style="margin-top:14px" data-action="shop" data-kind="upgrade">Forjar · ${15 + up * 10} ossos + ${w.scrap + up * 4} sucata</button></div><div class="shop-grid">${[
    ['flask', 'Bálsamo', `${price(state, 'flask')} ossos`, 'Cura 20 e limpa Sangramento.', 'flask'],
    ['oil', 'Óleo', '6 ossos', 'Cobre uma cruz; Brasa incendeia.', 'flask'],
    ['bomb', 'Bomba', '14 ossos + 2 sucata', '13 dano em cruz; quebra 2 armadura.', 'burst'],
    ['surgery', 'Tratar cicatriz', '20 ossos', 'Remove 1 cicatriz e cura 10.', 'heart'],
    ['purify', 'Purificar', '10 ossos', 'Remove toda Corrupção.', 'drop'],
    ['rest', 'Descansar', 'Grátis', 'Vida e vigor completos; mínimo 2 bálsamos.', 'camp'],
    [
      'sacrament',
      'Sacramento',
      '30 ossos + 3 ícor',
      'Converte ícor de chefes em 1 ponto de talento permanente.',
      'star',
    ],
    [
      'transfusion',
      'Transfusão',
      '2 ícor',
      'Remove todas as cicatrizes e Corrupção; recupera toda vida.',
      'drop',
    ],
  ]
    .map(
      ([kind, name, price, desc, img]) =>
        `<div class="card"><h3>${icon(img, 'small')} ${name}</h3><p>${desc}</p><button data-action="shop" data-kind="${kind}">${price}</button></div>`,
    )
    .join('')}</div><div class="section-head"><h2>Armas à venda</h2></div>${
    Object.entries(WEAPONS)
      .filter(([id]) => !h.ownedWeapons.includes(id))
      .map(
        ([id, w]) =>
          `<div class="card equipment-item">${icon(w.icon)}<div><h3>${w.name}</h3><p>${w.desc}</p><div class="item-stats">${w.damage} dano · alcance ${w.range} · ${w.cost} vigor</div><button data-action="shop" data-kind="weapon" data-id="${id}">Comprar · ${w.price} ossos</button></div></div>`,
      )
      .join('') || '<p class="muted">Você possui todas as armas.</p>'
  }<div class="section-head"><h2>Armaduras à venda</h2></div>${Object.entries(ARMORS)
    .filter(([id]) => !h.ownedArmor.includes(id))
    .map(
      ([id, a]) =>
        `<div class="card"><h3>${a.name}</h3><p>${a.desc}</p><button style="margin-top:12px" data-action="shop" data-kind="armor" data-id="${id}">Comprar · ${a.price} ossos</button></div>`,
    )
    .join('')}`;
}
function journal() {
  return `<div class="section-head"><div><div class="eyebrow">O METAL GUARDA NOMES</div><h2>Crônica de Véspera</h2></div>${icon('book', 'large')}</div><div class="stats-grid">${[
    [state.meta.expeditions, 'EXPEDIÇÕES'],
    [state.meta.kills, 'MORTOS DE VEZ'],
    [state.meta.deaths, 'MORTES'],
    [state.meta.bestVigil, 'VIGÍLIA VENCIDA'],
  ]
    .map(([n, label]) => `<div class="stat"><strong>${n}</strong><small>${label}</small></div>`)
    .join(
      '',
    )}</div>${state.journal.map((entry, i) => `<div class="journal-entry"><small>FRAGMENTO ${String(i + 1).padStart(2, '0')}</small>${esc(entry)}</div>`).join('')}<div class="section-head"><h2>Registro recente</h2></div><div class="combat-log">${state.log
    .slice(-25)
    .map((l) => `<p class="${l.type}">${esc(l.text)}</p>`)
    .join('')}</div>`;
}
function help() {
  return `<div class="section-head"><div><div class="eyebrow">CONHECIMENTO NÃO GASTA TURNO</div><h2>Sobreviver ao sino</h2></div>${icon('eye', 'large')}</div>${[
    [
      'Seu objetivo',
      'Conquiste os selos das Valas, da Abadia e do Cárcere. Os três abrem a Catedral. Derrote o Pai do Sino e escolha um dos dois desfechos. Depois, a Vigília continua com novas regras e dificuldade crescente.',
    ],
    [
      'Duas ações, nenhuma pressa',
      'Cada turno começa com 2 ações. Escolha uma habilidade, toque no alvo e confirme. Encerrar turno executa as intenções inimigas e recupera 3 vigor. Aguardar sem gastar ação recupera mais 2. Menus e seleção não gastam nada.',
    ],
    [
      'A intenção é uma promessa',
      'Vermelho marca casas que serão atingidas. Os ataques ficam fixos mesmo se você se mover ou empurrar o inimigo. Tracejado marca o destino de movimento. Ao chegar perto, inimigos anunciam golpes apenas no turno seguinte. Alguns ataques atingem outros inimigos por metade do dano.',
    ],
    [
      'Aparar ou interromper',
      'Aparar bloqueia 8 dano no total do turno, mais 4 com Postura de vigília. Um bloqueio prepara Contra-ataque, que aumenta seu próximo ataque da arma. Ruptura, colisões e malho pesado interrompem a intenção. Contra-ataque permanece até ser usado.',
    ],
    [
      'Armadura, sangue, fogo',
      'Armadura reduz golpes, até um mínimo de 1 dano. Sangramento ignora armadura, causa seu valor em dano antes das intenções e perde 1 intensidade por turno. Fogo reduz a armadura pela metade no impacto e aplica 2 turnos de queimadura (3 dano por turno). Você sofre 5 dano ao entrar no fogo e ao encerrar o turno nele. Inimigos sofrem 5 ao entrar ou permanecer no fogo após agir, além da Queimadura. Quando possível, anunciam o destino da fuga.',
    ],
    [
      'O terreno é uma arma',
      'Pilares bloqueiam movimento, disparos e investidas. Empurrar contra um pilar ou unidade causa 4 dano extra e interrompe. Empurrar no abismo mata imediatamente. Óleo não causa dano sozinho: Brasa ou explosão incendeia todo óleo conectado. Sangue no chão é terreno transitável sem penalidade.',
    ],
    [
      'Armas e alcance',
      'Espada e facas atacam adjacente. Malho quebra armadura; golpe pesado também interrompe. Lança alcança 2 casas em linha reta. Besta alcança 5 casas com linha de visão. Dízimo e Ceifar ignoram armadura. Uma relíquia pode ser equipada por vez. Trocas e talentos só entre batalhas.',
    ],
    [
      'Luz e Corrupção',
      'Cada rota custa 1 luz. Luz zero adiciona um inimigo a confrontos comuns. Abrigos repõem luz, curam ou purificam — escolha um serviço. Com 6 Corrupção, você perde 2 vida por turno (9 com Voz do abismo). Dízimo e certos inimigos aumentam a marca; abrigos e botica a removem.',
    ],
    [
      'Progresso e morte',
      'Experiência, equipamento, talentos, selos e contratos permanecem na morte. Ossos, sucata e ícor encontrados só ficam seguros ao retornar. Morrer deixa uma cicatriz (−3 vida máxima, até cinco) e um cadáver. Recupere-o alcançando a terceira etapa do mesmo distrito. Uma nova morte substitui o cadáver. Descansar no refúgio é grátis.',
    ],
    [
      'Salvamento e interrupções',
      'O jogo grava cada ação confirmada e guarda uma cópia anterior. Nada avança com o aplicativo fechado. Exporte um save pelo menu para guardar ou transferir a campanha. O navegador pode remover dados locais; a cópia exportada é sua garantia independente.',
    ],
    [
      'Ícor e confiança',
      'Chefes deixam ícor. Na forja, 3 ícor e 30 ossos viram um ponto de talento; 2 ícor removem todas as cicatrizes e Corrupção e recuperam sua vida. Ajudar sobreviventes aumenta Confiança; cada ponto reduz preços de bálsamo e contrabando até um desconto de quatro.',
    ],
    [
      'Jogar no iPhone',
      'Abra o endereço HTTPS no Safari. Compartilhar → Adicionar à Tela de Início → mantenha Abrir como App da Web ativado quando disponível. Espere o indicador OFFLINE PRONTO. Depois abra pelo ícone. Retrato é recomendado; todos os controles funcionam por toque.',
    ],
  ]
    .map(([name, text]) => `<div class="card"><h3>${name}</h3><p>${text}</p></div>`)
    .join('')}`;
}
function companions() {
  const h = state.hero;
  return `<section class="companions"><div class="section-head"><div><div class="eyebrow">UMA COMPANHIA · UMA ORDEM POR COMBATE</div><h2>Quem volta com você</h2></div>${icon('chain')}</div><p class="muted">Escolha no Ossuário. A ordem aparece no Arsenal e usa ações, sem adicionar outra peça ao tabuleiro.</p>${Object.entries(
    COMPANIONS,
  )
    .map(
      ([id, def]) =>
        `<div class="card equipment-item">${icon(def.icon)}<div><h3>${def.name}</h3><p>${def.desc}</p>${h.companion === id ? '<div class="quest-progress">ACOMPANHANDO SUA EXPEDIÇÃO</div>' : h.roster.includes(id) ? button('Escolher companhia', `data-action="companion" data-id="${id}" ${state.screen !== 'hub' ? 'disabled' : ''}`) : `<div class="quest-progress">CONTRATO: ${CONTRACTS[def.require].name} · ${state.quests[def.require]} / ${CONTRACTS[def.require].target}</div>`}</div></div>`,
    )
    .join(
      '',
    )}${h.companion ? button('Seguir sozinho', `data-action="companion" data-id="none" ${state.screen !== 'hub' ? 'disabled' : ''}`, 'ghost full') : ''}</section>`;
}
function engraving(craft = false) {
  const current = runeFor(state),
    h = state.hero;
  const ids = craft
    ? Object.keys(RUNES).filter((id) => id !== 'none' && !h.ownedRunes.includes(id))
    : ['none', ...h.ownedRunes];
  return `<section class="runes"><div class="section-head"><div><div class="eyebrow">UMA GRAVAÇÃO POR ARMA</div><h2>${craft ? 'A mesa dos nomes' : 'Gravações conhecidas'}</h2></div>${icon('star')}</div><div class="hint">${WEAPONS[h.weapon].name}: ${RUNES[current].name}. Cada arma guarda sua própria gravação. Runas conhecidas podem ser reutilizadas gratuitamente entre confrontos.</div>${
    ids
      .map((id) => {
        const rune = RUNES[id];
        return `<div class="card"><h3>${rune.name}</h3><p>${rune.desc}</p>${current === id && !craft ? '<div class="quest-progress">GRAVADA NESTA ARMA</div>' : button(craft ? `Criar e gravar · ${rune.cost.bones} ossos · ${rune.cost.scrap} sucata${rune.cost.ichor ? ` · ${rune.cost.ichor} ícor` : ''}` : 'Gravar nesta arma', `data-action="${craft ? 'engrave' : 'rune'}" data-id="${id}" ${state.combat ? 'disabled' : ''}`, 'full')}</div>`;
      })
      .join('') || '<p class="muted">Todas as seis runas foram aprendidas.</p>'
  }${!craft && state.screen === 'hub' ? button('Criar runas na forja', 'data-tab="forge"', 'primary full') : ''}</section>`;
}
function bestiary() {
  return `<section class="bestiary"><div class="section-head"><div><div class="eyebrow">SÓ O ENCONTRO REVELA O NOME</div><h2>O livro dos mortos</h2></div>${icon('skull')}</div>${Object.entries(
    ENEMIES,
  )
    .map(([id, def]) =>
      state.codex[id]
        ? `<details class="card bestiary-entry"><summary>${figure(def.glyph)}<span><strong>${def.name}</strong><small>${state.codex[id].seen} encontros · ${state.codex[id].kills} mortes</small></span></summary><p>${def.desc}</p><div class="item-stats">Base: ${def.hp} vida · ${def.damage} dano · ${def.armor} armadura. Distrito, elite e Vigília aumentam o perigo.</div></details>`
        : `<div class="bestiary-unknown">${icon('skull', 'small')} Nome ainda desconhecido</div>`,
    )
    .join('')}</section>`;
}
function expansionHelp() {
  return `<div class="section-head"><h2>A Congregação</h2></div>${[
    [
      'Objetivos no tabuleiro',
      'Interagir custa 1 ação e 1 vigor. Use adjacente aos símbolos dourados: âncoras encerram o ritual quando ambas se rompem; jaulas libertam Ivo; baús dão bálsamo e bomba. Resgate e provisões precisam acontecer antes do último inimigo morrer. Ataques de área dos dois lados e fogo podem matar o prisioneiro.',
    ],
    [
      'Resistir e sair',
      'Em cercos, matar todos não encerra a batalha. Reforços chegam nos turnos 3 e 5. A partir do turno 6, fique na saída ou adjacente a ela e use Interagir. Você pode sair com inimigos vivos; recebe experiência só pelos inimigos realmente mortos e pelo objetivo.',
    ],
    [
      'Reconhecimento',
      'Entre encontros, 1 luz revela as formações e concede 3 ações no primeiro turno do próximo combate dessa etapa. As escolhas permanecem fixas. Os outros turnos têm 2 ações. Reconhecer uma etapa de abrigo não leva o bônus à etapa seguinte.',
    ],
    [
      'Gravações e companhia',
      'Crie seis runas na forja, cada uma com efeito e custo próprios. Cada arma guarda uma runa; trocar uma runa conhecida é grátis entre confrontos. Escolha Mara, Ivo ou Sibila no Ossuário após seus contratos. Uma única ordem por combate fica no Arsenal.',
    ],
    [
      'Suporte inimigo',
      'Portadores reduzem em 3 o dano físico contra aliados adjacentes; fogo e ritos atravessam. Costureiras curam o aliado anunciado e podem ser interrompidas. Penitentes detonam e morrem. Correntes aumentam em 2 o custo do próximo deslocamento. Aparos completos impedem efeitos do golpe.',
    ],
  ]
    .map(([name, desc]) => `<div class="card"><h3>${name}</h3><p>${desc}</p></div>`)
    .join('')}`;
}
function mainScreen() {
  if (state.screen === 'hub') return hub() + companions();
  if (state.screen === 'route') return route();
  if (state.screen === 'combat') return combat();
  if (state.screen === 'room') return room();
  return resolution();
}
function render() {
  document.documentElement.classList.toggle('no-motion', state && !state.options.motion);
  if (!state) {
    app.innerHTML = introduction();
    renderModal();
    return;
  }
  app.innerHTML = `<main class="shell ${state.screen === 'combat' && tab === 'map' ? 'combat-shell' : ''}">${title()}${hud()}${tab === 'gear' ? gear() + engraving() + companions() : tab === 'talents' ? talents() : tab === 'journal' ? journal() + bestiary() : tab === 'help' ? help() + expansionHelp() : tab === 'forge' ? forge() + engraving(true) : mainScreen()}</main>${nav()}`;
  renderModal();
}
function openModal(id, data = null) {
  lastFocus = document.activeElement;
  modal = { id, data };
  modalScroll = window.scrollY;
  renderModal();
  document.querySelector('.modal [data-close]')?.focus({ preventScroll: true });
}
function closeModal() {
  modal = null;
  modalRoot.innerHTML = '';
  document.body.classList.remove('modal-locked');
  if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
}
function menuContent() {
  return `<p>${state ? 'Partida pausada. Nada acontece enquanto você estiver aqui. Seu progresso é gravado após cada ação.' : 'Você pode importar uma campanha ou iniciar uma nova.'}</p>${state ? `<div class="hint ${saveError ? 'danger-hint' : ''}">${saveError ? 'O armazenamento falhou. Exporte sua campanha agora.' : `Salvo no dispositivo · ${state.lastSave ? new Date(state.lastSave).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'agora'}`}</div><button class="menu-button" data-export><span class="row">${icon('book')} Exportar campanha</span><small>Arquivo .json</small></button><button class="menu-button" data-audio><span class="row">${icon('sound')} Áudio</span><small>${state.options.sound ? 'Ativado' : 'Silenciado'}</small></button><button class="menu-button" data-motion><span class="row">${icon('eye')} Animações</span><small>${state.options.motion ? 'Ativadas' : 'Reduzidas'}</small></button>` : ''}<button class="menu-button" data-modal="import"><span class="row">${icon('chest')} Importar campanha</span><small>Restaurar arquivo</small></button><button class="menu-button" data-modal="install"><span class="row">${icon('bell')} Instalar no iPhone</span><small>${offlineReady ? 'Offline pronto' : 'Preparando offline'}</small></button>${waitingWorker ? '<button class="menu-button primary" data-update>Salvar e instalar atualização</button>' : ''}${state ? '<button class="menu-button danger" data-modal="reset">Começar outra campanha</button>' : ''}<p class="menu-note">SINO NEGRO v2.0 · A Congregação · Sem rede para o gameplay. O modo offline exige um primeiro carregamento completo por HTTPS ou localhost. Não há cronômetro de combate.</p>`;
}
function renderModal() {
  if (!modal) {
    modalRoot.innerHTML = '';
    document.body.classList.remove('modal-locked');
    return;
  }
  let heading = '',
    content = '';
  const id = modal.id;
  if (id === 'menu') {
    heading = 'Silêncio por um instante';
    content = menuContent();
  }
  if (id === 'arsenal') {
    heading = 'Seu arsenal';
    content =
      '<p>Escolher uma habilidade não gasta turno. Após escolher, toque em um alvo no tabuleiro e confirme.</p>' +
      availableSkills(state)
        .map((id) => {
          const sk = SKILLS[id],
            cost = skillCost(state, id);
          return choice(
            `${icon(sk.icon, 'small')} ${sk.name} · ${cost.ap} A / ${cost.stamina} vigor`,
            sk.desc,
            `data-skill="${id}"`,
          );
        })
        .join('');
  }
  if (id === 'install') {
    heading = 'Levar o sino com você';
    content = `<div class="room-art">${icon('bell')}</div><h3>1. Abra no Safari</h3><p>Acesse o endereço HTTPS do jogo no seu iPhone. Use o Safari para adicionar o aplicativo.</p><h3>2. Adicione à tela inicial</h3><p>Toque em <strong>Compartilhar → Adicionar à Tela de Início</strong>. Se aparecer, mantenha <strong>Abrir como App da Web</strong> ativado.</p><h3>3. Abra pelo ícone</h3><p>O jogo abrirá como aplicativo, sem a barra de endereço do Safari. Os indicadores do iOS continuam seguindo as regras do aparelho.</p><div class="hint">${offlineReady ? 'Os arquivos estão preparados para jogar offline.' : 'Aguarde o indicador OFFLINE PRONTO no Ossuário. Mantenha a conexão até o primeiro cache terminar.'}</div><p>Seu save pertence a este endereço e a este navegador. Exporte e importe pelo menu se precisar transferir a campanha entre o Safari e o aplicativo instalado.</p>`;
  }
  if (id === 'retreat') {
    heading = 'Voltar vivo é uma vitória';
    const bag = state.expedition.bag;
    content = `<p>Você deposita ${bag.bones} ossos, ${bag.scrap} sucatas e ${bag.ichor} ícor. A próxima expedição começa em outra rota desde a primeira etapa. Cicatrizes e Corrupção permanecem.</p><div class="button-row"><button data-close>Ficar na ruína</button><button class="primary" data-retreat>Retornar</button></div>`;
  }
  if (id === 'depart') {
    const d = DISTRICTS.find((d) => d.id === modal.data);
    heading = d.name;
    content = `<div class="room-art">${icon(d.icon)}</div><p class="room-text">${d.intro}</p><div class="hint">7 etapas · guardião: ${ENEMIES[d.boss].name}. Cada travessia custa luz. Seu dano atual é ${stats(state).damage}; você leva ${state.supplies.flask} bálsamos. Descansar no refúgio é grátis.</div><p>Leia intenções e recue quando necessário. A morte preserva progressão, mas perde os espólios e deixa uma cicatriz.</p><button class="primary full" style="margin-top:18px" data-start-expedition="${d.id}">Entrar na ruína →</button>`;
  }
  if (id === 'enemy') {
    const e = state.combat?.enemies.find((e) => e.id === modal.data);
    if (!e) {
      closeModal();
      return;
    }
    heading = ENEMIES[e.kind].name;
    content = `<div class="row spread">${figure(ENEMIES[e.kind].glyph)}<div><p>${e.hp} / ${e.maxHp} vida</p><p>${e.armor} Armadura · ${e.damage} dano base</p></div></div><h3>Comportamento</h3><p>${ENEMIES[e.kind].desc}</p><h3>Intenção atual</h3><p>${e.intent.label}${e.intent.damage ? ` · ${e.intent.damage} dano antes da proteção` : ''}.</p><p>${e.intent.kind === 'attack' ? 'As casas vermelhas correspondentes são fixas até o fim deste turno.' : 'Movimentos e invocações não causam dano direto neste turno.'}</p>${e.bleed || e.burn ? `<div class="hint">Sangramento ${e.bleed} · Queimadura ${e.burn} turno(s). Dano de estado acontece antes da intenção.</div>` : ''}`;
  }
  if (id === 'reset') {
    heading = 'Outra sentença';
    content =
      '<p>Começar outra campanha substitui o progresso neste dispositivo. Exporte sua campanha atual se quiser guardá-la.</p><div class="button-row"><button data-export>Exportar primeiro</button><button class="danger" data-reset>Substituir campanha</button></div>';
  }
  if (id === 'import') {
    heading = 'Restaurar uma campanha';
    content =
      '<p>Escolha um arquivo exportado por Sino Negro. O arquivo será validado antes de pedir a confirmação da substituição.</p><input class="file-input" type="file" id="import-file" accept="application/json,.json" aria-label="Arquivo da campanha">';
  }
  if (id === 'confirmImport') {
    heading = 'Campanha encontrada';
    const incoming = modal.data;
    content = `<p>${esc(incoming.hero.name)} · ${CLASSES[incoming.hero.origin].name} · nível ${incoming.hero.level}. ${incoming.seals.length} selos. ${incoming.meta.expeditions} expedições.</p><p>Restaurar substitui o progresso atual. A cópia anterior continua no backup local até sua próxima ação.</p><div class="button-row"><button data-close>Cancelar</button><button class="primary" data-restore>Restaurar</button></div>`;
  }
  modalRoot.innerHTML = `<div class="modal-backdrop" data-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading"><div class="modal-head"><h2 id="modal-heading">${heading}</h2><button data-close aria-label="Fechar menu">×</button></div>${content}</section></div>`;
  document.body.classList.add('modal-locked');
}
function exportSave() {
  if (!state) return;
  const blob = new Blob([encode(state)], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = `sino-negro-nivel-${state.hero.level}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Campanha exportada. Guarde o arquivo fora do navegador.');
}
document.addEventListener('click', (event) => {
  if (state?.options.sound) setAudio(true);
  const el = event.target.closest('button');
  if (!el) {
    if (event.target.hasAttribute('data-backdrop')) closeModal();
    return;
  }
  if (el.disabled) return;
  if (el.hasAttribute('data-close')) {
    closeModal();
    return;
  }
  if (el.dataset.modal) {
    openModal(el.dataset.modal);
    return;
  }
  if (el.dataset.origin) {
    const typed = document.querySelector('#hero-name')?.value;
    origin = el.dataset.origin;
    render();
    if (typed) document.querySelector('#hero-name').value = typed;
    return;
  }
  if (el.hasAttribute('data-create')) {
    state = createGame(origin, document.querySelector('#hero-name').value);
    persist();
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (el.dataset.tab) {
    tab = el.dataset.tab;
    selected = null;
    target = null;
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (el.dataset.depart) {
    const id = el.dataset.depart;
    if (id === 'cathedral' && state.seals.length < 3) {
      toast('Conquiste os selos das Valas, Abadia e Cárcere primeiro.', true);
      return;
    }
    openModal('depart', id);
    return;
  }
  if (el.dataset.startExpedition) {
    const id = el.dataset.startExpedition;
    closeModal();
    send({ type: 'depart', id });
    return;
  }
  if (el.dataset.vigil) {
    send({ type: 'depart', id: 'gutters', vigil: Number(el.dataset.vigil) });
    return;
  }
  if (el.hasAttribute('data-retreat')) {
    closeModal();
    send({ type: 'retreat' });
    return;
  }
  if (el.dataset.skill) {
    const id = el.dataset.skill,
      cost = skillCost(state, id);
    if (state.combat.ap < cost.ap) {
      toast('Ações insuficientes. Encerre o turno.', true);
      return;
    }
    if (state.hero.vigor < cost.stamina) {
      toast('Vigor insuficiente. Encerre o turno para recuperar vigor.', true);
      return;
    }
    if (['flask', 'oil', 'bomb'].includes(id) && !state.supplies[id]) {
      toast('Você não tem esse consumível.', true);
      return;
    }
    if (modal) closeModal();
    selected = selected === id ? null : id;
    target = null;
    render();
    return;
  }
  if (el.dataset.tile) {
    const [x, y] = el.dataset.tile.split(',').map(Number),
      pos = { x, y };
    if (selected) {
      if (SKILLS[selected].target === 'self') {
        toast('Use o botão Confirmar para aplicar a habilidade em você.');
        return;
      }
      if (!targetValid(state, selected, pos)) {
        toast('Alvo fora de alcance, ocupado ou bloqueado por pilar.', true);
        return;
      }
      target = pos;
      render();
      return;
    }
    const e = enemyAt(state, pos);
    if (e) openModal('enemy', e.id);
    else if (state.combat.objective.objects.some((o) => o.active && o.x === x && o.y === y))
      toast(OBJECTIVES[state.combat.objective.kind].desc);
    else
      toast(
        tileAt(state, pos) === 'fire'
          ? 'Fogo: 5 dano ao entrar e ao encerrar o turno.'
          : tileAt(state, pos) === 'oil'
            ? 'Óleo: Brasa espalha fogo por todas as casas conectadas.'
            : tileAt(state, pos) === 'pit'
              ? 'Abismo: não pode ser atravessado. Empurre um inimigo aqui para matá-lo.'
              : tileAt(state, pos) === 'wall'
                ? 'Pilar: bloqueia movimento e disparos. Colisões interrompem.'
                : 'Escolha Mover e confirme uma casa adjacente.',
      );
    return;
  }
  if (el.dataset.enemy) {
    openModal('enemy', el.dataset.enemy);
    return;
  }
  if (el.hasAttribute('data-confirm')) {
    send({ type: 'skill', id: selected, target });
    return;
  }
  if (el.hasAttribute('data-cancel')) {
    selected = null;
    target = null;
    render();
    return;
  }
  if (el.dataset.action) {
    const id =
      el.dataset.action === 'room' && /^\d+$/.test(el.dataset.id)
        ? Number(el.dataset.id)
        : el.dataset.action === 'companion' && el.dataset.id === 'none'
          ? null
          : el.dataset.id;
    send({ type: el.dataset.action, id, kind: el.dataset.kind });
    return;
  }
  if (el.hasAttribute('data-export')) {
    exportSave();
    return;
  }
  if (el.hasAttribute('data-audio')) {
    const value = !state.options.sound;
    setAudio(value);
    send({ type: 'option', id: 'sound', value });
    return;
  }
  if (el.hasAttribute('data-motion')) {
    send({ type: 'option', id: 'motion', value: !state.options.motion });
    return;
  }
  if (el.hasAttribute('data-reset')) {
    state = null;
    tab = 'map';
    selected = null;
    target = null;
    closeModal();
    render();
    toast('Escolha a nova origem. A campanha anterior só será substituída ao entrar no Ossuário.');
    return;
  }
  if (el.hasAttribute('data-restore')) {
    const incoming = modal.data;
    state = incoming;
    tab = 'map';
    selected = null;
    target = null;
    closeModal();
    persist();
    render();
    toast('Campanha restaurada.');
    return;
  }
  if (el.hasAttribute('data-update')) {
    if (persist()) {
      waitingWorker?.postMessage('ACTIVATE_UPDATE');
      toast('Atualização preparada. Seu progresso foi salvo.');
    }
    return;
  }
});
document.addEventListener('change', async (event) => {
  if (event.target.id !== 'import-file') return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 2_000_000) {
    toast('Arquivo grande demais para uma campanha de Sino Negro.', true);
    return;
  }
  try {
    const incoming = decode(await file.text());
    openModal('confirmImport', incoming);
  } catch (error) {
    toast(error.message, true);
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal) {
    closeModal();
    return;
  }
  if (event.key === 'Tab' && modal) {
    const nodes = [...modalRoot.querySelectorAll('button:not(:disabled),input,a[href]')];
    if (!nodes.length) return;
    const first = nodes[0],
      last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
});
window.addEventListener('pagehide', persist);
window.addEventListener('storage', (event) => {
  if (event.key === SAVE_KEY && event.newValue) {
    try {
      state = decode(event.newValue);
      selected = null;
      target = null;
      tab = 'map';
      closeModal();
      render();
      toast('Progresso atualizado por outra aba. Esta tela foi sincronizada.');
    } catch {
      toast('Outra aba gravou um save inválido. Exporte a campanha desta aba.', true);
    }
  }
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then(async (registration) => {
      const ready = await navigator.serviceWorker.ready;
      offlineReady = !!ready.active;
      const announce = () => {
        waitingWorker = registration.waiting;
        if (waitingWorker) {
          toast('Uma atualização está pronta. Salve e aplique pelo menu.');
          render();
        }
      };
      announce();
      registration.addEventListener('updatefound', () =>
        registration.installing?.addEventListener('statechange', announce),
      );
      render();
      window.addEventListener('pageshow', () => registration.update().catch(() => {}));
    })
    .catch(() =>
      toast(
        'Modo offline indisponível. Use HTTPS ou localhost; sua campanha ainda pode ser salva.',
        true,
      ),
    );
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) {
      location.reload();
    }
    controlled = true;
  });
}
render();
if (loaded.error) toast(loaded.error, true);
registerGameTools(() => state, send);
