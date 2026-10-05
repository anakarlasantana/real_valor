# Módulo de pagamento — Mercado Pago (Checkout Pro)

O provider de pagamento da Real Valor: **dois meios**, um provedor, uma conta.

| `provider_id` | Meio | Módulo | Preferência |
| --- | --- | --- | --- |
| `pp_mercadopago_pix` | Pix | `./pix` | só Pix, à vista |
| `pp_mercadopago_cartao` | Cartão de crédito | `./cartao` | sem boleto/Pix, até 12× |

O `pp_system_default` do Medusa continua registrado — e é o item 1 da lista de
produção abaixo.

---

## Como o dinheiro entra

```
 cliente clica em "Pagar"
        │
        ▼
 storefront: initiatePaymentSession(pp_mercadopago_pix)
        │
        ▼
 service.ts: initiatePayment
        │  POST /checkout/preferences  →  init_point
        ▼
 storefront: window.location = session.data.init_point     ← sai da loja
        │
        ▼
 Mercado Pago: a cliente paga
        │
        ├──────────────────────────────┐
        ▼                              ▼
 navegador volta para             POST /webhooks/mercadopago
 MP_BACK_URL                      (o Mercado Pago chama)
        │                              │
        ▼                              ▼
 /api/pedido/status                webhook.ts: valida a assinatura
 (storefront, por cookie)          → GET /v1/payments/{id}
        │                          → resolve a sessão pelo external_reference
        │                          → confere o valor
        │                          → grava o selo mp_confirmacao
        │                          → emite payment.webhook_received
        │                              │
        │                              ▼
        │                          service.ts: authorized → SUCCESSFUL
        │                              │
        │                              ▼
        │                          Medusa: processPaymentWorkflow
        │                          → authorizePayment (confere o selo)
        │                          → capturePayment
        │                          → completeCartWorkflow  ← O PEDIDO NASCE AQUI
        │                              │
        └──────────────┬───────────────┘
                       ▼
              a página de confirmação acha o pedido
              e mostra o número
```

**O pedido nasce no webhook, não no navegador.** Isso não é detalhe de
implementação: é o que faz um navegador fechado no meio do pagamento não perder
a venda, e o que faz "o pagamento aprovado" e "o pedido existir" serem a mesma
coisa em vez de duas que podem discordar.

---

## Os arquivos, e o que cada um decide

| Arquivo | A decisão que mora nele | Puro? |
| --- | --- | --- |
| `credenciais.ts` | quais variáveis existem, que **nada tem valor padrão** — e o switch `MP_AMBIENTE` × forma do token | lê env |
| `assinatura.ts` | **esta notificação é do Mercado Pago?** | ✅ |
| `redigir.ts` | **o que pode sair** de um pagamento (lista fechada) | ✅ |
| `preferencia.ts` | o documento da cobrança: valor, meios, voltas | ✅ |
| `contexto.ts` | o contrato rota ⇄ provider | ✅ |
| `cliente.ts` | as **duas** chamadas HTTP, e onde o erro é redigido | rede |
| `service.ts` | o provider: cria a preferência, decide o webhook | misto |
| `webhook.ts` | o porteiro: assinatura, sessão, valor, evento | misto |
| `pix/`, `cartao/` | qual meio cada registro é | ✅ |

---

## As cinco checagens do webhook

Em `getWebhookActionAndData` (o provider) e em `webhook.ts` (a rota), e **nenhuma
confia no corpo**:

1. **A assinatura confere?** HMAC-SHA256 do manifesto, comparado com
   `timingSafeEqual`. Sem segredo configurado, **recusa** — em vez de aceitar.
2. **O provedor confirma?** `GET /v1/payments/{id}`. Status e valor saem daí.
3. **O `external_reference` aponta para uma sessão nossa?**
4. **O valor bate com o da sessão?** Divergência → nada é aplicado, e o log pede
   conferência manual.
5. **A sessão é deste provider?** Um evento do Pix não é processado pelo cartão.

E a barreira que faz a rota nativa do Medusa ser inofensiva: **o provider recusa
qualquer evento sem o contexto verificado** (`contexto.ts`), que só a nossa rota
produz.

---

## Antes de ir para produção

1. ⚠️ **`pp_system_default` aparece no checkout — e não dá para desligá-lo pelo
   Admin.**

   Ele é um meio que "paga" sem cobrar nada (o `SystemPaymentProvider` do
   Medusa), e o loader do módulo de pagamento o registra
   **incondicionalmente** e o **re-habilita no banco a cada boot**:

   ```
   @medusajs/payment/dist/loaders/providers.js
     registrationFn(SystemPaymentProvider, { id: "default" })   ← sempre
     ...registerProvidersInDb → is_enabled: true para tudo da lista
   ```

   Desmarcar "ativo" no Admin não resolve: o próximo `up` reativa. O caminho
   correto é **filtrar a lista de payment providers do lado do storefront** (ou
   um middleware na rota `/store/payment-providers`). Enquanto isso não for
   feito, a loja oferece um meio que cria pedido sem pagamento.

2. ⚠️ **`MP_AMBIENTE` declarado, e o token coerente com ele.**

   O prefixo do token **não** diz se a conta é de teste. A documentação do
   Mercado Pago é explícita: *"The test Access Token starts with the prefix
   **APP_USR**, just like your production Access Token."* Medido nesta conta: um
   `APP_USR-` cuja `GET /users/me` devolve `nickname: TESTUSER…` e
   `tags: [user_product_seller, test_user, normal]`.

   Por isso o ambiente é **declarado**, e o provider o confere no boot:

   | `MP_AMBIENTE` | token | desfecho |
   | --- | --- | --- |
   | `producao` | `TEST-` | **ERRO** no log e pagamento **recusado** no checkout |
   | `teste` | `APP_USR-` | aviso no log; o pagamento segue (é o caso desta loja) |
   | `producao` | `APP_USR-` | — |
   | `teste` | `TEST-` | — |

   Ausente = `teste`. O prefixo continua decidindo **uma** coisa — `init_point`
   vs `sandbox_init_point` (`pontoDeInicio`, em `cliente.ts`) —, que é uma
   pergunta sobre a API e não sobre a intenção de quem configurou.

3. **`MP_WEBHOOK_SECRET` preenchido, e de produção.** Sem ele o backend responde
   **401 em todo webhook** — e um 401 é silencioso de quem envia. Ele está no
   painel em *Notificações → Webhooks → Segredo da assinatura*.

4. **`MP_NOTIFICATION_URL` com HTTPS e público**, terminando em
   `/webhooks/mercadopago`. Sem ele o pagamento funciona e o pedido **nunca
   nasce** — a venda é manual até alguém perceber.

5. **`INTERNAL_API_SECRET` gerado** (`openssl rand -hex 32`) e igual nos dois
   serviços. Sem ele a página de confirmação responde 503.

6. **`MP_BACK_URL` no domínio real.** Sem ele a cliente termina o pagamento
   dentro do Mercado Pago e não volta para a loja.

7. **Testar uma venda de verdade** com cartão de produção e valor baixo, e
   conferir: pedido criado, `payment_session.provider_id` correto, uma linha
   `[mercadopago/pix] … aprovado · sessão …` no log do backend, e o webhook com
   **200** no painel do Mercado Pago.

---

## O que este módulo NÃO faz, de propósito

- **Estorno automático.** `refundPayment` lança com a instrução de estornar no
  painel do Mercado Pago. Devolver dinheiro a partir de uma notificação de
  webhook é uma decisão que não pertence a um webhook.
- **Captura adiada.** `capturePayment` é no-op: sem `capture: false`, o Mercado
  Pago já capturou quando o status vira `approved`.
- **Cancelamento de Pix.** `cancelPayment` é no-op: o QR expira sozinho.
- **Criação de pedido para Pix pendente.** `pending` não faz nada — senão cada
  QR gerado e abandonado reservaria estoque.
- **Rate limit.** O Medusa não traz um, e uma rota pública de webhook é um alvo
  óbvio. Aceito no curto prazo porque a assinatura é verificada **antes** de
  qualquer trabalho (uma tentativa inválida custa um HMAC e uma linha de log), e
  porque não há nada a vazar: a rota não tem estado. Fica registrado.

---

## Testes

```bash
cd backend && yarn test:unit          # 90 testes só deste módulo
cd backend && npx tsc --noEmit        # o registro é fiação de runtime: tsc não vê
node scripts/check-boundaries.mjs
```

- `assinatura.unit.spec.ts` — os casos de **recusa** (que valem mais que o de
  aceite).
- `preferencia.unit.spec.ts` — o documento que vai ao provedor, e o centavo ↔
  real.
- `credenciais.unit.spec.ts` — o switch de ambiente: `MP_AMBIENTE` × a forma do
  token, a recusa de `producao` + `TEST-`, e o log de boot que **não** pode
  chamar um token de conta de teste de "produção".
- `webhook.unit.spec.ts` — o que aconteceu quando chegou o POST, com o `fetch`
  dublado.
- `registro.unit.spec.ts` — config ⇄ classe ⇄ contrato, os três lados numa
  asserção.
