<!--
  Parte 2 do registro de débito técnico (itens 2.x).
  Entrada, legenda de severidade e mapa dos assuntos: `docs/DEBITO-TECNICO.md`.
-->

# 2. 🟠 Alto

### 2.1 `/br/collections` retorna 404

**Evidência:** existe apenas a rota dinâmica de detalhe

```
frontend/src/app/[countryCode]/(main)/collections/[handle]/page.tsx
```

**Comprovado agora:**

```
$ curl -o /dev/null -w '%{http_code}' http://localhost:8000/br/collections
404
$ curl -o /dev/null -w '%{http_code}' http://localhost:8000/br
200
```

Falta o `page.tsx` de índice da pasta `collections/`. Até 2026-09-26 o cabeçalho era a
vitrine dessa 404: o link "Coleções" apontava para `/collections` (`nav/index.tsx:24`). Com o
cabeçalho no CMS (item 2.2) o destino padrão virou a âncora da home (`/#collections`), então a
rota ficou órfã — alcançável só por URL digitada, já que o rodapé e o card de produto linkam
por handle (`/collections/<handle>`).

**Ação necessária:** criar `frontend/src/app/[countryCode]/(main)/collections/page.tsx`
listando as coleções via `listCollections` (`frontend/src/lib/data/collections.ts`, já
existente e já utilizado pelo rodapé).

---

### 2.2 Links de navegação provisórios — resolvido

**Status: resolvido em 2026-09-26.** O cabeçalho deixou de ser código: os itens vêm do bloco
`nav` do CMS (`id: nav`, `surface: home`) e são editáveis no admin em **Conteúdo da vitrine**,
sem deploy. `NAV_LINKS` e `SideMenuItems` foram removidos (`grep` retorna zero ocorrências);
`nav/index.tsx` e `side-menu/index.tsx` consomem `HeaderLink[]` / `HeaderAction[]`.

Destinos padrão — espelhados no seed (`backend/src/modules/content/defaults.ts`) e no fallback
do storefront (`frontend/src/lib/content/home-sections.ts`):

| Rótulo | `href` padrão | Comportamento |
|---|---|---|
| Início | `/#hero` | rola até a seção `hero` da home |
| Coleções | `/#collections` | rola até a seção `collections` |
| Produtos | `/store` | vitrine (página real) |
| Sobre | `/#editorial` | rola até a seção `editorial` |
| Contatos | `mailto:contato@realvalor.com.br` | abre o cliente de e-mail |

O `href` **define** o comportamento — não existe campo "modo": `#id`/`/#id` rola, `/rota` é
interno, `https://` abre em nova aba e `mailto:`/`tel:` vai para o handler do sistema.

A âncora entrega de verdade: cada seção da home vira um alvo de `id` no registro de seções
(`(main)/page.tsx`, `div[id={section.id}]` + `.rv-anchor` em `brand.css` para o topo não ficar sob
o cabeçalho fixo). "Sobre" é o caso canônico — o bloco `editorial` é rotulado **Sobre** no admin
desde 2026-09-26 (ver §5).

**O que resta:** o *destino* dos itens de conteúdo. "Sobre" aponta para a seção editorial e
"Contatos" para um `mailto:` — os dois funcionam e são editáveis, mas continuam sendo desvios
enquanto as páginas institucionais do item 2.3 não existirem. A troca é edição no admin, não
deploy.

---

### 2.3 Páginas institucionais ausentes

Não existem páginas para: **Sobre**, **Contato**, **Trocas e Devoluções**, **Política de
Privacidade**, **Termos de Uso** e **Guia de Tamanhos**.

**Impacto:** loja de vestuário sem guia de tamanhos e sem política de trocas gera abandono de
carrinho e pós-venda problemático; privacidade e termos são exigência legal (LGPD) e requisito
de gateways de pagamento. Bloqueia aprovação em alguns meios de pagamento.

**Ação necessária:** criar as rotas institucionais e, preferencialmente, torná-las editáveis
via CMS — o módulo `content` já suporta `surface` e `type`, bastando adicionar
`surface: "institutional"`. Ver também item 3.3.

---

### 2.4 CPF não é coletado no checkout

**Evidência:**

- O backend **já espera** o CPF:
  - `backend/src/subscribers/order-customer-indexer.ts` lê `metadata.cpf` para catalogar o cliente;
  - `backend/src/api/store/orders/track/route.ts` exige `cpf` ou `email` para rastreio;
  - `backend/src/api/store/custom/checkout-info/route.ts` declara `accepted_documents: ["CPF"]`.
- **Nenhuma ocorrência de `cpf` no frontend** (busca em `frontend/src` sem resultados).

**Impacto:** o fluxo de rastreio de pedido *passwordless* prometido no README não funciona na
prática — o cliente não tem onde informar o CPF, então o pedido é salvo sem `metadata.cpf` e o
índice de clientes fica incompleto.

**Ação necessária:** adicionar campo CPF no formulário de checkout, com máscara e validação de
dígito verificador, persistindo em `metadata.cpf` do pedido/cliente.

---

### 2.5 CMS: elo entre Admin e vitrine incompleto

O módulo de conteúdo funciona ponta a ponta — o lojista edita em **Conteúdo da vitrine**
(sidebar principal do admin, `/painel/content`) e a mudança **chega** na home. Mas a
integração tem cinco lacunas que limitam o que é possível editar hoje.

#### 2.5.1 `featured` ("Peças em destaque") não é editável — destaque vem por acaso

**Evidência:** `frontend/src/modules/home/components/featured-products/index.tsx` busca os
produtos com `limit: 8` e **nenhum filtro**; o contrato (`contract.ts:82-90`) só tem
`eyebrow`, `title`, `subtitle`, `filters` (rótulos de chip) e `viewAllLabel`.

**Verificado:** `grep -E 'productId|collectionId|productIds|categoryId' contract.ts` →
**nenhum resultado**. O CMS não tem vínculo com nenhuma entidade comercial do Medusa.

**Impacto:** o lojista controla o *texto* da vitrine de destaque, mas **não quais peças
aparecem**. As 8 mostradas são as 8 primeiras que a Store API devolver, sem curadoria —
uma peça encalhada entra no lugar de uma vitrine, e não há como destacar a peça do momento.

**Ação necessária:** adicionar campo de curadoria (`productIds` / `collectionId`) ao
`FeaturedSection`, com seletor de produtos no admin e a query do front respeitando a seleção.
Requer migration leve (o formato é JSON, então `data` já comporta os IDs).

> **Nota (2026-09-28).** A seção nova de lançamentos (`launches`, o trilho de novidades logo
> depois do hero) entrou com a fonte **automática** de propósito: os produtos saem da Store API
> do mais novo para o mais antigo, e o CMS carrega só a cópia e o `limit`. Curadoria — o que este
> item pede — é o passo seguinte e vale para as duas seções, porque o campo `kind: "products"`
> nasce no contrato e não no tipo: as duas queries passam a respeitar a seleção quando ela
> existir. Enquanto isso, a diferença entre as duas seções é a de sempre: `featured` é catálogo
> com filtro, `launches` é novidade sem curadoria.

> **Nota (2026-09-29) — a metade de baixo está pronta, e não como o texto acima previa.** A
> curadoria existe de ponta a ponta **na API**: `PATCH /admin/content?id=…` aceita
> `productIds` (lista ordenada), `GET /admin/content` e `GET /store/content` devolvem a
> curadoria de quem tem uma, e `DELETE` desvincula antes de apagar a seção.
>
> A previsão de "migration leve, o `data` já comporta os IDs" estava errada, e por sorte: id de
> produto dentro do `data` é **cópia**, não referência — apagar um produto deixaria a vitrine
> apontando para o nada, sem erro e sem log. O que entrou no lugar foi o **link do Medusa**
> (`links/content-section-product.ts`): tabela `content_section_product`, com a ordem numa
> coluna `position` de verdade e o ciclo de vida dos dois lados ligado. Custo honesto: a tabela
> do link **não tem chave estrangeira** (o módulo de links do Medusa não as cria), então a
> existência do produto é validada na rota, e um `DELETE` cru no psql ainda pode deixar a linha
> ativa apontando para nada (ver `modules/content/curation.ts`).
>
> **Falta (Block 2):** o campo `kind: "products"` no contrato, o seletor no painel e a loja
> lendo `productIds` em vez de só a Store API — é o que faz o lojista **escolher** as peças. E
> aí entra o bump de `SCHEMA_VERSION` (o formato do payload muda para o CRM): hoje a curadoria
> trafega ao lado do `data`, e nenhum formulário do painel a edita ainda.

#### 2.5.2 Links das coleções em destaque apontam todos para o mesmo lugar

**Evidência:** `backend/src/modules/content/defaults.ts:82,90,98` — os três cards "Nossas
coleções" têm `href: "/store"`.

**Impacto:** os três cards do CMS são editáveis em título, imagem e ordem, mas **todos levam ao
mesmo destino**. O card é visual, não navegacional — a expectativa natural do lojista (e do
visitante) é que cada card abra a sua coleção.

**Ação necessária:** trocar o campo `href` por um seletor de coleção (ou preencher os hrefs com
`/collections/<handle>` reais). Combinado com 2.1: `/br/collections` hoje retorna **404**
(reconfirmado via `curl`), então apontar os cards para lá só trocaria um destino genérico por um
destino quebrado. **Corrigir 2.1 antes.**

#### 2.5.3 Apenas a superfície `home` é renderizada — rodapé resolvido

**Status: o rodapé entrou no CMS em 2026-09-26; resta a superfície institucional.**

**Evidência:** todos os blocos são gravados com `surface: "home"` (ver
`backend/src/modules/content/restore.ts`, que é quem cria `nav` e `footer` com as âncoras padrão) —
inclusive o `nav` e
o `footer`, que não são seções da home e quem os renderiza é o layout. Só
`app/[countryCode]/(main)/page.tsx` consome `getHomeSections()` como corpo de página; as partes
de cromo saem do mesmo payload via `headerSections()` / `footerSections()`. O rodapé agora é o
bloco `footer` (colunas de links — cada uma escolhendo a origem dos itens, catálogo ou digitados —,
e redes sociais, tudo editável em **Conteúdo da vitrine**); o que continua fora do CMS é a
superfície institucional — não há rota nem bloco para Sobre/Contato.

**Impacto:** o alcance do CMS é a home e o cromo (barra de anúncio, cabeçalho e rodapé). Textos
institucionais continuam exigindo deploy — o lojista edita a maior parte da loja, mas não uma
página de Sobre. Este é o mesmo problema do item 3.3, listado aqui porque é o teto da integração.

#### 2.5.4 Sem upload de imagem — resolvido

**Status: resolvido em 2026-09-28.** O CMS deixa de depender de deploy para trocar foto.

O que entrou:

1. **Provider de arquivos registrado.** `@medusajs/file-local` passou a ser dependência declarada
   do backend (era só transitiva — funcionava por hoisting e quebraria em silêncio num upgrade) e
   está registrada como **provider** do módulo `file` em `medusa-config.ts`. Antes disso não havia
   provider nenhum: o painel nativo também não conseguia subir foto de produto.
2. **O valor gravado é a CHAVE do arquivo**, não a URL. `POST /admin/uploads` devolve
   `{ id: "1790-hero.jpg", url: "http://localhost:9000/static/1790-hero.jpg" }`, e o campo guarda o
   `id`. A URL tem o endereço de quem respondeu o upload dentro dela: gravada, o conteúdo passaria
   a apontar para `localhost:9000` e quebraria quando a loja mudasse de domínio.
3. **Campos de imagem viraram `kind: "image"`** (`hero`, `editorial`, itens de coleção e do
   Instagram) e o editor do CRM ganhou envio, prévia e remoção (`image-input.tsx`).
4. **A loja publica o arquivo no próprio origem**: `resolveMediaUrl`
   (`frontend/src/lib/util/media.ts`) traduz chave → `/uploads/<chave>`, e o `next.config.js`
   reescreve para `<MEDUSA_BACKEND_URL>/static/<chave>`. Sem isso o otimizador do `next/image` —
   que roda **dentro** do container do storefront — não alcança o backend (`localhost:9000` lá
   dentro é o próprio container) e a foto some, mesmo com o arquivo no ar.
5. **O disco é volume** (`real_valor_uploads:/app/static`, nos dois modos): sem ele todo upload
   desapareceria na próxima recriação do container.

**Comprovado em 2026-09-28 (ambiente local, tudo em container):**

```bash
# upload pela API do admin (mesma rota que o controle do CRM usa)
curl -s -X POST localhost:9000/admin/uploads -H "Authorization: Bearer $TOKEN" \
  -F 'files=@teste.png'
# {"files":[{"id":"1790641079181-rv-teste.png","url":"http://localhost:9000/static/1790641079181-rv-teste.png"}]}

curl -s -o /dev/null -w '%{http_code}' localhost:9000/static/1790641079181-rv-teste.png   # 200 image/png
curl -s -o /dev/null -w '%{http_code}' localhost:8000/uploads/1790641079181-rv-teste.png  # 200 image/png (rewrite)
curl -s -o /dev/null -w '%{http_code}' \
  'localhost:8000/_next/image?url=%2Fuploads%2F1790641079181-rv-teste.png&w=640&q=75'      # 200 image/png (otimizador)

# conteúdo: chave no banco -> imagem na home, sem conversão manual
curl -s -X PATCH 'localhost:9000/admin/content?id=hero' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"imageUrl":"1790641079181-rv-teste.png"}'
curl -s localhost:8000/br | grep -o 'url=%2Fuploads%2F[^"&]*'
# url=%2Fuploads%2F1790641079181-rv-teste.png
```

**O que continua aberto (não é mais bloqueio):** o provider é o **local** — em produção o alvo é
S3, e trocar é mudar o item de `providers` no `medusa-config.ts` (o banco guarda a chave, então
nenhum conteúdo migra). A foto de **produto** subida pelo painel nativo ainda guarda a URL
absoluta do backend: os cards passam a funcionar quando consumirem `resolveMediaUrl` (bloco 3).

**Evidência (antes, 2026-09-26):** todos os campos de imagem do contrato eram `kind: "text"`
guardando um **path** (ex.: `imageUrl: "/brand/hero.jpg"`, em `frontend/public/brand/`), como
explica `defaults.ts:11-14`.

**Impacto (antes):** o caminho era *de mão única*. O lojista conseguia **trocar** a imagem se
soubesse a URL de um arquivo já publicado, mas **não tinha como subir** a foto nova. Na prática,
trocar o hero exigia um desenvolvedor publicando em `frontend/public/brand` — a promessa de
"mudar imagem sem deploy" só valia para o caso restrito de arquivo já existente.

**Ação necessária (feita em 2026-09-28):** endpoint de upload no admin (Medusa `File Module`) e o
campo de imagem passando a devolver o arquivo enviado.

#### 2.5.5 O conteúdo não está versionado no seed principal — resolvido

**Status: resolvido em 2026-09-28.** O `make seed` passou a semear o conteúdo, e o CRM ganhou
"Restaurar padrão" para o banco que já subiu vazio.

`seed-content.ts` agora é uma casca fina sobre `modules/content/restore.ts` — a **mesma** função
que a rota `POST /admin/content/restore` chama —, e o alvo `seed` do Makefile roda
`yarn seed` → `yarn seed-content` → `yarn seed-schema`. Uma base nova nasce com a vitrine montada,
sem ninguém abrir o painel; o botão "Restaurar padrão" cobre o caso de uma base que já subiu vazia
(ou de uma seção apagada por engano), porque nos dois o efeito é criar **só o que falta**.

**Comprovado em 2026-09-28:** com a tabela `content_block` (hoje `content_section` — o rename
de 2026-09-29 está em `migrations/Migration20260929204616.ts`) vazia (nove `DELETE` pela API),
`POST /admin/content/restore` respondeu
`{"created":["nav","announcement","hero","benefits","collections","featured","editorial","instagram","footer"],"kept":0}`
e a home voltou a renderizar o conteúdo do banco; repetir o POST devolve `{"created":[],"kept":9}`.
Durante a janela vazia a loja **não** quebrou: o fallback `DEFAULT_HOME_SECTIONS` do storefront
manteve a vitrine de pé (HTTP 200).

**Evidência (antes):** `backend/src/scripts/seed.ts` não referenciava `content` nem chamava
`seedContent`. O CMS dependia do script dedicado `seed-content.ts`, que **nenhum alvo chamava**.

**Impacto (antes):** provisionar o ambiente pelo caminho padrão (`seed.ts`) deixava a tabela
`content_block` **vazia**. O frontend não quebrava — `lib/data/content.ts` cai em
`DEFAULT_HOME_SECTIONS` — mas o admin abria **sem nenhuma seção** e o lojista não tinha o que
editar. O sintoma ("o CMS está vazio") não apontava para a causa (seed diferente).

#### 2.5.6 `POST /admin/content` não cria seção com `title` obrigatório no contrato — resolvido

**Status: resolvido em 2026-09-28.** A divisão entre coluna e conteúdo passou a ser decidida pelo
**schema do tipo**, e não pelo nome da chave (`backend/src/modules/content/payload.ts`).

O erro era pior do que o POST: o PATCH gravava o `title` na coluna e respondia 200, deixando
`data.title` — o texto que a loja desenha — intacto. O lojista editava "Título", lia "Conteúdo
salvo" e a vitrine não mudava. Comprovado antes da correção:

```bash
curl -s -X PATCH 'localhost:9000/admin/content?id=editorial' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"TITULO NOVO"}'
# 200
docker compose exec -T postgres psql -U real_valor -d real_valor_db -tAc \
  "select data->>'title', title from content_block where id='editorial'"
# A alfaiataria que valoriza você, não o seu status. | TITULO NOVO   <- coluna mudou, conteúdo não
```

Depois da correção, o mesmo PATCH muda `data.title` e **não** encosta na coluna (a coluna é rótulo
de listagem, e o CRM nem a mostra). `collections`, `featured`, `editorial` e `instagram` criam por
POST — e a seção nova nasce preenchida com o conteúdo padrão do tipo
(`DEFAULT_SECTION_DATA`), então a validação estrita continua valendo.

**Fechado de vez em 2026-09-29:** a coluna `title` **saiu** de `content_section` (era
`content_block`). A correção de 09-28 desempatava coluna × conteúdo pelo schema do tipo —
e desempate é o lugar onde o defeito mora. Sem a coluna, a divisão do corpo
(`modules/content/payload.ts`) passa a ser só o nome da coluna, e a colisão que exigiria
desempate virou asserção: nenhum campo de `SECTION_FIELDS` pode se chamar `enabled`,
`position` ou `surface` (`payload.unit.spec.ts`), e a guarda reprova o `title` voltando.
O `restore.ts` também deixou de montar a chave: o `title` do padrão vai inteiro no `data`.

Cobertura: `backend/src/modules/content/__tests__/payload.unit.spec.ts` (8 casos, incluindo
"campo do tipo ganha do nome da coluna", `enabled: "false"` e "não muda o corpo recebido").

**Evidência (antes, 2026-09-26):**

```bash
curl -s -X POST localhost:9000/admin/content -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"type":"instagram","position":75,"enabled":true,"handle":"@teste","title":"Teste","images":[]}'
# 400: Campo obrigatório ausente: "title".
```

`splitPayload` retirava `title` do corpo para a coluna `content_block.title`, e o `validateData`
validava o que sobrava contra o contrato. Só que `collections`, `featured`, `editorial` e
`instagram` têm `title` **também** como campo obrigatório do `data` — então o POST desses quatro
tipos era impossível, e no PATCH a edição era silenciosamente descartada. `benefits` (sem
obrigatório) funcionava, e foi por isso que o problema não apareceu antes.

**Ação necessária (feita):** manter `title` no `data` quando o contrato do tipo o declara, e cobrir
com casos de teste por tipo.

#### 2.5.7 Ordem da vitrine: cromo reordenável e gravação sem confirmação — resolvido

**Status: resolvido em 2026-09-28.**

O sintoma relatado foi "a ordem não chega na loja". **Não era isso** — foi medido ao vivo, e a
ordem chega:

```bash
curl -s -X PATCH 'localhost:9000/admin/content?id=editorial' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"position":25}'
# a home mudou de ordem em 2,2 s, sem nenhum comando manual:
#   antes   hero, benefits, collections, featured, editorial, instagram
#   depois  editorial, hero, benefits, collections, featured, instagram
```

O que faltava era o resto do pedido: (1) as setas **gravavam sozinhas**, então nada na tela dizia
que a loja já tinha mudado; (2) a lista misturava cromo e vitrine, e oferecer seta no cabeçalho
promete um movimento que a loja não faz; (3) sem prévia, "salvar" e "publicar" eram o mesmo clique.

O que entrou:

1. **As setas viram ordem pendente na tela** (`pendingOrder`), com barra "Ordem alterada — ainda não
   salva" e os botões **Salvar ordem** / **Descartar**. Descartar não é decoração: subir e descer a
   mesma seção **não** acende a barra (a ordem pendente é comparada com a gravada) e salvar sem
   diferença não gera requisição. O numeral da lista passa a mostrar a ordem **que a seção vai ter**
   enquanto a alteração está pendente — o número gravado deixaria de corresponder ao que se vê.
2. **O campo "Ordem" saiu do formulário.** Com as setas e o "Salvar ordem", um número digitável era
   um terceiro dono da mesma decisão — e o pior deles: um formulário aberto desde antes de uma
   reordenação devolvia a posição velha no `PATCH`. O `save()` deixou de mandar `position`: quem
   manda na ordem é a lista. O que ficou no lugar é o **numeral** da seção (`Badge`), ao lado do
   rótulo.
3. **O formulário da seção ganhou a barra "Alterações não salvas"**, com **Salvar** e **Descartar**,
   que aparece só quando há diferença entre a tela e o conteúdo gravado. É o par da barra da ordem:
   salvar deixou de ser um clique que se dá no escuro, e o botão fica no **topo** da seção (os
   trilhos de aparência esticam o formulário; um botão no fim é um botão que ninguém acha). A
   comparação vive em `admin/routes/content/form-draft.ts`, com teste — `JSON.stringify` cru diria
   "alterado" para um campo numérico que o formulário devolve como texto (`"8"` × `8`) e acenderia o
   aviso sozinho.
4. **Seção sem ordem.** `nav`, `announcement` e `footer` — os `singletonTypes` do schema — aparecem
   com etiqueta **Fixo**, sem setas e sem numeral de ordem. A loja resolve os três por `type`
   (`announcementSections` / `headerSections` / `footerSections`, em
   `frontend/src/lib/content/home-sections.ts`), nunca por `position`: mover o cabeçalho na lista do
   CRM não moveria nada no site. Desde 2026-09-29 a etiqueta e as setas leem a **coluna `fixed`** da
   seção, e não o tipo: quem cria a seção grava a resposta (`restore.ts` e o `POST /admin/content`, a
   partir de `SINGLETON_SECTION_TYPES`), e a tela mostra o que está gravado — o `db:generate` da
   coluna é no-op e o backfill da migration marcou o cromo que já existia.
5. **A faixa de posições da vitrine começa em 100** (`modules/content/order.ts`,
   `FIRST_VITRINE_POSITION`), e o cromo fica abaixo dela. É o que impede a renumeração da vitrine —
   que agora ignora o cromo — de cair em cima dos números do cromo: no estado atual do banco ele
   ocupa 10, 20 e 90, exatamente onde a vitrine começaria a ser renumerada, e `position` repetida
   deixa a ordem da lista indefinida a cada carregamento.
6. **A regra saiu da tela** para `backend/src/modules/content/order.ts`, com
   `order.unit.spec.ts` (22 casos: faixa, piso numa base semeada antes da regra, `positionFor`,
   idempotência, "só o que mudou é gravado", nunca repetir posição e — desde a R6.5 — a forma do
   corpo da ordem, o que a lista tem de bater com o banco e a gravação em **uma** chamada) e
   `admin/routes/content/__tests__/form-draft.unit.spec.ts` (9 casos de "está alterado?").
7. **Publicar a ordem é uma porta só** (R6.5). O "Salvar ordem" deixou de ser um laço de `PATCH`
   dentro do navegador e virou `POST /admin/content/order` com `{ ids }`: o servidor renumera
   (`applyOrder`), grava as posições numa chamada e avisa a loja **uma vez** — com 7 seções mudando
   de lugar, 1 aviso. O numeral da lista pendente continua sendo o que a seção **vai** receber, mas a
   faixa passou a chegar como dado no payload (`order: { first, step }`), porque o painel deixou de
   importar valor do backend (a guarda reprova a volta).

#### 2.5.8 Publicar em duas etapas: rascunho e prévia — aberto

**Status: aberto (pedido do cliente em 2026-09-28).**

Hoje toda ação do CRM — criar, editar, reordenar, remover, subir foto — grava **direto no que a
loja lê**, e o aviso de revalidação publica em segundos. É rápido, mas não permite o que o lojista
pediu: **conferir a vitrine antes de publicar**.

Dois desenhos, com custos bem diferentes:

| Desenho | Como funciona | Custo |
| :--- | :--- | :--- |
| **Publicado como fotografia** (recomendado) | uma linha `content_publish` guarda as seções publicadas; a loja lê a fotografia e os blocos passam a ser o **rascunho** (o CRM continua gravando neles, sem mudança nenhuma nas ações); "Publicar" copia blocos → fotografia e revalida; a prévia lê os blocos | 1 model + 1 migration + 3 rotas + modo prévia na loja. Rollback vem de graça: republicar uma fotografia antiga |
| **Rascunho por bloco** | coluna `status` (`draft` / `published`) na `content_section`, e cada ação escreve na cópia de rascunho | mais caro: **toda** ação do CRM muda, a listagem passa a ter duas linhas por seção e a ordenação única vira ordenação por status |

Duas decisões antes de implementar: **como a prévia abre** (cookie de draft mode do Next com link
assinado, ou `?preview=<token>` na URL) e **o que acontece com duas abas abertas** — o rascunho é da
vitrine inteira, então a última gravação vence, e isso precisa de aviso na tela.

---

### 2.6 Tailwind descarta a opacidade em cor que é variável — texto do hero e dos cards herda a cor errada

**Status: aberto (identificado em 2026-09-26, ao construir a aparência por seção).**

As cores da marca são declaradas como `var(--rv-*)` no `tailwind.config.js` — é o que permite um
tema sazonal recoloriar a loja sem rebuild. O problema: quando a cor é um `var(...)`, o Tailwind
(3.4.19) **não gera** o utilitário que pede opacidade. A classe simplesmente não existe no CSS.

```bash
# CSS servido pelo storefront (dev), 2026-09-26
curl -s localhost:8000/_next/static/chunks/src_1dd3d68c._.css \
  | grep -o 'text-rv-offwhite[^,{ ;]*' | sort -u
# text-rv-offwhite
# text-rv-offwhite:hover      <- nenhuma variante /85 nem /80
```

Reproduzido também fora do app, compilando o Tailwind do repositório (`node_modules/tailwindcss`
3.4.19) com um conteúdo de teste: `text-rv-offwhite/85` não produz regra; `text-rv-offwhite`
produz `color: var(--rv-offwhite)`. O mesmo vale para `bg-rv-dourado/20`, `from-rv-preto/70` e
`via-rv-preto/10` (o modificador é ignorado, e o utilitário sai do CSS).

Sem regra, o elemento não tem cor própria e **herda** — no tema padrão isso é `--rv-fg` (grafite,
`#303033`):

| Onde | Classe escrita | O que a loja mostra hoje |
| --- | --- | --- |
| Hero — subtítulo | `text-rv-offwhite/85` | grafite sobre o scrim escuro da foto |
| Hero — eyebrow | `text-rv-offwhite/80` | idem |
| Card de coleção — subtítulo | `text-rv-offwhite/80` | grafite sobre a foto |
| Card de coleção — scrim | `from-rv-preto/70 via-rv-preto/10` | sem gradiente nenhum: o título fica sobre a foto crua |
| Placeholders de imagem | `bg-rv-dourado/20` | sem tom de fundo enquanto a imagem carrega |

**Correção sugerida:** trocar a cor com opacidade por um token sólido (a opacidade é o ponto que o
Tailwind não consegue compor sobre `var()`), ou migrar esses elementos para as classes de
aparência por seção (`.rv-section-text-*`), que leem
`var(--rv-section-text-color, …)` — ver `backend/src/modules/content/README.md`, seção
*Aparência por seção*.

**Por que não foi corrigido junto com a aparência por seção:** a entrega tinha como requisito
"nada muda até o lojista escolher uma cor", e os fallbacks dessas classes foram escritos para
preservar o estado atual (`currentColor`) exatamente como está — corrigir o contraste junto
misturaria duas mudanças visuais na mesma revisão.

**Contorno imediato, sem deploy:** no CRM, seção Hero → campo *Subtítulo* → trilho *Textos* →
*Cor dos textos* → `Off White` (e nas coleções, que têm o mesmo caso no subtítulo do card, com a
ressalva de que ali o texto claro do card divide o campo com o texto escuro do bloco). Definida a
variável, ela ganha do `currentColor` e o texto volta a aparecer.

**Teste relacionado:** `backend/src/modules/content/__tests__/assets.unit.spec.ts` confere que toda
classe `.rv-section-*` definida no `brand.css` é usada na loja e vice-versa — foi assim que a
família de classes da aparência por seção deixou de depender de revisão manual para não virar CSS
morto. (A asserção nasceu em `scripts/check-contract-parity.mjs` e virou teste com a mesma promessa
quando a guarda foi apagada, no G4.)

---

