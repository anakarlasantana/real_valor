/**
 * A conta do painel (`admin/.../lib/crop-window.ts`) é a do `@rv/contrato/crop`:
 * o CRM não pode importar valor do contrato, então reescreve a conta — e este
 * teste a prende, lendo o painel por texto (o `rootDir` do backend não o alcança).
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  CROP_PATTERN,
  CROP_ZOOM_MAX,
  CROP_ZOOM_MIN,
  cropFitsBox,
  cropImageStyle,
  formatCrop,
  frameBox,
  parseCrop,
} from "@rv/contrato/crop"

/** O código do painel, sem os comentários (a conta é código, não prosa). */
const painel = readFileSync(
  join(
    __dirname,
    "../../../../../admin/src/admin/routes/content/lib/crop-window.ts"
  ),
  "utf8"
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")

/** O literal de uma `const` do painel, avaliado como expressão (`/…/`, `1`). */
function literal(name: string): unknown {
  // `(export )?const NAME: Tipo = …` — o tipo fica de fora, e o valor é a
  // linha do `=` ou o regexp quebrado na linha seguinte.
  const decl = "(?:export )?const " + name + "(?::[^=\\n]+)? ="
  const value = (pattern: string) => new RegExp(pattern, "m").exec(painel)?.[1]
  const oneLine = value(decl + " (.+)$")

  if (oneLine && !oneLine.trim().endsWith("=")) {
    return new Function(`return (${oneLine})`)()
  }

  const multi = value(decl + "\\n\\s*(/.+)$")

  expect(multi).toBeDefined()

  return new Function(`return (${multi})`)()
}

const valores = [
  "center:center",
  "center:34",
  "60:center",
  "0:100:1.5",
  "50:50:2",
  "33:66:1.33",
  "center:center:3",
  "esquerda:meio",
]

describe("a conta do painel é a do contrato", () => {
  it("as constantes são as do contrato", () => {
    expect(literal("ZOOM_MIN")).toBe(CROP_ZOOM_MIN)
    expect(literal("ZOOM_MAX")).toBe(CROP_ZOOM_MAX)
    // O painel usa o regexp **literal** e o contrato a fonte em string — e a
    // ordem da alternância difere (`center|34` × `34|center`). O que vale é o
    // comportamento, e é ele que o próximo teste compara valor a valor.
    expect(literal("CROP_PATTERN")).toBeInstanceOf(RegExp)
  })

  it("o padrão aceita o que o contrato aceita, e recusa o resto", () => {
    const pattern = literal("CROP_PATTERN") as RegExp

    for (const valor of valores) {
      expect(pattern.test(valor)).toBe(parseCrop(valor) !== undefined)
    }
  })

  it("a prévia do painel desenha o que o contrato desenha", () => {
    for (const trecho of ["objectPosition", '"absolute"', "maxWidth", "100 / z"]) {
      expect(painel).toContain(trecho)
    }

    expect(cropImageStyle("center:34:1.4")?.width).toBe("71.43%")
  })

  it("a moldura é a do contrato, degrau a degrau", () => {
    expect(frameBox([{ label: "x", from: 0, ratio: "1/1" }])).toEqual({
      fit: "ratio",
      ratio: "1/1",
    })
    expect(cropFitsBox("center:center:2", { fit: "ratio", ratio: "1/1" })).toBe(
      false
    )
    expect(painel).toContain("degrau.ratio")
    expect(painel).toContain('box.fit === "height"')
  })

  it("o valor gravado do painel é a forma canônica do contrato", () => {
    expect(formatCrop({ x: "center", y: 34, z: 1 })).toBe("center:34")
    expect(painel).toContain("z === ZOOM_MIN ? ")
  })
})
