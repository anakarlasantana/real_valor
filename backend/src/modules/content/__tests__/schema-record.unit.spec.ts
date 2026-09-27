/**
 * O registro do schema (`content_schema`) — a parte que é **dado**, não código.
 *
 * A decisão "registro ou bootstrap?" ficou pura (`resolveSchema`), então ela é
 * testada aqui sem container e sem banco. O resto confere as decisões de projeto
 * que a guarda segurava: migration só com DDL, model com chave/versão/dado, e a
 * versão morando no contrato.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import {
  SCHEMA_KEY,
  SCHEMA_VERSION,
  buildSchema,
  resolveSchema,
} from "../schema"

const here = __dirname
const moduleDir = join(here, "..")
const migrationsDir = join(moduleDir, "migrations")

describe("SCHEMA_VERSION e SCHEMA_KEY", () => {
  it("a versão é um inteiro positivo (é o `schemaVersion` da loja)", () => {
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true)
    expect(SCHEMA_VERSION).toBeGreaterThan(0)
  })

  it("a chave da linha é fixa, para o `saveSchema` ser um upsert de verdade", () => {
    expect(SCHEMA_KEY).toBe("content")
  })
})

describe("resolveSchema (registro ou bootstrap)", () => {
  it("sem linha: serve o contrato e declara a origem", () => {
    const resolved = resolveSchema(null)

    expect(resolved.source).toBe("contract")
    expect(resolved.version).toBe(SCHEMA_VERSION)
    expect(resolved.schema.types.length).toBeGreaterThan(0)
  })

  it("com linha: serve o registro, com a versão gravada", () => {
    // Um registro "editado à mão" — que é exatamente o teste que importa: a API
    // tem de servir o que está no banco, e não o que está no código.
    const stored = { ...buildSchema(), types: ["hero"] as never }

    const resolved = resolveSchema({ version: 7, data: stored })

    expect(resolved.source).toBe("db")
    expect(resolved.version).toBe(7)
    expect(resolved.schema.types).toEqual(["hero"])
  })

  it("linha sem `types` (ou vazia) não vale: um formulário vazio é pior que o bootstrap", () => {
    expect(resolveSchema({ version: 1, data: {} }).source).toBe("contract")
    expect(
      resolveSchema({ version: 1, data: { ...buildSchema(), types: [] } }).source
    ).toBe("contract")
    expect(resolveSchema({ data: buildSchema() }).source).toBe("contract")
  })
})

describe("a tabela do schema", () => {
  const migrationFiles = readdirSync(migrationsDir).filter((file) =>
    file.startsWith("Migration")
  )
  const schemaMigration = migrationFiles
    .map((file) => ({ file, text: readFileSync(join(migrationsDir, file), "utf8") }))
    .filter(({ text }) => /create table[^"]*"?content_schema"?/i.test(text))

  it("existe migration criando a tabela `content_schema`", () => {
    expect(schemaMigration.length).toBeGreaterThan(0)
  })

  it("a migration não insere linha: o dado é do seed, não do histórico", () => {
    // Um `insert` com o JSON do schema dentro da migration faria o histórico
    // depender do código do dia em que rodou: banco novo em 2027 nasceria com o
    // schema de 2027 e o de 2026 com o de 2026 — divergência entre ambientes.
    const comInsert = schemaMigration.filter(({ text }) =>
      /insert\s+into/i.test(text)
    )

    expect(comInsert.map(({ file }) => file)).toEqual([])
  })

  it("o model tem chave, versão e dado (uma linha só)", () => {
    const model = readFileSync(join(moduleDir, "models/content-schema.ts"), "utf8")

    expect(model).toContain('model.define("content_schema"')
    expect(model).toContain("model.text().primaryKey()")
    expect(model).toContain("version: model.number()")
    expect(model).toContain("data: model.json()")
  })
})
