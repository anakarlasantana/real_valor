# e2e/ — as jornadas de navegador

Playwright, uma jornada por spec em `e2e/jornadas/`. Roda contra a stack
**isolada** `rv_e2e` (`scripts/e2e-stack.sh up`), nunca a de dev — a jornada cria
peça e mexe no carrinho.

```bash
make e2e           # sobe o stack, roda a jornada e escreve evidence/<ts>/
make e2e-cliente   # só a jornada da cliente (stack já de pé)
make e2e-down      # derruba
```

- `fixtures/gravador.ts` grava rede e console em `evidence/<ts>/captura/*.ndjson`;
- `scripts/e2e-evidencia.sh` transforma isso em `resumo.md` (≤60 linhas);
- o contrato completo (artefatos, allowlist, ciclo) está no
  [doc 20](../docs/real-valor/20-testes-ponta-a-ponta.md);
- as regras de escrita para esta pasta estão em
  [`.clinerules/06-e2e-e-jornadas.md`](../.clinerules/06-e2e-e-jornadas.md).

A jornada da cliente **para no pagamento** de propósito: a loja filtra o
`pp_system_default` (que "paga" sem cobrar), então fechar pedido sem provedor
real seria mentira. O fechamento é do `test:api` (pendência B do roadmap) e o `e2e:mp` cobre o
PIX em modo teste.

