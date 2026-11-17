# 20 — Testes ponta-a-ponta e o ciclo de rework

**Status:** contrato escrito; implementação em fases (ver §20.7)
**Data:** 17/11/2026
**Dívidas:** `RV-028` (a peça) e `RV-059` (a esteira) — ver [doc 19](19-debito-tecnico.md) §7

> **Para que serve.** Fixar o **contrato** entre a Real Valor e o `ai-harness`: o que
> o repositório declara, o que ele produz de evidência, onde o laudo e o registro
> de rework ficam, e quem escreve cada coisa. Sem este contrato, a esteira vira
> acoplamento — o harness precisaria saber o que é Medusa, Next e Mercado Pago.

---

## 20.1 As duas metades (e por que separadas)

| Metade | O que é | Onde mora | Dívida |
| :--- | :--- | :--- | :--- |
| **Peça** | rodar a jornada e produzir evidência | **neste repositório** (`e2e/`, `make e2e*`) | `RV-028` |
| **Esteira** | digerir a evidência, classificar o rework e conduzir a correção | **`ai-harness`** (genérico) | `RV-059` |

A peça funciona **sem** o harness instalado (só `make` + Node + Docker). O
harness funciona **sem** conhecer a aplicação (só lê o contrato da §20.2).
O teste de fronteira é esse: se a Real Valor deixar de subir sem o harness, há
acoplamento.

---

## 20.2 O contrato — `.harness/context.json`

O harness roda na raiz do repositório e lê este arquivo (JSONC). Hoje ele já
aproveita duas chaves: `testCommand` (o *definition of done* em um comando) e
`architectureRules` (regras injetadas no prompt). Os blocos `verification`,
`e2e` e `rework` estão **escritos e inertes** — o carregador ignora chave
desconhecida, então o contrato nasce pronto e é ligado na fase 4.

| Chave | Estado | Para que serve |
| :--- | :--- | :--- |
| `provider` / `models` / `stages` | **ativo** | wire format e modelo por etapa (hoje com nomes reais do endpoint) |
| `testCommand` | **ativo** | `make ready` — o harness roda o gate do repo em vez de adivinhar stack |
| `architectureRules` | **ativo** | resumo executável das regras (a versão completa vem no `AGENTS.md`, fase 2) |
| `verification.readiness` | inerte | mesmo comando do `testCommand`, com `timeoutMs` explícito |
| `e2e.before/command/after` | inerte | ciclo de vida: sobe stack → roda jornadas → derruba (**sempre**, mesmo em falha) |
| `e2e.journey` | inerte | uma jornada por comando (`make e2e:cliente`, `make e2e:lojista`) |
| `e2e.logs` | inerte | comandos de log declarados — o harness só substitui `{since}`; **não** conhece container |
| `e2e.allowlist` | inerte | respostas esperadas que **não** reprovam (ver §20.4) |
| `rework` | inerte | onde o registro é gerado e o índice conferido |

---

## 20.3 Evidência: o que é descartável e o que é durável

| Artefato | Vida | Versionado? | Caminho |
| :--- | :--- | :--- | :--- |
| `trace.zip`, `network.ndjson`, `console.ndjson`, `server.log`, `*.png` | descartável | **não** (`evidence/` no `.gitignore`) | `evidence/<timestamp>/` |
| `resumo.md` (digest ≤ 60 linhas, lido pelo modelo) | descartável | não | `evidence/<timestamp>/resumo.md` |
| **Laudo da execução** | durável | **sim** | `docs/real-valor/laudos/<AAAA-MM-DD>-<alvo>-<jornada>.md` |
| **Registro de rework** | durável | **sim** | `docs/real-valor/laudos/reworks/RW-<AAAA>-<NNN>.md` |
| Índice dos reworks | durável | **sim** | `docs/real-valor/laudos/reworks/indice.md` |
| Estado de máquina da tarefa | durável | não (`.harness/tasks/`) | `.harness/tasks/<taskId>.json` |

**Regra de ouro:** o Markdown é o **handoff** (humano e próximo agente); o JSON é
o **estado**. O Markdown é **gerado** do JSON + digest, para os dois não
divergirem — a mesma lógica do `make gen`/`--check`.

O `resumo.md` é o único arquivo de evidência que o modelo lê. Ele tem forma fixa:

```
jornada: cliente-compra        resultado: FALHOU (7/9)
esperado: /pedido/confirmacao  obtido: /checkout?step=payment
5xx (3): POST /store/payment-collections
console.error (1): "A valid publishable key is required…"
server.log[backend]: error: relation "payment_provider" does not exist
allowlist: 401 customers/me · 404 store/locales
suspeitos: packages/contrato/src/schema.ts (commit f66ee6f)
```

---

## 20.4 A allowlist (o que não conta como falha)

Reprova: **5xx** em qualquer rota nossa, `console.error`, `pageerror`,
`requestfailed`, `error:` no backend ou `⨯` no frontend **durante a jornada**,
imagem 404, pedido sem baixa de estoque.

Não reprova — e o motivo é obrigatório no arquivo:

| Resposta | Por que é esperada |
| :--- | :--- |
| `401 /store/customers/me` | visitante anônimo, por definição |
| `404 /store/locales` | rota que o storefront trata como "sem locale" |
| `401 /auth/user/emailpass` | tentativa negativa de login, quando a jornada testa isso |

Qualquer acréscimo a esta lista é uma decisão de engenharia, não um ajuste de
teste — e vai no laudo com a justificativa.

---

## 20.5 O registro do rework (`RW-AAAA-NNN.md`)

Gerado a partir de `.harness/tasks/<taskId>.json` (uma fonte só). O frontmatter é
**regenerado** a cada execução; o corpo tem seções **append-only**.

```yaml
---
id: RW-2026-001
alvo: real-valor
aberto_em: 2026-11-17T09:12:00-03:00
origem:
  jornada: cliente-compra
  passo: "7/9 — pagamento"
  laudo: docs/real-valor/laudos/2026-11-17-real-valor-cliente.md
  commit_base: f66ee6f
ambiente: { stack: rv_e2e, portas: [8100, 9100], tema: natal }
classificacao: produto          # teste | produto | ambiente | dado | indefinido
severidade: bloqueia-compra     # bloqueia-compra | degrada | cosmetico
sintoma: "POST /store/payment-collections → 500 (3 tentativas)"
reproducao: 'make e2e:cliente -- --grep "pagamento"'
evidencias:                     # o essencial INLINE — sobrevive ao evidence/ apagado
  requests_5xx: ["POST /store/payment-collections"]
  console_errors: ["A valid publishable key is required…"]
  server_log: ['error: relation "payment_provider" does not exist']
causa_provavel: { arquivo: "backend/src/api/…", linha: 0, porque: "…" }
hipoteses: []                   # cada uma com estado: aberta | confirmada | descartada
arquivos_suspeitos: []
testes_a_rodar: ["make ready", "make e2e:cliente", "make test:api"]
criterio_de_aceite: "…"
risco_de_regressao: medio
patch: { branch: "", commits: [], pr: "" }
gates: { ready: pendente, test: pendente, e2e: pendente }
estado: relatado
proximo_passo: "classificar (teste × produto)"
---
```

Corpo: **Fato** · **Causa provável** · **Hipóteses** · **Plano** · **Tentativas**
(n · hipótese · resultado · tempo) · **Veredito** (números dos gates) ·
**Como retomar** (para o próximo agente) · **Histórico** (append-only).

### Os sete princípios que fazem o registro ser resolvível depois

| # | Princípio | Por que |
| :-- | :--- | :--- |
| 1 | **Autossuficiente** (o essencial inline) | `evidence/` é descartável; o registro não pode depender dele |
| 2 | **Reprodutível** (comando + commit + ambiente) | "não reproduz" é o maior custo de retomada |
| 3 | **Classificado** (teste × produto × ambiente × dado) | define **quem** corrige: healer (só `e2e/`) ou produção |
| 4 | **Histórico de tentativas** | evita repetir hipótese já descartada |
| 5 | **Critério de aceite explícito** | o agente sabe **quando parar** |
| 6 | **Rastreável** (`RW-id` no branch, no commit e no corpo do PR) | `bug → rework → commit` numa linha |
| 7 | **Append-only no histórico** | auditoria sem reescrever o passado |

---

## 20.6 O ciclo de vida (quem escreve em cada transição)

```
e2e FALHOU
   └─► relatado        ← harness, automático (ao gerar o laudo)
         ├─► triado     ← `ai fix <RW-id>`: fronteira + branch + dossiê
         │     ├─► aplicado    ← agente: branch fix/rw-2026-001-<slug> + commit
         │     │     └─► verificado  ← `ai fix <RW-id> --verificar` (prontidão + jornada)
         │     │           └─► fechado
         │     ├─► descartado  ← causa era ambiente/dado (registra o porquê)
         │     └─► bloqueado   ← 3 tentativas sem sucesso → escala para humano
```

**Regra dura:** nenhum rework é fechado sem veredito, e nenhum PR de correção é
aberto sem o `RW-id` no título ou no corpo.

Quem executa as transições é o `ai-harness` (contrato em
`docs/fluxo-de-rework.md` dele):

| Comando | Faz | Não faz |
| :--- | :--- | :--- |
| `ai fix <RW-id>` | valida a classificação, exige árvore limpa, abre `fix/<id>-<slug>`, escreve `.harness/rework/<id>/dossie.md` e marca `triado` | editar código |
| `ai fix <RW-id> --verificar` | confere a **fronteira** do patch, roda `make ready` e a jornada, grava `gates`/`tentativas`/`estado` e anexa o veredito | commitar, abrir PR, dar merge |

Fronteira: `teste` só toca o instrumento (`e2e/**`, `__tests__/**`, `*.spec`);
`produto` não toca `e2e/**`; `ambiente`/`dado` não viram patch (exigem
`--forcar`). `AGENTS.md`, `.clinerules/**` e `.harness/context.json` nunca são
editados — regra que o agente edita não é regra.

O índice (`laudos/reworks/indice.md`) é **derivado** — regenerar e conferir com
`--check` na CI, como o `gen-content`. Tabela:
`id · data · jornada · severidade · estado · PR`.

---

## 20.7 Fases (estado real deste contrato)

| Fase | Entrega | Estado |
| :--- | :--- | :--- |
| 1 | `make ready` + `scripts/check-readiness.sh` | ✅ feito (`c9a48c9e7e`) |
| 2 | `AGENTS.md` + `.clinerules/` + `.clineignore` | ✅ feito (`cd47f90ad2`) |
| 3 | overlay `docker-compose.e2e.yml` + `e2e/` (Playwright) + jornada `cliente` + evidência | ✅ feito (`da1769b943`) — **jornada verde** do zero em 17/11 (`7d0b9f43c6` em diante) |
| 4 | `E2ERunner` + `EvidenceDigest` + estágio `e2e` + `ai e2e` (no `ai-harness`) | ✅ feito — `ai e2e --readiness` **PASSOU** (39,8s) e `ai e2e --journey cliente` **PASSOU** (57s: preparo 36,5s + jornada 20,3s), com digest de 60 linhas e registro no dashboard |
| **5.5** | **este documento + o contrato `.harness/context.json` + `laudos/`** | ✅ **feito** (`d71d662d6a`) |
| 6 | 2º alvo (`rd-sesi-backend`, `hi-cleo`) — prova de genericidade | **fora do escopo do projeto**: o onboarding é feito por sistema, quando necessário (o contrato é declarativo para isso) |
| 7 | `RV-059`: continuação do fluxo (do relato ao patch verificado) | ✅ feito — `ai fix <RW-id>` (fronteira, branch, dossiê) e `ai fix <RW-id> --verificar` (gates + veredito no registro). Validado com 4 combinações de fronteira e com a recusa de registro de ambiente |


> **Estado da jornada (17/11/2026, 17:05).** A jornada `cliente-compra` está
> **verde do zero** e o harness já a executa sozinho: `ai e2e --readiness`
> PASSOU (39,8s) e `ai e2e --journey cliente` PASSOU (57s). Os seis achados do
> caminho viraram registro: `RW-2026-001` e `-002` (teste/fixture), `-003` (peça
> sem perfil de envio, que fazia o cálculo do frete responder 500), `-004` (dado
> de teste em centavos), `-005` (o resumo lia o status errado) e `-006` (preparo
> pulado deixa a Server Action pendente).
>
> Observabilidade: cada execução do harness vira `testRuns[]` em
> `.harness/tasks/<id>.json` e aparece no `ai dashboard` (painel "Testes das
> aplicações") com passos, 5xx, console e caminho do digest — ao vivo.

### Fora de escopo (declarado)

- **auto-merge** por agente — a decisão de merge continua humana;
- **`e2e:mp`** (pagamento real em modo teste) — só depois do `RV-028` fechar;
- o agente **editar as próprias regras** (`AGENTS.md`, `.clinerules`) — regra que
  o modelo reescreve não é regra.
