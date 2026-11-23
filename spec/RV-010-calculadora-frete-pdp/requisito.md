---
id: RV-010
titulo: Calculadora de frete na PDP
persona: cliente
prioridade: MEDIA
origem: docs/real-valor/04-requisitos-funcionais.md#rv-010
estado: rascunho
---

## História

Como cliente, quero saber o frete e o prazo **na página da peça**, antes de
colocar no carrinho — para não descobrir o custo só no fim do checkout.

## Regras de negócio

- O valor vem do backend (`cotarPedido`), nunca do navegador.
- A prévia cota pelo **peso da variante**; sem peso, a caixa padrão responde.
- O CEP consultado fica em cookie e é reaproveitado no checkout.
- Prévia e checkout chamam a mesma função — a regra é uma só.

## Critérios de aceite

- **CA-1** — CEP válido mostra preço e prazo.
  prova: `unit:frontend/src/lib/data/__tests__/frete.unit.spec.ts`
- **CA-2** — CEP inválido mostra mensagem, não quebra.
  prova: `unit:frontend/src/lib/checkout/__tests__/cep-frete.unit.spec.ts`
- **CA-3** — O CEP é reaproveitado no checkout.
  prova: `unit:frontend/src/lib/data/__tests__/cookies-cep.unit.spec.ts`
- **CA-4** — PDP e checkout usam a mesma regra para o mesmo CEP e peso.
  prova: `unit:backend/src/api/store/shipping/quote/__tests__/equivalencia.unit.spec.ts`

## Não-objetivos

- Re-cotar ao trocar de tamanho na mesma visita — débito remanescente no doc 19 §6.2.
- Cotar sem CEP (não há como).
