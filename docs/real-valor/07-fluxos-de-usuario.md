# 07 — Fluxos de Usuário

Jornada de compra completa, pontos de abandono e cenários de exceção exigidos pela seção 11 do
briefing.

---

## 7.1 Jornada principal

```
Home → Categoria → Produto → Variante → Carrinho → Checkout → Pagamento → Pedido confirmado
```

| # | Etapa | Onde no código | Estado verificado | Risco |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Home** | `(main)/page.tsx` | ✅ 10 seções via CMS | Baixo |
| 2 | **Categoria** | `categories/[...category]/page.tsx` | ⚠️ sem filtros | **Médio** |
| 3 | **Produto** | `products/[handle]/page.tsx` | ✅ galeria, variantes, estoque | Baixo |
| 4 | **Variante** | `product-actions` + `option-select` | ✅ seleção via URL | Baixo |
| 5 | **Carrinho** | `modules/cart/` | ✅ completo | Baixo |
| 6 | **Checkout** | `modules/checkout/` | ⚠️ UI pronta, **pagamento quebrado** | **Crítico** |
| 7 | **Pagamento** | `payment-button` | ❌ **não transaciona** | **Crítico** |
| 8 | **Confirmado** | `order/[id]/confirmed` | ✅ com rastreio | Baixo |

**Leitura:** a jornada está completa **menos no passo 7**. E há um problema anterior a ele — os textos
em inglês (RV-003) committed exatamente onde a confiança é decidida.

### Depois da compra: o bloco de pedido e envio

A jornada tem **três sistemas distintos** depois do passo 7, e vale não misturá-los:

| Etapa | Sistema | Onde no código | Estado |
| :--- | :--- | :--- | :--- |
| **Pagamento aprovado** | Mercado Pago | webhook | ❌ **inexistente** (RV-042) |
| **Pedido criado + reserva** | Medusa | `workflows/` | ❌ **`workflows/` não existe** |
| **Envio — código registrado** | Admin | `order.metadata` | ❌ **ninguém escreve** |
| **Cliente consulta** | Frontend | rota de track existe | ⚠️ **sem tela** |

**O achado mais importante desta seção:** a rota `GET /store/orders/track` está **completa e bem
desenhada** — aceita número do pedido + CPF **ou** e-mail, valida a identidade com **403**, e devolve
status, itens, endereço sanitizado e rastreio. É código de produção.

**Mas nada alimenta os dados dela.** O grep por `tracking_number`, `tracking_url`, `carrier` e
`status_label` no backend não retorna nada fora da própria rota. É um campo lido e nunca gravado.

**Consequência para a cliente:** ela consulta o rastreio e vê sempre `null`. A rota está pronta, o
pipeline não.

```
Pagamento ──▶ Pedido ──▶ Envio ──▶ Cliente consulta
(MP)         (Medusa)     (Admin)     (página pública)
   ❌            ❌           ❌            ❌
RV-002        RV-042       RV-043       RV-044
```

**Por que esses quatro não dependem da transportadora:** a transportadora responde *"onde está o
pedido?"*, não *"o pedido existe?"*. Pagamento, reserva e tela de acompanhamento são anteriores e
posteriores ao frete. Construir esses blocos agora é o caminho certo mesmo sem transportadora
definida — ver a seção 8.4.2 de `08-arquitetura-e-integracoes.md`.

---

## 7.2 Detalhamento por etapa

### Etapa 1 — Home
Hero carrossel (`hero.ts` + `hero.spec.ts` validando slides) · trilho de lançamentos
(`launchesLimit` vindo do contrato) · vitrine com chips de categoria (`featured` +
`content-section-category` link) · benefits bar · coleções · editorial · Instagram. Anúncio e header
vêm do layout (chrome), não da home.

**Ponto de falha:** sem região, `launches` e `featured` somem silenciosamente. A home continua de pé,
mas fica mais pobre — **comportamento correto**, registrado no código.

### Etapa 2 — Categoria
Listagem com 12 por página, paginação real, ordenação por 3 critérios, breadcrumb,
`revalidate = 3600`.

**Ponto de falha — sem filtros.** A cliente que quer "vestido preto P" precisa abrir a PDP de cada
vestido. **É o maior ponto de abandono por esforço** da jornada.

### Etapa 3 — Produto
Galeria com thumbnails · preço por variante · chip de status ("Pronta entrega", "Últimas peças",
"Esgotado") · descrição em acordeão · relacionados · ações mobile fixas ao rolar.

**Ponto de falha:** sem guia de medidas (RV-009), sem frete na PDP (RV-010), sem parcelamento
(RV-008). Três informações que a referência dá e que reduzem a decisão errada.

### Etapa 4 — Variante
Seleção sincronizada com a URL (`?v_id=`), permitindo compartilhar; estado de estoque pela **mesma
função** do card.

**Bom:** a unificação de `product-availability.ts` garante que o card não prometa o que o botão recusa.
**Risco:** com muitas variantes por produto, o filtro por `?v_id=` na Store API deve escalar bem —
verificar com o catálogo real.

### Etapa 5 — Carrinho
Quantidade, remoção, cupom, frete, total · `cart-mismatch-banner` quando o item guardado diverge ·
`free-shipping-price-nudge` · estado vazio.

**Bom:** a cobertura de estados aqui está acima da média.

### Etapa 6 — Checkout
Endereço (com `country-select`), cobrança, envio, pagamento, resumo; coluna de resumo fixa de 416px
no desktop.

**Pontos de falha:** idioma em inglês; nenhum provedor registrado; sem indicação de segurança junto ao
botão.

### Etapa 7 — Pagamento
**Estado atual:** o `payment-button` faz `switch` por `isStripeLike` / `isManual`. Com o provedor
manual seedado, o fluxo **não completa**.

**Estado desejado:** registry (RV-001) + adapter MP (RV-002).

### Etapa 8 — Pedido confirmado
Resumo do pedido, itens, pagamento, envio · rastreio via `/store/orders/track` · transferência de
pedido (`transfer-actions`).

---

## 7.3 Cenários de exceção (exigidos pela seção 11)

| # | Cenário | Comportamento atual | Comportamento exigido | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Produto sem estoque** | Chip "Esgotado" + botão desabilitado | Idem | ✅ |
| 2 | **Varianta indisponível** | `variantIsAvailable` no botão | Idem | ✅ |
| 3 | **Carrinho vazio** | `empty-cart-message` + link | Idem | ✅ |
| 4 | **Erro de API** | `console.error` em alguns pontos | Mensagem visível, ação de recuperação | ⚠️ parcial |
| 5 | **Erro de pagamento** | `error-message` existe | Mensagem em pt-BR, carrinho preservado | ⚠️ |
| 6 | **Frete indisponível** | Solicita outro método | Mensagem clara com alternativa | ⚠️ |
| 7 | **Sessão expirada** | Não auditado | Redirecionar para login com retorno | ❌ |
| 8 | **Produto removido** | PDP retorna `notFound()` | 404 com busca e categorias | ✅ |
| 9 | **Alteração de preço** | **Não verificado** | Revalidar e avisar o cliente | ❌ |
| 10 | **Quantidade acima do estoque** | `variantIsAvailable` no botão | Limitar no `cart-item-select` | ⚠️ |

### Detalhamento dos que faltam

**7. Sessão expirada** — `retrieveCustomer()` é chamado no carrinho e no checkout. Se o cookie
expirar entre carregar a página e submeter, o que acontece? **Não auditado.** Requisito: interceptar e
redirecionar para login, preservando o carrinho (que está em cookie próprio) e a URL de retorno.

**9. Alteração de preço** — o cenário mais traiçoeiro do e-commerce. A cliente vê R$ 199,90, vai ao
checkout, e o preço mudou. Requisito:
- Revalidar o total no servidor antes de cobrar
- Se mudou, mostrar a diferença **explicitamente** — nunca cobrar silenciosamente
- O valor da preference (RV-002) é sempre o do carrinho no momento da criação, o que já mitiga

**10. Quantidade acima do estoque** — o botão impede adicionar além do estoque, mas **editar a
quantidade no carrinho** pode permitir mais do que o disponível. Requisito: o `cart-item-select` deve
limitar pelo estoque da variante.

---

## 7.4 Mapa de pontos de abandono

| Ponto | Causa | Mitigação |
| :--- | :--- | :--- |
| Home → Categoria | Menu por peça, sem eixo de ocasião | Chips de categoria na vitrine |
| Categoria → Produto | **Não achar a peça certa** | **Filtros (RV-004) e busca (RV-005)** |
| Produto → Variante | Incerteza sobre o tamanho | **Guia de medidas (RV-009)** |
| Produto → Carrinho | Dúvida de frete | **Calculadora na PDP (RV-010)** |
| Carrinho → Checkout | Custo total surpresa | Manter nudge de frete grátis |
| Checkout → Pagamento | **Idioma inglês + insegurança** | **RV-003 + meios visíveis na PDP (RV-004 na PDP)** |
| Pagamento | **Não transaciona** | **RV-001 + RV-002** |

**Os dois pontos em negrito são os marcados como CRÍTICA na auditoria.**

---

## 7.5 Fluxo mobile (prioritário)

Em moda, o mobile é o caminho principal. Diferenças relevantes:

| Aspecto | Desktop | Mobile |
| :--- | :--- | :--- |
| Menu | Links no centro | Drawer (`side-menu`) |
| Filtros | Coluna fixa 250px | Botão → drawer (RV-004) |
| Busca | Campo no header | Tela cheia (RV-005) |
| Compra | Botão no fluxo | `mobile-actions` fixo ao rolar ✅ |
| Frete | Coluna de resumo 416px | Resumo **abaixo** dos campos |
| Pagamento | Modal Pix 420px | Redirect em tela cheia |

**Requisito transversal:** toda a jornada deve ser completável **sem hover**. O `product-preview` já
corrigiu isso — o botão "Comprar" é sempre visível, com o comentário registrando que no toque não
existe hover. **Essa lição deve valer para filtros e busca também.**

**Critério de aceite:** jornada completa testada em iPhone SE (375px) e iPhone 15 Pro, em iOS Safari.