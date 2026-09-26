# Fontes do editor de conteúdo (cópia do storefront)

Estes três `.woff2` são **cópias** dos que o storefront self-hospeda em
`frontend/src/app/fonts/` — os mesmos bytes, um arquivo por família:

| Arquivo | Família | md5 |
| --- | --- | --- |
| `playfair-display-latin.woff2` | Playfair Display | `6da252de0cbc8a69b5d5c2e0e3f67722` |
| `montserrat-latin.woff2` | Montserrat | `c154477b9affa3a0a47f894c8b80c03c` |
| `allura-latin.woff2` | Allura | `d8b5ed6f46f811fbbdea2d41002eb003` |

`OFL-*.txt` são as licenças (SIL Open Font License 1.1) que vêm junto de cada
arquivo no diretório do storefront.

## Por que existem aqui

O `<select>` de fonte do editor desenha cada opção **na própria fonte** — é o
que faz "Títulos (Playfair Display)" parecer um título. O painel roda no
navegador do lojista, e Playfair Display, Montserrat e Allura não são fontes de
sistema: sem arquivo, a prévia cairia em Times New Roman e o recurso não
existiria.

O admin é um pacote separado (não importa nada de `frontend/`), então a única
forma de o navegador do painel ter os arquivos é uma cópia local, declarada por
`@font-face` em `appearance.css` com `url("./fonts/…")`. Não há requisição a
`fonts.gstatic.com` em lugar nenhum — é a mesma razão pela qual o storefront
self-hospeda (`frontend/src/app/fonts/README.md`).

## Se a fonte do storefront mudar

Recopie o `.woff2` e o `OFL.txt` correspondentes de
`frontend/src/app/fonts/<família>/` para cá e rode
`node scripts/check-contract-parity.mjs`. A guarda compara o md5 dos dois lados
e a família declarada em `THEME_FONTS` (`contract.ts`) com o `theme.json` do
storefront: prévia com arquivo diferente do da loja é prévia que mente.

O arquivo em si é estático (subset `latin`, um por família, com a faixa de
pesos inteira no caso das duas variáveis) — não há passo de build nem download.
