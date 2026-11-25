---
id: RV-071
titulo: Jornada de descoberta e avaliação da cliente
persona: cliente
prioridade: ALTA
origem: docs/real-valor/04-requisitos-funcionais.md
estado: rascunho
---

## História

Como cliente da loja, quero encontrar a peça pela vitrine, filtrar, buscar e
avaliá-la na página de produto — para que essas decisões de compra sejam
provadas no navegador, e não só em teste de unidade.

## Regras de negócio

- Uma jornada por spec, em `e2e/jornadas/<jornada>.spec.ts` (doc 20 §20.3).
- Seletor é `getByTestId`/`getByRole`/`getByLabel`; nunca estrutura de DOM.
- `waitForTimeout` é proibido: a espera é a asserção com auto-retry.
- Roda no stack isolado `rv_e2e`, nunca na base de dev.
- Asserção não se enfraquece: se falta seletor, ele é acrescentado no componente.
- Faceta que a instância de teste não oferece vira `test.skip` com motivo, nunca `expect` mais frouxo.

## Critérios de aceite

- **CA-1** — When a cliente aplica um filtro no catálogo, the storefront shall refletir o recorte na contagem de peças e mantê-lo ao fechar a gaveta.
  prova: `jornada:vitrine@o filtro muda a contagem e sobrevive ao fechar a gaveta`
- **CA-2** — When a cliente busca um termo sem resultado, the storefront shall mostrar o estado vazio da busca em vez de lista muda.
  prova: `jornada:vitrine@busca sem resultado mostra o estado vazio`
- **CA-3** — When a cliente troca o tamanho na página de produto, the storefront shall refletir a variante escolhida na URL e manter a compra liberada, sem nunca deixar a sacola ganhar item antes do clique.
  prova: `jornada:produto@trocar o tamanho reflete a variante na URL`
- **CA-4** — When a cliente informa o CEP na página de produto, the storefront shall cotar o frete quando o CEP serve e avisar quando não serve.
  prova: `jornada:produto@CEP válido cota e CEP inválido avisa`

## Não-objetivos

- Fechar o pagamento (depende de provedor real; é do `e2e:mp`, fora do escopo do doc 20 §20.7).
- Cotar frete no navegador — a cotação é do backend.
