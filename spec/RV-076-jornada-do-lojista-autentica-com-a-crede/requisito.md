---
id: RV-076
titulo: Jornada do lojista autentica com a credencial da stack
persona: lojista
prioridade: ALTA
origem: docs/real-valor/04-requisitos-funcionais.md#rv-069
estado: rascunho
---

## História

Como lojista, quero que a jornada do painel autentique com a credencial que a
stack realmente tem — para que a prova de ponta a ponta do CRM não pare no
login por causa de uma senha escrita à mão no spec.

## Regras de negócio

- A senha do painel **não** é `ADMIN_PASSWORD` do `.env`: esse valor só cria o
  primeiro usuário (`Makefile:313-316`, `scripts/senha-admin.sh`). Quem decide o
  login é o que o Medusa gravou.
- A credencial tem **uma fonte só** (`e2e/fixtures/painel.ts`); nenhum spec
  repete literal.
- Sem a variável, a jornada falha **dizendo o que falta** — não tenta a senha
  errada e não vira timeout de 90s no menu.
- A jornada é declarada no contrato (`e2e.journey`) e tem alvo próprio no
  `Makefile`, como a da cliente.
- Segredo não entra no diff: a senha vai por variável de processo.

## Critérios de aceite

- **CA-1** — When o painel recebe a credencial da stack, the jornada do lojista shall autenticar e mostrar o menu de envios.
  prova: `jornada:lojista@admin abre`
- **CA-2** — When a variável de senha está ausente, the fixture shall falhar com mensagem que nomeia a variável, sem tentar autenticar.
  prova: `unit:e2e/fixtures/__tests__/painel.unit.spec.ts`
- **CA-3** — When a jornada do lojista roda, the contrato shall declará-la em `e2e.journey` e o `Makefile` shall expor o alvo próprio.
  prova: `jornada:lojista@admin abre`
- **CA-4** — When a credencial é lida, the fixture shall devolvê-la sem literal de senha no código do spec.
  prova: `unit:e2e/fixtures/__tests__/painel.unit.spec.ts`

## Não-objetivos

- Trocar a senha do painel (é do `make admin-password`).
- Criar usuário de teste próprio para o e2e (o admin da stack basta).

