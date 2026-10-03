# 10 — Roadmap

Ordem de implementação, tradução da estratégia da marca para o produto digital e resumo executivo.

---

## 10.1 Ordem recomendada de implementação

Baseada na **arquitetura real encontrada** no projeto — não numa sequência genérica.

```
 1. RV-003  Idioma pt-BR ────────────── CRÍTICA · sem dependência
 2. RV-017  Tokens de design ───────── MÉDIA · antes dos componentes novos
 3. RV-001  Camada de pagamento ────── CRÍTICA · o registry
 4. RV-002  Adapter Mercado Pago ───── CRÍTICA · consome o registry
 4b. RV-048  Remoção do Stripe ─────── MÉDIA · só depois que o MP funciona
 5. RV-014  Guarda de fronteira ────── ALTA · protege o que foi construído
 6. RV-042  Captura e reserva ───────── CRÍTICA · consome RV-002
 7. RV-043  Painel de envio ────────── ALTA · sem dependência
 8. RV-044  Página de rastreio ─────── ALTA · consome RV-043
 9. RV-006  Camada de frete ────────── ALTA · contrato pronto, adapter depois
10. RV-004  Filtros ────────────────── ALTA · consome RV-003
11. RV-005  Busca ──────────────────── ALTA · consome RV-003
12. RV-007  SEO ────────────────────── ALTA · consome RV-003
13. RV-009  Guia de medidas ────────── ALTA · decisão de modelagem
14. RV-008  Parcelamento/Pix ───────── ALTA · consome RV-002
15. RV-016  Badge e tamanhos ───────── MÉDIA · consome RV-017
16. RV-018  Documentação ───────────── MÉDIA · sem dependência
```

### Por que nesta ordem

**1 — Idioma antes de tudo (RV-003).** É CRÍTICA, **não tem dependência nenhuma** e é o item de
menor custo da lista toda (complexidade baixa, nenhuma arquitetura nova). Fazê-lo primeiro significa
que **todo texto novo** já nasce em português — inclusive os rótulos que o registry de pagamento vai
consumir. Se o registry viesse primeiro, os rótulos nasceriam em inglês e seriam traduzidos depois.

**2 — Tokens antes dos componentes novos (RV-017).** Fechar as três lacunas do design system (cores
de estado, escala de texto, `reduced-motion`) **antes** de escrever filtros, busca, badges e modal Pix
significa que nenhum deles precisa de retrabalho para consumir cor literal ou tamanho solto. Depois,
vira dívida.

**3 — Registry de pagamento (RV-001).** Precisa vir antes do MP. É a Fase 0.

**4 — Mercado Pago (RV-002).** Consome o registry. É o item mais complexo do backlog — por isso
precisa começar cedo, mesmo sendo o quarto. **O Stripe foi eliminado do escopo**: não aceita
parcelamento da forma necessária, e o código de tokenização dele não serve para o MP (que é
redirecionamento). Não há stop-gap — ver `10.3`.

**4b — Remoção do Stripe (RV-048).** Vem **logo depois** do MP, e não antes: apagar os arquivos
criaria uma janela sem nenhum caminho de pagamento. A configuração já saiu
(`NEXT_PUBLIC_STRIPE_KEY` não é mais fornecida, o que faz o `PaymentWrapper` cair no ramo não-Stripe —
comportamento idêntico ao de hoje, já que nenhum provider estava registrado), mas os arquivos ficam até
o MP estar valendo.

**5 — Guarda de fronteira (RV-014).** Logo depois do registry, **não** depois de tudo. É a verificação
que impede a abstração de se dissolver com o tempo. Se entrar tarde, um developer pode já ter escrito
o primeiro adapter do jeito errado.

**6–8 — Pedido, envio e rastreio (RV-042, RV-043, RV-044).** Vêm logo após o MP porque **sem eles a
loja recebe dinheiro e não entrega pedido**: o pagamento aprovado precisa virar pedido com estoque
reservado (RV-042), e a cliente precisa poder acompanhar o envio (RV-043 e RV-044).

**Nenhum dos três depende da transportadora.** A transportadora responde *"onde está o pedido?"*, não
*"o pedido existe?"* — pagamento, reserva e acompanhamento são anteriores e posteriores ao frete. O
RV-043 é literalmente um campo, e sem ele a rota de rastreio que **já existe e funciona** devolve
sempre vazio. Detalhe em `10.2`.

**9 — Camada de frete (RV-006).** Define o contrato; o adapter real vem quando a transportadora for
escolhida (RV-046, bloqueado).

**10–12 — Filtros, busca e SEO (RV-004, RV-005, RV-007).** Os três dependem do idioma e são
independentes entre si — podem ser paralelos com equipes diferentes.

**13 — Guia de medidas (RV-009).** Depende de uma decisão de modelagem que precisa ser tomada antes.

**14–16 — Parcelamento, badge e documentação.** Fecham o conjunto.

### O que pode correr em paralelo

| Trilho | Itens | Restrição |
| :--- | :--- | :--- |
| **A — Fundação** | RV-001 → RV-002 → RV-008 | Sequencial. É o caminho crítico. |
| **B — Vitrine** | RV-003 → RV-004 → RV-005 | Paralelizável após RV-003 |
| **C — Design** | RV-017 → RV-016 | Independente |
| **D — Qualidade** | RV-007, RV-018, RV-006, RV-014 | Independentes |
| **E — Envio** | RV-043 → RV-044 | **Não espera transportadora** |

**Com dois developers:** trilha A em um, trilha B no outro, com RV-003 como primeira tarefa
compartilhada. **Com um developer:** a ordem da lista acima.

---

## 10.2 Marcos de entrega

| Marco | Itens | Resultado |
| :--- | :--- | :--- |
| **M0 — Fundação** | RV-003, RV-017, RV-001, RV-014 | Loja em pt-BR, com payment registry e separação de camadas |
| **M1 — Venda real** | RV-002, RV-042 | **Mercado Pago com Pix, parcelamento e boleto**, com pedido e estoque reservado |
| **M2 — Envio e rastreio** | RV-043, RV-044 | Painel de envio + página pública de rastreio — **não espera transportadora** |
| **M3 — Descoberta** | RV-004, RV-005, RV-007 | Filtros, busca e SEO técnico |
| **M4 — Vitrine completa** | RV-009, RV-008, RV-016, RV-018, RV-006 | Entregável da inauguração |

**M1 é o marco que transforma a loja de “demonstração” em “negócio”.** M2 é o que evita
chargeback: a cliente paga, recebe o pedido e consegue acompanhar a entrega.

---

## 10.3 Dependências externas (bloqueiam o cronograma)

| Questão | Bloqueia | Prazo |
| :--- | :--- | :--- |
| **Modalidade do Mercado Pago** | RV-002, RV-008 | **Imediato** |
| **Credenciais do MP** (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_APP_ID`) | Teste da integração | Antes de M1 |
| **URL pública com HTTPS** para o webhook (`MP_NOTIFICATION_URL`) | Webhook em produção | Antes da inauguração |

**Configuração de ambiente já preparada** (sem código de aplicação): as 5 chaves `MP_*` estão no
`.env.example`, declaradas no `docker-compose.yml` **sem valor padrão**, e `NEXT_PUBLIC_STRIPE_KEY` foi
removida do Compose e do modelo. **Falta apenas preencher os valores.** Detalhe em
`08-arquitetura-e-integracoes.md`, seção 8.4.1.1.

> **Nenhuma dessas três coisas trava o desenvolvimento do código.** O provider é escrito contra o
> ambiente de teste do MP; credencial e URL definitiva chegam antes da inauguração, não antes do
> código. A `MP_NOTIFICATION_URL` vazia em dev aponta para túnel — a variante é o que exige decisão de
> infraestrutura.
| Provedor de frete | RV-046 (não bloqueia a inauguração) | Fase 4 |
| Modelo da tabela de medidas | RV-009 | Antes de M3 |
| Logo vetorial | RV-021 | Não bloqueia |
| Tamanho real do catálogo | Afeta paginação e cache | Antes de M3 |
| Serviço de e-mail transacional | **Confirmar se já existe** | Antes da inauguração |
| Configuração fiscal | Emissão de NF | Antes de M1 |

**A única verdadeiramente urgente é a modalidade do MP** — ela define o que o `describe()` retorna e,
portanto, o que a vitrine exibe.

### 10.3.1 O que **não** bloqueia a inauguração

Registrado porque é uma dúvida legítima no planejamento: **o provedor de frete ainda não foi decidido,
e isso não segura a loja.**

| Requisito | Depende da transportadora? | Por quê |
| :--- | :--- | :--- |
| RV-042 Captura e reserva | **Não** | O pagamento aprovado cria o pedido — o frete é só um dos dados dele |
| RV-043 Painel de envio | **Não** | Registra `carrier` + código em **texto livre**, sem lista de transportadoras |
| RV-044 Página de rastreio | **Não** | Consome a rota que já existe; o link vem do campo que o admin preencheu |
| RV-045 Notificação de envio | **Não** | Dispara quando o admin salva o código |
| RV-006 Contrato de frete | **Não** | É a fronteira — não o adapter |
| **RV-046 Adapter de transportadora** | **Sim — bloqueado** | Precisa de contrato e credenciais |

**A regra de desenho que garante isso:** os campos de rastreio são **texto livre**. Se forem modelados
para a transportadora de hoje, a decisão de amanhã obriga a refatorar o painel — e aí sim o bloqueio
volta.

**A salvaguarda prática:** o `fulfillment-manual` está seedado com PAC e SEDEX (`seed.ts:247-259`),
então a loja vende com frete fixo enquanto a transportadora não é decidida. **RV-046 sai do caminho
crítico e vai para a Fase 4.**

---

## 10.4 Tradução da Estratégia da Marca para o Produto Digital

### Princípio da marca

> **A mulher já possui valor. A Real Valor ajuda sua imagem a expressá-lo.**

A consequência de design mais importante: **a peça não é a origem do valor** — ela é a ferramenta de
expressão. Isso tem implicações concretas na interface.

### Como o posicionamento aparece na interface

**1. O preço é coadjuvante, não o protagonista.**
`product-preview` já empilha título → preço → convite, e o comentário registra que o preço era cinza e
perdia. Coerente com a marca: a peça tem nome antes de ter número.

**2. O caos é removido, não adicionado.**
A referência tem menu de 20+ itens, urgência repetitiva e bug de desconto. A Real Valor **recusa** os
três. Menu enxuto, urgência só quando é verdade (reusando `product-availability`), desconto só com
valor real (RV-011, regra 2).

**3. A página de produto responde "como esta peça entra na minha vida".**
O briefing pede isso explicitamente. Não é frase motivacional — é **dado estruturado**: caimento,
tecido, ocasião, com quem combina. `metadata` do produto + o `editorial-banner` do CMS.

**4. O tom é afirmativo, não motivacional.**
O título atual do metadata é *"A alfaiataria que valoriza você, não o seu status"* — que **nega** uma
atribuição comum em moda feminina (status) em vez de prometer um sentimento. Esse é o registro
certo: **autoridade por subtração**.

**5. A fronteira final é experiência, não estética.**

| Conflito | Decisão |
| :--- | :--- |
| Real Valor × referência | Identidade da Real Valor |
| Real Valor × tendência | Identidade |
| Real Valor × cliente | Necessidade dela |
| Usabilidade × estética | Usabilidade |
| Consistência × referência | Consistência |

### Como o público-alvo influencia a UX

O briefing não traz o Brand Brief completo (público-alvo, dores, seldomas). **Não inventamos
características** — o que segue é derivado do que o código e a marca mostram:

| Inferência verificável | Consequência de UX |
| :--- | :--- |
| Posicionamento em **preços honestos** (title da home) e "do PP ao GG" (description) | Filtros de **tamanho e preço são essenciais**, não opcionais |
| Título da home **nega o status** | Nenhum badge de urgência genérica ou linguagem de pertencimento |
| Alfaiataria (não "moda") | Estrutura e caimento importam → guia de medidas é **essencial** |
| Catálogo amplo (15+ categorias na referência) | Busca e filtros são **obrigatórios**, não diferenciais |
| Checkout é o ponto de maior risco | Idioma pt-BR é **CRÍTICA**, não cosmética |

**Incerteza registrada:** o material de identidade citado no `brand.css` (`Downloads/identidade_realvalor`)
e o Brand Brief do briefing **não estavam disponíveis** para esta auditoria. Quando forem fornecidos,
esta seção deve ser revisada — o documento não supre o briefing.

### Decisões visuais coerentes com a marca

Já presentes no código e **devem ser mantidas:**
- **Raios pequenos** (2–16px) — alfaiataria é estruturada, não fofinha
- **Sombras mínimas** — elegância por cor e espaço, não por elevação
- **Movimento contido** (máx. 640ms) — "o olho acompanha a troca; não para ser vista"
- **Rosa queimado** em vez de rosa-choque — sofisticação sem feminilidade decorativa
- **Playfair Display** nos títulos — serifa com autoridade, não com romance
- **Off White** de fundo — espaço, não densidade

### Decisões a evitar (do briefing)

Excesso de rosa · elementos delicados demais · estética romântica · luxo artificial · serifa só para
"saber sofisticado" · excesso de animação · excesso de banner · linguagem motivacional genérica ·
elementos que reforcem estereótipos femininos.

**Como isso se traduz em regra prática:** a Real Valor se apresenta como **autoridade + inteligência +
autenticidade + personalidade + liberdade**. Uma interface que parece "loja de roupas femininas" já
falhou, mesmo com as cores certas.

### Oportunidades de diferenciação

1. **A camada de pagamento modular é vantagem competitivo.** Trocar de provedor (ou adicionar Pix,
   depois boleto, depois Apple Pay) é trabalho de um dia. Um concorrente com `if (provedor)` leva
   semanas.
2. **O CMS de conteúdo é raro.** O lojista editar hero, seções e **paleta** sem deploy é diferencial
   real para uma marca em crescimento.
3. **Conteúdo por ocasião, não só por categoria.** O briefing sugere; o `featured` com chips já dá a
   base. Navegar por "para a reunião" comunica a marca melhor do que "blusa".
4. **Filtro com contagem honesta** — faceta com zero desabilitada, nunca oculta. É a diferença entre
   um catálogo que informa e um que esconde.

---

## 10.5 Resumo executivo

### Estado atual da loja

**Fundação sólida, venda impossibilitada.** Monorepo Medusa v2 + Next.js 15 com arquitetura acima da
média: contrato compartilhado por 3 runtimes, CMS funcional que edita a vitrine sem deploy, design
system derivado da marca (1125 linhas), 310 testes em 3 runners com CI, e operação 100% em Docker com
build offline. Home, header, footer, carrinho, conta, tema sazonal e pedido confirmado estão **prontos**.

**O bloqueio:** `medusa-config.ts` não registra nenhum provedor de pagamento, e a região usa
`pp_system_default` (manual). O checkout tem 20 componentes prontos e **não transaciona**.

**Três lacunas graves:** interface em inglês ("Add to cart", "Sort by"), catálogo sem filtros e sem
busca, e metadados de SEO vazando "Medusa Store" com a descrição da PDP repetindo o título.

### Principais gaps

1. **Pagamento** — nenhum provider (CRÍTICA)
2. **Idioma** — pt-BR ausente no checkout, catálogo e conta (CRÍTICA)
3. **Descoberta** — zero filtros, zero busca (ALTA)
4. **SEO** — sem sitemap, robots ou dados estruturados; títulos com a marca do template (ALTA)
5. **Modularidade** — registro de pagamento acoplado ao Stripe; frete manual sem abstração (ALTA)
6. **Pedido e envio** — nenhum pedido é criado após o pagamento; ninguém grava o rastreio; a rota de
   rastreio existe mas **não tem tela** (CRÍTICA/ALTA)
6. **Documentação** — `docs/` vazio com o README apontando para 6 arquivos inexistentes (MÉDIA)

### Funcionalidades necessárias para venda

1. Provedor de pagamento registrado no Medusa
2. **Mercado Pago** com Pix, cartão parcelado e boleto, e webhook verificado
3. Interface 100% em português
4. Carrinho e checkout funcionando ponta a ponta — **já prontos**, só precisam do pagamento
5. Frete com opção válida — já funciona com `manual`

### Principais mudanças de UI/UX

- Filtros por cor, tamanho, preço e disponibilidade, com contagem e chips removíveis
- Busca no header com sugestões, e página de resultado reaproveitando o catálogo
- Tradução integral da interface, incluindo metadados
- Guia de medidas ao lado do seletor de tamanho
- Parcelamento e Pix visíveis no card e no checkout
- Badge de desconto real (sem o "0% OFF" da referência) e chips de tamanho
- Tokens de estado e escala de texto, fechando as lacunas do design system

### Principais riscos técnicos

| Risco | Mitigação |
| :--- | :--- |
| **Webhook do MP inacessível** — compra paga que não confirma | Testar a URL pública **antes** de lançar |
| **Webhook duplicado** cria pedido duplo | Idempotência por `preference_id` |
| **Abstração se dissolve** — o `switch` volta com o tempo | `check-boundaries.mjs` estendido (RV-014) |
| **Imagens grandes sem CDN** — LCP ruim | Exigir redimensionamento; S3 na Fase 3 |
| **Sem e-mail transacional** (inferido) | Verificar antes da inauguração |
| **Segredo não regenerado** em produção | Checklist de pré-lançamento |
| **`NEXT_PUBLIC_*` inlinadas** em PROD | `make build && make restart` |

### Backlog priorizado

**46 itens** em 4 fases: 4 CRÍTICA, 11 ALTA, 13 MÉDIA, 17 BAIXA. **Um item cancelado** (RV-015,
stop-gap do Stripe — ver o backlog).

### Ordem recomendada de implementação

1. **RV-003** Idioma pt-BR — CRÍTICA, sem dependência, custo baixo
2. **RV-017** Tokens de design — antes dos componentes novos
3. **RV-001** Registry de pagamento — a fundação da abstração
4. **RV-002** Mercado Pago — item mais complexo, precisa começar cedo
5. **RV-014** Guarda de fronteira — protege o registry
6. **RV-042** Captura e reserva → 7. **RV-043** Painel de envio → 8. **RV-044** Página de rastreio
9. **RV-006** Camada de frete
10. **RV-004** Filtros → 11. **RV-005** Busca → 12. **RV-007** SEO
13. **RV-009** Guia de medidas → 14. **RV-008** Parcelamento → 15. **RV-016** Badge → 16. **RV-018** Docs

**Marcos:** M0 Fundação · M1 Venda real (MP) · M2 Envio e rastreio · M3 Descoberta ·
M4 Vitrine completa (inauguração).

### Situação hoje

| Marco | Itens | Estado |
| :--- | :--- | :--- |
| **M0 — Fundação** | RV-003, RV-017, RV-001, RV-014 | ✅ **completo** |
| **M1 — Venda real** | RV-002, RV-042 | ⬜ próximo — trava em credencial e URL do webhook |
| **M2 — Envio e rastreio** | RV-043, RV-044 | ⬜ não depende do MP |
| **M3 — Descoberta** | RV-004, RV-005, RV-007 | ⬜ independe do MP |
| **M4 — Vitrine completa** | RV-009, RV-008, RV-016, RV-018, RV-006 | ⬜ RV-008 depende do MP |

**M0 fechado é o que importa aqui:** o registry existe, a guarda que o protege roda em CI, e o
Mercado Pago entra como *mais um adapter*. Nenhuma linha de `modules/checkout/` vai precisar ser
tocada para isso.

**Sem stop-gap de Stripe:** o Stripe foi removido do escopo — não atende o parcelamento necessário e
seu código de tokenização não serve para o MP, que é redirecionamento.

### Critérios para considerar a loja pronta para produção

**Venda**
- [ ] Compra completa do clique ao pedido confirmado, com pagamento real
- [ ] Pix, cartão parcelado e boleto funcionando em modo produção
- [ ] Webhook verificado, com assinatura e idempotência testados
- [ ] Reenvio de webhook **não** cria pedido duplicado
- [ ] Frete calculado para CEP real, com valor e prazo

**Pedido e envio**
- [ ] Pagamento aprovado gera **um** pedido, com estoque reservado
- [ ] Pagamento recusado **não** cria pedido e libera o estoque
- [ ] Admin registra transportadora e código de rastreio
- [ ] A rota de track devolve o código gravado (hoje devolve `null`)
- [ ] Página pública de rastreio funciona **sem login**
- [ ] CPF/e-mail incorreto é bloqueado com mensagem clara, sem vazar dados

**Interface**
- [ ] Nenhum texto em inglês em nenhuma rota
- [ ] Nenhum título de página contém "Medusa"
- [ ] Jornada completa em 320px, sem scroll horizontal
- [ ] Botão de compra com alvo ≥ 44px no mobile

**Descoberta**
- [ ] Filtros funcionam com a URL compartilhável
- [ ] Busca retorna resultados e trata o caso sem resultado

**Operação**
- [ ] `docker compose -f docker-compose.yml up -d` sobe do zero
- [ ] HTTPS válido em todas as rotas
- [ ] Segredos regenerados; CORS restrito ao domínio
- [ ] **Backup do Postgres configurado e testado com restauração**
- [ ] `make test` e `make check` verdes na branch de release
- [ ] E-mail de confirmação chegando

**Conteúdo**
- [ ] Catálogo cadastrado com títulos, descrições, imagens e opções de tamanho e cor
- [ ] Hero, seções e rodapé editáveis pelo CMS sem deploy

---

## 10.6 Nota final sobre esta documentação

Este conjunto foi produzido a partir da **leitura do código**, não de suposições. Onde não foi possível
verificar, a dúvida está registrada em vez de preenchida.

**Incertezas que permanecem abertas** (detalhe em `01-auditoria-projeto.md`, seção 1.7):
1. Se `/store/custom/checkout-info` e `/store/orders/track` são consumidos
2. Quantidade de imagens por produto no catálogo real
3. Se existe provider de e-mail transacional configurado
4. Configuração fiscal para emissão de nota
5. Conteúdo válido dos 4 temas além do `default`
6. Estrutura definitiva da tabela de medidas

**Atualização 1 — escopo de pagamento.** Revisado após a primeira emissão: o **Stripe foi removido**
(não atende o parcelamento e seu código de tokenização não serve para o MP, que é redirecionamento), e
entraram os requisitos **RV-042 a RV-046** (captura e reserva, painel de envio, página de rastreio,
notificação e adapter de transportadora). **O provedor de frete segue indefinido**, e isso não bloqueia
a inauguração: quatro dos cinco requisitos novos são independentes dele (ver 10.3.1).

**Atualização 2 — configuração de ambiente (executada).** Preparado o ambiente para o Mercado Pago:
as 5 chaves `MP_*` no `.env.example`, declaradas no `docker-compose.yml` **sem valor padrão**, e
`NEXT_PUBLIC_STRIPE_KEY` removida do Compose e do modelo.

**Atualização 3 — especificação do MP completada.** Acrescentado ao RV-002: a modalidade **Checkout Pro**
como decisão, a propriedade **`FulfillmentMode`** (`redirect` | `inline` | `external`) que abre a porta
para a Checkout API sem refatoração, o **ponto de desacoplamento** (`shouldInputCard`, em
`payment/index.tsx:80`), o **algoritmo de assinatura** do webhook e o **desenho da idempotência** (chave,
onde persiste e quando grava). Novo item **RV-048** para a remoção do código Stripe.

**O que ainda NÃO foi feito — e é o bulk do trabalho:**

| Etapa | Estado |
| :--- | :--- |
| Idioma pt-BR (RV-003) | ✅ **FEITO** (`316be39e46`) |
| Tokens do design system (RV-017) | ✅ **FEITO** (`325dafa850`) |
| Registry de pagamento (RV-001) | ✅ **FEITO** (`73ed719544`) |
| Guarda de fronteira do pagamento (RV-014) | ✅ **FEITO** (`73ed719544`) |
| Provider do MP, Preference API e webhook (RV-002) | **Não iniciado** |
| Captura do pagamento e reserva (RV-042) | **Não iniciado** |
| Remoção do código Stripe (RV-048) | **Não iniciado — depois do MP** |
| `medusa-config.ts` lendo `MP_ACCESS_TOKEN` | **Não iniciado** |
| Validação das `MP_*` no `scripts/doctor.sh` | **Não iniciado** |

**Ambiente local:** as três armadilhas encontradas ao validar o RV-001 estão em
[`11-ambiente-local.md`](11-ambiente-local.md). A mais cara foi um `yarn install` que reportava
sucesso sem instalar `next` nem `vitest` — e o `doctor.sh` agora avisa.

O código do frontend ainda importa `@stripe/*` e ainda lê `NEXT_PUBLIC_STRIPE_KEY`, que agora não é
mais fornecida — isso é **intencional e temporário**: a remoção só deve acontecer junto com o adapter do
MP, porque o frontend precisa de um caminho de pagamento funcionando em cada etapa.

> **Estado do repositório:** só configuração e documentação foram alteradas. Nenhum arquivo de código de
> aplicação foi modificado.

**O Brand Brief citado no briefing não estava disponível.** A seção 10.4 derivou o que pôde do código
e da marca já presente, e sinalizou explicitamente essa lacuna — em vez de inventar público-alvo.

**Documentos relacionados:** `01` auditoria · `02` referência · `03` gaps · `04` requisitos · `05`
não funcionais · `06` design system · `07` fluxos · `08` arquitetura · `09` backlog.