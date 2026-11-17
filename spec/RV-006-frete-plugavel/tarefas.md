# Tarefas — RV-006 (retrospectivas: o que foi feito para cada critério)

Formato: `T-n · escopo · fronteira · cobre · wave`. Retrospectivo de propósito:
o mesmo formato que a esteira usará para planejar o próximo requisito.

- **T-1** · escopo: `backend/src/modules/fulfillment/tabela/**`, `backend/medusa-config.ts` · fronteira: produto · cobre: CA-1, CA-3, CA-4, CA-6 · wave: 1
- **T-2** · escopo: `backend/src/modules/fulfillment/pacotes/**`, `backend/src/modules/fulfillment/dinheiro.ts` · fronteira: produto · cobre: CA-4, CA-5 · wave: 1
- **T-3** · escopo: `backend/src/modules/fulfillment/superfrete/**` · fronteira: produto · cobre: CA-2 · wave: 2 (depende T-1)
- **T-4** · escopo: `frontend/src/lib/checkout/**`, `frontend/src/lib/data/fulfillment.ts` · fronteira: produto · cobre: CA-3 · wave: 2 (depende T-1)
- **T-5** · escopo: `e2e/jornadas/cliente.spec.ts` · fronteira: teste · cobre: CA-7 · wave: 3 (depende T-3, T-4)
