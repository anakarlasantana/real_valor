/**
 * Os invariantes do contrato — os que a guarda de paridade caçava em texto.
 *
 * Aqui eles são **testes**: `import` de verdade, tipos de verdade, e o erro
 * aponta o dado que quebrou em vez de um `detail` em string. A guarda vai
 * perder esses casos (fase G4); este arquivo é o motivo pelo qual isso é
 * seguro.
 *
 * Nenhum teste aqui precisa de container, banco ou API: o contrato é dado puro,
 * e o conteúdo padrão é a cópia do protótipo.
 */
import {
  APPEARANCE_GROUPS,
  CONTENT_SURFACES,
  FIXED_SECTION_POSITIONS,
  FOOTER_COLUMN_SOURCES,
  FONT_ROLES,
  ITEM_FIELDS,
  SECTION_FIELDS,
  SECTION_TYPE_LABELS,
  SECTION_TYPES,
  SINGLETON_SECTION_TYPES,
  THEME_COLOR_TOKENS,
  THEME_DARK_TOKENS,
  THEME_SURFACE,
  type FieldKind,
  type FieldSpec,
  type SectionType,
} from "../contract"
import { DEFAULT_HOME_SECTIONS } from "../defaults"
import { bandFor, reservedPositions } from "../order"

const listKindsInSections: FieldKind[] = [
  ...new Set(
    Object.values(SECTION_FIELDS)
      .flat()
      .map((field) => field.kind)
      .filter((kind) => kind.startsWith("list:") && kind !== "list:text")
  ),
]

/** Um item de lista do conteúdo padrão, sem tipo: a forma vem do `kind`. */
function itemsOfSection(section: Record<string, unknown>): Record<
  string,
  unknown
>[] {
  return Object.entries(section)
    .filter(([key, value]) => key !== "id" && Array.isArray(value))
    .flatMap(([, value]) => value as Record<string, unknown>[])
}

describe("SECTION_TYPES ⇔ SECTION_FIELDS", () => {
  it("todo tipo de seção tem campos para o CRM desenhar", () => {
    const semCampos = SECTION_TYPES.filter(
      (type) => !(SECTION_FIELDS[type]?.length > 0)
    )

    expect(semCampos).toEqual([])
  })

  it("não há campo declarado para um tipo que não existe", () => {
    const sobrando = Object.keys(SECTION_FIELDS).filter(
      (type) => !SECTION_TYPES.includes(type as SectionType)
    )

    expect(sobrando).toEqual([])
  })

  it("todo tipo tem rótulo na listagem, e nenhum rótulo é órfão", () => {
    expect(
      SECTION_TYPES.filter((type) => !SECTION_TYPE_LABELS[type])
    ).toEqual([])
    expect(
      Object.keys(SECTION_TYPE_LABELS).filter(
        (type) => !SECTION_TYPES.includes(type as SectionType)
      )
    ).toEqual([])
  })
})

describe("ITEM_FIELDS (o editor dentro do item)", () => {
  it("todo `list:` usado por uma seção tem editor de item", () => {
    // `list:text` é a exceção declarada: é um input separado por vírgula, sem
    // sub-campos, então não tem (e não pode ter) entrada em `ITEM_FIELDS`.
    expect(listKindsInSections.filter((kind) => !ITEM_FIELDS[kind])).toEqual([])
  })

  it("não há editor de um `kind` que nenhuma seção usa", () => {
    // `Object.keys` devolve `string`; as chaves do registro são `FieldKind` (é o
    // que o contrato tipa), então a comparação passa pelo mesmo tipo.
    const orfaos = (Object.keys(ITEM_FIELDS) as FieldKind[]).filter(
      (kind) => !listKindsInSections.includes(kind)
    )

    expect(orfaos).toEqual([])
  })

  it("todo campo que o conteúdo padrão usa tem editor no item", () => {
    // A versão **com dados** da regra "o editor oferece os campos do item": em
    // vez de comparar o editor com um *tipo* (que existe só em tempo de
    // compilação), compara com o conteúdo — que é onde o erro aparecia: um
    // campo no seed que o CRM não oferece deixa o lojista sem como preencher o
    // que a loja renderiza.
    const semEditor: string[] = []

    for (const section of DEFAULT_HOME_SECTIONS) {
      for (const field of SECTION_FIELDS[section.type]) {
        if (!field.kind.startsWith("list:")) {
          continue
        }

        const items = (section as unknown as Record<string, unknown>)[
          field.name
        ]

        if (!Array.isArray(items)) {
          continue
        }

        const offered = new Set(
          (ITEM_FIELDS[field.kind] ?? []).map((f) => f.name)
        )

        for (const item of items as unknown[]) {
          // `list:text` guarda **strings** (os filtros vêm separados por
          // vírgula no formulário) e, por isso, não tem editor de item. Só os
          // itens que são objeto têm chaves para conferir.
          if (typeof item !== "object" || item === null) {
            expect(ITEM_FIELDS[field.kind]).toBeUndefined()
            continue
          }

          for (const key of Object.keys(item as Record<string, unknown>)) {
            if (!offered.has(key)) {
              semEditor.push(`${section.type}.${field.name}.${key}`)
            }
          }
        }
      }
    }

    expect(semEditor).toEqual([])
  })

  it("toda origem de coluna de rodapé tem rótulo", () => {
    const source = SECTION_FIELDS.footer
      ?.flat()
      .find((field) => field.name === "columns")
    const item = ITEM_FIELDS["list:column"]?.find((f) => f.name === "source")
    const options = item?.options ?? []
    const labels = item?.optionLabels ?? {}

    expect(options).toEqual(FOOTER_COLUMN_SOURCES)
    expect(options.filter((option) => !labels[option])).toEqual([])
  })
})

describe("aparência por seção", () => {
  const appearanceFields = Object.values(SECTION_FIELDS)
    .flat()
    .filter((field) => field.name.startsWith("appearance"))

  it("toda cor de fundo escuro é uma cor da paleta", () => {
    expect(
      THEME_DARK_TOKENS.filter((token) => !THEME_COLOR_TOKENS.includes(token))
    ).toEqual([])
  })

  it("os papéis de fonte incluem o que a loja precisa", () => {
    expect(FONT_ROLES.includes("display")).toBe(true)
    expect(FONT_ROLES.includes("sans")).toBe(true)
  })

  it("todo trilho é um grupo declarado no contrato", () => {
    const fora = appearanceFields
      .filter((field) => !APPEARANCE_GROUPS.includes(field.group as never))
      .map((field) => `${field.name} (${field.group})`)

    expect(fora).toEqual([])
  })

  it("todo campo de aparência é color/font, com o padrão na frente, em um trilho", () => {
    const errados: string[] = []

    for (const field of appearanceFields as FieldSpec[]) {
      if (field.kind !== "color" && field.kind !== "font") {
        errados.push(`${field.name}: kind ${field.kind}`)
        continue
      }

      if (!field.group) {
        errados.push(`${field.name}: sem trilho`)
        continue
      }

      const expected =
        field.kind === "color" ? THEME_COLOR_TOKENS : FONT_ROLES

      if (JSON.stringify(field.options ?? []) !== JSON.stringify(["", ...expected])) {
        errados.push(`${field.name}: opções ${JSON.stringify(field.options)}`)
      }
    }

    expect(errados).toEqual([])
  })

  it("todo trilho fica logo abaixo do campo de conteúdo que ele veste", () => {
    // `attachedTo` é a âncora declarada; a ordem do array é o que decide onde o
    // campo aparece na tela. A regra verificável: a âncora é o último campo de
    // conteúdo antes do trilho.
    const problemas: string[] = []

    for (const [type, fields] of Object.entries(SECTION_FIELDS)) {
      let lastContentField: string | null = null

      for (const field of fields) {
        if (field.name.startsWith("appearance")) {
          if (field.attachedTo !== lastContentField) {
            problemas.push(
              `${type}.${field.name} -> ${
                field.attachedTo ?? "(nada)"
              } (esperado ${lastContentField ?? "(início)"})`
            )
          }
          continue
        }

        lastContentField = field.name
      }
    }

    expect(problemas).toEqual([])
  })

  it("todo campo de aparência traduz cada uma das opções", () => {
    const semTraducao: string[] = []

    for (const field of appearanceFields) {
      for (const option of field.options ?? []) {
        if (!field.optionLabels?.[option]) {
          semTraducao.push(`${field.name}.${option || "(vazio)"}`)
        }
      }
    }

    expect(semTraducao).toEqual([])
  })
})

/**
 * As **casas** da numeração.
 *
 * A posição de uma seção é a casa dela na página, e a faixa de casas é da
 * superfície (`CONTENT_SURFACES[i].order`). O que este bloco trava é o que dá
 * sentido a "1 a 10" na home: cada tipo do bloco ancorado tem uma casa, nenhuma
 * casa serve a dois tipos, e a faixa das seções ordenáveis **não começa** numa
 * casa ancorada — a renumeração as pula (`order.ts`), e uma faixa que começasse
 * na casa 1 escreveria em cima da barra de anúncio.
 */
describe("as casas da numeração", () => {
  const houses = Object.values(FIXED_SECTION_POSITIONS)

  it("todo tipo do bloco ancorado declara uma casa", () => {
    for (const type of SINGLETON_SECTION_TYPES) {
      expect(typeof FIXED_SECTION_POSITIONS[type]).toBe("number")
    }
  })

  it("nenhuma casa serve a dois tipos fixos", () => {
    expect(new Set(houses).size).toBe(houses.length)
  })

  it("a faixa da home começa na primeira casa livre depois do bloco do topo", () => {
    // As casas ancoradas do topo são as menores da numeração (1, 2, 3 e 4), e a
    // primeira livre é a seguinte a elas: é essa a casa da primeira seção
    // ordenável, e é o que o padrão (`defaults.ts`) numera como 5.
    const topo = houses.filter((house) => house < FIXED_SECTION_POSITIONS.footer)

    expect(bandFor("home").first).toBe(Math.max(...topo) + 1)
  })

  it("nenhuma faixa começa numa casa ancorada", () => {
    for (const surface of CONTENT_SURFACES) {
      expect(reservedPositions(surface.id)).not.toContain(surface.order.first)
    }
  })

  it("o bloco ancorado é da home: o tema não tem casa reservada", () => {
    const daHome = new Set(
      CONTENT_SURFACES.find(({ id }) => id === "home")?.types ?? []
    )

    expect(SINGLETON_SECTION_TYPES.filter((type) => !daHome.has(type))).toEqual(
      []
    )
    expect(reservedPositions(THEME_SURFACE)).toEqual([])
  })
})

