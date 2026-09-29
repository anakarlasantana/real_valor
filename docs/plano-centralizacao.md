# Plano de centralização — o contrato como dado no Postgres

> Plano de arquitetura do CMS, com o estado real de cada fase.
>
> **Por que este arquivo existe:** a versão anterior do plano vivia só no histórico
> de conversa do terminal. Em 2026-09-27 foi preciso vasculhar
> `~/.cline/data/sessions/` e `/tmp/compaction.txt` para descobrir o que era "F3".
> Plano que não está no repo é plano que se perde — e a pergunta "qual é o F3?"
> não pode depender de arqueologia.

## A premissa

**Um só serviço, um só banco.** O "espelho do contrato" não é problema de build: é um
**dado no lugar errado**. Ele está em código (e por isso duplicado por pacote) quando
deveria estar no banco, servido uma vez pela API. O repositório já é um monólito modular
com banco único — `content_section` é a única tabela de conteúdo e
`content_section_product` (o link da curadoria) a única de referência, `/store/content` e
`/admin/content` são as duas portas, e o painel é servido pelo próprio serviço. O que
está fora do lugar são três coisas: **contrato em código duplicado**, **tema em arquivos
JSON** em vez de dado, e **workspaces vestigiais** (cada app tem lockfile/contexto
próprios; a raiz não linka nada).

## Onde vive o dado

| Camada | Papel | Onde vive o dado |
|---|---|---|
| **Serviço (Medusa)** | API + CRM (`/painel`) + regras de negócio | **Postgres — única fonte** |
| **Cliente (Next)** | apresentação / SEO / checkout | nada de dado; só render + validação |
| **Contrato (conteúdo + tema)** | descreve seções, campos, opções, papéis de aparência | **registro no banco** (schema), com o arquivo atual virando *seed/bootstrap* |
| **Guarda** | só o que a linguagem não vê (CSS, binários, migração) | ~6 asserções, não 48 |

O ganho estrutural: **o CRM passa a ser schema-driven** — o formulário é desenhado a
partir do schema que a API devolve, e a loja renderiza com tipos **gerados**. Adicionar
um campo deixa de ser "editar 3 arquivos + rodar guarda" e passa a ser **1 registro de
schema + 1 renderizador** (ou nenhum, se a seção for composta por campos já suportados).

## Níveis (até onde ir)

- **N1 (o que existia):** contrato em TS; form do CRM acoplado; espelho digitado na loja; 48+ asserções.
- **N2 (o alvo):** schema como **registro no banco** (section types, fields, labels, groups,
  options, `iconKeys`, papéis de aparência). `GET /admin/content` devolve o schema; o CRM
  desenha tudo dele; `PATCH` valida contra ele; a loja recebe `schemaVersion` + dados e usa
  tipos gerados. → **zero dado de formulário em código**, muda sem deploy.
- **N3 (horizonte):** schema inferido de modelos/registry de seções com validação e render
  declarados. Mais elegante, bem mais caro.

**O tema segue o mesmo caminho:** `surface: 'theme'` como dado (bootstrap em
`themes/*.json`), e a loja resolve do payload com tag de cache em vez de
`fs.readdirSync(process.cwd()/themes)`. Isso mata de uma vez as asserções de
paleta/família, o `COPY` extra do `themes/` no Dockerfile e o motivo das 2 cópias de
`.woff2` (passa a ter uma origem só, com CORS).

## Fases e o que foi feito

| Fase | O que é | Status | Onde |
|---|---|---|---|
| **F0** — Rede e ruído | `make check` + hook de commit, docs enxutas (1 entrada + 4 assuntos), READMEs de template e pastas vazias fora | ✅ feito | `make check`, `docs/DEBITO-TECNICO.md` |
| **F1** — Fonte única do contrato | gerador emite tipos/defaults/tokens/mapas em cada app; artefato versionado com `--check` | ✅ feito | `scripts/gen-content.mjs`, `frontend/src/lib/content/contract.generated.ts`; guarda 1.042 → **69 asserts** |
| **F2** — Schema como dado | registro de schema no banco; `GET /admin/content` devolve; CRM desenha o form; `PATCH` valida contra o schema; loja ignora o que não conhece | ✅ **feito** | `content_contract` + `schema.ts` + `seed-schema`; a API lê e valida contra o registro; `schemaVersion` no payload; a loja descarta tipo desconhecido. 11 asserts na guarda |
| **F3** — Tema como dado | dono troca paleta/fontes/estação pelo CRM; `themes/*.json` vira seed; some o `fs` em request-time e o `COPY` do Dockerfile | ⏸️ etapa 1 pronta, **adiada** e congelada em `arquivo/` | branch `arquivo/f3-tema-como-dado-nao-mergear` (era `f3-tema-como-dado`), commit `fcdc3500ec`: superfície `theme` no contrato + API + CRM. **Não mergear:** o ponto de ramificação é `f4fe7c07` e o `develop` andou **32 commits** desde então; a simulação de merge (`git merge-tree`) conflita em **5 arquivos** — `admin/routes/content/{field-input.tsx,page.tsx}`, `api/admin/content/route.ts`, `modules/content/contract.ts` e `scripts/check-contract-parity.mjs` —, três deles justamente os que a R6/R6.5/R7 reescrevem. A etapa 2 é refeita sobre `develop` na R4. **Falta:** seed dos `theme.json` e a loja ler do payload |
| **F4** — CRM de vendas/entrega | agregações (vendas, status, ticket, rastreio) como módulo + rotas `/admin/*`, sobre o mesmo banco | ⏸️ não iniciado | `order-customer-indexer` + `/store/orders/track` são a base |
| **F5** — Higiene | Makefile interface única; `packages/` só se útil; CI rodando `make check`; `schemaVersion` | ⏸️ parcial | Makefile é a interface e `schemaVersion` saiu no F2′; **falta** a CI (vira G1) e o `packages/` (vira G5) |

**O que o F2 virou, em duas etapas.** A primeira entregou a **ponte** (o CRM lê o schema pela
API, sem espelho no painel). A segunda — o "F2′" — entregou o **registro**, que é o que
faz *mudar schema sem deploy*:

| Onde | O quê |
|---|---|
| `models/content-contract.ts` | Tabela `content_contract`: `key` (uma linha), `version`, `data` (era `content_schema` até 2026-09-29) |
| `migrations/Migration*.ts` | **Só DDL** — o dado é do seed, não do histórico |
| `schema.ts` | `buildSchema()` (montagem única), `SCHEMA_VERSION`, `SCHEMA_KEY` |
| `service.ts` | `getContract()` (registro, com fallback no contrato) e `saveContract()` |
| `scripts/seed-schema.ts` | Writer idempotente; `--check` sai ≠ 0 e diz o que diverge |
| `api/admin/content` | Serve o registro; `POST`/`PATCH` validam contra **ele** |
| `api/store/content` | `schemaVersion` no payload |
| `lib/data/content.ts` (loja) | Descarta tipo desconhecido antes do render |

**A prova de que a fonte é o banco** (feita ao vivo, com o `contract.ts` intacto):
removendo `headline` de `fields.hero` **no registro**, o `PATCH {"headline":…}` passou a
responder **400 "Campo desconhecido"**; acrescentando `seloNovo` **só no registro**, o
`PATCH` respondeu **200** e o CRM passou a listar o campo. E uma seção com
`type = loja-de-marca-nova` (tipo que a loja não conhece) deixou a home em **200**, com a
seção descartada — sem o filtro, o `assertNever` do render a transformaria em 500.

### O que o F2′ não faz (de propósito)

1. **A revalidação do storefront continua na tag `content`** (janela de 60 s), sem tag por
   versão: mudar a tag quebraria o `POST /api/revalidate?tag=content`, que é a interface
   documentada no `README`. Schema novo chega na loja pela janela — e o que precisa ser
   imediato (o CRM) já é, porque o CRM lê direto do banco.
2. **O registro não é editável pela UI**: mudar o schema ainda é `contract.ts` +
   `make seed-schema`. O objetivo de turno (um registro, uma fonte) está atingido; um
   *editor de schema* é produto, não arquitetura.
3. **`DEFAULT_HOME_SECTIONS` não entra no registro**: é conteúdo, não schema.
5. Guarda: a linha confere com o contrato (divergiu → "rode `make seed`"), `schemaVersion`
   nas duas pontas, schema vindo da tabela.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Schema no banco sem validação ⇒ `PATCH` grava qualquer coisa | validação server-side contra o schema + `schemaVersion`; migração idempotente dos dados históricos |
| Tipagem dinâmica (perde o `tsc`) | tipos **gerados** do schema + render tolerante: campo desconhecido é ignorado, nunca quebra a página |
| Cache/ISR não invalida mudança de schema | incluir o schema na tag `content` (hoje a revalidação é por conteúdo) |
| Unicidade de `position` e "todo tipo tem campos" (hoje garantidas pela guarda) | passam a ser **validação do serviço**, não do script |
| Assets em 2 origens (`.woff2` em `:9000` e `:8000`) | origem única + CORS, ou gerador + md5 (única asserção que sobrevive) |

## Próximo na fila: eliminar a guarda (G0 → G5)

> Este é o **próximo plano depois de F3/F4**, registrado aqui porque a pergunta
> "o que ainda falta" não pode depender de sessão de terminal.

### Por que

A tabela de riscos deste documento já dizia o alvo: *"Guarda — só o que a
linguagem não vê (CSS, binários, migração) — **~6 asserções, não 48**"*. Hoje
`scripts/check-contract-parity.mjs` tem **89** e **1.294 linhas**, e a
concentração é enviesada: **45 num único grupo** (`ADMIN (field-input.tsx)`).

Guarda de paridade por texto não é padrão de e-commerce/CRM — é o que se escreve
quando a fronteira entre dois pacotes **não é linkada pelo compilador**, e a
fronteira aqui não é linkada porque o install é por app (lockfile em cada um,
`node_modules` da raiz quase vazio) apesar de a raiz declarar `workspaces`.

O padrão do próprio stack: `@medusajs/types` é um **pacote publicado** que os
dois apps consomem; o Medusa não tem script de paridade, tem tipos, testes
(`integration-tests/http/*.spec.ts` — que este repo já tem) e build.

**Destino: `check-contract-parity.mjs` deletado.** O que ele faz vira tipagem,
teste ou checagem de dado — nenhuma das 89 some sem substituto, e nenhuma das
~6 que sobrevivem continua sendo assert de regex.

### O mapa (as 89, por grupo)

| Grupo (como está hoje) | Nº | Protege | Destino | Quem faz |
|---|---|---|---|---|
| Contrato gerado do storefront | 1 | artefato fresco | **build** | G5: com `packages/contrato` não há cópia — o storefront importa o tipo, e `gen-content.mjs` sai do mundo |
| `SECTION_TYPES ⇔ SECTION_FIELDS` | 2 | todo tipo tem campos; sem tipo fora | **tipagem** | `Record<SectionType, …>` já é exaustivo; a assert só existe porque a guarda lê a cópia por JSON |
| `DEFAULTS_HOME_SECTIONS` | 9 | seed cobre os tipos, posições únicas/ordenadas, obrigatórios preenchidos, cromo igual ao fallback | **teste** (1 spec) + **serviço** | `defaults.spec.ts`; `position` único vira validação do serviço (o que a tabela de riscos já previa) |
| `ADMIN` — espelhos | 5 | o painel não redeclara `ITEM_FIELDS`/`ICON_LABELS`/… | **tipagem** | G2: o painel é do **mesmo pacote** do contrato; `import type` some em build |
| `ADMIN` — ramo por `kind` | 5 | todo `kind` tem ramo no `FieldInput` | **tipagem** | G2: `Record<FieldKind, JSX>` + `satisfies` → apagar um ramo é erro de compilação |
| `ADMIN` — cobertura de `ITEM_FIELDS` | 15 | todo `list:*` tem editor e é alcançável | **teste** (1 spec) | percorre `ITEM_FIELDS` contra `SECTION_FIELDS` com os tipos reais |
| `ADMIN` — opções/ícones/labels ⇔ storefront | 12 | mesmas chaves, toda chave com ícone e com rótulo | **teste** (1 spec) ou **tipagem** com o pacote | `Record<IconKey, …>` torna o registro exaustivo |
| `ADMIN` — "o editor lê `itemFields`" | 2 | o painel não para de ler o schema | **teste de render** | jsdom + RTL (dep nova) — ou as duas saem e a cobertura fica assumida |
| `ADMIN` — campos de item = tipo do item | 6 | `ITEM_FIELDS[k]` = chaves de `BenefitItem`… | **teste** (1 spec) | contrato e item estão no mesmo arquivo |
| `APARÊNCIA` — invariantes do contrato | 8 | trilhos, ordem, opções, tradução | **teste** (1 spec) | dados de um array de contrato: teste é o lugar |
| `APARÊNCIA` — cobertura CSS | 3 | variável escrita × consumida; classe definida × usada | **checagem que fica** (teste com `fs`) | nada padrão cobre isso; e o alvo é gerar os tokens para não haver o que comparar |
| `PRÉVIA` — hex/família/pilha | 3 | a prévia bate com o tema | **teste** | após o F3, `theme.json` é seed e o hex vive no contrato |
| `PRÉVIA` — `@font-face` + **md5 dos `.woff2`** | 2 | a fonte existe e é a mesma | **checagem que fica** (teste com `fs`) | é binário; nenhuma ferramenta padrão faz isso |
| `PRÉVIA` — schema num lugar / rota lê e não monta | 3 | o schema não volta a ser montado na rota | **tipagem** (payload já é tipado) + **teste** (GET) | a assert de "montado num lugar" é redundante: `ContentSchemaPayload` já é o tipo |
| `SCHEMA COMO DADO` | 11 | migration só-DDL, histórico do rename, model, `getContract`/`saveContract`, versão, `--check`, flags, `schemaVersion` + filtro | **teste** (2 specs) + **CI** | `check-schema` na CI é a checagem de **dado** |
| (novo) `supportedSections` e `resolveTheme` | — | a loja descarta o que não conhece | **teste** (vitest) | dep nova no frontend, que hoje não tem runner |

**Contagem honesta:** as ~6 que ficam (CSS ×2, fontes ×2, migration ×1, e o
`--check` na CI) são as que nenhuma linguagem nem ferramenta padrão vê. As ~15
de `ADMIN` viram compilador. As ~30 de paridade entre pacotes só morrem na G5.
O meio vai para teste.

### Fases

| Fase | O quê | Risco |
|---|---|---|
| **G0** | este mapa, escrito | ~zero |
| **G1** | **CI** no GitHub Actions: `make check`, `make types`, testes, `check-schema` (Postgres de serviço), `next build` | baixo — e é o que torna todo o resto verificável |
| **G2** | **tipagem no painel**: importar os tipos do contrato, renderer exaustivo por `kind`, constantes importadas em vez de lidas por regex | baixo |
| **G3** | **testes assumem a guarda**: `defaults`, `appearance`, `itemFields`/ícones/labels, CSS e fontes com `fs`, `resolveSchema`/`getContract`, vitest no frontend | médio (deps novas) — ✅ **feito** (37 + 5 testes) |
| **G4** | **deletar a guarda**: `git rm scripts/check-contract-parity.mjs`; `make check` = `gen --check` + testes; o hook chama o novo `make check`. O mapa vai na mensagem do commit | médio — por isso a CI precisa estar verde antes |
| **G5** | **`packages/contrato`**: install unificado (lockfile único), pacote com `contract.ts` + `schema.ts`, os dois apps em `workspace:*`, `transpilePackages` no Next, Medusa com o pacote no build, os dois Dockerfiles ajustados. Sai `gen-content.mjs` e `contract.generated.ts` | **alto** — mexe no build dos dois lados |

**Requisito de G4:** CI verde antes. Sem CI rodando, apagar 89 verificações é
desligar o alarme antes de ligar outro.

### Onde parou (2026-09-27)

| Fase | Estado |
|---|---|
| **G0** mapa | ✅ `eeebebdbff` |
| **G1** CI | ✅ `400d137b52` (4 jobs; o job `schema` foi validado localmente contra um banco **vazio**: `db:migrate` → `seed-schema` ("Era inexistente") → `--check` ("em dia")) |
| **G2** tipagem no painel | ✅ `98ad1e0fcf` — guarda de **89 → 80**; a exaustividade por `kind` virou `tsc` (provado: injetar `\| "date"` dá `TS2322`); `medusa build` passa e o bundle do admin não leva dado do contrato |
| **G3** testes | ✅ `50f8cee573` (37 no backend) + `efaece4907` (5 no storefront, com `vitest`) |
| **G4** apagar a guarda | ⏸️ **adiada — e a ordem virou** |
| **G5** `packages/contrato` | ⏸️ não iniciado |

**Por que o G4 virou depois do G5 (invertendo o plano).** Aproximadamente 8 das 80
asserções restantes comparam o **artefato gerado** (a cópia) com o contrato: o
`nav`/`footer` do seed contra o fallback da loja, e afins. Elas não têm
substituto enquanto a cópia existir — e a cópia morre no G5, junto com a
comparação. Apagar a guarda antes deixaria um buraco **medível** (não
especulativo) de cobertura. Além disso a CI existe como arquivo, mas nunca
**rodou** no GitHub (a máquina não tem Docker e o push é outro ambiente): a
condição que o próprio G4 impunha — "CI verde antes" — ainda não foi cumprida
de fato.

Duas lacunas que ficaram declaradas, não escondidas:

- **Teste de render do painel** (precisaria de jsdom + testing-library): as duas
  asserções fracas que o cobriam ("o editor lê `itemFields`", "a listagem lê
  `typeLabels`") **permanecem** na guarda, porque apagar verificação sem
  substituto é perder cobertura em silêncio.
- **`vite` como devDep do storefront**: o `vitest` exige, e o projeto não tinha
  (o Next traz o dele, que não é o mesmo pacote). Instalar é o caminho padrão,
  mas é uma dependência a mais no build de imagem.

### Validação final exigida (o "100%")

**A — estático:** `make types` 0/0 · `make check` sem a guarda · suíte inteira
verde (backend jest, frontend vitest, painel jsdom) · `next build` ·
**`medusa build`** (que compila o admin Vite — é o que prova que o pacote
compartilhado entrou no bundle) · base limpa com `db:migrate` + `seed` +
`seed-schema --check`.

**B — aplicação no ar, com fluxo:** `make up` (Compose; o modo host foi removido); storefront e API de pé;
`/br`, produto, `/br/cart` e `/store/content` (com `schemaVersion`) 200; e o
**painel de ponta a ponta via API**: login → `GET /admin/content` com
`schemaSource: db` → `PATCH` → a vitrine mostra → `POST /api/revalidate?tag=content`
→ atualiza sem esperar a janela. Mais as provas do schema como dado (campo só
no registro é aceito; campo fora do registro é 400) e da tolerância (tipo
desconhecido → home 200, seção descartada).

**C — declarado fora do número:** `/br/categories` e `/br/search` continuam 404
(dívidas 2.1/4.2); **as imagens Docker não podem ser construídas nesta máquina**
(daemon down), e como G5 mexe nos Dockerfiles isso é pendência declarada, não
verde; não há E2E de browser.

**D — regra:** se algo de A ou B falhar, o trabalho para e é reportado — não é
"pronto" com pendência escondida.

## Sessão de higiene (2026-09-27)

Enquanto o schema/banco ficou adiado, "arrumou-se a casa":

| Item | O quê | Status |
|---|---|---|
| H1 | Etapa 1 do F3 (não commitada) guardada na branch hoje renomeada para `arquivo/f3-tema-como-dado-nao-mergear` (R0: nome que anuncia o congelamento); `develop` limpo | ✅ commit `fcdc3500ec` |
| H2 | Este arquivo de plano versionado | ✅ |
| H3 | `assets` morto dos `theme.json` (apontava para `.jpg` inexistentes) e do tipo `Theme` | ✅ commit `825080511a` |
| H4 | Dependência morta: **corrigido** — `ansi-colors` é usada por `frontend/check-env-variables.js`, que o `next.config.js` carrega (o build aborta se falta variável). No lugar, saiu o que era mesmo morto: `campaign-1/2/3.jpg`, sem nenhuma referência | ✅ commit `825080511a` |
| H5 | Baseline de `tsc` 20 → 0 no storefront (e o do backend junto), com alvo próprio `make types` | ✅ ver H5 abaixo |
| H6 | Bug de ambiente achado no smoke test: chave de API com **2 canais** de venda (página de produto 500) e `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` stale no `.env` | ✅ seed + linha no troubleshooting do `README` |
| H7 | `make seed` não era idempotente: morria em 6 lugares numa base já semeada (região, tax region, fulfillment set, vínculos, categorias, produtos) — e o README manda rodá-lo para imprimir a chave | ✅ seed idempotente, verificado rodando em cima da base já semeada |

## H5 — os 20 erros de `tsc` do storefront

**Fechado em 2026-09-27: os dois pacotes estão em zero erros de `tsc`**, e existe o alvo `make
types` — fora do `make check` de propósito (o hook de commit roda o `check`, e o `tsc` do
storefront leva dezenas de segundos). Nenhum erro foi silenciado com `@ts-ignore`: o que mudou
foi o tipo ou o default, nunca a checagem.

O que cada um era, e o que virou:

| Onde | Erros | Causa | O que foi feito |
|---|---|---|---|
| `line-item-unit-price` | 7 | `total`/`original_total` são `number \| undefined` nos tipos do Medusa | default `0` + guarda na divisão do percentual (com o `0`, o `-NaN%` aparecia na tela) |
| `line-item-price` | 5 | idem | default `0` (o resto do arquivo já lidava com `undefined`) |
| `products/[handle]/page.tsx` | 3 | `product.images` e `variant.images` anuláveis; o template exige lista | `?? []` e os `!` fora — a assinatura passa a declarar o retorno |
| `shipping/index.tsx` | 3 | a prop era `StoreCartShippingOption` (a base, **sem** `service_zone`) | a prop passou a ser `StoreCartShippingOptionWithServiceZone`, que é o que `listCartShippingMethods` devolve; `formatAddress` ganhou o tipo estrutural que os dois endereços compartilham |
| `country-select/index.tsx` | 1 | `iso_2`/`display_name` opcionais + `flat()` de listas possivelmente `undefined` | filtro `is CountryOption`: país sem os dois sai da lista (não tem o que mostrar nem para onde mandar) |
| `api/revalidate/route.ts` | 1 | `timingSafeEqual` é declarado com `ArrayBufferView` (lib dom) e `digest()` devolve `Buffer` (tipos do Node) | `new Uint8Array(...)` no meio — mesmos 32 bytes, comparação em tempo constante inalterada |
| `medusa-config.ts:28` (backend) | 1 | `path` do admin é `\`/${string}\`` e o valor vinha como `string` | cast no ponto: mesma string em runtime, com o tipo que o Medusa declara |

Conferir: `make types`.

## Plano de separação (R0 → R7): três pacotes, um por runtime

> Registrado em 2026-09-29, ao lado do G0→G5 e pelo mesmo motivo: o que não está no repo se
> perde. A fila **G** elimina a guarda; a fila **R** ataca a razão de ela ter crescido — a
> fronteira entre *manipular dado* e *apresentar dado* não está no layout do repositório.
> `backend/src/admin` é a extensão do Admin do Medusa: **React 18.3.1**, Vite, servida em
> `/painel` pelo próprio backend. É CRM, não back-end — e hoje mora debaixo de `backend/`.

### A regra

| Pacote | Runtime | Papel | Fonte de dado |
|---|---|---|---|
| `backend/` | Node/Medusa | módulos, schema no banco, `/admin/*` e `/store/*` | **Postgres — dono único** |
| `admin/` (novo) | Vite + React **18.3.1** + `@medusajs/ui` | CRM (`/painel`) | nenhuma: só chama a API |
| `frontend/` | Next 15 + React **19.0.5** | storefront (SSR/ISR, SEO, checkout) | nenhuma: render + validação |

React 18 × 19 é o que torna a fronteira **física**: o CRM não pode compartilhar `node_modules`
com o storefront (é por isso que o `packages/` do G5 não resolve o caso do CRM). A guarda passa
a ser `scripts/check-boundaries.mjs`, que falha quando `admin/` importar **valor** (≠ `import
type`) de `backend/`. O painel **não** importa valor nenhum desde a R6.5: eram três (`nextPosition`,
`positionFor` e `renumber`, em `page.tsx`), e os três saíram — a regra passou a viajar como dado (a
faixa no payload) e a gravação virou uma porta só (`POST /admin/content/order`). A verificação já
existe dentro do `check-contract-parity.mjs` (a R6.5 somou-a ali) e a R7 a herda na `check-boundaries.mjs`.

### Fechamento de toda fase R (R0 → R7)

Gate verde não fecha fase sozinho. Cada uma fecha com mais duas coisas:

| Item | O que significa |
|---|---|
| **Documentação ajustada** | o `README.md`, este plano e o comentário do próprio código passam a dizer o que **ficou** verdade — número, caminho, comando. Doc que descreve o estado anterior é dívida, não histórico: o histórico o Git guarda. |
| **Órfão apagado** | script sem chamador, cache de build antigo, manifesto sem dependência ou arquivo que a fase tornou inútil sai **na mesma fase**, e o que a documentação dizia dele é corrigido junto. Não há `arquivo/` de espera para isso: o Git já é o arquivo. |

> **Contagem da guarda — medida, não estimada:** `make check | grep -c '^  ok'`.
> Nasceu com 89; o G2 a levou a 80; hoje imprime **94**, porque cada fase que mexe no
> contrato pode somar verificação, e somar é mais barato que redesenhar (a R1 somou três: o
> que a vitrine de destaque lê ⇔ o formulário, o chip como referência e a tabela do link; a R6.5
> somou quatro: nenhum import de valor no painel, a faixa da ordem vinda das constantes do módulo,
> o numeral da tela usando essa faixa e a porta de ordem com um aviso só).
> O alvo do plano nunca foi o número: é ficar só com o que a linguagem não vê (binário, CSS,
> migração).

### A fila, na ordem fixada

| Fase | O que é | Gate |
|---|---|---|
| **R0** ✅ | o teste que existia passa a rodar: `make test`, job `testes` na CI, raiz sem `workspaces`, `f3` congelada em `arquivo/` | `make test` (9 suites / 91 testes + 3 arquivos / 20 testes), `make check` e `make types` verdes |
| **R0.1** ✅ | higiene da raiz: `package.json` (0 dependências, 6 scripts que só duplicavam o `Makefile` e que ninguém chamava), `node_modules` (1 GB, sem lockfile, invisível para o repo) e o `tsconfig.tsbuildinfo` defasado do storefront, apagados; contagem da guarda conferida na doc | `make check` e `make test` verdes com a raiz sem manifesto |
| **R1** ✅ | os chips do `featured` deixam de ser texto e viram **referência**: link novo `content_section_category`, `modules/content/filters.ts`, o `kind: "list:category"` no contrato, o seletor de categorias no CRM, o `/store/content` devolvendo `{ categoryId, label, handle }` lido ao vivo e a vitrine filtrando por `category_id`. "Todos" deixou de ser dado — não existe categoria "todas": quem o desenha é a loja | 4 linhas em `content_section_category` (posições 10–40) apontando para Vestidos, Blusas & Camisas, Calças & Alfaiataria e Conjuntos; `/store/content` com `schemaVersion: 5` e os chips com nome e `handle`; `/?peca=blusas-camisas` com a peça da categoria e `/?peca=conjuntos` com o estado vazio; `make check` 90 asserções, `make test` 10 suites / 121 testes, `make types` verde |
| **R6** ✅ | `api/admin/content/route.ts` quebrou em `modules/content/{validation,resolvers,view}.ts`, e o `nextPosition` duplicado saiu: a rota passou a usar o do `order.ts` (que tem o piso da faixa da vitrine e recebe só a vitrine) | rota **812 → 437 linhas**; `make check` 90 asserções e `make test` **11 suites / 147 testes** verdes (a rota em si não tinha teste — a validação e os resolvedores têm `validation.unit.spec.ts` agora) |
| **R6.5** ✅ | a ordem da vitrine sai do navegador: `POST /admin/content/order` com `{ ids }`, a renumeração no módulo (`order.ts`: `readOrderIds`, `orderErrors`, `applyOrder`) e a faixa da numeração viajando como **dado** no payload (`order`, para o numeral da lista enquanto a ordem está pendente). O painel deixa de importar valor de `backend/` (eram `nextPosition`, `positionFor` e `renumber`) | uma requisição e **um** aviso à loja com **7** seções mudando de posição (medido no log do frontend: `POST /api/revalidate?tag=content`); a mesma ordem de novo devolve `{"updated":[]}` e nenhum aviso; os 400 por lista incompleta, seção fixa, id inexistente, id repetido e forma inválida; `make check` **94** asserções, `make test` **11 suites / 157 testes** + 20 do vitest, `make types` verde (agora com o `tsc` do painel, que pegou um import morto) |
| **R7** | o CRM muda de casa: 12 arquivos / 2.282 linhas para `admin/`, com `medusa build` como gate | build do admin sem erro (não precisa de banco) |
| **R2** | tipagem onde hoje há paridade por texto (o destino do G2) | `tsc` limpo, sem `any` novo |
| **R3-lite → R5** | tema como dado e `themes/` fora do Dockerfile (o F3 refeito sobre `develop`) | `make gen` + `make check`; R4/R5 pedem o Docker de pé |

**Por que esta ordem:** R6.5 antes de R7 tira a última importação de valor do painel (a R7 deixa
de depender da R5); R6 antes de R6.5 porque a rota de ordenação nasce do que já foi extraído; R2
depois de R7 porque só então o CRM tem `tsconfig` e tipo próprios.

### R1 — o que a fase mediu

Quatro sondas, todas descartadas depois de responder (nenhuma virou script de produção), e o que
elas mudaram no código:

| Medição | Resultado, e o que ficou |
|---|---|
| Nome da entidade do link | `product_category_content_section` — o `defineLink` compõe o alias com os dois lados na ordem declarada (`product_category` + `content_section`); a **tabela** é `content_section_category`, porque foi declarada. Em runtime a leitura funcionou de primeira (`/store/content` devolveu os chips), e o par (arquivo, constante) virou teste e asserção da guarda |
| `remoteLink.delete` por seção | limpa **as duas** tabelas de link: `content_section_product` e `content_section_category` ficam com `deleted_at` preenchido (é soft, como todo link no Medusa) |
| `updateContentSections` com `data` | **mescla** o JSON, não substitui — a sonda gravou `{probe: true}` e o `data` ficou com a chave nova **mais** todas as antigas. Consequência para o repositório: chave que sai do contrato **não** desaparece da linha, fica órfã. Por isso a conversão da base antiga **neutraliza** (`filters: null`) em vez de tentar apagar, e a leitura descarta a chave (`withFilters`). As três afirmações de doc que diziam "o PATCH substitui o `data` inteiro" (README do módulo e os comentários da guarda) foram corrigidas nesta fase |
| O bug, em número | `q=Blazers` → **0 peças** (a categoria não existe); `category_id=<categoria>` → as peças da categoria. Era exatamente isso que o chip fazia — busca por texto —, e é o caminho que ele deixou de usar |

| Achado de **dado** (não da R1) | Detalhe |
|---|---|
| `vestido-midi-linho-floral` é invisível à Store API | `not_found` por id, ausente com `q`/`handle`, mesmo no canal da chave (`Loja Online Real Valor`), com preço em BRL e `status: published`; a página do produto na loja responde **500**. Por isso o chip "Vestidos" mostra o estado vazio. Fica para uma fase de dados (o seed), não para a R1 |

### R6.5 — o que a fase mediu

| Medição | Resultado, e o que ficou |
|---|---|
| Onde a numeração era calculada | No **navegador**: `page.tsx` importava `nextPosition`, `positionFor` e `renumber` do módulo do backend. Com a lista mexida na tela, o numeral do `Badge` saía de `positionFor(índice)` — a tela respondia "que número esta seção vai receber" e o servidor respondia a mesma pergunta na gravação. Duas respostas, uma delas dentro do browser |
| N requisições → 1 | Publicar a ordem era um `PATCH /admin/content` por seção que mudou de lugar, cada um gravando e **avisando a loja**. Medido no log do frontend (`POST /api/revalidate?tag=content`): com **7** seções mudando de posição, a ordem nova chega em **1** aviso; o mesmo POST de novo devolve `{"updated":[]}` e **nenhum** aviso (nada foi escrito) |
| A gravação em lote funciona | `updateContentSections([{ id, position }, …])` grava as N linhas numa chamada (é a forma que o `applyOrder` usa). Antes eram N transações e uma ordem pela metade quando uma falhava no meio — o aviso mandava "salvar de novo" para terminar o serviço. Medido: 7 posições (100…160) de uma vez, e a loja (`/store/content` e a home `/br`) na ordem nova |
| Idempotência | `renumber` devolve só o que muda de posição, então republicar a ordem atual não escreve nada. É o que permite a rota não avisar a loja à toa e o que torna um duplo clique inofensivo |
| Achado de **dado** (não da R6.5) | `hero` estava com `fixed = true` na base local, e a migration que criou a coluna marca só `announcement`, `nav` e `footer` — o contrato (`SINGLETON_SECTION_TYPES`) também. Consequência: o CRM mostrava o hero como **Fixo** (sem setas) e a porta da ordem recusaria qualquer lista que o trouxesse. A tela **não tem controle** para `fixed`, então o lojista não conserta pela UI. Alinhado via API (`PATCH {"fixed": false}`); fica aberto decidir se o corpo pode dizer `fixed` (hoje pode: decisão da fase do `fixed`) ou se a coluna volta a ser derivada do contrato na criação |


