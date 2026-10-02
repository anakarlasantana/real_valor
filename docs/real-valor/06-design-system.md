# 06 — Design System da Real Valor

**Princípio desta seção:** o design system **já existe e está em uso**. Este documento **não propõe
substituí-lo** — documenta o que existe, registra as lacunas e especifica apenas o que precisa ser
adicionado.

**Fontes de verdade (verificadas no código):**
- Paleta sazonal → `packages/contrato/src/contract.ts` (`THEME_COLOR_HEXES`) → gerada em
  `frontend/src/styles/tokens.generated.css` por `scripts/gen-content.mjs`
- Tokens derivados, semânticos, tipografia, forma e movimento → `frontend/src/styles/brand.css`
  (1125 linhas)
- Aplicação do tema em runtime → `frontend/src/lib/theme.ts` (`themeToCSSVariables`)
- Configuração do Tailwind → `frontend/tailwind.config.js` (188 linhas)

> **Regra do repositório:** `tokens.generated.css` é **gerado** — "NÃO EDITE À MÃO". Alterar a paleta é
> editar o contrato e rodar `node scripts/gen-content.mjs`. O `make check` e o hook de commit
> reprovam o arquivo fora de sincronia.

---

## 6.1 Cores

### 6.1.1 Paleta da marca (6 cores, do brand guide)

| Token | Hex | Nome | Uso |
| :--- | :--- | :--- | :--- |
| `--rv-rose` | `#B97872` | Rosa Queimado | cor assinatura: preenchimentos, bordas, ícones, texto ≥ 24px |
| `--rv-offwhite` | `#F7F1E8` | Off White | fundos |
| `--rv-cacao` | `#4A3531` | Marrom Cacau | apoio, superfícies secundárias |
| `--rv-grafite` | `#303033` | Grafite | corpo de texto |
| `--rv-preto` | `#171717` | Preto | títulos, contraste máximo |
| `--rv-dourado` | `#D4B19A` | Dourado Rosé | detalhes e acentos |

### 6.1.2 Tokens derivados (já definidos em `brand.css`)

| Token | Valor | Função |
| :--- | :--- | :--- |
| `--rv-rose-strong` | `#9e5f58` | hover/ativo sobre rosa; anel de foco |
| `--rv-rose-soft` | `#e3c9c4` | rosa de baixa ênfase |
| `--rv-surface` | `#fdfbf8` | cartão elevado |
| `--rv-border` | `#e5dacd` | divisores hairline |
| `--rv-muted` | `#6f6a66` | texto secundário (AA: ~4,6:1) |

### 6.1.3 Mapeamento semântico

| Token | Referência | Uso |
| :--- | :--- | :--- |
| `--rv-bg` | `--rv-offwhite` | fundo da página |
| `--rv-fg` | `--rv-grafite` | texto do corpo |
| `--rv-fg-strong` | `--rv-preto` | títulos |
| `--rv-primary` | `--rv-rose` | botão primário, links |
| `--rv-primary-fg` | `#ffffff` | texto do botão primário |
| `--rv-accent` | `--rv-dourado` | destaque |
| `--rv-secondary` | `--rv-cacao` | apoio |
| `--rv-focus-ring` | `--rv-rose-strong` | foco de teclado |

### 6.1.4 Cores de estado — **lacuna**

**Não há tokens de estado no `brand.css`.** Os componentes usam cores literais ou cores do
`@medusajs/ui`. Isso é uma inconsistência real: o badge de desconto (RV-011) e o chip de erro do
checkout (RV-002) vão precisar de cores de estado, e sem tokens o resultado será cada componente
inventando a sua.

**Proposta — adicionar ao `brand.css`:**

```css
--rv-success: #4A7C59;   /* verde contido, não saturated — combina com a paleta terrosa */
--rv-success-bg: #EDF3EE;
--rv-warning: #A8752A;
--rv-warning-bg: #FBF3E6;
--rv-danger: #9B3B32;
--rv-danger-bg: #F8ECEA;
--rv-info: #4A3531;      /* reusa o cacau: a paleta não tem um azul */
--rv-info-bg: #F2ECE8;
```

**Justificativa:** `--rv-info` reaproveita o cacau em vez de introduzir azul — um azul quebraria a
paleta terrosa e recairia no clichê de "interface corporativa". Verde e vermelho foram escolhidos
dessaturados para conviver com `--rv-rose` sem competir.

**Critério de aceite:** nenhum componente novo usa cor literal; todo estado usa token.

---

## 6.2 Tipografia

**Três famílias self-hosted** (`frontend/src/app/fonts/`, consumidas por `next/font/local`):

| Papel | Família | Uso |
| :--- | :--- | :--- |
| Display | **Playfair Display** | títulos, destaques, preços |
| Sans | **Montserrat** | corpo, interface, rótulos |
| Script | **Allura** | assinaturas, frases da marca |

**Tokens:** `--rv-font-display`, `--rv-font-sans`, `--rv-font-script`.

**Utilitários já existentes:** `.rv-display`, `.rv-script`, `.rv-eyebrow` (Montserrat
capitalizado com tracking — o padrão dos rótulos da marca).

**Lacuna verificada:** **não há escala tipográfica em tokens.** Os tamanhos estão espalhados em
utilitários Tailwind (`text-lg`, `text-2xl`, `text-3xl`, `text-4xl`, `text-base`, `text-xs`) sem
uma escala nomeada. Isso significa que um novo componente precisa *adivinhar* qual tamanho usar, e
não há como garantir consistência.

**Proposta — escala em tokens no `brand.css`:**

```css
--rv-text-eyebrow: 0.6875rem;  /* 11px — rótulos */
--rv-text-xs:      0.75rem;    /* 12px — apoio, chip */
--rv-text-sm:      0.875rem;   /* 14px — secundário */
--rv-text-base:    1rem;       /* 16px — corpo */
--rv-text-lg:      1.125rem;   /* 18px — preço */
--rv-text-xl:      1.25rem;    /* 20px — subtítulo */
--rv-text-2xl:     1.5rem;     /* 24px — título de seção */
--rv-text-3xl:     1.875rem;   /* 30px — título de página */
--rv-text-4xl:     2.25rem;    /* 36px — hero */
```

**Critério de aceite:** nenhum tamanho de fonte em utilitário solto nos componentes novos.

---

## 6.3 Espaçamento

**Já resolvido e bem feito.** `--rv-section-space` (4rem, 6rem ≥1024px) e
`--rv-section-space-tight` (4rem, 5rem) padronizaram o respiro vertical — nasceu de seis arquivos
com três valores diferentes, e a unifycação **não moveu um pixel**.

**Escala de uso:**

| Contexto | Valor |
| :--- | :--- |
| Respiro entre seções | `--rv-section-space` |
| Respiro entre blocos (trilho estreito) | `--rv-section-space-tight` |
| Gap da grade | `gap-x-6 gap-y-8` (verificado em `paginated-products.tsx:72`) |
| Padding de container | `.content-container` / `.rv-container` |
| Padding de card | `p-4` (16px) |

**Lacuna:** não há escala de espaçamento pontual (dentro de um componente). Um novo componente escolhe
`p-3` ou `p-5` por conta própria.

**Critério de aceite:** componentes novos usam `--rv-section-space` no respiro vertical e a escala
Tailwind padrão no interno — sem valores soltos.

---

## 6.4 Forma, profundidade e movimento

### 6.4.1 Raio (já definido)

| Token | Valor | Uso verificado |
| :--- | :--- | :--- |
| `--rv-radius-sm` | 2px | — |
| `--rv-radius` | 4px | padrão |
| `--rv-radius-lg` | 8px | — |
| `--rv-radius-xl` | 16px | cards maiores, modais |

**Observação de marca:** os raios são **pequenos** — coerente com alfaiataria (mais estruturada e
sóbria, não "macia"). **Manter.**

### 6.4.2 Sombras (já definidas)

| Token | Valor |
| :--- | :--- |
| `--rv-shadow-card` | `0 1px 2px rgba(48,48,51,.04), 0 4px 12px rgba(48,48,51,.06)` |
| `--rv-shadow-card-hover` | `0 2px 4px rgba(48,48,51,.06), 0 12px 28px rgba(48,48,51,.12)` |

Sombras **muito suaves**, coerentes com a paleta clara. **Manter.**

### 6.4.3 Movimento (já definido — e bem pensado)

| Token | Valor | Uso |
| :--- | :--- | :--- |
| `--rv-duration` | 200ms | cores e sombras dos cards |
| `--rv-motion-fast` | 180ms | transições curtas |
| `--rv-motion` | 320ms | entrada em cena |
| `--rv-motion-slow` | 640ms | troca de página do carrossel |
| `--rv-ease-out` | `cubic-bezier(.16,1,.3,1)` | o que chega |
| `--rv-ease-soft` | `cubic-bezier(.4,0,.2,1)` | o que respira (pulso do chip) |

> **Nota de qualidade:** o comentário no `brand.css` registra que **nenhuma escala passa de 640ms**,
> com a justificativa: *"a loja é uma vitrine de roupa, e animação aqui existe para o olho acompanhar
> a troca — não para ser vista."* Isso está alinhado ao briefing, que proíbe excesso de animações.
> **Manter como regra.**

**Lacuna:** não há token para `prefers-reduced-motion`. **Proposta:** adicionar o bloco que desliga
animações para quem pediu no sistema — exigência de acessibilidade que hoje não existe.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Critério de aceite:** com `reduced-motion` ativo, nenhum elemento se desloca por mais de 100ms.

---

## 6.5 Inventário de componentes

### 6.5.1 Componentes genéricos existentes (`modules/common/`) — reutilizar

| Componente | Uso |
| :--- | :--- |
| `input`, `checkbox`, `radio`, `native-select` | formulário |
| `divider` | separadores |
| `modal` | diálogos |
| `cart-totals` | resumo de valores |
| `line-item-price`, `line-item-unit-price`, `line-item-options` | linhas de item |
| `localized-client-link`, `interactive-link` | navegação |
| `delete-button` | remoção |
| `filter-radio-group` | **usado pela ordenação — base dos filtros** |
| `reveal` | entrada em cena |

**Regra do briefing aplicada:** não criar componente novo enquanto um destes resolver.

### 6.5.2 Componentes de domínio (existentes)

| Módulo | Componentes | Estado |
| :--- | :--- | :--- |
| `layout` | nav, footer, cart-button, cart-dropdown, side-menu, cart-mismatch-banner, nav-link, footer-column, social-links, country-select, language-select | ✅ completo |
| `home` | hero, carousel, launches-rail, product-carousel, featured-products, benefits-bar, collection-highlights, editorial-banner, instagram-grid, announcement-bar | ✅ completo |
| `products` | image-gallery, thumbnail, product-actions, mobile-actions, option-select, product-price, product-preview, product-status-chip, product-tabs, accordion, related-products | ✅ completo |
| `store` | pagination, refinement-list, sort-products, paginated-products | ⚠️ **sem filtros** |
| `cart` | templates, items, item, cart-item-select, empty-cart-message, sign-in-prompt, preview, summary | ✅ completo |
| `checkout` | 20 componentes | ⚠️ **incompleto** (sem pagamento real) |
| `account` | overview, order-card, profile, address-book, login | ⚠️ sem troca de senha |
| `order` | order-details, order-summary, payment-details, shipping-details, transfer-actions, help | ✅ completo |
| `skeletons` | 10 componentes | ✅ completo |
| `shipping` | free-shipping-price-nudge | ✅ |

### 6.5.3 Componentes novos necessários

Mapeados para a Fase 1 — **todos propostos, nenhum existe**:

| Componente | Requisito | Onde vive |
| :--- | :--- | :--- |
| `FilterFacet` (cor, tamanho, preço, disponibilidade) | RV-004 | `store/components/refinement-list/facets/` |
| `ActiveFilterChips` | RV-004 | idem |
| `FiltersDrawer` (mobile) | RV-004 | `store/components/refinement-list/` |
| `SearchInput` + `SearchSuggestions` | RV-005 | `modules/search/` |
| `SearchResults` (reaproveita `PaginatedProducts`) | RV-005 | `app/…/busca/page.tsx` |
| `DiscountBadge` | RV-011 | `products/components/` |
| `SizeChips` (informativos) | RV-011 | idem |
| `InstallmentInfo` | RV-008 | `payment/components/` |
| `PixModal` | RV-002 | `payments/adapters/mercadopago/` |
| `SizeGuideLink` + página de guia | RV-009 | `products/components/` + `app/…/guia-de-medidas/` |
| `ShippingCalculator` (CEP na PDP) | RV-010 | `products/components/` |
| `NewsletterForm` | RV-012 | tipo de seção novo no contrato |

**Total: 13 componentes novos.** Cada um tem um requisito que o justifica — nenhum foi criado
"por padrão".

### 6.5.4 Ícones

**Verificado:** `modules/common/icons/` tem 13 ícones (`bancontact`, `ideal`, `paypal`, `refresh`,
`package`, `trash`, `x`, `spinner`, `user`, `map-pin`, `fast-delivery`, `eye`, `eye-off`) e
`types/icon.ts` tipa o registro. O CMS tem `lib/content/icons.ts`.

**Lacuna:** **não há ícone de busca (lupa)** — necessário para RV-005. Nem ícone de filtro. Os ícones
de pagamento do MP também precisarão ser adicionados.

**Critério de aceite:** ícone novo entra em `modules/common/icons/` e é registrado em
`lib/content/icons.ts` quando usado no CMS.

---

## 6.6 Proporção de imagem

**Verificado:** o `product-preview` usa `size="full"` no `thumbnail`; a grade é
`grid-cols-2 small:grid-cols-3 medium:grid-cols-4`. A proporção do card **não foi auditada** no
`brand.css`.

**Lacuna:** não há token de proporção de imagem. Decisão pendente do time comercial (junto com a
questão 3 de `01-auditoria-projeto.md`).

**Recomendação:** 3:4 (retrato) — padrão de moda, mais alto que largo na grade de 4 colunas.

---

## 6.7 Checklist de conformidade

Para qualquer componente novo:

- [ ] Usa **tokens**, nunca cor literal
- [ ] Usa a **escala de texto** (após adicionada), nunca tamanho solto
- [ ] Usa `--rv-section-space` para respiro vertical
- [ ] Respeita a **regra do rosa** (só preenchimento/borda/ícone/texto ≥24px)
- [ ] Tem estado de `focus` com `--rv-focus-ring`
- [ ] Funciona em 320px sem scroll horizontal
- [ ] Tem estados de loading, vazio e erro
- [ ] Respeita `prefers-reduced-motion`
- [ ] Área de toque ≥ 44px no mobile
- [ ] Textos em **pt-BR**
- [ ] `alt` em toda imagem; `aria-label` em botão só com ícone