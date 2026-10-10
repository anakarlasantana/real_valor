/**
 * As páginas de conteúdo: os slugs e o que elas aceitam.
 * -------------------------------------------------------------------------
 * Dois guardas que **nenhum compilador dá** e que falham só na loja:
 *
 *   1. **a colisão de slug.** A rota vive em `(main)/[slug]`, ao lado de
 *      `store`, `rastreio`, `account`… — e o Next dá precedência à rota
 *      **estática**. Uma página declarada com o `id` de um vizinho existiria no
 *      contrato, no CRM, no banco e no `sitemap`, e na web abriria a **outra**
 *      tela: em silêncio, e sem nenhum erro de build. Foi medido em 14.6.1 do
 *      doc 14: `/rastreio` já é uma página escrita à mão, e é exatamente esse o
 *      vizinho que o catch-all herda. O teste lê o **diretório de verdade** —
 *      não uma lista de nomes digitada aqui, que é o que apodreceria: bastaria a
 *      loja ganhar uma rota nova (`/cuidados`, `/guia-de-medidas`) para o guarda
 *      estar conferindo uma lista velha;
 *   2. **o formato do slug.** O `id` da superfície é a URL: minúsculo, sem
 *      acento e sem espaço é o que a cliente digita, o que o `sitemap` publica e
 *      o que o `href` do menu pode carregar sem `encodeURIComponent` no caminho.
 *
 * O que **não** é conferido aqui é o desenho da página (o `notFound()` da vazia,
 * o `generateMetadata`): isso é comportamento da rota, e vive em
 * `page-seo.spec.ts` (a parte pura) e no `curl` do doc 14.12 (a parte de rede).
 */
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  DEFAULT_HOME_SECTIONS,
  PAGE_SECTION_TYPES,
  PAGE_SURFACES,
  SECTION_TYPES,
  isSingletonSectionType,
  type FooterSection,
} from "@rv/contrato"

/** A pasta das rotas fixas da loja — as vizinhas do `[slug]`. */
const rotasDeMain = join(
  __dirname,
  "..",
  "..",
  "app",
  "[countryCode]",
  "(main)"
)

describe("os slugs das páginas", () => {
  const vizinhos = readdirSync(rotasDeMain, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  it("a pasta das rotas fixas foi encontrada (o guarda não pode passar vazio)", () => {
    // Sem esta linha, um caminho errado (`__dirname` mexido, pasta renomeada)
    // faria a lista de vizinhos vir vazia e o teste passaria **sempre** — que é
    // a pior forma de um guarda falhar.
    expect(vizinhos).toContain("store")
    expect(vizinhos).toContain("rastreio")
    expect(vizinhos).toContain("[slug]")
  })

  it("nenhum slug colide com uma rota estática de (main)", () => {
    expect(
      PAGE_SURFACES.map((surface) => surface.id).filter((id) =>
        vizinhos.includes(id)
      )
    ).toEqual([])
  })

  it("o slug é um segmento de URL ditável (minúsculo, sem acento, sem espaço)", () => {
    expect(
      PAGE_SURFACES.map((surface) => surface.id).filter(
        (id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
      )
    ).toEqual([])
  })
})

describe("o que uma página aceita", () => {
  it("a lista é a dos tipos de seção menos os únicos", () => {
    // A derivação é do contrato; o teste existe para o dia em que alguém trocar
    // o `filter` por uma lista digitada — a partir daí, um tipo novo (ou o
    // `hero`) entraria numa página sem ninguém notar.
    expect(PAGE_SECTION_TYPES).toEqual(
      SECTION_TYPES.filter((type) => !isSingletonSectionType(type))
    )
  })

  it("nenhum tipo único (o cromo e a abertura da vitrine) entra numa página", () => {
    expect(PAGE_SECTION_TYPES.filter(isSingletonSectionType)).toEqual([])
  })

  it("toda página declara os blocos de página — nem mais, nem menos", () => {
    const diferentes = PAGE_SURFACES.filter(
      (surface) =>
        surface.types.length !== PAGE_SECTION_TYPES.length ||
        !PAGE_SECTION_TYPES.every((type) => surface.types.includes(type))
    )

    expect(diferentes.map((surface) => surface.id)).toEqual([])
  })

  it("o bloco `editorial` está na lista: é ele que monta as páginas hoje", () => {
    // Enquanto a F2 não traz o texto longo (o tipo `prose`), as páginas
    // institucionais são montadas com `editorial`/`banner`. Se a lista deixasse
    // de trazer os dois, as seis páginas nasceriam sem nenhum bloco possível —
    // e o CRM mostraria uma aba onde não dá para criar nada.
    expect(PAGE_SECTION_TYPES).toContain("editorial")
    expect(PAGE_SECTION_TYPES).toContain("banner")
  })

  it("as páginas declaradas são as da fila do negócio (14.3 do doc 14)", () => {
    // Ordem = fila: `perguntas-frequentes` é a última porque depende do bloco de
    // Q&A da F2. Este teste é o lugar onde mudar a fila é uma decisão explícita,
    // e não um efeito colateral de editar o contrato.
    expect(PAGE_SURFACES.map((surface) => surface.id)).toEqual([
      "sobre",
      "trocas-e-devolucoes",
      "privacidade",
      "termos",
      "contato",
      "perguntas-frequentes",
    ])
  })
})

/**
 * A rota em si — a peça que faz a URL existir.
 *
 * O teste é de **texto**, e de propósito: o que se está prendendo são as duas
 * decisões que, se sumirem, não quebram nada visível no mesmo commit e que não
 * têm teste de comportamento possível sem subir a loja (o 404 do slug não
 * declarado e o 404 da página vazia). É a mesma classe de guarda do
 * `wiring.unit.spec.ts` do backend: a ligação, não o dado.
 */
describe("a rota das páginas", () => {
  const rota = readFileSync(
    join(
      __dirname,
      "..",
      "..",
      "app",
      "[countryCode]",
      "(main)",
      "[slug]",
      "page.tsx"
    ),
    "utf8"
  )

  it("recusa o slug não declarado e a página vazia (os dois 404 do doc 14)", () => {
    // Sem o primeiro, um typo na URL (`/br/troca-e-devolucao`) abriria a home;
    // sem o segundo, a página sem bloco publicado herdaria o fallback da vitrine
    // (`DEFAULT_HOME_SECTIONS`) e **seria** a home, publicada sob `/privacidade`.
    // A contagem é por linha de código (`^\s+notFound\(\)$`): o arquivo fala de
    // `notFound()` nos comentários, e um `match` solto contaria a explicação.
    expect(rota.match(/^\s+notFound\(\)$/gm) ?? []).toHaveLength(2)
  })

  it("lê os blocos pela mesma porta da home e desenha pelo registro", () => {
    // O `getPageSections` é a leitura com a tag e a janela do conteúdo
    // (defeito 5); o `ContentSectionList` é o registro compartilhado, e é ele
    // quem traz a âncora (`id` do bloco) que a 14.8 do doc 14 avisa que não se
    // herda sozinha.
    expect(rota).toContain("getPageSections")
    expect(rota).toContain("ContentSectionList")
    expect(rota).toContain("findSurface")
    // A superfície tem de ser página: `/br/theme` e `/br/home` não desenham.
    expect(rota).toContain('kind !== "page"')
  })
})

/**
 * Os destinos do rodapé — o outro lado da promessa.
 * -------------------------------------------------------------------------
 * O doc 13 mediu o defeito: o site prometia ("Frete seguro", "Compra segura", a
 * coluna "Institucional" da referência) e não havia página que sustentasse a
 * promessa. O PR1 do doc 14 criou as páginas; o PR2 pôs as colunas no padrão do
 * rodapé — e é aqui que a ligação entre as duas coisas vira teste.
 *
 * A guarda é a **mesma régua** que o contrato documenta: um link do rodapé só
 * existe se o destino existir. Ela lê o diretório de verdade (as rotas fixas de
 * `(main)`) e a lista declarada (`PAGE_SURFACES`), e compara o **primeiro
 * segmento** — porque uma rota interna pode ter subcaminho (`/collections/
 * <handle>` é uma pasta estática com filha dinâmica, e o rodapé pode apontar
 * para ela). Um `href` digitado errado (`/privacidade-politica`, `/trocas`)
 * reprova **antes** de ir ao ar — que é o que o doc 13 pediu ("é esse item que
 * impede o próximo `/stroe`") e o que nenhum compilador pega: `href` é string.
 *
 * O que esta guarda **não** confere é a outra metade da régua: a página
 * declarada responde 404 enquanto estiver vazia (decisão 7). Isso é estado do
 * banco, não do código — quem responde é a medição do doc 14 (`curl`), e a régua
 * está registrada no comentário do bloco `footer` em `defaults.ts`.
 */
describe("os destinos do rodapé", () => {
  /** O rodapé do **padrão** — o mesmo bloco que `make seed` cria. */
  const footer = DEFAULT_HOME_SECTIONS.find(
    (section): section is FooterSection => section.type === "footer"
  ) as FooterSection

  const hrefs = footer.columns.flatMap((column) =>
    (column.links ?? []).map((link) => link.href)
  )

  /** Rota interna de rota própria: âncora (`/#editorial`) não é página. */
  const internos = hrefs.filter(
    (href) => href.startsWith("/") && !href.startsWith("//") && !href.includes("#")
  )

  const primeiroSegmento = (href: string) => href.split("/")[1] ?? ""

  const fixas = readdirSync(rotasDeMain, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("["))
    .map((entry) => entry.name)

  const conhecidos = new Set([
    ...fixas,
    ...PAGE_SURFACES.map((surface) => surface.id),
  ])

  it("o rodapé do padrão tem links internos (a guarda não pode passar vazia)", () => {
    // Mesma lição do guarda de colisão: sem esta linha, um `columns` esvaziado
    // faria a lista vir vazia e o teste passaria sempre.
    expect(footer.columns.map((column) => column.title)).toEqual([
      "Institucional",
      "Atendimento",
    ])
    expect(internos.length).toBeGreaterThanOrEqual(6)
  })

  it("todo destino interno aponta para uma rota que existe", () => {
    expect(
      internos.filter((href) => !conhecidos.has(primeiroSegmento(href)))
    ).toEqual([])
  })

  it("cada link de página usa o `id` da superfície como URL", () => {
    // O `href` do CMS é a URL, e a URL é o `id` declarado (14.6 do doc 14): um
    // `href` que "quase" casa (`/privacidade/`, `/privacidade-politica`)
    // responderia 404 com a página no ar — o modo de falha mais caro, porque
    // ninguém procura o link errado quando a página existe.
    expect(
      PAGE_SURFACES.map((surface) => `/${surface.id}`).filter(
        (href) => !internos.includes(href)
      )
    ).toEqual([])
  })
})
