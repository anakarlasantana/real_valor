---
id: RV-006
titulo: Frete automático e plugável
persona: cliente
prioridade: ALTA
origem: docs/real-valor/04-requisitos-funcionais.md#rv-006
estado: aprovado
retroativo: true
aprovado_por: Ana Karla Santana
aprovado_conta: t-ana.santana@cni.com.br
aprovado_em: 2026-11-18T00:00:00-03:00
aprovado_sha: b0f93169097aaff457a9276519a6a2c66120a669b93f32fd70d872852775a93a
---

## História

Como cliente, quero ver o frete calculado pelo provedor plugado — com preço e
prazo reais para o meu CEP e o peso do meu pedido — e, como lojista, quero
trocar de transportadora sem tocar em carrinho, checkout ou painel.

## Regras de negócio

- O preço do frete vem do provedor; o storefront não calcula nada.
- A modularidade do frete vive **só no backend** (`AbstractFulfillmentProviderService`).
- Preço em reais (decimal), nunca centavos na borda do Medusa.
- Sem cotação válida, a opção sai da lista — jamais aparece por R$ 0,00.

## Critérios de aceite

- **CA-1** — `tabela-nacional` aparece na lista do Admin quando o provider está registrado.
  prova: `unit:backend/src/modules/fulfillment/tabela/__tests__/registro.unit.spec.ts`
- **CA-2** — Criada a opção com `price_type: "calculated"`, o preço no checkout muda com o **peso** e o **CEP**.
  prova: `unit:backend/src/modules/fulfillment/superfrete/__tests__/cotacao.unit.spec.ts`
- **CA-3** — CEP inválido não mostra preço 0 — a opção sai da lista.
  prova: `unit:backend/src/modules/fulfillment/tabela/__tests__/tabela.unit.spec.ts`
- **CA-4** — Peso acima de 20kg não calcula.
  prova: `unit:backend/src/modules/fulfillment/tabela/__tests__/tabela.unit.spec.ts`
- **CA-5** — Nenhum valor em centavos onde se espera reais: `calculated_amount` sai em decimal.
  prova: `unit:backend/src/modules/fulfillment/__tests__/dinheiro.unit.spec.ts`
- **CA-6** — A tabela não tem buraco: todo par (região, faixa) tem número.
  prova: `unit:backend/src/modules/fulfillment/tabela/__tests__/tabela.unit.spec.ts`
- **CA-7** — Trocar de transportadora **não altera** carrinho, checkout, painel de envio nem `/rastreio`.
  prova: `jornada:cliente@checkout · entrega cota e aceita a opção`

## Não-objetivos

- Escolher transportadora por regra de negócio na loja (não existe hoje).
- Cotação no navegador (o storefront só consome a opção do Medusa).
