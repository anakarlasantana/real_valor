/**
 * O conteúdo padrão é a **cópia do protótipo**: o que a vitrine mostra quando a
 * API falha, e o que o seed grava. Estes testes travam as propriedades que
 * fazem ele servir para as duas coisas.
 */
import {
  FIXED_SECTION_POSITIONS,
  SECTION_FIELDS,
  SECTION_TYPES,
  SINGLETON_SECTION_TYPES,
  isSingletonSectionType,
} from "../contract"
import { DEFAULT_HOME_SECTIONS, DEFAULT_SECTION_DATA } from "../defaults"

describe("DEFAULT_HOME_SECTIONS", () => {
  it("todo tipo de seção tem o padrão de uma seção nova", () => {
    // O invariante é o **padrão da seção nova** (`DEFAULT_SECTION_DATA`), e não
    // a lista da vitrine: desde a v11 do schema existe um tipo que só mora em
    // página (o `prose`, ver 14.6.2 do doc 14), e o que a home tem de fábrica
    // continua sendo o que ela mostra. Sem a entrada, criar uma seção pelo CRM
    // gravaria `{}` e o formulário abriria em branco — a regra que o comentário
    // do `DEFAULT_SECTION_DATA` declara.
    expect(SECTION_TYPES.filter((type) => !DEFAULT_SECTION_DATA[type])).toEqual(
      []
    )
  })

  it("a vitrine de fábrica cobre todos os tipos, menos os que são só de página", () => {
    // A outra metade do invariante: o conteúdo padrão é o **fallback** da
    // vitrine quando a API falha, então um tipo de vitrine fora dele deixaria a
    // loja sem o bloco. A lista de exceções é explícita de propósito — um tipo
    // novo tem de entrar aqui, e quem entrasse passaria a ser um bloco de
    // fábrica da home (o que o `prose` não é: a copy de um texto longo é do
    // negócio, e o seed não inventa página — decisão 7 de 14.15).
    const cobertos = new Set(DEFAULT_HOME_SECTIONS.map((s) => s.type))

    expect(SECTION_TYPES.filter((type) => !cobertos.has(type))).toEqual([
      "prose",
    ])
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

  it("a home numera as casas ancoradas em 1, 2, 3, 4 e 10, e a vitrine nas livres (5 a 9 e 11)", () => {
    // É o desenho que o lojista lê no CRM: as fixas nas casas delas
    // (`FIXED_SECTION_POSITIONS`, no contrato) e as ordenáveis preenchendo as
    // casas livres, na ordem da página. A vitrine de hoje tem **seis**
    // ordenáveis: a sexta (o Instagram) nasce em 11 porque a casa 10 é do
    // rodapé, e a renumeração a pula (`order.ts`).
    expect(
      DEFAULT_HOME_SECTIONS.map(({ type, position }) => [type, position])
    ).toEqual([
      ["announcement", 1],
      ["nav", 2],
      ["hero", 3],
      ["benefits", 4],
      ["launches", 5],
      ["collections", 6],
      ["editorial", 7],
      ["banner", 8],
      ["featured", 9],
      ["footer", 10],
      ["instagram", 11],
    ])

    for (const section of DEFAULT_HOME_SECTIONS) {
      if (isSingletonSectionType(section.type)) {
        expect([section.type, section.position]).toEqual([
          section.type,
          FIXED_SECTION_POSITIONS[section.type],
        ])
      }
    }
  })

  it("as duas seções fixas da abertura são únicas, como o cromo", () => {
    // A capa e a faixa de benefícios passaram a ser fixas com as três do cromo:
    // a lista do contrato é quem responde, e o padrão tem exatamente uma de cada.
    expect([...SINGLETON_SECTION_TYPES].sort()).toEqual([
      "announcement",
      "benefits",
      "footer",
      "hero",
      "nav",
    ])
    expect(
      DEFAULT_HOME_SECTIONS.filter((section) =>
        isSingletonSectionType(section.type)
      ).map(({ id }) => id)
    ).toEqual(["announcement", "nav", "hero", "benefits", "footer"])
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
