---
id: RV-072
titulo: Jornada de sacola e conta da cliente
persona: cliente
prioridade: ALTA
origem: docs/real-valor/04-requisitos-funcionais.md#rv-063
estado: rascunho
---

## História

Como cliente, quero guardar a peça na sacola, ajustar a quantidade, tirá-la e
identificar-me na conta — para que o estado que o checkout consome seja provado
no navegador, e não só em teste de unidade.

## Regras de negócio

- Uma jornada por spec, em `e2e/jornadas/<jornada>.spec.ts` (doc 20 §20.3).
- Seletor é `getByTestId`/`getByRole`/`getByLabel`; nunca estrutura de DOM.
- `waitForTimeout` é proibido: a espera é a asserção com auto-retry.
- Interagir só depois da hidratação: o clique antes dela vira no-op silencioso.
- Conta nova a cada execução (e-mail único): registrar o mesmo e-mail duas vezes falha.
- Asserção não se enfraquece: se a tela não tem o estado, o critério é reescrito para o que ela faz.

## Critérios de aceite

- **CA-1** — When a cliente adiciona uma peça e ajusta a quantidade na sacola, the storefront shall refletir a mudança no contador do cabeçalho e no total.
  prova: `jornada:sacola@aumentar e diminuir a quantidade ajusta o total`
- **CA-2** — When a cliente remove o último item, the storefront shall mostrar o estado vazio da sacola em vez de uma lista em branco.
  prova: `jornada:sacola@remover o item devolve o estado vazio`
- **CA-3** — When a cliente se registra com um e-mail novo e sai, the storefront shall mantê-la capaz de entrar de novo com a mesma senha.
  prova: `jornada:conta@registrar, sair e entrar de novo`
- **CA-4** — When a cliente autenticada abre a conta, the storefront shall oferecer endereços e pedidos na navegação, e a lista de pedidos responder sem erro.
  prova: `jornada:conta@a conta oferece endereços e pedidos`

## Não-objetivos

- Cupom de desconto: a stack de teste não tem promoção semeada, e criar uma é fixture, não teste (fica para quando o seed de promoção existir).
- Transferência de pedido entre e-mails (rota `order/[id]/transfer`, baixo valor de negócio agora).

