<!--
  Parte 1 do registro de débito técnico.
  Entrada, legenda de severidade e mapa dos assuntos: `docs/DEBITO-TECNICO.md`.
  Os números dos itens são os mesmos de sempre (1.x).
-->

# 1. 🔴 Bloqueadores de produção

### 1.1 Pagamento real ausente

**Evidência:** `backend/src/scripts/seed.ts:131`

```ts
payment_providers: ["pp_system_default"],
```

O seed registra apenas o provider `pp_system_default` (o *system default* do Medusa).
Dependendo da configuração do módulo de payment, isso faz o pedido ser marcado como pago
**sem cobrança real** — ou seja, é possível "fechar" um pedido sem que nenhum valor seja
capturado.

**Agravante:** as opções de frete no mesmo seed são `price_type: "flat"` com valor fixo
(`seed.ts:235-300`): PAC R$ 19,90 e SEDEX R$ 34,90, independente de CEP, peso ou dimensão.

**Ação necessária:**

1. Escolher provider (Mercado Pago — Pix/boleto/cartão BR — vs Stripe).
2. Configurar credenciais e registrar o provider no módulo de payment do
   `backend/medusa-config.ts` (hoje o array de módulos não inclui payment).
3. Criar fluxo de webhook para confirmação assíncrona (Pix/boleto só confirmam depois).
4. Substituir o flat rate por cálculo real (Correios/transportadora) ou aceitar o flat
   conscientemente como política comercial.

> **Decisão pendente do stakeholder:** provider de pagamento. Sem isso não há como planejar
> a execução deste item.

---

### 1.2 CORS bloqueia o storefront (`:8000`)

**Status: resolvido em 2026-09-26.**

**Evidência do problema (histórico):** `.env.example` e os fallbacks do `docker-compose.yml`
traziam as portas padrão do template Medusa, não as do projeto:

```bash
STORE_CORS=http://localhost:3000,http://127.0.0.1:3000
ADMIN_CORS=http://localhost:9000,http://localhost:5173,...
AUTH_CORS=http://localhost:3000,http://localhost:9000,http://localhost:5173,...
```

**Impacto (histórico):** o browser do storefront em `:8000` era bloqueado por CORS ao chamar a
Store API, e login/registro (`/auth/*`) falhava por `AUTH_CORS`. As portas reais do projeto são
`9000` (backend + admin) e `8000` (storefront).

**Correção verificada:**

| Onde | Estado |
|---|---|
| `.env.example:88-90` | `STORE_CORS`/`AUTH_CORS` com `:8000`; `3000`/`5173` removidos |
| `docker-compose.yml:138-140` | fallbacks `${STORE_CORS:-http://localhost:8000,...}` alinhados |
| serviço `frontend` no compose | existe e publica `:8000` — não há mais subida manual do front |

> **Armadilha restante (operação, não código):** o `.env` da raiz **sobrescreve** esses fallbacks.
> Um `.env` criado antes desta correção continua com `:3000` e reintroduz o bloqueio mesmo com o
> compose correto. Recrie-o com `cp .env.example .env`. Isso foi observado e corrigido no `.env`
> local durante a varredura de 2026-09-26.

---

### 1.3 Segredos com default fraco e versionado

**Evidência:** `docker-compose.yml:54-55`

```yaml
JWT_SECRET: ${JWT_SECRET:-real_valor_jwt_secret_key_medusa_v2_2026}
COOKIE_SECRET: ${COOKIE_SECRET:-real_valor_cookie_secret_key_medusa_v2_2026}
```

O valor inseguro é o **fallback** (`:-`): se a variável não for definida no ambiente, o
serviço sobe silenciosamente com um segredo público e conhecido.

**Verificado — sub-item que NÃO se aplica:** o `.env` **não está versionado**; já consta no
`.gitignore`. O que está versionado são apenas templates sem segredo real: `.env.example` e
`frontend/.env.template`.

> Os antigos `backend/.env.docker`, `backend/.env.template` e `backend/.env.test` foram
> **removidos** na consolidação de 2026-09-26: com um único `.env` na raiz lido automaticamente
> pelo Compose (sem `--env-file`, sem `env_file:`), manter três templates no backend era a origem
> direta da divergência de CORS descrita em 1.2.

**Impacto:** em deploy onde o `JWT_SECRET` não for exportado, o fallback permite forjar
sessões — inclusive de admin — reproduzindo o valor público do compose.

**Ação necessária:**

1. Substituir `${JWT_SECRET:-...}` por `${JWT_SECRET:?JWT_SECRET é obrigatório}` para falhar
   no boot em vez de usar default.
2. Rotacionar os segredos atuais e injetá-los via *secret manager* / variáveis de ambiente
   do host (nunca valores literais no compose).
3. Aplicar o mesmo padrão ao `COOKIE_SECRET` e às credenciais de banco.

---

