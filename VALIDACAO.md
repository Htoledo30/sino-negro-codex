# Validação — 6 de outubro de 2026

## Ambiente

Windows, Node.js 24.15.0, Playwright 1.56.1. Chromium 141 e WebKit 26.0 fornecidos pelo Playwright. Testes com entrada de toque e viewport móvel. Não houve acesso a um iPhone físico.

## Regras e integridade

**42 testes de regras aprovados**, executados com `npm test`:

- Três origens, atributos, saves válidos e RNG reproduzível.
- Entradas inválidas sem gasto de turno, vigor, recursos ou RNG.
- Movimento evitando intenção fixa; aparo e Contra-ataque.
- Ruptura, quebra de armadura e interrupção.
- Sangramento resolvido antes de um golpe fatal.
- Óleo conectado + Brasa; empurrão no abismo e colisão em pilar.
- Alcance da lança e bloqueio de linha de visão da besta.
- Custos de magia e consequências da Corrupção.
- Compras, equipamento, melhorias, talentos e poderes de área.
- Ícor usado para talentos e tratamento; Confiança alterando preços.
- Todas as 36 alternativas dos 12 eventos executadas.
- Morte, preservação de progressão, cadáver, recuperação e depósito ao recuar.
- Última sentinela, fases dos quatro chefes, os dois finais e abertura da Vigília.
- Checksum, backup, rejeição de campos inválidos e falha explícita de armazenamento.

Correções encontradas pelos testes: referências circulares em cruzes de chefe; referências que deslocavam o centro de um ataque já anunciado; IA sem desvio de obstáculos; geração de inimigos isolados por abismos; prévias de dano que não consideravam quebra de armadura; rolagem horizontal no WebKit.

Na expansão, os testes também cobrem os 15 encontros, caminhos até todos os objetivos, reconhecimento, vitória por âncoras sem abates fictícios, resgate e morte do prisioneiro, provisões únicas, ondas e saída do cerco, suporte e cura inimigos, detonação e correntes, as seis runas, cada ordem de companhia, contratos novos e gravação por arma. Um save gerado pelo código da versão efetivamente publicada é a fixture de migração: intenções, RNG, rotas e AP permanecem idênticos e a próxima jogada funciona.

Correções da versão 2: aparo completo bloqueia os estados do golpe; inimigos sofrem dano ao permanecer no fogo e anunciam fuga quando possível; áreas de óleo sobrepostas não duplicam o impacto da mesma gravação; o modificador de cinzas afeta arenas autorais; batalhas longas não acumulam corpos sem limite; saves com intenções incompletas e identificadores herdados são rejeitados. O tabuleiro foi redimensionado e a explicação do objetivo tornou-se expansível para evitar a última fileira atrás da barra de ações.

## Campanhas completas no motor

`npm run test:balance` usa um planejador tático que só executa as ações públicas do jogo. Nenhuma vida, selo, recompensa ou nível é injetado. Cada distrito passa por encode/decode do save. Resultado após os ajustes:

| Origem   | Campanha               | Final            | Nível após Vigília | Turnos, incluindo Vigília | Vigília concluída |
| -------- | ---------------------- | ---------------- | -----------------: | ------------------------: | ----------------: |
| Guarda   | 4 distritos concluídos | Quebrar o sino   |                  9 |                       122 |                 1 |
| Carrasco | 4 distritos concluídos | Prender ao peito |                  9 |                        80 |                 1 |
| Herege   | 4 distritos concluídos | Quebrar o sino   |                  9 |                        88 |                 1 |

Esse teste comprova acesso ao conteúdo e viabilidade das origens. Um planejador conhece as regras; esses números não são estimativas de dificuldade ou duração para jogadores humanos. O cenário de morte e recuperação foi exercitado separadamente.

## Navegador e PWA

`npm run test:browser` aprovado em **Chromium e WebKit**, com:

- Criação por toque, compra de talento, bloqueio da Catedral e entrada em expedição.
- Seleção de habilidade, alvo inválido, confirmação válida e avanço de turno.
- Menus, áudio após interação, animações reduzidas e retorno ao tabuleiro.
- Exportação para arquivo e importação com confirmação.
- Atualização real do service worker: novo cache aguardou o botão de atualização; após salvar e ativar, o tabuleiro e as intenções permaneceram intactos em ambos os motores.
- Save e intenções preservados ao recarregar.
- Servidor local **desligado**: página recarregou do service worker com tabuleiro e save intactos em ambos os motores.
- Produção servida em `/sino-negro/`, verificando caminhos e escopo em subpasta.
- Viewports 320×568, 375×667, 390×844, 430×932 e 844×390, sem rolagem horizontal nos fluxos inspecionados.
- Capturas de introdução, refúgio e combate inspecionadas visualmente.

O Playwright/WebKit do Windows apresentou erro interno ao usar sua emulação `setOffline`. O teste foi corrigido para desligar o servidor de verdade, e o carregamento offline foi aprovado. Não foi necessário mascarar ou ignorar erro de jogo.

## Campanha completa pela interface

`npm run test:campaign-browser` concluiu uma campanha de Carrasco **no WebKit, usando somente os botões e alvos por toque**. O planejador consultou o save para escolher jogadas; cada mudança foi executada na interface. Seed determinística para reprodução.

Resultado da expansão: três selos, quatro chefes, final “Prender o sino ao próprio peito”, retorno ao Ossuário e primeira Vigília vencida. **79 turnos, cinco expedições, nível 9**, sem erro JavaScript. O final permaneceu após recarregar. Capturas da escolha final e do desfecho em `test-results/`.

`npm run test:expansion-browser` passou em **Chromium e WebKit**. Exercita migração por importação, criação de runa, escolha de Mara e sua ordem no Arsenal, reconhecimento e terceira ação, rompimento das duas âncoras, resgate, provisões, saída de cerco, bestiário e recarga. Esses cenários isolados importam fixtures válidas para alcançar condições específicas; a campanha acima continua sem injeção de vida, recursos ou selos. Capturas de cada objetivo e da forja foram inspecionadas.

## Arquivos e comandos

`npm run dev` e `npm run build` foram executados. `dist/` contém HTML, CSS, módulos, manifest, service worker, SVG e ícones PNG 180/192/512. Build não depende de credenciais ou backend. Cache de produção recebe uma versão derivada do conteúdo dos assets. Há workflow de GitHub Pages e instruções de publicação no README.

## Limites da evidência

- Não foi testada a instalação nem a abertura pelo ícone em um iPhone físico. WebKit desktop não equivale a Safari/iOS no aparelho.
- Notch, Dynamic Island e indicador inferior foram tratados no CSS, mas a inspeção dessas áreas no aparelho permanece pendente.
- A Vigília foi percorrida até o primeiro ciclo; todos os modificadores existem, mas dificuldades arbitrariamente altas não foram validadas.
- Integração WebMCP tem detecção de suporte e falha segura. Não havia contexto nativo WebMCP disponível para validar sua execução; isso não bloqueia gameplay.
- O endereço e o estado real da publicação são registrados separadamente em PUBLICACAO.md. Não se presume publicação por apenas gerar o build.
