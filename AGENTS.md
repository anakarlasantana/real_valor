# AGENTS.md — Real Valor

Regras para **qualquer** agente de IA neste repositório (Cline, Kiro, Codex,
Claude, Copilot). Aqui ficam as camadas **universal** e **do repositório**; as
regras **por caminho** estão em `.clinerules/`, e o que o `ai-harness` injeta
no prompt está em `.harness/context.json`.

## O que é este repositório

Medusa v2 (backend + CRM em `admin/`) + Next 15 (`frontend/`) + o contrato de
conteúdo em `packages/contrato`. Yarn 4 workspace: **um** install, **um**
lockfile, três runtimes. A stack roda em Docker (`make up`).

## Definition of Done (executável)

- `make ready` tem de imprimir `VEREDITO: PRONTO` antes de qualquer commit.
- Nunca `git commit --no-verify`. O hook roda o `make check` de propósito.
- Nunca diga "está pronto" sem colar a saída do veredito.

## Regras duras

1. **Comentário é orçamento.** A catraca do `make check` reprova **qualquer**
   linha a mais em `backend/src`, `frontend/src`, `admin/src`,
   `packages/contrato/src` e `scripts`. Precisa de um comentário novo? Remova
   outro no mesmo arquivo. `--write` só com a justificativa no corpo do commit.
2. **Camadas do storefront.** `lib` não importa `modules`; `lib` e `modules` não
   importam `app`; fora de `lib/data`, `lib` não importa `lib/data`; o checkout
   só conhece pagamento por `@lib/payments`; sem ciclo de imports de valor.
3. **O contrato é a fonte única** (`packages/contrato`). Campo novo =
   `make gen` + bump de `SCHEMA_VERSION` + `make seed -- --contrato`. Nunca
   edite o artefato gerado à mão (`frontend/themes/*.json`,
   `tokens.generated.css`): eles são versionados e o `--check` compara.
4. **Migration não é seed.** Migration = schema + backfill do que **já existe**;
   dado de loja = seed (`make seed`, um comando). Um `insert` de conteúdo numa
   migration faria o histórico depender do código do dia em que rodou.
5. **Diff mínimo.** Proibido reformatar arquivo inteiro, renomear por gosto,
   "limpar" o que não foi pedido ou comentar o óbvio. O PR mostra o diff.
6. **Comandos destrutivos exigem pedido explícito:** `make clean-db`,
   `make seed-limpar`, `docker compose down -v`, `git checkout -- .`.
7. **Segredo não entra no diff.** O `.env` é local (gitignored); o versionado é
   `.env.example`. Nunca escreva um valor de `.env` em arquivo versionado.
8. **Fato, não opinião.** Toda afirmação técnica cita `arquivo:linha` ou a saída
   de um comando. Se não rodou, diga que não rodou.

## Onde olhar antes de mexer

| Preciso de | Vá para |
| :--- | :--- |
| subir a stack, portas, troubleshooting | `README.md` |
| as regras do CRM, com evidência | `docs/real-valor/16-requisitos-admin.md` |
| camadas, comentários e módulo novo | `docs/real-valor/15-arquitetura-modular.md` |
| contrato do E2E e do rework | `docs/real-valor/20-testes-ponta-a-ponta.md` |
| débito aberto e critério de "feito" | `docs/real-valor/19-debito-tecnico.md` |
| armadilhas do ambiente local | `docs/real-valor/11-ambiente-local.md` |

## Commit

`tipo(escopo): frase no presente` — corpo com **o que mudou e a medição**
(antes → depois). Um assunto por commit. Ver `git log` para o tom.

## Como reportar

Curto e verificável: o comando que rodou, o resultado e, se falhou, a primeira
causa. Sem "provavelmente".
