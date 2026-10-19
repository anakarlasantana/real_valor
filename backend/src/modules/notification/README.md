# E-mail transacional — o módulo de notificação

O que faz a frase **"Enviamos todos os detalhes para o seu e-mail"** — escrita na
página de pedido confirmado — ser verdadeira.

O texto dos e-mails **não mora neste repositório**. Ele mora em templates do
[Resend](https://resend.com), editáveis no painel, e o backend manda só o alias
do template e as variáveis. Trocar uma frase é uma edição no painel, não um
deploy.

---

## Por que o Resend

| Requisito | Resend (plano gratuito) |
| :--- | :--- |
| Custo | **R$ 0** — 3.000 e-mails/mês, 100/dia |
| Domínios | 3, com DKIM/SPF |
| Editor de template no painel | **Sim**, com variáveis e histórico de versão |
| Templates por API | Sim, com `template: { id, variables }` |
| Retenção de log | 30 dias |

O ponto decisivo é o **editor no painel**. A alternativa (React Email no código)
exigiria um deploy para cada ajuste de texto — e a loja pediu o contrário.

⚠️ **O plano gratuito tem teto de 100 e-mails por dia.** Para uma loja pequena é
folgado; se o teto for atingido, o envio falha com HTTP 429 e o pedido **não**
falha junto (ver "Quando o e-mail não sai").

---

## O que é enviado

| Template (alias) | Quando | Evento | Chave de idempotência |
| :--- | :--- | :--- | :--- |
| `pedido-confirmado` | O pedido nasce (pagamento aprovado) | `order.placed` | `order-placed:<order_id>` |
| `pedido-enviado` | A etiqueta é emitida ou o rastreio muda | `superfrete.entrega` e o painel de envio | `order-shipped:<order_id>:<código>:<situação>` |
| `pedido-cancelado` | O pedido é cancelado | `order.canceled` ou o webhook do SuperFrete | `order-canceled:<order_id>` |

Os dois caminhos do cancelamento usam a **mesma** chave: um cancelamento que
dispara os dois eventos gera **um** e-mail.

O e-mail de pedido confirmado sai em `order.placed`, e **não** em
`order.payment_captured`: no fluxo do Mercado Pago o pedido só nasce quando o
pagamento é aprovado, então ouvir os dois mandaria dois e-mails para a mesma
compra.

---

## Passo a passo (uma vez por ambiente)

1. **Crie a conta** em [resend.com](https://resend.com) e confirme o e-mail.
2. **Verifique o domínio** em *Domains → Add Domain*. O Resend mostra os
   registros de DNS (DKIM, SPF e, opcionalmente, DMARC). Sem o domínio
   verificado, o único remetente aceito é `onboarding@resend.dev`, e ele só
   entrega para o e-mail da própria conta — não serve para a loja.
3. **Crie a API key** em *API Keys → Create API Key*, com permissão de
   **Sending access**. Ela começa com `re_`.
4. **Preencha o `.env` da raiz** (e recrie o backend para ele ler):

   ```dotenv
   RESEND_API_KEY=re_...
   RESEND_FROM="Real Valor <nao-responda@seudominio.com.br>"
   STOREFRONT_URL=https://seudominio.com.br
   ```

   `STOREFRONT_URL` é a URL **pública**. Não use `FRONTEND_URL`: ele é o
   endereço interno da rede do Compose (`http://frontend:8000`) e não abre no
   navegador de ninguém.

5. **Crie e PUBLIQUE os três templates** em *Templates → Create Template*, com
   os aliases exatos da tabela acima. **Rascunho não envia** — o Resend recusa
   com erro de validação. O alias é o campo *Alias* (não o UUID): ele é estável
   entre contas, e é o que o código usa.
6. **Rode as migrations** (`make migrate`, da raiz). O módulo de notificação
   tem tabela própria (`notification`); sem ela o primeiro pedido falha ao
   gravar a notificação. Em DEV o `RUN_MIGRATIONS` é `0` por padrão — as
   migrations são um passo explícito.

Sem os dois primeiros itens (chave e remetente), o provider do Resend **não é
registrado** e o provider `local` registra o e-mail no log. A loja continua
funcionando; só não sai e-mail. Se apenas **uma** das duas variáveis estiver
definida, o boot avisa e trata como desligado.

⚠️ **O provider `local` escreve as variáveis no log** (nome, itens, total) —
ele existe para desenvolvimento e auditoria. Em produção, configure o Resend:
além de o e-mail chegar, os dados da cliente deixam de ir para o log do
container.

---

## As variáveis de cada template

No editor, digite `{{` e escolha **Variable**. O valor inserido aparece como
`{{{NOME}}}` (chaves triplas = sem escape de HTML).

**Defina todas as variáveis como `string`.** O backend manda texto já formatado
(`R$ 349,90`, `até 5 dias úteis`) e um `ITENS` que é HTML; uma variável declarada
como `number` recusaria o valor formatado.

### `pedido-confirmado`

| Variável | Conteúdo | Exemplo |
| :--- | :--- | :--- |
| `NOME` | primeiro nome do endereço de entrega | `Ana` |
| `PEDIDO` | número que a cliente reconhece (`display_id`) | `1042` |
| `ITENS` | **HTML** pronto: `<ul>` com quantidade, título, variante e preço | `<ul>…</ul>` |
| `TOTAL` | total do pedido em reais | `R$ 349,90` |
| `ENTREGA` | nome da modalidade escolhida | `PAC` |
| `LINK` | URL da página de pedido confirmado | `https://…/br/order/order_…/confirmed` |

### `pedido-enviado`

| Variável | Conteúdo | Exemplo |
| :--- | :--- | :--- |
| `NOME` | primeiro nome | `Ana` |
| `PEDIDO` | número do pedido | `1042` |
| `SITUACAO` | rótulo do rastreio | `Postada` |
| `TRANSPORTADORA` | transportadora | `Correios` |
| `RASTREIO` | código de rastreio (**pode vir vazio**) | `BR123456789BR` |
| `LINK_RASTREIO` | URL de rastreio (**pode vir vazia**) | `https://rastreamento…` |
| `LINK` | URL do pedido na loja | `https://…/br/order/…/confirmed` |

### `pedido-cancelado`

| Variável | Conteúdo | Exemplo |
| :--- | :--- | :--- |
| `NOME` | primeiro nome | `Ana` |
| `PEDIDO` | número do pedido | `1042` |
| `LINK` | URL do pedido na loja | `https://…/br/order/…/confirmed` |

**Sempre mandamos todas as variáveis**, com `""` quando o dado não existe. O
Resend recusa o envio se uma variável do template não chegar e não tiver valor
padrão. No editor, dê um *fallback* às que podem vir vazias (por exemplo,
`RASTREIO` → "Consulte a transportadora") ou escreva a frase de um jeito que
funcione sem elas.

`ITENS` é HTML montado pelo backend (`modules/notification/pedido.ts`), e todo
texto vindo do catálogo é escapado. No editor, insira-o como variável normal; o
Resend não escapa chaves triplas.

---

## Um texto de partida

O painel é o dono do texto; isto é só um ponto de partida. Assunto e corpo são
do template — o código não os envia.

**`pedido-confirmado`** — assunto: `Recebemos o seu pedido {{{PEDIDO}}}`

```html
<p>Olá, {{{NOME}}}.</p>
<p>Obrigada por escolher a Real Valor. Recebemos o seu pedido
<strong>#{{{PEDIDO}}}</strong> e já estamos preparando tudo com cuidado.</p>
{{{ITENS}}}
<p><strong>Total:</strong> {{{TOTAL}}}<br />
<strong>Entrega:</strong> {{{ENTREGA}}}</p>
<p><a href="{{{LINK}}}">Acompanhar o meu pedido</a></p>
<p>Se precisar falar com a gente, é só responder este e-mail.</p>
```

**`pedido-enviado`** — assunto: `O seu pedido {{{PEDIDO}}} saiu`

```html
<p>Olá, {{{NOME}}}.</p>
<p>O seu pedido <strong>#{{{PEDIDO}}}</strong> saiu: {{{SITUACAO}}}.</p>
<p><strong>Transportadora:</strong> {{{TRANSPORTADORA}}}<br />
<strong>Rastreio:</strong> {{{RASTREIO}}}</p>
<p><a href="{{{LINK_RASTREIO}}}">Acompanhar a entrega</a></p>
<p><a href="{{{LINK}}}">Ver o pedido na loja</a></p>
```

**`pedido-cancelado`** — assunto: `O seu pedido {{{PEDIDO}}} foi cancelado`

```html
<p>Olá, {{{NOME}}}.</p>
<p>O seu pedido <strong>#{{{PEDIDO}}}</strong> foi cancelado.</p>
<p>Se você não pediu o cancelamento, ou se ficou com alguma dúvida, responda
este e-mail — a gente resolve.</p>
<p><a href="{{{LINK}}}">Ver o pedido na loja</a></p>
```


---

## Quando o e-mail não sai

**O pedido nunca falha por causa do e-mail.** O envio é um subscriber (ou uma
chamada em `avisar`), e o erro é registrado e engolido. O que acontece:

| Situação | O que se vê |
| :--- | :--- |
| Sem `RESEND_API_KEY`/`RESEND_FROM` | `local` registra o e-mail no log; nada é enviado |
| Template não publicado ou alias errado | `[email] "…" para a***@… não saiu: O Resend recusou … (HTTP 422)` |
| Domínio não verificado | HTTP 403 com a mensagem do Resend no log |
| Teto diário (100/dia no gratuito) | HTTP 429, com o motivo no log |
| Resend fora do ar / timeout (10s) | `O Resend não respondeu em 10s.` |

O módulo grava uma linha em `notification` com `status: failure` e o
`idempotency_key`. Um fato que **já saiu** não é reenviado; se a tentativa
anterior falhou, a mesma chave pode ser tentada de novo (o módulo trata
`failure` como pendente). Um fato novo (código de rastreio novo, por exemplo)
tem chave nova.

Para conferir os últimos envios: *Resend Dashboard → Emails*. O `external_id`
da notificação é o id do e-mail lá.

---

## Onde está o código

| Arquivo | O que é |
| :--- | :--- |
| `medusa-config.ts` | registra o módulo e escolhe os providers (condicional) |
| `resend/service.ts` | o provider: `POST /emails` com `template` + `variables` |
| `enviar.ts` | o ponto único de envio; mascara o e-mail no log |
| `pedido.ts` | as variáveis (nome, itens, total, links) — testado sem I/O |
| `templates.ts` | os três aliases |
| `src/subscribers/order-confirmation.ts` | `order.placed` |
| `src/subscribers/order-canceled.ts` | `order.canceled` |
| `src/modules/shipping/tracking.ts` → `avisar` | envio e cancelamento pelo SuperFrete/painel |

Testes: `__tests__/resend.unit.spec.ts` (o corpo da chamada, os erros e o
timeout) e `__tests__/pedido.unit.spec.ts` (as variáveis e o escape de HTML).

```bash
cd backend && yarn test:unit
```
