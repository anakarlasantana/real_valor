---
id: RV-073
titulo: Jornada de checkout e pós-venda da cliente
persona: cliente
prioridade: ALTA
origem: docs/real-valor/04-requisitos-funcionais.md#rv-063
estado: rascunho
---

## História

Como cliente, quero fechar o pedido e depois acompanhá-lo sem login — para que o
dinheiro e o pós-venda tenham prova de navegador, e não só de unidade.

## Regras de negócio

- Uma jornada por spec, em `e2e/jornadas/<jornada>.spec.ts` (doc 20 §20.3).
- Seletor é `getByTestId`/`getByRole`/`getByLabel`; nunca estrutura de DOM.
- `waitForTimeout` é proibido: a espera é a asserção com auto-retry.
- A jornada **não simula pagamento aprovado**: fechar pedido exige provedor real (`e2e:mp`, fora do escopo do doc 20 §20.7). O que se prova é até a fronteira da sessão de pagamento.
- O rastreio consulta um pedido **real** do fixture (`metadata.e2e_pedido`), não um inventado.
- Asserção não se enfraquece: se a tela não tem o estado, o critério é reescrito para o que ela faz.

## Critérios de aceite

- **CA-1** — When a cliente preenche o endereço e escolhe a entrega, the storefront shall oferecer no pagamento exatamente os meios reais da loja, sem o meio manual.
  prova: `jornada:checkout@só os meios reais de pagamento aparecem`
- **CA-2** — When a cliente chega à revisão, the storefront shall mostrar o resumo com endereço, entrega e total antes do botão de pagar.
  prova: `jornada:checkout@a revisão mostra endereço, entrega e total`
- **CA-3** — When a cliente consulta um pedido real com o CPF da compra, the storefront shall responder com o estado que o pedido tem: os itens quando há rastreio, ou "Pedido recebido" quando a transportadora ainda não foi registrada.
  prova: `jornada:pos-venda@consultar um pedido real mostra situação e itens`
- **CA-4** — When a cliente informa um CPF que não é do pedido, the storefront shall recusar sem revelar item nem valor.
  prova: `jornada:pos-venda@CPF que não é do pedido não vaza nada`

## Não-objetivos

- Pagamento aprovado (provedor real; `e2e:mp` declarado fora de escopo).
- Notificação de envio por e-mail (RV-045 depende de provedor transacional).

