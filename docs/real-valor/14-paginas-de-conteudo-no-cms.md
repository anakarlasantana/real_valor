# 14 — Páginas de conteúdo no CMS

Este documento responde a uma pergunta só: **como dar à loja as páginas institucionais — Sobre,
trocas e devoluções, privacidade, termos, contato, perguntas frequentes — editáveis pelo CRM, em vez
de escritas em JSX?**

Ele existe porque o doc 13 nomeou o sintoma (nove botões apontando para `/store`, com "Conheça a
nossa história" entregando o catálogo) e a causa-raiz: **não existe rota institucional, e o painel não
conhece destinos**. Este documento trata a causa; o 13 continua sendo o mapa dos botões.

Levantado contra o **código** (não contra a intenção): cada afirmação traz o `arquivo:linha` do commit
atual, e o resultado de uma chamada real à loja rodando. Como reproduzir em 14.12.

Fora do escopo: tradução de PDP/checkout, catálogo, frete e pagamento.

---

## 14.1 O diagnóstico: o CMS já sabe servir uma página — só não conhece "página"

> ⚠️ **Retrato de antes da F1.** Esta tabela foi levantada contra o código de 2026-10-09, *antes* das
> mudanças desta fase, e é ela que sustenta o argumento do documento. **Seis linhas mudaram** com a F1
> — Superfícies declaradas, Leitura, Escrita, Rotas, Sitemap/robots e Render. O estado atual, com os
> números medidos, está em **14.15**.

| Peça | Estado hoje | Evidência |
| :--- | :--- | :--- |
| Superfícies declaradas | **Duas** — a vitrine e o tema | `CONTENT_SURFACES`, `packages/contrato/src/contract.ts:1686` e `:1707` |
| Leitura | Qualquer nome de superfície é aceito; só o `type` é validado | `backend/src/api/store/content/route.ts:32` (surface) e `:37` (type). `?surface=sobre` responde `{"sections":[],"schemaVersion":10}` — **200**, não 400 |
| Escrita | `POST /admin/content` aceita qualquer superfície; só o `theme` é travado | `backend/src/modules/content/validation.ts` → `resolveSurface` |
| Painel | As abas saem do `schema`, e o `schema` vem do **registro no Postgres** — não do bundle | `admin/src/admin/routes/content/page.tsx:862`; `service.getContract`, `service.ts:87`; o writer é `backend/src/scripts/seed-schema.ts` |
| Cromo | Cabeçalho, anúncio e rodapé saem da superfície `home` e são desenhados pelo **layout**, em todas as rotas de `(main)` | `frontend/src/app/[countryCode]/(main)/layout.tsx` |
| Revalidação | Gravar no CRM invalida a tag global do conteúdo | `backend/src/modules/content/revalidate.ts` → `revalidateTag("content")` |
| Cache da loja | `tags: ["content"]`, `revalidate: 60`, `cache: "force-cache"` | `frontend/src/lib/data/content.ts:63` |
| Render | `switch` + `assertNever` **local da home** | `frontend/src/app/[countryCode]/(main)/page.tsx` |
| Tolerância | Tipo desconhecido é **descartado**, nunca HTTP 500 | `frontend/src/lib/data/supported-sections.ts` |
| Rotas | Nenhuma institucional | `(main)/`: conta, carrinho, categorias, coleções, pedidos, rastreio, busca, loja |
| Sitemap / robots | **Não existem** | `find frontend/src -name 'sitemap*' -o -name 'robots*'` → vazio |
| Tipos de seção | 11, dos quais 5 são únicos (cromo e abertura) | `SECTION_TYPES`, `contract.ts:501`; `SINGLETON_SECTION_TYPES`, `:564` |

**A leitura disso, em três frases.** O dado já suporta: uma superfície é uma linha
(`content_section.surface`), a Store API já a serve pelo nome pedido, e a revalidação já é genérica. O
que não existe é **declaração** (ninguém disse que "sobre" é uma página), **rota** (nada desenha uma
superfície que não seja a vitrine) e **destino** (o painel não sabe quais páginas existem).

⚠️ `GET /store/content?surface=sobre` responder **200 vazio** não é um erro: é a fotografia de uma
página que ninguém declarou, numa loja que não tem rota para mostrá-la. O backend está pronto antes de
o produto existir — o custo, portanto, não está nele.

---

## 14.2 Vocabulário: "página de conteúdo", não "âncora"

| Termo | O que significa **neste projeto** hoje | Evidência |
| :--- | :--- | :--- |
| **âncora** | alvo de scroll **dentro** de uma página: `id={section.id}` + `/#secao` | `(main)/page.tsx:111-112` (`id={section.id}` / `className="rv-anchor rv-section"`); `rv-anchor` em `brand.css`; o `help` de `nav.links` (`contract.ts`) documenta `/#secao`, `/rota`, `https://`, `mailto:`, `tel:` |
| **seção** | um bloco do CMS numa superfície | `content_section` (`surface`, `type`, `enabled`, `position`, `fixed`, `data`) |
| **superfície** | o conjunto de seções que a loja lê com um `surface` | `ContentSurfaceSpec`, `contract.ts:1658` |
| **página de conteúdo** | **o que este documento propõe**: uma superfície declarada, com rota, SEO e ciclo de vida | 14.6 |

Chamar as telas novas de "âncoras" faria o time falar duas línguas: no CRM, "Salvar ordem" ordena
seções, e "âncora" já quer dizer destino de scroll. Nas issues e neste documento, o nome é **página de
conteúdo** — o menu do CRM continuará dizendo "seção" para as linhas de dentro dela.

---

## 14.3 De onde vem a necessidade (não é preferência: está prometido)

| Página | Quem já pede | Bloco que ela exige | Existe? |
| :--- | :--- | :--- | :--- |
| **Sobre** | "Sobre" do menu ancora em `#editorial`, e o CTA "Conheça a nossa história" leva ao catálogo | `editorial` + `banner` | blocos ✅ / página ❌ |
| **Guia de medidas** | **RV-009** (ALTA), com o link ao lado do seletor de tamanho | texto longo + tabela por peça | ❌ (hoje só `textarea`) |
| **Trocas e devoluções** | a referência trata devolução por tamanho como perda direta; o rodapé de referência tem coluna "Institucional" | texto longo | ❌ |
| **Privacidade (LGPD)** | **RV-012**, regra 5: consentimento com "link para a política" | texto longo | ❌ |
| **Termos de uso** | mesma família do link de consentimento | texto longo | ❌ |
| **Contato / Atendimento** | coluna "Atendimento" da referência; ícones `whatsapp`/`phone`/`pin` **já oferecidos pelo CRM e sem uso** | bloco de contato (`tel:`, `mailto:`, WhatsApp, horário) | ⚠️ parcial (só o `mailto:` do menu) |
| **Perguntas frequentes** | promessas vivas sem lastro: "Compra segura", "Frete seguro", "5% no Pix" | Q&A (acordeão) | ❌ |
| **Cuidados com as peças** | a referência tem bloco institucional de cuidados | texto longo | ❌ |
| **Política de frete/entrega** | RV-006 e a promessa "Frete seguro" | texto longo | ❌ |

Dois fatos que mudam o desenho — e por isso estão aqui, e não nas decisões pendentes:

1. **Não existe campo de texto longo.** `FieldKind` (`contract.ts:942`) oferece `text`, `textarea`,
   `number`, `select`, `image`, `color`, `font`, `hex` e `list:*`. Sem um bloco de texto estruturado,
   "Trocas e devoluções" seria **um** `textarea` gigante: sem títulos, sem listas, sem sub-âncora.
   A exigência dessas páginas não é "um CMS" — é **texto longo**, e ele não existe hoje.
2. **O rodapé institucional já é configurável sem deploy.** `footer.columns` (`contract.ts:1319`) tem
   `source: links | categories | collections` e `href` livre. Logo, "Institucional" e "Atendimento"
   são **dado, hoje** — o que falta não é o botão, é o **destino** que ele promete.

---

## 14.4 O que falta, em quatro peças

1. **Declarar** — uma entrada em `CONTENT_SURFACES` por página (`label`, `types`, faixa de `order`,
   `hint`) + o padrão dela, semeado. É **dado no contrato**; não toca em modelo nem em migration.
2. **Desenhar** — uma rota que leia a superfície e renderize as seções. Hoje quem renderiza é
   `(main)/page.tsx`, e o `switch` com `assertNever` mora lá, não numa biblioteca.
3. **Escrever melhor** — os dois blocos que as páginas exigem e o contrato não tem: **texto longo**
   (14.3, fato 1) e **Q&A** (14.3, "Perguntas frequentes").
4. **Encontrar** — um índice de destinos (as rotas que existem) que alimente, com um dado só: o
   seletor de destino no CRM (13.10, item 4), o `sitemap.ts` e a decisão de 404.

> Se só uma peça for feita, que seja a **1 com a 2**: elas entregam as páginas. A 3 melhora o conteúdo;
> a 4 devolve autonomia a quem edita — e é a única que impede o próximo `/stroe` de ir ao ar.

---

## 14.5 As três estratégias

### A — Superfície nomeada + rota estática por página

Uma entrada em `CONTENT_SURFACES` e um `page.tsx` por página (`/sobre`, `/trocas`, …), cada um
renderizando os blocos que aquela página usa.

**A favor:** cada rota é explícita e revisável; zero indireção; funciona no dia 1.
**Contra:** a página N+1 custa um PR de código, sempre; seis páginas = seis renderizações quase iguais
para manter em paridade; e a URL passa a existir **antes** de alguém decidir editá-la.

### B — Entidade `content_page`

Modelo próprio (`slug`, `title`, `seo`, `sections` ligadas por FK), migration, rotas admin/store, CRUD
no painel: o lojista **cria** páginas, não só edita as declaradas.

**A favor:** é a solução final; a lojista para de pedir deploy.
**Contra:** o maior custo do conjunto, e antecipa problemas que ainda não existem (quem apaga uma
página publicada? o que acontece com a URL? há redirecionamento?). Também duplica o que a superfície
já resolve: `surface` **é** a página; o que falta é o nome dela na lista de superfícies.

### C — Híbrida faseada: declarar agora, generalizar com gatilho (**recomendada**)

F1 declara 4 a 6 páginas como superfícies e cria **uma** rota genérica (A, sem o custo por página).
F2 adiciona os dois blocos. F3 dá o índice e o seletor de destino no CRM — e a entidade (B) só entra se
alguma página precisar de PR **duas vezes seguidas** (14.6.4).

| Eixo | A — rota por página | B — entidade | **C — híbrida (F1+F2+F3)** |
| :--- | :--- | :--- | :--- |
| Custo da primeira página | baixo | alto (modelo + migration + CRUD) | **baixo** |
| Custo da enésima página | **alto** (1 PR cada) | baixo | **zero** (linha no seed) |
| URL previsível e permanente | sim | sim | **sim** |
| Blocos fora da home | só os que a rota desenha | idem | **os mesmos da home + 2 novos** |
| Painel: aba nova | automática (é dado) | automática | **automática** |
| Bloqueia a lojista hoje? | não | não, mas atrasa | **não** |
| Reversível? | sim | sim, com migration | **sim** (só dado) |
| Rota de saída | por página | — | **gatilho explícito (14.6.4)** |

**Por que C, e em uma frase:** o contrato já é orientado a dado (a superfície é uma entrada, o painel
monta as abas a partir dela, a Store API serve qualquer nome), então a parte cara de B — criar
páginas — é justamente a que **não** falta; falta declarar as poucas que o negócio já promete, e isso é
dado.

---

## 14.6 A recomendação (estratégia C, em três fases)

### 14.6.1 F1 — declarar as páginas e uma rota (sem migration, sem tela nova)

**Contrato — o dado da fase.**

```ts
// packages/contrato/src/contract.ts
export type ContentSurfaceSpec = {
  …
  /** O que a superfície é. `page` é o que este documento acrescenta. */
  kind: "home" | "theme" | "page"
}

// Derivados: a lista das páginas não é digitada — é a fatia de CONTENT_SURFACES.
export const PAGE_SURFACES = CONTENT_SURFACES.filter((s) => s.kind === "page")
/** O que uma página pode receber: os blocos da home **menos** o cromo e a abertura. */
export const PAGE_SECTION_TYPES = SECTION_TYPES.filter(
  (type) => !isSingletonSectionType(type)
)
// → launches, collections, editorial, banner, featured, instagram (6 dos 11)
```

Exemplo da entrada de uma página (o `label` é o que a aba do CRM mostra; a chave é o **slug**):

```ts
{
  id: "sobre",
  kind: "page",
  label: "Sobre",
  titleField: null,
  enabledLabel: "Publicada",
  // **"seção"**, e não "bloco": o painel monta o rótulo do botão como
  // `Nova ${blockLabel}`, e "Nova bloco" é português errado na tela do lojista.
  // É o que o 14.2 já dizia: o menu do CRM continua chamando "seção" as linhas
  // de dentro de uma página.
  blockLabel: "seção",
  hint: "Esta página monta o /sobre. Sem nenhuma seção publicada, o endereço responde 404.",
  types: PAGE_SECTION_TYPES,
  // **1**, e não o 5 da vitrine: a página não tem bloco ancorado nenhum (nenhum
  // tipo único entre os `types` dela, então `reservedPositions` devolve vazio),
  // logo a primeira casa livre é a primeira. Copiar o 5 faria a primeira linha da
  // página nascer numerada como se quatro blocos existissem antes dela — e o
  // numeral é o que o lojista lê na tela (14.10).
  order: { first: 1, step: 1 },
}
```

Páginas da F1 (6, na ordem da fila do negócio): **`sobre`**, **`trocas-e-devolucoes`**,
**`privacidade`**, **`termos`**, **`contato`**, **`perguntas-frequentes`**. `contato` entra desde já
porque os ícones dela **já existem no CRM sem uso** (13.8); `faq` vira a última porque depende do bloco
da F2 — até lá ela é uma página de texto com o `editorial`.

**Backend — quatro correções silenciosas (todas já previstas em 14.7).**

| Onde | Hoje | Consequência de não corrigir | Mudança na F1 |
| :--- | :--- | :--- | :--- |
| `resolveSurface` (`validation.ts`) | aceita qualquer string | um typo no `surface` some sem aviso — o mesmo defeito do `/stroe` | aceitar só `CONTENT_SURFACES[i].id`; fora disso **400** em pt-BR |
| `POST /admin/content` | recusa o **segundo** `nav` na mesma superfície | uma página poderia receber `hero`/`footer`: bloco que a loja **nunca** desenha | recusar `isSingletonSectionType` fora de `home`/`theme` |
| `defaultsFor` (`restore.ts:81`) | superfície desconhecida → `DEFAULT_HOME_SECTIONS` | "Restaurar padrão" numa página **cria a home dentro dela** (anúncio, cabeçalho, capa, rodapé) | `home` → vitrine · `theme` → estações · `page` → `DEFAULT_PAGE_SECTIONS[surface] ?? []` |
| `seed-content.ts` | loop explícito em `["home", THEME_SURFACE]` (com o comentário que explica por quê) | o `make seed` **não** semeia página nenhuma: a base nova nasce com a página declarada e **vazia** — e vazia, pela regra do defeito 4, é 404 | acrescentar `...PAGE_SURFACES.map((s) => s.id)` ao loop |

**Frontend.**

| Onde | Mudança |
| :--- | :--- |
| `lib/data/content.ts` | `getSurfaceSections(surface)` generaliza o `getHomeSections` **mantendo a tag** (`tags: ["content"]`, `revalidate: 60`); `getHomeSections()` passa a ser `getSurfaceSections("home")`, e o `layout.tsx` não muda |
| fallback | ⚠️ o fallback para `DEFAULT_HOME_SECTIONS` (`content.ts:72-82`) **não** pode valer para página: vazio em página é `notFound()`, nunca a home |
| render | extrair o `switch` + `assertNever` de `(main)/page.tsx` para um registry de blocos compartilhado; a home passa a usá-lo (é a prova de que nada mudou na vitrine) |
| rota nova | `(main)/[slug]/page.tsx`: `slug ∈ PAGE_SURFACES` → renderiza; senão `notFound()` |
| `generateMetadata` | `title` do bloco de abertura (`banner`/`editorial`) e a descrição do primeiro texto; sem isso a página nasce como "Real Valor" no Google |
| `sitemap.ts` · `robots.ts` | passa a existir: home + páginas declaradas (o catálogo fica para o RV-007, para não misturar escopo) |

**A rota: `[slug]` na raiz do `(main)` ou `/pagina/[slug]`?**

| Opção | A favor | Contra |
| :--- | :--- | :--- |
| **`(main)/[slug]/page.tsx`** (recomendada) | a URL é `realvalor.com.br/sobre` — e a URL de uma página institucional é **permanente**; vale para F3 sem refazer nada | um slug futuro pode colidir com uma rota estática (o Next dá precedência à estática, e a página sumiria em silêncio) |
| `(main)/pagina/[slug]/page.tsx` | colisão impossível por construção | a URL fica `/pagina/trocas-e-devolucoes`: feio, difícil de ditar no telefone e mais um segmento a manter |

**Recomendação: `[slug]` na raiz**, com uma guarda barata: um teste lista os diretórios de
`(main)/` (`account`, `cart`, `categories`, `collections`, `order`, `pedido`, `products`, `rastreio`,
`search`, `store`) e falha se algum `id` de `PAGE_SURFACES` colidir. Sem ele, a colisão não avisa:
`/rastreio` já é uma página escrita à mão, e é exatamente esse o vizinho que o catch-all herda.

**O que a F1 entrega, verificável:** as páginas abrem pelo slug; cada uma tem uma aba no CRM; editar no
CRM muda a página no ar em até 60s; "Restaurar padrão" numa página repõe **o padrão daquela página**;
`/sobre` aparece no `sitemap.xml`; um slug não declarado responde **404**, não a home.

### 14.6.2 F2 — os dois blocos que faltam (na ordem da dor)

**`prose` — texto longo.** É o que destrava Trocas, Privacidade, Termos, Cuidados e Frete. O render
continua um `switch` de componentes: **HTML vindo do banco não entra em página nenhuma** — é vetor de XSS
num campo que o painel deixa editar. O que o campo de texto passa a aceitar é um **subconjunto fechado de
marcas inline**, gravadas como texto (14.6.3).

| Campo | Tipo | Para quê |
| :--- | :--- | :--- |
| `title` | `text` | o `<h2>` da seção |
| `blocks` | `list:proseBlock` | a estrutura: cada item tem `kind` (`subtitle` · `paragraph` · `bullets`) e `text` — em `paragraph` o texto é `markdown`; em `bullets`, `items` (`list:markdown`) |

Lista dentro de item de lista **já é suportada** no contrato — é o que `footer.columns[].links[]` faz
(`contract.ts:1319`), então não é uma forma nova de dado.

**`faq` — perguntas frequentes.** Página de dúvida é página de conversão: é onde mora a objeção.

| Campo | Tipo | Para quê |
| :--- | :--- | :--- |
| `title` | `text` | o `<h2>` |
| `items` | `list:faqItem` | `question` (`text`) + `answer` (`markdown`) — o mesmo parser do `prose`, pelo motivo de 14.6.3 |

O render é `<details>/<summary>` **nativo**: acessível por teclado, sem JavaScript, e o conteúdo
fechado **é indexado** (diferente de abas e acordeões feitos à mão). A resposta longa é o caso de uso
que faltava desde a F1 — e é por isso que `prose` e `faq` são o par.

⚠️ **Cada tipo novo não é "um componente".** É uma lista fixa de lugares, e esquecer um deles falha em
silêncio: `SECTION_TYPES` → `SECTION_FIELDS` → `DEFAULT_SECTION_DATA` → `SECTION_TYPE_LABELS` →
`CONTENT_TYPES` (`contract.ts:1735`) → `SCHEMA_VERSION` (`schema.ts:136`, hoje **10** — o bump faz a
loja descartar o que não conhece em vez de quebrar a página) → registry de render → padrão de seed → as
specs de paridade (`__tests__/contract`,`defaults`,`schema-record`,`payload`).

### 14.6.3 F2 — o texto formatado e o anexo (a decisão que o `prose` herda)

Duas perguntas chegam junto do `prose`, e são de naturezas diferentes: **como o negrito sobrevive ao
banco** e **como um PDF entra numa página**. A primeira é decisão de formato; a segunda já está resolvida
pela infraestrutura que existe.

**1. O formato são marcas inline — e o HTML continua fora.** A regra de 14.6.2 fica de pé; o que muda é
que o campo de texto passa a aceitar um **subconjunto fechado de marcas**, gravado como TEXTO:

| Marca | Vira | Escopo |
| :--- | :--- | :--- |
| `**texto**` | `<strong>` | dentro da frase |
| `_texto_` | `<em>` | dentro da frase |
| `~~texto~~` | `<s>` | dentro da frase |
| `[texto](/rota)` | `<a href>` | dentro da frase, com esquema em allowlist |

A **estrutura continua sendo dado**, não marca: `subtitle`, `paragraph` e `bullets` são o `kind` do item
em `blocks`. Não existe `##` nem `- item` no subconjunto — duas formas de escrever a mesma coisa é como
nasce a divergência entre o que o painel mostra e o que a loja desenha.

O `_` exige **fronteira de palavra** (como no CommonMark): `a_b_c` sai literal — sem essa regra todo
`snake_case` viraria itálico dentro da palavra. O `**` e o `~~` não exigem.

Três das quatro marcas não têm risco: o React escapa texto por padrão, então
`**<script>alert(1)</script>**` aparece literalmente na tela. A quarta tem, e é por isso a allowlist:
`[clique](javascript:alert(1))` é XSS **mesmo sem HTML nenhum**. O allowlist é `http`, `https`, `mailto`,
`tel`, caminho do próprio site (`/rota`) e âncora (`#secao`); o resto sai como texto puro — inclusive
`//evil.com`, que começa com `/` e é outro site, e `java script:x`, que esconde o esquema atrás do espaço.

**2. O render é uma função pura — e é ela que fecha o XSS.** O valor gravado é interpretado por
`renderInline(text)` (`frontend/src/lib/content/markdown.tsx` — TSX porque devolve JSX, e não TS; o
render é que constrói a árvore), que devolve **nós React**, nunca uma string de HTML:

```tsx
case "subtitle":  return <h3>{renderInline(text)}</h3>
case "paragraph": return <p>{renderInline(text)}</p>
case "bullets":   return <ul>{items.map((i) => <li key={i}>{renderInline(i)}</li>)}</ul>
```

⚠️ **O `subtitle` é `<h3>`, e não o `<h2>` que esta amostra trazia.** O título da seção (o campo `title`, na
tabela de 14.6.2) já é desenhado em `<h2>`: um `<h2>` dentro dele ficaria no **mesmo nível** do nome da
seção — dois títulos irmãos onde um é subordinado ao outro —, e quem lê a página por cabeçalhos (leitor de
tela, índice da busca) perde a hierarquia. A correção entrou na execução do PR3 (14.17). O `renderInline`
nos três é a outra correção da amostra: o `subtitle` também é um campo `markdown`.

**O render já existe e já tem spec** (`frontend/src/lib/content/markdown.tsx` e
`markdown.spec.tsx`, 16 casos: marca, aninhamento, allowlist, marca desconhecida, entrada patológica e a
paridade com a tabela). O que o PR3 acrescenta é o **tipo `prose`** que o chama e o **editor** — a peça
que fecha o XSS não é dívida do PR3.

Não existe `dangerouslySetInnerHTML` em lugar nenhum. É o que separa esta decisão do caminho "HTML no
banco": lá o site precisa de um sanitizador para **adivinhar** o que tirar; aqui não há o que tirar,
porque nada é interpretado como HTML. E é a mesma classe de peça que `list-order.ts` e `form-draft.ts`
(`admin/.../content/`), que já vivem com spec ao lado — a spec do parser entra do mesmo jeito.

⚠️ **Marca que o site não conhece sai literal, nunca some.** É a regra do campo desconhecido (14.6.2)
aplicada ao texto: quem digitar `__negrito__` vê `__negrito__` na página. A diferença entre "não funciona"
e "desapareceu sem avisar" é a diferença entre um chamado e um texto errado no ar.

**3. As marcas viajam no `schema` — o painel não importa valor do contrato.** A lista acima é declarada
uma vez em `packages/contrato/src/contract.ts` (`MARKDOWN_MARKS`) e chega ao painel **como dado**, no
mesmo payload que já carrega `ITEM_FIELDS` e `ICON_LABELS` (`contract.ts:1336-1352`: "quem os desenha é o
`field-input.tsx`/`page.tsx`, que não importam nada daqui"). Não é preferência de estilo: o painel **não
pode** importar valor — `import type` (`field-input.tsx:53-59`) some no build, e valor por aquele apelido
é reprovado duas vezes, pelo `tsc` e por `scripts/check-boundaries.mjs` (a frase do `make check`: "falha
se o CRM importar valor do backend"); e o Rollup reprova com
`Rollup failed to resolve import "@conteudo/contract"`. A toolbar do painel e o parser da loja leem a
**mesma** lista: uma pelo payload, outra pelo import de valor que o storefront já faz.

**4. A paridade editor ↔ parser tem teste.** O editor pode emitir marca que o site não desenha (ex.:
`___negrito itálico___`). A defesa é o mesmo espírito das specs de paridade do contrato: um teste alimenta
`renderInline` com **tudo o que o editor pode emitir**; no dia em que o editor ganhar uma marca sem o
render, o teste quebra antes de a página.

**5. O editor: onde ele roda é a decisão que sobra.** Os dois caminhos gravam a **mesma** string — o que
muda é o que a lojista vê enquanto edita:

| Caminho | O que ela vê | Custo de execução |
| :--- | :--- | :--- |
| Editor rico no CRM, serializando para as marcas | negrito **de verdade** ("igual ao Word"); a colagem do Word perde fonte, cor e `mso-*` na serialização | uma biblioteca no workspace do `backend/` — o painel não tem `package.json` próprio (só `tsconfig.json` e `jest.config.js`), então o lockfile e o bundle do backend são tocados; conferir com `make build-admin` |
| Sem biblioteca: uma barra de marcas sobre a caixa de texto atual | os `**` no rascunho, com prévia ao lado | zero dependência; é o mesmo `field-input.tsx` com uma barra acima |

**O que o PR3 escolheu: a barra de marcas** (decisão 8, 14.17). O negrito do rascunho aparece como `**` e o
lojista lê a página na loja para conferir — e a prévia "ao lado" desta tabela **não** foi feita, por uma
razão que só apareceu ao escrever o editor: o painel é outro pacote e **não importa valor do contrato**, e
uma prévia no CRM seria um **segundo parser** — exatamente a divergência entre duas leituras do mesmo texto
que este documento inteiro combate. Quem desenha o texto é o site; o que o painel garante é que a marca saia
como o parser entende (a paridade tem teste, item 4 acima). O custo de não ter prévia é a lojista alternar
entre a aba e a loja — e o custo de ter uma segunda leitura seria uma prévia que mente.

Os dois são **reversíveis um no outro**, e é o formato decidido aqui que garante isso. O que não se
reabre é "gravar HTML", por três razões, em ordem de custo: (a) um sanitizador **no site**, que hoje não
tem dependência de runtime para isso; (b) o estilo inline da colagem vencendo o `brand.css` — a "segunda
régua" que `editorial-callout/index.tsx:18-24` descreve como a causa de duas réguas visivelmente
diferentes; e (c) a imagem colada chegando com URL absoluta, o defeito que `image-input.tsx:9-16` já
documenta.

**6. O anexo (PDF) reusa o upload que existe.** O outro pedido real é o arquivo: o aviso assinado, o
contrato de troca, a tabela de medidas. O `kind` de campo `document` resolve **sem nada novo**: o painel
sobe pelo mesmo `POST /admin/uploads` (`@medusajs/file-local`, `medusa-config.ts`) e grava a **chave**
(`1699999999-aviso.pdf`); o site traduz chave → endereço com o `resolveMediaUrl` que já faz isso para a
imagem (`frontend/src/lib/util/media.ts` — o cabeçalho dele fala só de imagem e passa a ser o mesmo caso),
pelo rewrite `/uploads/:path*` que já está no `frontend/next.config.js:110`.

⚠️ **O anexo complementa o texto, não o substitui.** PDF não é indexável, não é bom no telefone e não é o
que a LGPD pede para o aviso em si (ela pede o texto acessível). O documento é o anexo **da** página, com
rótulo — "Baixar o aviso assinado (PDF)" —, nunca a página.

**O que fica verificável (é o aceite da F2).** Fica aqui, e não em 14.11: aquele é o recorte da F1.

1. Gravar `A **Real Valor** usa _dados_` no CRM e ler a loja devolve `<strong>Real Valor</strong>` e
   `<em>dados</em>`; no registro do Postgres o valor continua **string**, sem HTML.
2. `**<script>alert(1)</script>**` aparece **como texto** na página, e o HTML servido não tem script
   injetado — o mesmo depois de colar do Word.
3. `[clique](javascript:alert(1))` sai como texto; `[Trocas](/trocas)` e `[Fale](mailto:x@y.com)` saem
   como link.
4. Uma marca que o site não conhece (`__x__`) aparece literal — nunca desaparece.
5. O teste de paridade (`frontend/src/lib/content/markdown.spec.tsx`) falha se o editor passar a emitir
   uma marca que `renderInline` não desenha — hoje ele percorre a `INLINE_MARKS` inteira.
6. Colar do Word um trecho com fonte, cor e `mso-*` grava **sem** fonte, cor e `mso-*`.
7. O anexo grava uma **chave** (não URL absoluta) e a loja abre o arquivo pelo host do site; desligar o
   anexo tira o botão da página sem tocar no texto.

### 14.6.4 F3 — a autonomia (e o gatilho para generalizar)

**F3a — sem migration: o índice e o seletor de destino.**

1. **Lista de páginas** (`PAGE_SURFACES`) publicada como dado — a mesma que o `sitemap` já usa.
2. **Tela "Páginas" no CRM**: as páginas declaradas, com "publicada/despublicada" e um atalho para a
   aba de blocos dela. Não cria página — **edita** as que existem.
3. **Seletor de destino** nos campos de href (`ctaHref`, `viewAllHref`, `links[].href`): uma lista de
   rotas conhecidas em vez de texto livre. **É este item que resolve a causa-raiz do doc 13**: nove
   botões apontando para `/store` não é desatenção de quem editou — é ausência de alternativa no painel.

**F3b — a entidade `content_page` (estratégia B), só com gatilho.**

| Gatilho | Por quê ele é o sinal |
| :--- | :--- |
| Uma página precisou de **PR de dev duas vezes seguidas** | a declaração em dado já não está dando conta |
| Mais de ~8 páginas | a lista declarada no contrato começa a competir com o código |
| A lojista pede **criar ou despublicar** uma página sozinha | é a única coisa que F1–F3a não entregam |

Até lá, **não** construir B: seria pagar migration, CRUD e o problema de URL permanente para resolver
um caso que ainda não apareceu.

---

## 14.7 Os sete defeitos silenciosos que o plano tem de fechar

Todos são do mesmo tipo: **nada quebra**. A loja continua de pé, respondendo outra coisa — ou não
respondendo. É a categoria de defeito mais cara de descobrir depois.

| # | Defeito | Por que ele é silencioso (evidência) | O que fecha |
| :--- | :--- | :--- | :--- |
| 1 | "Restaurar padrão" **cria a home dentro da página** | `defaultsFor` (`restore.ts:81`) devolve `DEFAULT_HOME_SECTIONS` para toda superfície que não seja `theme` | F1: `defaultsFor` com o ramo `page` |
| 2 | Bloco **único** numa página: o CRM mostra, a loja nunca desenha | a casa e a coluna `fixed` nascem do **tipo** (`FIXED_SECTION_POSITIONS`, `contract.ts:785`; `restore.ts:133-135`), e o cromo é resolvido por `find` na superfície `home` | F1: recusar tipo único fora de `home`/`theme` |
| 3 | Unicidade **por superfície**, não por site | `SINGLETON_SECTION_TYPES` (`contract.ts:564`) promete "uma vez por superfície" — então `hero` numa página passaria na validação | F1: a regra passa a ser "uma vez, e só na vitrine" |
| 4 | A página **vazia vira a home** | o fallback de `lib/data/content.ts:72-82` foi escrito para a vitrine ("vazio é mais frequentemente seed que não rodou") | F1: leitor de página **sem** fallback; vazio → `notFound()` |
| 5 | Página nova com cache próprio (defasagem eterna ou perdida) | a loja lê com `tags: ["content"]` + `revalidate: 60` (`content.ts:63`); um leitor paralelo sem a tag fica fora do `revalidateTag` | F1: um leitor só (`getSurfaceSections`), a mesma tag |
| 6 | **Schema no banco ≠ contrato no bundle** | o CRM monta as abas do `schema` que vem do Postgres (`page.tsx:862`; writer `scripts/seed-schema.ts`); a rota da loja, do bundle | F1: `seed-schema` no deploy + o `--check` que já existe |
| 7 | Página fora do índice e com título errado | não há `sitemap.ts`/`robots.ts`; e o `generateMetadata` herdado publica o título do starter | F1: os dois arquivos + `generateMetadata` |

O defeito 1 é o mais fácil de rir e o mais caro: quem apagar por engano uma seção de `/trocas` e clicar
em "Restaurar padrão" recebe a **vitrine inteira** dentro da página de trocas — e o painel mostra isso
como sucesso.

## 14.8 O que a página herda de graça — e o que não

| Herdado | De onde | Evidência |
| :--- | :--- | :--- |
| Cabeçalho, barra de anúncio e rodapé | o layout de `(main)` desenha o cromo em **todas** as rotas, com fallback embutido | `(main)/layout.tsx` (`headerSections`, `announceSections`, `footerSections`) |
| Tema (cores, fontes, tokens escuros) | as CSS vars do tema, que as classes `rv-*` consomem | `brand.css` + `theme.json` por tema |
| Tolerância a bloco desconhecido | descarte, nunca HTTP 500 | `lib/data/supported-sections.ts` |
| Revalidação ao salvar no CRM | tag global `content` | `modules/content/revalidate.ts` |
| 404 da loja (layout incluso) | a rota `not-found` de `(main)` | `(main)/not-found.tsx` |
| Contêiner e offset do cabeçalho fixo | `rv-section` + `rv-anchor` (o wrapper que a home usa por seção) | `(main)/page.tsx:111-112` |

⚠️ **O que não se herda:** o `id={section.id}` (a âncora) **não** é automático — ele é escrito no render
da home. Se a rota nova não repetir o wrapper, o menu com `/#secao` continua funcionando na home e
passa a não funcionar na página, e nada avisa. E a página não herda busca, paginação nem `Suspense`:
se ela listar catálogo (`featured`, `collections`), a suspensão de carregamento é decisão de quem a
monta, não do layout.

## 14.9 O mapa da F1, arquivo a arquivo

| Arquivo | Mudança | Natureza |
| :--- | :--- | :--- |
| `packages/contrato/src/contract.ts` | `kind` no `ContentSurfaceSpec`, `PAGE_SURFACES`, `PAGE_SECTION_TYPES`, as 4–6 entradas | **dado** |
| `packages/contrato/src/defaults.ts` | `DEFAULT_PAGE_SECTIONS` (o padrão de cada página — **vazio hoje, de propósito**: a copy é do negócio, e a página sem bloco responde 404) | **dado** |
| `backend/src/modules/content/validation.ts:226` | `resolveSurface` valida contra o contrato | regra |
| `backend/src/api/admin/content/route.ts:174` | tipo único só em `home`/`theme` | regra |
| `backend/src/modules/content/restore.ts:81` | `defaultsFor` com o ramo `page` | regra |
| `backend/src/scripts/seed-content.ts` | o loop de superfícies passa a incluir `PAGE_SURFACES` | dado |
| `frontend/src/lib/data/content.ts` | `getSurfaceSections(surface)`; `getHomeSections` vira uma chamada dela | leitura |
| `frontend/src/modules/content/**` *(novo)* | registry de blocos (o `switch` sai da home e passa a ser compartilhado) | render |
| `frontend/src/app/[countryCode]/(main)/[slug]/page.tsx` *(novo)* | a rota: `slug` declarado → renderiza; senão `notFound()` | rota |
| `frontend/src/app/sitemap.ts` · `robots.ts` *(novos)* | home + páginas declaradas | SEO |
| `backend/src/modules/content/__tests__/*` | guardas: paridade contrato↔seed↔render, colisão de slug, `resolveSurface` | teste |

Nada aqui é migration: **nenhuma tabela nova, nenhuma coluna nova**. A superfície já é uma coluna, o
tipo já é validado pelo contrato e o painel já monta a aba sozinho.

---

## 14.10 Custos e guardas: o que a paridade cobra

Três listas de "o que se esquece". Nenhuma delas falha no `tsc`: as três falham só na loja.

**Superfície nova (F1)**

| Peça | Onde | O que acontece se faltar |
| :--- | :--- | :--- |
| A declaração (`id`, `label`, `types`, `order`, `hint`) | `CONTENT_SURFACES` | não há aba, e a leitura da Store API devolve vazio |
| O padrão da superfície | `DEFAULT_PAGE_SECTIONS` + `defaultsFor` | "Restaurar padrão" repõe **a vitrine** dentro da página (defeito 1) |
| O loop do seed | `seed-content.ts` | `make seed` não semeia a página: base nova nasce com a página vazia |
| O consumo (rota + sitemap) | `PAGE_SURFACES` | a página existe no banco e **não** existe na web |

**Tipo de seção novo (F2)** — nove lugares, um por linha da lista de 14.6.2. Os dois piores: sem
`CONTENT_TYPES` o CRM **não oferece** o tipo que o contrato já aceita; sem o registry de render o
`assertNever` transforma a seção em **HTTP 500 na página inteira**.

**Campo de tipo novo (`markdown`, `document`)** — a lista é outra, e menor, mas também não falha no
`tsc` para quem não olhar: `FieldKind` (`contract.ts:942`) → `HandledKind`/`UNHANDLED_KINDS`
(`field-input.tsx:70-109`, onde a omissão **é** erro de compilação) → o ramo no `field-input.tsx` → o
render que sabe desenhar o valor (`renderInline` para o texto formatado, o link assinado para o anexo) →
o campo na seção que o usa. O `validateData` não ganha regra por isso: ele valida por `kind`
(`validation.ts:115-184`) e o que não tem ramo passa como texto.

**Rota nova (qualquer página futura)** — o roteiro de 14.8: o cromo vem de graça, mas o wrapper
(`rv-section` + `rv-anchor`), o `generateMetadata`, a linha do sitemap e a decisão de 404 são escritos
à mão. É exatamente esse conjunto que a F3a troca por "uma linha de dado".

## 14.11 Critérios de aceite da F1

1. `/br/sobre` responde 200 e mostra os blocos publicados da superfície `sobre`.
2. Despublicar um bloco no CRM tira-o da página em até 60s, sem deploy.
3. Página **sem bloco publicado responde 404** — nunca a home (defeito 4).
4. "Restaurar padrão" numa página repõe o padrão **daquela página**; jamais cria `nav`/`hero`/`footer`.
5. Criar `nav` (ou `hero`, `benefits`, `announcement`, `footer`) numa página é recusado com 400 em pt-BR.
6. `surface` desconhecido (`?surface=sobreo`) responde **400** — o typo deixa de ser silêncio.
7. A aba da página aparece no CRM **sem** edição em React.
8. `/sitemap.xml` lista `/` e as páginas declaradas; `/robots.txt` existe e aponta o sitemap.
9. O título da página no `<title>` vem do conteúdo (`banner`/`editorial`), não do starter.
10. A vitrine não mudou: as specs de `contract`, `defaults`, `restore` e `wiring` seguem verdes, e o HTML
    da home é o mesmo do commit anterior.
11. Um `id` de `PAGE_SURFACES` que colida com um diretório de `(main)/` **falha a CI**.
12. `make seed` numa base zerada passa a incluir as páginas no laço de restauração; rodar de novo não muda nada
    (idempotência já garantida por `restore.ts`, mas agora com as páginas na lista). O padrão delas é **vazio**
    (14.6.1: a copy de uma página institucional é do negócio), então o que o seed cria numa página é a
    **declaração** dela — e a URL só passa a existir quando o lojista publica o primeiro bloco.

## 14.12 Como reproduzir esta coleta

```bash
# 1. As superfícies declaradas no contrato (e o que cada uma aceita)
grep -n 'export const CONTENT_SURFACES' -A 40 packages/contrato/src/contract.ts | grep -E 'id:|types:|order:'

# 2. A Store API responde uma superfície que ninguém declarou? (hoje: 200 vazio, não 400)
curl -s -H "x-publishable-api-key: $PUBLISHABLE_KEY" \
  'http://localhost:9000/store/content?surface=sobre' \
  | jq '{n: (.sections | length), schemaVersion}'

# 3. O que o painel vai ler — o registro no Postgres, e não o bundle do frontend
curl -s -H "authorization: Bearer $ADMIN_TOKEN" http://localhost:9000/admin/content | jq 'keys'

# 4. O contrato gravado bate com o que a loja conhece? (o `--check` do writer)
corepack yarn --cwd backend seed-schema --check

# 5. A home continua sendo o destino universal? (o sintoma do doc 13)
curl -s http://localhost:8000/br | grep -o 'href="/br/[a-z-]*"' | sort | uniq -c | sort -rn

# 6. As rotas institucionais existem? (hoje: 404 em todas)
for p in sobre trocas-e-devolucoes privacidade termos contato perguntas-frequentes; do
  printf '%-26s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8000/br/$p")"
done

# 7. Sitemap e robots
curl -s -o /dev/null -w 'sitemap %{http_code}\n' http://localhost:8000/sitemap.xml
curl -s -o /dev/null -w 'robots  %{http_code}\n' http://localhost:8000/robots.txt
```

O passo 5 é o termômetro: enquanto ele mostrar muitas linhas iguais para a mesma rota, o problema não
são os botões — é a falta de destino. O passo 6 é a prova de que este documento não inventou a
necessidade: as rotas que ele descreve hoje não existem, e cada uma delas já tem quem a prometa.

## 14.13 A sequência de PRs (o caminho de execução)

Oito incrementos, cada um **publicável sozinho**. A ordem não é estética: ela evita que um PR declare
uma página que outro ainda não sabe desenhar.

| PR | Conteúdo | Por que nesta ordem |
| :--- | :--- | :--- |
| **PR1 — F1 núcleo** | `kind` + `PAGE_SURFACES` + `PAGE_SECTION_TYPES`; as 4–6 superfícies; `defaultsFor`; `resolveSurface`; singleton só na vitrine; `getSurfaceSections`; registry de blocos; a rota `[slug]`; `sitemap`/`robots`; a guarda de colisão de slug | é o menor conjunto que faz uma página existir — e o único que precisa de `seed-schema` + `seed-content` no deploy |
| **PR2 — F1 rodapé** | colunas "Institucional" e "Atendimento" no padrão do rodapé (dado) — ✅ **executado**, ver 14.16 | precisa do PR1: antes dele, as colunas apontariam para 404 — a promessa continuaria vazia, agora com aparência de corrigida |
| **PR3 — F2 texto longo** | o tipo `prose`, o formato (`markdown` + `MARKDOWN_MARKS` + `renderInline` com spec) e o editor do campo no CRM | é o que destrava Privacidade, Termos, Cuidados e Frete; vem antes do FAQ porque tem quatro páginas esperando — e é o PR em que o negrito passa a funcionar de ponta a ponta — ✅ **executado**, ver 14.17 |
| **PR3b — F2 anexo** | o `kind` `document` (upload que já existe, chave gravada, `resolveMediaUrl` no render) | separado do formato porque não depende dele: o anexo é campo, não texto — e "página + PDF assinado" é o par que a LGPD pede (14.6.3) — ✅ **executado**, ver 14.18 |
| **PR4 — F2 FAQ** | o tipo `faq` e o render (`<details>/<summary>`) | uma página só, e ela é a que mais se beneficia do tipo anterior (resposta longa) — ✅ **executado**, ver 14.19 |
| **PR5 — F3a destinos** | a lista de rotas conhecidas + o seletor nos campos de href do CRM | **é este PR que resolve a causa-raiz do doc 13** — os nove botões param de ter `/store` como única alternativa |
| **PR6 — F3a tela "Páginas"** | lista das páginas declaradas, com publicada/despublicada e atalho para os blocos | trabalho de painel, e o único item que devolve autonomia sem abrir a entidade (F3b) |
| **PR7 — F3a descoberta** | as páginas no rodapé, no índice público e na sugestão do 404 | fecha o ciclo: a página passa a ser **encontrável**, não só existente |

Três cuidados de execução:

- **PR1 é o único com dependência de ambiente** (rodar `seed-schema` e `seed-content`). Os outros são
  código ou dado de conteúdo.
- **PR3/PR4 não podem entrar juntos**: cada tipo novo mexe na mesma lista de nove lugares (14.10) e no
  `SCHEMA_VERSION`. Dois bumps no mesmo PR escondem qual deles quebrou a tolerância da loja.
- **Só o PR3 pode tocar dependência.** Se o editor for o de biblioteca (14.6.3, item 5), ele instala no
  workspace do `backend/` — o painel não tem `package.json` próprio —, e a prova é `make build-admin`. Se
  o PR3 sair com a barra de marcas, **nenhum** PR desta sequência mexe em dependência. **A decisão 8 saiu
  em "barra de marcas"** (14.17): nenhum PR desta sequência toca dependência, e não há lockfile nem bundle
  de editor a defender.

## 14.14 Decisões pendentes (antes de escrever código)

1. **Quatro ou seis páginas na F1?** Sobre, Trocas, Privacidade e Termos são texto e não dependem de
   nada; Contato precisa de decisão de conteúdo (WhatsApp, horário, endereço) e FAQ depende do bloco da
   F2. Cada uma custa uma linha — a diferença é de conteúdo, não de código.
2. **`/sobre` substitui a âncora `#editorial`?** (13.10, item 2.) Se sim, o menu e o CTA "Conheça a
   nossa história" passam a apontar para a página, e o `editorial` da home vira resumo com link.
3. **O rodapé institucional entra junto da F1?** As colunas "Institucional" e "Atendimento" são **dado
   hoje** (14.3, fato 2) — a F1 é o que dá para onde elas apontarem. Entrar junto é a diferença entre
   "a página existe" e "a página é alcançável".
4. **Contato: `prose` ou bloco próprio?** Um bloco `contact` (WhatsApp, telefone, e-mail, horário) custa
   mais uma linha no contrato e um render; `prose` + `mailto:`/`tel:` resolve hoje e pode virar bloco
   depois, quando doer.
5. **SEO: derivado ou explícito?** Título e descrição tirados do bloco de abertura (F1) economizam um
   tipo de campo; campos `seo` por página são mais corretos e são pré-requisito de uma boa prévia em
   rede social.
6. **A tela "Páginas" do CRM entra na F3 ou antes?** É trabalho de painel, e é o que devolve autonomia
   (F3a, item 2). Sem ela, a F1 já funciona — só não é self-service.
7. **As páginas nascem vazias ou com rascunho?** Vazio significa 404 até alguém escrever (a regra do
   defeito 4). Rascunho significa um texto mínimo já publicado — e a decisão de quem responde por
   texto jurídico (Privacidade/Termos) não é técnica.
8. **O editor do texto formatado: biblioteca ou barra de marcas?** (14.6.3, item 5.) Os dois gravam a
   **mesma** string; a diferença é a experiência de quem edita e o custo de uma dependência no
   `backend/`. O caso que decide é a colagem do Word: com biblioteca ela perde a sujeira sozinha; sem
   biblioteca, o lojista cola e a sujeira entra no texto — como texto, porque HTML não há.
   ✅ **Respondida na execução: barra de marcas** (14.17). Zero dependência — nenhum PR desta sequência
   toca o lockfile —, e a colagem do Word entra como texto sujo, nunca como HTML.
9. **O PDF da LGPD precisa existir no lançamento?** Se precisar, o anexo **não** pode esperar a F2: as
   páginas da F1 são de texto (`banner`/`editorial`), e o campo `document` teria de entrar junto do PR1 —
   que hoje é o único PR com dependência de ambiente.
   ✅ **Deixou de ser decisão de código: o anexo entrou no PR3b** (14.18), então ele está no ar no mesmo
   lançamento que as páginas de texto. Se a loja sobe um PDF é conteúdo, não projeto — e o "único PR com
   dependência de ambiente" da frase acima envelheceu: são três (PR1, PR3 e PR3b, cada um pelo seu
   registro de schema; ver 14.17).
10. **Anexo: teto de tamanho e quais tipos de arquivo?** O campo de imagem já confere um teto **antes** de
   subir (`image-input.tsx:28-31`) porque o multipart do `/admin/uploads` é montado em memória; o PDF tem
   outra ordem de grandeza. A decisão é de conteúdo (quem sobe) e de custo (quanto cabe).
   ✅ **Respondida na execução: PDF só, teto de 25 MB** (14.18) — uma ordem de grandeza acima da foto de
   vitrine (8 MB), o que cobre um contrato escaneado em boa qualidade.

Enquanto 1 e 3 não saem, a F1 **não** está bloqueada: declarar as páginas e a rota é dado. O que não
pode ser adiado é a regra do vazio — **404, nunca a home** —, porque é ela que separa "a página ainda
não tem conteúdo" de "a loja prometeu uma história e entregou o catálogo".

O **formato** também não é pendência: o armazenamento (marcas inline, texto puro, sem HTML) está decidido
em 14.6.3 e é o que não se reabre — o que sobra é qual editor desenha esse formato (item 8).

---

## 14.15 O que já está no código (a F1 executada — 2026-10-09)

A **F1** (o PR1 de 14.13) está implementada e **medida contra a loja rodando**: as seis páginas se
declaram no contrato, abrem pelo slug, aparecem como aba no CRM, e os defeitos silenciosos de 14.7 estão
fechados do lado do código. O que ficou de fora está no fim desta seção, com o motivo — e nada dele
bloqueia a F1.

| Arquivo (o mapa de 14.9) | O que entrou |
| :--- | :--- |
| `packages/contrato/src/contract.ts` | `kind` no `ContentSurfaceSpec` (`home`/`theme`/`page`); `PAGE_SECTION_TYPES` (derivado dos tipos não únicos); as **6 páginas** em `CONTENT_SURFACES` (a chave **é** o slug); `PAGE_SURFACES` + `findSurface`/`isKnownSurface`/`isPageSurface` |
| `packages/contrato/src/defaults.ts` | `DEFAULT_PAGE_SECTIONS` — uma entrada por página, **vazia de propósito** (decisão 7: a copy é do negócio) |
| `backend/src/modules/content/validation.ts` | `resolveSurface` recusa (400, pt-BR) superfície **não declarada** e tipo que a superfície não aceita; `unknownSurfaceError` é a mensagem única das duas portas |
| `backend/src/api/store/content/route.ts` | `?surface=<não declarada>` → **400** (era 200 com lista vazia) |
| `backend/src/modules/content/restore.ts` | `defaultsFor` com o ramo `page` — fecha o defeito 1 (o "Restaurar padrão" de uma página não cria mais a vitrine dentro dela) |
| `backend/src/scripts/seed-content.ts` | o laço passa a incluir `...PAGE_SURFACES` |
| `frontend/src/modules/content/render-section.tsx` *(novo)* | o registro de blocos: o `switch` + `assertNever` saíram da home, e o embrulho de âncora (`id` do bloco + `rv-anchor` + aparência) virou `ContentSectionList` |
| `frontend/src/lib/data/content.ts` | `getSurfaceSections(surface)` (uma leitura, a mesma tag, a mesma janela de 60s); `getHomeSections` = ela + o fallback da vitrine; `getPageSections` = ela **sem** fallback |
| `frontend/src/lib/content/page-seo.ts` *(novo)* | `pageSeo(sections, label)`: título do bloco de abertura (com a ênfase, como o render desenha) e descrição do primeiro texto |
| `frontend/src/app/[countryCode]/(main)/[slug]/page.tsx` *(novo)* | a rota: `findSurface` → página declarada renderiza; **não declarada ou vazia** → `notFound()`; `generateMetadata` pelo conteúdo |
| `frontend/src/app/sitemap.ts` · `robots.ts` *(novos)* | home + as páginas **no ar** (o índice não anuncia 404); o robots aponta o índice |
| specs | `pages.unit.spec.ts` (contrato, padrão e faixa de numeração), `page-surfaces.spec.ts` (colisão de slug + a rota), `page-seo.spec.ts`, mais os casos novos em `validation.unit.spec.ts` e `wiring.unit.spec.ts` |

**Dois ajustes em relação ao que este documento propunha**, os dois por defeito visível na tela:

- **`order.first` é 1, não 5** (o exemplo de 14.6.1 já foi corrigido). A página não tem bloco ancorado —
  os `types` dela não incluem nenhum tipo único, então `reservedPositions` devolve vazio —, logo a
  primeira casa livre é a primeira. O 5 da vitrine existe para pular as casas 1 a 4 e a 10; copiá-lo faria
  a primeira linha de `/trocas` nascer numerada "5", como se quatro blocos existissem antes dela.
- **`blockLabel` é `"seção"`, não `"bloco"`**. O painel monta o rótulo do botão como
  `Nova ${blockLabel}` (`page.tsx`), e "Nova bloco" é português errado na tela do lojista — o 14.2 já
  dizia que o menu do CRM continua chamando "seção" o que está dentro de uma página.

### A coleta de 14.12, antes e agora

Os mesmos comandos de 14.12, contra a stack local (`make up`; loja em `:8000`, backend em `:9000`):

| # | O que mede | Antes | Agora |
| :--- | :--- | :--- | :--- |
| 1 | superfícies declaradas no contrato | 2 | **8** — `home`, `theme`, `sobre`, `trocas-e-devolucoes`, `privacidade`, `termos`, `contato`, `perguntas-frequentes` |
| 2 | `GET /store/content?surface=sobre` | 200 `{"sections":[]}` | **200** `{"sections":[],"schemaVersion":10}` (declarada e ainda vazia) |
| 2b | `GET /store/content?surface=sobreo` (o typo) | 200 `{"sections":[]}` | **400** `Superfície de conteúdo desconhecida: "sobreo". As declaradas são: home, theme, sobre, …` |
| 3 | `GET /admin/content` (o que o painel lê) | 2 superfícies | **8**, com `"kind":"page"` ×6, `schemaVersion: 10`, `schemaSource: "db"` |
| 4 | as rotas institucionais | 404 nas seis | **404 nas seis** — vazias, como manda o critério 3; com o primeiro bloco, `/br/sobre` responde 200 |
| 5 | `/br` (o sintoma do doc 13) | 11 blocos, 8 âncoras | **igual** — 11 blocos, as mesmas 8 âncoras (`hero`, `benefits`, `lancamentos`, `collections`, `editorial`, `banner`, `featured`, `instagram`) |
| 6 | `sitemap.xml` / `robots.txt` | 404 nos dois | **200 nos dois**; o índice lista `/br` e, depois do primeiro bloco, `/br/sobre` |
| 7 | `make seed` | laço em `home` + `theme` | laço em `home` + `theme` + **as 6 páginas** (`Já existem 0 seção(ões) em "sobre" — nenhuma faltando`) e o registro regravado: `Schema gravado (chave "content", versão 10, 12 tipo(s) de seção)` |

E o **fluxo inteiro**, na ordem em que a lojista o viveria — medido, não deduzido:

```bash
# 1. o CRM cria o bloco na página (POST /admin/content com token de admin de verdade)
#    {"id":"sobre-historia","type":"editorial","surface":"sobre","title":"A nossa história",…}
#    → HTTP 201, position 1 (a faixa da página), fixed false
# 2. a leitura pública passa a devolver o bloco
#    GET /store/content?surface=sobre → 1 bloco
# 3. a loja desenha a página
#    GET /br/sobre → 200
#    <title>A nossa história começa no seu tamanho | Real Valor</title>     ← generateMetadata
#    id="sobre-historia" class="rv-anchor rv-section"                      ← a âncora do menu
# 4. despublicar no CRM tira do ar, sem deploy
#    PATCH /admin/content?id=sobre-historia {"enabled":false} → 200
#    GET /br/sobre → 404 em 10s        (republicado: 200 em 10s)
# 5. e o que a API recusa
#    POST {"type":"hero","surface":"sobre"}   → 400 "O tipo "hero" é único da vitrine …"
#    POST {"type":"nav","surface":"contato"}  → 400 (mesma regra)
#    POST /admin/content/restore?surface=privacidade → {"created":[],"kept":0}  ← nada da vitrine
#    POST /admin/content/restore?surface=sobre       → {"created":[],"kept":1}  ← nada duplicado
```

Os portões de CI: `make types` (backend, painel e loja) **limpo**; `make test` **verde nos três pacotes** —
backend 24 suítes / 404 testes, CRM 5 / 70, loja 31 arquivos / 371 testes (21 deles novos); `make check`
ok (artefato e fronteira); `make build-admin` ok (`Frontend build completed successfully`).

### Os doze critérios de 14.11, um a um

| # | Critério | Estado |
| :--- | :--- | :--- |
| 1 | `/br/sobre` responde 200 e mostra os blocos publicados | ✅ medido (201 → bloco → 200) |
| 2 | Despublicar tira o bloco em até 60s, sem deploy | ✅ **10s** medidos (a tag `content` + a janela de 60s) |
| 3 | Página sem bloco publicado responde 404 — nunca a home | ✅ as seis respondem 404 enquanto vazias |
| 4 | "Restaurar padrão" repõe o padrão **daquela** página | ✅ `{"created":[],"kept":…}` — jamais `nav`/`hero`/`footer` |
| 5 | Criar `nav`/`hero`/… numa página é 400 em pt-BR | ✅ medido com `hero` e com `nav` |
| 6 | `?surface=sobreo` responde 400 | ✅ com a lista das declaradas na mensagem |
| 7 | A aba da página aparece no CRM **sem** edição em React | ✅ `schema.surfaces` com 8 entradas, servido do registro (`schemaSource: "db"`) |
| 8 | `/sitemap.xml` lista `/` e as páginas declaradas; `/robots.txt` existe | ✅ — com uma diferença deliberada: o índice anuncia só página **no ar**, porque anunciar 404 é pedir para ser classificada como rasa |
| 9 | O título no `<title>` vem do conteúdo | ✅ medido: o título sai do bloco de abertura ("A nossa história começa no seu tamanho") e o layout acrescenta a marca pelo template |
| 10 | A vitrine não mudou | ✅ os mesmos 11 blocos e as mesmas 8 âncoras; as specs de `contract`, `defaults`, `restore` e `wiring` seguem verdes |
| 11 | Um `id` de `PAGE_SURFACES` que colida com `(main)/` falha a CI | ✅ `page-surfaces.spec.ts` lê o **diretório** e falha na colisão — e falha também se a pasta não for encontrada (guarda que não passa vazio) |
| 12 | `make seed` inclui as páginas e é idempotente | ✅ medido; o padrão vazio é a decisão 7 de 14.14 |

### O que ficou de fora desta fase, e por quê

| Item | PR (14.13) | Por que não entrou agora |
| :--- | :--- | :--- |
| Colunas "Institucional" e "Atendimento" no rodapé | PR2 | ✅ **feito em 14.16** — o padrão traz as duas colunas; o que se publica segue a régua de lá |
| `prose` (texto longo), `MARKDOWN_MARKS` e o editor do campo | PR3 | ✅ **feito em 14.17** — e a decisão 8 que o travava saiu em "barra de marcas": o tipo, o campo `markdown` com o editor, a barra no CRM e a paridade entre a barra e o parser |
| `document` (anexo) | PR3b | ✅ **feito em 14.18** — o campo, o editor (com o teto da decisão 10) e o botão de baixar na página |
| `faq` | PR4 | ✅ **feito em 14.19** — o tipo, o item (`question` `text` + `answer` `markdown`) e o `<details>/<summary>` nativo, que reusa o parser e a barra do `prose` |
| Lista de destinos no CRM, tela "Páginas", a página no índice e no 404 | PR5–PR7 | Devolvem autonomia; a F1 não as exige. O **PR5** é o que fecha a causa-raiz do doc 13 |
| A **copy** das seis páginas | conteúdo | Decisão 7: o padrão é vazio e a página vazia responde 404. Quem escreve é o lojista, no CRM — a aba está lá, com os seis tipos de página disponíveis |

### As decisões de 14.14 que a execução respondeu

- **1 — quantas páginas na F1:** as **seis**. `contato` entra porque os ícones já existem no CRM sem uso;
  `perguntas-frequentes` porque o `editorial` já monta a página até o bloco de Q&A chegar, e porque a URL
  de uma página institucional é permanente — declarar agora evita um `/perguntas-frequentes` depois.
- **5 — SEO derivado ou explícito:** derivado, como 14.6.1 previa (`pageSeo`): título do bloco de
  abertura, descrição do primeiro texto, e o nome da página como rede quando o bloco ainda não tem
  título. Campos `seo` por página seguem em aberto para a prévia em rede social.
- **7 — página vazia ou com rascunho:** **vazia**. O padrão de cada página é `[]` e a página vazia
  responde 404. Rascunho publicado em nome do negócio — prazo de troca, política de dados, horário de
  atendimento — é uma promessa que ninguém combinou.

As pendências que **continuam abertas** são de conteúdo (2, 3, 4, 6, 9, 10) — a **8** foi respondida na
execução do PR3 (14.17, "barra de marcas") —; nenhuma bloqueia a F1: as páginas existem, abrem pelo slug,
aparecem no CRM e obedecem à regra do vazio — **404, nunca a home**.

---

## 14.16 O PR2 executado: o rodapé que dá destino (2026-10-09)

O **PR2** de 14.13 era "dado": as colunas "Institucional" e "Atendimento" no padrão do rodapé. Está no
contrato, tem guarda própria e foi **medido contra a loja rodando** — e a medição mudou uma decisão de
execução (abaixo, e é a parte que interessa).

| Arquivo | O que entrou |
| :--- | :--- |
| `packages/contrato/src/defaults.ts` | o bloco `footer` nasce com as **duas colunas da referência**, e cada link de página é o `id` de uma superfície declarada: `/sobre`, `/trocas-e-devolucoes`, `/privacidade`, `/termos` (Institucional) e `/contato`, `/perguntas-frequentes` (Atendimento), mais `/rastreio` e o `mailto:` que o menu já publicava. A coluna **"Ajuda" sai**: ela era uma só, e o rastreio é atendimento — é o nome que a referência usa |
| `packages/contrato/src/contract.ts` | o exemplo do tipo `FooterColumn` deixa de citar "Ajuda" — o vocabulário passa a ser o da referência |
| `frontend/src/lib/content/page-surfaces.spec.ts` | `describe("os destinos do rodapé")`, três guardas: as colunas e a lista **não podem vir vazias**; **todo destino interno resolve** (página declarada ou pasta de `(main)`, pelo primeiro segmento, que é o que permite `/collections/<handle>`); e **toda página declarada tem porta** no rodapé, com o `href` exatamente `/<id>` |

`make types` **0**; `make test` verde nos três pacotes (backend 404, CRM 70, **loja 374** — os 3 novos).
A guarda foi provada **mordendo**: com `/privacidade` trocado por `/privacidde` ela reprova apontando o
valor exato (`expected [ '/privacidde' ] to deeply equal []`), e o segundo caso acusa a página que ficou
sem porta. É a resposta ao pedido de 13.10 ("é esse item que impede o próximo `/stroe`") pelo lado do
código: `href` é string, e agora tem teste.

### A decisão que a medição forçou: o padrão é molde, a publicação é na régua

Um link de rodapé só serve se o destino responder 200 — e a página vazia responde **404** (decisão 7).
Medido na stack local (`make up`; loja `:8000`, backend `:9000`):

| Medição | Resultado |
| :--- | :--- |
| `/br` com as duas colunas publicadas (só os destinos vivos) | **1** âncora `href="/br/sobre"`, **1** `href="/br/rastreio"`, o `mailto:` em 2 âncoras (o item do menu e o do rodapé); os títulos `Institucional` e `Atendimento` no HTML, e a coluna "Ajuda" não existe mais |
| `/br/sobre` — com um bloco publicado na página | **200** |
| o mesmo link, com o bloco **despublicado** | a página vira **404 e o link continua no rodapé**. É o defeito de 14.3 medido ao vivo: deixou de ser promessa sem botão e passou a ser URL quebrada — pior, porque quebra na cara da cliente |
| as cinco páginas de texto longo | **404** até a copy existir |
| `/br/store` na home | **9** âncoras, antes e depois — a vitrine não mudou (critério 10 de 14.11) |

Daí a **régua**, que é a decisão de execução que a medição impôs:

- o **padrão** traz as duas colunas inteiras — é o molde de lançamento, com o nome de cada coluna e a URL
  certa já apontada, para o rodapé não depender de alguém lembrar de `/trocas-e-devolucoes`;
- o que se **publica** é só o que responde 200 hoje. No local: `Institucional → Sobre` (enquanto houver
  bloco publicado na página) e `Atendimento → Acompanhar pedido` + o e-mail. Ligar os seis links de página
  antes da copy trocaria "o link não existe" por "o link está quebrado" — a diferença entre uma pendência
  visível e um defeito no ar.

**O que isso custa, dito sem enfeite:** o padrão e o banco divergem **de propósito** enquanto a copy não
chega. O padrão é o alvo; o CRM é o estado. Quando os textos entrarem (PR3 para os quatro de texto longo,
PR4 para o FAQ), publicar os links que faltam é edição de coluna no CRM — **nenhum deploy**, que era
exatamente o argumento de 14.3 ("o que falta não é o botão, é o destino").

### O que continua fora, e o que este PR mudou na fila

- **A copy das seis páginas** — decisão 7, e a razão de os links ficarem desligados. É o único item entre
  "o rodapé está no ar" e "as páginas são alcançáveis".
- **A coluna automática de páginas** — uma `source: "pages"` que liste só as que respondem 200 (a mesma
  regra do `sitemap` de 14.15) resolveria isto sem ninguém lembrar de ligar link. **Fica no PR7**, junto do
  índice público e da sugestão do 404: o PR2 é o passo manual, o PR7 é o automático — e agora há medição
  que mostra por que o automático é o desenho certo para o dia em que as páginas forem muitas.
- Os demais itens de 14.13 (PR3, PR3b, PR4, PR5, PR6) seguem como estavam na tabela de 14.15.

---

## 14.17 O PR3 executado: o texto longo que a lojista escreve (2026-10-09)

O **PR3** de 14.13 era o tipo `prose`, o formato (`markdown` + `MARKDOWN_MARKS` + `renderInline`) e o
**editor** do campo no CRM. É o PR em que o negrito passa a funcionar de ponta a ponta: o que se digita no
painel chega à página dentro de `<strong>`, e o que o site não conhece sai **literal** — nunca some.

Ele estava travado na **decisão 8**, e ela saiu em **barra de marcas** (14.6.3, item 5): **zero
dependência**, nenhum lockfile tocado, e o editor é o mesmo `field-input.tsx` com quatro botões acima da
caixa. Os botões saem do `schema` (`markdownMarks`, gerado de `MARKDOWN_MARKS`): o painel **não importa
valor** do contrato — a mesma regra que já fazia `ITEM_FIELDS` e `ICON_LABELS` viajarem no payload.

### Os nove lugares de 14.10, um a um

| Lugar | O que entrou |
| :--- | :--- |
| `SECTION_TYPES` | `"prose"` — o **primeiro tipo que só existe em página** (não está no conteúdo padrão da vitrine) |
| `SECTION_FIELDS` | `title` (`text`) e `blocks` (`list:proseBlock`) |
| `DEFAULT_SECTION_DATA` | a entrada de `prose`, vinda de uma tabela nova (`DEFAULT_PAGE_SECTION_DATA`) — a seção nova nasce com **um parágrafo vazio**, que é o "nascer com o que a loja sabe desenhar" |
| `SECTION_TYPE_LABELS` | `prose` → **"Texto longo"** |
| `CONTENT_TYPES` | nada a fazer: é derivado (`[...SECTION_TYPES, THEME_TYPE]`) — o tipo novo entra sozinho, e é um dos lugares que se esquece |
| `SCHEMA_VERSION` | **10 → 11** (e o passo de deploy que este PR ganha, abaixo) |
| registry de render | `case "prose"` em `modules/content/render-section.tsx`, com o desenho em `modules/content/prose.tsx`. O `assertNever` **reprovou o build** antes disso, com o nome do tipo no erro (`Argument of type 'ProseSection' is not assignable to parameter of type 'never'`): o compilador foi o primeiro a cobrar o lugar |
| padrão de seed | `DEFAULT_PAGE_SECTIONS` continua **vazio** (decisão 7): o seed cria a **declaração** da página, não a copy |
| specs de paridade | `contract` (`list:proseBlock` ⇔ o tipo `ProseBlock`, campo a campo e na ordem), `defaults` (todo tipo tem padrão de seção nova), `schema-record` (o payload tem `markdownMarks`), `markdown` (a paridade barra ⇔ parser), `panel-wiring` (o painel lê as marcas e não as espelha) |

### O que a execução corrigiu no desenho

- **O `subtitle` é `<h3>`**, e não o `<h2>` da amostra de 14.6.3 (o texto do documento foi corrigido): o
  título da seção é um `<h2>`, e dois títulos irmãos onde um é subordinado ao outro perdem a hierarquia
  para quem lê a página por cabeçalhos.
- **A "prévia ao lado" de 14.6.3 não foi feita**, e a razão é de desenho, não de prazo: o painel não pode
  importar valor do contrato, então uma prévia no CRM seria um **segundo parser** — a divergência entre
  duas leituras do mesmo texto que este documento combate. Quem desenha o texto é o site; o que o painel
  garante é que a marca saia como o parser a entende.
- **O `subtitle` também passa por `renderInline`** (a amostra desenhava o texto cru): o campo é `markdown`
  nos dois, e não havia razão para o subtítulo ser o único a não aceitar negrito.
- **Este PR também tem dependência de ambiente** — ao contrário do que o "Três cuidados" de 14.13 dizia
  (só o PR1). O `SCHEMA_VERSION` subiu, e o registro gravado é quem manda na API: medido, `POST
  /admin/content` com `type: "prose"` respondeu **400** (`deve ser um de: announcement, … theme`) até o
  `make seed-schema` rodar, que escreveu *"Schema gravado (chave "content", versão 11, 13 tipo(s) de
  seção). Era v10."*. A loja, essa, já sabia desenhar antes: o tipo dela vem do contrato.



### Medido na stack local (`make up`; loja `:8000`, backend `:9000`)

| Medição | Resultado |
| :--- | :--- |
| `make types` | **0** |
| `make test` | verde nos três pacotes: backend **406**, CRM **81**, loja **392** (18 novos) |
| `make build-admin` | **0** — o painel compila com a barra de marcas e a caixa em item de lista (é a prova que 14.13 pede quando o PR toca o editor) |
| `make check` | **0** — inclusive a fronteira: o painel importa o **tipo** `MarkdownMark` (`import type`, que o build apaga) e **nunca** valor do contrato |
| `make check-schema` | **0** — *"Registro do schema em dia (chave "content", versão 11)"* |
| o payload do CRM (`GET /admin/content?surface=privacidade`) | `schemaVersion: 11`; `types` com `prose`; `typeLabels.prose` = "Texto longo"; `fields.prose` = `title`, `blocks`; `itemFields["list:proseBlock"]` = `kind` (parágrafo · subtítulo · lista), `text` (`markdown`), `items` (`list:markdown`); `markdownMarks` = Negrito · Itálico · Riscado · Link; e `prose` entre os tipos que a aba da página oferece |
| `/br/privacidade` com um bloco `prose` publicado | **404 → 200**, com a estrutura e as marcas abaixo |
| o mesmo bloco **removido** no fim da medição | volta a **404** — a régua de 14.16 outra vez, e a razão de a copy não ser minha (decisão 7) |

O HTML servido, literal (o mesmo texto do CRM, com `<h2>` de seção, `<h3>` de subtítulo, `<p>` e `<ul>`):

```html
<h2 class="rv-display rv-section-heading rv-prose-title">Política de privacidade</h2>
<h3 class="rv-display rv-section-heading rv-prose-subtitle">Seus dados são seus</h3>
<p class="rv-section-text rv-prose-paragraph">A <strong>Real Valor</strong> guarda o <em>mínimo</em> e <s>nunca vende</s> o que você escreve.</p>
<ul class="rv-section-text rv-prose-list"><li>O prazo é de <a href="/trocas-e-devolucoes">30 dias</a>.</li><li>Peças sem uso.</li></ul>
<p class="rv-section-text rv-prose-paragraph"><strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong> e [clique](javascript:alert(1)) e __negrito__ e <a href="/store">catálogo</a>.</p>
```

E os critérios verificáveis de 14.6.3, um por um:

| # | Critério | Medição |
| :--- | :--- | :--- |
| 1 | `**negrito**` na loja, string no Postgres | `<strong>Real Valor</strong>` no HTML, e o `data` (**jsonb**) guardando `A **Real Valor** guarda o _mínimo_ e ~~nunca vende~~ …` — sem `<strong>` nenhum no banco |
| 2 | `<script>` colado aparece como **texto** | `<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>`; a sequência `<script>alert(1)</script>` **não** existe no HTML servido |
| 3 | `javascript:` sai literal; `/rota` e `mailto:` viram link | `[clique](javascript:alert(1))` literal, e `[30 dias](/trocas-e-devolucoes)` e `[catálogo](/store)` como `<a>` |
| 4 | Marca desconhecida sai literal | `__negrito__` na página |
| 5 | Paridade editor ⇔ parser | `markdown.spec.tsx` compara as duas listas e alimenta `renderInline` com tudo o que um botão emite |
| 6 | Colagem do Word sem `mso-*` | **Não se aplica com a barra**: o item era da biblioteca, que serializa. O que se mediu é o que valia aqui — a colagem entra como **texto**, e nada vira HTML (critério 2) |
| 7 | O anexo grava chave, e não URL | **PR3b** |

Uma medição de beira que o link relativo levanta: `[30 dias](/trocas-e-devolucoes)` é gravado **sem** o
país (nas colunas do rodapé é o `nav-link` que prefixa), e o `href` sai cru no HTML. Funciona porque o
`middleware.ts` do storefront redireciona o que chega sem país — medido: `GET /trocas-e-devolucoes` responde
**307** para `/br/trocas-e-devolucoes`. É a mesma peça que atende a âncora `/#secao` da vitrine, e é o que
permite o default de `MARKDOWN_MARKS` (`](/rota)`) ser um caminho do próprio site.

**A vitrine não mudou** (critério 10 de 14.11, medido de novo): `/br` responde 200 com **25** `href`
distintos antes e depois, `/br/store` com **30**, e a palavra `rv-prose` **não** aparece na home nem no
catálogo — o tipo novo não entrou no conteúdo padrão da vitrine, e o seed não inventa bloco.

### O que ficou fora, e o que este PR mudou na fila

- **A copy das páginas** — decisão 7, de novo. O PR3 entrega a **caneta**; o que se escreve com ela é do
  negócio. As quatro páginas de texto (Privacidade, Termos, Trocas e Cuidados) já podem ser escritas.
- **O trilho de aparência do `prose`** (fundo, fonte, cor) — a seção nasce sem nenhum, como a tabela de
  14.6.2 desenha. O embrulho de 14.8 já respeita um fundo se um dia ele for declarado (`appearanceVars` é
  de todo bloco); o que falta é a decisão de que uma página institucional se veste.
- **Colar uma lista e ela virar vários itens** — o `list:text` faz isso (`parseTextList`); aqui, **não**:
  num texto formatado a quebra colada pode ser um parágrafo inteiro, e dividir seria adivinhar. Fica
  anotado como a diferença deliberada entre os dois `list:` de caixa de texto.
- **PR3b (o anexo `document`)** é o próximo da fila de 14.13, e não depende deste formato: é campo, não
  texto. **O PR4 (FAQ) vem depois dele** — e o `faq` reusa exatamente este parser, com o campo `answer` em
  `markdown`.
- **A seção `prose` publicada e ainda sem texto desenha nada — e a página responde 200** com o cromo (a
  régua de 14.16 só sabe de "tem bloco publicado"). Não é o defeito 4 (a página **não** vira a home; a
  vitrine não aparece) e é o estado honesto de "a seção existe e ainda não foi escrita" —, mas é o par do
  defeito "endereço que abre vazio". Quem o resolve **não** é este PR: a decisão "esta página tem o que
  mostrar?" é do índice de páginas (**PR5/PR6**, a tela "Páginas"), que é onde a lojista vê a linha
  "publicada, sem texto". Fazer a rota decidir isso hoje exigiria uma segunda cópia da regra de vazio de
  cada tipo dentro do `[slug]/page.tsx` — o tipo de espelho que este projeto paga caro.

**O que este PR mudou na fila:** o PDF da LGPD (decisão 9) continua podendo esperar o PR3b, porque as
páginas de texto agora existem sem ele — a Privacidade é escrevível hoje, e o anexo é o **complemento**
(doc 14.6.3). E o **PR7** ganhou um item a menos de dúvida: a coluna automática de páginas
(`source: "pages"`) passa a ter quatro páginas de verdade para listar assim que a copy entrar.

---

## 14.18 O PR3b executado: o anexo da página (2026-10-09)

O **PR3b** de 14.13 era o `kind` `document`: o arquivo que a página promete em PDF — o aviso assinado, o
contrato de troca, a tabela de medidas. Ele não dependia do formato do PR3 (é campo, não texto), e a
infraestrutura já existia inteira: o upload do painel (`POST /admin/uploads`), a **chave** gravada no lugar
da URL e o `resolveMediaUrl` do storefront.

A **decisão 10** saiu em **PDF só, teto de 25 MB** — conferido no painel **antes** de subir, como o campo
de imagem faz, porque o multipart do `/admin/uploads` é montado **em memória**: o custo de um arquivo
grande não é o arquivo, é o processo que o recebe.

| Arquivo | O que entrou |
| :--- | :--- |
| `packages/contrato/src/contract.ts` | o `FieldKind` `document` e, no `prose`, `documentUrl` (o anexo) e `documentLabel` (o que o botão diz) |
| `packages/contrato/src/schema.ts` | `SCHEMA_VERSION` **11 → 12** — os dois campos entram no formulário, e o registro gravado é quem o serve |
| `packages/contrato/src/defaults.ts` | a seção nova nasce **sem** anexo e sem rótulo: sem arquivo, sem botão |
| `frontend/src/modules/content/prose.tsx` | o `<a download>` abaixo do texto, com o rótulo do CRM (ou "Baixar o documento (PDF)") |
| `frontend/src/styles/brand.css` | `.rv-prose-document`: o fio acima e o rótulo em caixa alta pequena, para o botão não se confundir com a última frase do texto |
| `admin/.../document-input.tsx` | o campo: envio pelo mesmo `/admin/uploads`, a chave gravada, **sem** prévia (o que se confere é o caminho do arquivo) e o teto dos 25 MB |
| `frontend/src/lib/util/media.ts` | o cabeçalho passa a falar de **imagem e anexo**: chave → endereço é a mesma regra, e agora serve às duas pontas |
| `backend/.../wiring.unit.spec.ts` | a guarda nova: **os campos do `prose` são exatamente os que a página lê** — os dois sentidos, e não só um |

### Uma correção ao desenho, e um limite declarado

- **O anexo é do `prose`, e não de cada página.** O documento é **da** página e tem rótulo; a página de
  texto é o `prose`. Um campo "anexo" por superfície seria uma segunda forma de pendurar o mesmo botão — a
  divergência de novo, agora no dado.
- ⚠️ **O conteúdo do arquivo não é conferido.** O que se grava é a chave que o provider devolveu; quem
  escolhe o arquivo é o navegador do lojista (`accept="application/pdf"`), e o teto é conferido no painel.
  Um `curl` direto em `/admin/uploads` com outro tipo gravaria a chave dele do mesmo jeito, e o que a loja
  faria é publicar o botão com o rótulo do conteúdo. É o mesmo arranjo do campo de imagem — e a razão de a
  decisão 10 ser de **conteúdo**: quem sobe é a loja, e o que ela sobe é responsabilidade dela.


### Medido na stack local (loja `:8000`, backend `:9000`)

| Medição | Resultado |
| :--- | :--- |
| `make types` / `make test` | **0** / verde: backend **407**, CRM **81**, loja **396** (4 novos) |
| `make build-admin` / `make check` / `make check-schema` | **0** / **0** / **0** (*"Registro do schema em dia (chave "content", versão 12)"*) |
| `make seed-schema` | *"Schema gravado (chave "content", versão 12, 13 tipo(s) de seção). Era v11."* |
| o envio (`POST /admin/uploads` com um PDF de teste) | **200**, e a resposta traz a **URL absoluta do backend** (`http://localhost:9000/static/<chave>`) — o motivo de o campo gravar só a chave |
| `POST /admin/content` com `documentUrl` + `documentLabel` | **201**, e o `data` no Postgres guarda a **chave** (`1791593425255-rv-aviso.pdf`), nunca a URL |
| `/br/privacidade` com o anexo publicado | **200**, com `<a href="/uploads/1791593425255-rv-aviso.pdf" download="">Baixar o aviso assinado (PDF)</a>` abaixo do texto |
| `GET /uploads/<chave>` **no host da loja** | **200**, `content-type: application/pdf`, os 218 bytes do arquivo — o rewrite de `next.config.js` serve o anexo pelo domínio da página |
| o anexo **desligado** (`PATCH` com `documentUrl: ""`) | **200 com o texto intacto e sem o botão** — o critério 7 de 14.6.3, nas duas metades |
| a seção e o arquivo removidos no fim da medição | `/br/privacidade` volta a **404** e `/uploads/<chave>` responde 404 — a medição não deixou rastro |

**O que continua fora, e o que este PR mudou na fila**

- **O teto não é regra de servidor.** Ele fica onde o campo de imagem o põe — no painel, antes de subir. Uma
  regra no `/admin/uploads` valeria para **toda** a loja, inclusive para a foto de produto do painel
  nativo, que tem outro dono.
- **O anexo não entra no `<sitemap>`** (não é página) nem no SEO da página (não é o texto que a busca lê).
  Ele é o **complemento** — e é isso que a LGPD pede: o texto acessível **e** o aviso assinado ao lado.
- **O PR4 (o FAQ)** é o próximo da fila: `prose` e `faq` são o par de 14.6.2, e o `faq` reusa este parser e
  os mesmos campos `markdown`, trocando só o `<details>/<summary>` do render.

**O que este PR mudou na fila:** com o anexo no ar, a **decisão 9** deixa de ser pergunta de cronograma — o
campo existe, e subir o PDF é conteúdo. O **PR5** (a lista de destinos no CRM) segue sendo o que fecha a
causa-raiz do doc 13.

---

## 14.19 O PR4 executado: as perguntas frequentes (2026-10-09)

O **PR4** de 14.13 era o tipo `faq` e o render (`<details>/<summary>`) — a última peça da F2 e a que
**fecha o par** anunciado em 14.6.2: `prose` e `faq` são os dois tipos que só existem em página, e a
resposta de cada pergunta reusa o parser, o campo `markdown` e a barra de marcas que o PR3 trouxe. É por
isso que ele vem **depois** do `prose` e não junto: o que o PR4 estreia não é um formato, é uma forma de
leitura.

Não havia decisão pendente para ele. O PR4 não reabre a **4** (Contato é `prose` + `mailto:`/`tel:` até
doer), não toca a **7** (a copy segue sendo do negócio: o padrão da seção nova é vazio e a página vazia
responde 404) e não precisa de PR de dependência — a barra de marcas do PR3 já tinha respondido a **8**.
O que 14.13 exigia e foi cumprido: **PR3 e PR4 não entram juntos** (cada tipo novo mexe na mesma lista de
lugares e no `SCHEMA_VERSION`; dois bumps no mesmo commit esconderiam qual deles quebrou a tolerância da
loja).

| Arquivo | O que entrou |
| :--- | :--- |
| `packages/contrato/src/contract.ts` | o tipo `faq` em `SECTION_TYPES` ("Perguntas frequentes" em `SECTION_TYPE_LABELS`), `FaqSection`/`FaqItem` no bloco compartilhado e no `HomeSection`, e o `list:faqItem` em `ITEM_FIELDS` (`question` `text` + `answer` `markdown`) |
| `packages/contrato/src/defaults.ts` | o padrão da seção nova (14.6.2): título vazio e **um** item em branco — o formulário pronto para escrever |
| `packages/contrato/src/schema.ts` | `SCHEMA_VERSION` **12 → 13**, com o bloco da v13 explicando que não há campo de tipo novo |
| `frontend/src/modules/content/faq.tsx` | o render: `<details>/<summary>` nativo, o par completo e o recuo da resposta |
| `frontend/src/modules/content/render-section.tsx` | o ramo `faq` no registro de blocos (é o `assertNever` que cobra o ramo) |
| `frontend/src/lib/content/page-seo.ts` | o `faq` entra no conjunto dos que **abrem** a página — ver "uma correção ao desenho" abaixo |
| `frontend/src/styles/brand.css` | a família `.rv-faq-*`: a mesma coluna de 68ch do `prose`, o fio entre as perguntas e o recuo da resposta |
| `backend/.../wiring.unit.spec.ts` | a guarda do PR3b passa a valer para **o par**: campos do `prose` **e** do `faq` ⇔ o que a página lê, nos dois sentidos |
| as specs de dado | `faq.spec.tsx` (novo), e o que os tipos novos arrastam em `defaults` (a lista de exceções da vitrine) e em `contract` (o item ⇔ o tipo `FaqItem`) |

**O CRM não precisou de uma linha — e isso é o resultado, não a sorte.** O aviso de 14.6.2 ("cada tipo novo
não é um componente") vale para a lista de nove lugares, e o painel não é um deles desde a R2: o editor
desenha `list:${string}` num ramo genérico, alimentado pelo `itemFields` que chega no payload, e o campo
`markdown` já existia do PR3. O que **prova** que não há buraco é a declaração de exaustividade do painel
(`HandledKind`/`UNHANDLED_KINDS`): um `kind` novo sem ramo é erro de `tsc` com o nome do `kind` na
mensagem, e o `make types` está verde. A contrapartida é honesta e está medida: **o item pode carregar
chave que o contrato não declara** (a validação da API confere as chaves do **topo** do `data`, não as de
dentro do item) — é limite anterior a este PR, e o efeito é o mesmo da imagem: a loja ignora o que não lê.

**As decisões do render.**

- **`<details>`/`<summary>` nativo, e não um acordeão.** É a decisão que o tipo existe para tomar, e ela é
  medida em três frentes: o `<summary>` já é focável e o Enter abre (**teclado sem `aria-expanded`**), não
  há JavaScript nenhum (nem estado, nem efeito, nem listener), e a resposta **está no HTML** com o item
  fechado — para o buscador, para o leitor de tela e para o `Ctrl+F` (medido: `0` ocorrências de
  `<details open` e as quatro respostas no documento).
- **A pergunta é `text` e a resposta é `markdown`** — a assimetria é declarada no tipo. A pergunta é a linha
  que a cliente lê para escolher o que abrir; a resposta é o texto longo, e passa por `renderInline`, o
  mesmo parser do `prose`. Medido: `**` digitado na pergunta sai literal, e na resposta vira `<strong>`.
- **Só o par completo desenha.** Pergunta em branco é um `<summary>` que não diz o que abre; resposta em
  branco é pior — o botão abre e não mostra nada, e quem clicasse concluiria que a página está quebrada. O
  item recém-criado no CRM nasce com os dois campos vazios, e a seção que só tem ele devolve `null` (a
  página vazia segue respondendo 404, critério 3 de 14.11).
- **A seção não tem trilho de aparência**, como o `prose`: a página segue o tema da loja inteira, e quem dá
  cor e fonte ao título e ao texto são as classes `.rv-section-*` (critério 10 de 14.11).

### Uma correção ao desenho, e dois limites declarados

- **O `faq` passa a nomear a página.** É a única mudança fora do par `contrato`+`render`, e ela é
  pequena: `page-seo.ts` já tinha um conjunto de tipos que **abrem** uma página (`editorial`, `banner`,
  `prose`), e o `faq` entrou nele. Sem isso, `/perguntas-frequentes` sairia na busca como "Perguntas
  frequentes" (o `label` da superfície) mesmo com o lojista tendo escrito um título — e o `<h2>` da página
  diria outra coisa. Como o PR4 é o **último** tipo da F2, foi a hora de fechar essa ponta; medido:
  `<title>Dúvidas sobre o seu tamanho | Real Valor</title>`.
- ⚠️ **A resposta não é a descrição da página.** A descrição do `pageSeo` continua vindo do `editorial` ou
  do primeiro parágrafo do `prose`: fora do par pergunta ⇔ resposta, uma resposta é uma frase solta sobre
  um assunto qualquer. Medido: a página serve o `<meta name="description">` **do layout** ("A alfaiataria
  que valoriza você…") quando não há `prose` — o comportamento de "o `<meta>` que não existe deixa o
  layout falar", e não uma frase inventada a partir da resposta.
- **A dica da superfície estava velha, e foi corrigida.** O texto que o CRM mostra em
  `perguntas-frequentes` dizia *"o bloco de perguntas e respostas é o da fase seguinte"* — verdade no PR1,
  mentira a partir deste PR. A dica passou a descrever o presente ("as dúvidas em pares de pergunta e
  resposta, abertos no clique"), e o registro foi regravado com `make seed-schema`. Texto que envelhece é
  defeito, mesmo quando ninguém quebra.

### Medido na stack local (loja `:8000`, backend `:9000`)

| Medição | Resultado |
| :--- | :--- |
| `make types` / `make test` | **0** / verde: backend **409** (2 novos), CRM **81**, loja **408** (12 novos — 9 do `faq.spec`, 3 do `page-seo`) |
| `make check` / `make check-schema` | **0** / **0** — *"Registro do schema em dia (chave \"content\", versão 13)"* |
| `make seed-schema` | *"Schema gravado (chave \"content\", versão 13, 14 tipo(s) de seção). Era v12."* |
| `make build-admin` / `make seed` | **0** / **0** — o painel compila sem uma linha nova nele (*"Frontend build completed successfully"*), e o `seed` é idempotente: *"Já existem 0 seção(ões) em \"perguntas-frequentes\" — nenhuma faltando. Nada foi alterado."* |
| o payload do CRM (`GET /admin/content?surface=perguntas-frequentes`) | `schemaVersion: 13`, `schemaSource: db`; `faq` em `types`; `typeLabels.faq` = "Perguntas frequentes"; `fields.faq` = `title`, `items`; `itemFields["list:faqItem"]` = `question` (texto simples), `answer` (`markdown`); `markdownMarks` com as **4** marcas do PR3; e `faq` na lista de tipos que a aba da página oferece |
| `POST /admin/content` (o `faq` com cinco itens) | **201**, e o `data` no Postgres guarda a **string crua** (`Você tem **30 dias** para trocar…`), nunca HTML |
| `/br/perguntas-frequentes` com o `faq` publicado | **200** — 404 → 200, como a régua de 14.16 |
| o HTML servido | **4** `<details class="rv-faq-item">` e **4** `<summary>` para **5** itens: o item sem resposta não é desenhado. **0** `<details open` — e as quatro respostas estão no documento (a indexação que o tipo existe para garantir) |
| as marcas na resposta | `<strong>30 dias</strong>`, `<em>atendimento</em>`, `<s>O frete é grátis</s>` e `<a href="/rastreio">rastreio</a>` — o mesmo parser do `prose` |
| o texto cru | `<script>alert(1)</script>` sai **escapado** (a sequência crua não existe no documento), `[clique](javascript:alert(1))` sai **literal**, `__negrito__` sai literal e `[catálogo](/store)` vira `<a href="/store">` — sem HTML no banco e sem `dangerouslySetInnerHTML` |
| a pergunta com marca | `**mesmo**` na pergunta sai **literal**: o campo é `text`, e o que a loja não desenha ela não esconde |
| o `<title>` da página | `<title>Dúvidas sobre o seu tamanho | Real Valor</title>` — o `faq` nomeou a página (o `title` da seção, não o `label`) |
| as guardas do registro | campo desconhecido no **topo** do `data` → **400** *"Campo desconhecido para \"faq\": \"documentUrl\"."*; tipo fora do registro → **400** com a lista dos **14** tipos. ⚠️ chave **dentro** de um item passa (limite declarado acima) |
| a seção removida no fim da medição | **200** no `DELETE` das duas, **0** linhas `faq` no Postgres, e a página volta a **404** — a medição não deixou rastro |
| a vitrine não mudou (critério 10 de 14.11, medido de novo) | `/br` com **25** `href` distintos e `/br/store` com **30** `href=` — antes e depois —, e **nenhum** `rv-faq` na home: o `faq` só aparece em página |

**O que continua fora, e o que este PR mudou na fila**

- **O `faq` não entra no padrão da vitrine** — como o `prose`. A lista de exceções do
  `defaults.unit.spec.ts` passou a ser explícita com os dois (`["prose", "faq"]`): um tipo novo entra ali de
  propósito, e entrar por engano faria dele um bloco de fábrica da home.
- **Não há contagem de itens nem paginação.** A FAQ é uma lista curta (uma dúvida é uma dúvida); se ela
  crescer a ponto de precisar de índice, o gatilho é de conteúdo, não de código.
- **O PR5 (a lista de destinos no CRM) é o próximo da fila** — e ele não depende de nada disto: é o que
  fecha a causa-raiz do doc 13 (nove botões apontando para `/store` porque o painel não oferecia
  alternativa). Depois dele vêm o PR6 (a tela "Páginas") e o PR7 (a página no índice e no 404).
- Com o PR4, **a F2 está fechada**: os dois blocos que faltavam existem, e cada um tem o render, o editor
  no CRM e a spec que prende a promessa.

