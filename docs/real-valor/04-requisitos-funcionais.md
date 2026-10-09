# 04 — Requisitos Funcionais

Formato por requisito (seção 5 do briefing): **Identificação · Objetivo · Descrição · Regras de
negócio · Comportamento visual · Responsividade · Estados · Integrações · Critérios de aceite**.

**Prioridade:** CRÍTICA · ALTA · MÉDIA · BAIXA
**Convenção de arquivos:** caminhos marcados com *(proposto)* **não existem** — são criação nova.
Caminhos sem marcador já existem no repositório.

**Índice**

| ID | Requisito | Prioridade |
| :--- | :--- | :--- |
| [RV-001](#rv-001--camada-de-abstração-de-pagamento) | Camada de abstração de pagamento | **CRÍTICA** |
| [RV-002](#rv-002--adapter-mercado-pago) | Adapter Mercado Pago (Pix, cartão, parcelamento) | **CRÍTICA** |
| [RV-003](#rv-003--idioma-da-interface-pt-br) | Interface 100% pt-BR | **CRÍTICA** |
| [RV-004](#rv-004--filtros-de-catálogo) | Filtros de catálogo com contagem | ALTA |
| [RV-005](#rv-005--busca-de-produtos) | Busca de produtos | ALTA |
| [RV-006](#rv-006--frete-automático-e-plugável-️-feito) | Frete automático e plugável ✅ | ALTA |
| [RV-007](#rv-007--metadados-de-seo) | Metadados de SEO e dados estruturados | ALTA |
| [RV-008](#rv-008--parcelamento-e-pix-na-vitrine) | Parcelamento e Pix na vitrine | ALTA |
| [RV-009](#rv-009--guia-de-medidas) | Guia de medidas | ALTA |
| [RV-010](#rv-010--calculadora-de-frete-na-pdp) | Calculadora de frete na PDP | MÉDIA |
| [RV-011](#rv-011--badge-de-desconto-no-card) | Badge de desconto e tamanhos no card | MÉDIA |
| [RV-012](#rv-012--newsletter) | Newsletter no rodapé | MÉDIA |
| [RV-013](#rv-013--ordenacao-e-rotulos) | Ordenação e rótulos do catálogo | MÉDIA |
| [RV-042](#rv-042--captura-do-pagamento-e-reserva-de-estoque) | Captura do pagamento e reserva de estoque | **CRÍTICA** |
| [RV-043](#rv-043--painel-de-envio) | Painel de envio (registro de rastreio) | **ALTA** |
| [RV-044](#rv-044--pgina-pblica-de-rastreio) | Página pública de rastreio | **ALTA** |
| [RV-045](#rv-045--notificao-de-envio-cliente) | Notificação de envio à cliente | MÉDIA |
| [RV-046](#rv-046--adapter-de-transportadora) | Adapter de transportadora *(bloqueado)* | BAIXA |

> **Bloco de pedido e envio (RV-042 a RV-046):** o provedor de frete **ainda não foi decidido**, e
> isso não segura nada — ver a correção no RV-006: **frete não precisa de registry no frontend**, e a
> camada já foi construída (provider `tabela`). Os requisitos 042 a 045 são independentes da
> transportadora; só o RV-046 depende da escolha.

---

## RV-001 — Camada de abstração de pagamento

**Prioridade:** CRÍTICA · **Tipo:** arquitetura · **Complexidade:** média

### Objetivo
Separar o código que **conhece um provedor de pagamento** do código que não conhece, para que
trocar de provedor seja adicionar um adapter e uma linha de registro — sem tocar em componente,
layout, copy ou teste de outro provedor.

### Descrição

O projeto já tem um registro parcial em `frontend/src/lib/constants.tsx`: `paymentInfoMap` mais as
funções `isStripeLike()`, `isPaypal()` e `isManual()`, com um `switch` por tipo em
`payment-button/index.tsx:30`. Funciona, mas **cresce a cada provedor** — o oposto de modular.

A solução é inverter a direção: em vez de o componente perguntar "qual é o tipo?", ele pergunta ao
registry "qual adapter responde por este `provider_id`?".

**Arquitetura proposta (4 camadas):**

```
┌────────────────────────────────────────────────────────────┐
│ L4 · frontend/src/modules/checkout/          NÃO ATINGE   │
│     payment-button, payment-container, payment/index.tsx   │
│     → chamam resolvePayment(id).render() / .initiate()     │
├────────────────────────────────────────────────────────────┤
│ L3 · frontend/src/lib/payments/             ATRAVESSA     │
│     registry.ts   Map<provider_id, PaymentAdapter>        │
│     types.ts      contrato PaymentAdapter + PaymentResult  │
│     resolve.ts    resolvePayment(id)                       │
├────────────────────────────────────────────────────────────┤
│ L2 · frontend/src/lib/payments/adapters/     ATÉ AQUI      │
│     mercadopago/ · stripe/ · manual/                       │
├────────────────────────────────────────────────────────────┤
│ L1 · backend/src/modules/payment/            ATRAVESSA     │
│     registro de providers + webhook → PaymentResult        │
│     (fala só por HTTP com L4, nunca por import)            │
└────────────────────────────────────────────────────────────┘
```

**O contrato `PaymentAdapter`:**

| Member | Assinatura | Para quê |
| :--- | :--- | :--- |
| `id` | `string` | `provider_id` que o Medusa devolve |
| `label` | `string` | nome exibido ("Pix", "Cartão de crédito") |
| `icon` | `ReactNode` | ícone do meio |
| `capabilities` | `{ pix, installments, boleto, cards }` | o que este meio oferece |
| **`fulfillment`** | **`FulfillmentMode`** | **como este meio se completa — ver abaixo** |
| `initiate` | `(order) => Promise<InitiateResult>` | inicia o pagamento |
| `render?` | `(ctx) => ReactNode` | UI específica do meio (só a Checkout API usa) |
| `describe?` | `(amount) => InstallmentInfo` | "6x de R$ X sem juros" |
| `handleWebhook` | `(payload) => Promise<PaymentResult>` | normaliza a resposta do provedor |

**`FulfillmentMode` — a propriedade que decide Checkout Pro ou Checkout API:**

```ts
type FulfillmentMode = "redirect" | "inline" | "external"
```

| Valor | Significado | Quem usa |
| :--- | :--- | :--- |
| `redirect` | Redireciona para `init_point`; o MP cuida do formulário | **Checkout Pro — a escolha desta loja** |
| `inline` | O MP monta o formulário **na nossa página** | Checkout API (fase futura) |
| `external` | Botão ou QR direto, sem checkout | Pix sem redirect |

> **Por que esta propriedade existe.** A escolha por Checkout Pro é uma decisão de **agora**, não uma
> compromisso de sempre. O `render?` é opcional justamente porque o Pro **não** implementa e a API
> **implementa** — mesma interface, um método a mais. Trocar de modalidade depois é mudar
> `fulfillment: "redirect"` → `"inline"` e passar a usar `render`; **`modules/checkout/` não é tocado.**
> É esse o critério de aceite do RV-002 — o teste que prova se a abstração é real.

**`PaymentResult` é o ponto crucial:** é o **único** formato que o resto do sistema entende.
`{ status: "paid" | "pending" | "failed" | "refunded", providerId, reference, raw? }`. Um adapter novo
não inventa semântica nova — ele traduz para esse tipo.

### O contrato compartilhado

`PaymentAdapter` e `PaymentResult` entram em `packages/contrato/src/`, **junto do conteúdo**,
seguindo o padrão já estabelecido: o backend valida, o frontend consome, e **o compilador garante
a paridade**. Essa é a mesma razão pela qual a antiga "guarda de paridade" (114 asserções por texto)
foi deletada de propósito.

### Regras de negócio
1. `resolvePayment(id)` **nunca retorna `undefined`** para id desconhecido — devolve um adapter
   `unsupported` com mensagem clara. Um provedor novo gravado sem deploy não pode quebrar o checkout.
2. Nenhum adapter importa de outro adapter.
3. `modules/checkout/` **não importa** `adapters/` diretamente — só o registry. É a fronteira que a
   CI vai vigiar (critério 8).
4. O `initiate` é **server-side**: a chave do provedor nunca chega ao navegador. O storefront só
   recebe URL de redirecionamento ou dados públicos (ex.: QR Pix).
5. Trocar de provedor **não** muda código de layout, copy ou teste de outro provedor.

### Comportamento visual
Sem mudança na aparência. O registry substitui um `if` por uma chamada — o que se vê na tela é
idêntico ao de hoje, o que reduz o risco de regressão visual na Fase 0.

### Responsividade
Não se aplica: é camada de lógica. O que é responsivo é o `render` do adapter (ver RV-002).

### Estados
- `loading` — durante `initiate`; o botão fica em `isLoading`
- `erro` — adapter `failed`; `error-message` já existente exibe a mensagem
- `sucesso` — `PaymentResult.status === "paid"`; redireciona para `/order/[id]/confirmed`
- `indisponível` — adapter `unsupported`; mensagem "Forma de pagamento indisponível"
- `pending` — Pix aguardando confirmação; **não** navegar para a confirmação até o webhook

### Integrações
- `POST /store/payment-collections` e `/store/payment-sessions` (Medusa, já expostos)
- Webhook próprio por provedor, registrado no `medusa-config.ts`
- `GET /store/payment-providers` — **já consumido** por `frontend/src/lib/data/payment.ts`
- `PaymentResult` compartilhado via `@rv/contrato`

### Critérios de aceite
1. `resolvePayment("pp_mercadopago_mercadopago")` devolve o adapter do MP.
2. `resolvePayment("pp_desconhecido_x")` devolve o adapter `unsupported`, sem lançar.
3. Um adapter novo é adicionado **sem nenhuma alteração** em `modules/checkout/`.
4. Remover um adapter do registry **não** quebra o build (só o torna indisponível em runtime).
5. `handleWebhook` de qualquer adapter devolve `PaymentResult` — não tipo cru do provedor.
6. Teste unitário cobre: registry vazio, id desconhecido, adapter sem `render`.
7. `grep -r "adapters/" frontend/src/modules/checkout/` retorna **vazio**.
8. `scripts/check-boundaries.mjs` passa a vigiar a fronteira L3↔L4.

---

## RV-002 — Adapter Mercado Pago (Pix, cartão, parcelamento)

**Prioridade:** CRÍTICA · **Tipo:** integração · **Complexidade:** alta
**Depende de:** RV-001

### Objetivo
Habilitar pagamento via Mercado Pago com **Pix**, **cartão de crédito parcelado** e **boleto**,
com webhook que confirma o pagamento no Medusa.

### Descrição

**Modalidade escolhida: Checkout Pro** (redirecionamento). Decisão registrada — o MP cuida do
formulário de pagamento, que é menos código nosso, mais robusto no mobile e mais bem documentado. A
Checkout API fica disponível depois, via `FulfillmentMode` (ver RV-001).

O Mercado Pago é escolhido porque cobre as três modalidades com que a cliente brasileira compra:
Pix (à vista e com desconto), cartão parcelado e boleto. Ele **não é Stripe-like** — usa
redirecionamento para uma *preference*, não tokenização de cartão no navegador. Por isso o adapter do
MP tem `fulfillment: "redirect"` e o do Stripe não precisaria de `render` próprio.

**Fluxo** *(✅ implementado — as três correções abaixo vêm do código que existe)*:

```
1. Cliente escolhe "Pix" na tela de pagamento
2. Checkout chama initiatePaymentSession(pp_mercadopago_pix)
   ⚠️ NÃO existe "POST /api/payment/mercadopago/preference". O adapter do
   storefront não inicia nada: o `init_point` chega em
   `payment_session.data.init_point`, gravado pelo backend no passo 3.
3. Backend (provider `initiatePayment`) cria a preference na API do MP
   → POST /checkout/preferences, com external_reference = id da SESSÃO
4. A sessão (com `init_point` no `data`) volta ao storefront no ato do passo 2
5. O BOTÃO do meio faz `window.location.assign(init_point)` — é o
   `adapter.ConfirmButton`, e não o botão comum, que chamaria `placeOrder()`
⚠️ 6. NÃO há "cliente volta para /order/[id]/confirmed" ao voltar do MP: o
   pedido ainda não existe. Ela cai em /pedido/confirmacao, que pergunta ao
   backend e troca a URL quando o pedido aparecer.
7. Cliente paga no ambiente do MP
8. MP chama POST /webhooks/mercadopago → assinatura conferida → GET
   /v1/payments/{id} → sessão resolvida pelo external_reference → valor
   conferido → evento `payment.webhook_received` emitido
9. O provider devolve SUCCESSFUL; o Medusa autoriza, captura e **cria o
   pedido** (completeCartWorkflow) — o pedido nasce AQUI, e não no navegador
10. A página de confirmação encontra o pedido e redireciona para
    /order/[id]/confirmed
```

**Arquivos (✅ implementados):**
- `backend/src/modules/payment/mercadopago/{service,webhook,preferencia,assinatura,credenciais,cliente,redigir,contexto}.ts`
- `backend/src/modules/payment/mercadopago/{pix,cartao}/index.ts` *(dois módulos, porque o `id` do
  registro vem do item do config: dois services num `ModuleProvider` sobrescreveriam um ao outro)*
- `backend/src/api/webhooks/mercadopago/route.ts` (e `[metodo]/`)
- `backend/src/api/hooks/payment/[provider]/route.ts` *(404 — substitui a rota nativa do Medusa)*
- `backend/src/api/internal/orders/by-cart/route.ts` *(consulta interna, autenticada por segredo)*
- `frontend/src/lib/payments/adapters/mercadopago/{index,payment-button}.tsx`
- `frontend/src/app/api/pedido/status/route.ts` e
  `frontend/src/app/[countryCode]/(main)/pedido/confirmacao/page.tsx`

> **Dois nomes propostos que não existem.** O `provider.ts` da versão original é o `service.ts` (o
> `AbstractPaymentProvider` do Medusa é um `service`), e o `pix-modal.tsx` nunca fez sentido: o
> Checkout Pro é **redirecionamento**, então o Pix não abre modal — o botão do adapter faz
> `window.location.assign(init_point)` e o QR aparece na tela do Mercado Pago. Nenhum dos dois
> arquivos foi criado.

### Regras de negócio
1. **O valor vem sempre do carrinho no backend.** O frontend envia apenas o `cart_id`; o backend lê
   o total. Nunca aceitar valor do cliente.
2. **Pix e cartão são meios distintos**, com `provider_id` distintos no registry — não um provider
   com dois modos. Isso mantém o registry uniforme.
3. O desconto do Pix é aplicado **antes** de gerar a preference, e é refletido no total do pedido.
4. **Parcelamento:** exibir o número de parcelas **que o MP efetivamente aceita** para o valor e a
   bandeira — consultado via `describe()`, nunca estimado ou fixo no front.
5. **`auto_return: approved`** — aprovado pelo MP, volta sozinho para `MP_BACK_URL`.

### O ponto de desacoplamento — `shouldInputCard`

**Verificado:** `payment/index.tsx:80` contém hoje

```ts
const shouldInputCard = isStripeLike(selectedPaymentMethod) && !activeSession
// ...
if (!shouldInputCard) { return router.push("?step=review") }
```

**Esse é o único lugar do frontend que pergunta ao provedor "este meio precisa de cartão na minha
página?"** É a constante que amarra o fluxo de checkout a um provedor específico. Com o MP, a pergunta
vira "este meio redireciona?" — é o mesmo `if` com nome diferente, e é exatamente onde a Checkout API
quebraria depois.

**Antes (acoplado):**
```
selectedPaymentMethod
isStripeLike(id) ?  → "precisa de cartão"
shouldInputCard ? → step=review
```

**Depois (independente):**
```
adapter = resolvePayment(id)
adapter.fulfillment
fulfillment === "redirect"  → window.location = adapter.initiate(ctx).init_point
fulfillment === "inline"    → <adapter.render(ctx) />   // Checkout API, depois
```

**Regra:** `payment/index.tsx` **não pode perguntar sobre cartão, sobre redirecionamento, nem sobre
qualquer tipo de provedor.** Só consulta `resolvePayment(id)` e segue o que o adapter responder.

**Este é o critério que prova se a abstração é real:** trocar `fulfillment` para `"inline"` e implementar
`render` **não pode alterar uma linha** de `modules/checkout/`.

### Webhook — validação de assinatura

> ⚠️ **Ressalva de método:** o algoritmo abaixo segue a especificação conhecida, mas **não foi possível
> extraí-lo da documentação oficial** durante a auditoria — a página é renderizada por JavaScript.
> **Validar contra a documentação do Mercado Pago antes de fechar a implementação**, e ajustar os testes
> ao caso real.

O MP envia `x-signature` (`ts=...;v1=...`) e `x-request-id`. A validação:

```
1. Ler x-signature → extrair ts e v1
2. Montar o manifest:  "id:{data.id};request-id:{x-request-id};ts:{ts};"
   — data.id em MINÚSCULAS
3. HMAC-SHA256 do manifest com MP_WEBHOOK_SECRET (não o access token)
4. Comparar com v1 em tempo constante
```

**Se a assinatura não bater, responder 401 e não ter efeito nenhum** — nem criar pedido, nem reservar
estoque. Um webhook forjado seria a forma mais direta de "confirmar" um pagamento que não aconteceu.

### Idempotência — onde ela vive

Não basta dizer "deduplica": é preciso dizer **onde**.

> ⚠️ **Corrigido na implementação.** A versão anterior deste documento propunha
> `order.metadata` como o lugar da idempotência. **Não funciona**: no caminho do
> Mercado Pago o pedido **ainda não existe** quando o webhook chega — quem o cria
> é o próprio webhook. Não se guarda estado num registro que não foi criado.
>
> A idempotência não foi implementada por nós: foi **verificada** no framework, e
> não precisa de marca nenhuma. As três coisas que um reenvio tentaria fazer já
> estão guardadas onde o estado real está:

| O que um reenvio faria | O que impede, no código do Medusa |
| :--- | :--- |
| Capturar o pagamento de novo | `capturePayment_`: `if (payment.captured_at) return` — sai antes de chamar o provedor |
| Criar o pedido de novo | `completeCartAfterPaymentStep` é guardado por `!order` (o link `order_cart` já existe) |
| Autorizar duas vezes | o ramo de autocapture é guardado por `!paymentData.length` |

| Aspecto | Decisão (implementada) |
| :--- | :--- |
| Chave de correlação | `external_reference` = id da **payment session** |
| Onde o pedido nasce | `processPaymentWorkflow` (webhook) → `completeCartWorkflow` |
| Reenvio com o mesmo status | no-op pelas três guardas acima; o Mercado Pago recebe 200 |
| Por que 200 e não "já processado" | o provedor não tem o que fazer com a informação, e um erro faria reentrega infinita |
| `order.metadata.mp_*` | **proveniência e auditoria** — pós-fato, nunca fonte de decisão |

**Por que não guardar uma marca nossa.** Uma segunda fonte de verdade para uma
pergunta que o framework já responde é sempre a que fica desatualizada — e aqui
ela custaria uma escrita a mais no caminho crítico, e um bug a mais quando o
pedido for criado por outro caminho (admin, fluxo manual).

**Regra de ouro (confirmada):** o webhook não confia no corpo. Ele pergunta ao
provedor (`GET /v1/payments/{id}`) e confere o valor contra a **sessão gravada**,
e é isso — e não a assinatura sozinha — que impede aplicar um pagamento de R$ 1
num pedido de R$ 1.000.

### Comportamento visual
- Na tela de pagamento, os meios ativos vêm de `capabilities` do adapter — o MP declara `pix`,
  `cards`, `installments`, `boleto`; o que não for declarado **não aparece**.
- Selecionado Pix: QR code + "copia e cola" + countdown de expiração.
- Selecionado cartão: **redirecionamento** para o Checkout Pro do MP (não iframe).
- Preço Pix e preço no cartão lado a lado quando há desconto.

### Responsividade
- **Desktop:** meios em radio group vertical; QR Pix em modal centrado de 420px.
- **Mobile:** o redirecionamento ao MP ocupa a tela cheia; o QR cabe em 320px.
- Botão de compra com `min-height: 44px` (área de toque confortável).

### Estados
| Estado | Comportamento |
| :--- | :--- |
| `loading` | Botão em `isLoading`; evita duplo clique |
| `pix pending` | QR + countdown; texto "Aguardando pagamento" |
| `pix expirado` | QR expirado → botão "Gerar novo QR" |
| `erro` | Mensagem legível; o carrinho **preservado** |
| `sucesso` | Redirect para `/order/[id]/confirmed` |
| `indisponível` | Provider desativado → meio não listado |

### Integrações
- API do Mercado Pago (Checkout Pro / Point) — **credenciais no `.env` do backend**
- Webhook público — exige URL acessível pela internet em produção
- `POST /store/payment-collections` (Medusa) e core-flows `capturePaymentWorkflow`

### Critérios de aceite
1. Um Pix pago no ambiente de teste do MP chega a `/order/[id]/confirmed`.
2. Reenvio do mesmo webhook **não** duplica o pedido.
3. Webhook com assinatura inválida é **rejeitado com 401 e sem efeito colateral**.
4. Trocar `MP_ACCESS_TOKEN` no `.env` e redeployar muda a loja de conta — **sem tocar em código**.
5. Remover o MP do `medusa-config.ts` deixa a loja sem aquele meio, **sem erro de build**.
6. O valor do pagamento é sempre lido do carrinho no backend (teste que comprova).
7. O parcelamento exibido corresponde ao aceito pelo MP para o valor e a bandeira.
8. **`payment/index.tsx` não contém `isStripeLike`, `shouldInputCard` nem qualquer pergunta sobre
   cartão** — só `resolvePayment(id)` e `adapter.fulfillment`.
9. **Teste da abstração:** mudar `fulfillment` do MP para `"inline"` e implementar `render`
   **não altera nenhuma linha** de `modules/checkout/`. Se alterar, a abstração não é real.
10. `data.id` minúsculo no manifest da assinatura — teste unitário da função de validação.

---

## RV-003 — Interface 100% pt-BR

**Prioridade:** CRÍTICA · **Tipo:** UI · **Complexidade:** baixa
**Depende de:** nenhuma — pode começar imediatamente

### Objetivo
Eliminar toda a interface em inglês visível para a cliente. Não é cosmético: é o último passo antes
do pagamento, e a confiança em um checkout brasileiro depende disso.

### Descrição

O projeto foi customizado a partir do starter do Medusa, e os textos padrão ficaram. **Verificado:**

| Local | Texto atual | Texto correto |
| :--- | :--- | :--- |
| `product-actions/index.tsx:176` | "Select variant" | "Selecione o tamanho" |
| `product-actions/index.tsx:178` | "Out of stock" | "Esgotado" |
| `product-actions/index.tsx:179` | "Add to cart" | "Comprar" |
| `sort-products/index.tsx:39` | "Sort by" | "Ordenar por" |
| `sort-products/index.tsx` | "Latest Arrivals" | "Mais recentes" |
| `sort-products/index.tsx` | "Price: Low -> High" | "Menor preço" |
| `sort-products/index.tsx` | "Price: High -> Low" | "Maior preço" |
| `cart/page.tsx:8` | "Cart" / "View your cart" | "Carrinho" / "Veja seu carrinho" |
| `checkout/page.tsx:10` | "Checkout" | "Finalizar compra" |
| `account/@login/page.tsx:6` | "Sign in" / "…Medusa Store account." | "Entrar" / "Entre na sua conta Real Valor." |
| `account/@dashboard/page.tsx:9` | "Account" | "Minha conta" |
| `account/@dashboard/orders/page.tsx:10` | "Orders" | "Pedidos" |
| `account/@dashboard/addresses/page.tsx:10` | "Addresses" | "Endereços" |
| `account/@dashboard/profile/page.tsx:14` | "Profile" / "…Medusa Store profile." | "Perfil" / "Veja e edite seus dados." |
| `order/[id]/confirmed/page.tsx:10` | "Order Confirmed" | "Pedido confirmado" |
| `store/page.tsx:7` | "Store" | "Todas as peças" |
| `login/index.tsx:30` | "Enter a valid email address." | "Informe um e-mail válido." |
| `shipping-address/index.tsx:199` | "Enter a valid email address." | "Informe um e-mail válido." |
| `profile-password/index.tsx:18` | "Password update is not implemented" | "A troca de senha ainda não está disponível" |
| `transfer-request-form/index.tsx:42` | placeholder "Order ID" | placeholder "Número do pedido" |

### Regras de negócio
1. **Nenhum texto de interface fica em inglês.** Inclui `aria-label`, `placeholder`, `title`,
   `alt` e mensagens de erro.
2. **Não usar o wrapper `<FormattedMessage>` do `@medusajs/ui`.** Ele existe para catálogos
   multilíngue; aqui a store é pt-BR única. Strings diretas são mais simples e legíveis.
3. **Mensagem de erro sempre em português e acionável.** "Informe um e-mail válido" diz o que fazer;
   "Invalid email" diz só que falhou.
4. Textos de marca (nome, slogan, manifesto) **não** são traduzidos — já são da marca.
5. Traduzir **antes** de RV-001/RV-002, porque o registry vai consumir esses rótulos.

### Comportamento visual
Sem mudança de layout. Textos em português são em geral mais longos — revisar os botões que podem
quebrar: "Selecione o tamanho" é o maior deles; o `product-actions` já usa `w-full h-10`, então
cabe sem redesign.

### Responsividade
Textos longos são o risco principal no mobile: "Informe um e-mail válido" cabe em 320px; o botão
"Finalizar compra" cabe; mensagens de erro devem poder quebrar linha (`break-words`).

### Estados
- `erro` — sempre pt-BR, nunca a mensagem crua do Medusa ou do SDK
- `loading` — "Carregando…" (não existe ainda nos skeletons — avaliar)
- `vazio` — "Seu carrinho está vazio" (já pt-BR em `empty-cart-message`)
- `disabled` — rótulo explicativo em vez de apenas desabilitado (ex.: "Escolha um tamanho para continuar")

### Integrações
Nenhuma. É substituição de literais.

### Critérios de aceite
1. `grep -rn '"[A-Z][a-z]* [a-z]' frontend/src --include=*.tsx | grep -v pt-` não encontra texto de UI.
2. Todos os `metadata.title` / `description` em pt-BR e sem "Medusa".
3. Navegação por teclado em checkout **não** encontra rótulo em inglês.
4. Teste visual confirma que nenhum botão quebra em 320px de largura.
5. Mensagens do Medusa/SDK nunca chegam cruas à tela.

---

## RV-004 — Filtros de catálogo com contagem

**Prioridade:** ALTA · **Tipo:** funcional + UX · **Complexidade:** média
**Depende de:** nenhuma

### Objetivo
Permitir que a cliente restrinja o catálogo por **cor**, **tamanho**, **faixa de preço** e
**disponibilidade**, com contagem de itens por faceta.

### Descrição

Hoje `refinement-list/index.tsx` tem 41 linhas e renderiza **apenas** `<SortProducts>`. Não há
nenhuma faceta. A referência tem as quatro, e é o padrão mais forte dela que vale adopting.

O projeto **já tem o padrão certo**: `sortBy` vive na query string e é lido no servidor
(`categories/[...category]/page.tsx` → `searchParams`). Os filtros devem usar **o mesmo mecanismo**,
não estado de cliente — assim a URL é compartilável e indexável.

**Facetas e suas fontes:**

| Faceta | Fonte | Query param |
| :--- | :--- | :--- |
| Tamanho | `option_value` com `option.title = "Size"`/`"Tamanho"` | `?size=P&size=M` |
| Cor | `option_value` com `option.title = "Color"`/`"Cor"` | `?color=preto` |
| Preço | intervalo sobre `calculated_price` | `?price_min=100&price_max=300` |
| Disponibilidade | `variant.manage_inventory` + estoque | `?in_stock=true` |

**A contagem por faceta** vem de `GET /store/products` com os **demais** filtros aplicados (menos
o da própria faceta) — é o comportamento correto: ao marcar "Preto", a contagem de "P" deve contar
só os pretos.

**Arquivos propostos:**
- `frontend/src/lib/data/facets.ts` *(proposto)* — busca as facetas
- `frontend/src/modules/store/components/refinement-list/facets/` *(proposto)* — `color`, `size`,
  `price`, `availability`, `active-chips`
- `frontend/src/modules/store/components/refinement-list/filters-toggle.tsx` *(proposto)* — botão mobile

### Regras de negócio
1. **Filtro é estado de URL, não de cliente.** Recarregar a página preserva; o botão "voltar" do
   navegador desfaz.
2. Múltiplos valores **dentro** de uma faceta são OR (`size=P&size=M`); entre facetas, AND.
3. A contagem reflete os **outros** filtros aplicados.
4. Faceta com zero resultado fica **desabilitada e esmaecida** (não oculta) — a cliente vê que
   aquele caminho existe e está esgotado. Isso também é honestidade de catálogo.
5. Selecionar categoria **reseta** os filtros (evita combinações que não retornam nada).
6. O filtro que não encontra combinações mostra estado vazio com **"limpar filtros"**, não uma
   tela em branco.

### Comportamento visual
- Desktop: coluna fixa à esquerda (largura já prevista: `min-w-[250px]`), facetas em accordions
  fechados, com "Ver todos / Ver menos" para listas longas (padrão da referência).
- Cada faceta mostra o nome em `rv-eyebrow` (Montserrat capitalizado) e a contagem em `rv-muted`.
- Chips de filtro ativo **acima da grade**, removíveis com um toque.
- Mobile: botão "Filtrar (n)" abre o mesmo componente em drawer.
- Todo controle é focável por teclado, com `aria-expanded` no accordion.

### Responsividade
| Breakpoint | Comportamento |
| :--- | :--- |
| **Desktop (≥1024px)** | Coluna de filtros fixa + grade; chips acima da grade |
| **Tablet (768–1023px)** | Botão "Filtrar" acima da grade; drawer |
| **Mobile (<768px)** | Botão "Filtrar (n)"; drawer de tela cheia; chips roláveis na horizontal |

### Estados
| Estado | Comportamento |
| :--- | :--- |
| `loading` | Skeleton por faceta enquanto `facets.ts` carrega |
| `vazio` | "Nenhuma peça com esses filtros" + botão "Limpar filtros" |
| `erro` | Falha ao buscar facetas → **ocultar a coluna**, não quebrar a listagem |
| `hover` | Contagem e nome ganham `--rv-rose-strong` |
| `focus` | Anel `--rv-focus-ring` (rosa forte, contraste garantido) |
| `disabled` | Faceta com zero resultado: esmaecida, `aria-disabled="true"` |

### Integrações
- `GET /store/products` com `options`, `region_id`, `limit`, `offset`, `order`
- `listProductsWithSort` em `frontend/src/lib/data/products.ts` — estender, não duplicar

### Critérios de aceite
1. `/br/store?size=P&color=preto` mostra só peças P pretas.
2. A URL recarregada preserva os filtros; "voltar" desfaz.
3. Marcar "Preto" altera a contagem de "P" conforme os demais filtros.
4. Faceta com zero resultado fica desabilitada, não oculta.
5. Trocar de categoria limpa os filtros.
6. Falha ao carregar facetas **não** impede a listagem de produtos.
7. Todos os controles operáveis por teclado; accordion com `aria-expanded`.
8. Mobile: nenhum scroll horizontal; drawer fecha e o filtro é aplicado.

---

## RV-005 — Busca de produtos

**Prioridade:** ALTA · **Tipo:** funcional + UX · **Complexidade:** média
**Depende de:** nenhuma (independe de RV-004, mas pode reaproveitar o chip de resultado)

### Objetivo
Permitir que a cliente encontre uma peça pelo nome, e cobrir o tráfego que vem dos buscadores.

### Descrição

Não existe busca. A única ocorrência de "search" no código é `searchParams` do Next. A busca é a
porta de entrada de quem já sabe o que quer — e, em e-commerce, boa parte do tráfego orgânico.

**Ponto de atenção:** a Store API do Medusa aceita `q`, mas a qualidade da busca depende de como os
produtos foram cadastrados. A implementação deve manter a **fonte atrás de uma única função**, para
trocar por um índice dedicado (Algolia, Typesense, ou o `search` do Postgres) sem tocar em componente.

**Fluxo:**
```
Header → campo de busca
  ├─ com ≥2 caracteres: sugestões (debounced, nome + preço)
  │     └─ Enter → /br/busca?q=termo
  └─ sem termo e foco: nada (não poluir)
Página /br/busca?q=
  → listagem reutilizando PaginatedProducts + filtros (RV-004)
```

**Arquivos propostos:**
- `frontend/src/lib/data/search.ts` *(proposto)* — **única** porta de entrada
- `frontend/src/modules/search/components/search-input.tsx` *(proposto)*
- `frontend/src/modules/search/components/search-suggestions.tsx` *(proposto)*
- `frontend/src/app/[countryCode]/(main)/busca/page.tsx` *(proposto)*

### Regras de negócio
1. Debounce de **250 ms** nas sugestões; sem busca a cada tecla.
2. Busca com menos de 2 caracteres **não** dispara consulta.
3. O termo vive na query string (`?q=`), nunca só em estado de cliente.
4. A página de resultado **reaproveita** `PaginatedProducts` e `RefinementList` — não cria uma
   listagem paralela. Isso é o que impede a duplicação que a auditoria registrou como risco.
5. Busca **não filtra** o que a cliente não pode comprar: incluir `in_stock` é decisão comercial —
   recomendado **não** filtrar, e sinalizar esgotado no card (o `ProductStatusChip` já faz isso).
6. Termo com acento deve funcionar: "saias" e "saías" chegam ao mesmo resultado (normalização).

### Comportamento visual
- **Desktop:** campo no header, à esquerda das ações, largura ~280px, com ícone de lupa.
- **Mobile:** ícone de lupa no header que abre **busca em tela cheia** (não um campo de 40px).
- Sugestões: lista sobre o campo, cada linha com nome em `rv-display` e preço em `.rv-price`;
  digitação e setas navegam, `Enter` seleciona, `Esc` fecha.
- Página de resultado: título "Resultados para «termo»" em `rv-display`, com a contagem.

### Responsividade
| Breakpoint | Comportamento |
| :--- | :--- |
| **Desktop** | Campo inline no header; sugestões ancoradas ao campo |
| **Tablet** | Idem, largura reduzida |
| **Mobile** | Tela cheia; sugestões em lista; botão "voltar" fecha |

### Estados
| Estado | Comportamento |
| :--- | :--- |
| `vazio inicial` | Nada é exibido antes de 2 caracteres |
| `carregando sugestões` | Skeleton de 3 linhas, discreto |
| `sem resultado` | "Nenhuma peça encontrada para «termo»" + sugestões de categoria |
| `erro` | Mensagem curta; a navegação continua funcionando |
| `foco` | Anel `--rv-focus-ring` |

### Integrações
- `GET /store/products?q=` (Medusa) — implementação inicial
- Mesma base de `listProductsWithSort`, para herdar região e moeda
- Header: `modules/layout/templates/nav/index.tsx` (campo novo ao lado das ações)

### Critérios de aceite
1. Digitar 2+ caracteres mostra sugestões em < 400 ms.
2. `Enter` leva a `/br/busca?q=` e os resultados correspondem ao termo.
3. A página de resultado **reutiliza** `PaginatedProducts` e `RefinementList` (verificável no código).
4. "saías" e "saias" retornam os mesmos resultados.
5. Busca falha → o header continua navegável; mensagem visível.
6. Mobile: a busca abre em tela cheia e fecha com "voltar".
7. Sugestões operáveis por teclado (setas, Enter, Esc).
8. A URL do resultado é compartilhável e preserva o termo.

---

## RV-006 — Frete automático e plugável ✅ FEITO

**Prioridade:** ALTA · **Tipo:** arquitetura + integração · **Complexidade:** média

> **⚠️ Este requisito foi reescrito.** A versão original propunha um contrato
> `ShippingAdapter` próprio e um registry no **frontend**, espelhando o padrão do pagamento.
> **Isso estava errado** — e a verificação do código do Medusa mostrou por quê.

### A correção

O frete tem uma arquitetura **fundamentalmente diferente** da do pagamento:

| | Pagamento | Frete |
| :--- | :--- | :--- |
| Cada provedor tem formato diferente? | **Sim** — Stripe redireciona, Pix mostra QR | **Não** — todo mundo devolve "preço + prazo" |
| Precisa de registry no frontend? | **Sim** (por isso existe `resolvePayment`) | **Não** |
| Onde vive a modularidade | Storefront **e** backend | **Só no backend** |

O checkout já consome `StoreCartShippingOption` do Medusa, que é **uniforme por definição**: toda
opção tem id, nome, preço e prazo. Não há nada para o frontend decidir, e portanto **nada para o
frontend abstrair**. Um `ShippingAdapter` + registry no storefront duplicaria o que o Medusa já faz —
seria inventar um sistema paralelo.

**A abstração do frete já vem pronta:** `AbstractFulfillmentProviderService` (em
`@medusajs/utils/dist/fulfillment/provider`), com os tipos em `@medusajs/types/fulfillment/`.

### O que foi entregue

Um **Fulfillment Provider real**, que calcula preço por peso × região:

| Arquivo | Papel |
| :--- | :--- |
| `backend/src/modules/fulfillment/tabela/tabela.ts` | A regra comercial — funções puras |
| `backend/src/modules/fulfillment/tabela/service.ts` | O provider que o Medusa chama |
| `backend/src/modules/fulfillment/tabela/index.ts` | `ModuleProvider(Modules.FULFILLMENT, …)` |
| `backend/src/modules/fulfillment/tabela/README.md` | Como ativar e como plugar uma transportadora |

Registrado em `medusa-config.ts`. **17 testes** sobre a regra.

**Os valores são FICTÍCIOS** e estão marcados como tal nos dois arquivos. Trocá-los é uma edição em
`tabela.ts` e nada mais — é o único lugar onde a regra comercial está escrita.

### Os três métodos que importam

| Método | Devolve | Quando o Medusa chama |
| :--- | :--- | :--- |
| `getFulfillmentOptions()` | `[{ id, name, is_return? }]` | No Admin, ao criar a opção |
| `canCalculate(data)` | `boolean` | Se a opção é de preço calculado |
| `calculatePrice(optionData, data, context)` | `{ calculated_amount, is_calculated_price_tax_inclusive }` | No checkout, a cada cálculo |

**O que entra em `context`** (verificado em `@medusajs/types/fulfillment/common/cart.d.ts`):

```ts
{
  shipping_address: { postal_code, city, province, country_code },
  items: [{ quantity, variant: { weight, length, height, width } }]
}
```

`calculated_amount` é **em centavos**.

### Regras de negócio
1. O preço do frete é **sempre calculado no backend**. O front nunca calcula frete.
2. **CEP inválido ou peso acima do limite falha — não devolve 0.** Zero na tela é frete grátis que a
   loja paga.
3. Peso zerado ou ausente cai na faixa **mais barata**: um produto sem peso cadastrado não pode
   custar mais que um leve.
4. Trocar de transportadora = **um `service.ts` + uma linha em `medusa-config.ts`**.
5. O provider `tabela` fica **inativo até uma shipping option ser criada para ele** no Admin —
   registrar não cria opção. Isso evita que valores fictícios apareçam na loja.

### Comportamento visual
**Nenhuma mudança.** As opções de envio do checkout (`modules/checkout/components/shipping`) já
consomem `StoreCartShippingOption`. O que muda é o valor — e ele passa a depender do peso e do
destino, em vez de ser fixo.

### Estados
`sem CEP` (pede antes de calcular) · `carregando` ("Calculando…") · `CEP inválido` · `sem opção` ·
`erro` — todos os quatro **já implementados** no checkout atual.

### Critérios de aceite
1. `tabela-nacional` aparece na lista do Admin quando o provider está registrado.
2. Criada a opção com `price_type: "calculated"`, o preço no checkout muda com o **peso** e o **CEP**.
3. CEP inválido não mostra preço 0 — a opção sai da lista.
4. Peso acima de 20kg não calcula.
5. Nenhum valor em reais onde se espera centavos (teste).
6. A tabela não tem buraco: todo par (região, faixa) tem número (teste).
7. Trocar de transportadora **não altera** carrinho, checkout, painel de envio nem `/rastreio`.

---

## RV-007 — Metadados de SEO e dados estruturados

**Prioridade:** ALTA · **Tipo:** funcional · **Complexidade:** baixa
**Depende de:** RV-003 (os textos traduzidos alimentam as descrições)

### Objetivo
Parar de vazar a marca do template no Google e dar presença técnica em busca orgânica.

### Descrição

**Vazamento verificado** — três arquivos usam `` `${title} | Medusa Store` ``:

| Arquivo | Linha | Correção |
| :--- | :--- | :--- |
| `products/[handle]/page.tsx` | 68, 71 | `${product.title} \| Real Valor` |
| `categories/[...category]/page.tsx` | 39, 44 | `${category.name} \| Real Valor` |
| `collections/[handle]/page.tsx` | 42 | `${collection.title} \| Real Valor` |

O template `%s | Real Valor` **já existe** em `app/layout.tsx:48` — basta remover o sufixo do título,
que o template é aplicado. Hoje o resultado é "… | Medusa Store | Real Valor".

**Pior que o título:** a descrição da PDP é `` description: `${product.title}` `` — literalmente o
título repetido. Nenhum texto alimenta a descrição.

**Ausências verificadas:** não existe `sitemap.ts`, não existe `robots.ts`, e não há nenhuma
ocorrência de `application/ld+json` ou `schema.org` no código.

**Arquivos propostos:**
- `frontend/src/app/sitemap.ts` *(proposto)*
- `frontend/src/app/robots.ts` *(proposto)*
- `frontend/src/components/product-jsonld.tsx` *(proposto)*

### Regras de negócio
1. **Título ≤ 60 caracteres.** Se exceder, truncar com sufixo curto.
2. **Descrição entre 120 e 158 caracteres.** Nunca repetir o título.
3. A descrição da PDP descreve a peça: tecido, caimento, ocasião. Fonte: `product.description` ou
   `metadata`, com fallback para um texto de marca — **nunca** o título.
4. **Nunca indexar:** checkout, carrinho, conta, pedido confirmado e páginas de busca com filtro.
   `noindex` explícito nessas rotas.
5. `sitemap.xml` inclui produtos ativos, categorias e coleções. Excluir produtos sem estoque é
   decisão do lojista, não técnica.
6. URLs com filtro (`?size=P`) declaram `canonical` para a versão sem filtro — evita duplicata.
7. O JSON-LD é gerado **no servidor** e usa `Product` + `Offer` com `priceCurrency: "BRL"` e
   `availability` derivada de `product-availability.ts` — a **mesma** função que decide o card.

### Comportamento visual
Nenhum efeito visual. São tags de `<head>`.

### Responsividade
Não se aplica.

### Estados
| Estado | Comportamento |
| :--- | :--- |
| `produto sem descrição` | Fallback para texto de marca; nunca o título |
| `produto sem imagem` | JSON-LD sem `image`; `og:image` cai para a imagem padrão da marca |
| `erro no sitemap` | Falha silenciosa; a página continua |

### Integrações
- `GET /store/products` para o sitemap (respeitando `region_id`)
- `generateMetadata` existente nas 3 rotas
- `NEXT_PUBLIC_BASE_URL` — já no `.env`, já usado por `metadataBase`

### Critérios de aceite
1. Nenhum título de página contém "Medusa".
2. Toda página com `metadata.title` tem descrição **diferente** do título.
3. `/sitemap.xml` responde 200 e lista produtos, categorias e coleções.
4. `/robots.txt` responde 200 e referencia o sitemap.
5. Checkout, carrinho, conta e pedido confirmado têm `noindex`.
6. A PDP emite JSON-LD `Product` válido (Rich Results Test).
7. `?size=P` declara `canonical` para a URL sem filtro.
8. Nenhum título passa de 60 caracteres.

---

## RV-008 — Parcelamento e Pix na vitrine

**Prioridade:** ALTA · **Tipo:** funcional · **Complexidade:** média
**Depende de:** RV-001, RV-002

### Objetivo
Exibir preço Pix e parcelamento **antes** da PDP, onde a decisão de preço acontece.

### Descrição

A referência mostra "R$189,91 com Pix" e "5x de R$39,98 sem juros" **no card** e no resumo. É a
razão de escolher o Mercado Pago — e precisa aparecer onde a cliente decide.

O dado vem do **adapter** (`describe(amount)`), nunca de hardcode. Trocar de provedor muda a
exibição sem tocar em componente.

**Arquivos:**
- `frontend/src/modules/products/components/product-preview/price.tsx` — estender
- `frontend/src/modules/checkout/components/payment-summary/` *(proposto)* — linha de parcelamento
- `frontend/src/modules/payment/components/installment-info.tsx` *(proposto)* — componente único

### Regras de negócio
1. O número de parcelas exibido é o que o provedor **aceita** para o valor e a bandeira — consultado,
   não estimado. Se o provedor não souber (adapter sem `describe`), **omitir** a linha.
2. "sem juros" só aparece se o provedor confirmar; caso contrário, "com juros de X%".
3. O desconto Pix é aplicado sobre o valor do produto (sem frete) e é refletido no total.
4. O desconto **não é aplicado duas vezes** — o valor exibido é o mesmo que vai para o pagamento.

### Comportamento visual
- No card: abaixo do preço à vista, em `rv-muted`, `text-xs`.
- No resumo do checkout: linha "Parcelamento" com "6x de R$ 89,90 sem juros".
- Selecionado Pix: o preço Pix passa a ser o preço em destaque, com "à vista" ou o desconto explícito.
- Nunca mais de 2 linhas — a informação é um resumo, não uma tabela.

### Responsividade
- Desktop: à direita do preço no card; no resumo do checkout.
- Mobile: abaixo do preço, em largura total; o resumo do checkout vem **abaixo** dos campos.

### Estados
- `sem parcelas` — linha omitida (não "0x")
- `erro na consulta` — linha omitida silenciosamente; o preço à vista nunca depende dela

### Integrações
- `adapter.describe(amount)` do registry de pagamento
- Valor do carrinho, sempre do backend

### Critérios de aceite
1. Cartão com parcelamento mostra "6x de R$ X sem juros".
2. Adapter sem `describe` omite a linha, sem erro.
3. O desconto Pix aparece uma única vez e bate com o total cobrado.
4. Trocar o provedor no registry muda a linha sem alterar o componente.

---

## RV-009 — Guia de medidas

**Prioridade:** ALTA · **Tipo:** funcional · **Complexidade:** média
**Depende de:** decisão de modelagem (pendente)

### Objetivo
Reduzir devolução por tamanho,provide acesso à tabela de medidas no ponto de decisão.

### Descrição

A referência posiciona "Guia de medidas" ao lado do seletor de tamanho — o ponto de maior dor.
Em moda, tamanho é a maior causa de devolução, e isso é perda direta.

**Atenção — decisão de modelagem pendente:** a tabela de medidas é **dado por produto**. Não existe
estrutura para isso hoje. Duas opções, ambas válidas:

| Opção | Quando | Custo |
| :--- | :--- | :--- |
| `metadata` do produto | Se a maioria das peças segue a mesma tabela | Baixo |
| Módulo próprio | Se cada peça tem medidas próprias | Alto |

**Recomendação:** começar por `metadata` (JSON por produto), com campo `size_guide` opcional. Se o
catálogo exigir tabelas distintas por peça, promover a módulo na Fase 3.

**Arquivos propostos:**
- `frontend/src/app/[countryCode]/(main)/guia-de-medidas/page.tsx` *(proposto)* — guia geral
- `frontend/src/modules/products/components/size-guide-link.tsx` *(proposto)*

### Regras de negócio
1. O link fica **ao lado do seletor de tamanho**, não escondido em menu.
2. Se o produto tiver tabela própria, o link abre a tabela do produto; senão, a guia geral.
3. A tabela é por **peça** (busto, cintura, quadril, comprimento) com colunas P/M/G.
4. Medidas em centímetros, com tolerância declarada.
5. Campo vazio → o link aponta para a guia geral, sem erro.

### Comportamento visual
- Link em `rv-eyebrow` rosa, logo abaixo do seletor.
- Página da guia: tabela em `rv-display` para os títulos, Montserrat para os números; Zebra sutil
  com `--rv-border`.
- Em mobile, a tabela rola horizontalmente **dentro de um contêiner** (não a página).

### Responsividade
- Desktop: tabela completa, até 3 colunas de tamanho lado a lado.
- Mobile: tabela em scroll horizontal com primeira coluna fixa; alternativa em acordeão por medida.

### Estados
- `sem tabela no produto` → link para a guia geral
- `sem nenhuma guia` → link oculto (nãobroken)

### Integrações
- `product.metadata.size_guide` ou módulo dedicado
- `option_select` / `product-actions` para posicionar o link

### Critérios de aceite
1. O link aparece ao lado do seletor de tamanho em toda PDP com variantes.
2. Produto com tabela própria abre a sua tabela; sem tabela, a geral.
3. A tabela é legível em 320px sem scroll da página inteira.
4. Medidas em cm com unidade visível no cabeçalho.

---

## RV-010 — Calculadora de frete na PDP

**Prioridade:** MÉDIA · **Tipo:** funcional · **Complexidade:** baixa
**Depende de:** RV-006

### Objetivo
Tirar a dúvida de frete do carrinho para a PDP, onde ela aparece antes do abandono.

### Regras de negócio
1. CEP válido (8 dígitos) → calcula e mostra opções com preço e prazo.
2. CEP inválido → "Não encontramos esse CEP. Está bem escrito?"
3. O valor é calculado **no backend** (mesma regra de RV-006).
4. O CEP fica em cookie para não redigitar no checkout (`lib/data/cookies.ts` já gerencia cookies).

### Comportamento visual
Bloco discreto abaixo do seletor de tamanho: campo de 8 dígitos + botão "Calcular". Resultado em
`rv-muted`, com preço em `.rv-price`.

### Responsividade
- Desktop: campo e botão na mesma linha.
- Mobile: campo em largura total; botão abaixo.

### Estados
`sem CEP` · `carregando` ("Calculando…") · `CEP inválido` · `sem opção` · `erro` (revela a página).

### Critérios de aceite
1. CEP válido mostra preço e prazo.
2. CEP inválido mostra mensagem, não quebra.
3. O CEP é reaproveitado no checkout.

---

## RV-011 — Badge de desconto e tamanhos no card

**Prioridade:** MÉDIA · **Tipo:** UI · **Complexidade:** baixa

### Objetivo
Tornar o card mais informativo: percentual de desconto e tamanhos disponíveis.

### Regras de negócio
1. Desconto calculado por `get-percentage-diff` (já existe) — **nunca** a string do catálogo.
2. Badge só aparece com desconto **real** (> 0). Nunca "0% OFF" — foi exatamente o defeito da
   referência.
3. Chips de tamanho **só** se o produto tiver mais de uma variante de tamanho, e apenas como
   informação: o card é um link único e não deve prometer uma ação que não executa.
4. "Outlet"/"Sale" no nome **não** é badge — o desconto vem do preço.

### Comportamento visual
- Badge: canto superior direito da foto, `bg-rv-preto`, texto branco, `text-xs`. O chip de status já
  ocupa o superior esquerdo (`ProductStatusChip`).
- Tamanhos: linha `text-xs` em `rv-muted` sob o preço, no formato "P · M · G".

### Estados
`sem desconto` (badge oculto) · `sem variação de tamanho` (chips ocultos) · `produto esgotado`
(chip de status visível, badge oculto).

### Critérios de aceite
1. Produto com desconto real mostra badge correto.
2. Produto sem desconto **não** mostra badge.
3. Produto de tamanho único **não** mostra chips.

---

## RV-012 — Newsletter no rodapé

**Prioridade:** MÉDIA · **Tipo:** funcional · **Complexidade:** média

### Objetivo
Capturar contato para divulgação — e cumprir a expectativa de loja de marca.

### Regras de negócio
1. O campo de captura é **editável pelo CMS** (novo tipo de seção no contrato), não hardcoded.
2. E-mail inválido → mensagem em pt-BR, sem sumir a referência.
3. Sucesso → confirmação clara; **não** redirecionar.
4. Duplicidade → "Você já está na nossa lista."
5. Consentimento explícito (LGPD): checkbox não pré-marcado + link para a política.
6. A lista **não** é usada para spam.

### Comportamento visual
Faixa antes do rodapé: título em `rv-display`, campo e botão em linha, fundo `--rv-surface`.

### Responsividade
- Desktop: título à esquerda, formulário à direita na mesma linha.
- Mobile: empilhado, campo em largura total, botão abaixo.

### Estados
`vazio` · `enviando` (botão em loading) · `sucesso` · `erro` · `duplicado`.

### Integrações
**Proposta, não definida** — requer escolher: Medusa (assinantes) ou serviço externo (Buttondown,
Mailchimp, MailerLite). **Decisão comercial pendente.**

### Critérios de aceite
1. O bloco aparece e desaparece pelo CMS, sem deploy.
2. E-mail inválido não é aceito; mensagem em pt-BR.
3. Consentimento não vem pré-marcado.
4. O sucesso é confirmado na tela.

---

## RV-013 — Ordenação e rótulos do catálogo

**Prioridade:** MÉDIA · **Tipo:** UX · **Complexidade:** baixa

### Objetivo
Alinhar a ordenação à prática de e-commerce de moda e todos os rótulos ao pt-BR.

### Regras de negócio
1. Adicionar **"Mais vendidos"** e **"Maior desconto"** — são os dois critérios que a cliente de moda
   mais usa e que hoje não existem.
2. Manter `sortBy` na URL (padrão existente) — `router.push` já está em `refinement-list`.
3. Rótulos pt-BR: "Mais recentes", "Menor preço", "Maior preço", "Mais vendidos", "Maior desconto".
4. A ordenação atual **reinicia a paginação** para a página 1 ao mudar.
5. No mobile, a ordenação fica em um seletor compacto acima da grade (não uma coluna lateral).

### Comportamento visual
Desktop: `FilterRadioGroup` já existente, com rótulos pt-BR. Mobile: `native-select` com os mesmos.

### Estados
`padrão` (Mais recentes) · `carregando` (a grade mantém os skeletons) · `sem resultado`.

### Integrações
- `listProductsWithSort` — estender com `order` para vendas e desconto
- `get-percentage-diff` para ordenar por desconto

### Critérios de aceite
1. "Mais vendidos" e "Maior desconto" aparecem na lista.
2. Trocar a ordenação leva à página 1.
3. Nenhum rótulo em inglês.
4. A ordenação no mobile é um seletor compacto.

---

## Bloco de pedido e envio

> **Contexto comum.** A jornada tem **três sistemas distintos**, e vale não misturá-los:
>
> ```
> PAGAMENTO          PEDIDO                 ENVIO
> ─────────          ──────                 ─────
> MP aprova o        Medusa cria            Transportadora gera
> pagamento   ──▶    o pedido e reserva  ──▶ o código  ──▶ Admin registra  ──▶ Cliente
> (webhook)          o estoque                                      consulta
> ```
>
> **Ponto central:** a transportadora responde **"onde está o pedido?"**, não "o pedido existe?".
> Pagamento, reserva e tela de acompanhamento são anteriores e posteriores ao frete — o frete é só um
> dos dados do pedido. É por isso que RV-042 a RV-045 **não dependem** de qual transportadora for
> escolhida, e podem ser construídos agora.

---

## RV-042 — Captura do pagamento e reserva de estoque

**Prioridade:** CRÍTICA · **Tipo:** funcional + backend · **Complexidade:** média
**Depende de:** RV-002 (Mercado Pago)

### Objetivo
Garantir que o pagamento aprovado vire um pedido com estoque reservado, e que pagamento recusado
libere o estoque — sem pedido duplicado e sem estoque preso.

### Descrição

**Verificado na auditoria:** `backend/src/workflows/` **não existe** — este fluxo é código novo, não
adaptação. O único subscriber é `order-customer-indexer.ts`, que apenas indexa pedido na conta.

O webhook do MP (RV-002) recebe `approved` e precisa disparar a criação do pedido no Medusa.

**Arquivos propostos:**
- `backend/src/workflows/create-order-from-payment/index.ts` *(proposto)*
- `backend/src/subscribers/mercadopago-payment-updated.ts` *(proposto)*

### Regras de negócio
1. **Só `approved` e `authorized` criam pedido.** `in_process` (Pix, boleto) mantém aguardando.
2. **Reserva de estoque na criação do pedido**, não no clique — evita pedido pago e depois cancelado.
3. **`rejected` / `cancelled` liberam o estoque** imediatamente.
4. **Idempotência:** um `payment_id` só cria **um** pedido. Reenvio do webhook não duplica.
5. **O valor vem do pagamento aprovado na API do MP**, nunca do carrinho do navegador.
6. O pedido nasce em `payment_pending` → `ready_to_fulfill` quando o pagamento é capturado.
7. Cliente sem conta é Guest — **não** exigir cadastro para comprar.

### Estados
| Estado MP | Ação | Estado do pedido |
| :--- | :--- | :--- |
| `pending` | nada | inexistente |
| `in_process` | nada | aguardando (visível à cliente) |
| `approved` | cria pedido + reserva | `ready_to_fulfill` |
| `authorized` | cria pedido + reserva | `ready_to_fulfill` |
| `rejected` | nada | inexistente |
| `cancelled` | libera estoque | cancelado |
| `refunded` | estorno | reembolsado |

### Critérios de aceite
1. Pix aprovado gera **um** pedido com estoque reservado.
2. Webhook repetido **não** duplica o pedido.
3. `rejected` não cria pedido.
4. Compra sem login funciona (Guest).
5. O valor do pedido bate com o do pagamento na API do MP.

---

## RV-043 — Painel de envio (registro de rastreio)

**Prioridade:** ALTA · **Tipo:** funcional + CMS · **Complexidade:** baixa
**Depende de:** nenhuma · **Independe da transportadora: SIM**

### Objetivo
Dar ao lojista onde registrar o código de rastreio — porque **hoje ninguém escreve esse campo**.

### Descrição

**Lacuna verificada e grave:** a rota `GET /store/orders/track` lê
`order.metadata.tracking_number`, `.tracking_url`, `.carrier` e `.status_label` — mas **um grep por
esses nomes no backend não retorna nenhum resultado fora da própria rota**. É um campo lido e nunca
gravado. A rota existe e funciona; **quem alimenta os dados, não existe**.

Sem este requisito, a cliente consulta o rastreio e vê sempre `null`.

**Regra de desenho (crítica):** os campos devem ser **genéricos e em texto livre** — `carrier`,
`tracking_number`, `tracking_url` — **sem lista suspensa de transportadoras**. Se o campo for
modelado para a transportadora escolhida hoje, a decisão de amanhã obriga a refatorar o painel.

**Opções de implementação:**
| Onde | Como |
| :--- | :--- |
| **Admin do Medusa** (recomendado) | Campo em `order.metadata` no Admin padrão — menos código |
| `admin/` (CRM) | Se quiser o mesmo padrão do CMS de conteúdo |

### Regras de negócio
1. **Texto livre**, com validação de formato apenas quando reconhecível (ex.: Correios `AA123456789BR`).
2. `tracking_url` opcional: se vazio, montar a partir do padrão do carrier escolhido.
3. `status_label` editável, com valor padrão "Em processamento".
4. Salvar dispara **RV-045** (notificação).
5. Campos **preservados** em qualquer operação posterior no pedido.
6. Todos os pedidos com `ready_to_fulfill` **aparecem** na lista de envios.

### Estados
`sem código` (não exibir campo) · `salvando` · `salvo` · `código inválido` (aviso, não bloqueio).

### Critérios de aceite
1. O admin registra `carrier`, `tracking_number` e `tracking_url`.
2. A rota de track passa a devolver esses valores.
3. **Nenhum campo assume transportadora específica.**
4. `status_label` tem valor padrão.
5. Salvar não apaga itens nem endereço do pedido.

---

## RV-044 — Página pública de rastreio

**Prioridade:** ALTA · **Tipo:** funcional + UI · **Complexidade:** baixa
**Depende de:** RV-043 · **Independe da transportadora: SIM**

### Objetivo
Dar à cliente, sem login, um lugar para consultar o andamento do pedido — consumindo a rota que já
existe.

### Descrição

A rota `GET /store/orders/track` está **completa e bem desenhada**: aceita `display_id` + CPF **ou**
e-mail, valida a identidade (**403** quando não bate), e devolve status, itens, endereço sanitizado e
rastreio. O que falta é a **tela**.

**Acesso sem login é decisão de conversão:** exigir cadastro para consultar o próprio pedido gera
abandono e mensagens de suporte.

**Arquivos propostos:**
- `frontend/src/app/[countryCode]/(main)/rastreio/page.tsx` *(proposto)*
- `frontend/src/modules/order/components/track-form.tsx` *(proposto)*
- `frontend/src/modules/order/components/track-timeline.tsx` *(proposto)*

### Regras de negócio
1. Consulta por **número do pedido + (CPF ou e-mail)** — o mesmo contrato da rota existente.
2. **Link no rodapé** e no menu de conta ("Acompanhar pedido").
3. Sem `tracking_number`: mostrar status do pedido e **não** exibir bloco de rastreio (não quebrar).
4. **Nunca** expor dados de outro pedido — a validação 403 já existe e vale para a tela.
5. O link `tracking_url` abre em nova aba, com `rel="noopener noreferrer"`.

### Comportamento visual
- Título em `rv-display`; formulário com dois campos grandes (nº do pedido + CPF/e-mail).
- Linha do tempo: `Em processamento` → `Enviado` → `Entregue`, com o `status_label` do pedido.
- Bloco de rastreio com transportadora e código copiável.

### Estados
`inicial` · `carregando` · `encontrado com rastreio` · `encontrado sem rastreio` · `não encontrado`
(404 amigável) · `identificação não confere` (403 → "Verifique o CPF/e-mail") · `erro`.

### Critérios de aceite
1. Consulta correta mostra pedido, itens e status.
2. CPF/e-mail errado → mensagem clara, sem vazar dados.
3. Pedido sem rastreio mostra status, sem bloco vazio.
4. Funciona sem login.
5. Acessível por teclado, com `aria-live` no resultado.

---

## RV-045 — Notificação de envio à cliente

**Prioridade:** MÉDIA · **Tipo:** funcional · **Complexidade:** média
**Depende de:** RV-043 · **Independe da transportadora: SIM**

### Objetivo
Avisar a cliente quando a peça saiu, com o código de rastreio — reduzindo "cadê meu pedido?".

### Regras de negócio
1. Dispara **quando** o admin salva `tracking_number` pela primeira vez.
2. Não reenvia em edições posteriores do mesmo código.
3. Falha de envio **não** desfaz o salvamento do rastreio — são operações independentes.
4. Envio por e-mail transacional; se não houver provider (ver 8.4.4), registrar como pendência.

### Critérios de aceite
1. Salvar o código pela primeira vez dispara a notificação.
2. Re-salvar o mesmo código **não** reenvia.
3. Falha no e-mail não perde o rastreio.

---

## RV-046 — Transportadora real

**Prioridade:** BAIXA · **Tipo:** integração · **Complexidade:** média
**Depende de:** **decisão comercial** · **BLOQUEADO — transportadora não escolhida**

### Objetivo
Trocar o preço da tabela por cotação real, quando houver transportadora com API.

### Estado atual
**Bloqueado por decisão externa — mas não bloqueia nada mais.** A camada já está pronta e
comprovada: o provider `tabela` (RV-006) calcula preço por peso × região e está registrado no
`medusa-config.ts`. A loja já é vendável com ele.

### O que será feito quando houver decisão
1. Escrever `backend/src/modules/fulfillment/<transportadora>/service.ts` seguindo o mesmo formato
   do `tabela` — três métodos: `getFulfillmentOptions()`, `canCalculate()`, `calculatePrice()`.
2. Registrar em `medusa-config.ts` — **mais nada**.
3. Criar a shipping option no Admin apontando para o provider novo.
4. Desligar a tabela, se ela deixar de ser usada.
5. Se for integração por **API**, avaliar polling de status — o Medusa não avisa mudanças de status
   sozinho (ver "O que não existe").

### O que NÃO precisa ser feito
Carrinho, checkout, painel de envio e `/rastreio` **não mudam**. Todos leem `StoreCartShippingOption`
ou `order.metadata`, e `carrier` lá é texto livre de propósito.

### O que a transportadora precisa ter
- API com consulta por CEP e peso (ou um link de consulta, que basta para rastreio);
- tabela ou API de prazos por região;
- peso dos produtos cadastrado no Medusa — **sem isso não há cálculo possível**, e é um trabalho de
  cadastro, não de integração;
- se houver mais de um fornecedor por região, avaliar **split de fulfillment** (vários pedidos).

### Critérios de aceite
1. Carrinho e checkout **não são alterados** ao plugar a transportadora.
2. Preço e prazo reais para CEP de teste.
3. Nenhum consumidor precisa conhecer o nome da transportadora.

---

## 4.14 Requisitos verificados como já atendidos

Registrados para que **não sejam reimplementados**:

| Requisito | Onde já está |
| :--- | :--- |
| Home dirigida por conteúdo | `(main)/page.tsx` + `@rv/contrato` |
| Header e rodapé editáveis | `layout/templates/nav` e `footer` |
| Chips de categoria na vitrine | `featured` com filtros (schema v5) |
| Carrinho completo | `modules/cart/` + `lib/data/cart.ts` |
| Cupom de desconto | `modules/checkout/components/discount-code` |
| Aviso de frete grátis | `modules/shipping/components/free-shipping-price-nudge` |
| Pedido confirmado e rastreio | `order/[id]/confirmed` + `/store/orders/track` |
| Conta do cliente | `modules/account/` + `account/@dashboard` |
| Skeletons | `modules/skeletons/` (10 componentes) |
| Estados vazios | `empty-cart-message`, `not-found` em 4 rotas |
| Tema sazonal | `lib/theme.ts` + 4 `theme.json` |
| CMS com upload e paleta | `admin/…/routes/content` |
| Fontes self-hosted | `src/app/fonts/` + `scripts/vendor-fonts.mjs` |
| Testes com CI | **790 testes** em 3 runners (386 backend · 70 CRM · 334 storefront) |
| Purge de cache | `POST /api/revalidate` com `REVALIDATE_SECRET` |

**Conclusão:** nenhum destes entra em backlog. O backlog em `09-backlog-implementacao.md` cobre
apenas o que falta.