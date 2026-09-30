# `themes/` — o seed do tema da loja

**Os arquivos desta pasta são GERADOS. Não edite à mão.**

Um `theme.json` por tema. O `default` traz a paleta e as fontes inteiras; cada
estação traz só o que troca (o Natal troca três cores) — o que não vem no arquivo
é herdado do `default` pelo `normalizeTheme` de `src/lib/theme.ts`.

| Onde está a origem | O que sai dela |
| --- | --- |
| `backend/src/modules/content/themes.ts` (`THEME_FILES`: o rótulo, a janela `MM-DD` e o que cada estação troca, já fundidos com `THEME_COLOR_HEXES`/`THEME_FONTS` do `contract.ts`) | estes `theme.json` **e** as linhas de `content_section` da superfície `theme` (`THEME_SECTIONS`, o seed do banco) |
| `THEME_COLOR_HEXES` do `contract.ts` | os tokens `--rv-*` de `src/styles/tokens.generated.css` |

Mudar o contrato é: editar `contract.ts` ou `themes.ts`, rodar `make gen`,
commitar o diff e semear (`make seed`) — os `theme.json` e as linhas do banco
saem da **mesma** lista, então não há duas verdades para manter. O `--check` do
gerador roda no `make check` e no hook de commit, então um arquivo fora de
sincronia reprova — e um **diretório** que o contrato não conhece também.

**Desde a R5 a loja não lê esta pasta.** O tema ativo vem do payload
(`GET /store/content?surface=theme`, em `src/lib/data/theme.ts`), como o resto do
conteúdo: é linha de `content_section`, editável no CRM, e uma gravação lá
invalida o cache da loja pela mesma tag (`content`). O único uso desta pasta em
runtime **de produção** é indireto: o `src/lib/theme.ts` importa o
`themes/default/theme.json` como **fallback embutido** (o JSON entra no bundle do
build), para quando a API de conteúdo falhar. Por isso ela não é mais copiada
para a imagem — quem precisa dela é o **build** (e o `next dev`, que resolve o
import a cada compilação).

Na prática: **quem muda a paleta da loja no dia a dia é o CRM** (aba *Tema da
loja*). Estes arquivos são o seed versionado — o que a revisão de um contrato
novo mostra — e o fallback.

O plano (e o que a R3-lite/R4/R5 mediram) está em
[`docs/plano-centralizacao.md`](../../../docs/plano-centralizacao.md).
