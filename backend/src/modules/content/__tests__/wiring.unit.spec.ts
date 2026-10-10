/**
 * A fiação entre as pontas — o que cada uma **chama** e de onde lê.
 * -------------------------------------------------------------------------
 * Isto é o que sobrou de concreto da guarda de paridade
 * (`scripts/check-contract-parity.mjs`, apagada no G4) depois que o resto virou
 * tipo, teste de dado ou teste de comportamento: são decisões de projeto que
 * **nenhuma tipagem alcança** e que, desfeitas, não quebram nada visível no
 * mesmo commit.
 *
 *   - a rota do admin **serve o registro** (`service.getContract()`) em vez de
 *     montar o schema: se voltar a montar, o registro deixa de mandar e o
 *     `contract.ts` volta a decidir o formulário sozinho;
 *   - a porta da ordem renumera **uma vez**, pelo módulo, e avisa a loja uma
 *     vez (era um `PATCH` por seção, com a ordem podendo ficar pela metade);
 *   - o seed do schema tem `--check` (é o que a CI chama) e compara por
 *     `isDeepStrictEqual` — `data` é `jsonb` e não preserva ordem de chave;
 *   - os seeds leem as flags de `process.argv`, pelo helper (o `--force`
 *     documentado já esteve sem funcionar por causa disso);
 *   - o tema não volta a ser lido do disco nem copiado para a imagem, e o
 *     render do storefront e o formulário do CRM falam dos mesmos campos.
 *
 * A leitura é de **arquivo** porque é a ligação que se está conferindo. O dado
 * já tem teste de dado (`contract`, `defaults`, `themes`, `assets`) e o
 * comportamento tem teste de comportamento — o que mora aqui é o que sobra.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  CONTENT_SURFACES,
  SECTION_FIELDS,
  THEME_COLOR_TOKENS,
} from "../contract"
import { orderFaixa, reservedPositions } from "../order"

// `__dirname` e nao `import.meta.url`: o `tsconfig` do backend compila `.ts`
// para CommonJS (`module: Node16`), onde `import.meta` nao existe.
const root = join(__dirname, "../../../../..")
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8")

const adminRoute = read("backend", "src", "api", "admin", "content", "route.ts")
const orderRoute = read(
  "backend",
  "src",
  "api",
  "admin",
  "content",
  "order",
  "route.ts"
)
const service = read("backend", "src", "modules", "content", "service.ts")
const seedSchema = read("backend", "src", "scripts", "seed-schema.ts")
const seedContent = read("backend", "src", "scripts", "seed-content.ts")
const flags = read("backend", "src", "scripts", "flags.ts")

describe("a rota do admin e o registro do schema", () => {
  it("serve o registro que o serviço resolve, com a versão e a origem", () => {
    // O painel não importa o contrato: o que ele desenha chega por aqui. Servir
    // o `contract.ts` direto, sem passar pelo registro, faria a tela ignorar o
    // que está no banco — e o `--check` do seed viraria o único aviso.
    expect(adminRoute).toContain("service.getContract()")
    expect(adminRoute).toContain("schema: stored.schema")
    expect(adminRoute).toContain("schemaVersion: stored.version")
    expect(adminRoute).toContain("schemaSource: stored.source")
  })

  it("não monta o schema (a montagem é do `schema.ts`, o bootstrap)", () => {
    // A conferência é pelo **import** e pelas chaves montadas na mão, e não pela
    // menção a `buildSchema()`: citar a função num comentário é legítimo e útil,
    // e uma verificação que reprova comentário obriga o próximo a apagar a
    // explicação.
    expect(adminRoute).not.toMatch(/import\s*\{[^}]*\bbuildSchema\b/)

    for (const key of [
      "typeLabels:",
      "itemFields:",
      "singletonTypes:",
      "surfaces:",
    ]) {
      expect(adminRoute).not.toContain(key)
    }
  })

  it("amarra a superfície ao tipo nas duas portas que gravam", () => {
    // POST e PATCH. A regra é uma função só (`resolveSurface`, com teste próprio
    // em `validation.unit.spec.ts`); o que se confere aqui é que as **duas**
    // portas passam por ela — uma porta esquecida move bloco de superfície em
    // silêncio.
    expect(
      (adminRoute.match(/resolveSurface\(/g) ?? []).length
    ).toBeGreaterThanOrEqual(2)
  })

  it("tira a faixa da ordem da superfície do contrato", () => {
    const home = CONTENT_SURFACES.find(({ id }) => id === "home")

    expect(adminRoute).toContain("order: orderFaixa(surface)")
    expect(home).toBeDefined()
    // O numeral que a tela desenha com a ordem pendente é o mesmo que a gravação
    // vai usar: a faixa da superfície mais as casas ancoradas.
    expect(orderFaixa("home")).toEqual({
      ...home?.order,
      reserved: reservedPositions("home"),
    })
  })
})

describe("a porta da ordem", () => {
  it("renumera pelo módulo e avisa a loja uma vez", () => {
    // N requisições → 1: publicar a ordem era um `PATCH` por seção, cada um
    // gravando e avisando a loja; com uma falha no meio a ordem ficava pela
    // metade, e o aviso mandava "salvar de novo" para terminar o serviço.
    expect(orderRoute).toContain("applyOrder")
    expect(orderRoute).toContain("readOrderIds")
    expect((orderRoute.match(/notifyStorefront\(/g) ?? []).length).toBe(1)
    expect(orderRoute).not.toMatch(/method: "PATCH"/)
  })
})

describe("o registro do schema, do lado do seed", () => {
  it("tem `--check`, que não grava e compara sem `stringify`", () => {
    expect(seedSchema).toContain("--check")
    expect(seedSchema).toContain("isDeepStrictEqual")
    // `data` é `jsonb`: não preserva ordem de chave, então `JSON.stringify`
    // acusaria diff numa base recém-gravada.
    expect(seedSchema).not.toContain("JSON.stringify(stored")
  })

  it("os dois seeds leem as flags de `process.argv`, pelo helper", () => {
    expect(flags).toContain("process.argv")
    expect(seedSchema).toContain("scriptFlags")
    expect(seedContent).toContain("scriptFlags")
    // A leitura própria era o defeito: o `--force` documentado voltava a ser
    // ignorado em silêncio.
    expect(seedSchema).not.toMatch(/\(args \?\? \[\]\)\.includes\(/)
    expect(seedContent).not.toMatch(/\(args \?\? \[\]\)\.includes\(/)
  })

  it("o seed de conteúdo semeia toda página declarada", () => {
    // As páginas entram pela lista **do contrato** (`PAGE_SURFACES`), e não por
    // uma segunda lista digitada no script: uma página nova passaria a existir no
    // contrato e no CRM e **não** numa base nova — que é a linha "o loop do seed"
    // da tabela da superfície nova (14.10 do doc 14). O `...` é o que garante que
    // a lista está **dentro** do loop, e não só citada.
    expect(seedContent).toContain("PAGE_SURFACES")
    expect(seedContent).toMatch(/\.\.\.PAGE_SURFACES/)
  })

  it("o serviço delega a decisão registro × bootstrap a `resolveSchema`", () => {
    expect(service).toContain("resolveSchema")
  })
})

describe("o tema não volta ao disco nem à imagem", () => {
  const theme = read("frontend", "src", "lib", "theme.ts")
  const themeData = read("frontend", "src", "lib", "data", "theme.ts")
  const layout = read("frontend", "src", "app", "layout.tsx")
  const dockerfile = read("frontend", "Dockerfile")

  it("a loja pede a superfície de tema ao payload, com a tag do conteúdo", () => {
    expect(themeData).toContain('surface: "theme"')
    expect(themeData).toContain("CONTENT_CACHE_TAG")
  })

  it("a loja não lê o tema do disco: o `fs` saiu do caminho do request", () => {
    // Até a R4 o tema eram os `theme.json` de `themes/` lidos em request-time:
    // um `fs` que obrigava o `COPY` da pasta na imagem e que, quando a cópia
    // faltava, derrubava a loja no tema padrão **em silêncio**.
    expect(theme).not.toContain("readFileSync")
    expect(theme).not.toContain("readdirSync")
  })

  it("o fallback continua embutido — um `import` do JSON, não a pasta", () => {
    expect(theme).toContain("../../themes/default/theme.json")
  })

  it("monta as variáveis das listas do contrato, sem digitá-las", () => {
    const digitados = THEME_COLOR_TOKENS.filter((token) =>
      theme.includes(`"--rv-${token}"`)
    )

    expect(theme).toContain("THEME_COLOR_TOKENS")
    expect(digitados).toEqual([])
  })

  it("o layout espera o tema pelo módulo de dados", () => {
    expect(layout).toContain("await getActiveTheme()")
    expect(layout).toContain("@lib/data/theme")
    expect(layout).not.toContain("getActiveTheme, themeToCSSVariables")
  })

  it("o `themes/` não é copiado para a imagem do storefront", () => {
    // A pasta ficou só no contexto do build (o JSON é importado no bundle).
    expect(dockerfile).not.toContain(
      "COPY --from=builder --chown=nextjs:nextjs /app/themes"
    )
  })
})

describe("o que o render lê, o CRM edita", () => {
  /**
   * Campo que o render lê e o contrato não declara fica **sem editor**: aparece
   * na loja, o lojista não tem como mudar, e o valor gravado fica órfão no
   * `data` (o `PATCH` mescla; medido em 2026-09-29, na R1). O inverso — campo
   * declarado que o render ignora — é escolha que não faz nada.
   */
  const lidos = (source: string, prefixo: string): string[] => [
    ...new Set(
      [
        ...source.matchAll(
          new RegExp(`\\b${prefixo}\\.([A-Za-z_$][\\w$]*)`, "g")
        ),
      ].map((match) => match[1])
    ),
  ]

  const camposDe = (
    type: "footer" | "launches" | "featured" | "prose" | "faq"
  ): string[] => (SECTION_FIELDS[type] ?? []).map((field) => field.name)

  const semEditor = (reads: string[], editaveis: string[]): string[] =>
    reads.filter((name) => !editaveis.includes(name))

  it("todo campo que o rodapé lê tem editor em `SECTION_FIELDS.footer`", () => {
    const reads = lidos(
      read(
        "frontend",
        "src",
        "modules",
        "layout",
        "templates",
        "footer",
        "index.tsx"
      ),
      "content"
    )

    expect(reads.length).toBeGreaterThan(0)
    expect(semEditor(reads, camposDe("footer"))).toEqual([])
  })

  it("todo campo que o trilho de lançamentos lê tem editor", () => {
    const reads = lidos(
      read(
        "frontend",
        "src",
        "modules",
        "home",
        "components",
        "launches-rail",
        "index.tsx"
      ),
      "section"
    )

    expect(reads.length).toBeGreaterThan(0)
    expect(semEditor(reads, camposDe("launches"))).toEqual([])
  })

  it("todo campo que a vitrine de destaque lê tem editor", () => {
    const reads = lidos(
      read(
        "frontend",
        "src",
        "modules",
        "home",
        "components",
        "featured-products",
        "index.tsx"
      ),
      "section"
    )

    expect(reads.length).toBeGreaterThan(0)
    expect(semEditor(reads, camposDe("featured"))).toEqual([])
  })

  /**
   * As seções cujo desenho inteiro mora num arquivo só — hoje **as duas**, o
   * `prose` e o `faq`, que são o par de 14.6.2. Só nelas dá para comparar as
   * duas listas de igual para igual (o desenho das outras se espalha por
   * componente, rodapé e layout, e a leitura de arquivo não alcança o todo); e é
   * nelas que os **dois** sentidos importam: campo declarado que a página ignora
   * é escolha que não faz nada — o lojista digita o rótulo do anexo e o botão
   * continua com o texto genérico, ou escreve a pergunta e ela não sai —, e
   * campo que a página lê sem estar declarado fica **sem editor**, que é o
   * defeito que os três testes acima prendem.
   */
  for (const [type, arquivo] of [
    ["prose", "prose.tsx"],
    ["faq", "faq.tsx"],
  ] as const) {
    it(`os campos do \`${type}\` são exatamente os que a página lê`, () => {
      const fonte = read("frontend", "src", "modules", "content", arquivo)
      const lidos2 = [
        ...new Set(
          [...fonte.matchAll(/\bsection\.([A-Za-z_$][\w$]*)/g)].map(
            (match) => match[1]
          )
        ),
      ]

      expect(lidos2.sort()).toEqual(camposDe(type).sort())
    })
  }
})
