# Módulo de conteúdo (CMS da vitrine)

Guarda as seções editáveis da vitrine. É o que permite ao lojista mudar
texto, imagem, ordem e visibilidade da home sem deploy.

## Peças

| Arquivo | Papel |
| --- | --- |
| `models/content-block.ts` | Tabela `content_block` (uma linha por seção) |
| `service.ts` | `listSections()` — devolve as seções já achatadas |
| `contract.ts` | **Fonte da verdade** do formato do conteúdo |
| `defaults.ts` | Cópia do protótipo, usada pelo seed e como fallback |
| `migrations/` | Geradas com `medusa db:generate content` |

## Por que uma tabela só, com `data` em JSON

A árvore de conteúdo é heterogênea: `hero` tem `headlineEmphasis` e
`overlay`, `benefits` tem uma lista de itens, `instagram` tem uma lista
de imagens. Um schema relacional daria 7 tabelas e 7 migrations, e o
admin teria 7 telas.

Aqui as colunas que se filtram e ordenam (`surface`, `type`, `enabled`,
`position`) ficam indexáveis e o resto — que é só payload — vive em
`data`. Isso **não** afrouxa a tipagem: `data` é validado contra o
contrato na entrada e na saída da API.

Como o `type` não é um `enum` no banco, adicionar um tipo novo de seção
é só código, sem migration.

## O contrato vive em dois lugares

Backend e frontend são pacotes npm separados, com `node_modules`
separados — não há como importar um do outro sem publicar um pacote
compartilhado. Então o contrato é espelhado:

```
backend/src/modules/content/contract.ts      <- fonte da verdade
frontend/src/lib/content/home-sections.ts    <- espelho
```

Um teste de paridade trava a divergência:

```bash
node scripts/check-contract-parity.mjs
```

Ele compara `SECTION_TYPES`, cada `SECTION_FIELDS` — campo por campo, inclusive
`required`, `options`, `optionLabels` e `group` — e valida que
`defaults.ts` cobre todos os tipos, que o `nav` e o `footer` do seed
casam com os fallbacks do storefront e que o editor do admin
(`backend/src/admin/routes/content/field-input.tsx`) sabe desenhar todo
tipo de lista, com as mesmas chaves de ícone do storefront — inclusive
as redes sociais, cujo registro é próprio (`social-icons.tsx`). No rodapé
ele desce um nível: os campos do item de coluna têm que ser os do tipo
`FooterColumn`, as origens oferecidas no `<select>` têm que ser as de
`FOOTER_COLUMN_SOURCES` e toda origem precisa de um ramo em
`footer-column/index.tsx` — senão o lojista escolhe no admin uma coluna que
a loja não desenha. **Rode isto depois de qualquer alteração no contrato.**

Desde a aparência por seção ele também confere a ponte com o CSS, que é onde
um campo novo se perderia em silêncio: as listas de cores e de fontes nos
dois arquivos, cada campo `appearance*` lido pelo storefront (e nenhum campo
lido que o contrato não declare), cada variável `--rv-section-*` escrita
consumida por um `var()` no `brand.css`, e cada classe `.rv-section-*`
definida sendo usada — e vice-versa (ver *Aparência por seção*).

E o editor, que é o outro lugar onde a aparência se perde: cada trilho tem de
estar **logo abaixo** do campo que ele veste (o `attachedTo` conferido contra a
ordem do array), as opções de cor e de fonte têm de ser a paleta e os papéis
na ordem do contrato, o `FieldSpec` espelhado no admin tem de conhecer o
`attachedTo`, o `GET /admin/content` tem de mandar `palette`/`fonts`/
`darkTokens`, e cada família declarada precisa existir como `@font-face` em
`backend/src/admin/routes/content/appearance.css` apontando para um `.woff2`
com o **mesmo md5** do storefront. As duas últimas são as que nenhuma revisão
manual pegaria: sem elas a bolinha sai sem cor e a prévia de fonte cai no
fallback do navegador, e a página continua "funcionando".

## Regras de layout

A quantidade de itens de uma lista é decisão do lojista, não do código. Toda
seção que consome um `list:*` precisa continuar íntegra com 1, 2 ou 7 itens —
por isso **nenhuma delas fixa colunas** (`grid-cols-4`). Foi assim que a faixa
de benefícios quebrava: com três itens, três das quatro colunas ficavam
ocupadas e a faixa terminava com um quarto vazio de sobra; com cinco, o quinto
item caía numa segunda linha sem divisórias.

A `benefits` é a referência: uma linha flex que quebra sozinha, com `basis`
sensível à largura (2 por linha no celular, `11rem` no desktop) e `grow`, de
modo que a última linha **sempre se preenche** — no desktop cabem 5 a 7 itens
por linha (conforme a largura) e o item que sobra vira uma linha inteira, sem
buraco. As divisórias são o `gap` de 1px do container deixando o fundo
(`rv-border`) aparecer: isso mantém o fio correto nos **dois** eixos depois da
quebra, o que `divide-x`/`divide-y` não faz (eles só acertam em linha única).

Só a contagem exata de colunas por breakpoint seria motivo para partir para
classes por quantidade; até agora nenhuma seção precisou disso.

## Âncoras do menu (`#`)

Um item do menu com `href` começando em `/#` é uma âncora: `/#editorial` significa "role até o
elemento de `id="editorial"`". Quem embrulha cada seção da home nesse `id` é o registro em
`frontend/src/app/[countryCode]/(main)/page.tsx` (`div[id={section.id}]`), e a classe
`.rv-anchor` de `frontend/src/styles/brand.css` guarda os 5rem do cabeçalho fixo (`h-20`) para o
topo da seção não nascer escondido atrás dele — a barra de anúncio não é sticky, então 5rem é o
offset completo.

Consequências práticas:

- **O `id` é a chave da seção no banco, não o nome que ela mostra na loja.** A seção `editorial`
  aparece como **Sobre** no admin porque "Sobre" é o nome do item de menu que aponta para ela.
  Renomear o `id` é migration de dados e quebra todo `/#id` que aponte para o bloco.
- Âncora é gerada **para toda seção**, de qualquer tipo, a partir de `section.id` — uma seção nova
  já nasce endereçável, sem código por componente. Seções sem corpo (`announcement`, `nav` e
  `featured` sem região) não viram âncora vazia.
- O `href` guardado no CMS é `/#editorial`, sem país; quem prefixa `/{país}` é o `nav-link` na
  renderização. Já na home o clique é interceptado e rola suave (`scrollIntoView`); vindo de outra
  rota o navegador recarrega já no fragmento.

## Aparência por seção (`appearance*`)

Cada seção pode vestir as cores e as fontes **do tema** sem sair do CRM. Os
campos moram no mesmo `data` das outras seções e começam com `appearance`; a
primeira opção é sempre a vazia — "Padrão do tema da loja":

| Campo | `kind` | O que muda na loja |
| --- | --- | --- |
| `appearanceHeadingFont` | `font` | a família dos títulos |
| `appearanceTextFont` | `font` | a família dos textos |
| `appearanceHeadingColor` | `color` | a cor dos títulos |
| `appearanceTextColor` | `color` | a cor dos textos secundários |
| `appearanceAccentColor` | `color` | a cor dos detalhes (eyebrow, ícones, frase manuscrita, realces, botões e links) |
| `appearanceBackgroundColor` | `color` | a cor de fundo do bloco |

`color` e `font` são `select` com desenho próprio: no painel, a cor sai como
**bolinha** (com o nome do papel no tooltip) e a fonte como **lista com
prévia**, cada opção desenhada na própria família. O valor gravado é o mesmo
de sempre — uma string de `options` — e o `validateData` da rota admin
reprova o que estiver fora da lista exatamente como fazia com `select`.

Os valores são os **papéis do tema**: as 6 cores do guia de marca (`rose`,
`offwhite`, `cacao`, `grafite`, `preto`, `dourado`) e os 3 papéis de fonte
(`display`, `sans`, `script`), declarados uma vez em `THEME_COLOR_TOKENS` /
`FONT_ROLES` e espelhados no storefront. **Não há cor livre** (hex): ela
venceria o tema sazonal, e o pedido era uma vitrine que acompanha a estação,
não uma que briga com ela.

### Onde cada campo aparece: os trilhos

A aparência **não** é um bloco no fim do formulário. Cada campo tem um `group`
(o rótulo do trilho, um de `APPEARANCE_GROUPS`: Títulos, Textos, Detalhes,
Fundo) e um `attachedTo` (o campo de conteúdo que ele veste), e o `SECTION_FIELDS`
espalha o trilho **logo depois** desse campo. Quem escolhe a fonte do título
está com o cursor no campo "Título":

| Seção | Títulos | Textos | Detalhes | Fundo |
| --- | --- | --- | --- | --- |
| `hero` | `headline` | `subtitle` | `headlineEmphasis` (o itálico do título) | — |
| `benefits` | `items` | `items` | `items` (o ícone) | `items` |
| `collections` | `title` | `subtitle` | `eyebrow` | `items` |
| `featured` | `title` | `subtitle` | `eyebrow` | `viewAllLabel` |
| `editorial` | `title` | `body` | `script` (a frase manuscrita) | `imagePosition` |
| `instagram` | `title` | — | `handle` | `images` |
| `announcement` | — | `text` | — | `text` |
| `nav` / `footer` | — | — | — | — |

Três decisões que a tabela acima registra:

- **o `hero` não tem trilho de fundo**: o fundo dele é a fotografia;
- **a barra de anúncio não tem trilho de títulos**: é uma linha só;
- **a faixa do Instagram não tem trilho de textos**: o perfil é destaque, o
  título é título e o resto é imagem — a faixa não tem texto corrido para
  pintar. A faixa de benefícios, que também não tem título, veste os quatro
  trilhos a partir da lista de itens.

O `attachedTo` é redundante com a posição no array **de propósito**: a ordem é
o que o admin usa para montar o formulário, e o `attachedTo` é o que a guarda
de paridade cobra para essa ordem não se perder num `sort`, num agrupamento ou
num `spread` fora de lugar. Um trilho longe do campo que ele muda não quebra
nada — só deixa de fazer sentido.

**Como funciona.** O lojista escolhe o papel (`dourado`), o storefront grava
`var(--rv-dourado)` inline no wrapper da seção (`appearanceVars`, em
`frontend/src/lib/content/appearance.ts`) e as classes `.rv-section-*` do
`frontend/src/styles/brand.css` leem essas variáveis com o valor que a seção já
usava como *fallback*:

```css
.rv-section-heading-onmedia {
  color: var(--rv-section-heading-color, var(--rv-offwhite));
}
```

Duas consequências, as duas de propósito:

- **Seção sem nenhuma escolha sai idêntica ao que já era** — sem variável, o
  fallback é o token que o elemento já usava, então nada muda até alguém
  escolher. O wrapper da home (`(main)/page.tsx`) é quem escreve as variáveis,
  ou seja, um campo novo de aparência não precisa ser ligado componente por
  componente;
- **o tema sazonal continua mandando**: como a seção guarda o papel e não a cor,
  o Black Friday troca `--rv-rose` e a seção recolore junto.

**Sem migration e sem endpoint novo.** Os campos viajam dentro do `data` que já
existe, o `validateData` da rota admin já reprova valor fora da lista (400:
`Campo "appearanceHeadingColor" deve ser um de: (vazio = padrão do tema),
rose, offwhite, …`), o `GET /admin/content` já devolve os campos no `schema` (com
`group` e `attachedTo`, que é o que a página usa para montar os trilhos) e o
storefront continua lendo o mesmo payload, com o cache de 60s. Nenhum valor
gravado muda de nome, de tipo ou de lugar: o que o lojista escolheu antes está
no mesmo campo, e a loja continua aplicando o mesmo CSS.

**O que o `schema` ganhou** (`GET /admin/content`), e por quê: o painel é um
pacote separado, não importa o contrato e não lê os `theme.json` do storefront,
então precisa das prévias por uma via só:

| Chave | Conteúdo | Para que serve |
| --- | --- | --- |
| `palette` | `THEME_COLOR_HEXES` — papel → hex | pintar a bolinha de cor |
| `fonts` | `THEME_FONTS` — papel → `{ family, stack }` | pedir cada família ao navegador |
| `darkTokens` | `THEME_DARK_TOKENS` | avisar a regra do fundo escuro na hora da escolha |

As três são **cópia de leitura para desenhar**: o que pode ser gravado continua
saindo de `options`, campo a campo, e validado no servidor. A bolinha mostra a
cor do tema **padrão** (num tema de estação a da loja é outra) e a fonte é a
mesma da loja, com os arquivos `.woff2` copiados para
`backend/src/admin/routes/content/fonts/` — o navegador do painel não tem
nenhuma das três. `scripts/check-contract-parity.mjs` confere as pontas todas:
hex contra o `theme.json`, família e pilha contra o `theme.json`/`theme.ts` e
md5 dos `.woff2` contra os do storefront.

**Uma regra que não vem de campo:** escolher um fundo escuro (`preto`, `cacao` —
`THEME_DARK_TOKENS`) sem escolher a cor do texto faz o storefront escrever
`--rv-section-text-color` e `--rv-section-heading-color` em off white. Grafite
sobre preto seria ilegível, e quem quer um bloco escuro não tem por que saber
que precisa escolher o texto junto. **Escolha explícita sempre vence**: gravar
`grafite` de texto num fundo `preto` mantém grafite. Não há regra espelhada para
fundo claro porque no tema padrão todo texto de seção já é escuro — o caso que
sobra é `dourado` de fundo, e para esse há o campo *Cor dos textos*.

Como a regra é do render e não um campo, o trilho **Fundo** a avisa no momento
em que a cor escura é escolhida (é o que o `darkTokens` no `schema` permite) —
aviso que só aparece na escolha escura, porque aviso sempre escrito vira ruído.

No admin, *↺ Padrão do tema* grava a opção vazia em todos os campos **daquele
trilho** — restaurar não apaga o campo, grava a escolha que não sobrescreve
nada. É um botão por trilho, e não um só para a seção: voltar a fonte dos
títulos ao padrão não tem por que desfazer a cor de fundo escolhida.

## Rodapé (`footer`)

Como o `nav`, o rodapé é **cromo**, não seção da home: aparece em todas as rotas, quem o desenha é
o layout (`(main)/layout.tsx` → `footerSections()`) e o render da home ignora o tipo
(`case "footer": return null`). O CMS guarda só o que o lojista escreve:

| Campo | Render |
| --- | --- |
| `columns` | colunas de links — `title` + `source` + `links` — na ordem da lista |
| `social` | ícones sociais (`icon` + `label` + `href`) abaixo da marca |

A marca, a frase manuscrita e a linha de direitos continuam no JSX — são desenho, não texto de
lojista. **Não existe coluna padrão**: o rodapé nasce sem nenhuma (`columns: []` no seed e no
fallback), e a loja mostra exatamente as colunas que o lojista inserir, na ordem em que estiverem.
Inserir, editar, reordenar e remover são a mesma lista para todas elas — inclusive as de catálogo,
que não são um caso especial do layout. Não há FAQ embutida: uma coluna de "Perguntas frequentes" é
uma coluna como qualquer outra.

O que muda entre as colunas é a origem dos itens, escolhida por coluna em `source`:

| `source` | Itens |
| --- | --- |
| `links` (padrão) | os `links` digitados no admin, resolvidos pelo `nav-link` |
| `categories` | as categorias de topo do catálogo, ao vivo (`/categories/{handle}`), com as filhas aninhadas |
| `collections` | as coleções do catálogo, ao vivo (`/collections/{handle}`) |

`source` ausente ou desconhecido conta como `links` — é o que significa um registro gravado antes
desse campo, então a loja em produção não precisa de migration. O catálogo **só é buscado quando
alguma coluna aponta para ele** (`footer/index.tsx`): um rodapé de colunas digitadas não paga
requisição de categorias nem de coleções. Quem desenha cada ramo é
`frontend/src/modules/layout/components/footer-column/index.tsx`, e o script de paridade confere que
toda origem oferecida no admin tem ramo lá.

**Lista vazia esconde o bloco**: coluna sem título ou sem itens não aparece — é o que permite
publicar o rodapé antes de o catálogo existir.

**Cuidado ao mexer em `SECTION_FIELDS.footer`**: essa lista é a definição do formulário **e** o
contrato de escrita. O `GET /admin/content` devolve as specs, o formulário do admin monta o corpo do
PATCH a partir delas e o PATCH substitui o `data` inteiro pelo que veio — campo que sai da lista
some da tela **e** é apagado do banco no primeiro "Salvar". Tirar o bloco `footer` inteiro (o que já
aconteceu uma vez, na tentativa de remover a FAQ) deixava o cartão do rodapé sem nenhum campo e a
validação estourava com 500. O guard de paridade reprova os dois sintomas: `"footer" declara campos
nos dois arquivos` e `todo campo que o rodapé lê tem editor em SECTION_FIELDS.footer`.

Os `links` passam pelo mesmo `nav-link` do menu (âncora, rota interna, `https://`, `mailto:`), e
os ícones saem de `frontend/src/lib/content/social-icons.tsx`. Esse registro é separado de
`icons.ts` porque o `@medusajs/icons` não traz glifo de marca (Instagram, WhatsApp…) — e as
chaves oferecidas no admin (`list:social`) são conferidas pelo script de paridade.

## API

| Rota | Auth | Para quê |
| --- | --- | --- |
| `GET /store/content` | publishable key | Vitrine. Só seções habilitadas. `?surface=`, `?type=` |
| `GET /admin/content` | admin | Lista tudo, inclusive ocultas, + o schema dos formulários |
| `POST /admin/content` | admin | Cria. Campos obrigatórios exigidos |
| `PATCH /admin/content?id=` | admin | Edição parcial; só valida o que veio |
| `DELETE /admin/content?id=` | admin | Remove |

`GET /store/content` devolve as seções achatadas, prontas para render:

```json
{ "sections": [ { "id": "hero", "type": "hero", "enabled": true,
  "position": 20, "headline": "...", "overlay": 0.72 } ] }
```

## Admin

A página fica em **Conteúdo da vitrine**, na sidebar principal do painel
(`src/admin/routes/content/`).

Ela **não** vive em `src/admin/routes/settings/`: o dashboard classifica o item pelo
prefixo do path (`DashboardApp.populateMenus`, `path.startsWith("/settings")`), e o
que está sob `/settings` vai para as extensões da sidebar de Configurações em vez do
menu principal. Como entrada da sidebar principal, a página participa do mesmo
**personalizar layout** dos menus nativos
(`/admin/layouts/main-sidebar/configuration`).

O formulário não repete a lista de campos em React: ele lê
`schema.fields` da API, que é gerado do contrato. Adicionar um campo no
contrato já o faz aparecer no admin.

## Operação

Semear a cópia do protótipo (idempotente):

```bash
cd backend
./node_modules/.bin/medusa exec ./src/scripts/seed-content.ts
```

Recriar do zero:

```bash
./node_modules/.bin/medusa exec ./src/scripts/seed-content.ts -- --force
```

## Cache

O frontend busca com a tag `content`. A home tem `revalidate = 60`, então
uma edição aparece em até um minuto. Para forçar antes disso, chame
`revalidateTag("content")`.

## Próximo passo natural

Invalidar a tag na hora da edição. Exige o Next sendo chamado a partir
do backend, então precisa de um URL interno + segredo compartilhado.
Enquanto isso não existe, a janela de 60s é o limite.
