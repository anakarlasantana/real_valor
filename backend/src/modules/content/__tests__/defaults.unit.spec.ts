/**
 * O conteúdo padrão é a **cópia do protótipo**: o que a vitrine mostra quando a
 * API falha, e o que o seed grava. Estes testes travam as propriedades que
 * fazem ele servir para as duas coisas.
 */
import { SECTION_FIELDS, SECTION_TYPES } from "../contract"
import { DEFAULT_HOME_SECTIONS } from "../defaults"

describe("DEFAULT_HOME_SECTIONS", () => {
  it("cobre todos os tipos de seção", () => {
    const cobertos = new Set(DEFAULT_HOME_SECTIONS.map((s) => s.type))

    expect(SECTION_TYPES.filter((type) => !cobertos.has(type))).toEqual([])
  })

  it("tem posição única e em ordem crescente", () => {
    const positions = DEFAULT_HOME_SECTIONS.map((section) => section.position)

    expect(new Set(positions).size).toBe(positions.length)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it("preenche todo campo obrigatório do contrato", () => {
    const faltando: string[] = []

    for (const section of DEFAULT_HOME_SECTIONS) {
      const record = section as unknown as Record<string, unknown>

      for (const field of SECTION_FIELDS[section.type] ?? []) {
        if (!field.required) {
          continue
        }

        const value = record[field.name]

        if (value === undefined || value === null || value === "") {
          faltando.push(`${section.type}.${field.name}`)
        }
      }
    }

    expect(faltando).toEqual([])
  })

  it("o cromo tem a forma que a loja espera (nav e footer)", () => {
    // O layout tira o cabeçalho e o rodapé do mesmo payload da home, e cada um
    // por um `find` pelo `type`: um `nav` com outro `type` some do site sem erro
    // em lugar nenhum.
    const nav = DEFAULT_HOME_SECTIONS.find((s) => s.type === "nav")
    const footer = DEFAULT_HOME_SECTIONS.find((s) => s.type === "footer")

    expect(nav).toBeDefined()
    expect(footer).toBeDefined()
    expect(DEFAULT_HOME_SECTIONS.filter((s) => s.type === "nav")).toHaveLength(1)
    expect(DEFAULT_HOME_SECTIONS.filter((s) => s.type === "footer")).toHaveLength(1)
  })
})
