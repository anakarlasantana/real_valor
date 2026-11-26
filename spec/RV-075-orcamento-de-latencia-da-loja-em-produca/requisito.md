---
id: RV-075
titulo: Orçamento de latência da loja em produção
persona: cliente
prioridade: ALTA
origem: docs/real-valor/05-requisitos-nao-funcionais.md
estado: rascunho
---

## História

Como cliente, quero que a loja abra e responda dentro do orçamento do doc 05 §5.3
— para que regressão de performance seja medida e reprovada, e não descoberta
depois da inauguração.

## Regras de negócio

- **Só mede em produção.** O stack de dev roda `next dev` (`target: dev`,
  `yarn dev`): ali o número inclui recompilação sob demanda e não é o da loja.
  A medição usa o overlay `docker-compose.perf.yml` (`target: runner`), em
  projeto próprio (`rv_perf`), com portas próprias.
- O orçamento é versionado em `e2e/perf-budget.json`, não escrito no teste.
- A folga de 20% existe para a medição não virar flake de máquina: o que se
  reprova é a regressão de verdade, não a variação de 1ms.
- Uma amostra só não prova nada: p95 de várias requisições.
- Asserção não se enfraquece: se o orçamento estoura, o produto regrediu.

## Critérios de aceite

- **CA-1** — When a cliente carrega home e PDP, the loja shall registrar LCP, INP e CLS dentro do orçamento do doc 05 §5.3.1.
  prova: `jornada:performance@home e PDP cabem no orçamento de vitals`
- **CA-2** — When a cliente recebe a home, the storefront shall enviar menos de 200 kB de JavaScript comprimido.
  prova: `jornada:performance@o JavaScript inicial cabe no orçamento`
- **CA-3** — When a loja responde as rotas de catálogo e carrinho, the API shall manter o p95 abaixo do orçamento.
  prova: `jornada:performance@o p95 das rotas de API cabe no orçamento`
- **CA-4** — When a medição roda fora do stack de produção, the jornada shall recusar-se a rodar em vez de reportar número inválido.
  prova: `jornada:performance@a jornada recusa medir fora de produção`

## Não-objetivos

- Otimizar a loja: esta spec **mede**; corrigir é outra entrega.
- Medir no celular real (o `PROD=1` no CI rode em container; o device é emulado).

