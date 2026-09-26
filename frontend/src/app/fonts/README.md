# Fontes self-hosted (brand Real Valor)

Estes arquivos **não** são baixados em tempo de build. Eles ficam versionados no
repositório e são consumidos por `next/font/local` em `src/app/layout.tsx`.

## Por que self-hosted

`next/font/google` resolve a tipografia com uma requisição de rede à CSS API do
Google durante o `next build` (`@next/font/google/loader.js`). Se essa resposta
vier truncada/instável, o build falha de forma crítica e pouco explicativa:

```
Failed to compile.
src/app/layout.tsx
An error occurred in `next/font`.
TypeError: Cannot read properties of null (reading '1')
    at .../@next/font/dist/google/loader.js:122:78
```

A linha 122 é `const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1]`
— sobre uma URL sem extensão reconhecida o `exec` devolve `null` e o acesso a
`[1]` estoura. O retry do loader (`retry(..., 3)`) só cobre status != 200, não
corpo incompleto com status 200, então o erro não é recuperado.

Consequências: build não reprodutível (depende de terceiro), falha intermitente
na esteira de CI/CD, e um build de container que não roda isolado da rede.
Versionando os arquivos, o `next build` fica hermético (validado com proxy
morto, ver seção "Como validar").

## Conteúdo

Subset `latin`, um arquivo por família. Playfair Display e Montserrat são
**fontes variáveis** (o arquivo cobre toda a faixa de pesos, por isso `weight` é
uma faixa em `layout.tsx`); Allura é **estática** (peso único 400):

| Família | Arquivo | Bytes | `weight` | Eixo real (fontkit) | Uso |
| --- | --- | --- | --- | --- | --- |
| Playfair Display | `playfair-display/playfair-display-latin.woff2` | 38460 | `400 700` | variável `wght 400-900` | `--font-playfair` (títulos) |
| Montserrat | `montserrat/montserrat-latin.woff2` | 35508 | `300 700` | variável `wght 100-900` | `--font-montserrat` (UI/texto) |
| Allura | `allura/allura-latin.woff2` | 26464 | `400` | estática (`usWeightClass` 400) | `--font-allura` (assinaturas) |

Pesos efetivamente usados no design system: `400` (`font-normal`), `500`
(`font-medium`) e `600` (`font-semibold`) — todos dentro das faixas acima.
`scripts/vendor-fonts.mjs` revalida essa compatibilidade a cada execução.

Cada diretório tem `OFL.txt` (SIL Open Font License 1.1, redistribuição
permitida inclusive em produto comercial).

## Procedência (auditável)

Os três arquivos são **binariamente idênticos** aos que o build bem-sucedido com
`next/font/google` gerou em `.next/static/media/` (sufixo `-s.p.woff2`, onde
`p` = preload = subset `latin` solicitado). Conferência por md5:

| Arquivo local | md5 | md5 do build (`-s.p.woff2`) |
| --- | --- | --- |
| playfair-display-latin.woff2 | `6da252de0cbc8a69b5d5c2e0e3f67722` | `eaead17c7dbfcd5d-s.p.woff2` |
| montserrat-latin.woff2 | `c154477b9affa3a0a47f894c8b80c03c` | `904be59b21bd51cb-s.p.woff2` |
| allura-latin.woff2 | `d8b5ed6f46f811fbbdea2d41002eb003` | `a736042c9ebfac04-s.p.woff2` |

Fonte: `https://fonts.googleapis.com/css2?family=<Família>:wght@<pesos>&display=swap`
com `User-Agent` de Chrome moderno (o mesmo hardcoded em
`@next/font/google/fetch-resource.js`), selecionando o bloco `/* latin */`.

## Como atualizar / re-gerar

1. Ajuste a faixa/versão desejada em `src/app/layout.tsx` e
   `FAMILIES[].axes`/`FAMILIES[].weight` em `scripts/vendor-fonts.mjs`.
2. Da raiz do monorepo: `node scripts/vendor-fonts.mjs` — baixa `.woff2` +
   `OFL.txt`, valida o `weight` contra o eixo real via fontkit e confere o md5.
3. Se a versão do Google mudar, o md5 esperado vai divergir: atualize-o no
   script **depois** de conferir visualmente o site (`make build`).
4. `make build` (frontend) e confira que o CSS emitido referencia
   `/_next/static/media/*.woff2` e não `fonts.gstatic.com`.

## Como validar (build hermético)

Com as fontes locais, `next build` não deve fazer I/O de rede para tipografia.
Teste com proxy morto — o build tem de **passar**:

```bash
cd frontend && rm -rf .next \
  && HTTP_PROXY=http://127.0.0.1:9 HTTPS_PROXY=http://127.0.0.1:9 npx next build
```

Contraprova (com `next/font/google` a mesma execução falhava em ~30s):

```
Failed to compile.
src/app/layout.tsx
`next/font` error:
Failed to fetch `Playfair Display` from Google Fonts.
```

E o CSS gerado deve apontar só para arquivos próprios:

```bash
grep -l 'fonts.gstatic.com' .next/static/css/*.css   # não deve retornar nada
grep -o '/_next/static/media/[a-z0-9]*-s\.p\.woff2' .next/static/css/*.css | sort -u
```
