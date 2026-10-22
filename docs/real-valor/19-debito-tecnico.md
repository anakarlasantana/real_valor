# 19 — Débito Técnico da Real Valor

**Status:** Revisado — débitos encerrados separados do backlog
**Data:** 19/10/2026 (revisões: 21/10/2026 — RV-030, RV-035, RV-036, RV-037 e o checkout, RV-051 a RV-058)
**Autor:** Engenharia
**Base:** commit `60634d07d6` (develop), com a revisão de 21/10

> **O que mudou nesta revisão.** A lista foi conferida contra o código, item por
> item. Três débitos já estavam resolvidos (RV-004, RV-005 e RV-029) e saíram do
> backlog; dois foram resolvidos nesta revisão (RV-024 e RV-025), além do
> RV-022 e do diagnóstico do RV-030; o RV-007 ficou reduzido ao JSON-LD; e os
> caminhos de RV-010, RV-011/016 e RV-021 estavam apontando para arquivos que
> não existem e foram corrigidos. Ver §6.0 e §7.
>
> **Segunda revisão de 21/10/2026 (RV-030, "Vestido Rosiane").** O RV-030 foi
> diagnosticado como **dado** e, na prática, eram três defeitos de naturezas
> diferentes: dois de **código**, fechados nesta rodada (escolha inicial da
> variante e o texto de entrega fixo), e um de **dado** (o `required_quantity` do
> link), cujo *mecanismo* virou débito próprio — **RV-035** — junto com a falta de
> SKU casável nos inventory items, **RV-036**, e o nível de estoque duplicado no
> mesmo item e local, **RV-037**. A separação importa: "corrigi a peça" e
> "corrigi o caminho que estraga peças" são coisas diferentes, e só a segunda
> apaga o débito. Os três abertos foram **medidos no banco** desta base, não
> deduzidos: ver §15.11.2 do doc 15.
>
> **Terceira revisão de 21/10/2026 (o checkout, passo a passo).** O checkout foi
> percorrido como cliente — carrinho → entrega → pagamento — e o que apareceu está
> em §6.3 e §6.4. Dois defeitos **fecharam** na rodada: o frete cobrado **100×**
> (centavos gravados como reais, **RV-056**) e o **prazo de entrega que nunca
> chegava** (`GET /store/shipping/quote` respondia 400, **RV-057**). Cinco
> ficaram abertos, e todos os cinco se veem **antes** de pagar: o passo 2 sem
> estado de carregamento (**RV-051**), o cache da cotação que confunde 1 com 3
> caixas (**RV-052**), a conta de volumes que faz toda peça pesar 1 kg
> (**RV-053**), as variantes sem peso (**RV-054**) e a etiqueta que declara uma
> caixa quando a cotação cobrou três (**RV-055**). A numeração continua de
> RV-041: RV-042 a RV-050 são de outros blocos do doc 09 e **não** foram
> reaproveitados, pela mesma razão registrada em §6.0.
>
> **Quarta revisão de 21/10/2026 (a conta do frete, medida).** A pergunta era
> simples — "por que o frete não zera quando ponho o CEP da loja no checkout?" — e
> a resposta não estava escrita em lugar nenhum do projeto: o preço não é
> distância, é **faixa de CEP** sobre o contrato da conta SuperFrete, aplicada a
> **uma** caixa de 1 kg. A conta está aberta em **§6.3.1**, com as cotações reais
> medidas nesta base. No caminho apareceu um defeito de diagnóstico: CEP inválido
> devolve a mensagem de **token** (**RV-058**), que manda procurar credencial onde
> o problema é o endereço. O RV-052 e o RV-053 ganharam o que faltava para o
> aceite: a segunda consulta dentro do TTL e a peça que não cabe em nenhuma caixa.

---

## 1. Resumo executivo

A stack da Real Valor está **funcionalmente completa no código**, mas **não está liberada para venda**. O fluxo de compra existe do carrinho até a confirmação, mas três gargalos de infraestrutura impedem que um pedido pago se torne um pedido real:

| Gargalo | Sintoma | Severidade |
|---------|---------|------------|
| `SUPERFRETE_TOKEN` vazio | O checkout abre sem nenhuma opção de entrega | Crítico |
| Webhook do Mercado Pago apontando para `webhook.site` | Pagamento aprovado, mas o pedido nunca nasce no Medusa | Crítico |
| Domínio `realvalor.com.br` não verificado no Resend | O backend responde 403 em todo envio de e-mail | Crítico |
| `INTERNAL_API_SECRET` ausente | A página de confirmação mostra "aguardando" eternamente | Alto |

Além disso, existem débitos de produto (filtros, busca, SEO, acessibilidade, exceções de carrinho) que não bloqueiam a venda, mas prejudicam a experiência do comprador e devem entrar no backlog pós-inauguração.

**O checkout é outro caso.** A compra **fecha** — carrinho, endereço com CEP, frete, pagamento e confirmação —, mas o caminho até o botão de pagar ainda tem seis arestas (§6.3), e duas delas o cliente **vê** como defeito na tela: o preço do frete aparece como `"…"` e o resumo anuncia "Grátis" antes de existir frete escolhido. Nenhuma impede a venda; todas fazem o cliente duvidar do valor. As duas que **cobravam errado** (100× no frete e prazo ausente) foram fechadas em §6.4.

## 2. Arquitetura atual

### 2.1 Mapa de serviços

```
Navegador (Next 15) ──► Storefront (Next.js 15, :8000) ──► Backend (Medusa v2, :9000)
                                                         │
        ┌────────────────────────────────────────────────┼──────────────────────┐
        │                                                │                      │
   ┌────▼────┐                                       ┌──▼──┐              ┌───▼───┐
   │ Postgres │                                       │ Redis │              │ File  │
   │   :5439  │                                       │  :6382│              │ Local │
   └─────────┘                                       └───────┘              └───────┘
```

### 2.2 Módulos do backend

| Módulo | Responsabilidade | Status |
|--------|-----------------|--------|
| `content` | CMS: vitrine, páginas, tema, uploads | Verde |
| `fulfillment/superfrete` | Cotação, etiqueta, webhook de rastreio | Verde |
| `fulfillment/tabela` | Frete por tabela (valores fictícios) | Verde |
| `payment/mercadopago` | Pix e cartão parcelado, webhook HMAC | Verde |
| `notification` | Resend, 3 templates, subscribers | Verde |
| `shipping` | Registro de rastreio, etiquetas admin | Verde |

### 2.3 Rotas principais

**Admin API (`/admin/*`)**
- `/admin/content` — CMS (criar, editar, ordenar, restaurar)
- `/admin/shipping` — fila de envios, etiquetas
- `/admin/shipping/servicos` — ativa/desativa serviços de frete
- `/admin/shipping/testar` — cotação de teste
- `/admin/shipping/saldo` — carteira SuperFrete
- `/admin/shipping/:id/etiqueta` — gerar/imprimir/cancelar etiqueta
- `/admin/pacotes` — caixas de envio

**Store API (`/store/*`)**
- `/store/content?surface=` — leitura pública do CMS
- `/store/checkout/info` — sem consumo no frontend (ponta solta)
- `/store/orders/track` — rastreio público

---

## 3. Fluxos validados

### 3.1 Fluxo de compra (checkout)

1. Cliente adiciona item ao carrinho (`frontend/src/modules/cart`)
2. Acessa `/br/checkout` → `retrieveCart()` + `retrieveCustomer()`
3. Escolhe endereço e método de envio (`shipping/index.tsx`). O preço vem do provedor em **centavos** e é gravado em **reais** por `fulfillment/dinheiro.ts` (RV-056); o prazo sai da **mesma** cotação, por `GET /store/shipping/quote` (RV-057). O que ainda falta neste passo — o estado de carregamento, o cache e a conta de volumes — está em §6.3
4. Escolhe pagamento: Pix ou cartão parcelado (`payment-wrapper/index.tsx`)
5. Clica em "Pagar" → `initiatePaymentSession(pp_mercadopago_pix/cartao)`
6. Backend cria preferência no Mercado Pago (`service.ts: initiatePayment`)
7. Cliente sai da loja para o `init_point` do MP
8. MP notifica via webhook (`POST /webhooks/mercadopago`)
9. Webhook valida assinatura HMAC-SHA256, grava selo, emite `payment.webhook_received`
10. Medusa: `processPaymentWorkflow` → `authorizePayment` → `capturePayment` → `completeCartWorkflow`
11. O pedido nasce aqui, não no navegador
12. Página de confirmação consulta `GET /internal/orders/by-cart` (precisa de `INTERNAL_API_SECRET`)
13. Subscriber `order-confirmation` dispara e-mail `pedido-confirmado`

**Arquivos críticos:** `backend/src/modules/payment/mercadopago/{service,preferencia,assinatura,decisao,webhook,status}.ts`, `frontend/src/modules/checkout/`, `frontend/src/modules/order/`

### 3.2 Fluxo de frete (SuperFrete)

1. Admin cadastra/ativa serviços em `/frete/servicos`
2. Checkout consulta opções de envio via Medusa
3. SuperFrete cotará PAC/SEDEX/Mini/Jadlog/J&T/Loggi (quando `SUPERFRETE_TOKEN` estiver preenchido)
4. Admin gera etiqueta em `/shipping/:id/etiqueta`
5. Webhook SuperFrete atualiza `metadata` do pedido (`superfrete_situacao`, `status_label`, `tracking_number`)
6. Subscriber `order-canceled` / `avisar` dispara e-mail `pedido-enviado` ou `pedido-cancelado`

**Arquivos críticos:** `backend/src/modules/fulfillment/superfrete/{service,servicos,etiqueta,pedido,webhook}.ts`, `backend/src/modules/shipping/tracking.ts`, `backend/src/subscribers/{order-canceled,order-confirmation,superfrete-webhook}.ts`

**Origem da cotação:** o CEP de saída não vem da loja nem do `.env` — vem do
`address.postal_code` do primeiro `stock_location` (`api/store/shipping/quote/route.ts:42-47`),
semeado como `01310-100`. O corpo exato enviado ao SuperFrete, o que entra e o que
**não** entra na conta estão em §6.3.1.

### 3.3 Fluxo de e-mail transacional

1. Evento `order.placed`, `order.canceled` ou `superfrete.entrega` dispara subscriber
2. `dadosDoPedidoConfirmado/Cancelado/Envio()` monta as variáveis (17 campos)
3. `enviarEmail()` chama `Modules.NOTIFICATION.createNotifications`
4. Provider Resend faz `POST /emails` com `template.id` + `variables`
5. Resend renderiza o template publicado e entrega

**Arquivos críticos:** `backend/src/modules/notification/{pedido,enviar,resend/service,templates}.ts`, `backend/src/subscribers/{order-confirmation,order-canceled}.ts`

**Validação real feita:** `POST https://api.resend.com/emails` retornou `403` — domínio `realvalor.com.br` não verificado.

---

## 4. O que está pronto (código verde)

- `make check` verde: guardas de camada (R-A a R-E), catraca de comentário (baseline 334 arquivos), convenção de testes
- `tsc --noEmit` limpo nos três pacotes
- 790 testes: 386 backend, 70 CRM, 334 storefront
- `next build` limpo
- 3 módulos de pagamento funcionando (manual filtrado, MP Pix, MP Cartão)
- 3 templates de e-mail construídos no código
- Admin CMS para vitrine, páginas e tema
- Admin frete: serviços, pacotes, etiquetas, saldo
- Conta do cliente completa (login, cadastro, endereços, perfil, pedidos)
- Rastreio público `/rastreio`

---

## 5. Débitos críticos — bloqueiam a inauguração

Estes itens estão listados no README §"Antes de ir para produção" e no doc 09 §9.11. Nenhum depende de código novo; todos dependem de **configuração de ambiente e credenciais externas**.

> **Escopo deste documento.** A seção 5 não é backlog de engenharia: é checklist de
> configuração, de responsabilidade de quem opera o ambiente. O restante do
> documento (seções 6, 7 e 8) trata do que se resolve em **código, lógica ou
> fluxo** — e é só isso que entra em sprint.
>
> **Estado:** `make migrate` (item 3) já foi executado.

| # | Item | O que fazer | Bloqueia |
|---|------|-------------|----------|
| 1 | `INTERNAL_API_SECRET` | `openssl rand -hex 32`, colocar igual no `.env` do backend e do frontend | Página de confirmação mostra "aguardando" |
| 2 | E-mail transacional | `RESEND_API_KEY`, `RESEND_FROM` com domínio verificado, `STOREFRONT_URL`, templates publicados no Resend | Nenhum e-mail chega ao cliente |
| 3 | `make migrate` | Rodar migrations do módulo notification (tabela `notification`) | Erro ao gravar notificação no primeiro pedido |
| 4 | Mercado Pago real | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_AMBIENTE=producao` com credenciais de produção | Nenhum pagamento real é processado |
| 5 | Webhook MP público | `MP_NOTIFICATION_URL` com HTTPS público (não `webhook.site`) | Pedido pago não confirma, venda é manual |
| 6 | Retorno do pagamento | `MP_BACK_URL` no domínio real | Cliente não volta para a loja após pagar |
| 7 | SuperFrete token | `SUPERFRETE_TOKEN` + saldo na carteira | Checkout abre sem frete (loja não vende) |
| 8 | Webhook SuperFrete | `SUPERFRETE_WEBHOOK_SECRET`, URL pública + Webhook App criado | Rastreio e e-mail de envio/cancelamento não funcionam |

**Ordem sugerida:** 1 → 3 → 7 → 2 → 8 → 4 → 5 → 6 (o túnel `make tunnel` resolve o HTTPS público em dev).

---

## 6. Débitos de produto — experiência do comprador

Não bloqueiam a venda, mas deixam a loja "inacabada". Ordenados por impacto no comprador.

### 6.0 Débitos encerrados desde a redação

Estes saíram do backlog porque **o código já os resolve**. A evidência está na
coluna da direita — e é ela, não a memória de quem redigiu, que encerra um
débito.

| ID | Título | Encerrado porque | Evidência |
|----|--------|------------------|-----------|
| RV-004 | Filtros de catálogo | Facetas implementadas, com contagem e teste próprio | `frontend/src/lib/catalog/catalog-filters.ts`, `filter-chips.ts` e `__tests__/catalog-filters.unit.spec.ts`; consumidos por `store/page.tsx`, `categories/[...category]/page.tsx` e `collections/[handle]/page.tsx` |
| RV-005 | Busca de produtos | Módulo e página de resultado entregues | `frontend/src/modules/search/{components,templates}` e `app/[countryCode]/(main)/search/page.tsx` |
| RV-029 | Recuperar documentos removidos | O README já registra a remoção e o comando de recuperação; não há link quebrado | `README.md` §"Nota": `git show 6c7feef6e7^:docs/DEBITO-TECNICO.md` |
| RV-024 | Validação de upload | O `multer` nativo não tem `limits` e o handler não lia `mimetype`: qualquer arquivo, de qualquer tamanho, entrava. Agora há teto no `multer` e recusa por tipo, com 400 | `backend/src/api/middlewares.ts`, `backend/src/utils/arquivo-enviado.ts` e `__tests__/arquivo-enviado.unit.spec.ts` (20 testes) |
| RV-025 | Rate limiting | Janela deslizante em memória, por IP e por prefixo, com 429 e `Retry-After` | `backend/src/utils/limite-de-requisicoes.ts` e `__tests__/limite-de-requisicoes.unit.spec.ts` (17 testes) |
| RV-022 | `GET /store/checkout/info` sem consumo | Nenhum arquivo do storefront chamava a rota, e o que ela publicava era fictício (CNPJ, WhatsApp, e-mail) e divergia do provedor de parcelamento | Rota e teste removidos; o parcelamento real está em `frontend/src/lib/payments/installments.ts` |
| RV-007 (parte) | Catálogo no sitemap | O índice anunciava só home e páginas. Agora entram produto, categoria e coleção — com a **mesma** régua do card: esgotado não entra | `frontend/src/lib/catalog/sitemap-catalog.ts` e `__tests__/sitemap-catalog.unit.spec.ts` (13 testes) |

> **RV-030 — diagnóstico, não implementação.** A conta de
> `product-availability.ts` está certa e testada; o defeito é de **dado**: o
> painel do Medusa não cria o inventory item do variant, e `inventory_quantity`
> ausente é lido como zero. O reparo está em
> `backend/src/scripts/reparar-estoque.ts` (relata por padrão; com `--aplicar`
> cria o item, vincula e grava o nível). É manutenção enquanto o painel não fizer
> isso sozinho.

> **Sobre a numeração.** RV-013 a RV-018 não constam deste documento: foram
> absorvidos ou descartados antes da redação e não há registro do que eram. Os
> identificadores são **estáveis**, e por isso a lacuna fica visível em vez de
> ser renumerada — renumerar quebraria a referência dos commits e das mensagens
> que já citam RV-0xx.

### 6.1 Alta prioridade

| ID | Título | O que falta | Arquivos alvo | Critério de aceite |
|----|--------|-------------|---------------|-------------------|
| RV-007 | Metadados de SEO | JSON-LD de produto e de organização | `frontend/src/app/layout.tsx`, `[countryCode]/(main)/products/[handle]/page.tsx` | Dados estruturados válidos no Rich Results Test |
| RV-019 | Acessibilidade | Foco visível, `aria-label` em ícones, `alt` nas imagens, `aria-live` no carrinho | Transversal (storefront) | axe-core sem violações críticas |
| RV-020 | Exceções de carrinho | Sessão expirada, alteração de preço, estoque excedido | `frontend/src/modules/cart/`, `frontend/src/lib/data/cart.ts` | Três cenários tratados com mensagem clara |

> **RV-030** foi **diagnosticado**: a lógica de `product-availability.ts` está
> correta e coberta por teste — o defeito é de **dado**. Produto criado no
> painel do Medusa não ganha inventory item automaticamente, e o variant sem
> `inventory_quantity` é lido como zero. O reparo está em
> `backend/src/scripts/reparar-estoque.ts`, e o critério de aceite passa a ser
> "o script não encontra mais variant sem vínculo" — ver §6.0.
>
> **RV-030, segunda rodada (21/10/2026, "Vestido Rosiane").** O sintoma que chegou
> aqui foi "a página abre em Esgotado com estoque". Eram **três defeitos de
> naturezas diferentes** — e é essa diferença que decide o que ainda é débito:
> dois eram de código (e estão fechados), um era de dado (e o *mecanismo* que o
> criou continua aberto).
>
> | # | Defeito | Natureza | Estado |
> |---|---|---|---|
> | 1 | `product-actions` abria sem variante escolhida → botão "Esgotado" em peça pronta | Código | **Resolvido** |
> | 2 | `required_quantity: 2` no link → Store API reportava metade do estoque | Dado (mecanismo aberto → RV-035) | **Corrigido no dado** |
> | 3 | "Entrega e trocas" era copy fixa do componente, igual para toda peça | Código | **Resolvido** |
>
> **1. O botão, não o estoque** *(resolvido).* O estado nascia `options = {}` e só
> pré-selecionava com **uma** variante: toda peça de várias cores abria sem
> escolha, `isValidVariant` ficava `false` e o ramo "Esgotado" vencia — enquanto o
> chip, que fala do **produto**, dizia "Pronta entrega". O ramo "Selecione o
> tamanho" era código morto (`!options` é sempre falso com objeto). Agora a escolha
> inicial é função pura, `escolhaInicial`, com precedência `v_id` da URL → primeira
> variante comprável → primeira, resolvida no `useState` (sem um quadro de
> "Esgotado" no primeiro render).
> **Evidência:** `frontend/src/lib/catalog/product-availability.ts` e
> `__tests__/product-availability.unit.spec.ts`, com a narrativa em §15.11 do doc 15.
>
> **2. O estoque dividido** *(corrigido no dado; o mecanismo é o RV-035).* O link
> `pvitem_01M5FX6H8F37BQ5AT026YX41KN` tinha `required_quantity: 2` e o Store API
> reporta `estoque ÷ required_quantity`: 50 unidades apareciam como 25. **Não é
> débito de código** — 25 era a resposta correta para o dado que existia. O débito é
> o **caminho que produziu esse dado**, e ele é invisível: `required_quantity` não
> aparece no painel, não tem rota Admin e não tem script que o leia. Corrigir a
> Rosiane não impede a próxima.
>
> **3. Entrega e trocas fixas** *(resolvido).* O acordeão era copy do componente,
> idêntica para toda peça, com `/trocas-e-devolucoes` editável ao lado. Virou
> `metadata.shipping_returns`, editável no widget "Informações da peça", com a regra
> das outras chaves: **ausente não desenha seção**.
> **Evidência:** `frontend/src/lib/catalog/product-sections.ts`,
> `admin/src/admin/lib/enriquecimento-form.ts`, contrato em §12.4 do doc 12.

### 6.2 Média prioridade

| ID | Título | O que falta | Arquivos alvo | Critério de aceite |
|----|--------|-------------|---------------|-------------------|
| RV-008 | Parcelamento na vitrine | Linha de parcelamento no card e resumo | `modules/products/components/product-preview/price.tsx`, `lib/payments/installments.ts` | Parcelamento exibido corretamente |
| RV-009 | Guia de medidas | Tabela em `metadata` do produto, link ao lado do seletor | `frontend/src/modules/products/`, contrato do produto | Página de guia de medidas acessível |
| RV-010 | Calculadora de frete na PDP | Campo de CEP com custo e prazo na página do produto | `frontend/src/modules/products/components/shipping-quote/` (**já existe** — verificar se falta o campo no card de comprar) | Cálculo funciona sem queimar a carteira SuperFrete |
| RV-011 / RV-016 | Badge desconto e tamanhos | Badge % real + chips de tamanho informativos. Os componentes `discount-badge.tsx` e `size-chips.tsx` **não existem**: o selo e a faixa de tamanhos são desenhados em `product-preview/index.tsx` | `product-preview/index.tsx`, `product-preview/price.tsx` | Badge e chips renderizam nos cards |
| RV-021 | Logo vetorial | Substituir wordmark em texto por logo oficial SVG | `frontend/src/modules/layout/templates/nav/index.tsx` | Logo SVG com `alt` e favicon atualizado |
| RV-022 | Ordenação dos relacionados | Mesma categoria primeiro | `modules/products/components/related-products/` | Relacionados ordenados por complementaridade |
| RV-012 | Newsletter | Tipo de seção no contrato + consentimento LGPD | `packages/contrato/src/contract.ts`, `admin/src/admin/routes/content/`, `frontend/src/modules/layout/components/footer-column/` | Seção newsletter no contrato e no rodapé |
| RV-035 | `required_quantity` invisível e sem auditoria | O estoque que a loja anuncia é `nível ÷ required_quantity`, e o `required_quantity` só existe no **link** (`product_variant_inventory_item`): não aparece no painel, não tem rota Admin e nenhum script o imprime. Um link com 2 anuncia metade; ninguém descobre até um cliente reclamar. Falta: (a) script `backend/src/scripts/auditar-estoque.ts` no molde do `reparar-estoque.ts` — `--listar` imprimindo por link `variant`, SKU, `estoque`, `required_quantity` e **vendáveis** (`estoque ÷ required_quantity`), filtrável por `--variant` e por `--sku-item`, com `--aplicar` só onde `required_quantity <> 1`; (b) decidir se o valor entra no widget "Informações da peça" ou fica como manutenção só por script | `backend/src/scripts/auditar-estoque.ts` (novo), `backend/src/scripts/reparar-estoque.ts` (molde), `admin/src/admin/widgets/product-enrichment.tsx` | `--listar` responde em segundos "por que esta peça anuncia 25 com 50 no estoque", e nenhum link tem `required_quantity <> 1` sem justificativa |
| RV-036 | SKU do inventory item não acompanha o do variant | O item só é alcançável por `id` (ULID), que muda se o vínculo for refeito — e "procurar por SKU" é como o lojista pensa. Medido em 21/10/2026 na Rosiane: item `111`, variants `5555` e sem SKU; e um item órfão `testeteste`, sem SKU e sem vínculo. O campo é **do link**, então item compartilhado não duplica `required_quantity` — mas quem lê o painel não consegue casar nada | `backend/src/scripts/seed/vinculo.ts`, items criados por SQL fora do workflow | Todo inventory item tem SKU derivado do variant (`<handle>-<cor>-<tamanho>`), e uma conferência acusa item sem SKU ou sem vínculo |
| RV-037 | Nível de estoque duplicado no mesmo item e local | `inventory_level` aceita dois registros para o mesmo `(inventory_item_id, location_id)` e a Store API escolhe um deles. Medido: o item `111` (Rosiane) tem um nível com `1` e outro com `50`, e a loja anuncia 50 — sem a soma e sem regra explícita. `createInventoryLevelsWorkflow` não acusa o duplicado, e nenhum script hoje lista níveis repetidos | `backend/src/scripts/auditar-estoque.ts` (novo, `--limpar-niveis-duplicados`), `backend/src/scripts/reparar-estoque.ts` | Um único nível por `(item, local)` em toda a base, com a regra de desempate documentada e aplicada por script |
| RV-038 | CEP não preenche o endereço, e o checkout não tem máscara | O passo 1 pede CEP, endereço, cidade e estado à mão, e o CEP — que o ViaCEP responde de graça — não preenche nada. No mesmo lugar, telefone e CEP saem sem máscara enquanto o CPF já sai formatado. **O bairro não tem campo no Medusa** (`StoreCartAddress` não tem `neighborhood`) e o `address_2` é o complemento, então o bairro não é preenchido: fica aberto saber se ele precisa entrar na etiqueta. Fecha com: `lib/data/shipping-cep.ts` (ViaCEP → BrasilAPI, 2,5s por provedor, nunca lança), a rota `app/api/cep/[cep]` como proxy no navegador (o ViaCEP não manda CORS), máscara compartilhada em `lib/checkout/mascaras-de-endereco.ts`, e a busca no `onBlur`/Enter do CEP preenchendo `address_1`, `city` e `province` | `frontend/src/lib/data/shipping-cep.ts` (novo), `frontend/src/app/api/cep/[cep]/route.ts` (novo), `frontend/src/lib/checkout/mascaras-de-endereco.ts` (novo), `frontend/src/modules/checkout/components/shipping-address/index.tsx`, `frontend/src/modules/checkout/components/billing_address/index.tsx`, `packages/contrato/src/cep.ts` (novo), `packages/contrato/src/documento.ts` | CEP `01310-100` preenche Avenida Paulista / São Paulo / SP e o foco vai ao endereço; telefone e CEP formatados na digitação em entrega **e** cobrança; com o provedor fora, o formulário continua digitável |
| RV-039 | O CEP digitado era apagado (resolvido) | O CEP sumia do campo e o endereço não carregava. Causa: `buscandoCep` era o **único** `useState` do `ShippingAddress`, e o efeito que sincroniza o carrinho rodava a cada re-render — `setBuscandoCep(true)` disparava `setFormAddress(shipping_address vazio)` e devolvia tudo a `""`. O efeito agora só troca o formulário quando o carrinho muda ou quando o primeiro endereço chega, e o que o CEP pode sobrescrever virou função pura (`enderecoDoCep`) com teste, porque a regra "só preenche vazio" prendia São Paulo no segundo CEP | `frontend/src/lib/checkout/endereco-pelo-cep.ts` (novo), `frontend/src/modules/checkout/components/shipping-address/index.tsx` | Digitar `01310-100`, sair do campo e ver CEP preservado, Avenida Paulista / São Paulo / SP preenchidos e o foco no endereço; o segundo CEP troca cidade e UF, e o que a cliente digitou à mão não é sobrescrito |
| RV-040 | O CEP não buscava, e o teste não podia ver (resolvido) | O campo de CEP não fazia requisição nenhuma em `:8000`, enquanto a suíte ficava verde. Três causas somadas: (1) nenhum teste executava evento de `input` — os de componente usavam `renderToStaticMarkup`, que serializa o HTML e **não anexa handler**, então o componente correto no fonte e ausente no bundle servido era indistinguível; (2) o `void preencherPeloCep(...)` com `catch {}` engolia a falha, sem log, sem rede e sem tela; (3) o ViaCEP não manda `Access-Control-Allow-Origin`: mesmo com o handler, o navegador bloqueava a resposta cross-origin e o `fetch` falhava em silêncio. Agora há teste com jsdom + `@testing-library` que digita, verifica o `fetch` em `/api/cep/01310100` e o campo preenchido — validado removendo os gatilhos (4/4 falham) —, e o navegador consulta o proxy da mesma origem (`app/api/cep/[cep]/route.ts`), que fala com ViaCEP/BrasilAPI no servidor. A busca também sai do `onChange` no 8º dígito (autofill e Enter não disparam `blur`), o `setFormData` passou a ser funcional, e o erro tem `role="alert"` na tela | `frontend/src/app/api/cep/[cep]/route.ts` (novo), `frontend/src/modules/checkout/components/shipping-address/__tests__/cep-events.unit.spec.tsx` (novo), `frontend/src/lib/data/shipping-cep.ts`, `frontend/src/modules/checkout/components/shipping-address/index.tsx`, `frontend/vitest.config.ts` | Digitar `01310100` e ver a requisição sair **antes** de sair do campo; rua/cidade/UF preenchidos; CEP inexistente ou provedor fora mostram mensagem em `role="alert"` |
| RV-041 | O CEP ainda não buscava, e a etiqueta saía com a UF no bairro (resolvido) | O RV-040 provou que a busca existia e era acionada — mas ela nunca **chegou** ao provedor. `shipping-cep.ts` chamava `config.fetchImpl(url)`: o `fetch` como **método**, com `this` = config. O `fetch` do navegador exige `this` = `window` e recusa com `TypeError: Illegal invocation`, que o `catch` da consulta engolia. Por que a suíte não via: o `vi.fn()` dos testes aceita qualquer `this`, e o ambiente `node` não tem `window` — então o ramo do proxy (`ehNavegador()`) nunca era executado. No mesmo lugar, a etiqueta lia o `bairro` do `province` (a UF) e o número do `address_2` (o complemento): toda etiqueta saía com "SP" no bairro e "Apto 42" no número. Agora o fetch é extraído para uma variável e chamado solto; o `catch` distingue `AbortError` (prazo/desistência, esperado) de defeito, que passa a logar em dev; 404 do proxy quer dizer "esta rota não existe" (deploy antigo), não "este CEP não existe"; a busca virou o hook `use-cep-autofill`, usado pela entrega **e** pela cobrança (que não tinha busca); e **Número** e **Bairro** viraram campos próprios do passo 1, gravados em `metadata` do endereço — o `StoreCartAddress` não tem nenhum dos dois —, lidos pela etiqueta (número que não parece número não vira número) e mostrados no resumo. O remetente mantém a UF como último recurso: o local de estoque é configuração da operação, não tem formulário, e bairro vazio travaria toda etiqueta — a correção ali é de dado (`metadata.bairro` do local) | `frontend/src/lib/data/shipping-cep.ts`, `frontend/src/lib/checkout/use-cep-autofill.ts` (novo), `frontend/src/lib/checkout/endereco-pelo-cep.ts`, `frontend/src/lib/data/cart.ts`, `frontend/src/modules/checkout/components/shipping-address/index.tsx`, `frontend/src/modules/checkout/components/billing_address/index.tsx`, `frontend/src/modules/checkout/components/addresses/index.tsx`, `backend/src/modules/fulfillment/superfrete/pedido.ts`, `backend/src/api/admin/shipping/[id]/etiqueta/route.ts`, `frontend/src/lib/data/__tests__/shipping-cep-proxy.unit.spec.ts` (novo), `frontend/src/modules/checkout/components/shipping-address/__tests__/cep-events.unit.spec.tsx` | Digitar `01310100` no checkout: **uma** requisição a `/api/cep/01310100` (status 200), Avenida Paulista / Bela Vista / São Paulo / SP nos campos e o foco no **Número**; enviar o passo 1 grava `metadata: { numero, bairro }` no endereço do carrinho; a etiqueta sai com "Bela Vista" no bairro (nunca a UF) e "1578" no número (nunca o complemento) |


### 6.3 Checkout — o que falta para a compra fechar

Achados de 21/10/2026, percorrendo o checkout como cliente com o backend de pé
(`/checkout?step=delivery` e `?step=payment`). Todos são de **código ou de dado
nosso** — nenhum depende de credencial —, e todos acontecem **antes** do
pagamento. Ordem da tabela = ordem em que o cliente tropeça.

> **Rastreabilidade do plano.** O trabalho do checkout foi dividido em P0–P4 e
> F5–F7; os identificadores abaixo são o registro permanente deles — **P0 →
> RV-056**, **P1 → RV-057** (os dois fechados, §6.4), **P2 → RV-051**, **P3 →
> RV-052**, **P4 → RV-053** (volumes) e **RV-054** (peso das variantes), **F5–F7 →
> RV-055** (etiqueta × cotação). O **RV-058** nasceu depois, da investigação da
> conta do frete (§6.3.1), e não tem rótulo P/F. O rótulo P/F serve para a
> conversa; o RV-0xx é o que se cita em commit, PR e doc.

| ID | Título | O que a cliente vê | Arquivos alvo | Aceite |
|----|--------|--------------------|---------------|--------|
| RV-051 | Passo de entrega sem estado de carregamento | Preço do frete como `"…"` (e, se a cotação falha, `"…"` para sempre); linha escolhível antes de ter preço; resumo anunciando **"Grátis"** | `modules/checkout/components/shipping/index.tsx`, `modules/common/components/cart-totals/index.tsx`, `app/[countryCode]/(checkout)/checkout/loading.tsx` (novo), `styles/brand/11-checkout.css` | Em 3G simulado: esqueleto no lugar do preço, rádio e "Continuar" inertes durante o cálculo, "a calcular" no resumo, e falha da rota termina em mensagem |
| RV-052 | Cache da cotação não distingue 1 de 3 caixas | Pedido de 3 peças cotado pelo preço de 1 quando a segunda consulta cai no cache; limite de peso conferido contra uma caixa só | `backend/src/modules/fulfillment/superfrete/servico.ts` (`chaveDaCotacao`, `guardar`, `daMemoria`, `chave` × `chaveUtil`) | 1× e 3× do mesmo produto devolvem totais diferentes, ambos iguais ao unitário × volumes |
| RV-053 | Volumes calculados: 1 caixa por peça e 1 kg de mínimo | Peça de 100 g paga 1 kg; três peças iguais pagam três caixas | `backend/src/modules/fulfillment/pacotes/{pacotes,volumes}.ts` | Peça leve cotada abaixo de 1 kg; peças iguais consolidadas na mesma caixa |
| RV-054 | Variantes sem peso e sem dimensões | Toda peça cai na caixa padrão (400 g, 10×20×30) — logo, no mínimo de 1 kg | `backend/src/scripts/` (novo `reparar-pesos.ts` no molde do `reparar-estoque.ts`), `product_variant` | Nenhuma variante ativa sem peso e medidas |
| RV-055 | Etiqueta e cotação contam caixas de formas diferentes | Frete cobrado por 3 caixas, etiqueta despachada como 1 caixa padrão — a diferença volta como cobrança na coleta | `backend/src/modules/fulfillment/superfrete/etiqueta.ts` (`caixaDoEnvio`, `corpoDoCarrinho`), `pacotes/volumes.ts` | Para o mesmo pedido, peso e medidas da etiqueta = os da cotação |
| RV-058 | CEP recusado responde com a mensagem de token | Nenhuma opção de entrega e, no lugar do motivo, a dica de gerar credencial | `backend/src/modules/fulfillment/superfrete/cliente.ts` (`FRASE_DA_CREDENCIAL`), `backend/src/utils/erro-de-plataforma.ts` (`mensagemDe`, `lerDetalhe`), `backend/src/api/store/shipping/quote/route.ts` | CEP inválido → mensagem de endereço com o CEP testado; token ausente → mensagem de token; nenhum mostra a do outro |

**RV-051 · O passo 2 não tem estado de carregamento — e mente enquanto carrega.**

*O que a cliente vê.* Ela escolhe o endereço, o passo 2 abre e os três preços
aparecem como `"…"`. Os rádios estão **habilitados**, então ela toca no PAC antes
de o preço chegar e a escolha grava `cart_shipping_method` com o valor que existir
naquele instante. Se a rota de cotação falhar (token vazio, 422, timeout), o `"…"`
**não sai da tela**: nada marca o fim da tentativa. E o resumo, na coluna da
direita, já anuncia **"Grátis"**, porque não há frete escolhido.

*Por que.* `shipping/index.tsx:96` nasce com `isLoadingPrices = true` e só volta a
`false` dentro do `if (promises.length)` de `:129-160` — quando **não há** método
`calculated` para consultar, ninguém desliga o sinal. O `cotarFrete` de `:132` não
tem `finally`. O rádio é desabilitado por `!isLoadingPrices && preço ausente`
(`:285-288`), o que o deixa **livre** justamente durante o cálculo; o `"…"` está em
`:328-329`; e o "Continuar" de `:400` só olha `isLoading` e
`shipping_methods[0]`. Do outro lado, `cart-totals/index.tsx:44` faz
`const freteGratis = !shipping_subtotal` e escreve "Grátis" em `:62`: frete
**não calculado** e frete **grátis** viraram a mesma coisa — e é essa linha que
explica o "R$ 0,00" que o cliente lê antes de pagar R$ 21,15.

*O que falta.* (a) `loading.tsx` no passo, com esqueleto de página; (b) esqueleto
de **três linhas** de frete, na altura do preço, para o passo não pular quando o
número chega; (c) `aria-busy` no `fieldset` das opções, rádio e "Continuar"
desabilitados enquanto `isLoadingPrices`; (d) o `cotarFrete` terminando em
`finally`, com o erro virando mensagem em `role="alert"` em vez de `"…"` eterno;
(e) no `CartTotals`, três estados — **sem método** ("a calcular", sem
`data-value`), **zero** ("Grátis") e **valor**; (f) o mesmo tratamento no
pagamento, enquanto os métodos e as parcelas do provedor não chegam; (g) a classe
`.rv-skeleton` em `styles/brand/11-checkout.css`, respeitando
`prefers-reduced-motion`.

*Aceite.* Com a rede em 3G e a API de cotação lenta, o passo 2 não mostra `"-"`
nem `"…"` solto: mostra esqueleto, e nenhum rádio aceita escolha antes do preço.
Com a rota devolvendo 422, o passo mostra a mensagem da rota e o botão de tentar de
novo. O resumo nunca escreve "Grátis" antes de existir frete escolhido.

**RV-052 · O cache da cotação guarda duas coisas diferentes na mesma chave.**

*O que a cliente vê.* Uma peça cotada em R$ 21,15; três peças iguais, na consulta
seguinte, também em R$ 21,15 — sendo que a API cobra por caixa. O inverso também
acontece: quem chega depois de um pedido de três paga três.

*Por que.* `chaveDaCotacao` (`servico.ts:127-152`) recebe **um** volume —
`calculo.volumes[0]`, escolhido em `:266` — e monta a chave com peso e medidas
desse volume. O **número de volumes** e o **peso total do pedido** não entram na
chave: 1× e 3× a mesma caixa são a mesma pergunta para o cache. Pior, o valor
guardado não tem um formato só: `guardar` (`:180-186`) grava a resposta **crua**
(unitária) na L1 e no Redis; o caminho do Redis (`:300-307`) multiplica, regrava a
L1 com o **total** sob a mesma chave e devolve o total; e `daMemoria`
(`:154-170`) devolve o que estiver lá **sem multiplicar**. A mesma chave passa a
guardar unitário ou total, dependendo de qual ramo escreveu por último — e um
pedido de 3 caixas que chega pela L1 paga 1. Há ainda duas chaves em jogo: lê-se
`chave` (`:291`, `:301`) e grava-se `chaveUtil` (`:346-352` → `:365`) quando algum
serviço é recusado por peso, então esse caso **nunca** acerta no cache; e o
`emAndamento` (`:355`) usa a chave larga. Por fim, o limite de peso
(`servicosQueAceitam`, `:331-335`) olha o `volume.peso_gramas` da primeira caixa,
não o peso do pedido: 3 caixas de 1 kg passam como 1 kg.

*O que falta.* Uma chave só, calculada sobre o **conjunto** de volumes (contagem +
peso total + assinatura ordenada das caixas) e sobre os serviços que de fato vão à
API, usada por L1, Redis, em-voo e gravação; **um** formato de cache — unitário, e
o total calculado na saída, ou o contrário — decidido em comentário; o
`calculo.pesoGramas` validado (finito, maior que zero) antes de cotar; teste de
regressão 1× × 3× com a L1 quente **e** com o Redis quente.

*Aceite.* Com a L1 quente, 1 e 3 unidades do mesmo produto devolvem totais
diferentes, e o de 3 é 3× o unitário; a **segunda** consulta dentro do TTL devolve
o **mesmo total** da primeira (hoje devolve o unitário, porque `guardar`
(`:180-186`) grava a resposta crua); um serviço recusado por peso não envenena a
chave dos aceitos; nenhuma cotação volta com preço `0` ou `NaN`.

**RV-053 · Volumes: uma caixa por peça, e todo peso cúbico vira quilo inteiro.**

*O que a cliente vê.* Uma peça de 100 g paga 1 kg de frete — e três peças iguais
pagam três caixas de 1 kg, mesmo cabendo numa.

*Por que.* `pacotes.ts:34-41` calcula `pesoCubico` como
`Math.ceil(cm³ / 6000) * 1000`: qualquer caixa abaixo de 12.000 cm³ vira **1 kg**,
e a padrão (10×20×30 = 6.000 cm³) cai exatamente no mínimo. `volumes.ts:42-72`
empurra **um volume por unidade** (`for i < quantidade`), cada um com o taxável da
caixa, e não consolida peças iguais na mesma caixa. E `volumes.ts:54-58` escolhe a
caixa por `pacote.peso_gramas >= pesoDaVariante`: o `peso_gramas` do `Pacote` é o
**peso da caixa**, usado como **capacidade** — duas semânticas no mesmo campo, que
é a decisão de dados ainda aberta (coluna `capacidade_gramas` + migração, ou
reinterpretar `peso_gramas` e semear os valores). Como todas as variantes estão sem
peso (**RV-054**), `porPeso` nunca acha nada e tudo cai na caixa padrão.

Há um segundo efeito, na direção oposta: como o seletor compara o peso da variante
com o peso **vazio** da caixa, a peça que **não cabe em nenhuma** delas — acima de
1.400 g, o maior `peso_gramas` do catálogo — também volta para a padrão e é cotada
como 1 kg. A subcobrança é silenciosa e cai justamente na peça mais cara de
enviar: a loja paga a diferença quando a transportadora pesar na coleta.

*O que falta.* `pesoCubico` como `Math.max(300, cm³ / 6000)` em gramas (sem o
arredondamento para quilo inteiro); consolidar volumes **por tipo de caixa**
(quantidade de peças que cabem, não peças); resolver a decisão `capacidade_gramas`
antes de mexer no seletor de caixa; decidir o que fazer com a peça que excede a
maior caixa — compor caixa, recusar a cotação ou cobrar excedente — em vez de cair
na padrão e cobrar 1 kg; teste com 1 peça leve, 3 peças iguais e peça que não cabe
em nenhuma caixa.

*Aceite.* 1 peça de 100 g cotada abaixo de 1 kg; 3 peças iguais viram 1 volume, não
3; nenhuma caixa com peso cúbico acima do volume real; peça de 1,5 kg **não** é
cotada como a caixa padrão de 1 kg.

**RV-054 · As variantes não têm peso nem dimensões: toda peça pesa o mesmo.**

*O que a cliente vê.* Nada — e é o problema. A etiqueta e a cotação dizem 400 g e
10×20×30 para um vestido e para um par de brincos.

*Por que.* Toda variante da base está com `weight`, `height`, `width` e `length`
nulos. A rota de cotação manda `peso_gramas: item.variant.weight ?? null`
(`backend/src/api/store/shipping/quote/route.ts:61`) e `calcularVolumes` só usa esse
peso para escolher a caixa (`volumes.ts:54`); sem ele, cai na padrão — 400 g de
peso declarado e 6.000 cm³ de cubagem, que o `pesoCubico` transforma em 1 kg.

*O que falta.* Um script de manutenção no molde do `reparar-estoque.ts`
(`reparar-pesos.ts`): relata por padrão, `--aplicar` grava, e lista **toda**
variante ativa sem peso ou sem as três medidas. A fonte do dado é planilha do
fornecedor — decisão de operação, não de código —, e o fallback precisa estar
declarado: enquanto a variante não tiver peso, qual caixa a loja usa e com que
peso ela declara isso na nota.

*Aceite.* `reparar-pesos.ts --listar` não acusa nenhuma variante ativa sem peso e
medidas; um pedido de peça leve volta com peso abaixo de 1 kg na cotação e na
etiqueta.

**RV-055 · A cotação cobra por volume; a etiqueta despacha uma caixa só.**

*O que a cliente vê.* O frete certo na tela e a etiqueta errada no pacote. Se a
transportadora pesar na coleta, a diferença volta como cobrança complementar — e
quem paga a conta é a loja.

*Por que.* São duas contas diferentes para o mesmo pedido:

- **Cotação:** `calcularVolumes(itens, pacotes)` monta um volume por unidade, e
  `servico.ts:265-272` multiplica o preço por `calculo.volumes.length`.
- **Etiqueta:** `corpoDoCarrinho` (`etiqueta.ts:107-152`) declara **um**
  `volumes: {}`, com a caixa devolvida por `caixaDoEnvio(caixas)`
  (`etiqueta.ts:91-98`) — que é a caixa **padrão**, escolhida sem olhar os itens do
  pedido. `servico.ts:483` usa a mesma função, mas só para montar o exemplo da tela
  de teste do admin.

Ou seja: pedido de três peças é **cobrado** como três caixas e **despachado** como
uma caixa padrão, com peso que não é o que a cotação usou.

*O que falta.* Uma função de volumes só, usada pela cotação, pela etiqueta e pela
tela de teste; o `volumes` da etiqueta vindo de `calcularVolumes(itens, pacotes)`
quando a API aceitar lista — e, se ela exigir um volume único (é o caso do corpo
atual), consolidar antes e declarar o peso e as medidas **consolidados**, não os da
caixa padrão.

*Aceite.* Para o mesmo pedido, peso e medidas declarados na etiqueta são os mesmos
que a cotação usou; teste que compara os dois caminhos e falha se divergirem.

**RV-058 · CEP inválido ou fora de área vira mensagem de token do SuperFrete.**

*O que a cliente vê.* O passo 2 sem nenhuma opção de entrega e, no lugar do
motivo, uma frase sobre gerar token em "Integrações → Integrar em
Desenvolvedores" — conserto de credencial para um problema de endereço.

*Por que.* `chamarSuperFrete` passa `dica: FRASE_DA_CREDENCIAL` para **todo**
status que não seja 2xx (`cliente.ts:104-114`). O `ErroDePlataforma` até classifica
certo — `codigoDoStatus` separa `DADOS` (400/422) de `CREDENCIAL` (401/403)
(`utils/erro-de-plataforma.ts:20-29`) —, mas a `dica` é a mesma nos dois casos, e
`mensagemDe` (`:228-240`) a cola no fim da frase. Pior: o detalhe que sobra é o
genérico do SuperFrete, `"Ocorreu um ou mais erros."`, porque `lerDetalhe`
(`:103-121`) procura `message` antes de `errors` — a razão por serviço fica na
lista que `lerCotacoes` descarta (`catalogo.ts:182-201`: `has_error → []`). Medido
em 21/10/2026 com o token **válido**: `01310-101` (dígito verificador inválido) e
`69000-000` (faixa inexistente) devolveram a mensagem de token; `69020-030` cotou
normalmente. Nesta base o `SUPERFRETE_TOKEN` está no `.env` da raiz e não no
`backend/.env`, o que torna a mensagem ainda mais plausível para quem depura.

*O que falta.* A `dica` escolhida pelo `codigo`, não pelo `fetch`: (a) `DADOS` →
mensagem de endereço, com o CEP testado e o que a API disse de cada serviço;
(b) `CREDENCIAL` → a frase de token de hoje; (c) `PLATAFORMA`/`TEMPO` → tentar de
novo. E `lerDetalhe` precisa preferir `errors[]`/`error` por serviço quando o
`message` for o genérico — hoje a informação chega e é jogada fora. O passo 2 já
sabe exibir a mensagem da rota (é o item (d) do RV-051); falta a mensagem certa.

*Aceite.* CEP recusado mostra "não entregamos nesse CEP" com o CEP digitado; token
ausente continua mostrando a frase de token; nenhum dos dois mostra a mensagem do
outro — teste nos dois sentidos.

#### 6.3.1 A conta do frete, medida — e por que o CEP da loja não zera

Cinco coisas entram no `POST /api/v0/calculator` (`catalogo.ts:102-127`), e
**nenhuma** delas é o produto:

| Entrada | De onde vem | Valor nesta base |
|---|---|---|
| `from.postal_code` | centro de distribuição, não a loja: `stock_location` semeado em `scripts/seed/estoque.ts:53-58`, lido em `api/store/shipping/quote/route.ts:42-47` | `01310100` |
| `to.postal_code` | CEP digitado no checkout | livre |
| `services` | `data.servico` das opções ativas (`catalogo.ts:5-12`): PAC `1`, SEDEX `2`, MINI `17` | `"1,2"` |
| `package` | `volumes[0]` → caixa **padrão** do admin (`servico.ts:265`) | `20×30×10`, `1` kg |
| `insurance_value` | fixo (`catalogo.ts:120-121`) | `0` |

O que **não** entra na conta: peso e medidas do produto (**RV-054** — sem o dado, o
volume cai na caixa padrão e o `pesoCubico` a transforma em 1 kg, **RV-053**), o
valor do pedido (`insurance_value: 0`), a distância em km e a quantidade — que só
multiplica o unitário no fim (`servico.ts:265-272`, **RV-052**/**RV-055**).

Com um carrinho real da base, mudando **só** o destino:

| Destino | PAC | SEDEX | Prazo PAC/SEDEX |
|---|---|---|---|
| `01310-100` — o **próprio** CEP da loja | R$ 21,15 | R$ 13,73 | 2 / 1 |
| `04538-133` — outro bairro de São Paulo | R$ 21,15 | R$ 13,73 | 2 / 1 |
| `20031-000`, `30130-010`, `80020-310`, `90010-150` | R$ 25,19 | R$ 35,96 | 2 / 1 |
| `69020-030` — Manaus | R$ 37,78 | R$ 75,53 | 7 / 3 |

`"volumes": 1` e `"peso_gramas": 1000` em todas — e o PAC de R$ 21,15 é o mesmo
número que o RV-056 usou para achar o frete 100×, o que confirma que a reprodução
está no mesmo contrato.

Duas leituras que a tabela autoriza:

1. **"Pus o CEP da loja e não zerou" não é defeito.** A tarifa é por **faixa de
   CEP**, não por distância: dentro de São Paulo, qualquer destino custa o mesmo.
   Frete zero só existe por promoção, opção `flat` de R$ 0 ou retirada — não por
   origem igual ao destino.
2. **SEDEX mais barato que PAC dentro de SP** (R$ 13,73 × R$ 21,15) é o **contrato
   da conta**, não a nossa conta: fora de SP a ordem se inverte (R$ 35,96 ×
   R$ 25,19). Se não for intencional, ajusta-se no SuperFrete, não no código.

`/admin/shipping/testar` reproduz isso sem passar pelo checkout, e é a única tela
que mostra o corpo enviado (`requisicao`), a latência e o `origem` (rede × cache) —
mas ela cota **só a caixa padrão** (`servico.ts:483`), então não serve para
conferir volume por item.



### 6.4 Fechados nesta rodada — e o que ficou pendente neles

**RV-056 · O frete cobrado 100× (centavos entregues como reais).**

*Sintoma.* A cotação real do PAC era R$ 21,15 e o checkout gravava `2115`. O
`calculated_amount` é **decimal** no Medusa (`21.15`), e os provedores calculam em
**centavos**: toda opção de entrega saía 100× mais cara.

*Conserto.* `backend/src/modules/fulfillment/dinheiro.ts` passou a ser a **única**
fronteira — `emReais(centavos)` na saída do provedor, `emCentavos(reais)` na
entrada. `superfrete/service.ts:103` e `tabela/service.ts:105` devolvem
`calculated_amount: emReais(...)`; `superfrete/pedido.ts:135` declara
`valorCentavos: emCentavos(unit_price)` (a etiqueta anunciava R$ 249,90 como
R$ 2,50); e `frontend/src/lib/data/fulfillment.ts:112` divide por 100 o que a rota
de teste devolve.

*Evidência.* `fulfillment/__tests__/dinheiro.unit.spec.ts`,
`tabela/__tests__/service.unit.spec.ts`,
`superfrete/__tests__/service.unit.spec.ts` e
`superfrete/__tests__/etiqueta.unit.spec.ts`. Na base real: PAC gravado `21.15` e
SEDEX `64.73`.

*Pendente.* Linha de `cart_shipping_method` gravada **antes** do conserto mantém o
valor velho até a cliente reescolher o frete — um carrinho com `2115` continua
errado. Não há migração de dados: a orientação é reescolher a entrega (ou limpar
carrinhos abertos) antes de divulgar a loja.

**RV-057 · O prazo nunca chegava ao checkout.**

*Sintoma.* A linha do frete mostrava nome e preço, nunca "até 2 dias úteis" — com o
componente já pronto para desenhar (`prazoDe`) e o dado já vindo do provedor.

*Causa.* `GET /store/shipping/quote` carregava o carrinho **sem** a relação
`shipping_address`; sem ela o CEP de destino chegava vazio, a rota respondia 400 e
`frontend/src/lib/checkout/shipping-quote.ts` devolvia `null` — mapa de prazos
vazio, linha sem prazo. O defeito era da rota, não do componente.

*Conserto.* `backend/src/api/store/shipping/quote/route.ts:35` passou a carregar
`relations: ["items", "items.variant", "shipping_address"]`. A rota responde 200 e
as cotações trazem `prazo` (PAC 2, SEDEX 1 na base de teste), que o componente
escreve como "até 2 dias úteis".

*Evidência.* E2E manual: `GET /store/shipping/quote?cart_id=…` → 200 com `prazo`
por serviço; `?step=delivery` com a linha completa.

*Nota de base.* As duas correções entraram sobre `836c4ade00` — `make check`,
`make types` e as suítes do `fulfillment` verdes. É por isso que §6.3 continua
sendo o que falta, e não o que faltava.

---

## 7. Débitos de infraestrutura e qualidade

| ID | Título | O que falta | Critério de aceite |
|----|--------|-------------|-------------------|
| RV-023 | Armazenamento S3 + CDN | Trocar `@medusajs/file-local` por `@medusajs/file-s3` | Imagens servidas por CDN, nenhuma migração de conteúdo |
| RV-026 | Analytics e funil | Registrar `@medusajs/analytics` e medir conversão, abandono, busca sem resultado | Eventos de funil visíveis no painel |
| RV-027 | Auditoria de acessibilidade | Revisão por teclado de toda a jornada, iOS e desktop | Jornada completa operável por teclado |
| RV-028 | Teste E2E da compra | Suíte automatizada clique → pedido confirmado | Fluxo verde em CI |

> **RV-024 e RV-025 saíram desta lista.** O upload é validado no servidor
> (`backend/src/api/middlewares.ts`): teto absoluto de 25 MB no `multer`, teto
> por tipo (8 MB para imagem, 25 MB para PDF) e recusa com 400 fora da lista
> branca — antes, o `multer` nativo gravava em memória sem `limits` e nenhum
> `mimetype` era conferido. O rate limiting é janela deslizante em memória, por
> IP e por prefixo (cotação de frete, webhooks, checkout e interno), com 429 e
> `Retry-After` (ver `backend/src/utils/limite-de-requisicoes.ts`).
>
> **RV-029** está encerrado — ver §6.0.

---

## 8. Pontas soltas e riscos técnicos

### 8.1 Pontas soltas identificadas no código

| Item | Local | Risco | Ação |
|------|-------|-------|------|
| ~~`GET /store/checkout/info` sem consumo~~ | ~~`backend/src/api/store/checkout/info/route.ts`~~ | **Resolvido (RV-022).** Nenhum arquivo do storefront a chamava, e o que ela publicava estava errado: CNPJ, WhatsApp e e-mail fictícios, e um parcelamento (12x com 3 sem juros) que já vem do provedor | Rota e teste removidos |
| `pp_system_default` filtrado mas registrado | `frontend/src/lib/payments/providers.ts` | Aparece filtrado, mas continua no backend | Deixar como está (filtrado no storefront é suficiente) |
| Comentários cortados para baseline | Múltiplos arquivos | Histórico de decisões perdido no código | Os cortes estão documentados nos commits da F10 |
| Seed de frete pode duplicar opções | `backend/src/scripts/seed.ts` | Corrigido parcialmente (guarda por nome+perfil) | Monitorar após múltiplos `make seed` |
| ~~Produtos adicionados no admin aparecem esgotados~~ | ~~`product-availability.ts`~~ | **Resolvido (RV-030), com uma condição.** A lógica estava certa; o defeito é de dado — o painel do Medusa não cria o inventory item do variant, e `inventory_quantity` ausente é lido como zero | `backend/src/scripts/reparar-estoque.ts` (relata e, com `--aplicar`, vincula e grava o nível). Enquanto o painel não fizer isso sozinho, é script de manutenção |
| ~~Página abre em "Esgotado" com estoque em peça de várias cores~~ | ~~`product-actions/index.tsx`~~ | **Resolvido (RV-030, rodada 2).** O botão olhava a variante escolhida e o estado nascia sem escolha; o chip olhava o produto. Não era estoque: era o componente | `escolhaInicial` em `lib/catalog/product-availability.ts`, resolvida no `useState` |
| `required_quantity` não aparece em lugar nenhum | `product_variant_inventory_item` (link) | A loja anuncia `nível ÷ required_quantity` e o divisor é invisível: sem rota Admin, sem campo no painel, sem script que o imprima. Um link com 2 anuncia metade do estoque, calado | **Débito aberto — RV-035** (script `auditar-estoque.ts` com `--listar`) |
| Inventory item sem SKU casável com o variant | base de dev (Rosiane `111` vs variants `5555`/vazio; órfão `testeteste`) | "Procurar por SKU" não acha nada; toda auditoria fica presa ao `id` do link | **Débito aberto — RV-036** (SKU derivado do variant) |
| Nível de estoque duplicado no mesmo item e local | item `111` (Rosiane): um nível com `1`, outro com `50` | A loja anuncia 50 sem somar e sem regra: o número depende de qual registro a Store API lê | **Débito aberto — RV-037** (`--limpar-niveis-duplicados`) |
| CEP não preenche o endereço no checkout | `modules/checkout/components/shipping-address/index.tsx` | A cliente redigita rua, cidade e estado que o ViaCEP responde de graça, e digita telefone e CEP sem máscara | **Resolvido — RV-038/RV-040** (busca no CEP em `lib/data/shipping-cep.ts` + máscara compartilhada); a cobrança e o bairro fecharam no RV-041 |
| Bairro da etiqueta saía da UF, e o número saía do complemento | `backend/src/modules/fulfillment/superfrete/pedido.ts` (`destinatarioDoPedido`) | Toda etiqueta impressa com "SP" onde vai o bairro e "Apto 42" onde vai o número — erro que a transportadora não barra e ninguém vê | **Resolvido — RV-041** (campos Número e Bairro no passo 1, gravados em `metadata` do endereço e lidos pela etiqueta) |
| CEP não buscava no navegador, e o teste não via | `lib/data/shipping-cep.ts` | `config.fetchImpl(url)` chamava o `fetch` como método: `this` = config, e o navegador recusa com `Illegal invocation`. O `vi.fn()` aceita qualquer `this` e o ambiente `node` não entra no ramo do proxy | **Resolvido — RV-041** (fetch solto, `AbortError` separado de defeito, teste em jsdom com marca de `window`) |
| CEP apagado ao buscar o endereço | `modules/checkout/components/shipping-address/index.tsx` | O aviso de busca re-renderizava o formulário e o endereço vazio do carrinho voltava por cima do que a cliente tinha digitado | **Resolvido — RV-039** (`lib/checkout/endereco-pelo-cep.ts` + efeito só na troca de carrinho) |
| Um variant ainda sem vínculo | `teste-de-frete` / `TESTE-FRETE-1` | Peça de teste, mas o critério de aceite do RV-030 ("nenhum variant sem vínculo") não está cumprido — `reparar-estoque.ts` ainda acusa 1 | Rodar `reparar-estoque.ts --aplicar` ou remover a peça de teste antes do primeiro produto real |
| Preço do frete como `"…"` e linha escolhível durante o cálculo | `modules/checkout/components/shipping/index.tsx:96`, `:129-160`, `:285-288`, `:328` | A cliente escolhe entrega sem preço e a escolha grava `cart_shipping_method` com o valor do instante; se a cotação falha, o `"…"` não sai da tela | **Débito aberto — RV-051** (esqueleto, rádio e "Continuar" inertes, `finally` no `cotarFrete`) |
| Resumo anuncia "Grátis" antes de existir frete | `modules/common/components/cart-totals/index.tsx:44`, `:62` | `!shipping_subtotal` trata "não calculado" e "grátis" como a mesma coisa: o cliente lê R$ 0,00 e paga R$ 21,15 | **Débito aberto — RV-051** (três estados: a calcular / grátis / valor) |
| Cache da cotação não separa 1 de 3 caixas | `superfrete/servico.ts:127-152` (chave sobre `volumes[0]`), `:180-186`, `:300-307`, `:346-365` | A chave ignora contagem e peso total, e a L1 guarda ora unitário, ora total: pedido de 3 cai no preço de 1; com serviço recusado por peso, lê-se `chave` e grava-se `chaveUtil` | **Débito aberto — RV-052** (chave do conjunto de volumes, um só formato, teste 1× × 3×) |
| Toda peça pesa 1 kg | `pacotes/pacotes.ts:34-41` (`ceil(cm³/6000)*1000`), `pacotes/volumes.ts:42-72` | Peça de 100 g paga 1 kg; três peças iguais pagam três caixas | **Débito aberto — RV-053/RV-054** (cubagem em gramas, consolidação, peso por variante) |
| Etiqueta declara 1 caixa padrão e a cotação cobrou por volume | `superfrete/etiqueta.ts:91-98` e `:143-148` × `pacotes/volumes.ts` | A transportadora cobra a diferença na coleta | **Débito aberto — RV-055** (uma função de volumes para cotação, etiqueta e tela de teste) |

### 8.2 Riscos de produção (doc 09 §9.11.5)

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| R1 | Webhook do MP inacessível | Média | Crítico | Documentar e testar URL antes de lançar |
| R2 | Webhook duplicado cria pedido duplo | Alta sem cuidado | Crítico | Idempotência por `preference_id` |
| R3 | Nenhuma resposta ao pagamento | Média | Crítico | Camada `PaymentResult` + estado `pending` explícito |
| R4 | Sem provider de e-mail | Alta | Alto | Verificar e configurar antes da inauguração |
| R5 | Imagens grandes sem CDN | Alta | Alto (LCP) | Exigir redimensionamento; S3 na Fase 3 |
| R6 | `NEXT_PUBLIC_*` inlinadas em PROD | Média | Médio | Documentar `make build && make restart` |
| R7 | Segredo não regenerado em produção | Baixa | Crítico | Checklist de pré-lançamento |
| R8 | Rate limiting ausente | Média | Médio | **Resolvido (RV-025)**: janela deslizante por IP em cotação, webhooks, checkout e interno |
| R9 | Upload sem limite enche volume | Média | Alto | **Resolvido (RV-024)**: teto no `multer` e recusa por tipo com 400 |
| R10 | CORS aberto em produção | Baixa | Alto | Checklist de pré-lançamento |

---

## 9. Plano de ação sugerido

### Sprint 1 — Inauguração (só configuração, sem código novo)

> **Item 2 já feito:** `make migrate` (tabela `notification`) foi executado.
> O restante é checklist de ambiente — ver §5.

1. Gerar `INTERNAL_API_SECRET` e colocar igual nos dois `.env`
2. ~~Rodar `make migrate` (tabela `notification`)~~ — **feito**
3. Configurar `SUPERFRETE_TOKEN` e recarregar carteira sandbox
4. Configurar `RESEND_API_KEY`, `RESEND_FROM`, `STOREFRONT_URL`, `EMAIL_LOGO_URL`, `EMAIL_ATENDIMENTO`
5. Publicar 3 templates no Resend e aguardar verificação de domínio (até 4h)
6. Configurar `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_AMBIENTE=producao`
7. Configurar `MP_NOTIFICATION_URL` com HTTPS público (túnel ou produção)
8. Configurar `MP_BACK_URL` no domínio real
9. Validar uma compra de verdade (cartão de produção, valor baixo)

### Sprint 2 — Experiência do comprador (2-3 semanas)

10. RV-007 JSON-LD de produto e organização
11. RV-008 Parcelamento na vitrine
12. RV-011/016 Badge e tamanhos no card
13. RV-022 Ordenação dos relacionados

### Sprint 2b — O checkout fecha (antes do Sprint 3)

Estes seis não são polimento: são o que a cliente vê **antes** de pagar, e dois
deles cobram valor errado (RV-052 para menos, RV-055 para a loja). Ordem por
relação custo × dano:

- **RV-051** Esqueleto e estados do passo 2, e o "a calcular" no resumo — o mais
  visível, o mais barato, e o único que aparece para **toda** compra
- **RV-052** Chave única do cache (contagem + peso total), um só formato de valor,
  teste 1× × 3× — enquanto aberto, o frete de um pedido pode ser o de outro
- **RV-054** Peso e medidas nas variantes (`reparar-pesos.ts --listar`) —
  pré-requisito do RV-053: sem dado, a conta certa continua sem entrada
- **RV-053** Cubagem em gramas (sem quilo inteiro) e consolidação por caixa
- **RV-055** Etiqueta e cotação com a mesma conta de volumes
- **RV-058** Mensagem certa no CEP recusado — entra junto do RV-051: é a **mesma
  tela** e o **mesmo estado de erro**, e hoje manda o cliente (e o suporte) olhar
  o token quando o problema é o endereço

### Sprint 3 — Qualidade e UX (2-3 semanas)

14. RV-035 Auditoria de estoque (`required_quantity` ÷ anúncio) — antes do primeiro
    lançamento com estoque real: é o débito que, não pago, faz a loja **anunciar
    menos** do que tem
15. RV-036 SKU nos inventory items — pré-requisito da auditoria item a item do RV-035
16. RV-037 Níveis de estoque duplicados por `(item, local)` — hoje a base tem um, e o anúncio
    depende de qual registro a Store API lê
17. RV-009 Guia de medidas
18. RV-010 Calculadora de frete na PDP
19. ~~RV-038 CEP preenche o endereço no checkout + máscaras de telefone e CEP~~
    — **feito** (RV-038/RV-040/RV-041: busca na entrega **e** na cobrança,
    número e bairro na etiqueta). O RV-010 reusa a mesma busca de CEP.
20. RV-019 Acessibilidade
21. RV-020 Exceções de carrinho
22. RV-027 Auditoria de acessibilidade por teclado

### Sprint 4 — Infraestrutura (pós-inauguração)

23. RV-023 S3 + CDN
24. RV-026 Analytics
25. RV-028 Teste E2E

---

## 10. Critérios de "feito" para cada débito

Cada item acima só está concluído quando:
- Código implementado e revisado
- `make check` verde (incluindo catraca de comentário)
- `tsc --noEmit` limpo nos três pacotes
- Testes unitários passando (`make test`)
- `next build` limpo (quando houver mudança no storefront)
- Documentação atualizada (se houver mudança de comportamento)
- Checkout percorrido nos três passos com rede lenta (`?step=delivery` e
  `?step=payment`): sem `"…"` eterno, sem "Grátis" antes do frete e sem escolha de
  entrega antes do preço calculado

---

## 11. Anexos

- `docs/real-valor/17-roteiro-validacao-checkout-e-email.md` — roteiro de teste de ponta a ponta
- `docs/real-valor/16-requisitos-admin.md` — requisitos do painel
- `docs/real-valor/09-backlog-implementacao.md` — backlog completo com hashes de commits
- `backend/src/modules/payment/mercadopago/README.md` — antes de ir para produção (MP)
- `backend/src/modules/notification/README.md` — antes de ir para produção (Resend)
- `README.md` — checklist de produção (seção "Antes de ir para produção")

---

Fim do documento.