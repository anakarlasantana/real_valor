# `themes/` — o seed do tema da loja

**Os arquivos desta pasta são GERADOS. Não edite à mão.**

Um `theme.json` por tema. O `default` traz a paleta e as fontes inteiras; cada
estação traz só o que troca (o Natal troca três cores) — o que não vem no arquivo
é herdado do `default` pelo `normalizeTheme` de `src/lib/theme.ts`.

| Onde está a origem | O que sai dela |
| --- | --- |
| `backend/src/modules/content/themes.ts` (rótulo, janela `MM-DD` e o que cada estação troca) + `THEME_COLOR_HEXES`/`THEME_FONTS` do `contract.ts` (a paleta e as famílias do padrão) | estes `theme.json` |
| `THEME_COLOR_HEXES` do `contract.ts` | os tokens `--rv-*` de `src/styles/tokens.generated.css` |

Mudar o tema é: editar o contrato ou `themes.ts`, rodar `make gen` e commitar o
diff. O `--check` do gerador roda no `make check` e no hook de commit, então um
arquivo fora de sincronia reprova — e um **diretório** que o contrato não conhece
também (é um tema que só a loja resolve, sem aparecer em lugar nenhum).

A partir da R4 estas estações viram linhas de `content_section` na superfície
`theme` (o seed no banco) e a R5 faz a loja ler o payload, quando a leitura de
disco em `src/lib/theme.ts` sai. O plano está em
[`docs/plano-centralizacao.md`](../../../docs/plano-centralizacao.md).
