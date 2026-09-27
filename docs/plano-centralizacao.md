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
com banco único — `content_block` é a única tabela de conteúdo, `/store/content` e
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
| **F2** — Schema como dado | registro de schema no banco; `GET /admin/content` devolve; CRM desenha o form; `PATCH` valida contra o schema; loja ignora o que não conhece | ⚠️ **parcial** | CRM 100% desenhado pelo `schema` + `validateData` server-side (commits de F2). **Falta:** `content_schema` no banco, `schemaVersion` no payload, bootstrap/migração do registro |
| **F3** — Tema como dado | dono troca paleta/fontes/estação pelo CRM; `themes/*.json` vira seed; some o `fs` em request-time e o `COPY` do Dockerfile | ⏸️ etapa 1 pronta, **adiada** | branch `f3-tema-como-dado` (commit `fcdc3500ec`): superfície `theme` no contrato + API + CRM. **Falta:** seed dos `theme.json` e a loja ler do payload |
| **F4** — CRM de vendas/entrega | agregações (vendas, status, ticket, rastreio) como módulo + rotas `/admin/*`, sobre o mesmo banco | ⏸️ não iniciado | `order-customer-indexer` + `/store/orders/track` são a base |
| **F5** — Higiene | Makefile interface única; `packages/` só se útil; CI rodando `make check`; `schemaVersion` | ⏸️ parcial | Makefile já é a interface; **falta** CI e `schemaVersion` |

**O F2 entregue é a ponte, não o registro.** A fonte da verdade do schema continua sendo
`backend/src/modules/content/contract.ts`: o CRM lê pela API (zero espelho no painel, e
foi isso que matou os espelhos), mas **mudar schema ainda exige deploy**. Verificar:
`grep -rn 'content_schema\|schemaVersion'` não encontra nada, e o módulo tem **uma**
migration — a `content_block` original.

## O que falta dentro do F2 (F2′ — o passo que ficou no meio)

1. `models/content-schema.ts` — `id` (`"content"`), `version` (= o `schemaVersion`), `data`
   (o schema inteiro: `types`, `typeLabels`, `fields`, `itemFields`, `palette`, `fonts`,
   `darkTokens`, `surfaces`, ícones) + migration pelo `medusa db:generate`.
2. `service.getSchema()/saveSchema()`; bootstrap **idempotente** num `seed-schema.ts` que
   grava a linha a partir do contrato — o TS vira *seed*, e a migration fica só com a DDL
   (embutir ~700 linhas de JSON numa migration seria uma segunda fonte que envelhece).
3. `GET /admin/content` devolve o schema **do banco**, com `source: "db" | "contract"` no
   fallback; `POST/PATCH` validam contra o schema **gravado**, não contra o TS.
4. `schemaVersion` no payload de `/store/content` e `/admin/content`; revalidação inclui o
   schema na tag `content`.
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

## Sessão de higiene (2026-09-27)

Enquanto o schema/banco ficou adiado, "arrumou-se a casa":

| Item | O quê | Status |
|---|---|---|
| H1 | Etapa 1 do F3 (não commitada) guardada na branch `f3-tema-como-dado`; `develop` limpo | ✅ commit `fcdc3500ec` |
| H2 | Este arquivo de plano versionado | ✅ |
| H3 | `assets` morto dos `theme.json` (apontava para `.jpg` inexistentes) e do tipo `Theme` | ✅ commit `825080511a` |
| H4 | Dependência morta: **corrigido** — `ansi-colors` é usada por `frontend/check-env-variables.js`, que o `next.config.js` carrega (o build aborta se falta variável). No lugar, saiu o que era mesmo morto: `campaign-1/2/3.jpg`, sem nenhuma referência | ✅ commit `825080511a` |
| H5 | Baseline de `tsc` do storefront 20 → 0 (destrava `tsc` como guarda / CI) | ⏸️ ver H5 abaixo |

## H5 — os 20 erros de `tsc` do storefront

Enquanto existirem, o `tsc` não pode ser guarda e o CI (F5) morre aqui. Os 20 erros (por
arquivo):

| Arquivo | Erros |
|---|---|
| `src/modules/common/components/line-item-unit-price/index.tsx` | 7 |
| `src/modules/common/components/line-item-price/index.tsx` | 5 |
| `src/modules/checkout/components/shipping/index.tsx` | 3 |
| `src/app/[countryCode]/(main)/...` | 3 |
| `src/modules/layout/components/country-select/index.tsx` | 1 |
| `src/app/api/revalidate/route.ts` | 1 (nosso) |

Comando de conferência: `./node_modules/.bin/tsc --noEmit -p tsconfig.json` (em
`frontend/`). O backend tem 1 erro pré-existente, em `medusa-config.ts:28`.
