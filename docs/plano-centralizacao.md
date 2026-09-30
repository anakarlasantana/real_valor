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
`themes/*.json`, **gerado** desde a R3-lite), e a loja resolve do payload com tag
de cache em vez de `fs.readdirSync(process.cwd()/themes)`. Isso mata de uma vez as
asserções de paleta/família, o `COPY` extra do `themes/` no Dockerfile e o motivo
das 2 cópias de `.woff2` (passa a ter uma origem só, com CORS). A R3-lite fez a
parte da árvore (contrato, tokens e seed gerados); o `COPY`, o `themes/` fora da
imagem e a loja lendo do payload são a R4/R5.

## Fases e o que foi feito

| Fase | O que é | Status | Onde |
|---|---|---|---|
| **F0** — Rede e ruído | `make check` + hook de commit, docs enxutas (1 entrada + 4 assuntos), READMEs de template e pastas vazias fora | ✅ feito | `make check`, `docs/DEBITO-TECNICO.md` |
| **F1** — Fonte única do contrato | gerador emite tipos/defaults/tokens/mapas em cada app; artefato versionado com `--check` | ✅ feito | `scripts/gen-content.mjs`, `frontend/src/lib/content/contract.generated.ts`; guarda 1.042 → **69 asserts** |
| **F2** — Schema como dado | registro de schema no banco; `GET /admin/content` devolve; CRM desenha o form; `PATCH` valida contra o schema; loja ignora o que não conhece | ✅ **feito** | `content_contract` + `schema.ts` + `seed-schema`; a API lê e valida contra o registro; `schemaVersion` no payload; a loja descarta tipo desconhecido. 11 asserts na guarda |
| **F3** — Tema como dado | dono troca paleta/fontes/estação pelo CRM; `themes/*.json` vira seed; some o `fs` em request-time e o `COPY` do Dockerfile | ⏸️ etapa 1 pronta, **adiada** e congelada em `arquivo/`; a **árvore** foi feita na R3-lite | branch `arquivo/f3-tema-como-dado-nao-mergear` (era `f3-tema-como-dado`), commit `fcdc3500ec`: superfície `theme` no contrato + API + CRM. **Não mergear:** o ponto de ramificação é `f4fe7c07` e o `develop` andou **32 commits** desde então; a simulação de merge (`git merge-tree`) conflita em **5 arquivos** — `admin/routes/content/{field-input.tsx,page.tsx}`, `api/admin/content/route.ts`, `modules/content/contract.ts` e `scripts/check-contract-parity.mjs` —, três deles justamente os que a R6/R6.5/R7 reescrevem. A etapa 2 é refeita sobre `develop` na R4. **Feito na R3-lite:** o contrato como origem da paleta/fontes, os `theme.json` e os tokens como artefatos gerados (o seed). **Feito na R4 e na R5** (`88aa6ef599` e `439a8a8d5c`): a superfície `theme` na API e no CRM, o seed dela no banco, a loja lendo o payload e o `themes/` fora da imagem. O que a fase mediu está em "R4 → R5 — o que a fase mediu" |
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
| `ADMIN` — espelhos | 5 | o painel não redeclara `ITEM_FIELDS`/`ICON_LABELS`/… | **tipagem** → na prática **fica asserção** (medido na R2) | G2: `import type` some em build. **R2:** o painel não é "o mesmo pacote" do contrato — é irmão, ligado pelo alias `@conteudo/*` — e o `tsc` **não vê cópia** de forma (`type FieldKind = { x: string }` num arquivo que não importa compila verde; medido). A asserção ficou, e a varredura foi alargada para o pacote inteiro |
| `ADMIN` — ramo por `kind` | 5 | todo `kind` tem ramo no `FieldInput` | **tipagem** | G2: `Record<FieldKind, JSX>` + `satisfies` → apagar um ramo é erro de compilação |
| `ADMIN` — cobertura de `ITEM_FIELDS` | 15 | todo `list:*` tem editor e é alcançável | **teste** (1 spec) | percorre `ITEM_FIELDS` contra `SECTION_FIELDS` com os tipos reais |
| `ADMIN` — opções/ícones/labels ⇔ storefront | 12 | mesmas chaves, toda chave com ícone e com rótulo | **teste** (1 spec) ou **tipagem** com o pacote | `Record<IconKey, …>` torna o registro exaustivo |
| `ADMIN` — "o editor lê `itemFields`" | 2 | o painel não para de ler o schema | **teste de render** | jsdom + RTL (dep nova) — ou as duas saem e a cobertura fica assumida |
| `ADMIN` — campos de item = tipo do item | 6 | `ITEM_FIELDS[k]` = chaves de `BenefitItem`… | **teste** (1 spec) | contrato e item estão no mesmo arquivo |
| `APARÊNCIA` — invariantes do contrato | 8 | trilhos, ordem, opções, tradução | **teste** (1 spec) | dados de um array de contrato: teste é o lugar |
| `APARÊNCIA` — cobertura CSS | 3 | variável escrita × consumida; classe definida × usada | **checagem que fica** (teste com `fs`) | nada padrão cobre isso. A **R3-lite** fez a metade que dava: os tokens da paleta passaram a ser **gerados** do contrato, e as três viraram "o `brand.css` não redeclara a paleta", "cada token sai no CSS gerado" e "o `theme.ts` não digita a lista" |
| `PRÉVIA` — hex/família/pilha | 3 | a prévia bate com o tema | **feito (R3-lite)** | as três **saíram**: com o `theme.json` gerado do contrato, compará-lo com a origem só podia dar verde. O que sobrou foi o que a geração não cobre — o `fallback` de fonte do `brand.css` (1 asserção) |
| `PRÉVIA` — `@font-face` + **md5 dos `.woff2`** | 2 | a fonte existe e é a mesma | **checagem que fica** (teste com `fs`) | é binário; nenhuma ferramenta padrão faz isso |
| `PRÉVIA` — schema num lugar / rota lê e não monta | 3 | o schema não volta a ser montado na rota | **tipagem** (payload já é tipado) + **teste** (GET) | a assert de "montado num lugar" é redundante: `ContentSchemaPayload` já é o tipo |
| `SCHEMA COMO DADO` | 11 | migration só-DDL, histórico do rename, model, `getContract`/`saveContract`, versão, `--check`, flags, `schemaVersion` + filtro | **teste** (2 specs) + **CI** | `check-schema` na CI é a checagem de **dado** |
| (novo) `supportedSections` e `resolveTheme` | — | a loja descarta o que não conhece | **teste** (vitest) | dep nova no frontend, que hoje não tem runner |

**Contagem honesta:** as ~6 que ficam (CSS ×2, fontes ×2, migration ×1, e o
`--check` na CI) são as que nenhuma linguagem nem ferramenta padrão vê. As ~15
de `ADMIN` viram compilador — menos a de **forma de tipo**, que a R2 mediu e manteve
como asserção (tipo estrutural não enxerga cópia). As ~30 de paridade entre pacotes só
morrem na G5. O meio vai para teste.

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
especulativo) de cobertura. Além disso a CI existe como arquivo e **roda**: a
medição de 2026-09-29 (API do GitHub, sem token) contava **15 execuções, nenhuma
verde** — 13 `failure` + 2 `cancelled` (as canceladas são substituídas pelo push
seguinte); falhava sempre nos mesmos dois jobs, `guarda de contrato` (passo `make
check`) e `tipos` (passo `make types`). O R7.1 mediu as duas causas num clone
limpo e consertou as duas na árvore: a `#17` (`dd009b9160`) é a **primeira
execução verde** do repositório — os cinco jobs passam, sem que uma linha do
workflow mude. A condição que o próprio G4 impunha ("CI verde antes") está
cumprida, e a fila segue do R3-lite.

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

## Plano de separação (R0 → R7.1): três pacotes, um por runtime

> Registrado em 2026-09-29, ao lado do G0→G5 e pelo mesmo motivo: o que não está no repo se
> perde. A fila **G** elimina a guarda; a fila **R** ataca a razão de ela ter crescido — a
> fronteira entre *manipular dado* e *apresentar dado* não está no layout do repositório.
> O CRM era `backend/src/admin`: a extensão do Admin do Medusa — **React 18.3.1**, Vite,
> servida em `/painel` pelo próprio backend —, ou seja, CRM e não back-end, morando debaixo
> de `backend/`. A **R7** tirou-o de lá: hoje é o pacote `admin/`. A **R7.1** tratou do que a
> mudança de casa deixou para trás: o bind do DEV preso ao diretório antigo e o fail-open que
> escondia isso.

### A regra

| Pacote | Runtime | Papel | Fonte de dado |
|---|---|---|---|
| `backend/` | Node/Medusa | módulos, schema no banco, `/admin/*` e `/store/*` | **Postgres — dono único** |
| `admin/` | compilado pelo Vite do **backend** (React **18.3.1** + `@medusajs/ui` vêm de `backend/node_modules`) | CRM (`/painel`) | nenhuma: só chama a API |
| `frontend/` | Next 15 + React **19.0.5** | storefront (SSR/ISR, SEO, checkout) | nenhuma: render + validação |

React 18 × 19 é o que torna a fronteira **física**: o CRM não pode compartilhar `node_modules`
com o storefront (é por isso que o `packages/` do G5 não resolve o caso do CRM). A guarda é
`scripts/check-boundaries.mjs`, que falha quando `admin/` importar **valor** (≠ `import type`)
de `backend/`. O painel **não** importa valor nenhum desde a R6.5: eram três (`nextPosition`,
`positionFor` e `renumber`, em `page.tsx`), e os três saíram — a regra passou a viajar como dado (a
faixa no payload) e a gravação virou uma porta só (`POST /admin/content/order`). A verificação
nasceu dentro do `check-contract-parity.mjs` (a R6.5 a somou ali) e a R7 a herdou na
`check-boundaries.mjs`, junto com o código que mudou de casa.

### Fechamento de toda fase R (R0 → R7.1)

Gate verde não fecha fase sozinho. Cada uma fecha com mais duas coisas:

| Item | O que significa |
|---|---|
| **Documentação ajustada** | o `README.md`, este plano e o comentário do próprio código passam a dizer o que **ficou** verdade — número, caminho, comando. Doc que descreve o estado anterior é dívida, não histórico: o histórico o Git guarda. |
| **Órfão apagado** | script sem chamador, cache de build antigo, manifesto sem dependência ou arquivo que a fase tornou inútil sai **na mesma fase**, e o que a documentação dizia dele é corrigido junto. Não há `arquivo/` de espera para isso: o Git já é o arquivo. |

> **Contagem da guarda — medida, não estimada:** `make check | grep -c '^  ok'`.
> Nasceu com 89; o G2 a levou a 80; hoje imprime **96**, porque cada fase que mexe no
> contrato pode somar verificação, e somar é mais barato que redesenhar (a R1 somou três: o
> que a vitrine de destaque lê ⇔ o formulário, o chip como referência e a tabela do link; a R6.5
> somou quatro: nenhum import de valor no painel, a faixa da ordem vinda das constantes do módulo,
> o numeral da tela usando essa faixa e a porta de ordem com um aviso só). A **R7** não somou
> nenhuma: ela mudou uma de casa — a fronteira do painel saiu do `check-contract-parity.mjs` para o
> `check-boundaries.mjs`, que é onde ela virou a razão de existir do arquivo —, e o total ficou 94.
> A **R7.1** também não somou asserção nenhuma, e de propósito: o que ela somou foi **ambiente** (um
> alvo do Makefile, o check 6 do `doctor` e uma guarda de **subida**, que não é verificação de
> contrato). O total medido segue **94**.
> A **R3-lite** foi a primeira fase a **tirar** asserção, e de propósito: três saíram
> (as de prévia — hex, família e pilha —, que a geração tornou tautológicas) e cinco
> entraram no lugar (o seed em disco é o conjunto de temas do contrato, cada token
> sai no CSS gerado, o `brand.css` não redeclara a paleta nem troca o fallback de
> fonte, e o `theme.ts` monta as variáveis das listas do contrato em vez de digitá-las).
> O total foi a **96**.
> A **R4 → R5** somou **doze**: sete da superfície de tema (oito entraram e uma
> saiu no lugar — o **payload do CRM comparado como dado**, no lugar de oito strings
> procuradas no arquivo: as superfícies se descrevem, a união delas é `CONTENT_TYPES`,
> a superfície de tema se declara e é a única que cria estações, a linha do seed é o
> tema campo a campo, o seed tem os ids e as posições do contrato, o CRM monta o
> seletor de superfície a partir do `schema` e a rota amarra a superfície ao tipo nas
> duas portas) e cinco da loja lendo o payload (o `fs` fora do caminho do request, a
> loja pedindo a superfície certa com a tag do conteúdo, o `default` ainda embutido
> como fallback, o layout esperando o tema do módulo de dados e o `COPY` do
> `themes/` que saiu do Dockerfile). O total medido é **108**.
> A **R2** somou **uma** verificação, mas não neste alvo: `scripts/check-panel-tests.mjs` (a suíte
> que está no disco do CRM é a que o runner dele executa) **precisa do jest instalado**, e o job
> `guard` da CI roda este alvo sem instalar nada — ela foi para o `make test`, que é onde a suíte
> roda. Hoje o total é **96**: 95 do contrato + 1 da fronteira.
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
| **R7** ✅ | o CRM muda de casa: sai de `backend/src/admin` para o pacote `admin/` — 17 arquivos (9 de código, 2.538 linhas), `tsconfig` próprio, nenhum `node_modules` próprio — servido em `/painel` pelo Vite do backend (`admin.sources` no `medusa-config.ts`). A imagem passa a compilar com o contexto na **raiz do repositório** e o CRM entra em `/app/admin` | `make build-admin` verde (backend + admin: 10,7s + 33,1s); `make check` **94** asserções; `make test` **11 suites / 157 testes** + 3 arquivos / 20 do vitest; `make types` verde nos três; `/painel` 200, a rota vindo de `/painel/@fs/app/admin/src/admin/routes/content/page.tsx` e `make logs-admin` OK. O caminho até aqui (incluindo o build que **falhou** com o CRM em `/admin`) está em "R7 — o que a fase mediu" |
| **R7.1** ✅ | o bind órfão do DEV e o fail-open que ele escondia: o container criado antes da mudança de casa ficou preso ao *inode* do `admin/` antigo, então `sources` virava `[]` e o admin subia **sem extensão nenhuma**, em silêncio. Ficam três coisas: `make recreate [SERVICE=]` (o comando que remonta o bind), o check 6 do `make doctor` (o CRM está visível dentro do container?) e a guarda que **falha alto** em DEV sem fonte e sem bundle | `make recreate SERVICE=backend` → a rota volta ao módulo virtual do painel (`import … from "/painel/@fs/app/admin/src/admin/routes/content/page.tsx"`, `path: "/content"`) e o arquivo sai de `text/html 752 bytes` (fallback) para `text/javascript 120407 bytes`; `make doctor` verde; a guarda medida nos três casos que importam (`development` + `/app/admin` vazio → `exit=1` com a mensagem; imagem de execução sem fonte **com** bundle → carrega; a mesma imagem **sem** bundle → lança). O detalhe está em "R7.1 — o que a fase mediu" |
| **R2** ✅ | o vínculo do painel com o módulo de conteúdo ganha **nome**: o alias `@conteudo/*` (`admin/tsconfig.json`) substitui os cinco níveis de `..` nos 5 especificadores de tipo, em 3 arquivos. A guarda de fronteira passa a **ler** os apelidos do tsconfig (antes `@conteudo/…` não tinha `/modules/` nem era relativo — passaria batido); o teste do formulário sai do jest do backend e ganha runner próprio (`admin/jest.config.js`), com `scripts/check-panel-tests.mjs` fechando a perda silenciosa; e as asserções de espelho do painel passam a varrer o pacote inteiro (eram 2 arquivos) | `make check` **94** asserções; `make test` **10 suites / 145 testes** no backend + **1 / 12** no CRM + 3 / 20 do vitest = **11 / 157**, o mesmo total da R7, mais a verificação de suíte (no `make test`, porque precisa de instalação); `make types` verde; o painel compilado na **imagem** (`Frontend build completed successfully`, 27,5s) e o import de valor pelo apelido **reprovado** pelo Rollup. O caminho (e o gate `build-admin` que a fase consertou) está em "R2 — o que a fase mediu" |
| **R3-lite** ✅ | tema como dado, **sem Docker**: a paleta e as fontes ficam no contrato (`THEME_COLOR_HEXES`; `THEME_FONTS` com `fallback` explícito e `stack` derivada), o conteúdo das estações vira `modules/content/themes.ts` (no molde de `defaults.ts`) e o gerador passa a escrever **três** coisas: o artefato do storefront, os 4 `themes/*/theme.json` (**o seed**, byte a byte iguais aos que existiam à mão) e os tokens `--rv-*` de `styles/tokens.generated.css`. Os três asserts de prévia morreram — não há o que comparar | `make gen` + `make check` (verde, **96** asserções), `make types` verde nos três, `make test` **11 suites / 154 testes** + 20 do vitest e `next build` verde com o `@import` novo. O que a fase mediu está em "R3-lite — o que a fase mediu" |
| **R4 → R5** ✅ | a outra metade do F3, **com o Docker de pé**: a superfície `theme` na API e no CRM, o seed dela no banco, o `themes/` fora do Dockerfile e a loja lendo o payload. O `fcdc3500ec` **não** foi mergeado (a simulação de merge conflitava em 5 arquivos): a etapa 2 foi **refeita** sobre o `develop`, com o que a R6/R6.5/R7 mudaram no caminho — o schema do CRM virou registro no banco, a validação lê `fields` do payload e a tela é dirigida pelo `schema` | `make check` **108** asserções, `make types` verde nos três, `make test` **163 + 12 + 29**, seed idempotente e conferido no banco (4 linhas em `surface='theme'`, schema **v6**) e a loja lendo do payload **nos dois estados**: em DEV, com o banco alterado (`colorRose` → `#123456`) o HTML traz `--rv-rose:#123456` enquanto o arquivo em disco continua `#B97872`, e com a janela da Black Friday alargada no banco, `data-theme="black-friday"`; em PROD (imagem `--target runner`, sem `/app/themes` e com `B97872` no bundle), o mesmo teste mostra `#654321` — valor que só existe no banco. As alterações foram desfeitas. O detalhe está em "R4 → R5 — o que a fase mediu" |

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

### R7 — o que a fase mediu

Cinco sondas, todas descartadas depois de responder. A fase começou por medir **onde** o CRM
poderia morar, e a medição derrubou a primeira resposta:

| Medição | Resultado, e o que ficou |
|---|---|
| Descoberta da fonte em **DEV**, com o CRM fora de `backend/` | Funciona. O `adminLoader` monta `sources` dos plugins locais (o projeto é o plugin `project-plugin`), mas a chave `sources` do config **sobrepõe** a lista — então `medusa-config.ts` declara a fonte. Medido no módulo virtual do plugin (`/painel/@id/__x00__virtual:medusa/routes`): `import RouteComponent0 … from "/painel/@fs/app/admin/src/admin/routes/content/page.tsx"` e `path: "/content"`; o arquivo responde **200 `text/javascript`** (com os `jsxDEV` do Vite), e não o `index.html` do fallback |
| O plugin só reconhece `/src/admin/` no caminho | `isFileInAdminSubdirectory` e `getRoute` casam o segmento `/src/admin/` (é a convenção do Medusa, igual à de um plugin instalado). Por isso o CRM ficou em `admin/src/admin/**`, e não em `admin/**` |
| **Build** com o CRM como irmão de `backend/` (em `/admin`) | **Falha** — e essa foi a medição que decidiu a fase: `Rollup failed to resolve import "@medusajs/admin-sdk" from "/admin/src/admin/routes/probe/page.tsx"`. A resolução de import do Vite/Rollup sobe a partir da **árvore do arquivo** e procura `node_modules`: em `/admin` não há nenhum acima (o do backend está em `/app/node_modules`, dentro da raiz). Em DEV isso não apareceria — o otimizador de dependências resolve pelo root —, o que é exatamente o tipo de divergência que só o build pega |
| Onde o CRM entra na imagem | Em **`/app/admin`** — dentro da raiz do container. Com isso o `node_modules` do backend está acima da fonte (build e dev iguais) e o `medusa build` fecha verde: *Backend build completed successfully (10.66s)* + *Frontend build completed successfully (33.11s)*, e a página do CRM no bundle. Custo: o contexto do build passou a ser a **raiz do repositório** (`context: .` + `COPY backend/ …` + `COPY admin/ /app/admin`), o `/.dockerignore` da raiz (que já existia, órfão de um contexto-raiz antigo) voltou a valer e o `backend/.dockerignore` morreu |
| `tsc` do CRM fora de `backend/` | O TypeScript sobe a partir do arquivo: sem ajuda, **4 erros** (TS2307/TS7026/TS2875 — `@medusajs/admin-sdk`, `@medusajs/ui`, `react/jsx-runtime`). Ficou com `paths`/`typeRoots` em `admin/tsconfig.json` apontando para `backend/node_modules` (quem compila o painel é o Vite de lá). `react`/`react-dom` precisam de linha própria no `paths` (os pacotes React não trazem tipos); sem `typeRoots`, **34 erros** de `describe/it/expect` no teste do formulário — os dois números medidos, não estimados |
| Heap do build | Dentro do **serviço dev** (limite de 2G no override, com o `medusa develop` já rodando) o build morre em `FATAL ERROR: Reached heap limit Allocation failed`. O gate virou `make build-admin`, que roda num container **avulso** (`compose run`, sem o dev server dividindo a memória) com `NODE_OPTIONS=--max-old-space-size=1536`. No estágio `builder` da imagem nada disso é preciso: `docker build` não passa pelos limites do Compose |

O que a fase **não** mudou de propósito: o CRM continua importando **tipo** do backend por
caminho relativo (`../../../../../backend/src/modules/content/…` — cinco níveis, agora), e o
teste do formulário continua rodando no `jest` do backend (o `roots` do
`backend/jest.config.js` aponta para `../admin/src`: o CRM ainda não tem runner próprio).
Os dois foram assunto da **R2** — a fase da tipagem própria, feita logo depois: os cinco
níveis viraram o alias `@conteudo/*` e o `roots` do backend saiu (ver "R2 — o que a fase
mediu", abaixo).

### R2 — o que a fase mediu

Sete medições, e três delas derrubaram o que a fase ia fazer:

| Medição | Resultado, e o que ficou |
|---|---|
| O apelido precisa existir também no Vite? | **Não.** O painel entra no build pelo `admin.sources` do backend, e o apelido só existe no `tsconfig.json` de quem importa: `import type` é apagado antes do bundle. Medido compilando o painel de verdade (ver a nota de ambiente abaixo): `Frontend build completed successfully (27,52s)`, `BUILD_EXIT=0`, e o CSS da prévia (`allura-latin`) no bundle |
| E um import de **valor** pelo apelido? | **O build reprova.** `x Build failed in 8.55s` + `error: Unable to compile frontend source` + `[vite]: Rollup failed to resolve import "@conteudo/contract" from "/app/admin/src/admin/routes/content/form-draft.ts"`. O apelido não é buraco no build: é caminho de **tipo** |
| O exit code do `yarn build` serve de gate? | **Não** — e isso valeu um conserto. O `$?` foi **0 nas duas medições** (com e sem o defeito acima); quem reprovou foi a linha de erro no log. O alvo `make build-admin` agora guarda o log e exige `Frontend build completed successfully`: se o Medusa mudar a mensagem, o alvo falha alto em vez de dar verde com o painel quebrado |
| A guarda de fronteira **via** o apelido? | **Não** — era o buraco que a R2 abriria. A regra antiga reconhecia caminho relativo e o segmento `/modules/`; `@conteudo/contract` não tem nenhum dos dois. `check-boundaries.mjs` passou a **ler** o `paths` do `admin/tsconfig.json` (`panelBackendAliases`) — renomear o apelido ou somar outro não abre buraco. Sonda: import de valor pelo apelido reprova (`exit=1`); limpo, verde |
| Onde o teste do painel roda? | Medido **antes** de decidir: o `vitest` existe só no `node_modules` do **frontend** (o painel passaria a depender do runner da loja — o mesmo cruzamento, só com outro vizinho) e o `admin/` não tem instalação própria (R7, medido no build). Ficou runner **próprio**: `admin/jest.config.js` com o `rootDir` e o `testMatch` do painel e **sem** o `setupFiles` do MikroORM (o teste do formulário é de função pura), chamado pelo `make test`; o `roots` do `backend/jest.config.js` saiu. O **binário** continua vindo do backend — o empréstimo que a G5 fecha, medido em vez de esquecido |
| A suíte do painel podia sumir sem aviso? | Em parte, **sim** — e é a razão da fase. O caso extremo o jest pega sozinho (sem nada casando com o `testMatch`: `No tests found`, exit 1, medido); a perda **parcial** (um ajuste que estreita o `testMatch`, um `.unit.spec` renomeado para `.spec`) passava verde. `scripts/check-panel-tests.mjs` compara o disco com o `--listTests` do runner do CRM (0,25s, sem banco) e roda no **`make test`**, logo depois do jest do CRM — não no `make check`: ele precisa de `node_modules`, e o job `guard` da CI roda o `check` sem instalar nada |
| O `tsc` substitui a asserção "o painel não declara a forma dos tipos"? | **Não**, e a medição mudou o plano da fase (que era converter a asserção em garantia do compilador). Três sondas: no **mesmo** arquivo que importa `FieldKind`, redeclarar a forma dá **TS2440** (o `tsc` pega — mas é o caso que o texto já pegava); num arquivo que não importa, `type FieldKind = { x: string }` compila **verde** (tipo estrutural não enxerga cópia); e essa cópia num **terceiro** arquivo do painel passava pelas **duas** asserções — a frase dizia "o painel" e o texto lia 2 arquivos. Ficou: a asserção mantida, a varredura alargada para o pacote inteiro (`panelSources`) e o porquê escrito nela |

E uma medição de **ambiente** (não do repositório) que a **R7.1** refez e corrigiu: naquela
sessão o container montava `./admin` em `/app/admin` mas **via o diretório vazio** — `ls -la
/app/admin` → `total 0`, um arquivo criado no `admin/` do host **não** aparecia, enquanto um
arquivo criado no `backend/src/` do host aparecia na hora (medido nos dois sentidos). A leitura
de então foi "propriedade do ambiente"; era **bind órfão**: o container fora criado pelo Compose
antes da mudança de casa e continuou preso ao *inode* do diretório antigo (a R7.1 mediu os dois
inodes, e o `recreate`). Ou seja, o `make build-admin` daqui não compilava um admin sem painel
porque "o Medusa não vê a fonte": não havia fonte **naquele caminho**. As duas linhas de build
que a doc passou a usar continuam certas — a **imagem** (`docker compose build backend`, cujo
contexto é enviado pela CLI, não pelo daemon, e `yarn build` dentro da imagem, sem bind nenhum)
é o caminho que não depende do bind do daemon. O resto da fase (`make check`, `make types`,
`make test`) não depende de container.
Para quem for conferir o `/painel` em DEV: **não use o código HTTP** — o mesmo container
responde `200` com o casco do SPA para qualquer caminho, inclusive um que não existe (medido:
752 bytes de `text/html` para o arquivo do painel, para o caminho antigo e para um caminho
inexistente). O teste é o conteúdo (`text/javascript` com os `jsxDEV` do Vite, como a R7
mediu) ou, antes de acusar o CRM, `make doctor` (check 6) e `docker compose exec backend ls
/app/admin`.

### R7.1 — o bind órfão e o fail-open (o que a fase mediu)

A fase nasceu de um sintoma de tela: o painel abria, os menus nativos apareciam e **"Conteúdo da
vitrine" não**. A causa não estava no CRM — e o caminho até ela é o que fica.

| Medição | Resultado, e o que ficou |
|---|---|
| O CRM está dentro do container? | **Não.** `docker compose exec backend ls /app/admin` → `total 0`, num host onde `admin/src/admin/routes/content/page.tsx` existe |
| Diretório **vazio** ou diretório **errado**? | **Errado.** Inodes: host `admin/` = `26083381` × container `/app/admin` = `26083369` — dois diretórios distintos; o controle `backend/src` = `28196276` **dos dois lados**. O container fora criado pelo Compose antes da R7 e o bind ficou preso ao inode antigo |
| `docker compose up -d` resolve? | **Não.** A configuração do serviço não mudou, então o Compose não recria nada — o bind continua o de antes |
| `restart` resolve? | **Sim**, e é o mecanismo do conserto: a **partida** do container remonta o bind. Medido com um arquivo novo trocando o inode no host — o container só o viu depois do `restart`. Ficou `make recreate [SERVICE=]` (`up -d --force-recreate`), que é a mesma partida, forçada |
| O que a tela recebia | O módulo virtual do painel era literalmente `export default { routes: [ ] }` — **0 rotas, 537 bytes**. O item da sidebar **é** o `handle` da rota (`label` + `translationNs` do `defineRouteConfig`): sem rota, sem item, sem erro |
| De onde vinha o silêncio | `medusa-config.ts` montava `sources` com `filter(existsSync)`: lista **vazia é válida** e o Medusa compila o admin do zero, sem extensão nenhuma. Nada no log |
| Depois do conserto | O módulo virtual volta a trazer `import RouteComponent0 … from "/painel/@fs/app/admin/src/admin/routes/content/page.tsx"` com `path: "/content"`, e o arquivo sai de `200 text/html 752 bytes` (o fallback do SPA) para `200 text/javascript 120407 bytes` |

**O que ficou** — três peças, na mesma fase:

1. **`make recreate [SERVICE=<nome>]`** — `docker compose up -d --force-recreate`, no `.PHONY` e na
   ajuda. `make -n recreate SERVICE=backend` → `docker compose up -d --force-recreate backend`.
2. **Check 6 do `make doctor`** — "CRM visivel dentro do backend (`/app/admin/src/admin`)": fora de
   produção passa se o diretório existe; se não, `bad` com o comando da correção. É o que os checks
   1–5 não perguntavam: eles olham banco e ambiente, não a **árvore de fontes**.
3. **A guarda que falha alto** (`backend/medusa-config.ts`) — sem fonte **e** sem painel compilado
   **e** fora de `production`, o config **lança** com os endereços testados e o comando da correção.
   Três casos medidos, um por linha da condição:

| Caso | Como foi medido | Resultado |
|---|---|---|
| DEV sem fonte | container descartável, `NODE_ENV=development`, diretório **vazio** montado em `/app/admin`, e o `medusa-config.ts` editado por cima | `exit=1` com a mensagem, carregada por `ts-node` (o mesmo carregador do `medusa develop`) |
| Runner sem fonte, **com** bundle | `docker run … real_valor_backend:local`: `NODE_ENV` **vazio** (a imagem não o fixa), `/app/admin` inexistente, `/app/public/admin/index.html` presente | **não lança** — é a válvula de escape do host que já tem o painel; o Compose de PROD ainda soma `NODE_ENV=production` |
| Runner sem fonte **e** sem bundle | o mesmo, com `/app/public` movido (como raiz) | **lança** a mesma mensagem — a guarda tem dentes no config **compilado**, não só sob `ts-node` |

| Achado de **artefato** | Detalhe |
|---|---|
| A imagem de produção também estava sem o CRM? | **Não** — a leitura que a R7 deixou no plano estava errada. A imagem `:local` de antes (`a58a8d213e84`) tem o rótulo `Conteúdo da vitrine` no `assets/index-Jd2yMxWa.js`: o defeito era do bind do **DEV**, não do artefato. Ela foi reconstruída mesmo assim, por estar defasada em relação à R7 (`086cdbc3557e`, rótulo em `assets/index-FbnzdS_y.js`) |

**Decisão de fila: a R3 quebra em duas.** A R3 era uma fase só ("tema como dado e `themes/` fora do
Dockerfile", o F3 refeito sobre `develop`). Ela vira **duas**, pelo mesmo critério que separou esta
fase: **o que roda na árvore de trabalho**. `R3-lite` é o contrato e os tokens gerados, com
`themes/*.json` como seed, verificável por `make gen` + `make check`, sem imagem nenhuma; o que
**pede o Docker de pé** (o `COPY` do Dockerfile, o `themes/` fora da imagem, a loja lendo do
payload) fica em R4/R5.

O que **não** estava decidido — e ficou escrito para não se perder — era **o que vem antes**: o
R3-lite ou a **CI**. Ficou **a CI primeiro**, e a razão é o tamanho da dívida depois de medida: ela
eram dois arquivos (o `icons.ts` lido como texto, um `import` de tipo), não uma investigação. Estado
da CI na última medição **antes** dos consertos (API do GitHub, sem token):

| O que | Medido |
|---|---|
| Execuções | **15, nenhuma verde**: 13 `failure` + 2 `cancelled` (as canceladas — `#12` e `#14` — ficam ~20s para trás quando o push seguinte as substitui) |
| Última do conserto (`#15`, `e9a1a93e8f`) | `guarda de contrato` falha no passo `make check`; `tipos` falha no passo `make types`. `registro do schema`, `testes` e `build do storefront` **passam** — os mesmos resultados de antes do conserto: a guarda nova não tirou nenhum job do ar, e a válvula de escape vale na CI também (o job `registro do schema` carrega a config e tem a fonte, então ela não dispara lá) |
| Causa de `guarda de contrato` — **medida** | num clone limpo (`git worktree add --detach`: sem `node_modules` e sem `.medusa`, que é exatamente o que o job é — `checkout` + `setup-node` + `make check`), o `make check` morre com `ERR_MODULE_NOT_FOUND` ao carregar `frontend/src/lib/content/icons.ts` pelo `loadExport` (`check-contract-parity.mjs`). O arquivo importa **valor** de `@medusajs/icons` — é ele quem desenha o ícone —, e o comentário do `loadExport` o listava como "tipos e dados puros": a premissa falsa era a causa, não o job |
| Causa de `tipos` — **medida** | no mesmo clone, `make types` reprova no **primeiro** dos três `tsc` (o do backend), com `TS2307` em `backend/src/scripts/seed.ts`: ele importava `../../.medusa/types/query-entry-points`, diretório **gerado pelo `medusa build`** e gitignorado, logo ausente em qualquer clone. `make -k types` mostra os outros dois `tsc` (painel e storefront) **passando**: um erro só explicava o job inteiro. O log do job continua exigindo token — não foi preciso ler |
| Conserto da guarda | `icons.ts` passou a ser lido como **texto**, a mesma regra que o registro social (`social-icons.tsx`) já seguia: `AVAILABLE_ICON_KEYS` sai das chaves do mapa `ICONS` (que é, por definição, `Object.keys(ICONS)`) e as duas listas saem do `readStringList`. **Sem asserção nova: 94**, como antes. Medido no clone limpo: verde (94 `ok`). E continua mordendo — três testes negativos, feitos no clone: chave tirada da lista → `FAIL` "oferece as mesmas chaves"; chave oferecida sem entrada no mapa → `FAIL` "sem ícone: bolt"; mapa renomeado → `FAIL` com **todas** as chaves "sem ícone", ou seja, não há leitura que passe calada |
| Conserto dos tipos | o tipo da chave de API passou a ser **local e mínimo** — `type PublishableApiKey = { id: string; token: string }`, só o que o seed lê —, e o `import` do arquivo gerado saiu. A primeira tentativa foi o `ApiKeyDTO` do framework, e ela **verde num estado só**: resolve o clone, mas no host, onde o `.medusa/types` existe e a augmentação tipa o `graph`, `data?.[0]` vira o `ApiKey` do gráfico e a atribuição reprova (`last_used_at` é `Maybe<string \| Date>` lá e `Date \| null` no DTO — `TS2322` medido). O tipo local passa nos **dois**: `make types` com o diretório gerado **presente** e **ausente** → `exit=0` nos dois, os três `tsc` |

| Primeira execução **depois** dos consertos (`#17`, `dd009b9160`) | **verde** — os cinco jobs: `guarda de contrato` (passo `make check`), `tipos` (`make types`), `testes`, `registro do schema` e `build do storefront`. Nenhuma linha de `.github/workflows/check.yml` mudou: o conserto foi todo na **árvore**, e é isso que faz o verde valer |
| As duas seguintes (`#18`, `dd8c72bbe2` e `#19`, `ecb4346650`) | **verdes** também. A `#18` é só documento (o registro desta medição); a `#19` é a **árvore final**, com o tipo local do seed — o conserto que passa com o `.medusa/types` presente **e** ausente |

As duas rotas cabiam na regra que o G4 já impunha ("CI verde antes de apagar a guarda") — a diferença
era **quando a dívida vence**: antes de seguir a fila (CI primeiro) ou antes do G4 (R3-lite primeiro,
com a CI como dívida declarada). Medida, a dívida venceu primeiro — e venceu barato: dois arquivos, e
a `#17` fecha verde. O G4 está destravado (a condição que ele mesmo impunha está cumprida) e o
R3-lite é o próximo da fila.

**O que os dois defeitos têm em comum** — e fica como regra para o que vem: os dois **passavam no
host e quebravam no clone**. O host tem `node_modules` (instalado) e `.medusa/types` (gerado pelo
`medusa build` da imagem); um clone limpo não tem nenhum dos dois. A CI foi só quem contou: quem
clonasse o repositório e rodasse `make check` ou `make types` antes de subir a stack batia nos dois.
É a mesma pergunta que a guarda do DEV fez (R7.1, acima) — o que o **ambiente** tem que a **árvore**
não declara. E o conserto herda a mesma regra: **medir nos dois estados**. O primeiro tipo escolhido
para o seed (`ApiKeyDTO`) fechou a CI e deixou `make types` vermelho no host — um estado consertado, o
outro quebrado. O que passa nos dois é o que declara só o que o código lê.

### R3-lite — o que a fase mediu (tema como dado, sem Docker)

A fase é a metade da R3 que roda **na árvore de trabalho**: nenhuma imagem foi
construída e nenhum container subiu. O gate é `make gen` + `make check`, como a
própria fila dizia — e o resto (`make types`, `make test`, `next build`) foi
rodado por ser o que o repo exige de toda fase, não por ser o gate dela.

| Pergunta | Medido |
|---|---|
| Onde estava a paleta, antes? | Em **quatro** lugares, e três eram cópia: `THEME_COLOR_HEXES` (contrato), `themes/default/theme.json` (loja), as seis declarações `--rv-*` do `brand.css` e os seis pares digitados em `themeToCSSVariables`. Três asserções da guarda e três testes do jest existiam só para vigiar as cópias — e a única forma de elas falharem era alguém editar dois arquivos à mão, do mesmo jeito |
| O que passou a ser a origem? | O contrato. `THEME_COLOR_HEXES` deixou de ser "cópia de leitura" e é a **paleta**; `THEME_FONTS` passou a declarar `family`, `fallback` e a `stack` **derivada** de `themeFont()` (a pilha era escrita à mão em três lugares). O conteúdo das estações — rótulo, janela `MM-DD` e o que cada uma troca — foi para `modules/content/themes.ts`, no molde do `defaults.ts`: era o último dado da loja que só existia como JSON, sem tipo nenhum |
| O que é gerado agora? | Três coisas pelo mesmo `gen-content.mjs`: o artefato do storefront (como antes), os **4 `themes/*/theme.json`** e `frontend/src/styles/tokens.generated.css`. O `--check` cobre os seis arquivos de uma vez e **nomeia** o que estiver velho (antes ele conhecia um só) |
| O seed mudou de conteúdo? | **Não** — e isso foi medido antes de aceitar a troca: os quatro `theme.json` saem **byte a byte** iguais aos que estavam versionados (`git diff --stat -- frontend/themes/` vazio depois do `make gen`). A fase trocou a **origem** do dado, não o dado. As estações não trocam fonte nenhuma (`fonts: {}` nos três), então a herança do padrão continua sendo o único caminho exercitado |
| E o CSS? | O `brand.css` perdeu as seis declarações da paleta e ganhou o comentário do porquê; o `globals.css` importa `styles/tokens.generated.css` **antes** dele. O `next build` local (o mesmo `next build` do job `build do storefront`, sem infra) passou com o `@import` novo, e o css compilado traz `--rv-rose:#B97872` e `--rv-font-display:var(--font-playfair),Georgia,serif` |
| Por que a tipografia **não** é gerada? | Porque o valor dela não é dado de tema: é `var(--font-*)`, que o `localFont` do Next publica (a família real é hasheada pelo Next), e isso é ligação do storefront. O que é dado de tema é o **fallback** — e esse o contrato declara, com uma asserção conferindo que o `brand.css` não o trocou |
| A loja mudou de comportamento? | Não, e a diferença é medível: as listas de papéis vêm do artefato (`THEME_COLOR_TOKENS`/`FONT_ROLES`) e a pilha é a família **da estação** + o `fallback` do contrato — os mesmos valores que os seis pares e os três templates produziam. O que muda é que um token novo no contrato passa a chegar à loja sem editar o `theme.ts`, e uma estação que troque de família deixa de cair na fonte antiga |
| Quantas asserções ficaram? | **96** (eram 94). Saíram três — hex, família e pilha — e entraram cinco: o seed em disco é exatamente o conjunto de temas do contrato (um diretório órfão é um tema que só a loja conhece), cada token do contrato sai no CSS gerado, o `brand.css` não redeclara a paleta, o `fallback` de fonte dele é o do contrato, e o `theme.ts` monta as variáveis das listas do contrato em vez de digitá-las |
| E os três testes do jest? | Saíram pelo mesmo motivo (comparavam o artefato com a origem dele): `make test` **11 suites / 154 testes** + 3 arquivos / 20 do vitest, medido. O spec de `assets` continua com o que a geração não cobre — o **binário** (md5 dos `.woff2` da prévia) e o CSS digitado à mão |
| O que **não** entrou, e por quê? | A superfície `theme` na API/CRM (o `THEME_FIELDS`/`CONTENT_SURFACES` do `fcdc3500ec`) e o seed dela no banco: sem Postgres não há como semear nem verificar uma linha de tema, e uma superfície sem consumidor seria dado órfão no contrato. É a R4 — e ela começa com o seed **já pronto** e gerado, que é o que esta fase entrega a mais |
| Onde ficou a regra desta fase? | No mesmo lugar das outras: o que **é gerado** não se confere por comparação — se confere pelo `--check` do gerador, que é o único que enxerga a origem e o artefato juntos. Comparar um artefato com a origem dele é asserção que não pode falhar, e foi por isso que as três saíram em vez de serem reescritas |

### R4 → R5 — o que a fase mediu (o tema como dado, com o Docker de pé)

Duas metades na mesma sessão: **R4** põe o tema no banco (contrato, API, CRM e seed) e
**R5** tira a loja do disco (payload no lugar do `fs`, e o `themes/` fora da imagem).
A ordem não é arbitrária: enquanto a loja não lesse o payload, semear o banco não
mudaria nada na tela — e é isso que a medição da R5 prova.

Os commits são `88aa6ef599` (R4, 17 arquivos) e `439a8a8d5c` (R5, 12 arquivos).

| Pergunta | Medido |
|---|---|
| O `fcdc3500ec` foi mergeado? | **Não**, e a decisão da R0 (congelar em `arquivo/`) se pagou: o `develop` andou mais de 30 commits e a simulação de merge (`git merge-tree`) conflitava em **5 arquivos**, três deles justamente os que a R6/R6.5/R7 reescreveram. A etapa 2 foi **refeita** sobre o `develop` — e ficou melhor do que era, porque aproveitou o que mudou no caminho: o schema do CRM agora é **registro no banco** (a validação lê `fields` do payload, não `SECTION_FIELDS`) e a tela é dirigida pelo `schema` (o seletor de superfície e o diálogo de criação saem de `CONTENT_SURFACES`) |
| Onde o tema passou a morar? | Numa linha de `content_section` com `surface = 'theme'` e `type = 'theme'`: mesma tabela, mesmas colunas, mesmo `data` JSON. **Sem migração** — a coluna `surface` já existia. O seed são 4 linhas (o `default` e as 3 estações), com a paleta **achatada** um campo por cor (`colorRose`), porque é assim que o payload de conteúdo já era |
| Como quem grava e quem lê concordam? | Por `themeColorField`/`themeFontField`, no **bloco compartilhado** do contrato: o CRM grava por ali (`THEME_FIELDS`) e a loja lê por ali (`frontend/src/lib/theme.ts`) — pacotes diferentes, que só se encontram no artefato gerado |
| Como o seed e o `theme.json` não divergem? | Pela mesma razão que as estações deixaram de ser digitadas: `themes.ts` faz a **fusão uma vez** (`THEME_FILES`) e dela saem os dois artefatos — o gerador escreve os `theme.json` e o seed grava as linhas (`THEME_SECTIONS`). A guarda compara os dois lados (ids, campos e valores) e o jest confere o **achatamento** campo a campo, com as mesmas funções que o seed usa |
| O que foi preciso mudar no carregador dos scripts? | Nada menos que **poder importar valor**. `themes.ts` importava o contrato só como tipo porque o `loadExport` roda em ESM puro, onde `./contract` sem extensão não resolve — medido: `ERR_MODULE_NOT_FOUND`. O sintoma era do **Node**, não do contrato: ele apaga os tipos nativamente desde o 22 e só faltava a resolução do especificador. O carregador virou módulo compartilhado (`scripts/lib/load-export.mjs`) com um hook de resolução de 10 linhas, e ganhou `callExport` — o que permitiu trocar **oito strings procuradas no arquivo** por uma comparação do **payload montado** (`buildSchema()`) com as constantes do contrato |
| E o "Restaurar padrão" na aba do tema? | Teria criado `nav`, `hero` e o rodapé **dentro** de `surface = 'theme'` se a lista padrão continuasse única: `defaultsFor(surface)` escolhe as estações, e o teste monta o cenário — é o defeito que o teste pega, não o "funciona" |
| A loja mudou de fonte da verdade? | Sim, e é medível **nos dois sentidos**, com o arquivo em disco de testemunha: (1) alterando **só o banco** (`colorRose` → `#123456`), o HTML passou a trazer `--rv-rose:#123456` enquanto o `themes/default/theme.json` continuava `#B97872`; (2) alargando **só no banco** a janela da Black Friday para incluir hoje, o HTML passou a servir `data-theme="black-friday"` com o `--rv-cacao` dela, com o arquivo ainda em `11-20`. As duas alterações foram desfeitas e o HTML voltou ao `default` |
| O que **saiu** da imagem? | O `COPY ... /app/themes` do Dockerfile (a promessa do F3). O `theme.json` do `default` **continua** entrando no bundle — o `src/lib/theme.ts` o **importa** como fallback embutido —, e por isso a pasta segue no **contexto** do build e montada no DEV (o `next dev` resolve o import a cada compilação). O que saiu foi a leitura de disco em **request-time**: o `fs` do `theme.ts` e o `try`/`catch` que engolia a falha em silêncio (era ele que fazia a loja cair no tema padrão sem avisar quando a cópia faltava) |
| Quantas asserções ficaram? | **108** (eram 96): doze a mais — sete da superfície de tema (oito entraram, uma saiu) e cinco da loja lendo o payload. O ganho maior não é a contagem: é a **natureza** de uma delas, que deixou de ser texto procurado no arquivo para ser o payload comparado como dado |
| E os testes? | `make test` **163** no backend (eram 142) + **12** no CRM + **29** no vitest (eram 20). O `themes.unit.spec.ts` é novo (a fusão, o achatamento e a cobertura de `THEME_FIELDS`), `restore.unit.spec.ts` ganhou o `defaultsFor` e a superfície de tema pela mesma máquina, `validation.unit.spec.ts` ganhou o `resolveSurface` e o `pattern`, e o storefront ganhou `theme.spec.ts` (o payload vira `Theme`, campo ausente herda o padrão, e a janela que vira o ano) |
| O que ficou de fora, e por quê? | Nada do F3. A fase **não** mexeu na tipografia (o valor dela é `var(--font-*)` do `next/font`, ligação do storefront, não dado de tema) e **não** precisou de migração. Também não criou tela nova: a aba do tema é a mesma do conteúdo, com o seletor vindo do contrato |
| Onde ficou a regra desta fase? | A mesma das outras, com uma diferença de forma: aqui o gerador e o seed passaram a **compartilhar a função** que produz o dado (`THEME_FILES` → `theme.json` e `THEME_SECTIONS`), e a guarda só confere o que **atravessa pacotes** — o payload da API contra o contrato, e o seed contra os arquivos. Regra pura (cobertura dos campos, achatamento, `defaultsFor`, `resolveSurface`) virou teste no runner, onde o erro aponta o dado que quebrou em vez de um `detail` em string |




