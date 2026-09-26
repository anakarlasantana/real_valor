#!/usr/bin/env node
/**
 * Vendoriza as fontes da marca Real Valor em frontend/src/app/fonts/.
 *
 * Motivo: `next/font/google` baixa o CSS da CSS API do Google durante o
 * `next build`. Resposta truncada/instável => build quebrado com
 *   TypeError: Cannot read properties of null (reading '1')
 *   at @next/font/dist/google/loader.js:122
 * (regex de extensão aplicada a uma URL sem extensão). Com os .woff2
 * versionados, `next/font/local` não faz I/O de rede no build.
 *
 * O script valida, para cada família:
 *  1. que o subset `latin` traz UM único arquivo (fonte variável);
 *  2. que o arquivo tem as tabelas `fvar` + `gvar` (é de fato variável, o que
 *     legitima `weight: "<min> <max>"` no next/font/local);
 *  3. que o md5 bate com o arquivo que o build do next/font/google gerou em
 *     .next/static/media/ (sufixo `-s.p.woff2`).
 *
 * Uso (da raiz do monorepo):  node scripts/vendor-fonts.mjs
 */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import https from "node:https"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

// User-Agent idêntico ao hardcoded em
// node_modules/next/dist/compiled/@next/font/dist/google/fetch-resource.js
// (sem isso o Google devolve formatos legados, sem extensão .woff2).
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT_ROOT = path.join(REPO_ROOT, "frontend", "src", "app", "fonts")

const FAMILIES = [
  {
    name: "Playfair Display",
    axes: "wght@400;500;600;700",
    dir: "playfair-display",
    file: "playfair-display-latin.woff2",
    md5: "6da252de0cbc8a69b5d5c2e0e3f67722", // .next/static/media/eaead17c7dbfcd5d-s.p.woff2
    ofl: "playfairdisplay",
    weight: "400 700", // mesma faixa declarada em layout.tsx
  },
  {
    name: "Montserrat",
    axes: "wght@300;400;500;600;700",
    dir: "montserrat",
    file: "montserrat-latin.woff2",
    md5: "c154477b9affa3a0a47f894c8b80c03c", // .next/static/media/904be59b21bd51cb-s.p.woff2
    ofl: "montserrat",
    weight: "300 700",
  },
  {
    name: "Allura",
    axes: "wght@400",
    dir: "allura",
    file: "allura-latin.woff2",
    md5: "d8b5ed6f46f811fbbdea2d41002eb003", // .next/static/media/a736042c9ebfac04-s.p.woff2
    ofl: "allura",
    weight: "400", // Allura NÃO é variável: instância estática única
  },
]

// fontkit já vem compilado dentro do next (@next/font usa para métricas); é a
// fonte da verdade sobre eixos variáveis — evita parser WOFF2 caseiro.
const require = createRequire(`${REPO_ROOT}/frontend/`)
const fontkit = require("next/dist/compiled/@next/font/dist/fontkit").default

/**
 * Confere com o fontkit (mesmo parser que o @next/font usa para métricas) se a
 * declaração `weight` de layout.tsx é compatível com o binário:
 *  - faixa "min max"  => a fonte precisa ter o eixo wght cobrindo a faixa;
 *  - peso único "400" => instância estática 400, sem eixos variáveis.
 * Devolve a descrição do eixo para o relatório.
 */
function assertWeightMatchesFile(buf, weight) {
  const font = fontkit(buf)
  const axes = font.variationAxes || {}
  const wght = axes.wght

  if (weight.includes(" ")) {
    const [min, max] = weight.split(" ").map(Number)
    if (!wght) {
      throw new Error(`weight "${weight}" (faixa) mas o arquivo não é variável`)
    }
    if (wght.min > min || wght.max < max) {
      throw new Error(
        `weight "${weight}" fora do eixo wght do arquivo (${wght.min}-${wght.max})`
      )
    }
    return `variável wght ${wght.min}-${wght.max}`
  }

  if (wght) {
    throw new Error(`weight "${weight}" (único) mas o arquivo é variável`)
  }
  const usWeightClass = font["OS/2"]?.usWeightClass
  if (usWeightClass !== Number(weight)) {
    throw new Error(
      `weight "${weight}" != usWeightClass ${usWeightClass} da instância estática`
    )
  }
  return `estática ${weight}`
}

const md5 = (buf) => crypto.createHash("md5").update(buf).digest("hex")

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode} em ${url}`))
          return
        }
        const chunks = []
        res.on("data", (c) => chunks.push(Buffer.from(c)))
        res.on("end", () => resolve(Buffer.concat(chunks)))
      })
      .on("error", reject)
  })
}

const report = []

for (const family of FAMILIES) {
  const cssUrl =
    `https://fonts.googleapis.com/css2?family=${family.name.replace(/ /g, "+")}` +
    `:${family.axes}&display=swap`
  const css = (await get(cssUrl)).toString("utf8")

  // Cada @font-face vem precedido do comentário do subset (/* latin */ ...).
  const blocks = [
    ...css.matchAll(/\/\*\s*([a-zA-Z0-9-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g),
  ]
  let latin = blocks.filter(([, subset]) => subset === "latin")
  if (latin.length === 0) {
    latin = blocks.filter(([, , body]) => /U\+0000-00FF/.test(body))
  }
  if (latin.length === 0) throw new Error(`subset latin ausente em ${cssUrl}`)

  const urls = [...new Set(latin.map(([, , body]) => /url\(([^)]+)\)/.exec(body)[1]))]
  if (urls.length !== 1) {
    throw new Error(
      `${family.name}: ${urls.length} arquivos para o subset latin (esperado 1) — ` +
        `não é fonte variável; revisar o weight em layout.tsx`
    )
  }

  const buf = await get(urls[0])
  const shape = assertWeightMatchesFile(buf, family.weight)

  const got = md5(buf)
  if (got !== family.md5) {
    throw new Error(`${family.name}: md5 ${got} != esperado ${family.md5}`)
  }

  const dir = path.join(OUT_ROOT, family.dir)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, family.file), buf)
  fs.writeFileSync(
    path.join(dir, "OFL.txt"),
    await get(
      `https://raw.githubusercontent.com/google/fonts/main/ofl/${family.ofl}/OFL.txt`
    )
  )

  report.push({
    familia: family.name,
    pesosNoCss: latin
      .map(([, , b]) => /font-weight:\s*([^;]+);/.exec(b)[1])
      .join(","),
    arquivo: path.relative(REPO_ROOT, path.join(dir, family.file)),
    bytes: buf.length,
    tipo: shape,
    weightLayout: family.weight,
    md5: got,
    md5Confere: "SIM",
  })
}

console.log(JSON.stringify(report, null, 2))
console.log("OK: fontes vendorizadas, tipo conferido pelo fontkit e md5 conferido.")
