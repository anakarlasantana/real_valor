# Tarefas -- RV-071

Formato: `T-n · escopo · fronteira · cobre · wave`. Uma tarefa por criterio e' o ponto de partida; ajuste o escopo e junte o que for a mesma mudanca.

- **T-1** · escopo: `e2e/jornadas/vitrine.spec.ts` · fronteira: teste · cobre: CA-1, CA-2 · wave: 1
- **T-2** · escopo: `e2e/jornadas/produto.spec.ts` · fronteira: teste · cobre: CA-3, CA-4 · wave: 2 (depende T-1)
- **T-5** · escopo: `backend/src/scripts/e2e-fixtures.ts` · fronteira: produto · cobre: CA-3 · wave: 1

> **Feitas na Etapa 0** (commit `7bc0e093ca`): `e2e/fixtures/navegacao.ts` e a
> extração do `irPara` (T-3), e os `data-testid` do rastreio (T-4).
>
> **T-5 existe por medição.** A peça `[e2e]` nasce com **uma** variante
> ("Único", `e2e-fixtures.ts:112`), e o seletor de tamanho só renderiza com mais
> de uma (`product-actions/index.tsx:184`). Sem a fixture de duas variantes o
> CA-3 não tem como ser provado — não é seletor, é dado.


> **Fiação (fora das tarefas):** os alvos `make e2e-vitrine` / `e2e-produto` e as
> chaves de `e2e.journey` são fiação de ambiente, não de teste — o validador de
> fronteira só admite `e2e/**` em `fronteira: teste`. Entram no mesmo commit da
> T-1/T-2 e são cobertos por `ai verify e2e`.




