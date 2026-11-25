---
id: RV-074
titulo: Responsividade das jornadas do cliente
persona: cliente
prioridade: ALTA
origem: docs/real-valor/05-requisitos-nao-funcionais.md
estado: rascunho
---

## História

Como cliente no celular, quero usar a loja inteira sem rolagem horizontal, sem
controle pequeno demais e com o menu e os filtros ao alcance do dedo — para que
o fluxo provado no desktop também valha no aparelho que a maioria usa.

## Regras de negócio

- Uma jornada por spec, em `e2e/jornadas/<jornada>.spec.ts` (doc 20 §20.3).
- O divisor mobile/desktop é `small: 1024px` (`tailwind.config.js:74`): abaixo disso vale o layout de toque.
- Seletor é `getByTestId`/`getByRole`; nunca estrutura de DOM.
- Alvo de toque mínimo 44×44 px (WCAG 2.5.5, doc 05 §5.1.4).
- Chrome e Safari iOS são os alvos prioritários (doc 05 §5.6).
- Asserção não se enfraquece: se a tela não tem o estado, o critério é reescrito para o que ela faz.

## Critérios de aceite

- **CA-1** — When a cliente abre uma rota da loja no celular, the storefront shall não produzir rolagem horizontal.
  prova: `jornada:responsividade@nenhuma rota rola na horizontal no celular`
- **CA-2** — When a cliente abre o menu no celular, the storefront shall abrir a gaveta de navegação e fechá-la pelo botão próprio.
  prova: `jornada:responsividade@o menu abre e fecha no celular`
- **CA-3** — When a cliente abre os filtros no catálogo no celular, the storefront shall oferecer a gaveta de filtros, que no desktop não existe.
  prova: `jornada:responsividade@o filtro é gaveta no celular e painel no desktop`
- **CA-4** — When a cliente toca os controles da compra no celular, the storefront shall manter a área de toque de pelo menos 44 px.
  prova: `jornada:responsividade@os controles da compra têm área de toque`

## Não-objetivos

- Repetir as jornadas de negócio no celular: elas já rodam; aqui se prova o **layout**, não a regra.
- Testes de contraste e leitor de tela (são de acessibilidade, não de responsividade).

