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

Ele compara `SECTION_TYPES`, cada `SECTION_FIELDS` e valida que
`defaults.ts` cobre todos os tipos, que o `nav` do seed casa com o
fallback do storefront e que o editor do admin
(`backend/src/admin/routes/content/field-input.tsx`) sabe desenhar todo
tipo de lista, com as mesmas chaves de ícone do storefront. **Rode isto
depois de qualquer alteração no contrato.**

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
