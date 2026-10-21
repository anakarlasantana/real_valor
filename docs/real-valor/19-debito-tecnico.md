# 19 — Débito Técnico da Real Valor

**Status:** Revisado — débitos encerrados separados do backlog
**Data:** 19/10/2026 (revisões: 21/10/2026 — RV-030, RV-035, RV-036 e RV-037)
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
3. Escolhe endereço e método de envio (`shipping/index.tsx`)
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
| CEP não preenche o endereço no checkout | `modules/checkout/components/shipping-address/index.tsx` | A cliente redigita rua, cidade e estado que o ViaCEP responde de graça, e digita telefone e CEP sem máscara | **Débito aberto — RV-038** (`lib/data/shipping-cep.ts` + máscara compartilhada) |
| CEP apagado ao buscar o endereço | `modules/checkout/components/shipping-address/index.tsx` | O aviso de busca re-renderizava o formulário e o endereço vazio do carrinho voltava por cima do que a cliente tinha digitado | **Resolvido — RV-039** (`lib/checkout/endereco-pelo-cep.ts` + efeito só na troca de carrinho) |
| Um variant ainda sem vínculo | `teste-de-frete` / `TESTE-FRETE-1` | Peça de teste, mas o critério de aceite do RV-030 ("nenhum variant sem vínculo") não está cumprido — `reparar-estoque.ts` ainda acusa 1 | Rodar `reparar-estoque.ts --aplicar` ou remover a peça de teste antes do primeiro produto real |

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

### Sprint 3 — Qualidade e UX (2-3 semanas)

14. RV-035 Auditoria de estoque (`required_quantity` ÷ anúncio) — antes do primeiro
    lançamento com estoque real: é o débito que, não pago, faz a loja **anunciar
    menos** do que tem
15. RV-036 SKU nos inventory items — pré-requisito da auditoria item a item do RV-035
16. RV-037 Níveis de estoque duplicados por `(item, local)` — hoje a base tem um, e o anúncio
    depende de qual registro a Store API lê
17. RV-009 Guia de medidas
18. RV-010 Calculadora de frete na PDP
19. RV-038 CEP preenche o endereço no checkout + máscaras de telefone e CEP
    (dependente do RV-010, que reusa a mesma busca de CEP na PDP)
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