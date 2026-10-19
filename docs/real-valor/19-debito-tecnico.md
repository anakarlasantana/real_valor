# 19 — Débito Técnico da Real Valor

**Status:** Rascunho para revisão  
**Data:** 19/10/2026  
**Autor:** Engenharia  
**Base:** commit `60634d07d6` (develop)

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

Estes itens estão listados no README §"Antes de ir para produção" e no doc 09 §9.11. Nenhum depende de código novo; todos dependem de configuração de ambiente e credenciais externas.

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

### 6.1 Alta prioridade

| ID | Título | O que falta | Arquivos alvo | Critério de aceite |
|----|--------|-------------|---------------|-------------------|
| RV-004 | Filtros de catálogo | Facetas de cor, tamanho, preço, disponibilidade com contagem; drawer no mobile | `frontend/src/modules/categories/`, `frontend/src/lib/catalog/catalog-filters.ts` | Filtros funcionam na vitrine e coleções |
| RV-005 | Busca de produtos | Campo no header com sugestões + página de resultado reaproveitando `PaginatedProducts` | `frontend/src/modules/search/`, `frontend/src/app/[countryCode]/(main)/search/` | Busca retorna produtos relevantes |
| RV-007 | Metadados de SEO | Remover "Medusa Store", descrições reais, sitemap, robots, JSON-LD | `frontend/src/app/layout.tsx`, `sitemap.ts`, `robots.ts` | Títulos e descrições reais em pt-BR |
| RV-020 | Exceções de carrinho | Sessão expirada, alteração de preço, estoque excedido | `frontend/src/modules/cart/`, `frontend/src/lib/data/cart.ts` | Três cenários tratados com mensagem clara |
| RV-019 | Acessibilidade | Foco visível, `aria-label` em ícones, `alt` nas imagens, `aria-live` no carrinho | Transversal (storefront) | axe-core sem violações críticas |

### 6.2 Média prioridade

| ID | Título | O que falta | Arquivos alvo | Critério de aceite |
|----|--------|-------------|---------------|-------------------|
| RV-008 | Parcelamento na vitrine | Linha de parcelamento no card e resumo | `frontend/src/modules/products/components/product-preview/price.tsx`, `payment/components/installment-info.tsx` | Parcelamento exibido corretamente |
| RV-009 | Guia de medidas | Tabela em `metadata` do produto, link ao lado do seletor | `frontend/src/modules/products/`, contrato do produto | Página de guia de medidas acessível |
| RV-010 | Calculadora de frete na PDP | Campo de CEP com custo e prazo na página do produto | `frontend/src/modules/products/components/shipping-calculator.tsx` | Cálculo funciona sem queimar a carteira SuperFrete |
| RV-011 / RV-016 | Badge desconto e tamanhos | Badge % real + chips de tamanho informativos | `product-preview/index.tsx`, `discount-badge.tsx`, `size-chips.tsx` | Badge e chips renderizam nos cards |
| RV-021 | Logo vetorial | Substituir wordmark em texto por logo oficial SVG | `frontend/src/app/(main)/layout/templates/nav/index.tsx` | Logo SVG com `alt` e favicon atualizado |
| RV-022 | Ordenação dos relacionados | Mesma categoria primeiro | `products/components/related-products/` | Relacionados ordenados por complementaridade |
| RV-012 | Newsletter | Tipo de seção no contrato + consentimento LGPD | `packages/contrato/src/contract.ts`, `admin/src/admin/routes/content/`, `frontend/src/modules/layout/components/footer-column/` | Seção newsletter no contrato e no rodapé |

---

## 7. Débitos de infraestrutura e qualidade

| ID | Título | O que falta | Critério de aceite |
|----|--------|-------------|-------------------|
| RV-023 | Armazenamento S3 + CDN | Trocar `@medusajs/file-local` por `@medusajs/file-s3` | Imagens servidas por CDN, nenhuma migração de conteúdo |
| RV-024 | Validação de upload | Validar tipo e tamanho no upload de imagem do CMS | Arquivo acima do limite ou tipo não permitido é rejeitado |
| RV-025 | Rate limiting | Middleware no backend para rotas sensíveis (login, busca, webhook) | Requisições acima do limite respondem 429 |
| RV-026 | Analytics e funil | Registrar `@medusajs/analytics` e medir conversão, abandono, busca sem resultado | Eventos de funil visíveis no painel |
| RV-027 | Auditoria de acessibilidade | Revisão por teclado de toda a jornada, iOS e desktop | Jornada completa operável por teclado |
| RV-028 | Teste E2E da compra | Suíte automatizada clique → pedido confirmado | Fluxo verde em CI |
| RV-029 | Recuperar documentos removidos | Avaliar `docs/DEBITO-TECNICO.md` e `docs/plano-centralizacao.md` do histórico Git | README referencia apenas arquivos existentes |

---

## 8. Pontas soltas e riscos técnicos

### 8.1 Pontas soltas identificadas no código

| Item | Local | Risco | Ação |
|------|-------|-------|------|
| `GET /store/checkout/info` sem consumo | `backend/src/api/store/checkout/info/route.ts` | Pode ser código morto ou consumo externo não mapeado | Confirmar se há consumo externo antes de remover |
| `pp_system_default` filtrado mas registrado | `frontend/src/lib/payments/providers.ts` | Aparece filtrado, mas continua no backend | Deixar como está (filtrado no storefront é suficiente) |
| Comentários cortados para baseline | Múltiplos arquivos | Histórico de decisões perdido no código | Os cortes estão documentados nos commits da F10 |
| Seed de frete pode duplicar opções | `backend/src/scripts/seed.ts` | Corrigido parcialmente (guarda por nome+perfil) | Monitorar após múltiplos `make seed` |

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
| R8 | Rate limiting ausente | Média | Médio | Fase 3 |
| R9 | Upload sem limite enche volume | Média | Alto | Validar tamanho e tipo |
| R10 | CORS aberto em produção | Baixa | Alto | Checklist de pré-lançamento |

---

## 9. Plano de ação sugerido

### Sprint 1 — Inauguração (sem código novo, só configuração)

1. Gerar `INTERNAL_API_SECRET` e colocar igual nos dois `.env`
2. Rodar `make migrate` (tabela `notification`)
3. Configurar `SUPERFRETE_TOKEN` e recarregar carteira sandbox
4. Configurar `RESEND_API_KEY`, `RESEND_FROM`, `STOREFRONT_URL`, `EMAIL_LOGO_URL`, `EMAIL_ATENDIMENTO`
5. Publicar 3 templates no Resend e aguardar verificação de domínio (até 4h)
6. Configurar `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_AMBIENTE=producao`
7. Configurar `MP_NOTIFICATION_URL` com HTTPS público (túnel ou produção)
8. Configurar `MP_BACK_URL` no domínio real
9. Validar uma compra de verdade (cartão de produção, valor baixo)

### Sprint 2 — Experiência do comprador (2-3 semanas)

10. RV-004 Filtros de catálogo
11. RV-005 Busca de produtos
12. RV-007 SEO
13. RV-008 Parcelamento na vitrine

### Sprint 3 — Qualidade e UX (2-3 semanas)

14. RV-009 Guia de medidas
15. RV-010 Calculadora de frete na PDP
16. RV-011/016 Badge e tamanhos no card
17. RV-019 Acessibilidade
18. RV-020 Exceções de carrinho

### Sprint 4 — Infraestrutura (pós-inauguração)

19. RV-023 S3 + CDN
20. RV-024 Validação de upload
21. RV-025 Rate limiting
22. RV-026 Analytics
23. RV-028 Teste E2E

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