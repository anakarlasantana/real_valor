# Tarefas -- RV-072

Formato: `T-n · escopo · fronteira · cobre · wave`. Uma tarefa por criterio e' o ponto de partida; ajuste o escopo e junte o que for a mesma mudanca.

- **T-1** · escopo: `e2e/jornadas/sacola.spec.ts` · fronteira: teste · cobre: CA-1, CA-2 · wave: 1
- **T-2** · escopo: `e2e/jornadas/conta.spec.ts` · fronteira: teste · cobre: CA-3, CA-4 · wave: 2 (depende T-1)

> **Fiacao (fora das tarefas):** os alvos `make e2e-sacola` / `e2e-conta` e as
> chaves de `e2e.journey` sao fiacao de ambiente, nao de teste — o validador de
> fronteira so admite `e2e/**` em `fronteira: teste`.
