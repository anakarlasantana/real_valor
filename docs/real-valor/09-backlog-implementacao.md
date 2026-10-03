# 09 — Backlog de Implementação

**Formato por item:** ID · título · descrição · tipo · prioridade · dependências · arquivos
impactados · critérios de aceite · complexidade · pré-requisitos.

**Prioridade:** CRÍTICA · ALTA · MÉDIA · BAIXA · **Complexidade:** baixa · média · alta

---

## Fase 0 — Fundação modular

Pré-requisito de tudo. Curta, e cria a estrutura que os itens seguintes consomem.

### ✅ RV-001 · Camada de abstração de pagamento — **FEITO**

**O que foi feito:** contrato `packages/contrato/src/payment.ts` (`FulfillmentMode`, `PaymentResult`,
`PaymentCapabilities`, `InstallmentInfo`, `MANUAL_PROVIDER_ID`); `lib/payments/{types,registry,labels}.ts`;
adapters `manual`, `unsupported` e `stripe`; checkout sem nenhum import de adapter. A UI do cartão
(`card-container`) e o botão (`payment-button`) foram MOVIDOS para dentro de `adapters/stripe/` — são
UI de provedor, não do checkout.

**Descrição original:** criar `PaymentAdapter`/`PaymentResult` no contrato compartilhado, o registry no
storefront, e migrar o Stripe atual para dentro de um adapter — sem mudar a aparência.
**Tipo:** arquitetura · **Prioridade:** CRÍTICA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos (como ficaram):**
- *novos:* `packages/contrato/src/payment.ts`, `frontend/src/lib/payments/{types,registry,labels,index}.ts`,
  `adapters/{manual,unsupported}.ts`, `adapters/stripe/{index,card-container,payment-button}`
- *alterados:* `lib/constants.tsx` (perdeu o registro), `payment/index.tsx`, `payment-button/index.tsx`,
  `payment-container/index.tsx`, `payment-wrapper/index.tsx`, `order/payment-details/index.tsx`,
  `vitest.config.ts`
- *removido:* `payment-wrapper/stripe-wrapper.tsx`
**Aceite:** os 8 critérios da RV-001; `grep -r "adapters/" modules/checkout` vazio
**Pré-requisito:** nenhum

### RV-006 · Camada de abstração de frete
**Descrição:** `ShippingAdapter` + `ShippingOption` no contrato, registry, e o adapter `manual`
implementando-o.
**Tipo:** arquitetura · **Prioridade:** ALTA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos:** *novos:* `packages/contrato/src/shipping.ts`, `frontend/src/lib/shipping/`
**Aceite:** os 5 critérios da RV-006
**Pré-requisito:** nenhum

### RV-048 · Remoção do código Stripe
**Descrição:** apagar o que sobrou do Stripe no frontend, depois que o MP estiver funcionando.
**Tipo:** refatoração · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** **RV-002** (só depois que o MP estiver valendo)
**Arquivos a remover:**
- `frontend/src/modules/checkout/components/payment-wrapper/index.tsx`
- `frontend/src/modules/checkout/components/payment-wrapper/stripe-wrapper.tsx`
- `@stripe/react-stripe-js`, `@stripe/stripe-js` (do `frontend/package.json`)

**Arquivos a alterar:**
- `payment-container/index.tsx` — remover `StripeCardContainer`, manter o wrapper
- `payment-button/index.tsx` — já reescrito pelo RV-002
- `lib/constants.tsx` — remover `isStripeLike`, `isPaypal`; `paymentInfoMap` passa a ser do MP
- `order/payment-details/index.tsx` — remover o `card_last4` (não existe no MP)

**Aceite:**
1. `grep -ri stripe frontend/src` não retorna nada.
2. `frontend/package.json` sem `@stripe/*`.
3. `npm run build` e `make test` verdes.
4. Nenhuma referência a `NEXT_PUBLIC_STRIPE_KEY` (já removida do ambiente).

> **Regra de ordem — não remover antes do RV-002.** A configuração já saiu (`NEXT_PUBLIC_STRIPE_KEY` não
> é mais fornecida, o que faz o `stripePromise` ser `null` e o `PaymentWrapper` cair no ramo
> não-Stripe — o mesmo comportamento de hoje, já que nenhum provider estava registrado). Mas apagar os
> arquivos **criaria uma janela sem nenhum caminho de pagamento**. A remoção vem junto com o adapter do
> MP, para que cada etapa tenha um pagamento funcionando.

---

### ✅ RV-014 · Guarda de fronteira do pagamento — **FEITO**

**O que foi feito:** `scripts/check-boundaries.mjs` ganhou uma segunda verificação — `modules/checkout/`
não importa `@lib/payments/adapters` nem `@stripe/*`. Testada nos dois sentidos: passa no código atual
e **reprova** quando se injeta um import proibido.

**Descrição original:** estender `scripts/check-boundaries.mjs` para reprovar `modules/checkout/` que importe
`lib/payments/adapters/` diretamente.
**Tipo:** arquitetura · **Prioridade:** ALTA · **Complexidade:** baixa
**Depende de:** RV-001
**Arquivos:** *alterado:* `scripts/check-boundaries.mjs`
**Aceite:** um import de teste reprova; o hook de commit chama a guarda
**Pré-requisito:** RV-001

### ~~RV-015 · Stop-gap de pagamento~~ — CANCELADO

> **Cancelado durante o planejamento.** Este item previa registrar o Stripe como venda temporária
> enquanto o Mercado Pago não existisse. **Não será feito**, por três motivos verificados:
>
> 1. **O Stripe não atende o parcelamento** da forma necessária para o mercado brasileiro.
> 2. **Seu código não serve para o MP.** A integração do Stripe é *tokenização de cartão*
>    (`CardElement`, `useStripe`), e o MP é *redirecionamento* (`preference` → `init_point`). Não há
>    sobreposição — configurar o Stripe não antecipa nada do MP.
> 3. **O custo não é "poucas linhas".** `@medusajs/payment-stripe` não está declarado no
>    `backend/package.json` (está no `node_modules` só por hoist transitivo), faltaria
>    `STRIPE_SECRET_KEY`, migration e teste de compra real — meio dia de trabalho por um resultado
>    que só paga Pix.
>
> **Consequência:** a loja não terá rede de segurança entre o RV-001 e o RV-002. Se o Mercado Pago
> estourar o prazo, **não há venda** — decisão consciente, registrada em `03-gap-analysis.md`,
> seção 3.3.
>
> **Remanescentes do Stripe que ficam para o RV-002:** `NEXT_PUBLIC_STRIPE_KEY` já foi removida do
> `.env.example`, do `docker-compose.yml` e do `.env`. O **código do frontend segue intacto** por
> decisão — removê-lo agora criaria uma janela sem nenhum caminho de pagamento. A remoção completa
> (7 arquivos + `@stripe/react-stripe-js` + `@stripe/stripe-js`) acontece **junto com o adapter do
> MP**, para que cada etapa tenha um pagamento funcionando.

---

## Fase 1 — Essencial para a inauguração

### ✅ RV-003 · Interface 100% pt-BR — **FEITO** (`316be39e46`)

**O escopo real foi maior que o registrado:** a tabela do requisito previa 19 itens; o levantamento
sistemático achou **35 arquivos e 127 strings**. As labels de formulário (15 em endereço e
cobrança), os textos de conta (17), os metadados (17) e a ordenação não estavam na tabela.

**Mensagens ficaram acionáveis, não literais:** "Enter a valid email address" → **"Informe um
e-mail válido"** (o original só diz que falhou); "Welcome back" → **"Bem-vinda de volta"** (com "a",
coerente com o tom da marca).

**Ficou para o RV-007 (SEO), que é outro requisito:** os títulos de produto, categoria e coleção
ainda vazam " | Medusa Store" — é vazamento de marca do template, não de idioma, e misturar os dois
tornaria a revisão mais difícil.

**Descrição original:** substituir todos os textos em inglês verificados na RV-003.
**Tipo:** UI · **Prioridade:** CRÍTICA · **Complexidade:** baixa
**Depende de:** nenhuma — **pode começar hoje**
**Arquivos:** 8 páginas + 5 componentes (tabela da RV-003)
**Aceite:** os 5 critérios da RV-003
**Pré-requisito:** nenhum

### ⛔ RV-002 · Adapter Mercado Pago — **NÃO INICIADO, bloqueado por credencial**

> **Estado verificado em 10/02/2026:** este item **está inteiro por fazer**. Três verificações
> independentes confirmam:
>
> | Verificação | Resultado |
> | :--- | :--- |
> | `backend/medusa-config.ts` registra módulo de pagamento? | **Não** — só `file` e `content` |
> | `lib/payments/registry.ts` tem o adapter do MP? | **Não** — só `stripe`, `manual`, `unsupported` |
> | Backend tem dependência do Mercado Pago? | **Não** |
>
> **Por que ainda não foi feito (ver `10-roadmap.md`, seção 10.7):** o código pode ser escrito sem
> chave, mas **não dá para validar** a Preference real, o redirect, o retorno, o webhook chegando, e
> **a assinatura contra um caso verdadeiro** — que é exatamente o que quebra. Escrever sem conseguir
> rodar produz uma falsa sensação de pronto, e em pagamento o custo de descobrir isso tarde é o mais
> alto do projeto.
>
> **O que destrava, e depende de você (não do código):**
> 1. Abertura/aprovação da conta de produção no Mercado Pago — o caminho crítico real.
> 2. `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`.
> 3. URL pública com HTTPS para o webhook — o Compose não expõe proxy TLS.
>
> **O que já está pronto para receber o MP:** o registry (RV-001) existe, a guarda de fronteira
> (RV-014) roda em CI, e as chaves `MP_*` já estão no `.env.example` e no Compose **sem valor
> padrão** (fail-closed). O adapter entra sem tocar em `modules/checkout/`.
>
> **Sequência ao retomar:** RV-002 → RV-042 (captura e reserva), que é o que transforma pagamento
> aprovado em pedido com estoque reservado.

**Descrição original:** provider do MP no backend com Pix, cartão parcelado e boleto; webhook com assinatura e
idempotência; adapter no frontend.
**Tipo:** integração · **Prioridade:** CRÍTICA · **Complexidade:** alta
**Depende de:** RV-001
**Arquivos:** ver 8.2
**Aceite:** os 7 critérios da RV-002
**Pré-requisito:** credenciais do MP; **modalidade decidida**; URL pública do webhook

### RV-004 · Filtros de catálogo
**Descrição:** facetas de cor, tamanho, preço e disponibilidade com contagem, na query string, com
drawer no mobile.
**Tipo:** funcional + UX · **Prioridade:** ALTA · **Complexidade:** média
**Depende de:** RV-003 (rótulos)
**Arquivos:** ver 8.2
**Aceite:** os 8 critérios da RV-004
**Pré-requisito:** catálogo com opções de tamanho e cor cadastradas

### RV-005 · Busca de produtos
**Descrição:** campo no header com sugestões, e página de resultado reaproveitando `PaginatedProducts`.
**Tipo:** funcional + UX · **Prioridade:** ALTA · **Complexidade:** média
**Depende de:** RV-003
**Arquivos:** ver 8.2
**Aceite:** os 8 critérios da RV-005
**Pré-requisito:** títulos de produto bem cadastrados (a qualidade da busca depende disso)

### RV-007 · Metadados de SEO
**Descrição:** remover "Medusa Store" dos títulos, escrever descrições reais, criar sitemap, robots e
JSON-LD.
**Tipo:** funcional · **Prioridade:** ALTA · **Complexidade:** baixa
**Depende de:** RV-003 (as descrições são em pt-BR)
**Arquivos:** ver 8.2
**Aceite:** os 8 critérios da RV-007
**Pré-requisito:** nenhum

### RV-008 · Parcelamento e Pix na vitrine
**Descrição:** linha de parcelamento no card e no resumo, alimentada pelo adapter.
**Tipo:** funcional · **Prioridade:** ALTA · **Complexidade:** média
**Depende de:** RV-001, RV-002
**Arquivos:** *alterados:* `product-preview/price.tsx`; *novos:*
`payment/components/installment-info.tsx`
**Aceite:** os 4 critérios da RV-008
**Pré-requisito:** RV-002

### RV-009 · Guia de medidas
**Descrição:** tabela em `metadata` do produto, link ao lado do seletor, página de guia geral.
**Tipo:** funcional · **Prioridade:** ALTA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos:** ver 8.2
**Aceite:** os 4 critérios da RV-009
**Pré-requisito:** **decisão de modelagem** (metadata × módulo)

### RV-016 · Badge de desconto e tamanhos no card
**Descrição:** badge de % real e chips de tamanho informativos.
**Tipo:** UI · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterados:* `product-preview/index.tsx`; *novos:* `discount-badge.tsx`, `size-chips.tsx`
**Aceite:** os 3 critérios da RV-011
**Pré-requisito:** `get-percentage-diff` já existe

### ✅ RV-017 · Tokens de estado, escala tipográfica e `reduced-motion` — **FEITO** (`325dafa850`)

**2 das 3 lacunas fechadas; a terceira estava errada na auditoria.**

Fechadas: **9 tokens** de escala tipográfica e **8** de cores de estado. A escala é a **mesma** dos
utilitários que já eram usados (trocar o token pelo utilitário não move um pixel) — o que muda é ter
nome: `--rv-text-2xl` diz "título de seção"; `text-2xl` não diz nada.

`--rv-info` **reaproveita o cacau** em vez de introduzir azul: um azul quebraria a paleta terrosa e
cairia no clichê de interface corporativa que a marca evita.

**Contraste medido (WCAG 2.1):** danger 6.10, info 9.72, success 5.12, warning 4.80 — todos acima
de AA para texto normal. O verde e o âmbar começaram mais claros e foram **escurecidos** até passar
(`#4a7c59` dava 4.33 e `#a8752a` dava 3.57). Escurecer é melhor do que documentar a limitação.

**Correção:** o `prefers-reduced-motion` foi escrito na auditoria como lacuna, e **não era** — o
`brand.css` já tinha o bloco (linha 1130), e ele é **melhor** do que a proposta que eu faria: tem
tratamento próprio para o ticker, porque o piso global pararia o trilho no fim do curso com a última
mensagem fora da tela. Deixado como estava.

**Descrição original:** fechar as três lacunas do design system (cores de estado, escala tipográfica,
`prefers-reduced-motion`).
**Tipo:** UI · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterado:* `frontend/src/styles/brand.css`
**Aceite:** nenhum componente novo usa cor literal ou tamanho solto
**Pré-requisito:** nenhum
**Nota:** fazer **antes** dos componentes da Fase 1, não depois — evita retrabalho.

### RV-018 · Documentação e correção do README
**Descrição:** manter `docs/real-valor/` e corrigir a tabela de documentação do README, que aponta para
6 arquivos removidos.
**Tipo:** documentação · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterados:* `README.md` (linhas 283–291)
**Aceite:** nenhum link quebrado na tabela de documentação
**Pré-requisito:** nenhum

### RV-042 · Captura do pagamento e reserva de estoque
**Descrição:** quando o MP aprovar, criar o pedido no Medusa e reservar o estoque. `rejected`/
`cancelled` liberam. Idempotente por `payment_id`.
**Tipo:** funcional + backend · **Prioridade:** CRÍTICA · **Complexidade:** média
**Depende de:** RV-002
**Arquivos:** *novos:* `backend/src/workflows/create-order-from-payment/`,
`backend/src/subscribers/mercadopago-payment-updated.ts`
**Aceite:** os 5 critérios da RV-042
**Pré-requisito:** RV-002
**Nota:** `backend/src/workflows/` **não existe** — é código novo, não adaptação.

### ✅ RV-043 · Painel de envio (registro de rastreio) — **CONCLUÍDO (10/02/2026)**

**Descrição:** campo no Admin para gravar `carrier`, `tracking_number`, `tracking_url` e
`status_label` em `order.metadata`. **Campos em texto livre, sem lista de transportadoras.**
**Tipo:** funcional + CMS · **Prioridade:** ALTA · **Complexidade:** baixa
**Depende de:** nenhuma · **Independe da transportadora: SIM**
**Arquivos:** *novo:* extensão no `admin/` ou campo no Admin do Medusa
**Aceite:** os 5 critérios da RV-043
**Nota:** a rota de track **já existe e funciona**; falta quem escreve. Sem este item, a cliente
consulta e vê `null`.

**Entregue:**
- `backend/src/modules/shipping/tracking.ts` — a regra pura (normalizar, deduzir link, validar).
  A validação mora aqui e não na rota, porque é a parte testável sem I/O.
- `backend/src/api/admin/shipping/route.ts` — a fila de envio, do mais antigo para o mais novo.
- `backend/src/api/admin/shipping/[id]/route.ts` — grava o registro.
- `admin/src/admin/routes/shipping/` — a tela (fila, formulário) + `envio-form.ts`.
- **23 testes** no backend e **13** no CRM.

**Três decisões que valem lembrar:**
1. **`metadata` é MESCLADO, nunca substituído.** Ele também guarda o CPF e o e-mail que a rota de
   rastreio usa para validar a identidade; regravar o objeto inteiro faria **toda** consulta de
   cliente virar 403. Há teste para isso.
2. **Ausente ≠ vazio.** Ausente é "não mexe" e vazio é "limpa" — é o que permite corrigir a
   transportadora sem redigitar o código.
3. **Link só é deduzido quando o lojista não digita** e o formato casa com um padrão conhecido
   (Correios, Jadlog, Totvs). Formato desconhecido devolve `null`: um link errado leva a cliente a
   uma página de erro em outro domínio. O campo continua texto livre, então o RV-046 (adapter de
   transportadora) entra sem retrabalho.

**Defeito encontrado pelos testes:** o rótulo da fila comparava só o prefixo `entreg`, e classificava
"Saiu para entrega" e "Em rota de entrega" como **entregues** — a tela affirmaria à loja que a
cliente já recebeu o pedido. Corrigido para a palavra inteira, com teste de regressão.

### ✅ RV-044 · Página pública de rastreio — **CONCLUÍDO (10/02/2026)**

**Descrição:** tela `/rastreio` consumindo `GET /store/orders/track`, sem login, com linha do tempo e
link no rodapé.
**Tipo:** funcional + UI · **Prioridade:** ALTA · **Complexidade:** baixa
**Depende de:** RV-043 · **Independe da transportadora: SIM**
**Arquivos:** *novos:* `app/[countryCode]/(main)/rastreio/page.tsx`,
`modules/order/components/track-{form,timeline}.tsx`
**Aceite:** os 5 critérios da RV-044
**Nota:** a rota já valida identidade com **403** — a tela deve respeitar esse contrato.

**Entregue:**
- `frontend/src/app/[countryCode]/(main)/rastreio/page.tsx` — rota **pt-BR** (`/rastreio`, como
  `/carrinho` e `/conta`), não `/track` como a API.
- `frontend/src/modules/tracking/templates/index.tsx` — o formulário e os quatro estados.
- `frontend/src/lib/data/tracking.ts` — traduz a resposta HTTP em situação de tela. `no-store`.
- **12 testes** no storefront.

**Três decisões que valem lembrar:**
1. **A página não busca nada no servidor.** É um server component que só entrega o formulário; a
   consulta acontece quando a cliente aperta o botão. Se a busca fosse no servidor, o **CPF iria
   para os `searchParams`**, para o log do servidor e para o histórico do navegador.
2. **`cache: "no-store"` é a garantia central da rota.** É a única função do storefront sem cache:
   todas as outras respostas são públicas, esta tem o CPF da cliente dentro. Com qualquer cache, uma
   consulta poderia ser servida para outra pessoa. Há teste conferindo o `no-store`.
3. **"Não encontrado" e "recusado" são mensagens diferentes.** A 403 **existe** e não muda o status
   no Medusa — a cliente digitou errado, e a tela precisa dizer o que conferir, não sugerir que
   algo quebrou. "Pendente" também é um estado de primeira classe: pedido pago, envio ainda não
   registrado.

**Acessibilidade:** o resultado está em `aria-live="polite"` — sem ele, quem usa leitor de tela
pressiona o botão e não recebe nenhuma confirmação de que a página respondeu. Os três campos têm
`<label>` ligado por `htmlFor`, e o botão desabilita durante a consulta para impedir envio duplo.

### RV-045 · Notificação de envio à cliente
**Descrição:** e-mail com o código quando o admin salva o rastreio pela primeira vez.
**Tipo:** funcional · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** RV-043 · **Independe da transportadora: SIM**
**Arquivos:** *novos:* subscriber de notificação de envio
**Aceite:** os 3 critérios da RV-045
**Pré-requisito:** **provider de e-mail transacional** (ver 8.4.4 — não auditado)

### RV-046 · Adapter de transportadora
**Descrição:** substituir o `manual` por cálculo real de frete. **BLOQUEADO** — provedor não definido.
**Tipo:** integração · **Prioridade:** BAIXA · **Complexidade:** média
**Depende de:** **decisão comercial**
**Arquivos:** *novos:* `backend/src/modules/shipping/<transportadora>/`
**Aceite:** os 3 critérios da RV-046
**Nota:** o contrato (`packages/contrato/src/shipping.ts`) já está definido no RV-006 — plugar é
escrever o adapter, não redesenhar. **Não entra no caminho crítico da inauguração.**

---

## Fase 2 — Refinamento visual e UX

### RV-010 · Calculadora de frete na PDP
**Descrição:** campo de CEP com cálculo de custo e prazo na página de produto.
**Tipo:** funcional · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** RV-006
**Arquivos:** *novo:* `products/components/shipping-calculator.tsx`
**Aceite:** os 3 critérios da RV-010 · **Pré-requisito:** RV-006

### RV-013 · Ordenação e rótulos do catálogo
**Descrição:** adicionar "Mais vendidos" e "Maior desconto"; rótulos pt-BR; seletor compacto no mobile.
**Tipo:** UX · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** RV-003
**Arquivos:** *alterados:* `sort-products/index.tsx`, `lib/data/products.ts`
**Aceite:** os 4 critérios da RV-013 · **Pré-requisito:** nenhum

### RV-019 · Acessibilidade — foco e rótulos
**Descrição:** auditar foco visível, `aria-label` em botões de ícone, `alt` nas imagens, `aria-live` no
carrinho, `aria-expanded` nos accordions.
**Tipo:** UI · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** RV-004, RV-005 (os controles novos entram já corretos)
**Arquivos:** transversal
**Aceite:** axe-core sem violações críticas; contraste do botão primário verificado

### RV-020 · Exceções de carrinho
**Descrição:** limitar quantidade pelo estoque no `cart-item-select`; tratar sessão expirada com
retorno; revalidar e avisar alteração de preço.
**Tipo:** funcional · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos:** *alterados:* `cart/components/cart-item-select/`, `lib/data/cart.ts`
**Aceite:** os cenários 7, 9 e 10 de `07-fluxos-de-usuario.md`

### RV-012 · Newsletter
**Descrição:** novo tipo de seção no contrato, com consentimento LGPD.
**Tipo:** funcional + CMS · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** RV-003
**Arquivos:** *novos:* campo no contrato + tipo de seção; *alterados:* `page.tsx` (registro), `footer`
**Aceite:** os 4 critérios da RV-012
**Pré-requisito:** **escolha do serviço de e-mail (comercial)**

### RV-021 · Logo vetorial
**Descrição:** substituir o wordmark em texto pelo logo oficial, quando disponível.
**Tipo:** UI · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterados:* `layout/templates/nav/index.tsx:48-60`
**Aceite:** logo renderizado em SVG, com `alt` e Favicon atualizado
**Pré-requisito:** **logo vetorial definitivo (marca)**

### RV-022 · Ordenação dos relacionados
**Descrição:** ajustar o critério de produtos relacionados para complementaridade.
**Tipo:** funcional · **Prioridade:** BAIXA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterados:* `products/components/related-products/`
**Aceite:** relacionados da mesma categoria aparecem primeiro

---

## Fase 3 — Performance, SEO e acessibilidade

### RV-023 · Armazenamento S3 + CDN
**Descrição:** trocar `@medusajs/file-local` por `@medusajs/file-s3`.
**Tipo:** infraestrutura · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos:** *alterados:* `backend/medusa-config.ts`, `docker-compose.yml`, `.env.example`
**Aceite:** imagens servidas por CDN; **nenhum conteúdo migrado** (só o provider)
**Pré-requisito:** bucket criado; credenciais

### RV-024 · Validação de upload
**Descrição:** validar tipo e tamanho no upload de imagem do CMS.
**Tipo:** segurança · **Prioridade:** MÉDIA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *alterados:* `admin/…/image-input.tsx`, rota de upload do backend
**Aceite:** arquivo acima do limite ou de tipo não permitido é rejeitado

### RV-025 · Rate limiting
**Descrição:** limitar requisições em rotas sensíveis (login, busca, webhook).
**Tipo:** segurança · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** nenhuma
**Arquivos:** *novos:* middleware no backend
**Aceite:** requisições acima do limite respondem 429

### RV-026 · Analytics e funil
**Descrição:** registrar `@medusajs/analytics` e medir conversão, abandono por etapa e busca sem
resultado.
**Tipo:** funcional · **Prioridade:** MÉDIA · **Complexidade:** média
**Depende de:** RV-005
**Arquivos:** *alterados:* `backend/medusa-config.ts`, storefront
**Aceite:** eventos de funil visíveis

### RV-027 · Auditoria de acessibilidade completa
**Descrição:** revisão por teclado de toda a jornada, em iOS e desktop.
**Tipo:** UI · **Prioridade:** BAIXA · **Complexidade:** média
**Depende de:** RV-019
**Arquivos:** transversal
**Aceite:** jornada completa operável por teclado

### RV-028 · Teste E2E da compra
**Descrição:** teste automatizado do fluxo do clique ao pedido confirmado.
**Tipo:** qualidade · **Prioridade:** BAIXA · **Complexidade:** média
**Depende de:** RV-002
**Arquivos:** *novos:* suíte E2E
**Aceite:** fluxo verde em CI

### RV-029 · Recuperação dos documentos removidos
**Descrição:** avaliar recuperar `docs/DEBITO-TECNICO.md` e `docs/plano-centralizacao.md` do histórico
Git, se o conteúdo ainda for válido.
**Tipo:** documentação · **Prioridade:** BAIXA · **Complexidade:** baixa
**Depende de:** nenhuma
**Arquivos:** *novos:* sob `docs/`
**Aceite:** README referencia apenas arquivos existentes

---

## Fase 4 — Melhorias futuras

| ID | Título | Tipo | Complexidade |
| :--- | :--- | :--- | :--- |
| RV-030 | Lista de desejos (wishlist) | funcional | alta |
| RV-031 | Produtos vistos recentemente | funcional | baixa |
| RV-032 | Comparação de peças | funcional | alta |
| RV-033 | Integração com WhatsApp | integração | baixa |
| RV-034 | Programa de fidelidade / cupom por indicação | funcional | alta |
| RV-035 | Índice de busca dedicado (Algolia/Typesense) | infraestrutura | média |
| RV-036 | Multi-idioma (en-US) | funcional | alta |
| RV-037 | Troca de senha do cliente | funcional | média |
| RV-038 | Checkout em etapas com indicador de progresso | UX | média |
| RV-039 | Provedor adicional de pagamento (Stripe, PagSeguro) | integração | média |
| RV-041 | Painel de pedidos com métricas | CMS | alta |
| RV-047 | Integração com gateway de frete na API (opção B) | integração | média |

> **Sobre o frete na Fase 4:** o plug-in da transportadora é o **RV-046** (Fase 1, BAIXA, bloqueado por
> decisão comercial). O **RV-047** aqui é a *opção B* — consultar a API da transportadora para atualizar
> o status automaticamente, que só faz sentido com volume que justifique. A rota de rastreio **já aceita
> a opção A** (link), que é a recomendação para a inauguração.

---

## 9.10 Resumo quantitativo

| Fase | Itens | CRÍTICA | ALTA | MÉDIA | BAIXA | **Feitos** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Fase 0 | 4 | 1 | 3 | 0 | 0 | **2** (RV-001, RV-014) |
| Fase 1 | 15 | 3 | 9 | 3 | 0 | **2** (RV-003, RV-017) |
| Fase 2 | 7 | 0 | 0 | 5 | 2 | 0 |
| Fase 3 | 7 | 0 | 0 | 4 | 3 | 0 |
| Fase 4 | 12 | 0 | 0 | 0 | 12 | 0 |
| **Total** | **46** | **4** | **11** | **13** | **17** | **4** |

> **Um item cancelado:** o RV-015 (stop-gap com Stripe) saiu do backlog — ver a seção dele. Total
> efetivo: **44 itens**.

**Complexidade da Fase 0 + Fase 1 (entregável da inauguração):** 19 itens, sendo 4 de complexidade
alta. É o escopo mínimo para abrir a loja vendendo, **com pagamento, reserva de estoque, envio e
rastreio funcionando** — sem depender da escolha da transportadora.

### Bloco de pedido e envio — impacto no escopo

| Requisito | Prioridade | Depende da transportadora |
| :--- | :--- | :--- |
| RV-042 Captura e reserva | CRÍTICA | Não |
| RV-043 Painel de envio | ALTA | Não |
| RV-044 Página de rastreio | ALTA | Não |
| RV-045 Notificação de envio | MÉDIA | Não |
| RV-046 Adapter de transportadora | BAIXA | **Sim — bloqueado** |

**Quatro dos cinco independem da transportadora** e entram no caminho crítico. Só o RV-046 espera a
decisão comercial — e o `fulfillment-manual` seedado mantém a loja vendável até lá.

Ver `10-roadmap.md` para a ordem de execução.