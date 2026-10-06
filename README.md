# SINO NEGRO — Véspera

RPG tático de dark fantasy para jogar no iPhone como PWA. O sino de Véspera obriga os mortos a repetir o último desejo da cidade: sobreviver. Você atravessa as ruínas para conquistar três selos, abrir a Catedral e decidir o destino do sino.

**Versão 2.0 — A Congregação:** a campanha agora inclui 15 formações escritas, seis layouts táticos, objetivos alternativos, seis runas e três companheiros. Saves da versão 1 migram automaticamente, inclusive durante um combate.

Todo o gameplay e o salvamento funcionam no dispositivo. Não há backend, contas de jogo, compras, anúncios, chamadas de IA ou assets externos. A hospedagem privada pode exigir autenticação para o primeiro acesso; isso não faz parte do motor do jogo.

## Começar a jogar

O endereço efetivamente publicado e a situação da hospedagem ficam em **PUBLICACAO.md**. Para executar localmente, use Node.js 20 ou superior; o desenvolvimento foi validado com Node.js 24.15.0:

```powershell
cd 'C:\RPG IPHONE\chat got'
npm.cmd ci
npm.cmd run dev
```

Abra **http://localhost:4173/** no computador. O servidor fica ativo até `Ctrl+C`. Na mesma rede, o iPhone pode acessar o IP do computador na porta 4173 se o firewall permitir, mas esse acesso por HTTP é apenas uma prévia: service worker e offline exigem HTTPS ou localhost. Não abra `index.html` por `file://`.

O runtime não tem dependências. `@playwright/test` e Prettier são dependências de desenvolvimento, fixadas pelo lockfile. Para apenas executar ou gerar a produção, os scripts usam os módulos nativos do Node.

## Instalar no iPhone

1. Abra o endereço **HTTPS** no Safari.
2. Espere o indicador **OFFLINE PRONTO** no Ossuário.
3. Toque em **Compartilhar → Adicionar à Tela de Início**.
4. Mantenha **Abrir como App da Web** ativado, quando essa opção aparecer.
5. Abra **Sino Negro** pelo ícone criado.

O manifest usa `standalone` e há metadados e ícone apropriados ao iOS. O aplicativo instalado abre sem a barra do Safari; indicadores do próprio iOS seguem as regras do sistema. Não é necessário usar Fullscreen API. Essa configuração segue as orientações do [WebKit para aplicativos na tela inicial](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).

Retrato é recomendado. Paisagem também funciona com rolagem vertical. Todos os controles usam toque. As margens respeitam `safe-area-inset-*`. Áudio sintetizado é opcional e só é habilitado após interação. Regras e instalação podem ser consultadas durante a partida.

## O ciclo de jogo

**Preparar no Ossuário → escolher distrito → atravessar seis etapas de rotas alternativas → enfrentar o guardião → voltar com os espólios → evoluir e abrir novas possibilidades.**

As Valas, a Abadia e o Cárcere concedem um selo permanente cada. Com os três, a Catedral se abre. A campanha tem dois desfechos implementados. Após um desfecho, a **Vigília** permite continuar com modificadores de exploração, dano, armadura ou terreno e inimigos mais resistentes a cada ciclo.

Não há relógio real. Selecionar ações, abrir menus, consultar regras ou interromper o aplicativo não faz inimigos agirem.

## Controles e decisões táticas

- Cada turno começa com **duas ações**; reconhecer a etapa concede três ações no primeiro turno do combate escolhido. Escolha a habilidade, toque no alvo e **confirme**. Custos e prévia de dano aparecem antes da confirmação.
- **Vermelho** marca ataques anunciados e fixos. Mover-se, interromper ou aparar é a resposta. **Tracejado** marca destino de movimento inimigo.
- **Encerrar turno** executa inimigos e recupera 3 vigor. Aguardar sem gastar ações recupera mais 2.
- No celular, Mover, Atacar, Aparar, a habilidade de origem e Cura ficam na barra rápida. **Interagir** substitui a habilidade de origem enquanto há objetos ativos. **Arsenal** dá acesso a todas as habilidades e à ordem da companhia, com explicações.
- Toque em um inimigo para consultar vida, armadura, comportamento e intenção. Toque em terreno para consultar suas regras.
- Ruptura e colisões cancelam intenções. Aparar prepara um Contra-ataque. Sangramento resolve antes das intenções e ignora armadura. Óleo + Brasa cria fogo conectado; empurrar no abismo mata imediatamente. Ataques de área podem atingir outros inimigos.

## Builds, equipamento e mundo

Três origens têm vida, vigor, arma, habilidade e talento inicial próprios:

- **Guarda:** aparo, contra-ataque, interrupção e resistência.
- **Carrasco:** sangramento, avanço, execução e mobilidade.
- **Herege:** fogo, alcance e ritos que trocam vida por poder e Corrupção.

As árvores de Ferro, Sangue e Cinza podem ser misturadas. São **12 talentos**; alguns mudam regras e outros aprendem habilidades. Há **cinco armas**, três proteções e cinco relíquias equipáveis em um único espaço. Armas têm dano, alcance, custo e propriedades diferentes. Melhorias na forja aumentam dano; o contrato de caça abre a melhoria III.

Quatro distritos têm terreno e inimigos próprios. Sete tipos de oportunidade produzem decisões sobre risco: confronto, caçada, vestígio, relicário, abrigo, contrabandista e guardião. Há **12 eventos escritos com três alternativas cada**, cinco contratos persistentes e quatro chefes com fases e padrões próprios.

## A Congregação: novos caminhos no combate

**Reconhecimento:** antes de escolher uma rota, gaste uma luz para revelar as formações de toda a etapa. O combate escolhido começa com três ações. O bônus pertence à etapa; não pode ser acumulado nem levado de um abrigo à etapa seguinte. Na escuridão, encontros ainda recebem um inimigo extra.

**Objetivos:** os símbolos dourados no tabuleiro são alvos de Interagir, com alcance adjacente e custo de uma ação e um vigor. O painel explica a condição de vitória:

- **Ritual:** rompa duas âncoras para encerrar a batalha com inimigos vivos e receber bônus, ou elimine todos. Não recebe experiência de inimigos que não matou.
- **Resgate:** liberte o prisioneiro antes do último inimigo morrer. Ele tem 12 vida; áreas dos dois lados e fogo podem matá-lo. O resgate desbloqueia Ivo.
- **Provisões:** recolha um bálsamo e uma bomba antes de encerrar o confronto.
- **Cerco:** matar todos não encerra o encontro. Reforços chegam nos turnos 3 e 5. A partir do turno 6, use Interagir na saída, ou adjacente a ela, para escapar.

**Formações:** 15 encontros combinam seis layouts — ruína, corredor, pira, ponte, cripta e altar. Portadores de lápides protegem aliados adjacentes contra dano físico; costureiras anunciam curas; penitentes detonam e morrem; arrastadores tornam o próximo deslocamento mais caro. Separar inimigos, interromper suporte, provocar fogo amigo ou correr para o objetivo produzem resultados diferentes.

**Runas:** crie na forja com ossos, sucata e ícor. Cada arma guarda uma gravação; trocar uma runa conhecida entre confrontos é grátis. Fio de sangue aumenta Sangramento e custo de vigor; Sal de inverno reduz dano e cancela movimentos; Marca da pira incendeia uma cruz no golpe pesado; Boca de ferro troca dano por cura; Eco da sentinela reforça e interrompe no Contra-ataque; Nome queimado fortalece fogo e Dízimo, com mais Corrupção.

**Companhia:** escolha uma pessoa no Ossuário, após seu contrato. Mara cura e limpa Sangramento; Ivo puxa e quebra armadura; Sibila rompe ritos, curas e invocações. Há uma ordem por combate, no Arsenal. Não há unidade aliada extra ocupando uma casa. Companhia e gravações ficam no Equipamento; o bestiário descoberto fica na Crônica.

Os recursos se conectam:

- **Ossos:** equipamento, consumíveis, cirurgia e purificação.
- **Sucata:** melhorias, fabricação de bombas e alternativas em eventos.
- **Ícor:** chefes deixam ícor; 3 ícor + 30 ossos viram talento permanente, ou 2 ícor removem todas as marcas e recuperam vida.
- **Luz:** travessias a consomem; sem luz, confrontos comuns ganham reforços.
- **Corrupção:** ritos e certos inimigos aumentam a marca. A partir de seis, ela drena vida por turno; uma especialização eleva esse limite para nove.
- **Confiança:** ajudar sobreviventes reduz preços. Resgatar Mara também melhora a botica.

## Morte, retirada e salvamento

Retirar-se entre confrontos deposita todos os espólios. A morte preserva experiência, nível, talentos, equipamento, missões e selos, mas deixa os recursos não depositados em um cadáver. Uma cicatriz reduz vida máxima em 3, até cinco cicatrizes. Cirurgia, abrigos ou transfusão tratam as marcas.

Alcance a terceira etapa de uma nova expedição no mesmo distrito para recuperar o cadáver. Uma nova morte substitui o cadáver anterior. Descansar no Ossuário recupera vida e vigor e garante pelo menos dois bálsamos, gratuitamente: sempre há uma nova tentativa possível.

O jogo usa localStorage após **toda ação aceita**, não só ao fechar. Guarda um save principal e uma cópia anterior, valida estrutura e checksum e informa falhas de gravação. Estado de combate, seed, rotas, recursos e intenções permanecem após recarregar. Não há rerrolagem por reload.

O mesmo endereço aceita saves da versão 1, mantendo RNG, recursos, intenções, turnos e rotas em andamento. Os sistemas novos começam com valores neutros; Mara fica disponível se seu resgate já estava concluído. Abra o menu e use **Salvar e instalar atualização** quando uma versão nova estiver preparada. Não é necessário reiniciar a campanha.

Pelo menu, **exporte** um `.json` e **importe** em outro dispositivo ou endereço. O armazenamento pertence ao endereço e ao contexto do navegador; se Safari e aplicativo instalado usarem contextos diferentes, exportação/importação permite transferir. O sistema pode apagar dados locais: a cópia exportada é independente desse armazenamento.

## Gerar e servir produção

```powershell
npm.cmd run build
node scripts/serve.mjs --dir dist --port 4173
```

O conteúdo de **dist/** está pronto para qualquer hospedagem estática HTTPS. Não requer servidor Node na hospedagem. Um build calcula uma impressão digital dos assets e gera uma versão própria de cache. Quando houver nova versão, o jogador recebe uma opção para salvar e atualizar; uma partida não é recarregada sem essa escolha. O cache inclui todos os arquivos de runtime e ícones. A estratégia usa os mecanismos documentados em [Using Service Workers — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

Para reproduzir hospedagem em subpasta:

```powershell
node scripts/serve.mjs --dir dist --port 4173 --base /sino-negro/
```

Abra `http://localhost:4173/sino-negro/`. HTML, imports, assets, manifest, escopo e service worker usam caminhos relativos.

## Publicar no GitHub Pages

1. Crie um repositório GitHub com branch **main**.
2. Coloque **o conteúdo desta pasta** na raiz do repositório, incluindo `.github/workflows/pages.yml`, `src`, `assets`, scripts, `package.json` e `package-lock.json`. Não envie `node_modules`, `.browsers`, `test-results`, arquivos de save ou o `.git` local de outra hospedagem.
3. Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**.
4. Envie um commit para `main` ou execute **Actions → Publicar Sino Negro → Run workflow**.
5. O workflow executa `npm ci`, testes de regras e build; publica somente `dist/`. O endereço real aparece no ambiente `github-pages` após sucesso.
6. Abra esse endereço no Safari e siga a instalação descrita acima.

O workflow fornecido usa as ações oficiais para configurar, enviar artefato e publicar Pages. Consulte [a documentação de publicação com workflows do GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Alternativamente, gere `dist` e publique somente seus arquivos em qualquer serviço estático HTTPS. O servidor deve servir `.webmanifest` como JSON/manifest e `.js` como JavaScript. Evite cache permanente do próprio `sw.js` no servidor.

## Testes e reprodução

```powershell
npm.cmd ci
npm.cmd run browsers:install
npm.cmd test
npm.cmd run test:balance
npm.cmd run build
npm.cmd run test:browser
npm.cmd run test:campaign-browser
npm.cmd run test:expansion-browser
```

`browsers:install` guarda os runtimes Chromium/WebKit em `.browsers` dentro desta pasta. Os testes de navegador iniciam e encerram seus próprios servidores nas portas 4174 e 4175. Relatórios e capturas ficam em `test-results`. O registro de resultados e limites está em **VALIDACAO.md**.

`npm run icons` regenera os ícones PNG a partir do desenho original. `npm run format` formata os fontes. A integração WebMCP é opcional e detecta suporte; não é necessária para jogar no Safari.

## Organização

- `src/engine.js`: motor, regras, IA, transações e validação de saves.
- `src/content.js`: origens, talentos, armas, inimigos, distritos e eventos.
- `src/app.js`: interface por toque, menus, feedback e PWA.
- `src/storage.js`: saves, backup e integridade.
- `src/audio.js`, `icons.js`: áudio e símbolos originais sem downloads externos.
- `scripts/`: servidor estático, build, ícones e instalação dos runtimes de teste.
- `tests/`: regras, campanhas e fluxos por toque no navegador.
- `manifest.webmanifest`, `sw.js`, `assets/`: instalação e offline.
- `DESIGN.md`: visão e ciclo definidos antes da implementação.

## Limites conhecidos

Foi usado WebKit desktop automatizado no Windows, **não um iPhone físico**. Abertura pelo ícone, áreas seguras reais e comportamento exato da instalação no Safari precisam de uma verificação no aparelho. A simulação de viewport e o WebKit disponível são evidências de compatibilidade, não substituem esse teste.

A Vigília foi validada até o primeiro novo ciclo, não em todas as dificuldades possíveis. Os quatro distritos e eventos são conteúdo finito com rotas variáveis; a continuidade vem das builds e dos modificadores, não de história infinita. Arte é funcional e estilizada; o foco é gameplay. Saves não se sincronizam automaticamente entre aparelhos.
