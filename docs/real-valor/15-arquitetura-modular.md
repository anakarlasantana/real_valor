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
| `modules/` | UI e comportamento de um domínio (`store`, `products`, `checkout`, `account`, `home`, `content`, `skeletons`, `common`) | `lib`, contrato | 171 arquivos · 16.962 linhas |
| `lib/` | dado, regra e integração, sem React de tela (`data`, `payments`, `content`, `theme`, `config`, `util`) | contrato | 97 arquivos · 12.912 linhas |
| `types/` | tipo sem dono de camada (candidato a virar dono: F4) | contrato | 2 arquivos · 59 linhas |
| `packages/contrato` | tipo e schema compartilhados pelos três runtimes (`@rv/contrato`) | — é folha | 3.817 linhas |
| `styles/` | CSS (`brand.css` e parciais: F6) | — | 5.248 linhas |

Três consequências que a F0 tornou verificáveis:

1. **`lib` não conhece `modules`.** O tipo também caminha junto com o dono: se o
   dado precisa de `SortOptions`, o tipo mora em `lib/`, não no componente que o
   usa. É a inversão que mais apareceu na varredura (5 casos, R-A).
2. **`modules` e `lib` não conhecem `app`.** A rota compõe; a peça não sabe em que
   rota ela foi montada. Zero violações hoje (R-B) — a regra existe para o
   primeiro caso, não para o passado.
3. **`lib/data` é o fundo da pilha.** Fora dele, ninguém em `lib` importa
   `lib/data`; é a regra que impede o ciclo `dado ↔ utilidade` (2 casos, R-C).

## 15.2 As regras, a guarda e as exceções vivas

Todas rodam no `make check` (Node puro, segundos, sem `node_modules`) — e por
isso estão no hook de commit (`.githooks/pre-commit`) e no job `guard` da CI.

| Regra | O que proíbe | Guarda | Exceções vivas | Morrem em |
| :--- | :--- | :--- | ---: | :--- |
| **R-A** | `lib` importa `modules` | `check-boundaries.mjs` | 5 | 2 na F2 · 3 no RV-048 |
| **R-B** | `lib`/`modules` importam `app` | `check-boundaries.mjs` | 0 | — (nasce verde) |
| **R-C** | `lib` (fora de `lib/data`) importa `lib/data` | `check-boundaries.mjs` | 2 | 1 na F5 · 1 no RV-048 |
| **R-D** | `modules/checkout` importa `@lib/payments/*` (subcaminho, em vez da fachada) | `check-boundaries.mjs` | 4 | F2 |
| **R-E** | ciclo de import de VALOR no storefront | `check-boundaries.mjs` | 6 | 3 na F5 · 3 no RV-048 |
| painel × backend | `admin/` importa VALOR do backend (só `import type`) | `check-boundaries.mjs` (R7) | 0 | — |
| checkout × adapter | `modules/checkout` importa adapter ou SDK de pagamento | `check-boundaries.mjs` (RV-014) | 0 | — |
| convenção de teste | spec fora de `__tests__/<alvo>.unit.spec.ts` ou `src/__checks__/` | `check-storefront-tests.mjs` | 32 | F3 zera |
| comentário | cabeçalho > 5 linhas, densidade > 12% (arquivo fora do baseline) | `check-comments.mjs` | 313 arquivos | F10 reduz |

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
resolver (um apelido renomeado no `tsconfig`, por exemplo), as 17 exceções viram
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
  R-C guarda o fundo da pilha: `lib/util/sort-products.ts` importando `lib/data` fecha
  o ciclo que R-E acusa.
- **R-D (a fachada)**: medido em 13/10/2026 — `lib/payments/index.ts` tem **zero**
  importadores, e o checkout chega ao `registry` por subcaminho em 4 arquivos
  (`payment`, `payment-button`, `payment-container`, `payment-wrapper`). Pior: o
  `needsInlineInput` existe no contrato **e** reimplementado no checkout
  (`modules/checkout/components/payment/index.tsx`). A fachada existe para ser o único
  nome que o checkout conhece; a F2 a torna verdade.
- **R-E (ciclos)**: os seis ciclos de valor medidos hoje estão no baseline com o marco
  que os apaga. O `config → get-locale-header → locale-actions → config` é o que obriga
  a F5 a existir: o SDK injeta o cabeçalho de locale e o dado do locale usa o SDK.
- **convenção de teste**: o CRM já perdeu suíte por `testMatch` estreito (o spec
  continuou no disco, o `make test` continuou verde e passou a rodar menos — ver
  `check-panel-tests.mjs`). No storefront o glob padrão do vitest é largo, mas o lugar
  do spec é livre: um arquivo colado em qualquer lugar roda, e ninguém sabe onde
  procurá-lo. A F3 unifica em `__tests__/<alvo>.unit.spec.ts` e reserva
  `src/__checks__/` para as guardas de arquitetura (`media-wiring`, `ruler`).
## 15.4 A política de comentário

O problema medido na varredura de 13/10/2026: **19.512 linhas de comentário** nas cinco
árvores de fonte — `packages/contrato/src` em **54,6%**, `backend/src` em 32,0%,
`scripts/` 30,4%, `admin/src` 28,6%, `frontend/src` 26,0%. Só os cortes da própria F0
(as três guardas novas e o `check-boundaries.mjs`) já baixaram o total para 19.375 e os
`scripts/` para 19,9% — a catraca registra o resto. Os piores arquivos isolados:

| Arquivo | Comentário | Linhas | Densidade |
| :--- | ---: | ---: | ---: |
| `frontend/src/styles/brand.css` | 2.039 | 5.248 | 39% |
| `packages/contrato/src/contract.ts` | 1.340 | 2.633 | 51% |
| `packages/contrato/src/schema.ts` | 371 | 452 | 82% |
| `admin/src/admin/routes/content/field-input.tsx` | 327 | 1.119 | 29% |
| `backend/src/modules/payment/mercadopago/service.ts` | 316 | 828 | 38% |
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
| Baseline (`scripts/baselines/comments.json`) | 314 arquivos + o total por árvore |
| Folga tolerada de uma entrada | < 10% (e < 3 linhas): acima disso a entrada é frouxa |

A catraca só desce: um arquivo que já está no baseline não pode ganhar comentário, um
total de árvore não pode subir, e uma entrada frouxa ou órfã **reprova**. `--report`
lista os piores (é o insumo da F10) e `--write` reancora o baseline — o `--write` é
parte do commit que mudou a forma dos arquivos de propósito (a F6, ao partir o
`brand.css`; a F5, ao desmanchar o ciclo), e o diff do baseline aparece na revisão.

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
| **F1** | código morto: `lib/constants.tsx`, `lib/util/isEmpty.ts`, `lib/util/repeat.ts`, `retrieveCollection`, `themeFromRow`, `FeaturedProduct`, `medusa-cta/` + ícones órfãos; as funções mortas de `lib/data/cart.ts` (476 linhas); `SortOptions` sai do componente | R-A 5 → 3 | `make check` · `make types` · `yarn test` |
| **F2** | dissolve `lib/util` (45 arquivos, 6.622 linhas) por dono; o checkout passa a conhecer só a fachada `@lib/payments`; o `needsInlineInput` duplicado sai | R-A 3 → 0 · R-C 2 → 1 · R-D 4 → 0 | + `yarn build` · GET `/br` |
| **F3** | convenção de teste: 30 specs → `__tests__/<alvo>.unit.spec.ts`, os 2 de arquitetura → `src/__checks__/` | convenção 32 → 0 | `yarn test` (34) · `STOREFRONT_RUNNER=1` |
| **F4** | `src/types` → `lib/{catalog,ui,checkout}/types.ts`; os imports por caminho nu → apelido | R-A/R-C sem regressão | `make types` |
| **F5** | os ciclos: `config ↔ locale` (o locale vira folha) e o `LOGIN_VIEW` do `account` | R-C 1 → 0 · R-E 6 → 3 | `make check` |
| **F6** | `brand.css` (5.248 linhas) partido em parciais + manifesto, com prova de concatenação byte a byte | catraca (`--write`) | `yarn build` · GET `/br` |
| **F7** | CRM: `admin/src/admin/routes/content/` (23 arquivos + 3 diretórios) → `page.tsx` + `components/` + `hooks/` + `lib/`; `widgets/` só com entrypoint | `make build-admin` | smoke do painel |
| **F8** | backend: `mercadopago/service.ts` (828), `api/admin/content/route.ts` (488), `scripts/seed.ts` (569); `api/store/custom/*` renomeado | `make test` (24 suítes) | smoke do pagamento |
| **F9** | docs: as citações de caminho e de linha reancoradas; o doc 09 ganha o "FEITO (hash)" de cada fase | — | revisão |
| **F10** | o comentário dos ~20 piores arquivos; o baseline encolhe | `--report` | `make check` |

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
| Exceções de camada no baseline | 17 (6 na F2, 4 na F5, 7 no RV-048) | as fases |
| Arquivos acima da política de comentário | 313 | F10 (meta: ≤12% e cabeçalho ≤5) |
| Specs fora da convenção | 32 | F3 |
| `lib/util` sem uma responsabilidade só | 45 arquivos · 6.622 linhas | F2 |
| `lib/data/cart.ts` | 476 linhas | F1 (funções mortas) |
| `brand.css` | 5.248 linhas, 2.039 de comentário | F6 |

Fora deste lote (não é F0–F10, e não entra no meio de uma fase): o push do `develop`
(o commit `c7df56fc85` está local), a migration pendente
(`Migration20260929204616`, `content_section` → `content_block`) e a divisão do
`c7df56fc85` em quatro commits, se ela ainda fizer sentido depois da F1 — a F1 mexe
justamente nos arquivos que ele tocou, e a resposta certa pode ser "não mexe".
