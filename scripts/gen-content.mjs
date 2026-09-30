/**
 * Gerador do que **deriva** do contrato de conteúdo.
 * -----------------------------------------------------------------
 * O contrato é um pacote desde o G5 (`packages/contrato/src/`, importado como
 * `@rv/contrato` pelo backend, pelo CRM e pelo storefront): a cópia gerada do
 * storefront (`frontend/src/lib/content/contract.generated.ts`) morreu, e com
 * ela o fatiador do "bloco compartilhado" que existia aqui.
 *
 * O que sobra é o que o contrato **origina** e não é código:
 *
 *   1. `frontend/themes/<id>/theme.json` — o **seed** do tema: o padrão e as
 *      estações de `themes.ts` (`THEME_FILES`), um arquivo por tema. É o
 *      bootstrap do tema no banco — a R4 semeia a mesma lista em
 *      `content_section` (`THEME_SECTIONS`) e, desde a R5, é de lá que a loja
 *      lê;
 *   2. `frontend/src/styles/tokens.generated.css` — os tokens da paleta
 *      (`--rv-*`), o fallback que o `brand.css` tinha digitado à mão.
 *
 * Os dois são versionados de propósito: a revisão de um contrato novo mostra
 * exatamente o que o storefront passa a receber. O `--check` roda no
 * `make check` e no hook de commit, para nenhum deles envelhecer em silêncio.
 *
 * Rode:
 *   node scripts/gen-content.mjs          # regrava os artefatos
 *   node scripts/gen-content.mjs --check  # exit 1 se algum estiver velho
 *
 * Como a guarda de contrato, não usa framework de teste: roda no Node 24,
 * que carrega TypeScript nativamente.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { loadExport } from "./lib/load-export.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

/**
 * A fonte do contrato — um pacote desde o G5 (`packages/contrato/src/`). O que
 * este gerador escreve é o que **deriva** dele e não é código: o seed do tema
 * (um `theme.json` por tema, em `frontend/themes/`) e os tokens que o
 * `brand.css` importa.
 */
const CONTRACT = join(root, "packages/contrato/src/contract.ts")
/** O padrão e as estações — a fonte dos `theme.json`. */
const THEMES = join(root, "backend/src/modules/content/themes.ts")
/** Onde os `theme.json` são escritos: um diretório por tema. */
const THEMES_DIR = join(root, "frontend/themes")
/** Os tokens da paleta, que o `brand.css` importa. */
const TOKENS_CSS = join(root, "frontend/src/styles/tokens.generated.css")

/**
 * O `theme.json` de um tema, no formato que a loja lê (`ThemeFile`).
 *
 * `JSON.stringify(…, null, 2)` verbatim, com a chave final e a ordem das
 * chaves da declaração: o arquivo já era escrito assim, e a comparação byte a
 * byte é o que prova que a fase trocou só a **origem** do dado — o storefront
 * não muda de comportamento nenhum.
 */
function buildThemeFile(theme) {
  return `${JSON.stringify(theme, null, 2)}\n`
}

const TOKENS_HEADER = `/*
 * Real Valor — Tokens do tema (GERADO — NÃO EDITE À MÃO)
 * -----------------------------------------------------------------
 * A paleta do tema padrão, gerada de \`THEME_COLOR_HEXES\`
 * (\`backend/src/modules/content/contract.ts\`) por \`node scripts/gen-content.mjs\`
 * — a mesma origem dos \`theme.json\` de \`frontend/themes/\`. Contrato novo é:
 * editar o contrato, rodar o gerador, commitar o diff. O \`make check\` e o
 * hook de commit reprovam este arquivo fora de sincronia.
 *
 * Estes tokens são o **fallback** da loja: \`themeToCSSVariables\`
 * (\`frontend/src/lib/theme.ts\`) reescreve os mesmos \`--rv-*\` inline no
 * \`<html>\`, por requisição, com a paleta da estação que estiver no ar — o que
 * fica aqui é o que a página pinta antes disso.
 *
 * O resto do \`brand.css\` — tokens derivados, semânticos, tipografia, forma,
 * movimento e as classes \`.rv-section-*\` — continua lá: é decisão de design,
 * não dado de tema, e nenhuma estação troca esses valores.
 */`

/** Os tokens da paleta, como o `brand.css` os declarava à mão. */
function buildTokensCss(tokens, hexes) {
  const declarations = tokens
    .map((token) => `  --rv-${token}: ${hexes[token]};`)
    .join("\n")

  return `${TOKENS_HEADER}

:root,
:root[data-theme="default"] {
  /* --- Paleta principal (do contrato) --- */
${declarations}
}
`
}

/**
 * Todos os artefatos, com o conteúdo que deveriam ter agora.
 *
 * O tema vem pronto de `themes.ts` (`THEME_FILES`): a fusão entre as estações e
 * a paleta/fontes do contrato acontece **lá**, no módulo dono das duas metades,
 * e não aqui. É o mesmo objeto que o seed do banco grava (`THEME_SECTIONS`,
 * R4), então o `theme.json` e a linha de `content_section` não podem divergir
 * por esquecimento. Este script só serializa o que recebe — é o que faz do
 * `theme.json` um artefato gerado em vez de uma quarta cópia da paleta.
 */
function buildArtifacts() {
  const themes = loadExport(THEMES, "THEME_FILES")
  const tokens = loadExport(CONTRACT, "THEME_COLOR_TOKENS")
  const hexes = loadExport(CONTRACT, "THEME_COLOR_HEXES")

  return [
    ...themes.map((theme) => ({
      path: join(THEMES_DIR, theme.id, "theme.json"),
      content: buildThemeFile(theme),
    })),
    { path: TOKENS_CSS, content: buildTokensCss(tokens, hexes) },
  ]
}

const artifacts = buildArtifacts()

if (process.argv.includes("--check")) {
  const stale = artifacts.filter(
    ({ path, content }) =>
      (existsSync(path) ? readFileSync(path, "utf8") : "") !== content
  )

  if (stale.length === 0) {
    console.log(`${artifacts.length} artefatos gerados em dia.`)
    process.exit(0)
  }

  console.error(
    "Artefato(s) gerado(s) desatualizado(s) (ou ausente(s)):\n" +
      stale.map(({ path }) => `  ${relative(root, path)}`).join("\n") +
      "\nRode: node scripts/gen-content.mjs"
  )
  process.exit(1)
}

for (const { path, content } of artifacts) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  console.log(
    `Gerado ${relative(root, path)} (${content.split("\n").length - 1} linhas).`
  )
}
