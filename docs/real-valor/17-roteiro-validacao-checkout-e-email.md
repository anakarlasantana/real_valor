# 17 — Roteiro de validação manual: checkout e e-mail transacional

> **Para que serve.** Fechar os quatro P0 de checkout exige duas coisas diferentes:
> o código (feito, resumido na §17.1) e a **prova com a loja rodando** (§17.4 a
> §17.7). Este documento é o roteiro dessa prova e a lista do que ainda depende de
> uma pessoa, não de um deploy.
>
> **Estado:** 19/10/2026. O change set está fechado; os gates de build desta
> máquina estão na §17.2. O que falta é configuração externa (Resend, domínio,
> templates), `make migrate` e a compra real.
>
> **A narrativa técnica** — por que cada correção é assim — está em
> [`15-arquitetura-modular.md`](15-arquitetura-modular.md) §15.10. **A configuração
> do e-mail** (passo a passo do Resend e variáveis de cada template) está em
> [`backend/src/modules/notification/README.md`](../../backend/src/modules/notification/README.md).

---

## 17.1 O que foi feito

Os quatro bloqueadores, o sintoma que cada um causava e onde a correção mora.

| # | P0 | Sintoma antes | Correção | Arquivos principais |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Checkout em branco quando o SuperFrete falha** | `listCartShippingMethods` devolvia `null` tanto para "falhou" quanto para "não há opção"; o `CheckoutForm` fazia `return null` e o formulário sumia, deixando só o resumo | O retorno virou um estado tipado (`ok`, `sem-opcoes`, `indisponivel`), a chamada usa `cache: "no-store"` e a tela troca o `null` por um `EmptyState` que diz o motivo e oferece a saída | `frontend/src/lib/checkout/delivery-availability.ts`, `frontend/src/lib/data/fulfillment.ts`, `frontend/src/modules/checkout/templates/checkout-form/index.tsx`, `frontend/src/modules/checkout/components/checkout-unavailable/index.tsx`, `frontend/src/styles/brand/11-checkout.css` |
| 2 | **`pp_system_default` oferecido como pagamento** | O `SystemPaymentProvider` do Medusa cria pedido **sem cobrar** e o loader o reabilita a cada boot; desmarcar no Admin não resolvia | O storefront filtra o id exato em `meiosDePagamentoVisiveis`, aplica o filtro na camada de dados e ignora uma sessão pendente desse provedor no `Payment` e no `PaymentButton`. O filtro é **incondicional** (não depende de `NODE_ENV`) | `frontend/src/lib/payments/providers.ts`, `frontend/src/lib/data/payment.ts`, `frontend/src/modules/checkout/components/payment/index.tsx`, `frontend/src/modules/checkout/components/payment-button/index.tsx` |
| 3 | **`INTERNAL_API_SECRET` não documentado** | A rota interna `GET /internal/orders/by-cart` respondia 404 indistinto sem o segredo; a página de confirmação ficava em "aguardando" e ninguém sabia por quê | O segredo entrou no `.env.example` (bloco "Chamada INTERNA") e no checklist de produção do README, com `openssl rand -hex 32` e a regra de o **mesmo** valor nos dois serviços. Não houve mudança de runtime: a variável já era exigida | `.env.example`, `README.md` |
| 4 | **Nenhum e-mail transacional** | A página de pedido confirmado prometia "Enviamos todos os detalhes para o seu e-mail" e nenhum e-mail saía | Módulo `notification` registrado com provider condicional (Resend ou `local`), ponto único de envio, três templates, subscribers de pedido/enviado/cancelado e `avisar` no fluxo do SuperFrete. O erro de envio **não** derruba o pedido | `backend/medusa-config.ts`, `backend/src/modules/notification/**`, `backend/src/subscribers/{order-confirmation,order-canceled,superfrete-webhook}.ts`, `backend/src/modules/shipping/tracking.ts`, `backend/src/api/admin/shipping/[id]/route.ts` |

### 17.1.1 Os três estados da entrega

| Estado | Quando | O que a cliente vê |
| :--- | :--- | :--- |
| `ok` | A cotação voltou com pelo menos uma opção | O formulário, como antes |
| `sem-opcoes` | A cotação voltou `[]` | "Não há entrega para este endereço" + **Conferir endereço na sacola** |
| `indisponivel` | A cotação lançou ou voltou `null` | "Não conseguimos calcular a entrega" + **Tentar novamente** |

O `no-store` é parte da correção, não um detalhe: sem ele uma falha passageira do
SuperFrete poderia ficar gravada no cache do Next e o checkout continuaria
indisponível **depois** de a transportadora voltar.

### 17.1.2 O que o e-mail cobre

| Template (alias no Resend) | Evento | Chave de idempotência |
| :--- | :--- | :--- |
| `pedido-confirmado` | `order.placed` (o pedido nasce com o pagamento aprovado) | `order-placed:<order_id>` |
| `pedido-enviado` | `superfrete.entrega` e o painel de envio | `order-shipped:<order_id>:<código>:<situação>` |
| `pedido-cancelado` | `order.canceled` e o cancelamento pelo SuperFrete | `order-canceled:<order_id>` |

As duas portas do cancelamento usam a **mesma** chave: um cancelamento que dispara
Admin **e** etiqueta gera um e-mail só. Um código de rastreio novo (ou uma situação
nova) tem chave nova e gera um aviso novo; repetir o mesmo webhook não duplica.

O envio é registrado em `notification` **antes** de chamar o provider. Isso deixa
rastro do que falhou e é o que segura a reentrega. Um e-mail que não saiu **não**
desfaz o pedido: o erro é logado com o destinatário mascarado e engolido.

---

## 17.2 Build e gates (medidos nesta máquina)

A tabela abaixo é o resultado real de 19/10/2026, rodando a partir da raiz. Os
comandos são os do repositório — não há passo manual escondido.

| Verificação | Comando | Resultado |
| :--- | :--- | :--- |
| Guardas de arquitetura, contrato e comentários | `make check` | ✅ todos os guardas verdes (5 artefatos em dia, R-A a R-E ok, comentários no baseline) |
| Tipos dos três runtimes | `make types` | ✅ exit 0 — backend, storefront e painel (`tsc --noEmit`) |
| Build das imagens de **desenvolvimento** | `make build` | ✅ `real_valor_backend:dev` e `real_valor_frontend:dev` construídas (exit 0) |
| Build das imagens de **produção** | `make build PROD=1` | ✅ `real_valor_backend:local` e `real_valor_frontend:local` construídas (exit 0) |
| Testes de unidade do backend | `cd backend && yarn test:unit` | ✅ **643 testes / 36 suítes** |
| Testes do CRM (painel) | `cd admin && ../node_modules/.bin/jest -c jest.config.js` | ✅ **182 testes / 13 suítes** |
| Testes do storefront | `cd frontend && yarn test` | ✅ **486 testes / 36 arquivos** |

> **Por que os dois builds.** `make build` sozinho usa o `docker-compose.override.yml`
> (estágio `dev`, sem compilar o app). Quem prova que `medusa build` e `next build`
> passam é `make build PROD=1`, que usa o estágio `runner`.

No build de produção, o `medusa build` terminou com
`Backend build completed successfully` e `Frontend build completed successfully`
(o admin em Vite). O `next build` compilou e gerou as 7 páginas estáticas. Ele
registra `getaddrinfo ENOTFOUND backend` ao carregar tema/páginas durante a
geração — **esperado**: o builder do Compose não está na rede da stack, e o
conteúdo cai no fallback; em runtime as páginas são ISR e buscam o backend. O
build **não** falha por isso.

### 17.2.1 A armadilha do `yarn build` no host

`medusa build` carrega `medusa-config.ts` pelo `ts-node` em modo CJS, e o pacote
`@rv/contrato` é ESM (`packages/contrato/package.json` tem `"type": "module"`).
No host isso termina em:

```
Error [ERR_REQUIRE_ESM]: Must use import to load ES Module:
  .../packages/contrato/src/schema.ts
```

O `backend/Dockerfile` já resolve com
`TS_NODE_IGNORE="/node_modules/|/packages/contrato/"`; o Node 22 do container faz
o type-stripping e o `require()` de ESM. **Não é regressão deste change set** — é
o mesmo motivo pelo qual o build de referência é o do Docker. Se precisar rodar no
host, exporte a mesma variável antes:

```bash
TS_NODE_IGNORE="/node_modules/|/packages/contrato/" yarn --cwd backend build
```

---

## 17.3 Preparação (uma vez por ambiente)

### 17.3.1 Variáveis

| Variável | Para que serve | Sem ela |
| :--- | :--- | :--- |
| `RESEND_API_KEY` | Autentica o `POST /emails` | O provider `resend` não é registrado; o `local` só loga |
| `RESEND_FROM` | Remetente verificado (`Real Valor <nao-responda@dominio>`) | Idem; meia configuração é avisada no boot |
| `STOREFRONT_URL` | URL **pública** usada nos links do e-mail | O template recebe `LINK_PEDIDO`/`LINK` vazio |
| `EMAIL_LOGO_URL` | Logo do topo dos templates (URL **absoluta e pública**) | Remova a linha do `<img>` no Resend (`src=""` = ícone quebrado) |
| `EMAIL_ATENDIMENTO` | E-mail do botão e do rodapé | Usa `atendimento@realvalor.com.br` (o mesmo do `/store/checkout/info`) |
| `INTERNAL_API_SECRET` | `x-rv-internal` na rota `GET /internal/orders/by-cart` | A confirmação do pedido fica em "aguardando" |
| `SUPERFRETE_TOKEN` | Cotação e etiqueta | A cotação falha e o checkout mostra `indisponivel` |
| `MP_*` | Pagamento real | O checkout mostra "pagamento indisponível" (lista vazia) |

`STOREFRONT_URL` **não** é `FRONTEND_URL`: o segundo é o endereço interno do
Compose (`http://frontend:8000`) e não abre no navegador de ninguém.

### 17.3.2 Passos

1. **Suba a stack** e confirme a saúde:

   ```bash
   make up
   make health
   ```

2. **Crie a tabela de notificação** (uma vez em DEV; em produção o container roda
   as migrations na subida):

   ```bash
   make migrate
   ```

   O `RUN_MIGRATIONS` do overlay de DEV é `0` de propósito. Sem esta linha, o
   primeiro pedido falha ao gravar a notificação — o e-mail não sai e o log aponta
   a tabela ausente.

3. **Configure o Resend** seguindo o
   [README do módulo](../../backend/src/modules/notification/README.md):
   conta → domínio verificado (DKIM/SPF) → API key com *Sending access* →
   `RESEND_API_KEY`, `RESEND_FROM` e `STOREFRONT_URL` no `.env` da raiz.

4. **Crie e PUBLIQUE os três templates** com os aliases exatos
   `pedido-confirmado`, `pedido-enviado` e `pedido-cancelado`. Rascunho **não**
   envia. As variáveis de cada um estão no README do módulo; defina todas como
   `string` (o backend manda `R$ 349,90`, não número).

5. **Recrie o backend** para ele ler o `.env`:

   ```bash
   make recreate SERVICE=backend
   ```

6. **Confirme que o provider foi registrado.** O boot não deve avisar de meia
   configuração (`RESEND_API_KEY` sem `RESEND_FROM`, ou o contrário). Se as duas
   estiverem ausentes, o `local` assume e o e-mail só aparece no log.

### 17.3.3 Se o backend entrar em `EADDRINUSE :::9000`

O watcher do `medusa develop` pode deixar o processo antigo segurando a porta
depois de um reload. O container continua "running", mas o servidor novo não sobe:

```
Error: listen EADDRINUSE: address already in use :::9000
```

Recrie **só** o backend — não é preciso derrubar o banco:

```bash
make recreate SERVICE=backend
```

---


## 17.4 Roteiro 1 — a entrega não pode sumir com o checkout

**Antes de começar:** um produto no carrinho, um endereço completo e a loja
aberta em `/br/checkout`. O endpoint que o formulário chama é
`GET /store/shipping-options?cart_id=…`; vale abrir a aba Network para ver a
resposta de cada caso.

### Caso A — tudo certo (`ok`)

1. Informe um CEP atendido e salve o endereço.
2. **Esperado:** as opções de entrega aparecem, a mais barata vem selecionada e o
   formulário inteiro (endereço, entrega, pagamento, revisão) continua na tela.

### Caso B — não há entrega para o endereço (`sem-opcoes`)

A forma determinística de produzir o estado é desligar os serviços, em vez de
procurar um CEP sem cobertura:

1. Abra `/painel/frete/servicos` e desligue **todos** os serviços.
2. Volte ao checkout e recalcule a entrega (recarregue a página).
3. **Esperado:**
   - o formulário **não** some;
   - aparece "Não há entrega para este endereço";
   - o texto explica que nenhuma transportadora atende o CEP;
   - há **Conferir endereço na sacola** e **Continuar comprando**.
4. Religue os serviços e confirme que o checkout volta ao normal **sem** precisar
   limpar cache.

### Caso C — a transportadora não respondeu (`indisponivel`)

1. No `.env` da raiz, troque `SUPERFRETE_TOKEN` por um valor inválido.
2. `make recreate SERVICE=backend` (o frontend não precisa).
3. Abra o checkout com um carrinho e um endereço válidos.
4. **Esperado:**
   - o formulário **não** some;
   - aparece "Não conseguimos calcular a entrega";
   - o texto diz que a transportadora não respondeu e que as peças continuam na
     sacola;
   - há **Tentar novamente** e **Voltar para a sacola**.
5. Restaure o token, recrie o backend e clique em **Tentar novamente** (ou
   recarregue). **Esperado:** as opções voltam. Se elas não voltarem, o
   `no-store` foi perdido — é o teste que prova a parte do cache.

### Caso D — o preço de uma opção falha

Este caso **não** é coberto pela mensagem de página inteira: a opção é desenhada
desabilitada, com `-` no preço, e o botão **Continuar** fica travado. É o
comportamento documentado em §15.10.1; se a loja quiser uma mensagem própria
nesse ponto, é um ajuste novo.

### Critérios de aceite do roteiro 1

- [ ] Nenhum dos três estados deixa a área do formulário vazia.
- [ ] `sem-opcoes` e `indisponivel` têm textos e ações **diferentes**.
- [ ] A falha do caso C não fica cacheada depois de o token ser restaurado.
- [ ] O console/Network não mostra erro de hidratação ao trocar de estado.

---

## 17.5 Roteiro 2 — o meio manual não pode ser escolhido

### Caso A — carrinho novo

1. Monte um carrinho novo e avance até a etapa de pagamento.
2. **Esperado:** a lista traz apenas meios reais (Mercado Pago, quando
   configurado). Não aparece "Manual", "Sistema" nem `pp_system_default`.
3. Confira a resposta crua da API: `GET /store/payment-providers?region_id=…`
   **continua** devolvendo `pp_system_default` — o provider segue registrado no
   backend de propósito. O que não pode acontecer é ele chegar à tela. Essa
   diferença é o teste: o filtro é do storefront, em `lib/data/payment.ts`.

### Caso B — sessão manual pendente (carrinho antigo)

Um carrinho criado antes do deploy pode ter uma sessão `pp_system_default`
pendente. Para simular, crie uma sessão manual num carrinho de teste pela Store
API (`POST /store/carts/:id/payment-sessions` com
`provider_id: "pp_system_default"`), ou use um carrinho que já esteja nesse
estado no banco de desenvolvimento.

1. Abra o checkout desse carrinho.
2. **Esperado:** o meio manual **não** aparece selecionado; o `Payment` ignora a
   sessão pendente e a cliente precisa escolher um meio real.
3. Clique em **Finalizar compra** sem escolher outro meio.
4. **Esperado:** a compra **não** conclui e nenhum pedido é criado. Se um pedido
   aparecer com `payment_status` pendente e sem cobrança, o filtro do
   `payment-button` não está valendo — é bloqueador.

### Caso C — lista de pagamentos vazia

1. Desative/remova o provider real da região (ou use uma região sem provider).
2. Abra o checkout.
3. **Esperado:** "Pagamento indisponível no momento" com **Tentar novamente** e
   **Voltar para a sacola** — não uma tela em branco nem um botão que não faz
   nada.

### Critérios de aceite do roteiro 2

- [ ] O meio manual não aparece em nenhuma etapa.
- [ ] Uma sessão antiga dele não conclui a compra.
- [ ] Lista vazia tem estado visível, não `null`.

---


## 17.6 Roteiro 3 — os três e-mails

Abra o log do backend numa aba antes de começar. Ele é a primeira evidência, e a
segunda é o painel do Resend:

```bash
docker logs -f real_valor_backend | grep -E '\[email\]|\[aviso\]'
```

### 17.6.1 `pedido-confirmado` — o pedido nasceu

**Caminho real (recomendado):** pague um pedido de valor baixo pelo Mercado Pago
em sandbox, com um e-mail que você controla. No fluxo do MP o pedido só nasce
depois da aprovação; é esse `order.placed` que dispara o e-mail.

**Caminho sem cobrança (para testar o texto):** no Admin, crie um **pedido em
rascunho** com um item, e-mail e endereço de entrega e use **Converter em
pedido**. O fluxo `convert-draft-order` emite `order.placed`, então o e-mail sai
sem pagamento.

**Esperado:**

- assunto e corpo vêm do template `pedido-confirmado` publicado no Resend;
- `NOME_CLIENTE` é o primeiro nome do endereço de entrega (ou "Cliente");
- `NUMERO_PEDIDO` é o `display_id`, não o `order_…` interno;
- `DATA_PEDIDO` é a data do pedido como `dd/mm/aaaa` (fuso de São Paulo);
- `RESUMO_ITENS` mostra uma linha por item, em texto:
  `2× Vestido Midi (M / Rosa) — R$ 259,90`;
- `VALOR_TOTAL` está em reais (`R$ 349,90`) e `STATUS_PAGAMENTO` aparece
  traduzido (`Aprovado`, `Aguardando confirmação`…);
- `ENTREGA` é o nome da modalidade escolhida;
- o botão (`LINK_PEDIDO`) abre `STOREFRONT_URL/<país>/order/<id>/confirmed`;
- o log mostra `[email] confirmação do pedido <display_id> enviada para a***@…`;
- o Resend mostra o envio em *Emails*, e o `external_id` da linha em
  `notification` é o id do e-mail lá.

**Teste de escape:** cadastre um produto com `<b>` ou `&` no título, refaça um
pedido e confira que o e-mail mostra o texto literal — `ITENS` é HTML montado
pelo backend e o título vem escapado. Em `RESUMO_ITENS` o texto vai como texto
(variável de chaves duplas), então os mesmos caracteres aparecem literalmente.

### 17.6.2 `pedido-enviado` — a etiqueta saiu ou o rastreio mudou

1. Abra `/painel/shipping` e escolha o pedido.
2. Gere a etiqueta pelo SuperFrete **ou** preencha transportadora, código de
   rastreio e situação e clique em **Salvar**.
3. **Esperado:** o e-mail `pedido-enviado` chega com `SITUACAO`,
   `TRANSPORTADORA`, `CODIGO_RASTREIO`, `LINK_RASTREIO`, `PREVISAO_ENTREGA` e
   `LINK_PEDIDO`.
   - `SITUACAO` é o rótulo que o painel mostra ("Postada", "Em trânsito"…), ou
     "Atualizado" quando não houver;
   - `PREVISAO_ENTREGA` é sempre **"A confirmar"** — o sistema não registra prazo;
   - sem código de rastreio, `CODIGO_RASTREIO` vem "Consulte a transportadora"
     (e `RASTREIO` vem vazio).
4. **Idempotência:** salve de novo **sem mudar nada**. Nada novo sai. Mude a
   situação (por exemplo, "Postada" → "Em trânsito") e salve: sai **um** e-mail
   novo, porque a chave inclui a situação.
5. **Só a transportadora mudou:** a chave não muda, então **não** sai e-mail. É o
   esperado; se a loja quiser avisar nesse caso, é uma decisão nova.

O caminho do webhook do SuperFrete faz a mesma chamada (`avisar`), com a mesma
chave. Se a etiqueta for atualizada pelo webhook e pelo painel, o segundo não
duplica.

### 17.6.3 `pedido-cancelado` — uma vez, mesmo com dois caminhos

1. Cancele um pedido pelo **Admin → Pedidos → Cancelar**.
2. **Esperado:** um e-mail `pedido-cancelado`, com `NOME_CLIENTE`,
   `NUMERO_PEDIDO`, `LINK_PEDIDO`, `DATA_CANCELAMENTO`,
   `MOTIVO_CANCELAMENTO` e `INFORMACAO_REEMBOLSO`.
   - `DATA_CANCELAMENTO` é o dia do cancelamento (`dd/mm/aaaa`);
   - `MOTIVO_CANCELAMENTO` vem "Cancelamento solicitado" e
     `INFORMACAO_REEMBOLSO` traz o texto padrão de estorno — o sistema **não**
     registra motivo nem reembolso, então não espere dado personalizado;
   - o texto padrão **não** cita prazo em dias: o backend não sabe quando o
     valor cai, e o e-mail não pode prometer o que a loja não controla.
3. Se o mesmo pedido também tiver a etiqueta cancelada em `/painel/shipping`, o
   caminho do SuperFrete usa a **mesma** chave (`order-canceled:<id>`). O segundo
   evento **não** manda outro e-mail.
4. Repita o webhook de cancelamento (ou cancele a etiqueta depois do Admin):
   continua um e-mail só.

> **Cuidado ao testar:** um pedido já cancelado não aceita novo cancelamento pelo
> Admin. Para repetir o cenário, use outro pedido.

---


### 17.6.4 Quando o e-mail não sai (e o pedido continua)

O envio é observado, não transacional com o pedido. Para conferir o
comportamento, quebre uma coisa de cada vez:

| Teste | Como provocar | Esperado |
| :--- | :--- | :--- |
| Template não publicado ou alias errado | Despublique `pedido-confirmado` (ou troque o alias) | O pedido continua; o log mostra `[email] "pedido-confirmado" … não saiu: O Resend recusou … (HTTP 422)`; a linha em `notification` fica `failure` |
| Domínio não verificado | Use um `RESEND_FROM` de domínio não verificado | HTTP 403 com a mensagem do Resend no log; pedido ok |
| Teto diário (100/dia no plano gratuito) | Não é preciso provocar; se acontecer | HTTP 429 no log; pedido ok |
| Resend fora do ar / lento | Bloqueie a saída ou use um host inválido | `O Resend não respondeu em 10s.` no log; pedido ok |
| Pedido sem e-mail | Converta um rascunho sem e-mail | `[email] pedido … sem e-mail: confirmação não enviada.`; nada quebra |
| Sem `RESEND_API_KEY`/`RESEND_FROM` | Deixe as duas vazias | `local` registra o conteúdo no log; nada sai |

**Link quebrado no e-mail:** antes de culpar o backend, confira o template no
Resend. As duas causas já encontradas nos arquivos desenhados fora do backend:

| Sintoma | Causa | Correção no editor |
| :--- | :--- | :--- |
| Botão do pedido leva a uma URL vazia ou com `{LINK_PEDIDO` | `href="{{{{LINK_PEDIDO}}}}"` — quatro chaves | `href="{{{LINK_PEDIDO}}}"` |
| Botão "falar com a gente" não abre o e-mail | `href="{{mailto:{{EMAIL_ATENDIMENTO}}}}"` | `href="mailto:{{{EMAIL_ATENDIMENTO}}}"` |
| E-mail de envio não diz qual é a situação | template sem a linha `SITUACAO` | `<tr><td class="label">Situação</td><td class="value">{{SITUACAO}}</td></tr>` |
| Logo do topo não aparece | `src="{{LOGO_URL}}"` — escapado | `src="{{{LOGO_URL}}}"` |
| Texto mostra `{{NOME_CLIENTE}}` cru | variável não declarada no template | declare-a como `string` |

Se `STOREFRONT_URL` estiver vazio, `LINK_PEDIDO` chega **vazio** — e isso é
proposital: melhor um e-mail sem botão do que um link para `http://backend:9000`.

**Logo quebrada:** `LOGO_URL` é o valor de `EMAIL_LOGO_URL`, e ele precisa ser
uma URL absoluta que o Gmail consiga baixar. Com a variável vazia, remova a
linha do `<img>` no editor; `src=""` aparece como ícone quebrado.

**Conferindo o rastro no banco:**

```bash
docker compose exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
select template, status, idempotency_key, external_id,
       to_char(created_at, 'DD/MM HH24:MI') as criado
from notification
order by created_at desc
limit 10;
SQL
```

O que olhar:

- uma linha `success` por fato;
- `external_id` preenchido (é o id do e-mail no Resend);
- uma tentativa que falhou fica `failure` com a mesma chave e **pode** ser
  tentada de novo no próximo evento com o mesmo fato;
- um fato que já saiu **não** é reenviado.

### 17.6.5 O modo `local` (desenvolvimento)

Sem as duas variáveis do Resend, o provider `local` assume. Ele **escreve as
variáveis no log** — nome, itens e total. Isso é aceitável em desenvolvimento e
**não** em produção: além de o e-mail não chegar, dados da cliente vão para o log
do container. O README do módulo diz isso em letras grandes, e o checklist de
produção repete.

Para voltar ao `local` de propósito:

```bash
# no .env: RESEND_API_KEY= e RESEND_FROM=
make recreate SERVICE=backend
```

---

## 17.7 Roteiro 4 — `INTERNAL_API_SECRET` e a página de confirmação

A página de pedido confirmado consulta o pedido do carrinho pela rota interna
`GET /internal/orders/by-cart`, com o header `x-rv-internal`. Sem o segredo (ou
com valores diferentes nos dois serviços), a rota responde 404 e a página fica em
"aguardando" — o pedido existe, mas não dá para consultá-lo por ali.

1. Gere um segredo e coloque **o mesmo** valor no `.env` da raiz:

   ```bash
   openssl rand -hex 32
   ```

   O Compose repassa a variável para o backend e para o frontend.

2. Recrie os dois serviços que a leem:

   ```bash
   make recreate SERVICE=backend
   make recreate SERVICE=frontend
   ```

3. Faça um pedido e abra a página de confirmação.
4. **Esperado:** os dados do pedido aparecem (status, itens, entrega), não o
   estado de espera.
5. **Teste negativo:** troque o segredo **só no backend**, recrie o backend e
   recarregue a confirmação. **Esperado:** a página volta a "aguardando" (404
   indistinto). Restaure o valor e recrie de novo.

Também dá para conferir a rota direto:

```bash
# 200 com o header correto; 404 sem ele ou com valor errado
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "x-rv-internal: <o-mesmo-segredo>" \
  "http://localhost:9000/internal/orders/by-cart?cart_id=cart_..."
```

> O segredo não é o e-mail da cliente nem um token de sessão: é a chave
> compartilhada entre os dois serviços. Não a coloque no bundle público nem no
> `NEXT_PUBLIC_*`.

---


## 17.8 O que ainda falta (checklist de fechamento)

Marque só depois de ver o efeito, não de configurar.

### Ambiente e operação

- [ ] `make migrate` rodou e a tabela `notification` existe no banco de DEV.
- [ ] `INTERNAL_API_SECRET` gerado e **igual** no backend e no frontend.
- [ ] `STOREFRONT_URL` é a URL **pública** (não `http://frontend:8000`).
- [ ] `SUPERFRETE_TOKEN` válido e a cotação volta ao normal.
- [ ] `MP_*` coerente com `MP_AMBIENTE` e `MP_NOTIFICATION_URL` público/HTTPS.
- [ ] O backend sobe sem o aviso de meia configuração de Resend.

### Resend (externo, não é código)

- [ ] Conta criada e e-mail confirmado.
- [ ] Domínio verificado (DKIM/SPF; DMARC se a loja já tiver).
- [ ] API key com *Sending access* em `RESEND_API_KEY`.
- [ ] `RESEND_FROM` usa o domínio verificado.
- [ ] Os três templates existem, estão **publicados** e com os aliases exatos.
- [ ] Todas as variáveis estão declaradas como `string`.
- [ ] `RASTREIO` e `LINK_RASTREIO` têm fallback (podem vir vazios).

### Prova de ponta a ponta

- [ ] Compra real (ou sandbox) gera `pedido-confirmado`.
- [ ] Etiqueta/rastreio gera `pedido-enviado`.
- [ ] Cancelamento gera **um** `pedido-cancelado`, mesmo com os dois caminhos.
- [ ] Repetir o mesmo webhook não duplica e-mail.
- [ ] Pedido sem e-mail não quebra e aparece no log.
- [ ] Falha do Resend não desfaz pedido e deixa linha `failure`.
- [ ] Nenhum meio manual aparece no checkout; sessão antiga não conclui.
- [ ] Os três estados de entrega foram vistos na tela.

### Antes do commit

- [ ] `make check`
- [ ] `make types`
- [ ] `make build PROD=1` (é o que compila de verdade)
- [ ] `git diff --check`
- [ ] `git status` só com os arquivos deste change set

---

## 17.9 Limites conhecidos e decisões ainda abertas

Não são bugs escondidos: são o que o código **não** promete hoje.

| Tema | O que acontece | O que fazer |
| :--- | :--- | :--- |
| **Sem fila de retry** | Um envio que falhou fica `failure`; ele só é tentado de novo quando o **mesmo fato** volta a ocorrer | Para uma loja pequena, o volume não justifica a fila. Se o Resend cair por horas, o e-mail daquele fato não é reenviado sozinho |
| **Confirmação em `order.placed`** | Hoje o pedido nasce depois da aprovação do MP. Se um meio futuro criar o pedido **antes** da aprovação (Pix/boleto), a confirmação sairia cedo | Revisitar quando entrar um meio com pagamento pendente |
| **`local` loga dados pessoais** | Nome, itens e total vão para o log | Só desenvolvimento. Em produção, configure o Resend |
| **Plano gratuito do Resend** | 100 e-mails/dia, 3.000/mês | Para o volume atual é folgado; o teto falha com 429 e **não** derruba o pedido |
| **E-mail de envio depende do pedido ter e-mail** | Pedido sem e-mail só avisa no log | O checkout já coleta e-mail; rascunhos criados no Admin podem não ter |
| **E-mail de envio não cobre mudança só de transportadora** | A chave usa código + situação | Se a loja quiser, é uma decisão de produto (chave nova) |
| **Sem e-mail de reembolso/devolução** | Fora do escopo dos quatro P0 | Entra quando o fluxo existir |
| **Busca de pedido sem login** | A pergunta `id + e-mail` vs. magic link segue aberta | Decidir antes de divulgar a página de acompanhamento para guest |
| **Catálogo no sitemap** | A pergunta "agora ou depois" segue aberta | Não bloqueia o checkout |
| **`yarn lint` do storefront** | O `eslint-config-next` está com install quebrado nesta máquina | Não é regressão deste change set; o `next.config.js` já ignora ESLint no build. Consertar o install é tarefa separada |

---


## 17.10 Troubleshooting rápido

| Sintoma | Causa provável | O que conferir |
| :--- | :--- | :--- |
| `EADDRINUSE :::9000` no log do backend | Watcher deixou processo antigo na porta | `make recreate SERVICE=backend` |
| E-mail não sai e o log diz HTTP 422 | Template não publicado, alias errado ou variável faltando | *Resend → Templates*; aliases exatos; variáveis como `string` |
| HTTP 403 | Domínio não verificado ou `RESEND_FROM` fora dele | *Resend → Domains*; usar o domínio verificado |
| HTTP 429 | Teto diário do plano gratuito | Esperar o dia ou subir de plano |
| `O Resend não respondeu em 10s.` | Rede/instabilidade | Repetir o fato; o pedido não foi afetado |
| `LINK` vazio no e-mail | `STOREFRONT_URL` ausente ou vazia | `.env` da raiz; recriar backend |
| Página de confirmação em "aguardando" | `INTERNAL_API_SECRET` ausente/diferente | Mesmo valor nos dois serviços; recriar os dois |
| Checkout em "não há entrega" | Todos os serviços desligados em `/painel/frete/servicos` | Religue pelo menos um |
| Checkout em "não conseguimos calcular" | `SUPERFRETE_TOKEN` inválido ou SuperFrete fora | Token, saldo e log do backend |
| Meio manual ainda aparece | Build antigo do storefront ou filtro removido | `lib/data/payment.ts` e `lib/payments/providers.ts`; refazer o build |
| Sessão manual antiga conclui o pedido | `payment-button` não está ignorando `pp_system_default` | Ver o filtro no botão; é bloqueador |
| Nenhum e-mail, mas o log mostra o conteúdo | Provider `local` no lugar do Resend | `RESEND_API_KEY` **e** `RESEND_FROM`; recriar backend |
| `make build` no host morre com `ERR_REQUIRE_ESM` | `medusa build` + contrato ESM | Use o build Docker ou `TS_NODE_IGNORE` (§17.2.1) |

---

## 17.11 Onde está cada coisa

| Assunto | Dono |
| :--- | :--- |
| Por que cada correção é assim | [`15-arquitetura-modular.md`](15-arquitetura-modular.md) §15.10 |
| Passo a passo do Resend, variáveis e textos de partida | [`backend/src/modules/notification/README.md`](../../backend/src/modules/notification/README.md) |
| Checklist de produção | [`README.md`](../../README.md) §"Antes de ir para produção" |
| Estados da entrega (teste puro) | `frontend/src/lib/checkout/__tests__/delivery-availability.unit.spec.ts` |
| Filtro de pagamento (teste puro) | `frontend/src/lib/payments/__tests__/providers.unit.spec.ts` |
| Corpo da chamada ao Resend, erros e timeout | `backend/src/modules/notification/__tests__/resend.unit.spec.ts` |
| Variáveis do e-mail e escape de HTML | `backend/src/modules/notification/__tests__/pedido.unit.spec.ts` |

