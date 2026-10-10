# 13 — Mapa dos botões da home

Este documento responde a uma pergunta só: **cada botão da home leva aonde — e onde esse destino é
configurado?**

Ele existe porque "para que tela este botão aponta?" tem **três** respostas possíveis neste projeto
(o banco do CRM, o padrão do contrato, ou o componente), e porque o sintoma que o motivou — **nove
botões apontando para `/store`** — não aparece em nenhum aviso: a home não quebra, ela só promete
destinos que não existem.

Levantado contra a loja **rodando**: `GET :9000/store/content` (o payload do CRM) e `GET :8000/br`
(o HTML servido). Os comandos estão em 13.11 — o mapa envelhece junto do conteúdo; o que **não**
envelhece é a coluna "campo no CRM", que é estrutura.

Fora do escopo: botões de página de produto, busca, carrinho, checkout e conta (ficam para os lotes
de tradução/desenho daquela superfície).

---

## 13.1 A cadeia: como um botão nasce

```
content_section (Postgres)               surface / type / enabled / position + data
   ↓  GET /store/content?surface=home    backend/src/api/store/content/route.ts
@rv/contrato                             packages/contrato/src/contract.ts
   ↓  seção tipada                       frontend/src/lib/content/home-sections.ts
componente                               frontend/src/modules/home/components/*
   ↓  href
nav-link                                 frontend/src/modules/layout/components/nav-link/index.tsx
```

O destino é **texto** — e a loja decide o que fazer com ele pela **forma** da string
(`nav-link/index.tsx`), não por uma lista de rotas:

| O texto se parece com | A loja faz | Onde |
| :--- | :--- | :--- |
| `#hero`, `/#collections` | rola até a seção de `id="hero"` / `id="collections"` na home | `HOME_ANCHOR`, l.48 e l.51 |
| `/store`, `/rastreio` | rota interna, com o país prefixado (`/br/store`) | `LocalizedClientLink`, l.199 |
| `https://…`, `mailto:`, `tel:` | abre fora da loja (é o caso do `mailto:` de Contatos) | `EXTERNAL_PROTOCOL`, l.45 e l.182 |

⚠️ Um erro de digitação **não avisa ninguém**: `validateData` (backend) não toca em `href`, e o campo
no CRM é texto livre — sem sugestão de rota, sem lista, sem validação. Um `/stroe` vai ao ar como um
link quebrado. O `type` da seção, esse sim, é validado: tipo desconhecido → 400 na API, e a loja
descarta o que não conhece em vez de derrubar a home (`frontend/src/lib/data/supported-sections.ts`).

## 13.2 Onde se muda cada botão — três lugares, não um

| Lugar | O que ele governa | Quando vale |
| :--- | :--- | :--- |
| **CRM / banco** (`content_section`) | o que está **no ar** agora | imediato, **sem deploy** |
| `packages/contrato/src/defaults.ts` | base nova (`make seed`), botão "Restaurar padrão" e o fallback quando a API falha | base zerada ou apagada |
| **Componente** (`.tsx`) | wordmark, newsletter, crédito do rodapé, título de coleção, sacola vazia, Instagram sem âncora | só com deploy |

⚠️ Por isso **mudar `ctaHref` em `defaults.ts` não muda a home no ar**: as linhas do banco já têm o
valor antigo. Quem reponta a home viva é o CRM (ou o "Restaurar padrão", que reintroduz o padrão e
apaga a edição).

## 13.3 Cabeçalho — o chrome de todas as rotas

Uma seção do CMS (`nav`) desenha o cabeçalho inteiro. Ela é **fixa** (casa 2) e alimenta também a
gaveta do mobile — não há conteúdo duplicado.

| Elemento | Rótulo | Ícone | Destino no ar | Campo no CRM | Arquivo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Wordmark | REAL VALOR | — | `/` | ❌ **hardcoded** | `nav/index.tsx:57` |
| Menu | Início | — | `/#hero` (âncora) | `nav.links[0]` | `nav/index.tsx:75` |
| Menu | Coleções | — | `/#collections` (âncora) | `nav.links[1]` | idem |
| Menu | Produtos | — | **`/store`** | `nav.links[2]` | idem |
| Menu | **Sobre** | — | `/#editorial` — **âncora na home, não é página** | `nav.links[3]` | idem |
| Menu | Contatos | — | `mailto:contato@realvalor.com.br` | `nav.links[4]` | idem |
| Ação | Sacola | `bag` | `/cart` | `nav.actions[0]` | `nav/index.tsx:97` |
| Ação | Conta | `account` | `/account` | `nav.actions[1]` | idem |
| Ação | Buscar | `search` | `/search` | `nav.actions[2]` | idem |
| Mobile | "Menu" | — | abre a gaveta; repete os 5 links + 3 ações + idioma/país | herda de `nav` | `side-menu/index.tsx:64, 112, 128, 142` |

O CRM oferece **quatro ícones que ninguém usa**: `whatsapp`, `mail`, `phone`, `pin`
(`HEADER_ACTION_ICON_KEYS`). São exatamente os que uma loja usaria para "Fale conosco" — e é o
lembrete de que hoje esse caminho é um `mailto:` porque **não há página de contato** (13.8).

## 13.4 Home, casa por casa

> ⚠️ **Retrato de antes.** A tabela foi levantada em 2026-10-09, antes de a F1/F2 do doc 14 entrar. Uma
> linha mudou: a casa **10** — o rodapé tinha **uma** coluna ("Ajuda", com o rastreio) e hoje traz as duas
> colunas da referência, **"Institucional" e "Atendimento"**, com os links das páginas declaradas
> (14.16 do doc 14). Ver a nota no fim desta seção.

Ordem do `position` no payload — a mesma ordem do render. "Fixo" é a casa que o CRM não deixa
reordenar (`FIXED_SECTION_POSITIONS`).

| Casa | Seção (nome no CRM) | Botão | Rótulo no ar | Destino no ar | Campo no CRM | Arquivo:linha |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Barra de anúncio | — | (só o ticker rola) | sem link | `text`, `messages`, `speedSeconds` | `announcement-bar` |
| 2 | Cabeçalho | — | ver 13.3 | ver 13.3 | `nav.links`, `nav.actions` | `nav/index.tsx` |
| 3 | Hero | CTA do slide | Conheça a coleção | **`/store`** | `slides[].ctaLabel` + `slides[].ctaHref` | `hero/index.tsx:213` |
| 3 | Hero | pontos | 1 … N | troca o slide (só com 2+) | — | `hero/carousel.tsx` |
| 4 | Faixa de benefícios | 3 itens | Frete grátis · 5% no Pix · Compra segura | **sem link nenhum** | `items[].icon` (`delivery`, `price`, `quality`) | `benefits-bar` |
| 5 | Lançamentos | "ver tudo" | Ver tudo | **`/store`** — `viewAllHref` **ou** o fallback | `viewAllLabel` + `viewAllHref` | `launches-rail/index.tsx:124` |
| 5 | Lançamentos | cards | nome + preço | `/products/<handle>` | (handle do produto) | `product-preview` |
| 5 | Lançamentos | setas e pontos | ‹ › | rola o trilho | — | `product-carousel` |
| 6 | Coleções em destaque | 3 cards | Essência · Presença · Autêntica | **`/store` ×3** | `items[].href` + `items[].ctaLabel` | `collection-highlights/index.tsx:87` |
| 7 | **Sobre** (editorial) | CTA | **Conheça a nossa história** | **`/store`** ⚠️ | `ctaLabel` + `ctaHref` | `editorial-banner/index.tsx:80` |
| 8 | Banner editorial | CTA | Descobrir a coleção | **`/store`** | `ctaLabel` + `ctaHref` | `editorial-callout/index.tsx:85` |
| 9 | Peças em destaque | chip | Todos | `/` (limpa o filtro) | desenhado pela loja | `featured-products/index.tsx:157` |
| 9 | Peças em destaque | chips | Vestidos · Blusas & Camisas · Calças & Alfaiataria · Conjuntos | `/?peca=<handle>` — **filtra a própria home** | `filters[]` (`list:category`) | `featured-products/index.tsx:170` |
| 9 | Peças em destaque | "ver tudo" | Ver todos os produtos | **`/store` — hardcoded** ⚠️ | só `viewAllLabel` | `featured-products/index.tsx:208` |
| 9 | Peças em destaque | cards | nome + preço | `/products/<handle>` | (handle do produto) | `product-preview` |
| 10 | Rodapé | coluna "Ajuda" ⚠️ *(antes de 14.16)* | Acompanhar pedido | `/rastreio` | `columns[].links` | `footer/index.tsx` |
| 10 | Rodapé | rede social | Instagram | `https://instagram.com/realvalor` | `social[]` | `social-links.tsx:96` |
| 10 | Rodapé | wordmark | REAL VALOR | `/` | ❌ hardcoded | `footer/index.tsx:105` |
| 10 | Rodapé | newsletter | "Em breve" | **desabilitado** | ❌ hardcoded | `footer/index.tsx:94` |
| 10 | Rodapé | crédito | Ana Karla Santana | `ana-karla-dev.vercel.app` | ❌ hardcoded | `footer/index.tsx:157` |
| 11 | Instagram | — | @realvalor + 4 fotos | **nenhum link** ⚠️ | — (o `@` é `<p>`) | `instagram-grid/index.tsx:20` |

Notas que a tabela não cabe:

- **Os chips filtram a home, não navegam.** `/?peca=vestidos` recarrega a home com a vitrine filtrada
  (o `?peca=` é lido pela página), então o "Ver todos os produtos" logo abaixo é o único caminho para
  o catálogo completo. Sem ele, os chips seriam uma rua sem saída — daí o par "Todos" + "ver tudo".
- **Os três cards de coleção têm título e subtítulo, mas nenhuma coleção existe no catálogo**
  (`GET /store/collections` devolve vazio). O card "Essência" aponta para `/store` porque não há
  `/collections/essencia` para onde apontar. As **quatro categorias** dos chips existem de verdade —
  é por isso que os chips funcionam e os cards não.
- **O rodapé tinha uma coluna só** (antes de 14.16). `columns` tinha exatamente
  `[{ title: "Ajuda", links: [{ /rastreio }] }]`: nem coluna institucional, nem de atendimento, nem
  política de troca — enquanto a barra de anúncio e a faixa de benefícios prometem "Frete seguro",
  "5% no Pix" e "Compra segura" no ar.
  **Hoje** o padrão traz as duas colunas da referência — "Institucional" (`/sobre`, `/trocas-e-devolucoes`,
  `/privacidade`, `/termos`) e "Atendimento" (`/contato`, `/perguntas-frequentes`, `/rastreio`, o e-mail) —,
  com uma régua que o doc 14 executou e mediu (14.16): **um link só entra no ar quando o destino responde
  200**, porque as cinco páginas de texto longo respondem 404 até a copy existir.

## 13.5 Sacola — os botões que o CMS não desenha

O dropdown da sacola é montado no cliente (só existe depois que o carrinho carrega — **não aparece no
HTML do servidor**, e por isso não entra na contagem de 13.6):

| Estado | Botão | Destino | Campo no CRM | Arquivo |
| :--- | :--- | :--- | :--- | :--- |
| Com itens | Ir para a sacola | `href` da ação da sacola → `/cart` | ✅ `nav.actions[bag].href` | `cart-dropdown/index.tsx:211` |
| Vazia | Explorar produtos | **`/store` — hardcoded** (e fecha o dropdown) | ❌ | `cart-dropdown/index.tsx:228` |

Este é o último resíduo do starter na sacola: além do `href` fixo, o componente ainda usa
`@medusajs/ui` (`Button`) e as classes `text-ui-fg-base`/`text-large-semi` no lugar das do RV. É
matéria do lote do carrinho, e está aqui só para o mapa ficar honesto: **nem todo botão da casa é
conteúdo.**

## 13.6 O que a home servida confirma

`GET :8000/br` (HTML do servidor), contagem de rotas internas:

```
   9  href="/br/store"      ← o sintoma
   2  href="/br/cart"       ← ação do cabeçalho + link da sacola
   1  href="/br/search"
   1  href="/br/rastreio"
   1  href="/br/account"
```

As **9** para `/store` são exatamente as `href` do payload do CMS (13.3 e 13.4): menu Produtos · hero
"Conheça a coleção" · "Ver tudo" dos lançamentos · 3 cards de coleção · "Conheça a nossa história" ·
"Descobrir a coleção" · "Ver todos os produtos". Nenhuma outra rota interna existe no HTML — quer
dizer que **não há nenhum botão da home apontando para uma categoria, uma coleção ou uma página
institucional.** O catálogo é o destino universal, e é por isso que a sensação é "tudo leva ao mesmo
lugar".

As âncoras (`/#hero`, `/#collections`, `/#editorial`) resolvem para `id`s que existem no HTML:
`hero`, `benefits`, `lancamentos`, `collections`, `editorial`, `banner`, `featured`, `instagram`.
Ou seja, o menu ancorado funciona — mas é o único caminho que **não** passa por uma rota nova.

## 13.7 Diagnóstico: por que quase tudo aponta para `/store`

### 13.7.1 Das nove, três fazem sentido

| Botão | Veredito |
| :--- | :--- |
| Menu "Produtos" | ✅ é o catálogo, e é isso que o rótulo promete |
| "Ver tudo" (lançamentos) | ✅ promessa de "todas as peças da vitrine" |
| "Ver todos os produtos" (destaque) | ✅ idem — **mas o destino não é editável**, e por isso não acompanha uma mudança de catálogo |

### 13.7.2 As seis restantes prometem outra coisa

| Botão | Promete | Deveria ir para |
| :--- | :--- | :--- |
| Hero "Conheça a coleção" | a coleção em cartaz | `/collections/<handle>` — ou o rótulo muda |
| "Essência" · "Presença" · "Autêntica" (×3, "Comprar agora") | **uma** coleção | `/collections/<handle>` (a coleção não existe no catálogo) |
| "Conheça a nossa história" | a história da marca | **`/sobre`** — a tela não existe ⚠️ |
| "Descobrir a coleção" (banner "REAL VALOR, REAL HISTÓRIA") | a coleção / a história | `/collections/<handle>` ou `/sobre` |

O caso do "Conheça a nossa história" é o mais visível: o bloco **é** o "Sobre" da loja (é a seção
`editorial`, e é nela que o item de menu "Sobre" ancora), o botão convida a conhecer a história — e
entrega o catálogo. Quem clica recebe uma grade de produtos.

### 13.7.3 A causa-raiz, em quatro linhas

1. **Não existe rota institucional.** As rotas sob `app/[countryCode]/(main)/` são todas de comércio
   ou conta; o único "Sobre" do site é a âncora `#editorial` da home. Sem `/sobre`, `/store` é o
   destino crível que sobra.
2. **O CRM não conhece as rotas.** Destino é texto livre, sem seletor e sem validação (13.1) — quem
   edita só pode confiar em `/store`, que existe e sempre responde.
3. **Coleções não existem no catálogo.** O dado (`/store/collections`) está vazio, então os três cards
   são promessa sem lastro. As categorias existem, e são as dos chips.
4. **Campos assimétricos.** `launches` tem `viewAllHref` (com fallback); `featured` tem só
   `viewAllLabel`; o Instagram não tem `href`; o crédito do rodapé aponta para um domínio que o CRM
   não vê. É sempre a mesma classe de defeito: **botão na tela, destino fora do alcance de quem
   edita.**

## 13.8 Telas que faltam

| Tela | O que existe hoje | Ponta de entrada já esperando |
| :--- | :--- | :--- |
| **`/sobre`** — história da marca | âncora `#editorial` na home + CTA que leva a `/store` | item "Sobre" do menu, CTA "Conheça a nossa história", banner "REAL VALOR, REAL HISTÓRIA" |
| **`/contato`** | `mailto:contato@realvalor.com.br` no menu | ícones `whatsapp` / `phone` / `pin` **já oferecidos** pelo CRM, sem uso |
| **Institucional** — trocas e devoluções, privacidade, termos | nada | o rodapé tem **uma** coluna; e há promessa no ar ("Frete seguro", "Compra segura", "5% no Pix") sem página que a sustente |
| **Índice `/collections`** | só `/collections/[handle]` existe | os 3 cards de coleção |
| **Instagram clicável** | 4 fotos + `@realvalor` **sem** `<a>` | bloco `instagram` (falta o campo `href`) |
| **Newsletter** | input + botão desabilitados ("Em breve") | rodapé — não é tela, é funcionalidade pendente |

Observação de arquitetura para quem for criar a `/sobre`: o CMS **já sabe** servir uma superfície
nova — `GET /store/content?surface=sobre` responde `{"sections":[],"schemaVersion":10}` sem erro, e o
painel monta as abas a partir de `CONTENT_SURFACES` (que é **dado**, em
`packages/contrato/src/contract.ts`, não um `if`). O custo está em declarar a superfície (rótulos,
`types`, faixa de `order`), semear o padrão e desenhar a rota na loja — não em mexer no backend.

## 13.9 Resíduos e assimetrias anotados de passagem

- `cart-dropdown` ainda usa `@medusajs/ui` e classes `text-ui-*` (13.5).
- `modules/layout/components/medusa-cta/index.tsx` é arquivo morto do starter: **zero consumidores**
  em todo o `frontend/src`.
- A faixa de benefícios tem ícones que o CRM edita (`delivery`, `price`, `quality`), mas **nenhum item
  aceita `href`** — a promessa não clica.
- O crédito do rodapé ("Ana Karla Santana") aponta para um domínio externo fixo; se for o portfólio do
  autor, está certo — se for para parecer da loja, precisa sair do componente.
- A gaveta do mobile **não é conteúdo duplicado**: ela lê o mesmo `nav` do cabeçalho, então corrigir o
  item "Sobre" conserta os dois lugares de uma vez.

## 13.10 Decisões pendentes (antes de escrever código)

1. **`/sobre`** — superfície nova no CMS (correto e maior), reaproveitar a seção `editorial` via
   `?type=editorial` (rápido, sem tocar no contrato) ou página em JSX (mais rápido ainda, e a lojista
   não edita a própria história).
2. **"Sobre" no menu** — passa a apontar para `/sobre`, ou continua sendo âncora da home?
3. **Cards de coleção** — criar as coleções no catálogo e apontar `/collections/<handle>`; apontar
   `/categories/<handle>` (que existe); ou trocar "Comprar agora" por algo que o destino sustenta?
4. **Simetria do CRM** — dar `viewAllHref` ao `featured` e `href` ao Instagram e, de fundo, oferecer no
   painel a **lista de rotas conhecidas** e validar o `href` no salvar. É esse item que impede o
   próximo `/stroe` de ir ao ar.
5. **Rodapé institucional** — colunas "Institucional" e "Atendimento" via CRM: dá para fazer **sem
   deploy**, assim que as telas existirem. ✅ **Feito** — as telas existem desde o PR1 e as colunas estão no
   padrão do rodapé desde o PR2 (14.16 do doc 14); o que falta para ligar os seis links é a **copy**.

Enquanto a decisão 1 não sai, há uma correção honesta **editável no CRM, sem deploy**: ou o rótulo do
CTA passa a descrever o que ele entrega ("Ver as peças"), ou o botão sai do ar desmarcando a seção. O
que não dá para manter é "Conheça a nossa história" abrindo o catálogo.

## 13.11 Como reproduzir esta coleta

```bash
# 1. O conteúdo que o CRM está servindo (todas as href/ctaHref/viewAllHref de uma vez)
curl -s -H "x-publishable-api-key: $PUBLISHABLE_KEY" \
  'http://localhost:9000/store/content' \
  | jq -r '.sections[] | "\(.position) \(.type)",
      (.. | objects | select(has("href"))      | "   href=\(.href)"),
      (.. | objects | select(has("ctaHref"))   | "   cta=\(.ctaLabel) -> \(.ctaHref)"),
      (.. | objects | select(has("viewAllHref"))| "   viewAll=\(.viewAllLabel) -> \(.viewAllHref)")'

# 2. O que a loja realmente serve, e para onde cada botão aponta
curl -s http://localhost:8000/br | grep -o 'href="/br/[a-z-]*"' | sort | uniq -c | sort -rn

# 3. As âncoras que o menu usa existem?
curl -s http://localhost:8000/br | grep -o 'id="\(hero\|collections\|editorial\)"'

# 4. As coleções que os cards prometem existem?
curl -s -H "x-publishable-api-key: $PUBLISHABLE_KEY" \
  http://localhost:9000/store/collections | jq '.collections | length'
```

Se o passo 2 voltar a mostrar muitas linhas iguais para a mesma rota, o problema não é a home: é o
painel, que não oferece alternativa de destino.

