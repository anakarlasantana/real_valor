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
 *
 * O que **não** está aqui: o comportamento da rota (é do storefront, em
 * `page-surfaces.spec.ts` e `page-seo.spec.ts`) e a validação do corpo (está em
 * `validation.unit.spec.ts`, ao lado da função que a implementa).
 */
import {
  CONTENT_SURFACES,
  PAGE_SECTION_TYPES,
  PAGE_SURFACES,
  SECTION_TYPES,
  THEME_SURFACE,
  findSurface,
  isKnownSurface,
  isPageSurface,
  isSingletonSectionType,
} from "../contract"
import { DEFAULT_HOME_SECTIONS, DEFAULT_PAGE_SECTIONS } from "../defaults"
import { bandFor, nextPosition, reservedPositions } from "../order"
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
