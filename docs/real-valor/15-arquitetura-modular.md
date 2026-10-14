# 15 — Arquitetura Modular

As camadas do storefront, as regras que as guardam, a política de comentário e o
processo das fases F0–F10 (a modularização do repositório).

**Este doc é o dono da NARRATIVA.** Quando um arquivo nasce com um cabeçalho de
trinta linhas contando a história do defeito que ele evita, a história é movida
para cá e o arquivo fica com cinco linhas e um ponteiro. Foi o que a F0 fez com o
`check-boundaries.mjs` (142 → 23 linhas de comentário, e o arquivo saiu do baseline)
e com a política da [seção 15.4](#154-a-política-de-comentário).

---

## 15.1 As camadas

**A direção é uma só: `app → modules → lib → contrato`.** Quem está mais perto da
página conhece quem está mais longe dela; o contrário nunca.

| Camada | Papel | Pode importar | Medido (13/10/2026) |
| :--- | :--- | :--- | ---: |
| `app/` | rota, layout, `page.tsx`, `metadata`: composição e fronteira HTTP | `modules`, `lib`, contrato | 38 arquivos · 2.067 linhas |
| `modules/` | UI e comportamento de um domínio (`store`, `products`, `checkout`, `account`, `home`, `content`, `skeletons`, `common`) | `lib`, contrato | 164 arquivos · 16.397 linhas |
| `lib/` | dado, regra e integração, sem React de tela (`catalog`, `ui`, `content`, `checkout`, `medusa`, `data`, `payments`, `theme`, `config`, `hooks`, `context`) | contrato | 97 arquivos · 12.583 linhas |
| `src/__checks__/` | guarda de arquitetura: lê o FONTE do que confere, não renderiza (`media-wiring`, `ruler`) | `lib`, `modules` | 2 arquivos · 650 linhas |
| `packages/contrato` | tipo e schema compartilhados pelos três runtimes (`@rv/contrato`) | — é folha | 3.817 linhas |
| `styles/` | CSS: o manifesto `brand.css` e os dezoito parciais de `brand/` (a F6 partiu a régua) | — | 19 arquivos · 5.265 linhas |

A F2 dissolveu o `lib/util` (45 arquivos, 6.622 linhas) por dono, e é isso que `lib/`
é hoje: **`catalog`** (a regra e a leitura da peça e do catálogo: facetas, chips,
abas, estado, ficha, avaliação, preço), **`ui`** (apresentação sem React: dinheiro,
mídia, movimento, carrossel, o `repeat` dos esqueletos), **`content`** (a regra de
uma seção do conteúdo: capa, lançamentos, ticker, faixa do Instagram), **`checkout`**
(CEP, opções de entrega e comparação de endereço), **`payments`** (o registry, os
adapters e o texto do parcelamento) e **`medusa`** (a integração: env, erro e
cabeçalho de locale) — mais `data`, `theme.ts`, `config.ts`, `hooks` e `context`, que
já existiam.

Três consequências que a F0 tornou verificáveis:

1. **`lib` não conhece `modules`.** O tipo também caminha junto com o dono: se o
   dado precisa de `SortOptions`, o tipo mora em `lib/`, não no componente que o
   usa. É a inversão que mais apareceu na varredura (5 casos, R-A) — a F1 fez o
   `SortOptions` caminhar para `lib/catalog/types.ts` e dos 5 sobraram 3, todos no
   RV-048.
2. **`modules` e `lib` não conhecem `app`.** A rota compõe; a peça não sabe em que
   rota ela foi montada. Zero violações hoje (R-B) — a regra existe para o
   primeiro caso, não para o passado.
3. **`lib/data` é o fundo da pilha.** Fora dele, ninguém em `lib` importa
   `lib/data`; é a regra que impede o ciclo `dado ↔ utilidade` (1 caso vivo, R-C).

## 15.2 As regras, a guarda e as exceções vivas

Todas rodam no `make check` (Node puro, segundos, sem `node_modules`) — e por
isso estão no hook de commit (`.githooks/pre-commit`) e no job `guard` da CI.

| Regra | O que proíbe | Guarda | Exceções vivas | Morrem em |
| :--- | :--- | :--- | ---: | :--- |
| **R-A** | `lib` importa `modules` | `check-boundaries.mjs` | 3 | RV-048 (a F1 tirou os 2 do `SortOptions`) |
| **R-B** | `lib`/`modules` importam `app` | `check-boundaries.mjs` | 0 | — (nasce verde) |
| **R-C** | `lib` (fora de `lib/data`) importa `lib/data` | `check-boundaries.mjs` | 1 | RV-048 |
| **R-D** | `modules/checkout` importa `@lib/payments/*` (subcaminho, em vez da fachada) | `check-boundaries.mjs` | 0 | — (a F2 zerou) |
| **R-E** | ciclo de import de VALOR no storefront | `check-boundaries.mjs` | 3 | RV-048 (a F5 desmanchou os três do locale e do `account`) |
| painel × backend | `admin/` importa VALOR do backend (só `import type`) | `check-boundaries.mjs` (R7) | 0 | — |
| checkout × adapter | `modules/checkout` importa adapter ou SDK de pagamento | `check-boundaries.mjs` (RV-014) | 0 | — |
| convenção de teste | spec fora de `__tests__/<alvo>.unit.spec.ts` ou `src/__checks__/` | `check-storefront-tests.mjs` | 0 | — (a F3 zerou) |
| comentário | cabeçalho > 5 linhas, densidade > 12% (arquivo fora do baseline) | `check-comments.mjs` | 334 arquivos | ✅ F10 — cortou os 28 piores (3.509 linhas de comentário a menos); o resto é dívida declarada |

**O baseline é a lista das exceções vivas, não uma licença.**
(`scripts/baselines/boundaries.json`, `comments.json`, `storefront-tests.json`.)
As três guardas têm a mesma regra de ouro: **a lista só encolhe**. Cada entrada
carrega `why` (o motivo) e `diesIn` (o marco que a apaga); quando a violação deixa
de existir — porque a fase a corrigiu —, a guarda **reprova** pedindo a remoção.
Uma entrada morta é tratada como defeito, não como sobra.

**O que a guarda de camada NÃO vê** — e por que isso não é um buraco: a regra julga o
import cujo alvo **resolve**. Um caminho inexistente (`@pages/inexistente`) não vira
violação de camada, porque ele quebra antes: o `tsc` (`make types`) e o `yarn build`
reprovam o import. A guarda de camada não é linter de import quebrado; é a guarda da
direção, e a direção só existe entre arquivos que existem.

**O baseline é também o canário do detector**: se o `resolveSpecifier` deixar de
resolver (um apelido renomeado no `tsconfig`, por exemplo), as 7 exceções viram
entradas mortas de uma vez e a guarda reprova — uma guarda que para de ver não passa
em silêncio. É o que o RV-049 transforma em teste próprio.

## 15.3 Por que cada guarda existe (o caso medido)

- **painel × backend (R7)**: importar valor do backend **compila**. A numeração da
  ordem da vitrine (`positionFor`/`renumber`/`nextPosition`, removidos na R6.5) era
  calculada no navegador e gravada em N `PATCH`es: uma segunda resposta para "que
  número esta seção recebe", que volta em silêncio. O que a tela precisa chega pelo
  payload (`order` em `GET /admin/content`, publicação em `POST /admin/content/order`).
  A R2 não mudou a regra, mudou a FORMA do caminho: o apelido `@conteudo/*` é lido do
  `tsconfig.json` do painel (`panelBackendAliases`), para que renomear o apelido não
  abra buraco — nem somar um segundo que aponte para o backend.
- **checkout × adapter (RV-001/RV-014)**: sem guarda, o primeiro adapter escrito "só
  para não perder tempo" importa direto do componente e no quarto provedor o `switch`
  volta — exatamente o que o RV-001 desfez. A UI de um meio fica **dentro** do adapter
  dele (`lib/payments/adapters/stripe/{card-container,payment-button}`); é por isso que
  esses dois arquivos aparecem em R-A/R-C — eles eram UI de provedor usada no checkout.
  O RV-048 apaga o diretório inteiro e as exceções com ele.
- **R-A/R-C (camadas)**: o dado importando o tipo do componente é a inversão que
  parece inofensiva (é só um `type`) e amarra o `lib/` ao `modules/` para sempre.
  Foi o caso do `SortOptions`, que a F1 fez o tipo caminhar para
  `lib/catalog/types.ts`; os 3 que restam em R-A são o adapter do Stripe, que sai
  no RV-048 inteiro. R-C guarda o fundo da pilha: `lib/medusa/get-locale-header.ts`
  importando `lib/data` é o meio do ciclo que R-E acusa (e o F5 desmancha).
- **R-D (a fachada)**: medido em 13/10/2026 — `lib/payments/index.ts` tinha **zero**
  importadores, e o checkout chegava ao `registry` por subcaminho em 4 arquivos
  (`payment`, `payment-button`, `payment-container`, `payment-wrapper`). Pior: o
  `needsInlineInput` existia no contrato **e** reimplementado no checkout
  (`modules/checkout/components/payment/index.tsx`). **A F2 tornou a fachada
  verdade**: os quatro importam `@lib/payments`, a cópia local do
  `needsInlineInput` saiu, e a fachada passou a responder também o `paymentLabel`
  (que o resumo do pedido buscava no subcaminho).
- **R-E (ciclos)**: os ciclos de valor medidos na varredura estão no baseline com o marco
  que os apaga. O `config → get-locale-header → locale-actions → config` foi o que
  obrigou a F5 a existir: o SDK injeta o cabeçalho de locale e o dado do locale usa o
  SDK. **A F5 o desmanchou** fazendo o locale virar FOLHA (`lib/medusa/locale-cookie.ts`,
  que só importa `next/headers`): o SDK e o dado passaram a ler o cookie dela, e o meio
  do ciclo deixou de ser o dado. O mesmo valeu para o `account`: a `enum LOGIN_VIEW` era
  exportada pelo template que importa o formulário que a importa — e um `enum` é VALOR,
  não tipo —, então ela foi para `modules/account/lib/login-view.ts`.
- **convenção de teste**: o CRM já perdeu suíte por `testMatch` estreito (o spec
  continuou no disco, o `make test` continuou verde e passou a rodar menos — ver
  `check-panel-tests.mjs`). No storefront o glob padrão do vitest é largo, mas o lugar
  do spec é livre: um arquivo colado em qualquer lugar roda, e ninguém sabe onde
  procurá-lo. **A F3 unificou** os 32 em `__tests__/<alvo>.unit.spec.ts` — colado no
  alvo, um nível abaixo dele — e reservou `src/__checks__/` para as duas guardas de
  arquitetura (`media-wiring`, `ruler`), que leem o FONTE de outros arquivos por
  caminho e por isso tiveram os seus `join(__dirname, …)` reancorados ao mudar de casa.
  O baseline da convenção ficou **vazio**: não é mais uma lista de exceções, é o
  registro de que não há nenhuma.
## 15.4 A política de comentário

O problema medido na varredura de 13/10/2026: **19.512 linhas de comentário** nas cinco
árvores de fonte — `packages/contrato/src` em **54,6%**, `backend/src` em 32,0%,
`scripts/` 30,4%, `admin/src` 28,6%, `frontend/src` 26,0%. Os cortes da própria F0
(as três guardas novas e o `check-boundaries.mjs`) baixaram o total para 19.375 e os
`scripts/` para 19,9%; a **F1**, apagando sete arquivos mortos, baixou para **19.334** e
o baseline de 313 para **312** arquivos, e a **F2**, dissolvendo o `lib/util` e
reancorando a catraca com as peças em casa nova, para **19.325** e **311**; a **F4**
(os tipos com dono) e a **F5** (os dois ciclos), para **19.305** e **309** arquivos —
cada `--write` é parte do commit que mudou a forma. A **F6** não mexeu no total: partiu a
régua em dezoito parciais sem escrever uma linha de comentário, e o baseline foi a **326**
arquivos (as dezoito de `brand/` entram, a entrada do `brand.css` sai). A **F7** moveu o CRM sem
tocar em comentário nenhum (27 arquivos, baseline nos mesmos 326), e a **F8** partiu os três alvos do
backend com o baseline em **334** arquivos — treze novos, dos quais oito precisam de exceção (a
narrativa **movida** não cabe em 12%: é o mesmo mecanismo da F6) —, com `backend/src` de
**5.115 → 5.106** linhas de comentário. O total **desceu** porque a prosa que a fase escreveu para se
explicar teve de ser cortada até caber: no primeiro `make check` da F8 o total estava **+118**
(5.233), e a fase cortou **127 linhas** de narrativa nova — cabeçalho e doc de módulo dizendo o que o
README e este doc já dizem. Os piores arquivos isolados:

| Arquivo | Comentário | Linhas | Densidade |
| :--- | ---: | ---: | ---: |
| `frontend/src/styles/brand/04-trilho.css` | 207 | 408 | 51% |
| `packages/contrato/src/contract.ts` | 1.340 | 2.633 | 51% |
| `packages/contrato/src/schema.ts` | 371 | 452 | 82% |
| `admin/src/admin/routes/content/components/field-input.tsx` | 327 | 1.119 | 29% |
| `backend/src/modules/payment/mercadopago/credenciais.ts` | 248 | 416 | 60% |
| `packages/contrato/src/defaults.ts` | 257 | 562 | 46% |

**O que fica:**

- *por que* — a razão de o código ser assim e não do outro jeito (a armadilha que ele
  evita, o número medido que o justifica);
- *armadilha de plataforma* — o que a ferramenta faz de inesperado (o `oxc` do vite 8
  ignorando `esbuild`; o `@medusajs/framework` silenciando requisição com `@fs`);
- *decisão com dono* — `// TODO(dono): … (RV-0NN)`, com o dono e o item do doc 09.
  Sem dono não é comentário: é desejo;
- *ponteiro* — uma linha apontando o doc que tem a narrativa.

**O que sai:**

- *o que o código faz* — o nome da função e o tipo já dizem; o comentário repete;
- *histórico do refactor* — "antes era assim, mudou na R6" mora no doc 09, na entrada
  da fase, com o hash; o arquivo guarda só o efeito;
- *narrativa longa* — o cabeçalho de 30 linhas vira 5 + ponteiro (é este doc);
- *código comentado* — o git tem o histórico; o comentário só envelhece.

**Números e catraca** (`scripts/check-comments.mjs`):

| Regra | Valor |
| :--- | :--- |
| Cabeçalho (o primeiro bloco de comentário, antes da primeira linha de código) | ≤ 5 linhas |
| Densidade de um arquivo que **não** está no baseline | ≤ 12% das linhas, com piso de 6 |
| Baseline (`scripts/baselines/comments.json`) | 334 arquivos + o total por árvore (reancorado na F10) |
| Folga tolerada de uma entrada | < 10% (e < 3 linhas): acima disso a entrada é frouxa |

A catraca só desce: um arquivo que já está no baseline não pode ganhar comentário, um
total de árvore não pode subir, e uma entrada frouxa ou órfã **reprova**. `--report`
lista os piores (é o insumo da F10) e `--write` reancora o baseline — o `--write` é
parte do commit que mudou a forma dos arquivos de propósito (a F6, que partiu a régua; a
F5, que desmanchou o ciclo), e o diff do baseline aparece na revisão.

**A F10 cortou** os vinte e oito piores que o `--report` listou — **3.509 linhas de comentário a menos**
no repositório, sem uma única entrada que subisse: `contract.ts` 1.340 → 375, `schema.ts` 371 → 55,
`field-input.tsx` 327 → 133, `credenciais.ts` 248 → 89, `order.ts` 224 → 78, os quatro parciais da
régua 207/197/158/158 → 70/60/54/55. O que se corta é o **ensaio** (o bloco de 15 a 60 linhas), não a
armadilha nem o dono da peça — e é por isso que os 28 arquivos seguem no baseline: cabeçalho e linha
de campo são a documentação que o arquivo tem, e num arquivo pequeno eles sozinhos passam dos 12%.

## 15.5 "Ler antes de mover"

**Nenhum arquivo é movido, partido ou editado sem leitura integral na mesma fase.**
A varredura (nome, tamanho, quem importa) não basta: ela não vê o que o arquivo faz
nem o que os comentários dele carregam. O custo de mover às cegas apareceu na
inventariação — `packages/contrato/src/schema.ts` parece morto num `grep` de import e
é usado por `export *`; `backend/src/links/*` e `backend/src/scripts/*` parecem órfãos
e são carregados por caminho.

Cada fase registra no doc 09, na entrada dela, a lista do que foi lido integralmente
com o hash do commit ("FEITO (`hash`)"), para a fase seguinte não repetir a leitura
nem confiar na anterior.

## 15.6 As fases F0–F10

Uma fase, um commit. Cada uma deixa uma guarda mais verde do que encontrou — é isso
que impede o refactor de ser um "depois eu volto".

| Fase | O que faz | A guarda que fica mais verde | Gate |
| :--- | :--- | :--- | :--- |
| **F0** (esta) | R-A…R-E, a catraca de comentário, a convenção de teste e este doc | as guardas nascem com baseline | `make check` |
| **F1** (feita) | código morto: `lib/constants.tsx`, `medusa-cta/` + 5 ícones órfãos, `retrieveCollection`, o `export` de `themeFromRow`, `FeaturedProduct` e as 4 funções mortas de `lib/data/cart.ts`; o `SortOptions` **e** o `DEFAULT_SORT` (que existia em 5 lugares) para `lib/catalog/types.ts`. **Não** foram tocados, apesar da lista: `isEmpty.ts` (vivo por `money.ts`), `repeat.ts` (6 consumidores) e `getOrSetCart`/`updateCart` (usados dentro do `cart.ts`) | R-A 5 → 3 | `make check` · `make types` · `yarn test` |
| **F2** (feita) | o `lib/util` (45 arquivos, 6.622 linhas) dissolvido por dono — `catalog`, `ui`, `content`, `checkout`, `payments` e `medusa`, com o `isEmpty` inline no seu único consumidor; o checkout passa a conhecer só a fachada `@lib/payments` e o `needsInlineInput` duplicado sai. A promessa de `R-C 2 → 1` era falsa: a exceção que sobra é o ciclo do locale, que é do F5 | R-D 4 → 0 | + `yarn build` · GET `/br` |
| **F3** (feita) | convenção de teste: os 30 specs de unidade → `__tests__/<alvo>.unit.spec.ts` (colado no alvo) e os 2 de arquitetura → `src/__checks__/`; as 20 specs de `lib/` com import relativo passaram a `../<alvo>`, os cinco `index.spec.tsx` de componente a `from ".."`, e os dois `__checks__` tiveram os caminhos de leitura refeitos. O baseline da convenção ficou vazio | convenção 32 → 0 | `yarn test` (34) · `STOREFRONT_RUNNER=1` |
| **F4** (feita) | `src/types` (2 arquivos) dissolvido: `VariantPrice`, `ProductColor` e `ProductEnrichment` para `lib/catalog/types.ts`, o `IconProps` para `lib/ui/types.ts` e o `StoreFreeShippingPrice` para `lib/checkout/types.ts`; os 19 imports do caminho NU (`from "types/global"`) passaram ao apelido, e os 4 adapters que subiam `../../types` a `@lib/payments/types` | R-A/R-C sem regressão | `make types` |
| **F5** (feita) | os ciclos: o locale vira FOLHA (`lib/medusa/locale-cookie.ts`, que só importa `next/headers`) e o SDK e o dado passam a ler dela; a `enum LOGIN_VIEW` sai do template para `modules/account/lib/login-view.ts`. A promessa de `R-C 1 → 0` era falsa: a exceção que sobra é do adapter Stripe | R-C 2 → 1 · R-E 6 → 3 | `make check` |
| **F6** | ✅ `brand.css` (5.248 linhas) partido em 18 parciais + manifesto, com prova de concatenação byte a byte (na fonte e no bundle) | catraca (`--write`) | GET `/br` · o `yarn build` **não fecha** por defeito anterior a ela (RV-050, no doc 09 — fechado em 13/10/2026) |
| **F7** | ✅ CRM: `admin/src/admin/routes/content/` (23 arquivos + 3 diretórios) → `page.tsx` + `components/` + `hooks/` + `lib/`; `widgets/` só com o entrypoint (a regra pura foi para `admin/src/admin/lib/`), com prova de que só as 21 linhas de import mudaram nos 27 arquivos movidos | `make build-admin` + smoke |
| **F8** | ✅ backend: `mercadopago/service.ts` (828 → **481**) + `decisao`/`status`/`notificacao`/`estorno`/`boot`; `api/admin/content/route.ts` (488 → **438**) + `lib/resposta` e `lib/gravacao`; `scripts/seed.ts` (569 → **87**) + `seed/` com seis passos; `api/store/custom/checkout-info` → **`api/store/checkout/info`** (a URL pública passa a ser `/store/checkout/info`) | `make test` (24 suítes/424 testes) | smoke do pagamento (5 specs/96 asserções) |
| **F9** | ✅ docs: as citações de caminho e de linha reancoradas — as que a F2, a F6, a F7 e a F8 tornaram falsas, mais as do `plano-centralizacao.md`, que não existe desde o `6c7feef6e7`; e o doc 09 ganha o "FEITO (hash)" de cada fase (F7 `fd42c25831`, F8 `fc3b7d77d3`) | — | revisão |
| **F10** | ✅ os 28 piores: os ensaios do contrato (**1.340 → 375** linhas de comentário só no `contract.ts`), os parciais da régua, o formulário do CRM e o pagamento do backend — **3.509 linhas de comentário a menos**, com o baseline reancorado no mesmo commit e a prova de que só comentário mudou (o minificado dos 28 é idêntico ao `HEAD`) | `--report` + `--write` | `make check` · `make types` · `make test` |

**Regra do lote**: fora dele, só o que a guarda exigir. Se uma fase encontrar um
defeito que não é dela, ele vira item no doc 09 — não vira commit no meio.

## 15.7 Como rodar

| Comando | O que roda | Precisa de `node_modules`? |
| :--- | :--- | :--- |
| `make check` | as guardas: `gen-content --check`, `check-boundaries`, `check-comments`, `check-storefront-tests` | não (é o hook de commit e o job `guard` da CI) |
| `make types` | `tsc` do backend, do CRM e do storefront | sim |
| `make test` | jest do backend, jest do CRM, `check-panel-tests`, vitest do storefront e a convenção dele (`STOREFRONT_RUNNER=1`) | sim |
| `make build-admin` | o bundle do painel (Vite) | sim |
| `yarn build` (em `frontend/`) | `next build`, sem infra | sim |

Direto, quando se quer só uma resposta:

```
node scripts/check-boundaries.mjs                    # R-A…R-E + as duas fronteiras
node scripts/check-comments.mjs --report             # os piores por volume e densidade
node scripts/check-comments.mjs --write              # reancora o baseline (commit que muda a forma)
STOREFRONT_RUNNER=1 node scripts/check-storefront-tests.mjs
```

As guardas **não** usam framework de teste de propósito: elas leem arquivos com Node
puro, e a saída tem de caber no hook de commit (segundos, sem instalar nada). É por
isso que o que pergunta algo a um runner (o jest do CRM, o vitest do storefront) mora
no `make test`, e não no `make check`.

## 15.8 A dívida registrada (e quem a apaga)

| Dívida | Medido em 13/10/2026 | Apaga |
| :--- | :--- | :--- |
| Exceções de camada no baseline | 7 (todas do RV-048; eram 17 antes da F1) | ✅ F1–F5 — o que sobra sai no RV-048 |
| Arquivos acima da política de comentário | 334 arquivos, mas **3.509 linhas de comentário a menos** (o contrato: 2.084 → 541; o storefront: 9.770 → 8.792; o backend: 5.106 → 4.346) | ✅ F10 — cortou os 28 piores; o que fica no baseline é onde o cabeçalho e a linha de campo *são* a documentação do arquivo |
| Specs fora da convenção | 0 | ✅ F3 |
| `lib/util` sem uma responsabilidade só | 45 arquivos · 6.622 linhas | ✅ F2 — dissolvido em `catalog`, `ui`, `content`, `checkout`, `payments` e `medusa` |
| `lib/data/cart.ts` | 421 linhas (eram 476: a F1 tirou as 4 funções mortas) | ✅ F1 |
| `src/types` sem dono de camada | 2 arquivos · 52 linhas | ✅ F4 — os tipos foram para `lib/{catalog,ui,checkout}/types.ts` |
| `brand.css` | 5.248 linhas, 2.039 de comentário | ✅ F6 + F10 — virou dezoito parciais + manifesto, sem perder um byte (F6); a narrativa da régua foi cortada na F10 (os quatro piores: 207/197/158/158 → 70/60/54/55 linhas de comentário) |
| O `yarn build` de produção | achado na F6, mas **anterior** a ela: o `next/headers` alcançava um bundle de cliente pelo `lib/config` (RV-050) | ✅ 13/10/2026 — `"use server"` no `lib/data/tracking.ts`: o `next build` compila e fecha, com a cadeia (`lib/config.ts`, `locale-cookie.ts`, o componente) intacta |

Fora deste lote (não é F0–F10, e não entra no meio de uma fase) **não sobra nenhum** item — o
último saiu em 13/10/2026, e era defeito:

- **o `yarn build` de produção** (RV-050) — a F10 o reproduziu no HEAD (`Failed to compile` em
  `lib/medusa/locale-cookie.ts`, o mesmo trace da F6) e a correção foi uma linha: `"use server"` em
  `lib/data/tracking.ts`, o único módulo de `lib/data` que um componente `"use client"` importava por
  valor sem a diretiva. Sem ela, o `sdk` do `lib/config` — junto com o `next/headers` de onde ele lê o
  idioma — entrava no bundle do cliente. O build agora compila (`✓ Compiled successfully`) e fecha, e
  nenhum arquivo da cadeia foi tocado; a medição, o antes e o depois e a armadilha do `NODE_ENV` de
  desenvolvimento estão na entrada do RV-050 no doc 09.

**Três dívidas que constavam aqui saíram da lista em 13/10/2026** (além do RV-050, acima),
porque a verificação mostrou que não são trabalho:

- **o push do `develop`** — o lote F0–F10 está no remoto: `origin/develop` é o
  `a4bf6d441a`, o commit que fecha os hashes das fases. Isso vale também para o
  `c7df56fc85`, que a versão anterior deste parágrafo dava como local;
- a migration `Migration20260929204616` **está aplicada** — comitada em `70ecff63e2`
  (no remoto) e no banco de dev (`mikro_orm_migrations` id 178, `executed_at`
  2026-10-06 00:17:25 UTC, em lote com as 179 e 180); o schema bate com o `up()`
  (`content_section` existe, `content_block` não, a coluna `title` caiu) e o
  `.snapshot-content.json` já foi regerado, que é o que o README do módulo exige.
  O que resta é rodá-la no ambiente de publicação — e isso não é deste repo;
- o split do `c7df56fc85` **perdeu o objeto**: **16 dos 32** arquivos dele foram
  reescritos pela F2, F5, F8 e F10, então re-fatiar hoje não reconstrói a mesma
  mudança — a divisão em quatro commits fica **encerrada**, não adiada.
