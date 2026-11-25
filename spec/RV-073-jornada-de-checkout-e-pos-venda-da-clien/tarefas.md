# Tarefas -- RV-073

Formato: `T-n · escopo · fronteira · cobre · wave`. Uma tarefa por criterio e' o ponto de partida; ajuste o escopo e junte o que for a mesma mudanca.

- **T-1** · escopo: `frontend/src/modules/tracking/templates/index.tsx` · fronteira: produto · cobre: CA-3, CA-4 · wave: 1
- **T-2** · escopo: `e2e/jornadas/checkout.spec.ts` · fronteira: teste · cobre: CA-1, CA-2 · wave: 1
- **T-3** · escopo: `e2e/jornadas/pos-venda.spec.ts` · fronteira: teste · cobre: CA-3, CA-4 · wave: 2 (depende T-1)

> **Fiacao (fora das tarefas):** os alvos `make e2e-checkout` / `e2e-pos-venda`
> e as chaves de `e2e.journey` sao fiacao de ambiente, nao de teste.
