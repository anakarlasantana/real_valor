---
paths:
  - "e2e/**"
---
# Teste ponta-a-ponta (jornadas)

O contrato completo está em `docs/real-valor/20-testes-ponta-a-ponta.md`. O que
não se negocia dentro de `e2e/`:

**Seletor:** `getByRole` / `getByTestId` / `getByLabel`. Nunca seletor CSS de
estrutura (`div > span`), nunca índice de lista. Se falta um `data-testid`,
acrescente no componente — o CRM é nosso.

**Espera:** `expect(...).toBeVisible()` e as asserções com auto-retry do
Playwright. `waitForTimeout` é proibido: ele esconde corrida e vira flake.

**Uma jornada por spec**, em `e2e/jornadas/<jornada>.spec.ts`. O nome da jornada
é o mesmo do `context.json` (`cliente`, `lojista`).

**Artefatos** vão para `evidence/<timestamp>/` no formato do contrato:
`network.ndjson`, `console.ndjson`, `trace.zip`. `evidence/` é gitignored.

**Asserção não se enfraquece.** Se a jornada falha, o defeito é do produto ou do
seletor — nunca do `expect`. Quem conserta locator é o healer, e ele toca
**somente** `e2e/`.

**Stack isolado.** A jornada roda no projeto `rv_e2e` (portas próprias), nunca na
base de dev — o teste cria produto e edita conteúdo.
