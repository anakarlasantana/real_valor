# 08 — Arquitetura e Integrações

Mapeamento frontend × backend (seção 8), arquivos impactados (seção 9) e o desenho da camada modular
de pagamento e frete.

---

## 8.1 Mapa frontend × backend

**Legenda:** ✅ implementado · ⚠️ parcial · ❌ ausente

| Funcionalidade | Frontend | Backend | Integração | Situação |
| :--- | :--- | :--- | :--- | :--- |
| Home por conteúdo | ✅ `(main)/page.tsx` | ✅ `/store/content` | ✅ | **Pronto** |
| CMS da vitrine | ✅ `admin/…/content` | ✅ `/admin/content` | ✅ | **Pronto** |
| Tema sazonal | ✅ `lib/theme.ts` | ✅ payload de tema | ✅ | **Pronto** |
| Lista de produtos | ✅ `paginated-products` | ✅ Store API | ✅ | **Pronto** |
| **Filtros** | ❌ | ✅ `option_value` na Store API | ❌ | **A implementar** |
| **Busca** | ❌ | ⚠️ `q` existe na Store API | ❌ | **A implementar** |
| Detalhe do produto | ✅ `products/[handle]` | ✅ | ✅ | **Pronto** |
| Variantes e estoque | ✅ `product-actions` | ✅ | ✅ | **Pronto** |
| Carrinho | ✅ `lib/data/cart.ts` (473 linhas) | ✅ | ✅ | **Pronto** |
| Cupom | ✅ `discount-code` | ✅ | ✅ | **Pronto** |
| Opções de frete | ✅ `shipping/` | ✅ `fulfillment-manual` | ✅ | **Pronto** |
| Checkout (formulário) | ✅ 20 componentes | ✅ | ✅ | **Pronto** |
| **Pagamento** | ⚠️ `payment-button` (Stripe) | ❌ **sem provider** | ❌ | **A implementar** |
| Conta do cliente | ⚠️ `modules/account` | ✅ | ✅ | **Parcial** |
| Pedido confirmado | ✅ `order/…/confirmed` | ✅ | ✅ | **Pronto** |
| Rastreio | ✅ | ⚠️ `/store/orders/track` | ⚠️ | **A confirmar** |
| `checkout-info` | ❌ | ⚠️ rota existe | ❌ | **Órfã?** |
| Newsletter | ❌ | ❌ | ❌ | **A implementar** |
| SEO técnico | ⚠️ metadata existe | — | — | **A implementar** |
| Armazenamento de imagem | ✅ `resolveMediaUrl` | ⚠️ `file-local` | ✅ | **Parcial** |

**Duas linhas precisam de confirmação antes de qualquer decisão:**
- `/store/orders/track` — o backend expõe, mas **não localizei consumo no frontend**.
- `/store/custom/checkout-info` — idem.

Podem ser código morto ou consumo externo. **Não remover sem confirmar.**

---

## 8.2 Arquivos impactados por requisito

Conforme a seção 9 do briefing. Arquivos marcados *(proposto)* **não existem**.

### RV-001 — Camada de abstração de pagamento

**Existentes relacionados:**
- `frontend/src/lib/constants.tsx` — `paymentInfoMap`, `isStripeLike`, `isPaypal`, `isManual`
- `frontend/src/modules/checkout/components/payment-button/index.tsx` — `switch` por tipo (linha 30)
- `frontend/src/modules/checkout/components/payment/index.tsx` — seleção de meio
- `frontend/src/modules/checkout/components/payment-container/index.tsx` — `StripeCardContainer`
- `frontend/src/lib/data/payment.ts` — `listCartPaymentMethods`
- `packages/contrato/src/index.ts` — exporta o contrato

**Novos propostos:**
- `packages/contrato/src/payment.ts` *(proposto)* — `PaymentAdapter`, `PaymentResult`
- `frontend/src/lib/payments/types.ts` *(proposto)*
- `frontend/src/lib/payments/registry.ts` *(proposto)*
- `frontend/src/lib/payments/resolve.ts` *(proposto)*
- `frontend/src/lib/payments/adapters/stripe/index.ts` *(proposto)* — migra o que existe
- `frontend/src/lib/payments/adapters/manual/index.ts` *(proposto)*
- `frontend/src/lib/payments/adapters/unsupported/index.ts` *(proposto)*

**Dependências:** Store API de pagamentos; `@rv/contrato`; `check-boundaries.mjs` estendido.

### RV-002 — Adapter Mercado Pago

**Existentes:**
- `backend/medusa-config.ts` — onde o provider é registrado
- `backend/package.json` — onde entra a dependência
- `backend/src/scripts/seed.ts:183` — `payment_providers` da região
- `.env.example` — variáveis

**Novos propostos:**
- `backend/src/modules/payment/mercadopago/provider.ts` *(proposto)*
- `backend/src/modules/payment/mercadopago/service.ts` *(proposto)*
- `backend/src/api/webhooks/mercadopago/route.ts` *(proposto)*
- `frontend/src/lib/payments/adapters/mercadopago/index.ts` *(proposto)*
- `frontend/src/lib/payments/adapters/mercadopago/pix-modal.tsx` *(proposto)*

**Dependências:** credenciais do MP; URL pública para o webhook; core-flows do Medusa.

### RV-003 — Idioma

**Existentes:** todos os listados na tabela da RV-003 — 8 arquivos de página, 5 componentes.
**Novos:** nenhum (substituição de literais).

### RV-004 — Filtros

**Existentes:**
- `frontend/src/modules/store/components/refinement-list/index.tsx` (41 linhas)
- `frontend/src/modules/store/components/refinement-list/sort-products/index.tsx`
- `frontend/src/modules/store/templates/index.tsx`
- `frontend/src/modules/store/templates/paginated-products.tsx`
- `frontend/src/app/[countryCode]/(main)/categories/[...category]/page.tsx`
- `frontend/src/lib/data/products.ts`
- `frontend/src/modules/common/components/filter-radio-group/index.tsx` — base a reaproveitar

**Novos propostos:**
- `frontend/src/lib/data/facets.ts` *(proposto)*
- `frontend/src/modules/store/components/refinement-list/facets/` *(proposto)*

**Dependências:** Store API com `option_value`; query string (padrão já existente).

### RV-005 — Busca

**Existentes:**
- `frontend/src/modules/layout/templates/nav/index.tsx` — onde entra o campo
- `frontend/src/modules/store/templates/index.tsx` — template a reaproveitar
- `frontend/src/lib/data/products.ts` — `listProductsWithSort`

**Novos propostos:**
- `frontend/src/lib/data/search.ts` *(proposto)*
- `frontend/src/modules/search/components/` *(proposto)*
- `frontend/src/app/[countryCode]/(main)/busca/page.tsx` *(proposto)*

### RV-006 — Frete

**Existentes:**
- `backend/src/scripts/seed.ts:247-259` — `fulfillment-manual`, shipping profile
- `frontend/src/modules/checkout/components/shipping/`
- `frontend/src/lib/data/fulfillment.ts`

**✅ CORRIGIDO — o que foi feito, e o que não foi necessário.**

A proposta original era um contrato `ShippingAdapter` em `packages/contrato/src/shipping.ts` mais um
registry em `frontend/src/lib/shipping/registry.ts`. **Nenhum dos dois foi criado**, porque o Medusa já
entrega o contrato pronto:

- `AbstractFulfillmentProviderService` (`@medusajs/utils/dist/fulfillment/provider`);
- tipos em `@medusajs/types/fulfillment/`;
- registro via `ModuleProvider(Modules.FULFILLMENT, { services: [...] })`.

E o frontend **não precisa de registry**: `StoreCartShippingOption` já é uniforme.

**Frete é o oposto de pagamento.** No pagamento os providers são genuinamente diferentes (Stripe
redireciona, Pix mostra QR), e é por isso que `resolvePayment` existe. No frete todo mundo devolve
"preço + prazo" — não há decisão para o frontend tomar. Um registry de frete seria um sistema paralelo.

**O que existe:**

| Caminho | Papel |
| :--- | :--- |
| `backend/src/modules/fulfillment/tabela/tabela.ts` | Regra comercial (peso × região), funções puras |
| `backend/src/modules/fulfillment/tabela/service.ts` | O provider que o Medusa chama |
| `backend/src/modules/fulfillment/tabela/index.ts` | `ModuleProvider(Modules.FULFILLMENT, …)` |
| `backend/src/modules/fulfillment/tabela/README.md` | Ativação e como plugar uma transportadora |

Registrado em `medusa-config.ts`, com **17 testes** sobre a regra. Preços **fictícios** por enquanto —
a regra comercial está isolada em um arquivo só, para ser trocada quando houver transportadora.

> **O que não existe no Medusa:** webhook de frete. Se uma transportadora mudar o preço depois da
> cliente pagar, a loja **não descobre**. Com a tabela isso não ocorre; com API real, passa a ser
> conciliação manual. Decisão consciente — revisar quando houver transportadora.

### RV-007 — SEO

**Existentes a corrigir:**
- `products/[handle]/page.tsx:68,71` · `categories/[...category]/page.tsx:39,44` ·
  `collections/[handle]/page.tsx:42`
- `app/layout.tsx:44-66` — `metadataBase` e Open Graph (reutilizar)

**Novos propostos:**
- `frontend/src/app/sitemap.ts` *(proposto)*
- `frontend/src/app/robots.ts` *(proposto)*
- `frontend/src/components/product-jsonld.tsx` *(proposto)*

---

## 8.3 Arquitetura da camada de pagamento

### 8.3.1 O problema que ela resolve

O registro atual é **acoplado ao provedor por tipo**:

```
constants.tsx:  paymentInfoMap  { "pp_stripe_stripe": {...}, pp_paypal_paypal: {...} }
                isStripeLike()  id.startsWith("pp_stripe_")
payment-button: switch { isStripeLike → StripePaymentButton; isManual → … }
```

Adicionar o Mercado Pago exigiria: adicionar ao mapa, criar `isMercadoPago()`, e um **terceiro ramo**
no `switch` — com um caso especial porque o MP redireciona e o Stripe tokeniza. Em cinco provedores
o arquivo vira um `switch` com cinco caminhos e testes manuais para cada um.

### 8.3.2 A inversão

```
ANTES:  componente  →  if (tipo)  →  implementação
DEPOIS: componente  →  registry.get(id)  →  adapter (polimórfico)
```

O componente passa a perguntar **"quem responde por este id?"**, não "que tipo é este?".

### 8.3.3 Fluxo de uma troca de provedor

```
1. backend/package.json: adicionar @medusajs/payment-mercadopago
2. backend/medusa-config.ts: registrar o módulo
3. .env: MP_ACCESS_TOKEN=...
4. frontend/src/lib/payments/adapters/mercadopago/index.ts: escrever o adapter
5. frontend/src/lib/payments/registry.ts: registrar
```

**Nada em `modules/checkout/`, `brand.css`, layout ou copy é tocado.** Esse é o critério de aceite
que define se a abstração funcionou.

### 8.3.4 Como a fronteira é mantida

O projeto já tem o padrão: `scripts/check-boundaries.mjs` garante que o painel importe **tipo, nunca
valor** do backend. A regra é imposta por verificação, não por convenção — e roda no hook de commit
em segundos, sem instalar nada.

**Regra nova a adicionar:** `modules/checkout/` não importa `lib/payments/adapters/` diretamente.
Só o registry é importável.

```
$ node scripts/check-boundaries.mjs   # hoje: painel ⇔ backend
$ node scripts/check-boundaries.mjs   # depois: + checkout ⇔ adapters
```

> **Por que isso importa a longo prazo:** sem a guarda, o primeiro adapter escrito "só para não perder
> tempo" importa direto do componente, e no quarto adapter o `switch` volta. A verificação é o que
> impede a abstração de se dissolver — o mesmo motivo pelo qual a guarda de paridade por texto foi
> mantida até os testes a substituírem.

### 8.3.5 Onde o contrato vive

`PaymentAdapter` e `PaymentResult` em `packages/contrato/src/payment.ts`, **junto do contrato de
conteúdo**. Três razões:

1. **Coerência:** o repositório já tem um lugar para contratos compartilhados.
2. **Compilador como guarda:** backend e storefront não podem divergir — é o que eliminou a guarda de
   paridade por texto no G4.
3. **Baixo atrito:** o workspace Yarn já resolve o pacote nos três runtimes.

---

## 8.4 Integrações externas

### 8.4.1 Pagamento — Mercado Pago

**Dependências de configuração (não de código):**

| Item | Onde | Observação |
| :--- | :--- | :--- |
| `MP_ACCESS_TOKEN` | `.env` do backend | **Nunca** no `NEXT_PUBLIC_*`. O prefixo decide **só** `init_point` vs `sandbox_init_point` — **não** diz se a conta é de teste |
| `MP_AMBIENTE` | `.env` do backend | *(✅ acrescentado)* `teste`/`producao`. Ausente = `teste`. É **declarado**, não deduzido — ver o aviso abaixo |
| `MP_WEBHOOK_SECRET` | `.env` do backend | Segredo da assinatura (Painel → Notificações) |
| `MP_WEBHOOK_SECRET_TEST` | `.env` do backend | Quando o de teste for outro. Os dois são tentados |
| `MP_WEBHOOK_TOLERANCIA_SEGUNDOS` | `.env` do backend | Janela do `ts` na assinatura. Padrão 1800; `0` desliga |
| `MP_NOTIFICATION_URL` | `.env` do backend | **URL pública com HTTPS**, terminando em `/webhooks/mercadopago` |
| `MP_BACK_URL` | `.env` do backend | Retorno da cliente. Aponta para `/pedido/confirmacao` |
| `INTERNAL_API_SECRET` | `.env` dos **dois** serviços | *(✅ acrescentado)* Autentica `GET /internal/orders/by-cart`. **Não** reaproveita o `REVALIDATE_SECRET` |

> ⚠️ **O prefixo do token NÃO diz se ele é de teste.** A documentação do Mercado
> Pago é explícita: *"The test Access Token starts with the prefix **APP_USR**,
> just like your production Access Token."* Ou seja, `APP_USR-` é o formato da
> credencial de **teste** também — só `TEST-` (credencial antiga de aplicação) é
> inequívoco, e a ausência dele **não** prova produção.
>
> Medido nesta conta: um token `APP_USR-` cujo `GET /users/me` devolve
> `nickname: TESTUSER7358975069611479993` e `tags: [user_product_seller,
> test_user, normal]`. O log de boot o anunciava como "produção".
>
> Por isso o ambiente é **declarado** em `MP_AMBIENTE`. O provider **recusa** a
> combinação perigosa (`producao` + `TEST-` — a loja no ar sem cobrar ninguém), em
> vez de só avisar; o caso espelhado (`teste` + `APP_USR-`) emite aviso e segue,
> porque `APP_USR-` de conta de teste é legítimo. As duas decisões e o log de boot
> estão em `backend/src/modules/payment/mercadopago/credenciais.ts`; a matriz de
> casos, em `__tests__/credenciais.unit.spec.ts`.

> ⚠️ **`MP_BACK_URL` não é `/order/[id]/confirmed`.** No Checkout Pro o `{id}` não
> existe do lado do navegador no momento do retorno — o pedido é criado pelo
> webhook. A cliente volta para `/pedido/confirmacao`, que consulta o backend
> (`/api/pedido/status`, por cookie httpOnly) e só então troca a URL.

> ⚠️ **Nunca aponte `MP_NOTIFICATION_URL` para `/hooks/payment/...`.** Aquela é a
> rota nativa do Medusa, que **não valida assinatura nenhuma** (ela não conhece
> provedor) e responde `400` com `err.message` no corpo. Este projeto devolve
> `404` nela de propósito.

**O que a modalidade escolhida (Point / Pro / Advanced) define:**
- se há parcelamento sem juros e em quantas parcelas;
- se o Pix tem desconto e se ele é obrigatório na preference;
- se há split (receba por vendedor).

> **Este documento não assume uma modalidade.** O adapter é o mesmo; o que muda é a configuração da
> preference e o que o `describe()` retorna. A decisão é comercial (item em `03-gap-analysis.md`).

#### 8.4.1.1 Estado da configuração — feita

A preparação de ambiente **já foi executada** (sem código de aplicação):

| Onde | O que foi feito |
| :--- | :--- |
| `.env.example` | Bloco "Pagamento — Mercado Pago" com as **7** chaves e a origem de cada uma |
| `.env.example` | Bloco novo de `INTERNAL_API_SECRET`, com o porquê de **não** ser o `REVALIDATE_SECRET` |
| `.env.example` | Removida `NEXT_PUBLIC_STRIPE_KEY` (o Stripe saiu do escopo) |
| `docker-compose.yml` | As `MP_*` declaradas no `environment:` do backend, **sem default** |
| `docker-compose.yml` | `INTERNAL_API_SECRET` declarado nos **dois** serviços (o backend compara, o frontend envia) |
| `docker-compose.yml` | Removida `NEXT_PUBLIC_STRIPE_KEY` dos `args` de build do frontend |
| `.env` (local, ignorado pelo Git) | Chaves adicionadas, vazias |

#### 8.4.1.1.1 O código — implementado

| Arquivo | Papel | Puro? |
| :--- | :--- | :--- |
| `mercadopago/credenciais.ts` | leitura das variáveis; **nenhum default** | lê env |
| `mercadopago/assinatura.ts` | HMAC-SHA256 do manifesto, `timingSafeEqual` | ✅ |
| `mercadopago/redigir.ts` | o que pode sair de um pagamento (lista fechada, anti-PII) | ✅ |
| `mercadopago/preferencia.ts` | o documento da preference | ✅ |
| `mercadopago/contexto.ts` | o contrato rota ⇄ provider | ✅ |
| `mercadopago/cliente.ts` | as duas chamadas HTTP (`preferences`, `payments`) | rede |
| `mercadopago/service.ts` | o provider (`AbstractPaymentProvider`) | misto |
| `mercadopago/webhook.ts` | o handler compartilhado pelas rotas | misto |
| `mercadopago/{pix,cartao}/index.ts` | os dois `ModuleProvider` | ✅ |
| `api/webhooks/mercadopago/{route.ts,[metodo]/route.ts}` | as rotas públicas | HTTP |
| `api/hooks/payment/[provider]/route.ts` | **404** — desliga a rota nativa do Medusa | HTTP |
| `api/internal/orders/by-cart/route.ts` | consulta interna autenticada por segredo | HTTP |
| `lib/payments/adapters/mercadopago/*` | os dois adapters do storefront | ✅ |
| `app/api/pedido/status/route.ts` | proxy cookie → segredo → backend | HTTP |
| `app/[countryCode]/(main)/pedido/confirmacao/page.tsx` | espera o webhook e redireciona | cliente |

**O que a implementação descobriu (e que não estava neste documento):**

1. **O loader do `payment` SOMA os providers; o do `fulfillment` SUBSTITUI.** É a
   diferença que decide se o `pp_system_default` precisa ser re-declarado (não
   precisa) e por que a config do fulfillment re-declara o `manual` (precisa).
2. **`pp_system_default` é re-habilitado a cada boot** por `registerProvidersInDb`.
   Desligá-lo no Admin **não gruda** — e ele é um meio que cria pedido sem cobrar.
   Está registrado como o item 1 da lista de produção do README do módulo.
3. **O identificador é montado em runtime** pelo loader
   (`` `pp_${identifier}${id ? `_${id}` : ""}` ``), com o `id` vindo do **item do
   config**. Daí dois módulos, e daí o `registro.unit.spec.ts` comparar config ⇄
   classe ⇄ contrato.
4. **A rota nativa `/hooks/payment/:provider` existe e continua existindo** —
   confirmada em `backend/node_modules/@medusajs/medusa/dist/api/hooks/`. Ela não
   valida assinatura e responde `400` com `err.message`.
5. **A idempotência não precisa de marca nossa** — as três guardas estão no
   framework (ver 04-requisitos-funcionais.md).

**Três decisões de segurança registradas na própria configuração:**

1. **Nenhuma variável do MP tem prefixo `NEXT_PUBLIC_`.** Esse prefixo **inlina o valor no bundle do
   navegador** — o access token da loja ficaria público para qualquer visitante. O MP é 100%
   server-side: o storefront só recebe a URL de redirecionamento.
2. **As `MP_*` não têm valor padrão no Compose** (o mesmo critério do `REVALIDATE_SECRET`). Preencher o
   `.env` não basta se o Compose não declarar a variável — **cada serviço declara explicitamente**.
   Sem token, o container sobe e o pagamento responde "indisponível" com mensagem, em vez de 500
   descoberto pela cliente no checkout.
3. **`MP_NOTIFICATION_URL` fica vazia até a loja ter o domínio.** Não há placeholder com endereço
   inventado — um valor falso seria pior que nenhum.

#### 8.4.1.2 O que ainda falta (por ordem)

| # | Passo | Bloqueia |
| :--- | :--- | :--- |
| 1 | Preencher `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_AMBIENTE` | Teste da integração |
| 2 | Implementar o provider (RV-002) | Venda |
| 3 | Apontar `MP_NOTIFICATION_URL` para um túnel em dev | Teste do webhook |
| 4 | Provider de e-mail transacional | Avisos de pedido (ver 8.4.4) |

**A URL pública é o caminho crítico de infraestrutura.** O Compose não expõe proxy TLS — o
`traefik_network` citado no README pertence a outros projetos. Em desenvolvimento, túnel resolve; em
produção, é decisão de infraestrutura a tomar antes da inauguração.

> **Não bloqueia o desenvolvimento.** O provider pode ser escrito e testado contra o ambiente de teste
> do MP com `MP_NOTIFICATION_URL` apontando para o túnel. A credencial e a URL chegam antes da
> inauguração, não antes do código.

### 8.4.2 Frete — a definir

**Não há integração externa ainda.** O `fulfillment-manual` está seedado com PAC e SEDEX
(`seed.ts:247-259`).

Quando o transportador for escolhido, o adapter precisa de:
- credenciais da transportadora (`.env` do backend);
- consulta de preço e prazo por CEP e peso;
- **normalização do resultado** para `ShippingOption` — é isso que mantém a UI estável.

**A UI não deve conhecer a transportadora.** Mesmo o cálculo no backend deve passar pelo adapter,
para que trocar de transportadora não afete o resultado.

#### O caso do rastreio — lacuna verificada

A rota `GET /store/orders/track` (`backend/src/api/store/orders/track/route.ts`) está **completa e bem
desenhada**: aceita `display_id` + CPF **ou** e-mail, valida a identidade (**403** quando não bate) e
devolve status, itens, endereço sanitizado e rastreio.

**Mas o grep por `tracking_number`, `tracking_url`, `carrier` e `status_label` no backend não retorna
nenhum resultado fora da própria rota.** Ou seja: a rota lê `order.metadata`, e **ninguém escreve
lá**. É um campo lido e nunca gravado.

Três consequências:

| Lacuna | Evidência | Requisito |
| :--- | :--- | :--- |
| Ninguém grava o rastreio | grep sem resultado no backend | RV-043 |
| Não há página pública | nenhum `.tsx` de rastreio | RV-044 |
| Não há workflow de pedido | `backend/src/workflows/` **inexistente** | RV-042 |

**A decisão de não depender da transportadora.** Os três requisitos acima (RV-042 a RV-044) **não
dependem de qual transportadora for escolhida**, e por isso entram no caminho crítico da inauguração:

```
Pagamento → Pedido (reserva) → Envio (código) → Cliente consulta
     MP          Medusa          Admin            página pública
```

A transportadora responde **"onde está o pedido?"** — não "o pedido existe?". Pagamento, reserva e
acompanhamento são anteriores e posteriores ao frete. Modelar o painel esperando a transportadora
vira uma tela de "em breve" que precisa ser jogada fora.

**Regra de desenho obrigatória:** os campos de rastreio são **texto livre** (`carrier`,
`tracking_number`, `tracking_url`) — **sem lista suspensa de transportadoras**. Se forem modelados
para a transportadora de hoje, a decisão de amanhã obriga a refatorar o painel.

**Duas opções para o rastreio, ambas cabendo no contrato já definido:**

| Opção | Como funciona | Custo | Quando |
| :--- | :--- | :--- | :--- |
| **A — Link** | Admin cola `carrier` + código; a rota monta o link | Baixa | **Inauguração (recomendado)** |
| **B — API** | Backend consulta a transportadora e atualiza o status | Alta | Volume que justifique |

**A é a recomendação.** A rota **já aceita a opção A hoje** — foi desenhada assim. Não é gambiarra; é
o padrão do mercado e o caminho de menor risco.

### 8.4.3 Armazenamento de imagem

**Atual:** `@medusajs/file-local` + volume `real_valor_uploads`.
**Futuro:** `@medusajs/file-s3` (**já no workspace**).

**A migração não exige converter o conteúdo** — o valor gravado é a **chave** do arquivo, não a URL
(comentário em `medusa-config.ts:145-149`), e o storefront resolve com `resolveMediaUrl`. É trocar o
provider.

**Riscos atuais:**
- sem CDN: banda e latência;
- volume único: ponto de falha;
- upload sem validação de tipo/tamanho.

**Recomendação:** manter até a inauguração, planejar S3 para a Fase 3. **Exigir, desde já, imagens
redimensionadas no upload** — é o que evita o pior cenário com o armazenamento local.

### 8.4.4 E-mail

**Não auditado.** A confirmação de pedido depende de integração de e-mail transacional. O backend tem
`@medusajs/medusa` com módulos core, mas **não verifiquei se há provider de notificação configurado**.
`medusa-config.ts` registra apenas `file` e `content` — o que sugere que **não há provider de e-mail**.

> **Impacto:** se não houver, o pedido pode ser confirmado sem e-mail de aviso. Isso não bloqueia a
> venda, mas é falha de confiança. **Verificar antes da inauguração.**

### 8.4.5 Analytics

**Não há analytics configurado.** `@medusajs/analytics` está no workspace, mas não registrado.

**Recomendação:** Fase 3. Um e-commerce sem métricas de funil não consegue decidir o que melhorar.
Prioridade mínima: taxa de conversão, abandono por etapa do checkout, e busca sem resultado.

---

## 8.5 Riscos técnicos de produção

| # | Risco | Probabilidade | Impacto | Mitigação |
| :--- | :--- | :--- | :--- | :--- |
| R1 | Webhook do MP inacessível | Média | **Crítico** — pedido pago não confirma | Documentar e testar a URL **antes** de lançar |
| R2 | Webhook duplicado cria pedido duplo | Alta sem cuidado | **Crítico** | Idempotência por `preference_id` (RV-002, regra 4) |
| R3 | Nenhuma resposta ao pagamento | Média | **Crítico** | Camada `PaymentResult` + estado `pending` explícito |
| R4 | Sem provider de e-mail | **Alta** (inferido) | Alto | Verificar e configurar antes da inauguração |
| R5 | Imagens grandes sem CDN | **Alta** | Alto (LCP) | Exigir redimensionamento; S3 na Fase 3 |
| R6 | `NEXT_PUBLIC_*` inlinadas em PROD | Média | Médio | Documentar `make build && make restart` |
| R7 | Segredo não regenerado em produção | Baixa | **Crítico** | Checklist de pré-lançamento |
| R8 | Rate limiting ausente | Média | Médio | Fase 3 |
| R9 | Upload sem limite enche o volume | Média | Alto | Validar tamanho e tipo |
| R10 | CORS aberto em produção | Baixa | Alto | Checklist de pré-lançamento |

**R7 e R10 são os mais baratos de resolver e os mais fáceis de esquecer** — ambos estão na lista de
critérios de produção em `05-requisitos-nao-funcionais.md`.

---

## 8.6 Convenção para novos módulos

Padrão a seguir, derivado do que o projeto já faz:

```
backend/src/modules/<nome>/
├── index.ts          # registro do módulo
├── service.ts        # lógica
├── models/           # modelos Medusa
├── migrations/       # migrações + snapshot
└── __tests__/        # testes unitários

backend/src/api/webhooks/<provedor>/route.ts   # webhook, se houver
```

**Regras:**
1. Toda lógica externa fica **dentro do adapter** — o resto do sistema só conhece o contrato.
2. Segredo em `.env`, nunca em código.
3. Teste unitário para cada adapter (mesmo sem chamada externa).
4. Entrada do adapter é **sempre** revalidada no servidor.
5. Se o adapter normaliza algo, é para o tipo compartilhado do contrato — não para um tipo próprio.