// Integração opcional. Safari continua funcionando sem esta API proposta.
export function registerGameTools(read, perform) {
  const registry = document.modelContext;
  if (!registry?.registerTool) return;
  const lifecycle = new AbortController();
  const state = () => {
    const s = read();
    if (!s) return { started: false };
    return {
      started: true,
      screen: s.screen,
      hero: { name: s.hero.name, hp: s.hero.hp, vigor: s.hero.vigor, level: s.hero.level },
      expedition: s.expedition
        ? { district: s.expedition.district, depth: s.expedition.depth, light: s.expedition.light }
        : null,
      combat: s.combat
        ? {
            turn: s.combat.turn,
            ap: s.combat.ap,
            player: s.combat.player,
            objective: s.combat.objective,
            companion: s.hero.companion,
            companionUsed: s.combat.companionUsed,
            enemies: s.combat.enemies
              .filter((e) => e.hp > 0)
              .map((e) => ({
                id: e.id,
                kind: e.kind,
                x: e.x,
                y: e.y,
                hp: e.hp,
                armor: e.armor,
                intent: e.intent,
              })),
            terrain: s.combat.terrain,
          }
        : null,
    };
  };
  const tools = [
    {
      name: 'read_sino_negro_state',
      title: 'Consultar partida de Sino Negro',
      description: 'Lê a situação atual e as intenções de combate. Não gasta ações ou recursos.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => state(),
    },
    {
      name: 'perform_sino_negro_combat_action',
      title: 'Executar ação tática',
      description:
        'Executa uma habilidade confirmada ou encerra o turno, usando as mesmas regras da interface. Gasta ações e recursos conforme a habilidade; só funciona durante combate.',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['skill', 'endTurn'] },
          id: { type: 'string' },
          x: { type: 'integer', minimum: 0, maximum: 5 },
          y: { type: 'integer', minimum: 0, maximum: 5 },
        },
        required: ['type'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || !['skill', 'endTurn'].includes(input.type) || read()?.screen !== 'combat')
          throw new Error('Ação tática inválida ou fora de combate.');
        if (input.type === 'skill' && typeof input.id !== 'string')
          throw new Error('Escolha uma habilidade.');
        const target = input.x === undefined ? undefined : { x: input.x, y: input.y };
        if (
          target &&
          (!Number.isInteger(target.x) ||
            !Number.isInteger(target.y) ||
            target.x < 0 ||
            target.y < 0 ||
            target.x > 5 ||
            target.y > 5)
        )
          throw new Error('Coordenada inválida.');
        if (!perform({ type: input.type, id: input.id, target }))
          throw new Error('Ação rejeitada pelas regras do jogo.');
        return state();
      },
    },
  ];
  for (const tool of tools)
    try {
      Promise.resolve(registry.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
    } catch {}
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
