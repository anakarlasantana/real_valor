/**
 * O registro do contrato (`content_contract`) — a parte que é **dado**, não
 * código.
 *
 * A decisão "registro ou bootstrap?" ficou pura (`resolveSchema`), então ela é
 * testada aqui sem container e sem banco. O resto confere as decisões de projeto
 * que a guarda segurava: migration só com DDL, o histórico do nome da tabela
 * (criada como `content_schema`, renomeada para `content_contract`), model com
 * chave/versão/dado, e a versão morando no contrato.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import {
  CONTENT_DESTINATIONS,
  CONTENT_SURFACES,
  CONTENT_TYPES,
  ITEM_FIELDS,
  MARKDOWN_MARKS,
  SECTION_FIELDS,
  SECTION_TYPE_LABELS,
  SINGLETON_SECTION_TYPES,
  THEME_COLOR_HEXES,
  THEME_DARK_TOKENS,
  THEME_FIELDS,
  THEME_FONTS,
  THEME_TYPE,
  THEME_TYPE_LABEL,
} from "../contract"
import {
  SCHEMA_KEY,
  SCHEMA_VERSION,
  buildSchema,
  resolveSchema,
} from "../schema"

const here = __dirname
const moduleDir = join(here, "..")
const migrationsDir = join(moduleDir, "migrations")

/**
 * O SQL de uma migration, **sem os comentários**: as asserções valem sobre o
 * que roda no banco. Uma docstring que cita `create table` para explicar por
 * que ele não é o caminho aqui não é um `create table` — e uma guarda que
 * reprova comentário obriga o próximo a apagar a explicação.
 */
const migrationSql = (text: string): string =>
  [...text.matchAll(/addSql\(`([^`]*)`\)/g)].map(([, sql]) => sql).join("\n")

describe("SCHEMA_VERSION e SCHEMA_KEY", () => {
  it("a versão é um inteiro positivo (é o `schemaVersion` da loja)", () => {
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true)
    expect(SCHEMA_VERSION).toBeGreaterThan(0)
  })

  it("a chave da linha é fixa, para o `saveContract` ser um upsert de verdade", () => {
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

describe("a tabela do contrato", () => {
  const migrationFiles = readdirSync(migrationsDir).filter((file) =>
    file.startsWith("Migration")
  )
  const migrations = migrationFiles.map((file) => ({
    file,
    text: readFileSync(join(migrationsDir, file), "utf8"),
  }))
  // O histórico do nome: a tabela nasceu como `content_schema` (a primeira
  // migration) e o rename a trouxe para o nome de hoje. Reescrever a migration
  // antiga para "arrumar" isso deixaria dois bancos no mesmo commit em estados
  // diferentes — o rename é o caminho.
  //
  // As buscas são no **SQL** da migration (o que roda), não no arquivo: a
  // docstring desta migration cita `create table` e `drop table` para explicar
  // por que elas não são o caminho aqui, e uma asserção sobre o texto inteiro
  // obrigaria a apagar a explicação.
  const created = migrations.filter(({ text }) =>
    /create table[^"]*"?content_(schema|contract)"?/i.test(migrationSql(text))
  )
  const renamed = migrations.filter(({ text }) =>
    /rename to "?content_contract"?/i.test(migrationSql(text))
  )

  it("existe migration criando a tabela do contrato", () => {
    expect(created.length).toBeGreaterThan(0)
  })

  it("existe migration renomeando-a para `content_contract` (sem recriar)", () => {
    expect(renamed.length).toBeGreaterThan(0)
    expect(
      renamed
        .filter(({ text }) => /create table/i.test(migrationSql(text)))
        .map(({ file }) => file)
    ).toEqual([])
  })

  it("as migrations do contrato não inserem linha: o dado é do seed, não do histórico", () => {
    // Um `insert` com o JSON do schema dentro da migration faria o histórico
    // depender do código do dia em que rodou: banco novo em 2027 nasceria com o
    // schema de 2027 e o de 2026 com o de 2026 — divergência entre ambientes.
    const comInsert = migrations.filter(({ text }) =>
      /insert\s+into/i.test(migrationSql(text))
    )

    expect(comInsert.map(({ file }) => file)).toEqual([])
  })

  it("o model tem chave, versão e dado (uma linha só)", () => {
    const model = readFileSync(
      join(moduleDir, "models/content-contract.ts"),
      "utf8"
    )

    expect(model).toContain('model.define("content_contract"')
    expect(model).toContain("model.text().primaryKey()")
    expect(model).toContain("version: model.number()")
    expect(model).toContain("data: model.json()")
  })
})

describe("o schema servido (o payload do CRM)", () => {
  /**
   * O payload do `GET /admin/content` é **o contrato**, chave por chave: é ele
   * que o painel desenha e que a validação usa. Se uma chave deixar de sair, a
   * tela perde a cor (paleta), o sub-formulário do item (`itemFields`), o nome
   * do tipo (`typeLabels`) ou o seletor de superfície — e nada falha: a tela
   * continua "funcionando" com menos.
   *
   * A comparação é de **dado** — `buildSchema()` chamado contra as constantes do
   * contrato —, e não de texto: eram oito strings procuradas no arquivo, que
   * provavam que alguém tinha escrito o nome em algum lugar, e não que a chave
   * **servida** fosse aquela lista.
   */
  it("é o contrato: tipos, campos (com o tema), rótulos, itens, destinos, marcas, paleta, fontes, cores escuras, tipos únicos e superfícies", () => {
    const schema = buildSchema()

    expect(schema.types).toEqual(CONTENT_TYPES)
    expect(schema.fields).toEqual({
      ...SECTION_FIELDS,
      [THEME_TYPE]: THEME_FIELDS,
    })
    expect(schema.typeLabels).toEqual({
      ...SECTION_TYPE_LABELS,
      [THEME_TYPE]: THEME_TYPE_LABEL,
    })
    expect(schema.itemFields).toEqual(ITEM_FIELDS)
    // O índice de destinos (o PR5 do doc 14): sem ele no payload o campo
    // `kind: "href"` do painel volta a ser caixa de texto livre — o seletor é
    // montado daqui, e não de uma lista escrita no CRM.
    expect(schema.destinations).toEqual(CONTENT_DESTINATIONS)
    // A barra de marcas do texto formatado: sem ela no payload, o painel não
    // teria como desenhar a barra (o CRM não importa valor do contrato) e o
    // campo `markdown` apareceria sem os botões.
    expect(schema.markdownMarks).toEqual(MARKDOWN_MARKS)
    expect(schema.palette).toEqual(THEME_COLOR_HEXES)
    expect(schema.fonts).toEqual(THEME_FONTS)
    expect(schema.darkTokens).toEqual(THEME_DARK_TOKENS)
    expect(schema.singletonTypes).toEqual(SINGLETON_SECTION_TYPES)
    expect(schema.surfaces).toEqual(CONTENT_SURFACES)
  })
})
