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
`defaults.ts` cobre todos os tipos. **Rode isto depois de qualquer
alteração no contrato.**

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

A página fica em **Configurações → Conteúdo da vitrine**
(`src/admin/routes/settings/content/`), porque os diretórios do admin
seguem a convenção de agrupamento (settings, orders, products,
customers, categories, price-lists).

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
