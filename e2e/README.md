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
- `scripts/e2e-evidence.sh` transforma isso em `resumo.md` (≤60 linhas);
- o contrato completo (artefatos, allowlist, ciclo) está no
  [doc 20](../docs/real-valor/20-testes-ponta-a-ponta.md);
- as regras de escrita para esta pasta estão em
  [`.clinerules/06-e2e-e-jornadas.md`](../.clinerules/06-e2e-e-jornadas.md).
- **rode a jornada sozinha.** Medido em 23/11/2026: 18 rodadas com `make ready`/
  jest em paralelo deram ~1 falha a cada 3 (timeout de 45s no primeiro passo que
  espera render); as 3 rodadas seguintes, com a máquina ociosa, passaram em
  32,4s · 26,2s · 28,4s. O `next dev` compila sob demanda e o orçamento do teste
  é disputado com o resto — a falha aparece em **passo diferente** a cada
  variante de instrumento, que é a assinatura de falta de CPU, não de seletor.

A jornada da cliente **para no pagamento** de propósito: a loja filtra o
`pp_system_default` (que "paga" sem cobrar), então fechar pedido sem provedor
real seria mentira. O fechamento é do `test:api` (pendência B do roadmap) e o `e2e:mp` cobre o
PIX em modo teste.

