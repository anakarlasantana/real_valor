/**
 * As páginas de conteúdo (a F1 do doc 14) — o que o contrato promete.
 * -------------------------------------------------------------------------
 * Estes são os invariantes que **não** falham no `tsc` e que, desfeitos, só
 * aparecem na loja ou no CRM. É a lista que a 14.10 do doc 14 chama de "o que se
 * esquece", um por defeito silencioso:
 *
 *   - uma página declarada **sem** entrada em `DEFAULT_PAGE_SECTIONS`: o botão
 *     "Restaurar padrão" dela cai no padrão da vitrine e cria a home **dentro**
 *     da página (defeito 1);
 *   - um tipo único (`hero`, `nav`, `footer`, `announcement`, `benefits`) numa
 *     página: o CRM mostra o bloco e a loja nunca o desenha (defeito 2);
 *   - uma faixa de numeração que começa numa casa ancorada: a primeira seção da
 *     página nasceria na casa de um bloco fixo (defeito 3, pelo lado da ordem);
 *   - uma página fora do seed: base nova nasce com a página declarada e vazia, e
 *     vazia (pela regra do 404) é uma URL que não existe.
 *   - a régua do "no ar" (`publishedSections` + `pageState`) e o índice da tela
 *     "Páginas": o estado que o CRM mostra tem de ser o que a loja responde —
 *     "Publicada" com o endereço em 404 é a promessa vazia do doc 13, agora
 *     dita por quem deveria saber.
 *
 * O que **não** está aqui: o comportamento da rota (é do storefront, em
 * `page-surfaces.spec.ts` e `page-seo.spec.ts`) e a validação do corpo (está em
 * `validation.unit.spec.ts`, ao lado da função que a implementa).
 */
import {
  CONTENT_SURFACES,
  PAGE_SECTION_TYPES,
  PAGE_SURFACES,
  PAGE_STATES,
  SECTION_TYPES,
  THEME_SURFACE,
  findSurface,
  isKnownSurface,
  isPageSurface,
  isSingletonSectionType,
  pageState,
  publishedSections,
  type ContentSurfaceSpec,
} from "../contract"
import { DEFAULT_HOME_SECTIONS, DEFAULT_PAGE_SECTIONS } from "../defaults"
import { bandFor, nextPosition, reservedPositions } from "../order"
import { livePages, pageSummaries } from "../pages"
import { defaultsFor } from "../restore"

describe("as superfícies declaradas", () => {
  it("toda superfície diz o que é (`kind`) — inclusive a vitrine e o tema", () => {
    const semKind = CONTENT_SURFACES.filter(
      (surface) => !["home", "theme", "page"].includes(surface.kind)
    )

    expect(semKind.map((surface) => surface.id)).toEqual([])
    expect(findSurface("home")?.kind).toBe("home")
    expect(findSurface(THEME_SURFACE)?.kind).toBe("theme")
  })

  it("`PAGE_SURFACES` é exatamente a fatia `page` do contrato", () => {
    expect(PAGE_SURFACES.map((surface) => surface.id)).toEqual(
      CONTENT_SURFACES.filter((surface) => surface.kind === "page").map(
        (surface) => surface.id
      )
    )
    expect(PAGE_SURFACES.filter((surface) => surface.kind !== "page")).toEqual([])
  })

  it("`isKnownSurface` recusa o que ninguém declarou — o typo deixa de ser silêncio", () => {
    expect(isKnownSurface("home")).toBe(true)
    expect(isKnownSurface(THEME_SURFACE)).toBe(true)
    expect(PAGE_SURFACES.every((surface) => isKnownSurface(surface.id))).toBe(
      true
    )

    // O caso do doc 14: `?surface=sobreo` respondia 200 com lista vazia.
    expect(isKnownSurface("sobreo")).toBe(false)
    expect(isKnownSurface("")).toBe(false)
    expect(isKnownSurface(undefined)).toBe(false)
    expect(isKnownSurface(["home"])).toBe(false)
    expect(findSurface("sobreo")).toBeUndefined()
  })

  it("uma página não é confundida com a vitrine nem com o tema", () => {
    expect(isPageSurface("home")).toBe(false)
    expect(isPageSurface(THEME_SURFACE)).toBe(false)
    expect(PAGE_SURFACES.every((surface) => isPageSurface(surface.id))).toBe(
      true
    )
  })
})

describe("o que uma página pode receber", () => {
  it("nenhum tipo único entra numa página (defeito 2)", () => {
    // Os únicos são o cromo (`announcement`, `nav`, `footer`) e a abertura da
    // vitrine (`hero`, `benefits`): os três primeiros o layout resolve por
    // `find` e os dois últimos moram em casa ancorada.
    expect(PAGE_SECTION_TYPES.filter(isSingletonSectionType)).toEqual([])
    expect(PAGE_SECTION_TYPES.length).toBe(
      SECTION_TYPES.length - SECTION_TYPES.filter(isSingletonSectionType).length
    )
  })

  it("toda página declara os blocos de página, e só eles", () => {
    const fora = PAGE_SURFACES.filter(
      (surface) =>
        surface.types.length !== PAGE_SECTION_TYPES.length ||
        !PAGE_SECTION_TYPES.every((type) => surface.types.includes(type))
    )

    expect(fora.map((surface) => surface.id)).toEqual([])
  })
})
describe("a numeração de uma página", () => {
  it("a página não tem casa ancorada (as cinco casas são da vitrine)", () => {
    for (const surface of PAGE_SURFACES) {
      expect(reservedPositions(surface.id)).toEqual([])
    }
  })

  it("a primeira seção de uma página nasce na casa 1, e a segunda depois dela", () => {
    // Na vitrine a faixa começa em 5 (as casas 1 a 4 são do bloco ancorado do
    // topo); numa página não há bloco ancorado, então a primeira casa livre é a
    // primeira. Copiar o 5 faria a primeira linha da página nascer numerada como
    // se quatro blocos existissem antes dela.
    expect(bandFor("sobre").first).toBe(1)
    expect(nextPosition([], "sobre")).toBe(1)
    expect(nextPosition([{ position: 1 }], "sobre")).toBe(2)
    expect(nextPosition([], "home")).toBe(5)
  })
})

describe("o padrão de cada página (defeito 1)", () => {
  it("toda página declarada tem a sua entrada no mapa", () => {
    const semPadrao = PAGE_SURFACES.map((surface) => surface.id).filter(
      (id) => !(id in DEFAULT_PAGE_SECTIONS)
    )

    expect(semPadrao).toEqual([])
  })

  it("não há entrada órfã — chave que não é uma página declarada", () => {
    const orfas = Object.keys(DEFAULT_PAGE_SECTIONS).filter(
      (id) => findSurface(id)?.kind !== "page"
    )

    expect(orfas).toEqual([])
  })

  it("o padrão de uma página não traz bloco da vitrine", () => {
    // Vazio hoje, de propósito (a copy é do negócio). O guarda é para o dia em
    // que a copy entrar: colar o `DEFAULT_HOME_SECTIONS` aqui dentro criaria a
    // barra de anúncio e o rodapé **dentro** de `/privacidade`.
    const blocos = PAGE_SURFACES.flatMap(
      (surface) => DEFAULT_PAGE_SECTIONS[surface.id] ?? []
    )
    const daVitrine = blocos.filter((block) =>
      isSingletonSectionType(block.type)
    )

    expect(daVitrine).toEqual([])
  })

  it("`defaultsFor` de uma página repõe o padrão dela, e nunca a vitrine", () => {
    for (const surface of PAGE_SURFACES) {
      expect(defaultsFor(surface.id)).toEqual(DEFAULT_PAGE_SECTIONS[surface.id])
    }

    // A ausência de padrão é o que o botão repõe: nenhuma seção da vitrine — o
    // defeito era justamente criar o anúncio, o cabeçalho, a capa e o rodapé
    // dentro da página de trocas.
    expect(defaultsFor("privacidade")).toEqual([])
    expect(defaultsFor("privacidade")).not.toEqual(DEFAULT_HOME_SECTIONS)
  })

  it("a vitrine e o tema continuam repondo o que sempre repuseram", () => {
    expect(defaultsFor("home")).toEqual(DEFAULT_HOME_SECTIONS)
    expect(defaultsFor(THEME_SURFACE)).not.toEqual(DEFAULT_HOME_SECTIONS)
  })
})

/**
 * A tela "Páginas" (F3a, item 2): a régua do "no ar" e o índice.
 * -------------------------------------------------------------------------
 * O que se prende aqui é a promessa mais fácil de quebrar em silêncio: o estado
 * que o CRM mostra é o **mesmo** que a loja responde. A régua é uma função só
 * (`publishedSections`, no contrato), lida pelos dois lados — o CRM para dizer
 * "Publicada" e o `[slug]` do storefront para decidir o 404 (a premissa do lado
 * dela é do `supported-sections.spec.ts`, que confere que o par é o mesmo que os
 * dois filtros da loja já aplicavam).
 */
describe("a régua do `no ar`", () => {
  const habilitada = { id: "no-ar", type: "editorial", enabled: true }
  const desabilitada = { id: "oculta", type: "editorial", enabled: false }
  const desconhecida = { id: "nova", type: "loja-de-marca-nova", enabled: true }

  it("conta habilitada **e** de tipo conhecido — o par exato, sem filtro a mais", () => {
    // As duas metades, uma por linha: um aperto futuro na régua (excluir um tipo
    // da conta, por exemplo) reprova aqui — e não na loja, em silêncio, com o CRM
    // dizendo "Despublicada" para um endereço que responde 200.
    expect(publishedSections([habilitada, desabilitada, desconhecida])).toEqual([
      habilitada,
    ])
    expect(publishedSections([habilitada])).toHaveLength(1)
    expect(publishedSections([desabilitada])).toEqual([])
    expect(publishedSections([desconhecida])).toEqual([])
  })

  it("o estado sai das seções — nunca 'published' com zero publicadas", () => {
    expect(pageState([])).toBe("empty")
    expect(pageState([desabilitada])).toBe("unpublished")
    expect(pageState([habilitada, desabilitada])).toBe("published")
  })

  it("o vocabulário está completo: todo estado da régua tem rótulo, tom e frase", () => {
    // `PAGE_STATES` é o que a tela desenha (ela não tem tabela própria — ver
    // `panel-wiring.unit.spec.ts`): um estado que a régua produzisse sem entrada
    // aqui sairia sem rótulo na tela, e uma entrada que a régua não alcança seria
    // legenda que nunca aparece.
    const produzidos = [
      pageState([]),
      pageState([desabilitada]),
      pageState([habilitada]),
    ]

    expect([...new Set(produzidos)].sort()).toEqual(
      PAGE_STATES.map((spec) => spec.id).sort()
    )
    expect(
      PAGE_STATES.filter((spec) => !spec.label || !spec.meaning || !spec.tone)
    ).toEqual([])
  })
})

describe("o leitor público (as páginas que estão no ar)", () => {
  it("lista só as publicadas, na ordem do contrato", () => {
    const live = livePages({
      sobre: [{ type: "editorial", enabled: true }],
      privacidade: [{ type: "prose", enabled: false }],
      termos: [{ type: "prose", enabled: true }],
    })

    expect(live).toEqual([
      { id: "sobre", label: "Sobre", path: "/sobre" },
      { id: "termos", label: "Termos de uso", path: "/termos" },
    ])
  })

  it("é lista de destino: sem contagem e sem estado", () => {
    // O que a loja não lê é campo que sobra — e o payload público é o mais
    // exposto de todos. `blocks`/`published`/`state` são da tela do CRM.
    const [page] = livePages({ sobre: [{ type: "editorial", enabled: true }] })

    expect(Object.keys(page).sort()).toEqual(["id", "label", "path"])
  })

  it("nenhuma página no ar é lista vazia — nunca uma lista que promete 404", () => {
    expect(livePages({})).toEqual([])
    // Tipo que a loja não desenha e seção desabilitada não põem página no ar: é o
    // que impede o rodapé e a sugestão do 404 de oferecerem um endereço que
    // responde 404 (o defeito medido em 14.16).
    expect(
      livePages({ sobre: [{ type: "loja-de-marca-nova", enabled: true }] })
    ).toEqual([])
    expect(livePages({ sobre: [{ type: "prose", enabled: false }] })).toEqual([])
  })
})

describe("o índice da tela Páginas", () => {
  it("uma linha por página declarada — nenhuma fica de fora, nenhuma sobra", () => {
    expect(pageSummaries({}).map((row) => row.id)).toEqual(
      PAGE_SURFACES.map((surface) => surface.id)
    )
  })

  it("o endereço da linha é o `id` da página — o slug, sem o país", () => {
    expect(pageSummaries({}).map((row) => row.path)).toEqual(
      PAGE_SURFACES.map((surface) => `/${surface.id}`)
    )
  })

  it("as duas contagens e o estado saem da régua", () => {
    const rows = pageSummaries({
      sobre: [
        { type: "editorial", enabled: true },
        { type: "editorial", enabled: false },
      ],
      privacidade: [{ type: "prose", enabled: false }],
    })

    expect(rows.find((row) => row.id === "sobre")).toMatchObject({
      blocks: 2,
      published: 1,
      state: "published",
    })
    // O caso que a tela existe para mostrar: tem bloco, nenhum no ar — o
    // endereço responde 404 e o link do rodapé, se o promete, promete um link
    // quebrado (o defeito medido em 14.16).
    expect(rows.find((row) => row.id === "privacidade")).toMatchObject({
      blocks: 1,
      published: 0,
      state: "unpublished",
    })
  })

  it("página sem leitura nenhuma vira a linha `sem blocos`, e não some", () => {
    // A leitura pode não trazer entrada para uma superfície (página recém
    // declarada, seção nunca criada): a linha existe do mesmo jeito — uma página
    // declarada que não aparece na lista é uma página que o lojista não sabe que
    // existe.
    const rows = pageSummaries({})

    expect(rows.every((row) => row.blocks === 0 && row.state === "empty")).toBe(
      true
    )
  })

  it("uma página nova no contrato entra no índice sem edição na rota", () => {
    const nova: ContentSurfaceSpec = {
      ...PAGE_SURFACES[0],
      id: "cuidados",
      label: "Cuidados",
    }

    expect(
      pageSummaries(
        { cuidados: [{ type: "prose", enabled: true }] },
        [...PAGE_SURFACES, nova]
      ).at(-1)
    ).toEqual({
      id: "cuidados",
      label: "Cuidados",
      path: "/cuidados",
      blocks: 1,
      published: 1,
      state: "published",
    })
  })
})
