# 01 — Auditoria do Projeto Real Valor

**Escopo:** inspeção do código-fonte do monorepo em `/home/sn-387116/Documents/real_valor`.
**Data:** 10/02/2026 · **Branch:** `develop` · **Commit:** `a3a8bf4936`
**Método:** leitura do código, sem suposições. Todo achado aponta para arquivo e linha.
**Classificação** (seção 15 do briefing): `implementado` · `parcialmente implementado` ·
`mockado` · `não implementado` · `quebrado` · `desconhecido`.

---

## 1.1 Veredito em uma página

Este projeto **não é um template genérico do Medusa com customização superficial**. É um monorepo
arquitetado com disciplina rigorosa, e isso muda a leitura da auditoria: a maior parte do que um
e-commerce médio precisa **já existe e está pronta**.

O que impede a venda hoje **não é a vitrine** — é a ausência de provedor de pagamento.

| Dimensão | Estado | Nota |
| :--- | :--- | :--- |
| Arquitetura | Sólida | Monorepo com contrato compartilhado entre os 3 runtimes |
| Vitrine (home) | **Avançada** | Home 100% dirigida por CMS, 10 tipos de seção |
| Design system | **Sólido** | 1125 linhas de `brand.css`, tokens derivados da marca |
| Catálogo | **Parcial** | Listagem e ordenação prontas; **sem filtros e sem busca** |
| Página de produto | **Boa** | Galeria, variantes, estoque, relacionados |
| Carrinho | **Pronto** | Itens, quantidades, cupom, frete |
| Checkout | **Quebrado para venda** | UI completa, **mas nenhum provedor de pagamento registrado** |
| Backend | Sólido | Medusa v2, seed idempotente, módulo de conteúdo próprio |
| CMS | **Sólido** | Painel em `/painel` edita vitrine e tema sem deploy |
| Testes | **Forte** | 310 testes (210 backend + 81 storefront + 19 CRM) com CI |
| i18n / pt-BR | **Falha** | Interface com textos em inglês |
| SEO | **Falha** | Sem sitemap, robots ou dados estruturados |

**O bloqueio crítico:** `backend/medusa-config.ts` (linhas 124–178) registra apenas o módulo
`file` e o módulo local `content`. **Nenhum provedor de pagamento está registrado.** O `seed.ts`
linha 183 cria a região com `payment_providers: ["pp_system_default"]` — provedor manual, útil
para teste de fluxo mas que não processa dinheiro. **A loja não pode receber pagamento hoje.**

---

## 1.2 Arquitetura do monorepo

```
real_valor/
├── packages/contrato/           @rv/contrato — contrato de conteúdo
├── backend/                     Medusa v2 (Store API + Admin) — porta 9000
├── frontend/                    Next.js 15 App Router — porta 8000
├── admin/                       extensão do Admin do Medusa → CRM em /painel
├── scripts/                     6 utilitários (fronteiras, geração, fontes, diagnóstico)
├── docker-compose.yml           base única (PROD)
├── docker-compose.override.yml  overlay de DEV
└── Makefile                     atalhos
```

**Decisão estrutural relevante:** a raiz é um **workspace Yarn único** (`yarn@4.12.0`, um só
`yarn.lock`, um só `node_modules`). O `node_modules` de cada app guarda apenas o que diverge —
é assim que o React 19.0.5 do storefront convive com o 18.3.1 do Medusa.

### O contrato compartilhado (`packages/contrato/`)

O elemento mais importante do projeto para esta auditoria. `packages/contrato/src/` expõe
`contract.ts`, `defaults.ts`, `schema.ts` e `index.ts`, consumidos **pelos três runtimes**:

| Runtime | Como importa | Para quê |
| :--- | :--- | :--- |
| Backend | `@rv/contrato` | valida o conteúdo gravado; monta o schema do CMS |
| CRM (`admin/`) | alias `@conteudo/*` (só `import type`) | desenha o formulário a partir do schema |
| Storefront | `@rv/contrato` | tipa as seções e valida o que chega do CMS |

**Consequência prática:** o formulário do painel, o schema do banco e a tipagem do storefront
**não podem divergir** — a fronteira passou a ser garantida pelo compilador, não por uma guarda
de texto. Essa é a evolução do padrão que o briefing pede para o restante do sistema.

> **Dica para quem implementa:** o histórico do repositório registra que a "guarda de paridade"
> (114 asserções comparando arquivos por texto) foi **deletada de propósito** quando os testes
> assumiram esse papel. Não reintroduza espelhos por texto: eles envelhecem sem ninguém perceber.
> É a mesma razão pela qual os adaptadores de pagamento não devem ser validados por comparação
> de string.

## 1.3 Inventário por área

### Home — `implementado`

**Arquivo-chave:** `frontend/src/app/[countryCode]/(main)/page.tsx` (198 linhas)

A home **não tem JSX hardcoded**. Recebe uma lista ordenada de seções tipadas e mapeia cada uma
para um componente num `switch` exaustivo com `assertNever` (linha 183) — se um tipo novo entrar
no contrato sem tratamento, o build quebra em vez de a página quebrar em produção.

**10 tipos de seção**, todos em `packages/contrato/src/defaults.ts`:

| id | tipo | componente | Uso de comércio |
| :--- | :--- | :--- | :--- |
| `announcement` | `announcement` | `announcement-bar` | chrome (todas as rotas) |
| `nav` | `nav` | `layout/templates/nav` | chrome |
| `hero` | `hero` | `home/components/hero` | carrossel de capas |
| `benefits` | `benefits` | `benefits-bar` | faixa de benefícios |
| `lancamentos` | `launches` | `launches-rail` | trilho de novidades |
| `collections` | `collections` | `collection-highlights` | coleções |
| `featured` | `featured` | `featured-products` | produtos com filtro por categoria |
| `editorial` | `editorial` | `editorial-banner` | institucional |
| `instagram` | `instagram` | `instagram-grid` | social |
| `footer` | `footer` | `layout/templates/footer` | chrome |

**Mecanismos notáveis:**
- **Âncoras:** o `id` da seção no CMS **é** a âncora de scroll do menu (`page.tsx:108-116`).
  Cada seção é embrulhada em `<div id={section.id} className="rv-anchor rv-section">`.
- **Aparência por seção:** `appearanceVars(section)` injeta CSS variables inline, lidas pelas
  classes `.rv-section-*` do `brand.css`.
- **Degradação graciosa:** sem região, `launches` e `featured` somem e a home continua de pé.
- **ISR:** `revalidate = 60`, com tag `content` e purge por `POST /api/revalidate`.
- **Tolerância a tipo desconhecido:** `lib/data/supported-sections.ts` descarta seções cujo tipo
  a loja não conhece, com log no servidor — impede que um schema novo gravado sem deploy derrube
  a home.

### Header e footer — `implementado`

`frontend/src/modules/layout/templates/nav/index.tsx` (116 linhas)
`frontend/src/modules/layout/templates/footer/index.tsx` (116 linhas)

- Grid `1fr auto 1fr`: marca à esquerda, links centralizados, ações à direita.
- Menu, rótulos, ordem e visibilidade vêm do CMS (bloco `nav`).
- Wordmark em texto com `tracking-[0.28em]`, com comentário explícito no código (linha 48):
  *"substituído quando o logo vetorial oficial estiver disponível"*.
- Carrinho é a única ação com estado → vai por `CartButton` dentro de `Suspense`.
- `sticky top-0 z-50` com altura fixa `h-20`.
- `side-menu` é o drawer mobile.

### Catálogo — `parcialmente implementado`

**Arquivos:** `categories/[...category]/page.tsx`, `collections/[handle]/page.tsx`,
`store/page.tsx`, `modules/store/templates/index.tsx`, `paginated-products.tsx`

**Existe e funciona:**
- Listagem em grade `grid-cols-2 small:grid-cols-3 medium:grid-cols-4`, 12 itens por página.
- Paginação real (`modules/store/components/pagination`).
- Ordenação por 3 critérios — `created_at`, `price_asc`, `price_desc`.
- `Suspense` com `SkeletonProductGrid` durante o carregamento.
- `revalidate = 3600` e ausência deliberada de `generateStaticParams` (explicado no código,
  linhas 34–45: o build não pode depender do backend no ar).

**Falta (verificado):**
- **Nenhum filtro.** `refinement-list/index.tsx:36` renderiza **apenas** `<SortProducts>`. O
  componente tem 41 linhas e recebe só `sortBy` — não há faceta de cor, tamanho, preço nem
  disponibilidade. A referência tem as quatro.
- **Nenhuma busca.** Não existe componente de busca em `modules/layout/` nem rota de busca.
  A única ocorrência de "search" no código é `searchParams` do Next.
- Ordenação em inglês ("Latest Arrivals", "Price: Low -> High", "Sort by").

### Página de produto — `implementado`

**Arquivos:** `products/[handle]/page.tsx`, `modules/products/templates/index.tsx` e
`components/` (12 arquivos)

**Existe e funciona:**
- Galeria com thumbnails (`image-gallery`, `thumbnail`).
- Seleção de variantes via `product-actions` + `option-select`; a variante mora na URL (`?v_id=`),
  então o produto é compartilhável com a escolha feita.
- **Estoque** com regra única em `lib/util/product-availability.ts` — a mesma função decide o chip
  do card e o botão de compra. Comentário no código (linhas 97–102) registra que duplicar essa
  regra fez o card "prometer o que o botão recusa"; está unificada de propósito.
- Preço com comparação de variante (`product-price`, `product-preview/price`).
- Descrição em acordeão (`product-tabs/accordion`).
- Relacionados (`related-products`).
- **Ações mobile fixas** (`mobile-actions`) quando o bloco sai da viewport — usa `useIntersection`.
- Skeletons dedicados para produto, relacionados e card.

**Falta:** guia de medidas, cálculo de frete na PDP, badge de desconto em %, exibição de
parcelamento e Pix, indicador de zoom na galeria.

### Carrinho — `implementado`

**Arquivos:** `cart/page.tsx` (21 linhas) + `modules/cart/` (7 arquivos) +
`lib/data/cart.ts` (473 linhas)

- Itens com quantidade editável (`cart-item-select`), remoção, subtotal, cupom
  (`discount-code`), total.
- Frete calculado por opção de envio.
- `cart-mismatch-banner` para divergência entre carrinho e item salvo.
- `free-shipping-price-nudge` — aviso de frete grátis.
- Estado vazio (`empty-cart-message`).
- Persistência por cookie (`lib/data/cookies.ts`) com tag de revalidação.

### Checkout — `quebrado para venda`

**Arquivos:** `checkout/page.tsx` (30 linhas) + `modules/checkout/` (20 arquivos)

**Existe e funciona:**
- Formulário completo: endereço de entrega, cobrança, seleção de envio, pagamento, resumo.
- **Stripe** integrado de ponta a ponta (`payment-wrapper`, `stripe-wrapper`, `payment-container`,
  `payment-button`).
- Tratamento de erro (`error-message`) e botão com estado de carregamento (`submit-button`).
- Fluxo de pedido confirmado (`order/[id]/confirmed`) com rastreio.

**Por que está quebrado para venda:**

`backend/medusa-config.ts`, linhas 124–178, registra **apenas**:

```ts
modules: [
  { resolve: "@medusajs/medusa/file", … },   // armazenamento
  { resolve: "./src/modules/content", … },    // CMS
]
```

**Nenhum provedor de pagamento.** E `seed.ts:183` cria a região com
`payment_providers: ["pp_system_default"]` — provedor manual, que não processa.

Resultado: o checkout renderiza, o formulário valida, mas **a finalização do pagamento não
acontece**. O pacote `@medusajs/payment-stripe` está instalado no workspace e o frontend está
pronto para ele — **falta apenas registrá-lo**.

**Acoplamento a corrigir:** o registro em `frontend/src/lib/constants.tsx` é
`paymentInfoMap` + funções `isStripeLike()`, `isPaypal()`, `isManual()`. O
`payment-button/index.tsx:30` faz `switch` por tipo de provedor. Funciona, mas **cresce a cada
provedor** — é exatamente o oposto de modular. Ver `08-arquitetura-e-integracoes.md`, seção 4.

### Backend — `implementado`

- Medusa 2.18.0, PostgreSQL, Redis, módulo local `content`.
- `seed.ts` **idempotente**: verifica região e tax region antes de criar (linhas 160–202).
- Rotas customizadas: `GET /store/content`, `GET/POST /api/admin/content`,
  `GET /api/admin/content/order`, `GET /api/admin/content/restore`, `GET /store/custom/checkout-info`,
  `GET /store/orders/track`.
- `links/content-section-category.ts` e `links/content-section-product.ts` — seções relacionadas
  a categorias/produtos (base para os chips do `featured`, schema v5).
- `subscribers/order-customer-indexer.ts` — indexa pedido na conta do cliente.
- Upload de arquivo com provider local e volume Docker dedicado (`real_valor_uploads`).
- 5 migrações do módulo `content`.

### CMS (`admin/`) — `implementado`

- Página **Conteúdo da vitrine** em `/painel`, com duas superfícies (vitrine e tema).
- Editor de imagens com upload (`image-input.tsx`).
- Editor de paleta e fontes (`appearance-controls.tsx`) com prévia usando as fontes reais.
- 3 testes unitários com 19 asserções.

### Fontes — `implementado`

`frontend/src/app/fonts/` com Montserrat, Playfair Display e Allura, todas `.woff2` self-hosted
consumidas por `next/font/local`. Sem requisição ao Google no build. Regeneráveis por
`node scripts/vendor-fonts.mjs`.

### Testes e CI — `forte`

| Runner | Suítes | Testes | Comando |
| :--- | :--- | :--- | :--- |
| Backend (jest) | 12 | 210 | `make test` |
| Storefront (vitest) | 7 arquivos | 81 | `make test` |
| CRM (jest próprio) | 2 | 19 | `make test` |

`.github/workflows/check.yml` — um job por dependência: contrato, tipos, testes, registro do
schema (Postgres efêmero) e build do storefront **sem infra**.

---

## 1.4 Classificação consolidada

| Área | Status | Onde | Observação |
| :--- | :--- | :--- | :--- |
| Home / seções CMS | `implementado` | `(main)/page.tsx` | 10 tipos, switch exaustivo |
| Header | `implementado` | `layout/templates/nav` | conteúdo via CMS |
| Footer | `implementado` | `layout/templates/footer` | conteúdo via CMS |
| Design system | `implementado` | `styles/brand.css` | 1125 linhas |
| Tema sazonal | `implementado` | `lib/theme.ts` | swap por CSS vars |
| Listagem de produtos | `implementado` | `store/templates` | grade + paginação |
| Ordenação | `implementado` | `sort-products` | 3 critérios |
| **Filtros** | `não implementado` | `refinement-list` | só ordenação |
| **Busca** | `não implementado` | — | não existe |
| PDP — galeria | `implementado` | `image-gallery` | — |
| PDP — variantes | `implementado` | `product-actions` | via URL |
| PDP — estoque | `implementado` | `product-availability` | regra única |
| PDP — guia de medidas | `não implementado` | — | — |
| PDP — frete na página | `não implementado` | — | — |
| PDP — parcelamento/Pix | `não implementado` | — | — |
| Carrinho | `implementado` | `modules/cart` | completo |
| Cupom | `implementado` | `discount-code` | — |
| Frete (opções) | `parcialmente implementado` | `seed.ts` | manual seedado |
| **Checkout — UI** | `implementado` | `modules/checkout` | 20 arquivos |
| **Checkout — pagamento** | `quebrado` | `medusa-config.ts` | **sem provedor** |
| Frete via transportadora | `não implementado` | — | a definir |
| Conta do cliente | `parcialmente implementado` | `modules/account` | sem troca de senha |
| CMS / vitrine | `implementado` | `admin/…/routes/content` | — |
| SEO — metadata | `parcialmente implementado` | páginas | vaza "Medusa Store" |
| **SEO — sitemap/robots** | `não implementado` | — | não existe |
| **SEO — dados estruturados** | `não implementado` | — | não existe |
| **i18n pt-BR** | `quebrado` | vários | textos em inglês |
| Acessibilidade | `parcialmente implementado` | — | contraste documentado |
| **Documentação** | `quebrado` | `docs/` | vazio, README cita 6 arquivos |
| Armazenamento de imagem | `parcialmente implementado` | `medusa-config.ts` | local, sem CDN |
| Testes | `implementado` | 3 runners | 310 testes |
| Docker / operação | `implementado` | Compose + Makefile | 1 arquivo base |

## 1.5 Problemas técnicos encontrados

Formato: **Problema → Impacto → Recomendação**

### P1. Nenhum provedor de pagamento registrado
`backend/medusa-config.ts:124-178`
**Impacto:** bloqueia toda a venda; a loja não recebe dinheiro.
**Recomendação:** registrar `@medusajs/payment-stripe` imediatamente como stop-gap e, em paralelo,
construir a camada de abstração (Fase 0) para o Mercado Pago.

### P2. Metadados de SEO vazam a marca do template
`products/[handle]/page.tsx:68,71` · `categories/[...category]/page.tsx:39,44` ·
`collections/[handle]/page.tsx:42` usam `` `${title} | Medusa Store` ``.
**Impacto:** o título exibido no Google é "Camisa Feminina… | Medusa Store"; a descrição da PDP é
literalmente o título repetido (`description: ${product.title}`). Sinal de template inacabado, e
o primeiro item que prejudica indexação e clique.
**Recomendação:** usar o template `%s | Real Valor` já definido em `app/layout.tsx:48` e escrever
descrições reais.

### P3. Interface com textos em inglês
`product-actions/index.tsx:176-179` ("Select variant", "Out of stock", "Add to cart") ·
`sort-products/index.tsx` ("Sort by", "Latest Arrivals", "Price: Low -> High") ·
`cart/page.tsx:8` ("Cart"/"View your cart") · `checkout/page.tsx:10` ("Checkout") ·
metadados de conta ("Sign in", "Orders", "Addresses", "Profile").
**Impacto:** loja brasileira com interface em inglês destrói confiança no checkout — o ponto de
maior risco na conversão.
**Recomendação:** **`ALTA` prioridade na Fase 1.** Não é cosmético; é receita.

### P4. `docs/` vazio com o README apontando para 6 arquivos inexistentes
Removidos no commit `6c7feef6e7`. `README.md:290-291` ainda referencia `docs/DEBITO-TECNICO.md` e
`docs/plano-centralizacao.md`.
**Impacto:** informação perdida (o registro de débito técnico tinha 4 assuntos com evidência e
impacto) e documentação quebrada.
**Recomendação:** o histórico Git preserva o conteúdo — recuperável. Enquanto isso, este conjunto de
documentos substitui o mapa. Ver `10-roadmap.md`.

### P5. Nenhuma faceta de filtro no catálogo
`refinement-list/index.tsx:36`
**Impacto:** catálogo de moda com 15+ categorias fica navegável só por hierarquia; a cliente que
procura "vestido preto P" não tem caminho. Alto impacto em conversão e em SEO de cauda longa.
**Recomendação:** implementar via query string, reaproveitando o padrão de `sortBy`.

### P6. Sem busca
**Impacto:** perda de quem já sabe o que quer — e de todo o tráfego de busca orgânica.
**Recomendação:** decidir entre a Store API (`q`) ou o índice do Medusa; manter atrás de um
componente único para trocar de fonte depois.

### P7. Registro de pagamento acoplado ao Stripe
`lib/constants.tsx` + `payment-button/index.tsx:30`
**Impacto:** cada provedor novo acrescenta um `if`. Em 3 provedores o arquivo vira um `switch`
frágil, e o teste de cada caminho novo é manual.
**Recomendação:** `PaymentAdapter` + `registry` + `resolvePayment()`. Ver
`08-arquitetura-e-integracoes.md`.

### P8. Armazenamento de imagem local
`medusa-config.ts:152-167` → `@medusajs/file-local` com volume `real_valor_uploads`.
**Impacto:** sem CDN; upload servido pelo backend; volume único = ponto de falha. Para inauguração
com catálogo real, fotos grandes pesam no carregamento.
**Mitigação já preparada:** o valor gravado no banco é a **chave** do arquivo, não a URL
(comentário nas linhas 145–149), então migrar para S3 não exige migração de conteúdo — é trocar o
provider. `@medusajs/file-s3` já está no workspace.
**Recomendação:** manter local até a inauguração; planejar S3 para a Fase 3.

### P9. `checkout-info` e `track` como APIs customizadas
`backend/src/api/store/custom/checkout-info/route.ts`, `orders/track/route.ts`
**Status:** `desconhecido` quanto ao uso real no storefront — existem no backend; **não localizei
consumo no frontend**. Confirmar antes de remover.

### P10. Dependências divergentes entre os três runtimes
React 19.0.5 (frontend) vs 18.3.1 (backend/admin).
**Impacto:** já é deliberado e documentado (o alias do `admin/tsconfig.json` resolve), mas é a
maior fragilidade do build: um `npm install` dentro de `backend/` quebraria a coexistência.
**Recomendação:** manter a regra do workspace (o README já a documenta); não há ação nova.

---

## 1.6 Duplicação e dívida estrutural

| Item | Onde | Avaliação |
| :--- | :--- | :--- |
| Escala de espaçamento repetida | 6 arquivos → `--rv-section-space` | **Já resolvida** |
| Regra de disponibilidade | card e PDP → `product-availability.ts` | **Já resolvida** |
| Fallback de fonte ×3 | contrato / `theme.json` / `brand.css` | **Já resolvida** (testado) |
| Espelho do limite do trilho e da velocidade da barra | `launchesLimit`, ticker | **Já resolvida** (teste por valor) |
| `assertNever` só na home | outras listas de tipos não têm | oportunidade: aplicar aos adaptadores |
| Espelhamento de tipo por string | `provider_id` en `constants.tsx` | resolver com o registry |

**Conclusão sobre duplicação:** o projeto já pagou essa dívida. Os dois últimos pontos são os únicos
em crescimento, e ambos estão tratados na Fase 0.

---

## 1.7 Incertezas registradas (seção 15 do briefing)

Registradas em vez de assumidas:

1. **`/store/custom/checkout-info` e `/store/orders/track` são consumidos?** Não localizei chamada no
   frontend. Podem ser usados por integração externa ou ser código morto. **Confirmar antes de remover.**
2. **A galeria do catálogo tem uma imagem por produto.** O `product-preview` (linhas 40–41) já trata a
   segunda foto no hover, mas o comentário registra que "o catálogo hoje tem uma imagem por produto
   (medido na Store API)". Confirmar com o catálogo real.
3. **Quantidade de imagens por produto não está definida.** A PDP depende disso para o layout da
   galeria. Definir com o time comercial.
4. **Tamanho do catálogo real.** Afeta paginação (hoje 12/página) e a estratégia de cache.
5. **Região e configuração fiscal** não aparecem na auditoria. Necessário antes de emitir nota
   fiscal em produção.
6. **O guia de medidas exige dado por produto** (tabela de medidas por peça). Não há estrutura de
   dados para isso hoje — é decisão de modelagem, não só de UI.
7. **`theme.json` em `frontend/themes/`** tem 4 temas (`default`, `black-friday`, `natal`, `verao`).
   Não auditamos se os quatro têm conteúdo válido além do `default`.

---

## 1.8 Conclusão da auditoria

O projeto tem **fundação sólida e acima da média**: arquitetura modular real, contrato compartilhado,
CMS funcional, design system derivado da marca, testes com CI e operação documentada. O que falta
está concentrado em três frentes: **venda** (provedor de pagamento), **descoberta de produto**
(filtros e busca) e **polimento de produção** (idioma, SEO, acessibilidade).

**A boa notícia para o prazo:** nenhuma dessas frentes exige refatoração estrutural. São camadas
novas sobre uma base que já aceita extensões — a prova é o próprio módulo de conteúdo, que foi
adicionado sem reescrever a home.

Ver `03-gap-analysis.md` para o comparativo priorizado.