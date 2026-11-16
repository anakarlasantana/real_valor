# e2e/ — as jornadas de navegador

Esta pasta recebe o teste ponta-a-ponta da loja (Playwright). Ainda **vazia de
propósito**: as jornadas entram na fase 3 do contrato.

O que já está decidido (ver [doc 20](../docs/real-valor/20-testes-ponta-a-ponta.md)):

- uma jornada por spec, em `e2e/jornadas/<jornada>.spec.ts` — `cliente`, `lojista`;
- seletor por `getByRole`/`getByTestId`; `waitForTimeout` é proibido;
- os artefatos (`network.ndjson`, `console.ndjson`, `trace.zip`) vão para
  `evidence/<timestamp>/`, que é **gitignored**;
- a stack é a do projeto `rv_e2e` (portas próprias), nunca a base de dev.

As regras de escrita para esta pasta estão em
[`.clinerules/06-e2e-e-jornadas.md`](../.clinerules/06-e2e-e-jornadas.md).
